// Gross + net income tests (7 CFR 273.9(a)).
//
// Gross test:
//   - Default: gross > 130% FPL => DENY (federal)
//   - BBCE states: threshold raised to state.bbce_threshold_pct (e.g. 200%)
//   - E/D households: gross test SKIPPED (use net only)
//   - Cat-elig (pure_cash) households: gross test SKIPPED
//
// Net test:
//   - Computed after the deduction stack (see benefit-calc.ts)
//   - net > 100% FPL => DENY (federal floor for all non-cat-elig HHs)

import type { Facts } from "../facts";
import {
  aggregateIncomeForCalc,
  eligibleHouseholdSize,
  hasElderlyOrDisabled,
} from "../facts";
import { Decimal, ZERO, dec } from "../decimal";
import {
  fplMonthly,
  GROSS_INCOME_TEST_RATIO,
  NET_INCOME_TEST_RATIO,
} from "../constants/federal-tables";
import { statePolicyFor } from "../constants/states";

export interface IncomeTestResult {
  passes: boolean;
  threshold: number;
  actual: number;
  // Under `exactOptionalPropertyTypes: true`, plain `?:` excludes explicit
  // `undefined` values. `| undefined` lets gates assign a value computed
  // from a possibly-undefined source without each call site having to
  // narrow first.
  reason?: string | undefined;
}

export function grossIncomeTest(facts: Facts, state: string, asOf: Date): IncomeTestResult {
  // 7 CFR 273.11(c)(1)(i)(B): FPL income-eligibility comparison uses
  // ELIGIBLE-only HH size; ineligible-alien income counts in full
  // (Read A — see facts.aggregateIncomeForCalc).
  const size = eligibleHouseholdSize(facts, asOf);
  const fpl = fplMonthly(size, asOf, state);
  const policy = statePolicyFor(state, asOf);

  // BBCE raises the threshold; non-BBCE uses 130% federal.
  let ratio = GROSS_INCOME_TEST_RATIO;
  if (policy.bbce && policy.bbce_threshold_pct != null) {
    ratio = new Decimal(policy.bbce_threshold_pct).div(100);
  }
  const threshold = fpl.mul(ratio).roundDollar();

  let grossForTest = new Decimal(aggregateIncomeForCalc(facts, asOf).gross_total);
  // #824: NJ/VA/IL/MO exclude legally-obligated child support PAID from
  // gross income under the 7 CFR 273.9(c) exclusion mechanism — subtracted
  // before ANY income test, not just the 7 CFR 273.9(d)(5) ordinary
  // deduction (applied only at net, after the gross test already ran)
  // every other state's entry in this file uses. `benefit-calc.ts` is
  // deliberately untouched by this: `child_support_paid` still flows
  // through its existing `otherDeductions` path unchanged, so net income
  // for a household that already clears THIS (possibly lowered) gross gate
  // is algebraically identical to before — this flag changes ONLY whether
  // a near-the-gross-line, child-support-paying household reaches the net/
  // benefit computation at all, never the benefit dollar figure once
  // through. See `StatePolicy.child_support_gross_exclusion`'s own
  // doc-comment in constants/states.ts for the full reasoning.
  if (policy.child_support_gross_exclusion) {
    const cs = dec(facts.deductions.child_support_paid ?? 0);
    grossForTest = grossForTest.sub(cs);
    if (grossForTest.lt(ZERO)) grossForTest = ZERO;
  }
  const gross = grossForTest.roundDollar();

  const passes = gross.lte(threshold);
  return {
    passes,
    threshold: threshold.toNumber(),
    actual: gross.toNumber(),
    reason: passes
      ? undefined
      : `gross_income_over_${policy.bbce ? policy.bbce_threshold_pct + "pct" : "130pct"}_fpl [7 CFR 273.9(a)(1)]`,
  };
}

export function netIncomeTest(
  facts: Facts,
  netMonthly: Decimal,
  asOf: Date,
  state: string,
  // #830: most BBCE/ECE states waive the net test entirely once the
  // (possibly raised) gross screen clears — verdict.ts never calls this
  // function for those households at all. A minority (TN/CT/KY confirmed)
  // keep a net-income ceiling on top of their BBCE gross screen instead;
  // for those, verdict.ts DOES call this function even for a BBCE-conferred
  // household and passes `policy.bbce_net_ceiling_pct` converted to a
  // ratio here. `undefined` (every other call site) preserves today's
  // federal-floor ratio exactly.
  ratioOverride?: Decimal,
): IncomeTestResult {
  // 7 CFR 273.11(c)(1)(i)(B): net-test FPL also uses eligible-only size.
  const size = eligibleHouseholdSize(facts, asOf);
  const fpl = fplMonthly(size, asOf, state);
  const ratio = ratioOverride ?? NET_INCOME_TEST_RATIO;
  const threshold = fpl.mul(ratio).roundDollar();
  const actual = netMonthly.roundDollar();
  const passes = actual.lte(threshold);
  return {
    passes,
    threshold: threshold.toNumber(),
    actual: actual.toNumber(),
    reason: passes
      ? undefined
      : `net_income_over_${ratio.mul(100).toNumber()}pct_fpl [7 CFR 273.9(a)(2)]`,
  };
}

export function grossTestApplies(facts: Facts): boolean {
  // E/D households skip the federal gross test (net-only path).
  return !hasElderlyOrDisabled(facts);
}
