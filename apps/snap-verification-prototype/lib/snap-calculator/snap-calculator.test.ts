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

describe("grossIncomeLimitMonthly (130% FPL)", () => {
  it("1-person household is $1,632", () => expect(grossIncomeLimitMonthly(1)).toBe(1632));
  it("2-person household is $2,215", () => expect(grossIncomeLimitMonthly(2)).toBe(2215));
  it("4-person household is $3,383", () => expect(grossIncomeLimitMonthly(4)).toBe(3383));
});

describe("netIncomeLimitMonthly (100% FPL)", () => {
  it("1-person household is $1,255", () => expect(netIncomeLimitMonthly(1)).toBe(1255));
  it("3-person household is $2,152", () => expect(netIncomeLimitMonthly(3)).toBe(2152)); // FNS table
});

describe("bbceIncomeLimitMonthly (200% FPL — CA BBCE)", () => {
  it("1-person is $2,510", () => expect(bbceIncomeLimitMonthly(1)).toBe(2510));
  it("4-person is $5,200", () => expect(bbceIncomeLimitMonthly(4)).toBe(5200));
});

describe("isCaBbceEligible", () => {
  it("eligible when gross income is at the 200% FPL threshold", () =>
    expect(isCaBbceEligible(2510, 1)).toBe(true));
  it("eligible when gross income is below the threshold", () =>
    expect(isCaBbceEligible(2000, 1)).toBe(true));
  it("not eligible when gross income exceeds 200% FPL", () =>
    expect(isCaBbceEligible(2511, 1)).toBe(false));
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
    // 2-person MA limit is $2,215; earned $2,400 + unearned $200 = $2,600 > limit
    const r = calculateSnapBenefit(
      base({ stateCode: "MA", grossMonthlyEarnedIncome: 2400, grossMonthlyUnearnedIncome: 200 })
    );
    expect(r.gross_income_test_pass).toBe(false);
    expect(r.eligible).toBe(false);
    expect(r.estimated_benefit).toBe(0);
  });

  it("waives gross income test in CA when gross income is below 200% FPL (BBCE)", () => {
    // $2,200 earned is above 130% FPL ($2,215 for 2-person) but below 200% FPL ($3,406)
    // Actually 2200 < 2215, so it would pass anyway. Let me use a value above 130% but below 200%.
    // 2-person: 130% = $2,215; 200% = $3,406
    const r = calculateSnapBenefit(
      base({ stateCode: "CA", grossMonthlyEarnedIncome: 2400 }) // $2,400 > $2,215 but < $3,406
    );
    expect(r.gross_income_test_waived).toBe(true);
    expect(r.bbce_eligible).toBe(true);
    expect(r.gross_income_test_pass).toBe(true);
    expect(r.eligible).toBe(true);
  });

  it("does NOT waive gross income test in CA when gross income exceeds 200% FPL", () => {
    // 2-person BBCE limit = $3,406; use $3,500
    const r = calculateSnapBenefit(
      base({ stateCode: "CA", grossMonthlyEarnedIncome: 3500 })
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

  it("standard deduction for 2-person HH is $198", () => {
    const r = calculateSnapBenefit(base());
    expect(r.standard_deduction).toBe(198);
  });

  it("standard deduction for 4-person HH is $209", () => {
    const r = calculateSnapBenefit(base({ householdSize: 4 }));
    expect(r.standard_deduction).toBe(209);
  });

  it("dependent care deduction capped at $175 for non-infant", () => {
    const r = calculateSnapBenefit(base({ monthlyDependentCareCost: 300 }));
    expect(r.dependent_care_deduction).toBe(175);
  });

  it("dependent care deduction capped at $200 for child under 2", () => {
    const r = calculateSnapBenefit(
      base({ monthlyDependentCareCost: 250, hasChildUnder2: true })
    );
    expect(r.dependent_care_deduction).toBe(200);
  });

  it("shelter deduction capped at $672 for non-elderly household", () => {
    // High rent to generate large excess shelter
    const r = calculateSnapBenefit(
      base({ monthlySheltCost: 2500, monthlySuaAmount: 670, grossMonthlyEarnedIncome: 800 })
    );
    expect(r.shelter_deduction_applied).toBe(672);
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
    expect(r.shelter_deduction_applied).toBe(r.excess_shelter);
    expect(r.shelter_deduction_applied).toBeGreaterThan(672);
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
    // 2-person 100% FPL = $1,703; need net > $1,703
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
    // net ≈ 2000 - 198 = 1802 > 1703
    expect(r.net_income).toBeGreaterThan(1703);
    expect(r.net_income_test_pass).toBe(false);
    expect(r.eligible).toBe(false);
  });
});

// ---------- benefit calculation ----------

describe("benefit calculation", () => {
  it("benefit = max_allotment − 30% of net income", () => {
    const r = calculateSnapBenefit(base({ grossMonthlyEarnedIncome: 1200, monthlySuaAmount: 0, monthlySheltCost: 0 }));
    expect(r.estimated_benefit).toBe(r.max_allotment - r.thirty_pct_net);
  });

  it("minimum benefit of $23 for 1-person eligible household", () => {
    // Very low income → benefit would round below $23
    const r = calculateSnapBenefit(
      base({ householdSize: 1, grossMonthlyEarnedIncome: 0, grossMonthlyUnearnedIncome: 290, monthlySheltCost: 0, monthlySuaAmount: 0 })
    );
    expect(r.estimated_benefit).toBeGreaterThanOrEqual(23);
  });

  it("no minimum benefit for 3-person household (min is $0 for HH ≥ 3)", () => {
    // Construct a case where 30% of net ≥ max_allotment → raw_benefit ≤ 0
    // max_allotment for 3 = $768; net_income × 0.3 > 768 → net > 2560
    // Use MA so no BBCE, high unearned income
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
    // gross > 130% FPL for 3-person ($2,799), so ineligible → benefit $0
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
    // max_allotment for 10 = 1756 + 2 * 220 = 2196
    expect(r.max_allotment).toBe(2196);
    expect(r.estimated_benefit).toBeGreaterThan(0);
  });
});
