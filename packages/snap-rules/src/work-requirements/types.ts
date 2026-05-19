export type ExemptionType =
  | 'disability'
  | 'pregnancy'
  | 'caretaker_under_6'
  | 'qualifying_program'
  | 'native_american'
  | 'waiver_county'
  | 'ssdi_ssi'
  // Session A: CA LPIE expansion — at-least-half-time enrollment in a
  // degree or certificate program at a CA Community College, CSU, or UC
  // counts as a qualifying student exemption. Gated by the server-side
  // `lpie_auto_exempt_enabled` flag.
  // TODO: replace with actual CA CDSS ACL number for LPIE expansion (Matthew to provide)
  | 'lpie_half_time_degree'
  | 'none';

export type WorkRequirementInput = {
  state: 'CA' | 'MA';
  householdMembers: Array<{
    id: string;
    age: number;
    isPregnant?: boolean;
    hasDisability?: boolean;
    receivesSSI?: boolean;
    receivesSSDA?: boolean;
    dependentChildAges?: number[];              // ages of children this member is caretaker for
    isTribalMember?: boolean;                   // federally enrolled tribal member (7 CFR 273.24(b)(6))
    isEnrolledInQualifyingProgram?: boolean;    // drug/alcohol tx, SNAP E&T, community MH (7 CFR 273.7(d)(1))
    // Session A — CA LPIE override inputs (ignored unless state === 'CA'
    // AND featureFlags.lpie_auto_exempt_enabled is true).
    halfTimeEnrolled?: boolean;
    degreeOrCertificateProgram?: boolean;
  }>;
  hasWaiverCounty: boolean;
};

/**
 * Server-side feature-flag snapshot passed into evaluateWorkRequirement.
 * Fetched from GET /v1/enrollment/feature-flags by the API layer; the
 * pure engine just reads the booleans.
 */
export type FeatureFlags = {
  lpie_auto_exempt_enabled?: boolean;
};

export type WorkRequirementResult = {
  isSubject: boolean;
  subjectMemberIds: string[];
  exemptionType: ExemptionType | null;
  exemptionReason: string | null;
  timeLimitApplicable: boolean;
  citations: Array<{ section: string; title: string; url?: string }>;
};
