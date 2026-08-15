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
//   - Self-employment income method              Wave 2
//
// Citizenship / immigration, HH-level disqualifications (IPV, lottery,
// fleeing felon, drug felony), ABAWD work req, and sponsor deeming are
// all wired below. Mixed-status "proration" is intentionally a no-op:
// the engine counts the ineligible alien's income in full (CA's elected
// option under 7 CFR 273.11(c)(3)(i)) and keeps HH size at the full
// `facts.household.length`. See gates/immigration.ts comment block for
// the citation chain.

import type { Facts } from "./facts";
import { eligibleHouseholdSize, hasElderlyOrDisabled } from "./facts";
import { validateFacts } from "./facts-schema";
import { evaluateCategorical } from "./gates/categorical";
import { evaluateStudentGate } from "./gates/student";
import { evaluateAbawd } from "./gates/abawd";
import { evaluateImmigration, anySponsored } from "./gates/immigration";
import { evaluateDisqualifications } from "./gates/disqualifications";
import { evaluateComposition } from "./gates/composition";
import {
  grossIncomeTest,
  netIncomeTest,
  grossTestApplies,
} from "./gates/income-tests";
import { assetTest } from "./gates/asset-test";
import { computeBenefit } from "./benefit-calc";
import { Decimal } from "./decimal";
import { statePolicyFor, UnknownStateError, NoStatePolicyForDateError } from "./constants/states";

export type Verdict = "APPROVE" | "DENY";

export interface VerdictResult {
  verdict?: Verdict;
  benefit?: number | null;
  // `reason` is `string | undefined` (not just `string?`) so gate
  // results that bubble up an optional reason — e.g. `gate.reason` typed
  // as `string | undefined` — type-check cleanly under
  // tsconfig.json's `exactOptionalPropertyTypes: true`.
  reason?: string | undefined;
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
  // ── Input contract (Zod) ─────────────────────────────────────────────
  // Reject malformed Facts at the door so the engine never sees a shape
  // it didn't agree to accept. The 2026-06-02 audit showed throws inside
  // the composer were being silently classified as SKIPs by the harness;
  // returning a structured `__invalid-input-shape__` keeps the harness
  // classifier honest while also rejecting bad submissions at API
  // boundaries.
  const errs = validateFacts(facts);
  if (errs !== null) {
    return {
      not_implemented_surfaces: ["__invalid-input-shape__"],
      reason: `Facts failed schema validation: ${errs.slice(0, 5).join("; ")}${errs.length > 5 ? ` (+${errs.length - 5} more)` : ""}`,
    };
  }

  // ── State policy ─────────────────────────────────────────────────────
  let policy;
  try {
    policy = statePolicyFor(state, asOf);
  } catch (err) {
    if (err instanceof UnknownStateError) {
      return {
        not_implemented_surfaces: ["state-policy-not-loaded"],
        reason: err.message,
      };
    }
    // Issue #806: same graceful SKIP as UnknownStateError above — a date
    // this engine has no snapshot for is "I can't grade this," not a bug
    // to throw on. Should not occur today (every state's placeholder range
    // is 2020-2099) but will become reachable once a state gains a second,
    // narrower-dated entry.
    if (err instanceof NoStatePolicyForDateError) {
      return {
        not_implemented_surfaces: ["state-policy-not-loaded-for-date"],
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

  // ── Immigration eligibility (per Python source `_citizenship_test`) ──
  // First gate in regulatory order: if no member is in an eligible
  // citizenship/immigration category, HH is denied immediately.
  const imm = evaluateImmigration(facts, asOf);
  trace.immigration = imm;
  if (!imm.passes) {
    return { verdict: "DENY", benefit: null, reason: imm.reason, trace };
  }

  // ── HH-level disqualifications (lottery / IPV / fleeing felon / drug) ─
  // Per 7 CFR 272.17, 273.16, 273.11(m,n). State-option drug-felony ban
  // is honored via policy.drug_felony_ban (a 3-state classification since
  // #805: "none" | "modified" | "full" | "unconfirmed" — only "full" gates).
  const disq = evaluateDisqualifications(facts, state, asOf);
  trace.disqualifications = disq;
  if (!disq.passes) {
    return { verdict: "DENY", benefit: null, reason: disq.reason, trace };
  }

  // ── Household composition (7 CFR 273.1) ──────────────────────────────
  // Variant-driven: mandatory under-22 combination, coresident-income
  // deeming for elderly separate HH, boarder vs roomer split.
  const comp = evaluateComposition(facts);
  trace.composition = comp;
  if (!comp.passes) {
    return { verdict: "DENY", benefit: null, reason: comp.reason, trace };
  }

  // ── Categorical eligibility ──────────────────────────────────────────
  const cat = evaluateCategorical(facts);
  trace.categorical = cat;

  // ── Student gate ────────────────────────────────────────────────────
  const stu = evaluateStudentGate(facts);
  trace.student = stu;
  if (!stu.passes) {
    return { verdict: "DENY", benefit: null, reason: stu.reason, trace };
  }

  // ── ABAWD work requirement (7 CFR 273.24, as amended by OBBBA §10102) ─
  const abawd = evaluateAbawd(facts, asOf, state);
  trace.abawd = abawd;
  if (!abawd.passes) {
    return { verdict: "DENY", benefit: null, reason: abawd.reason, trace };
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
    const net = netIncomeTest(facts, new Decimal(detail.net_monthly_income), asOf, state);
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
      : `approved (size=${eligibleHouseholdSize(facts, asOf)}, E/D=${hasElderlyOrDisabled(facts)})`,
    trace,
  };
}
