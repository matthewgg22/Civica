export type ExemptionType =
  | 'disability'
  | 'pregnancy'
  | 'caretaker_under_6'
  | 'qualifying_program'
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
    dependentChildAges?: number[];   // ages of children this member is caretaker for
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
