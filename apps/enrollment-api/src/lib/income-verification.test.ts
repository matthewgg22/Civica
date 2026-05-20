import { describe, it, expect } from "vitest";
import { compareIncome, annualizePayAmount } from "./income-verification.js";

describe("annualizePayAmount", () => {
  it("weekly × 52", () => expect(annualizePayAmount(500, "weekly")).toBe(26000));
  it("biweekly × 26", () => expect(annualizePayAmount(1000, "biweekly")).toBe(26000));
  it("semimonthly × 24", () => expect(annualizePayAmount(1083.33, "semimonthly")).toBeCloseTo(25999.92, 1));
  it("monthly × 12", () => expect(annualizePayAmount(2000, "monthly")).toBe(24000));
  it("annual × 1", () => expect(annualizePayAmount(30000, "annual")).toBe(30000));
});

describe("compareIncome", () => {
  it("returns direction=null when all inputs are null (no data)", () => {
    const r = compareIncome(null, null, null);
    expect(r.direction).toBeNull();
    expect(r.flagged).toBe(false);
    expect(r.ocr_monthly).toBeNull();
  });

  it("returns direction=null when only reported_monthly provided", () => {
    const r = compareIncome(2000, null, null);
    expect(r.direction).toBeNull();
    expect(r.reported_monthly).toBe(2000);
  });

  it("returns direction=incomplete when ocr_pay_amount present but ocr_pay_period missing", () => {
    const r = compareIncome(2000, 1000, null);
    expect(r.direction).toBe("incomplete");
    expect(r.flagged).toBe(false);
    expect(r.ocr_monthly).toBeNull();
    expect(r.delta_pct).toBeNull();
  });

  it("match when delta ≤ 10%", () => {
    // reported $2000/mo, OCR: $2100 biweekly = $2100*26/12 = $4550 — wait let me use a matching example
    // $500/wk = $26000/yr = $2166.67/mo; reported $2100 → delta = (2166-2100)/2100 ≈ 3.1% → match
    const r = compareIncome(2100, 500, "weekly");
    expect(r.direction).toBe("match");
    expect(r.flagged).toBe(false);
  });

  it("over when OCR income > reported by >10%", () => {
    // reported $2000/mo, OCR: $3000/mo (monthly pay period)
    const r = compareIncome(2000, 3000, "monthly");
    expect(r.direction).toBe("over");
    expect(r.flagged).toBe(true);
    expect(r.delta_pct).toBeGreaterThan(0.1);
  });

  it("under when OCR income < reported by >10%", () => {
    // reported $3000/mo, OCR: $2000/mo
    const r = compareIncome(3000, 2000, "monthly");
    expect(r.direction).toBe("under");
    expect(r.flagged).toBe(true);
    expect(r.delta_pct).toBeLessThan(-0.1);
  });

  it("flags (direction=null) when reported_monthly=0 to avoid divide-by-zero", () => {
    const r = compareIncome(0, 1000, "monthly");
    expect(r.flagged).toBe(true);
    expect(r.direction).toBeNull();
    expect(r.ocr_monthly).toBeCloseTo(1000, 0);
  });

  it("biweekly pay annualizes correctly — $1500 biweekly ≈ $3250/mo", () => {
    const r = compareIncome(3250, 1500, "biweekly");
    expect(r.ocr_monthly).toBeCloseTo(3250, 0);
    expect(r.direction).toBe("match");
  });

  it("includes reported_monthly in result", () => {
    const r = compareIncome(2000, 2000, "monthly");
    expect(r.reported_monthly).toBe(2000);
  });
});
