// Verdict composer — orchestrator that walks the regulatory gates in the
// order specified by Python `FederalSNAPRules.determine_eligibility`:
//
//   1. Categorical eligibility check (pure_cash skips gates 3, 5)
//   2. Student gate                                          [7 CFR 273.5]
//   3. Gross income test (skipped for E/D and cat-elig)      [7 CFR 273.9(a)(1)]
//   4. Net income test (after deduction stack)               [7 CFR 273.9(a)(2)]
//   5. Asset test (waived for BBCE / asset_waiver / cat-elig) [7 CFR 273.8]
//   6. Benefit calc                                          [7 CFR 273.10]
//
// Gates not yet implemented (return not_implemented_surfaces):
//   - Citizenship / immigration                  Wave 2
//   - HH-level disqualifications (IPV, lottery)  Wave 2
//   - ABAWD work req                             Wave 2 (evaluateWorkRequirement exists; not wired)
//   - Self-employment income method              Wave 2
//   - Mixed-status proration                     Wave 2
//   - Sponsor deeming                            Wave 2

import type { Facts } from "./facts.ts";
import { hasElderlyOrDisabled, householdSize } from "./facts.ts";
import { evaluateCategorical } from "./gates/categorical.ts";
import { evaluateStudentGate } from "./gates/student.ts";
import {
  grossIncomeTest,
  netIncomeTest,
  grossTestApplies,
} from "./gates/income-tests.ts";
import { assetTest } from "./gates/asset-test.ts";
import { computeBenefit } from "./benefit-calc.ts";
import { Decimal } from "./decimal.ts";
import { statePolicyFor, UnknownStateError } from "./constants/states.ts";

export type Verdict = "APPROVE" | "DENY";

export interface VerdictResult {
  verdict?: Verdict;
  benefit?: number | null;
  reason?: string;
  not_implemented_surfaces?: string[];
  trace?: Record<string, unknown>;
}

/**
 * The harness-facing entry point. Takes (facts, state, asOf) and returns
 * either a (verdict, benefit, reason) or a SKIP-style result with
 * `not_implemented_surfaces` populated.
 *
 * Never throws — every "I can't grade this" path returns a structured
 * result so the harness can classify as SKIP.
 */
export function composeVerdict(facts: Facts, state: string, asOf: Date): VerdictResult {
  // ── State policy ─────────────────────────────────────────────────────
  let policy;
  try {
    policy = statePolicyFor(state);
  } catch (err) {
    if (err instanceof UnknownStateError) {
      return {
        not_implemented_surfaces: ["state-policy-not-loaded"],
        reason: err.message,
      };
    }
    throw err;
  }

  // Wave B can't compute benefits without authored SUA.
  // If profile uses non-"none" SUA tier and state SUA isn't authored,
  // SKIP rather than fabricate.
  if (
    facts.shelter.sua_tier !== "none" &&
    !facts.shelter.homeless_deduction &&
    !policy.sua_by_tier
  ) {
    return {
      not_implemented_surfaces: [`shelter.sua.${facts.shelter.sua_tier}`],
      reason: `SUA values not authored for state ${state}`,
    };
  }

  const trace: Record<string, unknown> = {};

  // ── Categorical eligibility ──────────────────────────────────────────
  const cat = evaluateCategorical(facts);
  trace.categorical = cat;

  // ── Student gate ────────────────────────────────────────────────────
  const stu = evaluateStudentGate(facts);
  trace.student = stu;
  if (!stu.passes) {
    return { verdict: "DENY", benefit: null, reason: stu.reason, trace };
  }

  // ── Gross income test (federal default; BBCE raises threshold) ──────
  // BBCE-conferred households bypass BOTH gross and net income tests
  // per FNS policy. Track conferral so the net test below knows.
  let bbceConferred = false;
  if (!cat.skip_gross_test && grossTestApplies(facts)) {
    const gross = grossIncomeTest(facts, state, asOf);
    trace.gross_income_test = gross;
    if (!gross.passes) {
      return {
        verdict: "DENY",
        benefit: null,
        reason: gross.reason,
        trace,
      };
    }
    // If state is BBCE and the household passed the (raised) threshold,
    // they are BBCE-conferred and are not subject to gross OR net tests.
    if (policy.bbce) bbceConferred = true;
  }

  // ── Asset test ───────────────────────────────────────────────────────
  const asset = assetTest(facts, state, asOf);
  trace.asset_test = asset;
  if (!cat.skip_asset_test && !asset.passes) {
    return { verdict: "DENY", benefit: null, reason: asset.reason, trace };
  }

  // ── Compute benefit (needs net income, then net test) ────────────────
  const detail = computeBenefit(facts, state, asOf);
  trace.benefit_calc = detail;

  // Net income test — skipped for cat-elig path AND BBCE-conferred HHs.
  // Federal floor applies only to non-cat-elig, non-BBCE households.
  if (!cat.skip_gross_test && !bbceConferred) {
    const net = netIncomeTest(facts, new Decimal(detail.net_monthly_income), asOf);
    trace.net_income_test = net;
    if (!net.passes) {
      return { verdict: "DENY", benefit: null, reason: net.reason, trace };
    }
  }

  // ── APPROVE: emit benefit ────────────────────────────────────────────
  return {
    verdict: "APPROVE",
    benefit: detail.monthly_benefit,
    reason: cat.path === "pure_cash"
      ? `approved via ${cat.path} categorical path`
      : `approved (size=${householdSize(facts)}, E/D=${hasElderlyOrDisabled(facts)})`,
    trace,
  };
}
