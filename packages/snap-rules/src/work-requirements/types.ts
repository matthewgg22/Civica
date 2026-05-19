export type ExemptionType =
  | 'disability'
  | 'pregnancy'
  | 'caretaker_under_6'
  | 'qualifying_program'
  | 'native_american'
  | 'waiver_county'
  | 'ssdi_ssi'
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
  }>;
  hasWaiverCounty: boolean;
};

export type WorkRequirementResult = {
  isSubject: boolean;
  subjectMemberIds: string[];
  exemptionType: ExemptionType | null;
  exemptionReason: string | null;
  timeLimitApplicable: boolean;
  citations: Array<{ section: string; title: string; url?: string }>;
};
