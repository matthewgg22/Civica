import { describe, it, expect } from "vitest";
import { perExposure } from "../section10105";

describe("perExposure", () => {
  it("returns CA exposure data for stateCode='CA'", () => {
    const r = perExposure("CA");
    expect(r.stateCode).toBe("CA");
    expect(r.statewidePER).toBe(10.8);
    expect(r.nationalAvgPER).toBe(8.6);
    expect(r.penaltyExposureDollars).toBe(510_000_000);
    expect(r.demoMode).toBe(true);
  });

  it("returns MA exposure data for stateCode='MA'", () => {
    const r = perExposure("MA");
    expect(r.stateCode).toBe("MA");
    expect(r.statewidePER).toBe(9.1);
    expect(r.penaltyExposureDollars).toBe(22_000_000);
  });

  // T5 critical-credibility test: an unknown state must NOT return NaN or
  // undefined into a $-figure on the county demo page. The fallback to CA
  // is documented in section10105.ts; this test locks the behavior in.
  it("falls back to CA when stateCode is unknown (no NaN, no undefined)", () => {
    const r = perExposure("ZZ");
    expect(r.stateCode).toBe("ZZ");
    expect(r.penaltyExposureDollars).toBe(510_000_000);
    expect(Number.isFinite(r.penaltyExposureDollars)).toBe(true);
    expect(Number.isFinite(r.statewidePER)).toBe(true);
  });

  it("CA statewide PER is above the §10105 trigger threshold (105% × national avg)", () => {
    // This is the load-bearing claim of the entire B2G pitch — if this fails,
    // CA isn't actually in penalty territory and the dollar figure is wrong.
    const r = perExposure("CA");
    const threshold = r.nationalAvgPER * 1.05;
    expect(r.statewidePER).toBeGreaterThan(threshold);
  });

  it("Civica cohort PER is below the national average (credibility claim)", () => {
    // The pitch says Civica enrollment produces a lower PER than the state
    // average. If civicaCohortPER ≥ statewidePER, the value prop disappears.
    const r = perExposure("CA");
    expect(r.civicaCohortPER).toBeLessThan(r.statewidePER);
    expect(r.civicaCohortPER).toBeLessThan(r.nationalAvgPER);
  });

  it("always returns demoMode=true until live FNS QC pipeline is wired", () => {
    expect(perExposure("CA").demoMode).toBe(true);
    expect(perExposure("MA").demoMode).toBe(true);
    expect(perExposure("ZZ").demoMode).toBe(true);
  });
});
