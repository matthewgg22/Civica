import type { WorkRequirementInput, WorkRequirementResult, ExemptionType, FeatureFlags } from './types';

// OBBBA §10102(a) age bounds: 18–64 (raised from 18–54 by P.L. 119-21, eff. July 4 2025).
// CA implementation: June 1, 2026 per ACL 25-93.
const MIN_AGE = 18;
const MAX_AGE = 64;

// §10102: household member is NOT subject if they have a dependent child UNDER age 14.
// (The prior ABAWD rule used under-18; this is the key OBBBA change.)
const DEPENDENT_EXEMPTION_AGE_CUTOFF = 14;

// Caretaker exemption: caring for a dependent child under age 6.
const CARETAKER_UNDER_6_CUTOFF = 6;

const BASE_CITATIONS: WorkRequirementResult['citations'] = [
  { section: '7 CFR 273.24', title: 'SNAP work requirements' },
  { section: 'OBBBA §10102', title: 'Work requirement expansion (P.L. 119-21)' },
  { section: '7 CFR 273.24(b)(6)', title: 'Native American tribal exemption' },
  { section: '7 CFR 273.7(d)(1)', title: 'Qualifying program exemption' },
];

/**
 * Per-member determination: whether the member is subject, exempt (with type),
 * or simply not subject (due to under-14 dependent, no exemption type assigned).
 */
type MemberDetermination =
  | { kind: 'subject' }
  | { kind: 'exempt'; exemptionType: ExemptionType; reason: string }
  | { kind: 'not_subject_age' }        // outside 18–64 age band
  | { kind: 'not_subject_dependent' }; // has dependent 6–13 (under-14 cutoff, no explicit exemption)

function determineMember(
  m: WorkRequirementInput['householdMembers'][number],
  hasWaiverCounty: boolean,
  state: WorkRequirementInput['state'],
  featureFlags: FeatureFlags,
): MemberDetermination {
  // Age gate: only 18–64 are subject (OBBBA §10102(a))
  if (m.age < MIN_AGE || m.age > MAX_AGE) return { kind: 'not_subject_age' };

  // Session A — CA LPIE override (gated by server-side feature flag).
  // When CA + half-time + degree/certificate program AND the flag is on,
  // surface the LPIE exemption BEFORE the standard 5-path checklist so it
  // takes precedence. Flipping the flag off in the DB reverts behavior.
  // TODO: replace with actual CA CDSS ACL number for LPIE expansion (Matthew to provide)
  if (
    state === 'CA'
    && featureFlags.lpie_auto_exempt_enabled === true
    && m.halfTimeEnrolled === true
    && m.degreeOrCertificateProgram === true
  ) {
    return {
      kind: 'exempt',
      exemptionType: 'lpie_half_time_degree',
      reason: 'Enrolled at least half-time in a degree or certificate program at a CA Community College, CSU, or UC',
    };
  }

  const childAges = m.dependentChildAges ?? [];

  // Caretaker of a child under 6 → explicit statutory exemption (7 CFR 273.24(b)(5))
  // Check this before the under-14 sweep so under-6 dependents get the exemption type.
  if (childAges.some((age) => age < CARETAKER_UNDER_6_CUTOFF)) {
    return { kind: 'exempt', exemptionType: 'caretaker_under_6', reason: 'Member is caretaker of a child under age 6' };
  }

  // §10102 cutoff: dependent child under 14 → not subject (no explicit exemption type)
  if (childAges.some((age) => age < DEPENDENT_EXEMPTION_AGE_CUTOFF)) {
    return { kind: 'not_subject_dependent' };
  }

  // Named exemptions (checked in priority order)
  if (m.receivesSSI || m.receivesSSDA) {
    return { kind: 'exempt', exemptionType: 'ssdi_ssi', reason: 'Member receives SSI or SSDA benefits' };
  }
  if (m.isTribalMember) {
    return { kind: 'exempt', exemptionType: 'native_american', reason: 'Enrolled tribal member — exempt per 7 CFR 273.24(b)(6)' };
  }
  if (m.hasDisability) {
    return { kind: 'exempt', exemptionType: 'disability', reason: 'Member has documented disability' };
  }
  if (m.isPregnant) {
    return { kind: 'exempt', exemptionType: 'pregnancy', reason: 'Member is pregnant' };
  }
  if (m.isEnrolledInQualifyingProgram) {
    return { kind: 'exempt', exemptionType: 'qualifying_program', reason: 'Member enrolled in qualifying program per 7 CFR 273.7(d)(1)' };
  }

  // Waiver county covers all remaining members who reach this point
  if (hasWaiverCounty) {
    return { kind: 'exempt', exemptionType: 'waiver_county', reason: 'County has an active USDA ABAWD waiver' };
  }

  return { kind: 'subject' };
}

/**
 * Pure function — no I/O. Determines whether any household member is subject to
 * SNAP work requirements under OBBBA §10102.
 *
 * Logic (per member):
 * 1. Must be aged 18–64 (OBBBA §10102(a)).
 * 2. Caretaker of a child under 6 → exempt (caretaker_under_6).
 * 3. Has dependent child 6–13 (under §10102 cutoff of 14) → not subject (no exemption type).
 * 4. SSI/SSDA → exempt (ssdi_ssi).
 * 5. Tribal member → exempt (native_american) per 7 CFR 273.24(b)(6).
 * 6. Disability → exempt (disability).
 * 7. Pregnancy → exempt (pregnancy).
 * 8. Enrolled in qualifying program → exempt (qualifying_program) per 7 CFR 273.7(d)(1).
 * 9. Waiver county → exempt (waiver_county).
 * 10. Remaining → subject.
 *
 * The caretaker_under_6 check (step 2) precedes the under-14 sweep (step 3) so
 * that under-6 dependents produce the statutory exemption type rather than the
 * generic "not subject due to dependent" determination.
 */
export function evaluateWorkRequirement(
  input: WorkRequirementInput,
  featureFlags: FeatureFlags = {},
): WorkRequirementResult {
  const determinations = input.householdMembers.map((m) => ({
    member: m,
    det: determineMember(m, input.hasWaiverCounty, input.state, featureFlags),
  }));

  const subjectMembers = determinations.filter((d) => d.det.kind === 'subject').map((d) => d.member);

  // Capture the first (highest priority) exemption type seen across non-subject members.
  // This is reported at the household level when isSubject is false.
  let dominantExemptionType: ExemptionType | null = null;
  let dominantExemptionReason: string | null = null;
  for (const { det } of determinations) {
    if (det.kind === 'exempt' && !dominantExemptionType) {
      dominantExemptionType = det.exemptionType;
      dominantExemptionReason = det.reason;
      break;
    }
  }

  const isSubject = subjectMembers.length > 0;
  const subjectMemberIds = subjectMembers.map((m) => m.id);

  return {
    isSubject,
    subjectMemberIds,
    exemptionType: isSubject ? null : dominantExemptionType,
    exemptionReason: isSubject ? null : dominantExemptionReason,
    timeLimitApplicable: isSubject,
    citations: BASE_CITATIONS,
  };
}
