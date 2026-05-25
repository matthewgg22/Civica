// Population PER projection tests — added 2026-05-25 for T0 of the
// /qc Error Rate Intelligence redesign (docs/plans/qc-error-rate-intelligence-redesign.md).
//
// Verifies the new exports computeProjectedPER, computeEngagementImpliedPER,
// pillarContribution, and their underlying constants. These are population-level
// PER projections — distinct from the per-packet scoreErrorRisk covered by
// error-risk.golden.test.ts (which is unchanged by T0).

import { describe, it, expect } from "vitest";
import {
  CA_BASELINE_PER,
  PROJECTED_PER_AT_FULL_ENGAGEMENT,
  PILLAR_SHARES_UNNORMALIZED,
  RESIDUAL_FLOOR_SHARE,
  computeProjectedPER,
  computeEngagementImpliedPER,
  pillarContribution,
  type PillarCoverage,
} from "../src/index";

const FULL_COVERAGE: PillarCoverage = {
  utility_sua: 1,
  gig_income: 1,
  shared_lease: 1,
  assets: 1,
  benefit_impact: 1,
};

const ZERO_COVERAGE: PillarCoverage = {
  utility_sua: 0,
  gig_income: 0,
  shared_lease: 0,
  assets: 0,
  benefit_impact: 0,
};

describe("constants", () => {
  it("CA_BASELINE_PER is 10.98 (USDA FNS-380 FY2024 California)", () => {
    expect(CA_BASELINE_PER).toBe(10.98);
  });

  it("PROJECTED_PER_AT_FULL_ENGAGEMENT is 5.5 (thesis §4)", () => {
    expect(PROJECTED_PER_AT_FULL_ENGAGEMENT).toBe(5.5);
  });

  it("PILLAR_SHARES_UNNORMALIZED includes all 5 keys + traces to FNS-380", () => {
    expect(PILLAR_SHARES_UNNORMALIZED).toEqual({
      utility_sua: 0.371,
      gig_income: 0.265,
      shared_lease: 0.073,
      assets: 0.002,
      benefit_impact: 0.039,
    });
  });

  it("PILLAR_SHARES_UNNORMALIZED + RESIDUAL_FLOOR_SHARE sums to 1.0", () => {
    const shareSum =
      PILLAR_SHARES_UNNORMALIZED.utility_sua +
      PILLAR_SHARES_UNNORMALIZED.gig_income +
      PILLAR_SHARES_UNNORMALIZED.shared_lease +
      PILLAR_SHARES_UNNORMALIZED.assets +
      PILLAR_SHARES_UNNORMALIZED.benefit_impact;
    expect(shareSum + RESIDUAL_FLOOR_SHARE).toBeCloseTo(1.0, 10);
  });

  it("RESIDUAL_FLOOR_SHARE matches plan §3.1 (residual is ~25%)", () => {
    expect(RESIDUAL_FLOOR_SHARE).toBeCloseTo(0.25, 2);
  });
});

describe("computeProjectedPER", () => {
  it("at full coverage returns PROJECTED_PER_AT_FULL_ENGAGEMENT (5.5%)", () => {
    expect(computeProjectedPER(FULL_COVERAGE)).toBeCloseTo(5.5, 10);
  });

  it("at zero coverage returns CA_BASELINE_PER (10.98%)", () => {
    expect(computeProjectedPER(ZERO_COVERAGE)).toBeCloseTo(10.98, 10);
  });

  it("at half coverage returns value between baseline and projected", () => {
    const halfCoverage: PillarCoverage = {
      utility_sua: 0.5,
      gig_income: 0.5,
      shared_lease: 0.5,
      assets: 0.5,
      benefit_impact: 0.5,
    };
    const per = computeProjectedPER(halfCoverage);
    expect(per).toBeLessThan(CA_BASELINE_PER);
    expect(per).toBeGreaterThan(PROJECTED_PER_AT_FULL_ENGAGEMENT);
    // Half coverage → half reduction → 10.98 - 2.74 = 8.24
    expect(per).toBeCloseTo((CA_BASELINE_PER + PROJECTED_PER_AT_FULL_ENGAGEMENT) / 2, 1);
  });

  it("monotonically decreases as a single pillar's engagement increases", () => {
    const base: PillarCoverage = { ...ZERO_COVERAGE };
    const at0 = computeProjectedPER(base);
    const at50 = computeProjectedPER({ ...base, utility_sua: 0.5 });
    const at100 = computeProjectedPER({ ...base, utility_sua: 1.0 });
    expect(at0).toBeGreaterThan(at50);
    expect(at50).toBeGreaterThan(at100);
  });
});

describe("computeEngagementImpliedPER (same math, intent-distinguishing name)", () => {
  it("matches computeProjectedPER bit-for-bit at the same coverage", () => {
    const coverage: PillarCoverage = {
      utility_sua: 0.42,
      gig_income: 0.18,
      shared_lease: 0,
      assets: 0,
      benefit_impact: 1.0,
    };
    expect(computeEngagementImpliedPER(coverage)).toBe(
      computeProjectedPER(coverage),
    );
  });
});

describe("pillarContribution", () => {
  it("at full engagement, all 5 pillar contributions sum to baseline - projected (~5.48 pts)", () => {
    const sum =
      pillarContribution("utility_sua", 1) +
      pillarContribution("gig_income", 1) +
      pillarContribution("shared_lease", 1) +
      pillarContribution("assets", 1) +
      pillarContribution("benefit_impact", 1);
    expect(sum).toBeCloseTo(CA_BASELINE_PER - PROJECTED_PER_AT_FULL_ENGAGEMENT, 10);
    expect(sum).toBeCloseTo(5.48, 2);
  });

  it("pillar with larger share contributes more at the same engagement", () => {
    const shelter = pillarContribution("utility_sua", 1);
    const gig = pillarContribution("gig_income", 1);
    const lease = pillarContribution("shared_lease", 1);
    expect(shelter).toBeGreaterThan(gig);
    expect(gig).toBeGreaterThan(lease);
  });

  it("at zero engagement, contribution is zero", () => {
    expect(pillarContribution("utility_sua", 0)).toBe(0);
    expect(pillarContribution("gig_income", 0)).toBe(0);
  });

  it("scales linearly with engagement", () => {
    const at50 = pillarContribution("utility_sua", 0.5);
    const at100 = pillarContribution("utility_sua", 1.0);
    expect(at100).toBeCloseTo(at50 * 2, 10);
  });
});

describe("CQ2 defensive boundaries — clamp [0,1], NaN to 0", () => {
  it("NaN engagement coerces to 0 (no-coverage)", () => {
    const coverage: PillarCoverage = {
      utility_sua: NaN,
      gig_income: NaN,
      shared_lease: NaN,
      assets: NaN,
      benefit_impact: NaN,
    };
    // Matches zero coverage = baseline PER
    expect(computeProjectedPER(coverage)).toBeCloseTo(CA_BASELINE_PER, 10);
  });

  it("Infinity engagement coerces to 0", () => {
    const coverage: PillarCoverage = {
      utility_sua: Infinity,
      gig_income: Infinity,
      shared_lease: Infinity,
      assets: Infinity,
      benefit_impact: Infinity,
    };
    expect(computeProjectedPER(coverage)).toBeCloseTo(CA_BASELINE_PER, 10);
  });

  it("negative engagement clamps to 0", () => {
    const coverage: PillarCoverage = {
      utility_sua: -0.5,
      gig_income: -1,
      shared_lease: -100,
      assets: -0.001,
      benefit_impact: -2,
    };
    expect(computeProjectedPER(coverage)).toBeCloseTo(CA_BASELINE_PER, 10);
  });

  it("engagement > 1 clamps to 1", () => {
    const overCoverage: PillarCoverage = {
      utility_sua: 1.5,
      gig_income: 2,
      shared_lease: 100,
      assets: 1.001,
      benefit_impact: 5,
    };
    // Same as full coverage
    expect(computeProjectedPER(overCoverage)).toBeCloseTo(PROJECTED_PER_AT_FULL_ENGAGEMENT, 10);
  });

  it("mixed invalid inputs all coerce/clamp predictably", () => {
    const coverage: PillarCoverage = {
      utility_sua: NaN,
      gig_income: 1.5, // clamps to 1
      shared_lease: -0.3, // clamps to 0
      assets: Infinity, // coerces to 0
      benefit_impact: 1.0,
    };
    const expectedEquiv: PillarCoverage = {
      utility_sua: 0,
      gig_income: 1,
      shared_lease: 0,
      assets: 0,
      benefit_impact: 1,
    };
    expect(computeProjectedPER(coverage)).toBeCloseTo(
      computeProjectedPER(expectedEquiv),
      10,
    );
  });

  it("never returns NaN regardless of input", () => {
    const coverage: PillarCoverage = {
      utility_sua: NaN,
      gig_income: NaN,
      shared_lease: NaN,
      assets: NaN,
      benefit_impact: NaN,
    };
    const per = computeProjectedPER(coverage);
    expect(Number.isFinite(per)).toBe(true);
    expect(Number.isNaN(per)).toBe(false);
  });
});

describe("typescript shape distinction (A4) — compile-time check", () => {
  // This test exists as documentation; the real check is at compile time —
  // passing ScoringInput[] to computeProjectedPER would fail tsc.
  it("PillarCoverage is a struct with named keys, not an array", () => {
    const coverage: PillarCoverage = {
      utility_sua: 0.5,
      gig_income: 0.3,
      shared_lease: 0,
      assets: 0,
      benefit_impact: 1,
    };
    expect(typeof coverage.utility_sua).toBe("number");
    expect(Array.isArray(coverage)).toBe(false);
  });
});
