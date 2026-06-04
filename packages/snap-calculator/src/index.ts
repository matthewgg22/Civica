// SNAP net income and benefit estimation — FACADE over @civica/snap-rules.
//
// Public API is stable: every existing caller keeps its imports unchanged.
// The math is delegated to @civica/snap-rules' computeBenefit (FY26 tables,
// 129/0 profile-harness pass rate, PolicyEngine US triangulation at 73%
// within ±$10/mo, GPO-cited 7 CFR primary sources).
//
// Why facade vs delete: minimizes diff to the 6+ caller sites (argyle-webhook,
// /tools/deductions, snap-verification-prototype, snap-qc-engine flows) while
// silently switching the math to the audited engine. See:
// - docs/plans/engine-dashboard-integration.md (Decision D2)
// - docs/findings/2026-06-03-v06-fixture-defects-primary-citations.md
// - PR #450 (fixture defects + engine docs), PR #456 (PolicyEngine triangulation)
//
// Behavior change vs FY25 originals:
//   - Constants now come from @civica/snap-rules' federal-tables snapshot
//     system (currently FY26). The hardcoded MAX_ALLOTMENT, STANDARD_DEDUCTION,
//     SHELTER_DEDUCTION_CAP, NET_INCOME_LIMIT, GROSS_INCOME_LIMIT, and
//     SUA_AMOUNTS tables are sourced live from getEngineParams() instead of
//     the FY25 numerics that used to live inline.
//   - The caller's `monthlySuaAmount` is mapped to a tier (`HCSUA` if > 0,
//     `none` if 0). The engine then reads its own per-state SUA value for
//     that tier. The caller's exact dollar amount is informational only —
//     the engine's authored SUA wins.
//   - Helpers like grossIncomeLimitMonthly() return FY-current values
//     (current Date()), not the hardcoded FY25 constants.

import { computeBenefit, getEngineParams, type Facts } from "@civica/snap-rules";
import type { StateCode, SnapCalculatorInput, SnapDeductionBreakdown } from "./types";

export type {
  StateCode,
  SuaTier,
  Confidence,
  VerificationFlow,
  SnapCalculatorInput,
  SnapDeductionBreakdown,
  UtilityIntake,
} from "./types";
export { STATE_SUA_RULES, determineSuaTier } from "./sua-rules";
export type { StateSuaRule } from "./sua-rules";
export { STATE_ASSET_RULES, SHELTER_CITATIONS, INCOME_CITATIONS } from "./asset-rules";
export type { StateAssetRule } from "./asset-rules";

// ── Federal limit helpers ────────────────────────────────────────────────
// Read FY-current FPL values from snap-rules at call time. getEngineParams
// returns monthly 100%-FPL per HH size 1..8. For HH>8 we extrapolate using
// the size-8 → size-7 delta (which equals fpl_annual_each_additional / 12
// by construction in snap-rules).
//
// Old API committed to a `size: number` signature (no `asOf` parameter), so
// every call evaluates against `new Date()`. Callers who need a historical
// vintage should use @civica/snap-rules' getEngineParams(state, asOf) directly.

function fplMonthlyForSize(size: number): number {
  const params = getEngineParams("CA", new Date());
  const fpl = params.fpl ?? {};
  if (size <= 8) {
    return fpl[String(Math.max(1, size))] ?? 0;
  }
  const fpl7 = fpl["7"] ?? 0;
  const fpl8 = fpl["8"] ?? 0;
  const each = fpl8 - fpl7; // ≈ fpl_annual_each_additional / 12, rounded
  return fpl8 + each * (size - 8);
}

export function grossIncomeLimitMonthly(size: number): number {
  // Federal: gross-income test at 130% of FPL (7 CFR 273.9(a)(1)).
  return Math.round(fplMonthlyForSize(size) * 1.3);
}

export function netIncomeLimitMonthly(size: number): number {
  // Federal: net-income test at 100% of FPL (7 CFR 273.9(a)(2)).
  return fplMonthlyForSize(size);
}

export function bbceIncomeLimitMonthly(size: number): number {
  // CA-specific (this helper's existing semantic): CA BBCE at 200% FPL per
  // CDSS ACIN I-46-25. Other BBCE states (TX 165%, KS 130%, etc.) need their
  // own helpers — out of scope for this facade.
  return fplMonthlyForSize(size) * 2;
}

export function isCaBbceEligible(grossIncome: number, householdSize: number): boolean {
  return grossIncome <= bbceIncomeLimitMonthly(householdSize);
}

// ── SUA amounts (FY-current, per state policy) ───────────────────────────
// snap-rules' per-state SUA values live in StatePolicy.sua_by_tier under
// keys HCSUA / LUA / phone / none. We expose them under the snap-calculator
// `full | limited | telephone` names this package's existing API used.

function suaForState(state: StateCode): { full: number; limited: number; telephone: number } {
  const params = getEngineParams(state, new Date());
  const sua = params.sua ?? {};
  return {
    full: sua["HCSUA"] ?? 0,
    limited: sua["LUA"] ?? 0,
    telephone: sua["phone"] ?? 0,
  };
}

export const SUA_AMOUNTS: Record<StateCode, { full: number; limited: number; telephone: number }> = {
  get CA() {
    return suaForState("CA");
  },
  get MA() {
    return suaForState("MA");
  },
} as Record<StateCode, { full: number; limited: number; telephone: number }>;

// ── calculateSnapBenefit — the facade ────────────────────────────────────

function inputToFacts(input: SnapCalculatorInput): Facts {
  const { householdSize, elderlyOrDisabled } = input;
  const household = Array.from({ length: Math.max(1, householdSize) }, (_, i) => ({
    member_id: `m${i + 1}`,
    age: i === 0 && elderlyOrDisabled ? 65 : 30,
    role: i === 0 ? "head" : "other",
    disability: i === 0 ? elderlyOrDisabled : false,
    elderly: i === 0 ? elderlyOrDisabled : false,
    student: "not",
    immigration: "citizen",
    five_yr_bar: "n/a",
    sponsored: false,
    work_class: "gen_work_subject",
    abawd_months_used: 0,
    disqual: [] as string[],
    living: "housed",
  }));

  const income: Facts["income"] = [];
  if (input.grossMonthlyEarnedIncome > 0) {
    income.push({
      member: "m1",
      type: "wages",
      amount: input.grossMonthlyEarnedIncome,
      freq: "monthly",
      anticipation: "averaged",
      source_status: "ongoing",
    });
  }
  if (input.grossMonthlyUnearnedIncome > 0) {
    income.push({
      member: "m1",
      type: "unearned_rsdi",
      amount: input.grossMonthlyUnearnedIncome,
      freq: "monthly",
      anticipation: "averaged",
      source_status: "ongoing",
    });
  }

  // Caller's monthlySuaAmount → tier. Engine then uses its own per-state
  // SUA value for that tier. Caller's exact $ is informational; the audited
  // engine's authored value wins.
  const sua_tier = (input.monthlySuaAmount > 0 ? "HCSUA" : "none") as Facts["shelter"]["sua_tier"];

  return {
    household,
    income,
    shelter: {
      rent: input.monthlySheltCost,
      sua_tier,
      sua_amount: input.monthlySuaAmount,
      internet: 0,
      homeless_deduction: false,
    },
    deductions: {
      dependent_care: input.monthlyDependentCareCost,
      medical_unreimbursed: 0,
      child_support_paid: 0,
    },
    assets: "n/a:not_authored",
    cat_elig: "NPA",
    expedited: false,
    sponsor_income: null,
  };
}

export function calculateSnapBenefit(input: SnapCalculatorInput): SnapDeductionBreakdown {
  const facts = inputToFacts(input);
  const asOf = new Date();
  const detail = computeBenefit(facts, input.stateCode, asOf);

  // computeBenefit gives us the benefit-side math (deductions, net income,
  // benefit amount). The eligibility-test fields (gross/net pass + BBCE
  // conferral + eligible) live above that layer — recompute here from the
  // FY-current limits so the breakdown shape stays stable.
  const gross_income = input.grossMonthlyEarnedIncome + input.grossMonthlyUnearnedIncome;
  const gross_income_limit = grossIncomeLimitMonthly(input.householdSize);
  const net_income_limit = netIncomeLimitMonthly(input.householdSize);
  const bbce_eligible =
    input.stateCode === "CA" && isCaBbceEligible(gross_income, input.householdSize);
  // E/D households are exempt from the gross-income test per 7 CFR 273.9(a)(1).
  // CA BBCE-conferred households also bypass the gross test.
  const gross_income_test_waived = bbce_eligible || input.elderlyOrDisabled;
  const gross_income_test_pass = gross_income_test_waived || gross_income <= gross_income_limit;
  const net_income_test_pass = detail.net_monthly_income <= net_income_limit;
  const eligible = gross_income_test_pass && net_income_test_pass;

  // Recreate the breakdown shape this package committed to, using the
  // ENGINE's per-state SUA value (not the caller's monthlySuaAmount) so
  // synthesized display fields are internally consistent with the math the
  // engine actually ran. The caller's monthlySuaAmount only determined the
  // tier; the engine's authored value wins from there.
  const engine_sua_for_tier =
    facts.shelter.sua_tier === "none" ? 0 : (detail.trace.state_sua_value ?? 0);
  const shelter_cost_total = input.monthlySheltCost + engine_sua_for_tier;
  const adjusted_net_before_shelter = Math.max(
    0,
    gross_income -
      detail.earned_income_deduction -
      detail.standard_deduction -
      detail.dependent_care_deduction,
  );
  // No intermediate round here — the engine carries Decimal precision through
  // the excess-shelter math and only rounds at shelter_deduction_applied.
  // Pre-rounding half_adjusted_net would drop 0.5 dollars on cases where
  // the adjusted-net is odd, producing a $1 drift versus the engine's value.
  const half_adjusted_net = adjusted_net_before_shelter * 0.5;
  const excess_shelter = Math.max(0, Math.round(shelter_cost_total - half_adjusted_net));
  const max_allotment = detail.max_allotment_for_household_size;
  const benefit_capped = detail.monthly_benefit > 0 && detail.monthly_benefit === max_allotment;

  return {
    gross_income,
    gross_income_limit,
    gross_income_test_pass,
    gross_income_test_waived,
    bbce_eligible,
    net_income_limit,
    earned_income_deduction: detail.earned_income_deduction,
    standard_deduction: detail.standard_deduction,
    dependent_care_deduction: detail.dependent_care_deduction,
    adjusted_net_before_shelter,
    shelter_cost_total,
    half_adjusted_net,
    excess_shelter,
    shelter_deduction_applied: detail.excess_shelter_deduction,
    net_income: detail.net_monthly_income,
    net_income_test_pass,
    eligible,
    max_allotment,
    thirty_pct_net: detail.thirty_percent_of_net,
    estimated_benefit: eligible ? detail.monthly_benefit : 0,
    benefit_capped,
  };
}
