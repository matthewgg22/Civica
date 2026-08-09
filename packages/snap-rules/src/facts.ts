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
  // VISTA payments are EARNED income per 7 CFR 273.9(b)(1)(iv) for households
  // that were NOT receiving SNAP/PA at the time the member joined VISTA.
  // (For households receiving SNAP/PA at joining, the payment is excluded
  // per 7 CFR 273.9(c)(10)(iii) and the fixture uses the `_excluded` suffix.)
  // Verified verbatim from §273.9(c)(10)(iii):
  //   "New applicants who were not receiving public assistance or SNAPs
  //    at the time they joined VISTA shall have these volunteer payments
  //    included as earned income."
  // Cornell LII fetch 2026-06-03. Audit: docs/findings/2026-06-03-ma-audit-clean.md
  "americorps_vista_counted",
]);

/** Income types excluded from SNAP per 7 CFR 273.9(c).
 *
 * Defensive against missing/undefined type. v0.6 variant patches can add
 * a new income line with only some fields populated (e.g. M23 patches
 * `income.0.amount` against a base with empty income[], leaving `type`
 * unset). Treating unknown-type as "not excluded" (countable) is
 * conservative — the row falls through to the unearned bucket below and
 * the gross test runs on the full amount; no EID is granted.
 */
export function isExcludedIncome(type: string | undefined | null): boolean {
  if (!type) return false;
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

// ─── Immigration-aware aggregation (7 CFR 273.11(c)) ─────────────────────
//
// Per-member immigration eligibility. Mirrors the dispatch documented in
// gates/immigration.ts:
//   citizen / cofa                          → eligible (always)
//   lpr + five_yr_bar "n/a" or "exempt:*"   → eligible (no bar, or
//                                              40-quarter / humanitarian)
//   lpr + numeric five_yr_bar               → ineligible during the bar
//   refugee (pre-OBBBA cutoff 2025-07-04)   → eligible
//   refugee (post-OBBBA cutoff)             → ineligible
//   removed_status:* / undocumented / unk   → ineligible
//
// Lives here (not in gates/immigration.ts) so the benefit-calc and
// income-test helpers below can use it without a circular import. The
// gate evaluator re-exports it.
export function memberImmigrationEligible(m: Member, asOf: Date): boolean {
  const imm = m.immigration ?? "citizen";
  if (imm === "citizen") return true;
  if (imm === "cofa") return true;
  if (imm === "lpr") {
    const bar = m.five_yr_bar ?? "n/a";
    if (bar === "n/a") return true;
    if (bar.startsWith("exempt:")) return true;
    if (/^\d+(\.\d+)?$/.test(bar)) return false;
    return true;
  }
  if (imm === "refugee") {
    // OBBBA P.L. 119-21 §10108 (eff. 2025-07-04 per FNS memo 2025-10-31).
    const obbbaCutoff = new Date(Date.UTC(2025, 6, 4));
    return asOf < obbbaCutoff;
  }
  if (imm.startsWith("removed_status:")) return false;
  if (imm === "undocumented") return false;
  return false;
}

// 7 CFR 273.11(c)(1)(i): for benefit-level + income-test math, the
// household size EXCLUDES immigration-ineligible aliens. They remain
// "household members" structurally (shelter accrues to them, they live
// at the same address) but they are not counted in HH size for:
//   - max allotment lookup (273.10(e))
//   - standard deduction lookup (273.9(d)(1))
//   - FPL gross/net thresholds (273.9(a))
//   - shelter cap (273.9(d)(6)(ii)) / min-benefit floor (273.10(e)(2)(ii)(C))
//
// Use this — NOT `householdSize` — anywhere benefit math reads "size".
export function eligibleHouseholdSize(facts: Facts, asOf: Date): number {
  const n = facts.household.filter((m) => memberImmigrationEligible(m, asOf)).length;
  // Floor of 1: if no eligible member exists, the composer denies at the
  // immigration gate well before any caller reaches here. Returning 0
  // would break maxAllotmentFor / standardDeductionFor lookups; instead,
  // returning 1 keeps the calc functions safe under unit-test misuse.
  return n > 0 ? n : 1;
}

// 7 CFR 273.11(c)(1)(iii) governs how the ineligible alien's income
// flows to the remaining eligible household. Two reads of the
// regulation persist in state practice:
//
//   Read A (count-all): "the State agency must count all of the income
//          of the ineligible alien" — the count-all literalism, also
//          documented in FNS handbook 6004.9. CA's CalFresh handbook
//          §63-503.481 elects this option per 273.11(c)(3)(i)(A).
//   Read B (prorate):   pro-rata-share — only the eligible members'
//          proportional share of the ineligible alien's income counts.
//
// Civica engine picks Read A. It is the conservative-for-applicant
// choice (counts more income, lowers benefit) and matches CA's elected
// option, the only piloted state today. If a state encodes a different
// election later, branch here on `policy.alien_income_treatment`.
//
// Today this is a pass-through to aggregateIncome — every income line
// counts regardless of which member it's tagged to. The wrapper exists
// so the "Read A is intentional" choice lives in one named place, and
// so the wiring (benefit-calc, income-tests) already passes asOf when
// a future Read B branch needs per-member eligibility filtering.
export function aggregateIncomeForCalc(
  facts: Facts,
  _asOf: Date,
): IncomeAggregate {
  return aggregateIncome(facts);
}

export function hasElderlyOrDisabled(facts: Facts): boolean {
  return facts.household.some((m) => m.disability === true || m.elderly === true || m.age >= 60);
}

// 7 CFR 273.8(e)(12): a Federal, State, or local income tax refund
// (including the EITC) is excluded from RESOURCES, not just income, for
// 12 months after receipt. isExcludedIncome() already keeps a
// "excluded_tax_refund"-typed income line out of gross income (#633's
// income-side half); this is the resource-side half.
//
// Facts.assets is a single flat total with no per-source breakdown, so
// there's no field that says "$X of this total is the refund, still
// inside its exclusion window." Rather than add one, this derives the
// excluded amount from the matching income line(s) already present —
// the same dollar figure a household would be reporting as "this landed
// in my account as a refund." APPROXIMATION, not exact: a household that
// already spent part of the refund on something non-liquid would break
// this coupling (their remaining cash assets would be lower than the
// refund amount, and this would over-exclude). Good enough for the
// fixture's "just received it" scenario; a real per-source Facts field
// would be needed for the general case (#633).
function excludedTaxRefundResources(facts: Facts): number {
  return facts.income
    .filter((line) => line.type?.startsWith("excluded_tax_refund"))
    .reduce((sum, line) => sum + line.amount, 0);
}

export function countableAssets(facts: Facts): number | null {
  if (typeof facts.assets !== "number") {
    // Sentinels: cat-elig path skips the asset test entirely.
    return null;
  }
  const excluded = excludedTaxRefundResources(facts);
  return excluded > 0 ? Math.max(0, facts.assets - excluded) : facts.assets;
}
