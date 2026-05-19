import { describe, it, expect } from 'vitest';
import { evaluateWorkRequirement } from '../src/work-requirements/evaluate.js';
import type { WorkRequirementInput } from '../src/work-requirements/types.js';

// Shared citations the engine always emits
const EXPECTED_CITATIONS = [
  { section: '7 CFR 273.24', title: 'SNAP work requirements' },
  { section: 'OBBBA §10102', title: 'Work requirement expansion (P.L. 119-21)' },
  { section: '7 CFR 273.24(b)(6)', title: 'Native American tribal exemption' },
  { section: '7 CFR 273.7(d)(1)', title: 'Qualifying program exemption' },
];

function input(overrides: Partial<WorkRequirementInput> & { members?: WorkRequirementInput['householdMembers'] }): WorkRequirementInput {
  return {
    state: 'CA',
    householdMembers: overrides.members ?? [],
    hasWaiverCounty: false,
    ...overrides,
  };
}

describe('evaluateWorkRequirement', () => {

  // ── Age bounds ──────────────────────────────────────────────────────────────

  it('single adult age 30, no dependents → isSubject: true', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30 }],
    }));
    expect(result.isSubject).toBe(true);
    expect(result.subjectMemberIds).toEqual(['m1']);
    expect(result.timeLimitApplicable).toBe(true);
    expect(result.exemptionType).toBeNull();
    expect(result.citations).toEqual(EXPECTED_CITATIONS);
  });

  it('adult age 55 → isSubject: false (above age cutoff)', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 55 }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.subjectMemberIds).toEqual([]);
    expect(result.timeLimitApplicable).toBe(false);
  });

  it('adult age 17 → isSubject: false (below age cutoff)', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 17 }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.subjectMemberIds).toEqual([]);
  });

  // ── §10102 dependent child cutoff ───────────────────────────────────────────

  it('adult age 30 with dependent child age 8 (under 14) → isSubject: false', () => {
    // §10102 moved the cutoff from under-18 to under-14: household with a child 8 is NOT subject
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, dependentChildAges: [8] }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.subjectMemberIds).toEqual([]);
    expect(result.timeLimitApplicable).toBe(false);
  });

  it('adult age 30 with dependent child age 15 (over 14) → isSubject: true (new §10102 expansion)', () => {
    // Child is 15 — above the §10102 cutoff of 14 — so parent IS subject
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, dependentChildAges: [15] }],
    }));
    expect(result.isSubject).toBe(true);
    expect(result.subjectMemberIds).toEqual(['m1']);
  });

  // ── Exemptions ──────────────────────────────────────────────────────────────

  it('pregnant adult → exempt, exemptionType: pregnancy', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, isPregnant: true }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.exemptionType).toBe('pregnancy');
    expect(result.exemptionReason).toBeTruthy();
  });

  it('adult with disability → exempt, exemptionType: disability', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, hasDisability: true }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.exemptionType).toBe('disability');
  });

  it('adult receiving SSI → exempt, exemptionType: ssdi_ssi', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, receivesSSI: true }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.exemptionType).toBe('ssdi_ssi');
  });

  it('adult receiving SSDA → exempt, exemptionType: ssdi_ssi', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, receivesSSDA: true }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.exemptionType).toBe('ssdi_ssi');
  });

  it('adult with dependent child age 4 (under 6) → exempt, exemptionType: caretaker_under_6', () => {
    // Child 4 is < 6 → statutory caretaker_under_6 exemption fires first
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, dependentChildAges: [4] }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.exemptionType).toBe('caretaker_under_6');
  });

  it('adult with dependent child age 5 (under 6) → exempt, exemptionType: caretaker_under_6', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, dependentChildAges: [5] }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.exemptionType).toBe('caretaker_under_6');
  });

  it('adult with children [15, 4] → exempt (child 4 fires caretaker_under_6 first)', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, dependentChildAges: [15, 4] }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.exemptionType).toBe('caretaker_under_6');
  });

  it('adult with child age 7 (above 6, below 14) → not subject, no exemption type', () => {
    // Child 7 is >= 6 (no caretaker exemption) but < 14 (not subject per §10102 cutoff)
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, dependentChildAges: [7] }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.exemptionType).toBeNull();
  });

  it('caretaker_under_6 exemption fires when children include one under 6', () => {
    // Child ages: 14 (not < 6, not < 14) + 5 (< 6 → caretaker_under_6 fires first)
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, dependentChildAges: [14, 5] }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.exemptionType).toBe('caretaker_under_6');
  });

  // ── Waiver county ───────────────────────────────────────────────────────────

  it('waiver county → isSubject: false for otherwise-subject adult', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30 }],
      hasWaiverCounty: true,
    }));
    expect(result.isSubject).toBe(false);
    expect(result.subjectMemberIds).toEqual([]);
    expect(result.exemptionType).toBe('waiver_county');
  });

  // ── Mixed household ─────────────────────────────────────────────────────────

  it('mixed household: one subject + one exempt → isSubject: true, only subject in subjectMemberIds', () => {
    const result = evaluateWorkRequirement(input({
      members: [
        { id: 'm1', age: 30 },                         // no exemptions → subject
        { id: 'm2', age: 35, hasDisability: true },    // disability → exempt
      ],
    }));
    expect(result.isSubject).toBe(true);
    expect(result.subjectMemberIds).toEqual(['m1']);
    expect(result.subjectMemberIds).not.toContain('m2');
    // When isSubject is true, exemptionType is null (exemption only applies when everyone is exempt)
    expect(result.exemptionType).toBeNull();
  });

  it('household where all members are exempt → isSubject: false, captures first exemption type', () => {
    const result = evaluateWorkRequirement(input({
      members: [
        { id: 'm1', age: 30, isPregnant: true },
        { id: 'm2', age: 40, hasDisability: true },
      ],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.subjectMemberIds).toEqual([]);
    // ssdi_ssi > disability > pregnancy in priority — but m1 is pregnant (no SSI/disability),
    // m2 has disability. The dominant exemption is captured by processing order (m1 first).
    // m1: no SSI, no disability, is pregnant → pregnancy exemption captured first.
    expect(result.exemptionType).toBe('pregnancy');
  });

  it('empty household → isSubject: false', () => {
    const result = evaluateWorkRequirement(input({ members: [] }));
    expect(result.isSubject).toBe(false);
    expect(result.subjectMemberIds).toEqual([]);
    expect(result.timeLimitApplicable).toBe(false);
    expect(result.exemptionType).toBeNull();
  });

  // ── Citations always present ────────────────────────────────────────────────

  it('citations are always emitted regardless of determination', () => {
    const subject = evaluateWorkRequirement(input({ members: [{ id: 'm1', age: 30 }] }));
    const exempt = evaluateWorkRequirement(input({ members: [{ id: 'm1', age: 30, isPregnant: true }] }));
    const neither = evaluateWorkRequirement(input({ members: [{ id: 'm1', age: 60 }] }));

    for (const result of [subject, exempt, neither]) {
      expect(result.citations).toEqual(EXPECTED_CITATIONS);
      expect(result.citations).toHaveLength(4);
    }
  });

  // ── Native American tribal exemption (OBBBA 1.3, 7 CFR 273.24(b)(6)) ───────

  it('tribal member → exempt, exemptionType: native_american', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, isTribalMember: true }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.exemptionType).toBe('native_american');
    expect(result.exemptionReason).toMatch(/7 CFR 273\.24\(b\)\(6\)/);
    expect(result.subjectMemberIds).toEqual([]);
    expect(result.timeLimitApplicable).toBe(false);
  });

  it('isTribalMember: false + no other exemption → isSubject: true (flag off has no effect)', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, isTribalMember: false }],
    }));
    expect(result.isSubject).toBe(true);
    expect(result.subjectMemberIds).toEqual(['m1']);
    expect(result.exemptionType).toBeNull();
  });

  it('SSI takes priority over native_american (SSI check comes first)', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, receivesSSI: true, isTribalMember: true }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.exemptionType).toBe('ssdi_ssi');
  });

  it('mixed household: tribal member exempt, subject member still flagged → isSubject: true', () => {
    const result = evaluateWorkRequirement(input({
      members: [
        { id: 'm1', age: 30, isTribalMember: true },  // exempt
        { id: 'm2', age: 35 },                         // subject
      ],
    }));
    expect(result.isSubject).toBe(true);
    expect(result.subjectMemberIds).toEqual(['m2']);
    expect(result.subjectMemberIds).not.toContain('m1');
    expect(result.exemptionType).toBeNull();
  });

  // ── Qualifying program exemption (7 CFR 273.7(d)(1)) ────────────────────────

  it('enrolled in qualifying program → exempt, exemptionType: qualifying_program', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, isEnrolledInQualifyingProgram: true }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.exemptionType).toBe('qualifying_program');
    expect(result.exemptionReason).toMatch(/7 CFR 273\.7\(d\)\(1\)/);
    expect(result.subjectMemberIds).toEqual([]);
  });

  it('SSI takes priority over qualifying_program (SSI check comes first)', () => {
    const result = evaluateWorkRequirement(input({
      members: [{ id: 'm1', age: 30, receivesSSI: true, isEnrolledInQualifyingProgram: true }],
    }));
    expect(result.isSubject).toBe(false);
    expect(result.exemptionType).toBe('ssdi_ssi');
  });

  // ── MA state parity ─────────────────────────────────────────────────────────

  it('MA state: same logic applies', () => {
    const result = evaluateWorkRequirement({
      state: 'MA',
      householdMembers: [{ id: 'm1', age: 30 }],
      hasWaiverCounty: false,
    });
    expect(result.isSubject).toBe(true);
    expect(result.citations).toEqual(EXPECTED_CITATIONS);
  });

});
