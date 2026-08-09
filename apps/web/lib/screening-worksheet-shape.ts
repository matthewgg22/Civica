// Shared shape between the two "views" of a screening's worksheet: the
// live ScreeningWorksheet component and the exported PDF document. Both
// read the SAME outcome copy and calc-row ordering from here so a change
// to one can't silently drift from the other — the exact failure mode
// completeFactsShape() in @civica/demeter-engine was built to avoid, one
// layer up in the stack.

export const OUTCOME_COPY: Record<
  string,
  { label: string; tone: "certain" | "warn" | "deny" | "pending" }
> = {
  categorically_eligible: { label: "Categorically eligible", tone: "certain" },
  expedited: { label: "Expedited", tone: "certain" },
  likely_eligible: { label: "Likely eligible", tone: "certain" },
  likely_ineligible: { label: "Likely ineligible", tone: "deny" },
  needs_county_review: { label: "Needs county review", tone: "warn" },
  not_enough_information: { label: "Not enough information", tone: "pending" },
};

export interface BenefitCalcDetail {
  gross_monthly_income: number;
  earned_income_deduction: number;
  standard_deduction: number;
  dependent_care_deduction: number;
  medical_deduction: number;
  child_support_deduction: number;
  excess_shelter_deduction: number;
  net_monthly_income: number;
  thirty_percent_of_net: number;
  max_allotment_for_household_size: number;
  monthly_benefit: number;
}

export const CALC_ROWS: Array<[keyof BenefitCalcDetail, string]> = [
  ["gross_monthly_income", "Gross monthly income"],
  ["earned_income_deduction", "Earned income deduction, 20%"],
  ["standard_deduction", "Standard deduction"],
  ["dependent_care_deduction", "Dependent care deduction"],
  ["medical_deduction", "Excess medical, over $35"],
  ["child_support_deduction", "Child support paid"],
  ["excess_shelter_deduction", "Excess shelter deduction"],
  ["net_monthly_income", "Net monthly income"],
  ["max_allotment_for_household_size", "Maximum allotment"],
];

export function money(n: number): string {
  return n < 0 ? `-$${Math.abs(n).toLocaleString()}` : `$${n.toLocaleString()}`;
}
