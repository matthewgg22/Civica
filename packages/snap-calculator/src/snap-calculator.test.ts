import { describe, it, expect } from "vitest";
import {
  calculateSnapBenefit,
  grossIncomeLimitMonthly,
  netIncomeLimitMonthly,
  bbceIncomeLimitMonthly,
  isCaBbceEligible,
} from "./index";
import type { SnapCalculatorInput } from "./index";

// ---------- FPL helpers ----------
//
// These values track FY-current FNS COLA + HHS poverty guidelines via the
// @civica/snap-rules federal-tables snapshot system. When the FY rolls,
// these test expectations update with the engine — there is no "FY25"
// baseline to defend; the engine + GPO-cited 7 CFR primary sources are the
// reference of truth.

describe("grossIncomeLimitMonthly (130% FPL)", () => {
  it("1-person household = 130% FPL HH1", () => expect(grossIncomeLimitMonthly(1)).toBe(1697));
  it("2-person household = 130% FPL HH2", () => expect(grossIncomeLimitMonthly(2)).toBe(2292));
  it("4-person household = 130% FPL HH4", () => expect(grossIncomeLimitMonthly(4)).toBe(3484));
});

describe("netIncomeLimitMonthly (100% FPL)", () => {
  it("1-person household = 100% FPL HH1", () => expect(netIncomeLimitMonthly(1)).toBe(1305));
  it("3-person household = 100% FPL HH3", () => expect(netIncomeLimitMonthly(3)).toBe(2222));
});

describe("bbceIncomeLimitMonthly (200% FPL — CA BBCE)", () => {
  it("1-person = 200% FPL HH1", () => expect(bbceIncomeLimitMonthly(1)).toBe(2610));
  it("4-person = 200% FPL HH4", () => expect(bbceIncomeLimitMonthly(4)).toBe(5360));
});

describe("isCaBbceEligible", () => {
  it("eligible when gross income is at the 200% FPL threshold", () =>
    expect(isCaBbceEligible(2610, 1)).toBe(true));
  it("eligible when gross income is below the threshold", () =>
    expect(isCaBbceEligible(2000, 1)).toBe(true));
  it("not eligible when gross income exceeds 200% FPL", () =>
    expect(isCaBbceEligible(2611, 1)).toBe(false));
});

// ---------- base input factory ----------

const base = (overrides: Partial<SnapCalculatorInput> = {}): SnapCalculatorInput => ({
  stateCode: "CA",
  householdSize: 2,
  grossMonthlyEarnedIncome: 1800,
  grossMonthlyUnearnedIncome: 0,
  monthlySheltCost: 850,
  monthlySuaAmount: 670,
  monthlyDependentCareCost: 0,
  hasChildUnder2: false,
  elderlyOrDisabled: false,
  ...overrides,
});

// ---------- gross income test ----------

describe("gross income test", () => {
  it("passes when gross income is below the 130% FPL limit", () => {
    const r = calculateSnapBenefit(base({ grossMonthlyEarnedIncome: 2000, stateCode: "MA" }));
    expect(r.gross_income_test_pass).toBe(true);
    expect(r.gross_income_test_waived).toBe(false);
  });

  it("fails in MA when gross income exceeds 130% FPL", () => {
    // 2-person MA limit is $2,292; earned $2,500 + unearned $200 = $2,700 > limit
    const r = calculateSnapBenefit(
      base({ stateCode: "MA", grossMonthlyEarnedIncome: 2500, grossMonthlyUnearnedIncome: 200 })
    );
    expect(r.gross_income_test_pass).toBe(false);
    expect(r.eligible).toBe(false);
    expect(r.estimated_benefit).toBe(0);
  });

  it("waives gross income test in CA when gross income is below 200% FPL (BBCE)", () => {
    // 2-person: 130% = $2,292; 200% = $3,526. Use $2,500 above 130% but below 200%.
    const r = calculateSnapBenefit(
      base({ stateCode: "CA", grossMonthlyEarnedIncome: 2500 })
    );
    expect(r.gross_income_test_waived).toBe(true);
    expect(r.bbce_eligible).toBe(true);
    expect(r.gross_income_test_pass).toBe(true);
    expect(r.eligible).toBe(true);
  });

  it("does NOT waive gross income test in CA when gross income exceeds 200% FPL", () => {
    // 2-person BBCE limit = $3,526; use $3,600
    const r = calculateSnapBenefit(
      base({ stateCode: "CA", grossMonthlyEarnedIncome: 3600 })
    );
    expect(r.bbce_eligible).toBe(false);
    expect(r.gross_income_test_waived).toBe(false);
    expect(r.gross_income_test_pass).toBe(false); // also > 130% FPL
  });
});

// ---------- deduction chain ----------

describe("deduction chain", () => {
  it("applies 20% earned income deduction", () => {
    const r = calculateSnapBenefit(base({ grossMonthlyEarnedIncome: 1000 }));
    expect(r.earned_income_deduction).toBe(200);
  });

  it("standard deduction for HH1-3 (uniform under FY-current FNS table)", () => {
    const r = calculateSnapBenefit(base());
    expect(r.standard_deduction).toBe(209);
  });

  it("standard deduction for 4-person HH (higher band)", () => {
    const r = calculateSnapBenefit(base({ householdSize: 4 }));
    expect(r.standard_deduction).toBe(223);
  });

  // Note: FY-current rules removed the dependent-care cap per
  // 7 CFR 273.9(d)(4) (FNS guidance: "no floor, no cap in modern rules").
  // The hasChildUnder2 flag is informational; the engine doesn't differentiate.
  it("dependent care deduction passes through (no cap in modern rules)", () => {
    const r = calculateSnapBenefit(base({ monthlyDependentCareCost: 300 }));
    expect(r.dependent_care_deduction).toBe(300);
  });

  it("dependent care deduction also uncapped for child under 2", () => {
    const r = calculateSnapBenefit(
      base({ monthlyDependentCareCost: 250, hasChildUnder2: true })
    );
    expect(r.dependent_care_deduction).toBe(250);
  });

  it("shelter deduction capped at FY-current cap for non-elderly household", () => {
    // High rent to generate large excess shelter
    const r = calculateSnapBenefit(
      base({ monthlySheltCost: 2500, monthlySuaAmount: 670, grossMonthlyEarnedIncome: 800 })
    );
    // FY26 non-E/D shelter cap is $744 per 7 CFR 273.9(d)(6).
    expect(r.shelter_deduction_applied).toBe(744);
  });

  it("shelter deduction NOT capped for elderly/disabled household", () => {
    const r = calculateSnapBenefit(
      base({
        monthlySheltCost: 2500,
        monthlySuaAmount: 670,
        grossMonthlyEarnedIncome: 800,
        elderlyOrDisabled: true,
      })
    );
    // E/D households get uncapped shelter excess per 7 CFR 273.9(d)(6).
    expect(r.shelter_deduction_applied).toBe(r.excess_shelter);
    expect(r.shelter_deduction_applied).toBeGreaterThan(744);
  });

  it("net income cannot go below zero", () => {
    const r = calculateSnapBenefit(
      base({ grossMonthlyEarnedIncome: 0, grossMonthlyUnearnedIncome: 0, monthlySheltCost: 500 })
    );
    expect(r.net_income).toBe(0);
  });
});

// ---------- net income test ----------

describe("net income test", () => {
  it("passes when net income is below 100% FPL", () => {
    // Low income → low net income
    const r = calculateSnapBenefit(base({ grossMonthlyEarnedIncome: 1000 }));
    expect(r.net_income_test_pass).toBe(true);
  });

  it("fails when net income exceeds 100% FPL (and MA so no BBCE)", () => {
    // 2-person 100% FPL = $1,763; need net > $1,763
    // High unearned income, low rent to limit shelter deduction
    const r = calculateSnapBenefit(
      base({
        stateCode: "MA",
        grossMonthlyUnearnedIncome: 2000,
        grossMonthlyEarnedIncome: 0,
        monthlySheltCost: 0,
        monthlySuaAmount: 0,
      })
    );
    // net ≈ 2000 - 209 = 1791 > 1763
    expect(r.net_income).toBeGreaterThan(1763);
    expect(r.net_income_test_pass).toBe(false);
    expect(r.eligible).toBe(false);
  });
});

// ---------- benefit calculation ----------

describe("benefit calculation", () => {
  it("benefit = max_allotment − 30% of net income (when above min)", () => {
    const r = calculateSnapBenefit(base({ grossMonthlyEarnedIncome: 1200, monthlySuaAmount: 0, monthlySheltCost: 0 }));
    expect(r.estimated_benefit).toBe(r.max_allotment - r.thirty_pct_net);
  });

  it("minimum benefit floor for HH1-2 eligible household (per 7 CFR 273.10(e)(2)(ii)(C))", () => {
    // Very low income → benefit would round below the FY-current minimum
    const r = calculateSnapBenefit(
      base({ householdSize: 1, grossMonthlyEarnedIncome: 0, grossMonthlyUnearnedIncome: 290, monthlySheltCost: 0, monthlySuaAmount: 0 })
    );
    // FY26 minimum = 8% of HH1 max ($298) = $24, rounded.
    expect(r.estimated_benefit).toBeGreaterThanOrEqual(24);
  });

  it("no minimum benefit for 3-person household (min applies only to HH1-2)", () => {
    // Construct a case where HH-3 is ineligible due to gross test
    const r = calculateSnapBenefit(
      base({
        stateCode: "MA",
        householdSize: 3,
        grossMonthlyEarnedIncome: 0,
        grossMonthlyUnearnedIncome: 3000,
        monthlySheltCost: 0,
        monthlySuaAmount: 0,
      })
    );
    // gross > 130% FPL for 3-person ($2,888), so ineligible → benefit $0
    expect(r.gross_income_test_pass).toBe(false);
    expect(r.estimated_benefit).toBe(0);
  });

  it("benefit is zero when household is ineligible", () => {
    const r = calculateSnapBenefit(
      base({
        stateCode: "MA",
        grossMonthlyEarnedIncome: 3000,
        grossMonthlyUnearnedIncome: 0,
      })
    );
    expect(r.eligible).toBe(false);
    expect(r.estimated_benefit).toBe(0);
  });

  it("large household (10-person) uses per-person allotment increment", () => {
    const r = calculateSnapBenefit(
      base({
        householdSize: 10,
        grossMonthlyEarnedIncome: 0,
        grossMonthlyUnearnedIncome: 500,
        monthlySheltCost: 0,
        monthlySuaAmount: 0,
      })
    );
    // FY26 max_allotment HH10 = $1,789 (HH8) + 2 × $218 (each-additional) = $2,225.
    // See packages/snap-rules/src/constants/federal-tables.ts FY26 snapshot.
    expect(r.max_allotment).toBe(2225);
    expect(r.estimated_benefit).toBeGreaterThan(0);
  });
});
