// Presentation layer for the three engines shown on each candidate in the CBO
// pipeline dropdown. Pure transforms over real engine output (no engine edits) —
// the eligibility "steps", the benefit deduction trace, and Component R recs.
//
// Honesty note: the packet→Facts adapter deliberately does NOT expose an
// eligibility VERDICT (it would rest on assumed citizenship/age/assets). So the
// Eligibility view shows the gates the engine evaluates IN ORDER + what's still
// needed to reach a determination — the "explained steps", not a fabricated
// approve/deny.

import type { BenefitCalcDetail } from "@civica/snap-rules";

/** The regulatory gates the verdict composer walks, in order, with citations.
 *  Mirrors packages/snap-rules/src/verdict.ts. Static — the engine's framework. */
export const EVALUATION_GATES: { label: string; citation: string }[] = [
  { label: "Household composition", citation: "7 CFR 273.1" },
  { label: "Non-citizen eligibility", citation: "7 CFR 273.4" },
  { label: "Student eligibility", citation: "7 CFR 273.5" },
  { label: "Work requirement / ABAWD", citation: "7 CFR 273.24" },
  { label: "Gross income test (130% FPL)", citation: "7 CFR 273.9(a)(1)" },
  { label: "Asset / resource test", citation: "7 CFR 273.8" },
  { label: "Net income test (100% FPL)", citation: "7 CFR 273.9(a)(2)" },
  { label: "Benefit calculation", citation: "7 CFR 273.10" },
];

export interface DeductionRow {
  label: string;
  /** Signed monthly dollars: deductions negative, totals positive. */
  amount: number;
  citation?: string;
  /** Render as a subtotal/total line (bold rule) vs a deduction line. */
  total?: boolean;
}

/** Flatten BenefitCalcDetail into the ordered rows of the benefit math. */
export function deductionRows(d: BenefitCalcDetail): DeductionRow[] {
  const rows: DeductionRow[] = [
    { label: "Gross monthly income", amount: d.gross_monthly_income, total: true },
    { label: "Earned-income deduction (20%)", amount: -d.earned_income_deduction, citation: "7 CFR 273.9(d)(2)" },
    { label: "Standard deduction", amount: -d.standard_deduction, citation: "7 CFR 273.9(d)(1)" },
  ];
  if (d.dependent_care_deduction) rows.push({ label: "Dependent-care deduction", amount: -d.dependent_care_deduction, citation: "7 CFR 273.9(d)(4)" });
  if (d.medical_deduction) rows.push({ label: "Medical deduction (elderly/disabled)", amount: -d.medical_deduction, citation: "7 CFR 273.9(d)(3)" });
  if (d.child_support_deduction) rows.push({ label: "Child-support paid", amount: -d.child_support_deduction, citation: "7 CFR 273.9(d)(5)" });
  if (d.excess_shelter_deduction) rows.push({ label: "Excess shelter deduction", amount: -d.excess_shelter_deduction, citation: "7 CFR 273.9(d)(6)" });
  rows.push(
    { label: "Net monthly income", amount: d.net_monthly_income, total: true },
    { label: "30% of net income", amount: -d.thirty_percent_of_net },
    { label: "Max allotment (household size)", amount: d.max_allotment_for_household_size },
    { label: "Monthly benefit", amount: d.monthly_benefit, total: true, citation: "7 CFR 273.10(e)(2)(ii)(A)" },
  );
  return rows;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

/** One-line summary of the benefit math, for the collapsed Amount block. */
export function deductionOneLine(d: BenefitCalcDetail): string {
  const totalDed = Math.max(0, d.gross_monthly_income - d.net_monthly_income);
  return `${usd(d.gross_monthly_income)} gross − ${usd(totalDed)} deductions → ${usd(d.net_monthly_income)} net; ${usd(d.max_allotment_for_household_size)} max allotment − 30% of net (${usd(d.thirty_percent_of_net)}) = ${usd(d.monthly_benefit)}/mo`;
}

/** A Component R recommendation, flattened for the UI. */
export interface EngineRecommendation {
  rank: number;
  action: string;
  /** Estimated monthly $ impact of resolving it (may be 0). */
  deltaUsd: number;
  citation: string | null;
}
