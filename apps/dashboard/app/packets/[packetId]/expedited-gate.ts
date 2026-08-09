// Expedited-review gate decision logic (OBBBA §10102(a) / 7 CFR 273.2(i)).
// Extracted from page.tsx (#557) so it's unit-testable without rendering the
// whole packet detail page — this was previously ~15 lines of inline
// business logic with zero test coverage.
//
// Path 3 (destitute migrant/seasonal farmworker, 7 CFR 273.2(i)(1)(ii)) is
// NOT implemented here — no farmworker-status question exists anywhere in
// this intake flow to read from (confirmed via repo-wide grep, 2026-08-09).
// Tracked as a follow-up rather than guessed.
import { determineSUATier, CA_SUA_FFY2026, type SUATier } from "@civica/snap-rules";

export type ExpeditedPath = "path1" | "path2";

export interface ExpeditedGateAnswers {
  employment_status: string | null;
  monthly_gross_income: string | null;
  savings_amount: string | null;
  monthly_rent_or_mortgage: string | null;
  has_heating_costs: "yes" | "no" | null;
  has_electric_or_gas: "yes" | "no" | null;
  has_phone: "yes" | "no" | null;
}

function toNumber(v: string | null): number {
  return v == null ? NaN : parseFloat(v);
}

/**
 * Which of the computable federal expedited-service tests fire for this
 * household. Empty array = neither test fires (may still be Path-3-eligible,
 * which this can't detect).
 *
 * Unanswered income/liquid-resources are treated as satisfying the low-value
 * side of each test — the cost of an extra navigator review is low; the cost
 * of silently skipping a genuinely destitute household is not. Path 2's
 * shelter side (rent + SUA) is the opposite: skipped entirely when either is
 * unanswered, rather than guessing a dollar figure — Path 1 remains
 * available on its own in that case.
 */
export function computeExpeditedPaths(answers: ExpeditedGateAnswers): ExpeditedPath[] {
  const grossIncome = toNumber(answers.monthly_gross_income);
  const liquidResources = toNumber(answers.savings_amount);
  const rent = toNumber(answers.monthly_rent_or_mortgage);
  const liquidUnderLimit = isNaN(liquidResources) || liquidResources <= 100;

  // Path 1 (7 CFR 273.2(i)(1)(i)): unemployed, gross income < $150, liquid <= $100.
  const path1 =
    answers.employment_status === "unemployed" &&
    (isNaN(grossIncome) || grossIncome < 150) &&
    liquidUnderLimit;

  // Path 2 (7 CFR 273.2(i)(1)(iii)): combined gross income + liquid resources
  // under monthly rent + the state utility allowance — independent of
  // employment status. Only evaluated when rent is answered AND the SUA tier
  // is fully determined (determineSUATier returns null on any missing answer).
  const suaTier: SUATier | null = determineSUATier({
    has_heating_costs: answers.has_heating_costs,
    has_electric_or_gas: answers.has_electric_or_gas,
    has_phone: answers.has_phone,
  });
  const suaDollarValue = suaTier ? CA_SUA_FFY2026[suaTier] : null;
  const path2 =
    !isNaN(rent) &&
    suaDollarValue !== null &&
    (isNaN(grossIncome) ? 0 : grossIncome) + (isNaN(liquidResources) ? 0 : liquidResources) <
      rent + suaDollarValue;

  return [...(path1 ? (["path1"] as const) : []), ...(path2 ? (["path2"] as const) : [])];
}
