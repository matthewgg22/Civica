// Income-eligibility GUIDE figures for the public "What is SNAP" page.
//
// Presentation-only. These mirror the federal constants in
// packages/snap-rules/src/constants/federal-tables.ts (FY26 snapshot: HHS
// 2025 Poverty Guidelines + FNS FY26 COLA, 48 contiguous states + DC). They
// are kept as a small local copy so the public marketing surface has no
// build-time dependency on the determination engine package.
//
// ⚠️  SYNC: FNS/HHS publish new figures every October. When they do, update
//     BOTH this file and federal-tables.ts. Tracked by a GitHub issue so the
//     annual refresh isn't forgotten. Do NOT let these drift silently.
//
// Why ~200% FPL: the figure shown is roughly 200% of the Federal Poverty
// Level, monthly — the gross-income level that many broad-based categorical
// eligibility (BBCE) states, including California, use. It is deliberately
// the *higher, more inclusive* end. The page frames it as "a guide, not a
// cutoff," because telling an eligible household they earn too much is the
// costliest error: they walk away and stay hungry. States that use a lower
// limit are covered by the page's "your state sets the real limit, and
// deductions can raise it" framing.

// HHS 2025 Poverty Guidelines, 48 contiguous states + DC (FY26 snapshot).
const FPL_ANNUAL_FIRST = 15660;
const FPL_ANNUAL_EACH_ADDITIONAL = 5500;

// ~200% FPL — the common BBCE gross-income level (e.g. California).
const GUIDE_FPL_MULTIPLIER = 2.0;

// FNS FY26 max monthly allotment (48 contiguous + DC). Federal, not
// state-set: the most a household with ~zero net income can receive.
export const MAX_BENEFIT_ONE_PERSON = 298;
export const MAX_BENEFIT_FAMILY_OF_FOUR = 994;

// Floor the monthly FPL before applying the multiplier — matches the engine's
// FNS / CalFresh rounding convention (federal-tables.ts `fplMonthly()`), then
// round the guide figure to the nearest $10 so it reads as an approximation.
function guideMonthlyIncome(householdSize: number): number {
  const annual =
    FPL_ANNUAL_FIRST + FPL_ANNUAL_EACH_ADDITIONAL * (householdSize - 1);
  const monthlyFpl = Math.floor(annual / 12);
  return Math.round((monthlyFpl * GUIDE_FPL_MULTIPLIER) / 10) * 10;
}

export interface IncomeGuideRow {
  /** Number of people in the food household. */
  size: number;
  /** Approximate gross monthly income, ~200% FPL, rounded to $10. */
  monthly: number;
}

/** Income guide rows for household sizes 1…maxSize (default 8). */
export function incomeGuide(maxSize = 8): IncomeGuideRow[] {
  return Array.from({ length: maxSize }, (_, i) => ({
    size: i + 1,
    monthly: guideMonthlyIncome(i + 1),
  }));
}

/** "$5,360" — US currency, no cents, for guide display. */
export function formatGuideUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}
