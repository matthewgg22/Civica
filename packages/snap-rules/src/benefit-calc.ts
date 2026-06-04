// Benefit calculation — port of backend/civic_api/snap/rules/federal.py
// `_compute_net_income` (Python source-of-truth) and the Swift twin
// `SNAPBenefitCalculator.calculate` in Civica/Features/SNAP/Rules/.
//
// The independence rule: this implementation reads FY26 constants from
// `constants/federal-tables.ts` (FNS COLA August 2025, HHS Jan 2025).
// The oracle fixture's `meta.params` is NOT consulted — both engine and
// oracle independently read from FNS publications.
//
// Math summary (the entire benefit calc, per 7 CFR 273.10):
//   EID        = 0.20 * earned                                  [273.9(d)(2)]
//   SD         = standardDeductionFor(size, asOf)               [273.9(d)(1)]
//   medical    = max(0, medical_unreimbursed - $35) if E/D      [273.9(d)(3)]
//   other_ded  = dependent_care + medical + child_support_paid  [273.9(d)(4),(5)]
//   adj_income = max(0, gross - EID - SD - other_ded)
//   if homeless_deduction:
//     excess_shelter = $198.99 (FY26)                            [273.9(d)(6)(i)]
//   else:
//     shelter_amt = rent + state_sua + internet                  [273.9(d)(6)]
//     excess_shelter = max(0, shelter_amt - 0.5 * adj_income)
//     if not E/D: excess_shelter = min(excess_shelter, shelter_cap)
//   net        = max(0, adj_income - excess_shelter)
//   max_allot  = maxAllotmentFor(size, asOf)
//   benefit    = round(max_allot - 0.30 * net)            [273.10(e)(2)(ii)(A)]
//   if size ≤ 2 and 0 < benefit < min_benefit:
//     benefit = min_benefit                                [273.10(e)(2)(ii)(C)]
//
// Citation precision note (verified against live eCFR, 2026-06-02): the
// final-benefit formula + its rounding live at 273.10(e)(2)(ii)(A); the
// HH1-2 minimum-benefit rule (8% of HH1 max allotment) lives at
// 273.10(e)(2)(ii)(C). The OTHER rounding rule at 273.10(e)(1)(ii) covers
// cents-handling INSIDE the net-income computation — a different subsection
// for a different purpose. For lottery / substantial gambling-winnings
// disqualification, see disqualifications.ts: the DQ + definition live at
// 7 CFR 273.11(r); the state-agency data-match procedure lives at 7 CFR
// 272.17 (which cross-references 273.11(r) verbatim). Re-verified
// 2026-06-03 against Cornell LII primary source; the earlier comment in
// this file claiming 273.11(r) was "proposed-only" was wrong.

import type { Facts } from "./facts";
import {
  aggregateIncome,
  hasElderlyOrDisabled,
  householdSize,
} from "./facts";
import { Decimal, ZERO, dec } from "./decimal";
import {
  earnedIncomeDeductionRateFor,
  standardDeductionFor,
  shelterCapFor,
  maxAllotmentFor,
  minimumBenefitFor,
  homelessDeductionFor,
  medicalFloorFor,
} from "./constants/federal-tables";
import { statePolicyFor } from "./constants/states";

export interface BenefitCalcDetail {
  gross_monthly_income: number;
  earned_income_deduction: number;
  standard_deduction: number;
  dependent_care_deduction: number;
  medical_deduction: number;
  child_support_deduction: number;
  excess_shelter_deduction: number;
  net_monthly_income: number;
  thirty_percent_of_net: number;
  max_allotment_for_household_size: number;
  monthly_benefit: number;
  trace: {
    homeless_deduction_applied: boolean;
    shelter_capped: boolean;
    state_sua_value: number;
  };
}

export function computeBenefit(facts: Facts, state: string, asOf: Date): BenefitCalcDetail {
  const incAgg = aggregateIncome(facts);
  const size = householdSize(facts);
  const isED = hasElderlyOrDisabled(facts);
  const policy = statePolicyFor(state);

  const gross = new Decimal(incAgg.gross_total);
  const earned = new Decimal(incAgg.earned_total);

  // Earned income deduction (20% of earned, rounded).
  const eidRate = earnedIncomeDeductionRateFor(asOf);
  const eid = earned.mul(eidRate).roundDollar();

  // Standard deduction by HH size.
  const sd = standardDeductionFor(size, asOf);

  // Dependent care (no floor, no cap in modern rules).
  const depCare = dec(facts.deductions.dependent_care ?? 0);

  // Medical deduction: E/D HHs only, portion above $35 floor.
  const medFloor = medicalFloorFor(asOf);
  const rawMedical = dec(facts.deductions.medical_unreimbursed ?? 0);
  const medical = isED && rawMedical.gt(medFloor) ? rawMedical.sub(medFloor) : ZERO;

  // Legally obligated child support paid.
  const childSupport = dec(facts.deductions.child_support_paid ?? 0);

  // Adjusted income (the half-of-this figure drives excess shelter).
  const otherDeductions = depCare.add(medical).add(childSupport);
  let adjIncome = gross.sub(eid).sub(sd).sub(otherDeductions);
  if (adjIncome.lt(ZERO)) adjIncome = ZERO;

  // Shelter calc.
  const homeless = facts.shelter.homeless_deduction === true;
  let excessShelter: Decimal;
  let shelterCapped = false;
  let stateSuaVal = 0;
  if (homeless) {
    // 7 CFR 273.9(d)(6)(i): homeless HH substitute in lieu of excess shelter.
    excessShelter = homelessDeductionFor(asOf);
  } else {
    // Per-state SUA. Composer SKIPs (above) when state SUA isn't authored
    // AND the household claims a non-"none" SUA tier. When the tier is
    // "none" (no SUA contribution), the math works with $0 even if the
    // state's tier table is unauthored — gate the throw accordingly.
    let suaVal: Decimal;
    if (!policy.sua_by_tier) {
      if (facts.shelter.sua_tier !== "none") {
        throw new Error(`SUA not authored for state ${state} — composer should not call computeBenefit here`);
      }
      suaVal = ZERO;
    } else {
      suaVal = policy.sua_by_tier[facts.shelter.sua_tier];
    }
    stateSuaVal = suaVal.toNumber();
    // OBBBA §10104: pre-2025-11-01 internet counts; post-cutoff it doesn't.
    const obbbaCutoff = new Date(Date.UTC(2025, 10, 1));
    const internetCounts = asOf < obbbaCutoff;
    const internet = internetCounts ? dec(facts.shelter.internet ?? 0) : ZERO;

    const shelterAmt = dec(facts.shelter.rent).add(suaVal).add(internet);
    const halfAdj = adjIncome.div(2);
    const rawExcess = shelterAmt.sub(halfAdj);
    if (rawExcess.lt(ZERO)) {
      excessShelter = ZERO;
    } else if (isED) {
      excessShelter = rawExcess;
    } else {
      const cap = shelterCapFor(asOf);
      if (rawExcess.gt(cap)) {
        excessShelter = cap;
        shelterCapped = true;
      } else {
        excessShelter = rawExcess;
      }
    }
  }

  // Net income.
  let net = adjIncome.sub(excessShelter);
  if (net.lt(ZERO)) net = ZERO;

  // Benefit calc.
  const thirtyPctNet = net.mul(0.30).roundDollar();
  const maxAllot = maxAllotmentFor(size, asOf);
  let benefit = maxAllot.sub(thirtyPctNet);
  if (benefit.lt(ZERO)) benefit = ZERO;
  // Federal min-benefit floor for HH1-2 eligible households.
  // Note: applies whenever computed benefit >= 0 AND below the floor —
  // Python source uses `> 0` because Python can't reach this branch
  // for BBCE-conferred high-net cases (its gross test denies first).
  // BBCE-conferred HHs can land at benefit=0 by math and still be
  // eligible; the floor still applies.
  const minBenefit = minimumBenefitFor(asOf);
  if (size <= 2 && benefit.gte(ZERO) && benefit.lt(minBenefit)) {
    benefit = minBenefit;
  }
  benefit = benefit.roundDollar();

  return {
    gross_monthly_income: gross.roundDollar().toNumber(),
    earned_income_deduction: eid.toNumber(),
    standard_deduction: sd.toNumber(),
    dependent_care_deduction: depCare.roundDollar().toNumber(),
    medical_deduction: medical.roundDollar().toNumber(),
    child_support_deduction: childSupport.roundDollar().toNumber(),
    excess_shelter_deduction: excessShelter.roundDollar().toNumber(),
    net_monthly_income: net.roundDollar().toNumber(),
    thirty_percent_of_net: thirtyPctNet.toNumber(),
    max_allotment_for_household_size: maxAllot.toNumber(),
    monthly_benefit: benefit.toNumber(),
    trace: {
      homeless_deduction_applied: homeless,
      shelter_capped: shelterCapped,
      state_sua_value: stateSuaVal,
    },
  };
}
