// Facts shape consumed by the verdict composer. Mirrors v0.6 fixture
// schema (data-ops/sample/civica-test-profiles/v0.6.schema.json) so the
// composer can be driven by the harness directly.
//
// Defined here (not imported from the harness) so packages/snap-rules
// has zero dependency on tools/.

export type SUATier = "HCSUA" | "LUA" | "phone" | "none";

export interface Facts {
  household: Member[];
  income: IncomeLine[];
  shelter: Shelter;
  deductions: Deductions;
  /**
   * Numeric value or sentinel:
   *   - "n/a:categorical_no_asset_test" — pure-cash cat-elig, asset test waived
   *   - "n/a:not_authored" — fixture author didn't pin a value
   */
  assets: number | string;
  cat_elig: string;
  expedited?: boolean;
  sponsor_income?: number | null;
  as_of_date?: string;
}

export interface Member {
  member_id: string;
  age: number;
  role: string;
  disability?: boolean;
  elderly?: boolean;
  student?: string;
  immigration?: string;
  five_yr_bar?: string;
  sponsored?: boolean;
  work_class?: string;
  abawd_months_used?: number;
  disqual?: string[];
  living?: string;
}

export interface IncomeLine {
  member: string;
  type: string;
  amount: number;
  freq?: string;
  anticipation?: string;
  source_status?: string;
}

export interface Shelter {
  rent: number;
  sua_tier: SUATier;
  sua_amount: number;
  internet?: number;
  homeless_deduction?: boolean;
}

export interface Deductions {
  dependent_care?: number;
  medical_unreimbursed?: number;
  child_support_paid?: number;
}

// ─── Aggregation helpers ──────────────────────────────────────────────────

const EARNED_TYPES = new Set<string>([
  "wages",
  "self_employment",
  "farm_se",
  "wages_contract",
]);

/** Income types excluded from SNAP per 7 CFR 273.9(c). */
export function isExcludedIncome(type: string): boolean {
  if (type.startsWith("excluded")) return true;
  if (type.startsWith("americorps_sn_excluded")) return true;
  if (type.startsWith("americorps_vista_excluded")) return true;
  if (type.includes("vendor")) return true;
  return false;
}

export interface IncomeAggregate {
  earned_total: number;
  unearned_total: number;
  gross_total: number;
}

export function aggregateIncome(facts: Facts): IncomeAggregate {
  let earned = 0;
  let unearned = 0;
  for (const line of facts.income) {
    if (isExcludedIncome(line.type)) continue;
    if (EARNED_TYPES.has(line.type)) {
      earned += line.amount;
    } else {
      unearned += line.amount;
    }
  }
  // Federal rule: negative SE income offsets other income.
  if (earned < 0) {
    unearned = Math.max(0, unearned + earned);
    earned = 0;
  }
  // Sponsor income deeming (7 CFR 273.11(j)): if any household member is
  // sponsored AND facts.sponsor_income is set, deem the sponsor's income
  // to the household as unearned. The full amount is added; indigence and
  // other adjustments (273.11(j)(3)) are not yet modeled.
  if (
    typeof facts.sponsor_income === "number" &&
    facts.sponsor_income > 0 &&
    facts.household.some((m) => m.sponsored === true)
  ) {
    unearned += facts.sponsor_income;
  }
  return {
    earned_total: earned,
    unearned_total: unearned,
    gross_total: earned + unearned,
  };
}

export function householdSize(facts: Facts): number {
  return facts.household.length;
}

export function hasElderlyOrDisabled(facts: Facts): boolean {
  return facts.household.some((m) => m.disability === true || m.elderly === true || m.age >= 60);
}

export function countableAssets(facts: Facts): number | null {
  if (typeof facts.assets === "number") return facts.assets;
  // Sentinels: cat-elig path skips the asset test entirely.
  return null;
}
