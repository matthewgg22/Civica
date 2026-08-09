import { describe, it, expect } from "vitest";
import { computeExpeditedPaths, type ExpeditedGateAnswers } from "../expedited-gate";

// Base: no answers at all. Each test overrides just what it needs, matching
// the "unanswered ⇒ don't rule out expedited" direction the gate itself uses
// for income/liquid-resources — a fully-blank household should NOT fire
// Path 1 just from being blank (employment_status must still say
// "unemployed" for Path 1; the income/liquid legs alone don't gate it).
const BLANK: ExpeditedGateAnswers = {
  employment_status: null,
  monthly_gross_income: null,
  savings_amount: null,
  monthly_rent_or_mortgage: null,
  has_heating_costs: null,
  has_electric_or_gas: null,
  has_phone: null,
  is_migrant_or_seasonal_farmworker: null,
};

describe("computeExpeditedPaths — Path 1 (7 CFR 273.2(i)(1)(i))", () => {
  it("fires: unemployed, gross income under $150, liquid at limit", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      employment_status: "unemployed",
      monthly_gross_income: "100",
      savings_amount: "100",
    });
    expect(paths).toContain("path1");
  });

  it("does not fire: unemployed and low income, but liquid resources over $100 (#557 regression)", () => {
    // The original bug: the gate over-triggered here because it never
    // checked liquid resources at all.
    const paths = computeExpeditedPaths({
      ...BLANK,
      employment_status: "unemployed",
      monthly_gross_income: "50",
      savings_amount: "500",
    });
    expect(paths).not.toContain("path1");
  });

  it("does not fire: employed, even with low income and low liquid", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      employment_status: "employed",
      monthly_gross_income: "50",
      savings_amount: "0",
    });
    expect(paths).not.toContain("path1");
  });

  it("does not fire: gross income at or above $150", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      employment_status: "unemployed",
      monthly_gross_income: "150",
      savings_amount: "0",
    });
    expect(paths).not.toContain("path1");
  });

  it("treats unanswered income as satisfying the low-income leg", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      employment_status: "unemployed",
      monthly_gross_income: null,
      savings_amount: "0",
    });
    expect(paths).toContain("path1");
  });

  it("treats unanswered liquid resources as satisfying the liquid-limit leg", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      employment_status: "unemployed",
      monthly_gross_income: "0",
      savings_amount: null,
    });
    expect(paths).toContain("path1");
  });
});

describe("computeExpeditedPaths — Path 2 (7 CFR 273.2(i)(1)(iii))", () => {
  const FULL_SUA: Pick<ExpeditedGateAnswers, "has_heating_costs" | "has_electric_or_gas" | "has_phone"> = {
    has_heating_costs: "yes",
    has_electric_or_gas: "yes",
    has_phone: "yes",
  };

  it("fires for an EMPLOYED household whose income+liquid is under rent+SUA (the issue's worked example)", () => {
    // $400 gross + $100 liquid = $500 < $700 rent + $663 FULL SUA = $1,363.
    const paths = computeExpeditedPaths({
      ...BLANK,
      employment_status: "employed",
      monthly_gross_income: "400",
      savings_amount: "100",
      monthly_rent_or_mortgage: "700",
      ...FULL_SUA,
    });
    expect(paths).toContain("path2");
    expect(paths).not.toContain("path1");
  });

  it("does not fire when income+liquid meets or exceeds rent+SUA", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      employment_status: "employed",
      monthly_gross_income: "2000",
      savings_amount: "500",
      monthly_rent_or_mortgage: "700",
      ...FULL_SUA,
    });
    expect(paths).not.toContain("path2");
  });

  it("is skipped (not fired, not guessed) when rent is unanswered", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      employment_status: "employed",
      monthly_gross_income: "0",
      savings_amount: "0",
      monthly_rent_or_mortgage: null,
      ...FULL_SUA,
    });
    expect(paths).not.toContain("path2");
  });

  it("is skipped when the SUA tier can't be determined (any utility question unanswered)", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      employment_status: "employed",
      monthly_gross_income: "0",
      savings_amount: "0",
      monthly_rent_or_mortgage: "700",
      has_heating_costs: "no",
      has_electric_or_gas: null,
      has_phone: "no",
    });
    expect(paths).not.toContain("path2");
  });

  it("uses the correct dollar figure per SUA tier (LIMITED, not FULL)", () => {
    // LIMITED = $170. $400 rent + $170 = $570. Household at $560 combined
    // should fire; a household at $580 should not.
    const fires = computeExpeditedPaths({
      ...BLANK,
      employment_status: "employed",
      monthly_gross_income: "460",
      savings_amount: "100",
      monthly_rent_or_mortgage: "400",
      has_heating_costs: "no",
      has_electric_or_gas: "yes",
      has_phone: "yes",
    });
    const doesNotFire = computeExpeditedPaths({
      ...BLANK,
      employment_status: "employed",
      monthly_gross_income: "480",
      savings_amount: "100",
      monthly_rent_or_mortgage: "400",
      has_heating_costs: "no",
      has_electric_or_gas: "yes",
      has_phone: "yes",
    });
    expect(fires).toContain("path2");
    expect(doesNotFire).not.toContain("path2");
  });
});

describe("computeExpeditedPaths — Path 3 (7 CFR 273.2(i)(1)(ii), #652)", () => {
  it("fires: farmworker, no income reported, liquid at limit", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      is_migrant_or_seasonal_farmworker: "yes",
      monthly_gross_income: "0",
      savings_amount: "100",
    });
    expect(paths).toContain("path3");
  });

  it("fires: farmworker, income entirely unanswered, liquid unanswered", () => {
    // Both "unanswered" -- the approximation treats a genuinely-blank
    // household the same as "no income reported", same direction as
    // Path 1's own unanswered handling.
    const paths = computeExpeditedPaths({
      ...BLANK,
      is_migrant_or_seasonal_farmworker: "yes",
    });
    expect(paths).toContain("path3");
  });

  it("does not fire: not a farmworker, even with no income and low liquid", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      is_migrant_or_seasonal_farmworker: "no",
      monthly_gross_income: "0",
      savings_amount: "0",
    });
    expect(paths).not.toContain("path3");
  });

  it("does not fire: 'not_sure' on farmworker status does not count as yes", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      is_migrant_or_seasonal_farmworker: "not_sure",
      monthly_gross_income: "0",
      savings_amount: "0",
    });
    expect(paths).not.toContain("path3");
  });

  it("does not fire: farmworker with real income reported", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      is_migrant_or_seasonal_farmworker: "yes",
      monthly_gross_income: "1200",
      savings_amount: "0",
    });
    expect(paths).not.toContain("path3");
  });

  it("does not fire: farmworker with no income but liquid resources over $100", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      is_migrant_or_seasonal_farmworker: "yes",
      monthly_gross_income: "0",
      savings_amount: "500",
    });
    expect(paths).not.toContain("path3");
  });

  it("is independent of employment_status (Path 3 has no employment leg, unlike Path 1)", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      is_migrant_or_seasonal_farmworker: "yes",
      employment_status: "employed",
      monthly_gross_income: "0",
      savings_amount: "0",
    });
    expect(paths).toContain("path3");
  });
});

describe("computeExpeditedPaths — multiple paths can fire together", () => {
  it("returns both path1 and path2 when both tests are met", () => {
    const paths = computeExpeditedPaths({
      employment_status: "unemployed",
      monthly_gross_income: "0",
      savings_amount: "0",
      monthly_rent_or_mortgage: "700",
      has_heating_costs: "yes",
      has_electric_or_gas: "yes",
      has_phone: "yes",
      is_migrant_or_seasonal_farmworker: null,
    });
    expect(paths).toEqual(expect.arrayContaining(["path1", "path2"]));
    expect(paths).toHaveLength(2);
  });

  it("#652: all three paths fire together when the household meets every test", () => {
    const paths = computeExpeditedPaths({
      employment_status: "unemployed",
      monthly_gross_income: "0",
      savings_amount: "0",
      monthly_rent_or_mortgage: "700",
      has_heating_costs: "yes",
      has_electric_or_gas: "yes",
      has_phone: "yes",
      is_migrant_or_seasonal_farmworker: "yes",
    });
    expect(paths).toEqual(expect.arrayContaining(["path1", "path2", "path3"]));
    expect(paths).toHaveLength(3);
  });

  it("returns an empty array when neither test fires", () => {
    const paths = computeExpeditedPaths({
      ...BLANK,
      employment_status: "employed",
      monthly_gross_income: "3000",
      savings_amount: "5000",
    });
    expect(paths).toEqual([]);
  });
});
