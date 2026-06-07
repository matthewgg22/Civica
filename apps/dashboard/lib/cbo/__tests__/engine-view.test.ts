import { describe, it, expect } from "vitest";
import type { BenefitCalcDetail } from "@civica/snap-rules";
import { EVALUATION_GATES, deductionRows, deductionOneLine } from "../engine-view";

// Minimal BenefitCalcDetail for the presentation transforms (they read the
// numeric fields only). trace shape is irrelevant here.
const detail = {
  gross_monthly_income: 2000,
  earned_income_deduction: 400,
  standard_deduction: 209,
  dependent_care_deduction: 0,
  medical_deduction: 0,
  child_support_deduction: 0,
  excess_shelter_deduction: 300,
  net_monthly_income: 1091,
  thirty_percent_of_net: 327,
  max_allotment_for_household_size: 785,
  monthly_benefit: 458,
  trace: {},
} as unknown as BenefitCalcDetail;

describe("CBO engine-view", () => {
  it("exposes the regulatory gate chain in order with citations", () => {
    expect(EVALUATION_GATES[0]).toMatchObject({ citation: "7 CFR 273.1" });
    const cites = EVALUATION_GATES.map((g) => g.citation);
    expect(cites).toContain("7 CFR 273.9(a)(1)"); // gross income test
    expect(cites).toContain("7 CFR 273.10"); // benefit calc
    expect(EVALUATION_GATES.length).toBeGreaterThanOrEqual(8);
  });

  it("builds the deduction rows with totals + citations, omitting zero deductions", () => {
    const rows = deductionRows(detail);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));
    expect(byLabel["Gross monthly income"]).toMatchObject({ amount: 2000, total: true });
    expect(byLabel["Earned-income deduction (20%)"]).toMatchObject({ amount: -400, citation: "7 CFR 273.9(d)(2)" });
    expect(byLabel["Excess shelter deduction"].amount).toBe(-300);
    expect(byLabel["Monthly benefit"]).toMatchObject({ amount: 458, total: true });
    // zero deductions are not rendered as rows
    expect(rows.some((r) => r.label.includes("Dependent-care"))).toBe(false);
    expect(rows.some((r) => r.label.includes("Medical"))).toBe(false);
  });

  it("summarizes the math in one line", () => {
    const line = deductionOneLine(detail);
    expect(line).toContain("$2,000.00 gross");
    expect(line).toContain("$1,091.00 net");
    expect(line).toContain("≈ $458.00/mo");
  });
});
