import { describe, it, expect } from "vitest";
import {
  perExposure,
  tierShare,
  NATIONAL_AVG_PER,
  OPERATIONAL_SHARE,
} from "../section10105";

// ---------------------------------------------------------------------------
// §10105 is now grounded in REAL FY2024 data (FNS QC PER + FNS issuance).
// These tests lock the real numbers + the corrected interpretation.
// ---------------------------------------------------------------------------

describe("perExposure — real CA §10105 exposure", () => {
  const r = perExposure("CA");

  it("uses the real FY2024 PER + national average (not the 10.8 / 8.6 demo)", () => {
    expect(r.statewidePER).toBe(10.98);
    expect(r.nationalAvgPER).toBe(10.93);
    expect(NATIONAL_AVG_PER).toBe(10.93);
  });

  it("puts CA in the top absolute tier (≥10% → 15% benefit-cost share)", () => {
    expect(r.currentTierSharePct).toBe(15);
    expect(tierShare(10.98)).toBe(15);
  });

  it("computes exposure from real issuance × tier share (~$1.83B)", () => {
    expect(r.fy24IssuanceUsd).toBeGreaterThan(12_000_000_000);
    expect(r.penaltyExposureDollars).toBeGreaterThan(1_800_000_000);
    expect(r.penaltyExposureDollars).toBeLessThan(1_870_000_000);
  });

  // THE CORRECTION: the prior demo's pitch rested on "CA PER ≥ 105% of the
  // national average." Real data falsifies that — CA (10.98) is at the median
  // (national 10.93). The wedge is the ABSOLUTE tier, not a relative outlier.
  it("CA is NOT a relative-to-national outlier (the demo's premise was wrong)", () => {
    expect(r.isRelativeOutlier).toBe(false);
    expect(r.relativeToNational).toBeCloseTo(1.005, 2);
  });

  it("the first tier crossing (15%→10%) needs ~1pp and saves ~$0.6B", () => {
    expect(r.nextTierCrossing).not.toBeNull();
    expect(r.nextTierCrossing!.requiredReductionPP).toBeCloseTo(0.98, 2);
    expect(r.nextTierCrossing!.sharePctAfter).toBe(10);
    expect(r.nextTierCrossing!.dollarsSaved).toBeGreaterThan(600_000_000);
    expect(r.nextTierCrossing!.dollarsSaved).toBeLessThan(615_000_000);
    // 0.98pp is well within CA's ~7.1pp operationally-addressable headroom.
    expect(r.nextTierCrossing!.achievableWithinOperationalHeadroom).toBe(true);
  });

  it("decomposes into a Civica-addressable headroom + an irreducible client floor", () => {
    expect(r.operationalHeadroomPP).toBeCloseTo(7.14, 1);
    expect(r.clientFloorPER).toBeCloseTo(3.84, 1);
    // headroom + floor reconstruct the statewide PER.
    expect(r.operationalHeadroomPP + r.clientFloorPER).toBeCloseTo(r.statewidePER, 1);
    expect(OPERATIONAL_SHARE).toBe(0.65);
  });

  it("civicaCohortPER is the honest floor — below statewide and national", () => {
    // No longer a fabricated 4.2; it's the client-error floor (modeled ceiling).
    expect(r.civicaCohortPER).toBeLessThan(r.statewidePER);
    expect(r.civicaCohortPER).toBeLessThan(r.nationalAvgPER);
    expect(r.civicaCohortPER).toBe(r.clientFloorPER);
  });

  it("flags real inputs but a statutory tier assumption", () => {
    expect(r.demoMode).toBe(false);
    expect(r.statutoryAssumption).toBe(true);
  });
});

describe("perExposure — other states + fallback", () => {
  it("computes a real exposure for a different state (MA)", () => {
    const r = perExposure("MA");
    expect(r.stateCode).toBe("MA");
    expect(r.statewidePER).toBeGreaterThan(0);
    expect(Number.isFinite(r.penaltyExposureDollars)).toBe(true);
  });

  // Preserves the prior contract: an unknown code never renders NaN/undefined.
  it("falls back to CA on an unknown code (no NaN, no undefined)", () => {
    const r = perExposure("ZZ");
    expect(r.stateCode).toBe("ZZ");
    expect(Number.isFinite(r.penaltyExposureDollars)).toBe(true);
    expect(Number.isFinite(r.statewidePER)).toBe(true);
    expect(r.statewidePER).toBe(10.98); // CA's real PER
  });
});

describe("tierShare schedule", () => {
  it("maps absolute PER to the statutory band", () => {
    expect(tierShare(5.9)).toBe(0);
    expect(tierShare(7)).toBe(5);
    expect(tierShare(9)).toBe(10);
    expect(tierShare(10.98)).toBe(15);
  });
});
