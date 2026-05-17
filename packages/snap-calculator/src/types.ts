export type StateCode = "CA" | "MA";
export type SuaTier = "full" | "limited" | "telephone" | "none";
export type Confidence = "high" | "medium" | "low" | "none";
export type VerificationFlow = "utility" | "shared-lease" | "gig-income" | "assets";

export interface UtilityIntake {
  state_code: StateCode;
  landlord_pays_any: boolean;
  utilities_paid_by_applicant: {
    heat_gas: boolean;
    electricity: boolean;
    cooling: boolean;
    water: boolean;
    phone_internet: boolean;
    none: boolean;
  };
}

export interface SnapCalculatorInput {
  stateCode: StateCode;
  householdSize: number;
  grossMonthlyEarnedIncome: number;
  grossMonthlyUnearnedIncome: number;
  monthlySheltCost: number;
  monthlySuaAmount: number;
  monthlyDependentCareCost: number;
  hasChildUnder2: boolean;
  elderlyOrDisabled: boolean;
}

export interface SnapDeductionBreakdown {
  gross_income: number;
  gross_income_limit: number;
  gross_income_test_pass: boolean;
  gross_income_test_waived: boolean;
  bbce_eligible: boolean;
  net_income_limit: number;
  earned_income_deduction: number;
  standard_deduction: number;
  dependent_care_deduction: number;
  adjusted_net_before_shelter: number;
  shelter_cost_total: number;
  half_adjusted_net: number;
  excess_shelter: number;
  shelter_deduction_applied: number;
  net_income: number;
  net_income_test_pass: boolean;
  eligible: boolean;
  max_allotment: number;
  thirty_pct_net: number;
  estimated_benefit: number;
  benefit_capped: boolean;
}
