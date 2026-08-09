// Expedited-review gate decision logic (OBBBA §10102(a) / 7 CFR 273.2(i)).
// Extracted from page.tsx (#557) so it's unit-testable without rendering the
// whole packet detail page — this was previously ~15 lines of inline
// business logic with zero test coverage.
import { determineSUATier, CA_SUA_FFY2026, type SUATier } from "@civica/snap-rules";

export type ExpeditedPath = "path1" | "path2" | "path3";

export interface ExpeditedGateAnswers {
  employment_status: string | null;
  monthly_gross_income: string | null;
  savings_amount: string | null;
  monthly_rent_or_mortgage: string | null;
  has_heating_costs: "yes" | "no" | null;
  has_electric_or_gas: "yes" | "no" | null;
  has_phone: "yes" | "no" | null;
  // #652: household_migrant_farmworker in draft-to-answers.ts.
  is_migrant_or_seasonal_farmworker: "yes" | "no" | "not_sure" | null;
}

function toNumber(v: string | null): number {
  return v == null ? NaN : parseFloat(v);
}

/**
 * Which of the computable federal expedited-service tests fire for this
 * household.
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

  // Path 3 (7 CFR 273.2(i)(1)(ii)): destitute migrant/seasonal farmworker —
  // liquid <= $100 AND (all income sources terminated, OR a new source with
  // <= $25 has arrived within the last 10 days). #652 wires the farmworker
  // question through, but the income-side test here is a DELIBERATE
  // APPROXIMATION, not the real federal test: this intake flow has no
  // concept of a per-source is_ongoing/termination flag at all (unlike
  // packages/snap-rules's IncomeFacts.forward_gross_monthly_total, #556) and
  // no "new source arrived within 10 days" tracking either — there is
  // exactly one aggregate monthly_gross_income figure to work with. Treating
  // "no income reported" (unanswered or $0) as a stand-in for "terminated"
  // is the closest available proxy, not a distinction the intake can
  // actually draw (a household with genuinely $0 ongoing income and one
  // that's simply never reported income look identical here). Flagged for
  // navigator review either way, which is the acceptable failure mode for a
  // gate that only ever recommends a human look, never denies on its own.
  const noIncomeReported = isNaN(grossIncome) || grossIncome === 0;
  const path3 =
    answers.is_migrant_or_seasonal_farmworker === "yes" &&
    liquidUnderLimit &&
    noIncomeReported;

  return [
    ...(path1 ? (["path1"] as const) : []),
    ...(path2 ? (["path2"] as const) : []),
    ...(path3 ? (["path3"] as const) : []),
  ];
}
