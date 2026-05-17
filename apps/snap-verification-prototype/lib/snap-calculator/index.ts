// SNAP net income and benefit estimation (FY2025 federal CONUS figures).
//
// Calculation chain (7 CFR 273.10):
//   0. Gross income test — 130% FPL (waived in CA via BBCE for gross ≤ 200% FPL)
//   1. Gross earned income × 0.80  (20% earned income deduction)
//   2. Gross income − standard deduction (by HH size)
//   3. Subtract dependent care deduction (capped at $200/$175)
//   4. Subtract excess shelter deduction (capped unless elderly/disabled)
//   5. Net income test — 100% FPL
//   6. Benefit = max(max_allotment − 30% × net, min_allotment)

import type { StateCode } from "@/types/verification";

// FY2025 CONUS maximum net monthly allotments by household size (48 states + DC)
const MAX_ALLOTMENT: Record<number, number> = {
  1: 292, 2: 536, 3: 768, 4: 975, 5: 1158, 6: 1390, 7: 1536, 8: 1756,
};
const MAX_ALLOTMENT_EXTRA_PER_PERSON = 220;

// Standard deductions by household size (FY2025 48-state + DC)
const STANDARD_DEDUCTION: Record<number, number> = {
  1: 198, 2: 198, 3: 198, 4: 209, 5: 244, 6: 279,
};
const STANDARD_DEDUCTION_LARGE_HH = 279;

// Excess shelter deduction cap for non-elderly/non-disabled, FY2025
const SHELTER_DEDUCTION_CAP = 672;

// Dependent care deduction caps
const DEP_CARE_CAP_CHILD_UNDER_2 = 200;
const DEP_CARE_CAP_OTHER = 175;

// FY2025 SNAP income limits (48 states + DC) — FNS-published monthly figures.
// Hardcoded for sizes 1-8; extrapolated beyond 8 using per-person increments.
const NET_INCOME_LIMIT: Record<number, number> = {
  1: 1255, 2: 1703, 3: 2152, 4: 2600, 5: 3049, 6: 3498, 7: 3946, 8: 4395,
};
const NET_INCOME_LIMIT_EXTRA = 449;

const GROSS_INCOME_LIMIT: Record<number, number> = {
  1: 1632, 2: 2215, 3: 2799, 4: 3383, 5: 3967, 6: 4550, 7: 5134, 8: 5718,
};
const GROSS_INCOME_LIMIT_EXTRA = 584;

export function grossIncomeLimitMonthly(size: number): number {
  if (size <= 8) return GROSS_INCOME_LIMIT[size] ?? GROSS_INCOME_LIMIT[8];
  return (GROSS_INCOME_LIMIT[8] ?? 5718) + (size - 8) * GROSS_INCOME_LIMIT_EXTRA;
}
export function netIncomeLimitMonthly(size: number): number {
  if (size <= 8) return NET_INCOME_LIMIT[size] ?? NET_INCOME_LIMIT[8];
  return (NET_INCOME_LIMIT[8] ?? 4395) + (size - 8) * NET_INCOME_LIMIT_EXTRA;
}
// CA BBCE threshold = 200% FPL (derived from net income limit × 2)
export function bbceIncomeLimitMonthly(size: number): number {
  return netIncomeLimitMonthly(size) * 2;
}

// CA's broad-based categorical eligibility waives the gross income test and asset test
// for households with gross income ≤ 200% FPL (7 CFR 273.2(j); CA CDSS ACL 11-27).
export function isCaBbceEligible(grossIncome: number, householdSize: number): boolean {
  return grossIncome <= bbceIncomeLimitMonthly(householdSize);
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
  gross_income_test_waived: boolean;  // true when CA BBCE applies
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
  eligible: boolean;  // both income tests pass (or waived)
  max_allotment: number;
  thirty_pct_net: number;
  estimated_benefit: number;
  benefit_capped: boolean;
}

function maxAllotment(size: number): number {
  if (size <= 8) return MAX_ALLOTMENT[size] ?? MAX_ALLOTMENT[8];
  return (MAX_ALLOTMENT[8] ?? 1756) + (size - 8) * MAX_ALLOTMENT_EXTRA_PER_PERSON;
}

function standardDeduction(size: number): number {
  return STANDARD_DEDUCTION[size] ?? STANDARD_DEDUCTION_LARGE_HH;
}

export function calculateSnapBenefit(input: SnapCalculatorInput): SnapDeductionBreakdown {
  const {
    stateCode,
    householdSize,
    grossMonthlyEarnedIncome,
    grossMonthlyUnearnedIncome,
    monthlySheltCost,
    monthlySuaAmount,
    monthlyDependentCareCost,
    hasChildUnder2,
    elderlyOrDisabled,
  } = input;

  const gross_income = grossMonthlyEarnedIncome + grossMonthlyUnearnedIncome;
  const gross_income_limit = grossIncomeLimitMonthly(householdSize);
  const net_income_limit = netIncomeLimitMonthly(householdSize);

  // Gross income test
  const bbce_eligible = stateCode === "CA" && isCaBbceEligible(gross_income, householdSize);
  const gross_income_test_waived = bbce_eligible;
  const gross_income_test_pass = gross_income_test_waived || gross_income <= gross_income_limit;

  // 20% earned income deduction (7 CFR 273.10(e)(1))
  const earned_income_deduction = Math.round(grossMonthlyEarnedIncome * 0.2);

  // Standard deduction
  const standard_deduction = standardDeduction(householdSize);

  // Dependent care deduction (7 CFR 273.10(d)(4))
  const dep_cap = hasChildUnder2 ? DEP_CARE_CAP_CHILD_UNDER_2 : DEP_CARE_CAP_OTHER;
  const dependent_care_deduction = Math.min(monthlyDependentCareCost, dep_cap);

  // Adjusted net before shelter
  const adjusted_net_before_shelter = Math.max(
    0,
    gross_income - earned_income_deduction - standard_deduction - dependent_care_deduction
  );

  // Shelter cost = rent + SUA
  const shelter_cost_total = monthlySheltCost + monthlySuaAmount;

  // Excess shelter (7 CFR 273.10(d)(6))
  const half_adjusted_net = Math.round(adjusted_net_before_shelter * 0.5);
  const excess_shelter = Math.max(0, shelter_cost_total - half_adjusted_net);

  // Cap unless elderly/disabled
  const shelter_deduction_applied = elderlyOrDisabled
    ? excess_shelter
    : Math.min(excess_shelter, SHELTER_DEDUCTION_CAP);

  const net_income = Math.max(0, adjusted_net_before_shelter - shelter_deduction_applied);
  const net_income_test_pass = net_income <= net_income_limit;
  const eligible = gross_income_test_pass && net_income_test_pass;

  const max_allot = maxAllotment(householdSize);
  const thirty_pct_net = Math.round(net_income * 0.3);
  const raw_benefit = eligible ? max_allot - thirty_pct_net : 0;

  // Minimum benefit $23 for 1-2 person households when eligible
  const min_benefit = eligible && householdSize <= 2 ? 23 : 0;
  const estimated_benefit = Math.max(min_benefit, Math.min(raw_benefit, max_allot));
  const benefit_capped = raw_benefit > max_allot;

  return {
    gross_income,
    gross_income_limit,
    gross_income_test_pass,
    gross_income_test_waived,
    bbce_eligible,
    net_income_limit,
    earned_income_deduction,
    standard_deduction,
    dependent_care_deduction,
    adjusted_net_before_shelter,
    shelter_cost_total,
    half_adjusted_net,
    excess_shelter,
    shelter_deduction_applied,
    net_income,
    net_income_test_pass,
    eligible,
    max_allotment: max_allot,
    thirty_pct_net,
    estimated_benefit,
    benefit_capped,
  };
}

export const SUA_AMOUNTS: Record<StateCode, { full: number; limited: number; telephone: number }> = {
  CA: { full: 670, limited: 159, telephone: 23 },
  MA: { full: 745, limited: 488, telephone: 38 },
};
