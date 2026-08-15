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
import { Decimal } from "../decimal";
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
  const fpl = fplMonthly(size, asOf);
  const policy = statePolicyFor(state, asOf);

  // BBCE raises the threshold; non-BBCE uses 130% federal.
  let ratio = GROSS_INCOME_TEST_RATIO;
  if (policy.bbce && policy.bbce_threshold_pct != null) {
    ratio = new Decimal(policy.bbce_threshold_pct).div(100);
  }
  const threshold = fpl.mul(ratio).roundDollar();
  const gross = new Decimal(aggregateIncomeForCalc(facts, asOf).gross_total).roundDollar();
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
): IncomeTestResult {
  // 7 CFR 273.11(c)(1)(i)(B): net-test FPL also uses eligible-only size.
  const size = eligibleHouseholdSize(facts, asOf);
  const fpl = fplMonthly(size, asOf);
  const threshold = fpl.mul(NET_INCOME_TEST_RATIO).roundDollar();
  const actual = netMonthly.roundDollar();
  const passes = actual.lte(threshold);
  return {
    passes,
    threshold: threshold.toNumber(),
    actual: actual.toNumber(),
    reason: passes ? undefined : "net_income_over_100pct_fpl [7 CFR 273.9(a)(2)]",
  };
}

export function grossTestApplies(facts: Facts): boolean {
  // E/D households skip the federal gross test (net-only path).
  return !hasElderlyOrDisabled(facts);
}
