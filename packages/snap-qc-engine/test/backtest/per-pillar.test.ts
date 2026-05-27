// Lane A — Retrospective Back-test: per-pillar properties.
//
// Pins three structural invariants of the population PER formula:
//   1. Per-pillar contribution bounds — no pillar can ever exceed its
//      PILLAR_MAX_DEFENSIBILITY_SHIFT-derived theoretical cap.
//   2. Monotonicity — increasing any single pillar's coverage never
//      increases projected PER.
//   3. Calibration anchor — at zero engagement, projected PER === baseline.
//
// These are properties of the formula, not the projection target. They
// guard against accidental engine refactors that would silently make the
// projection non-monotonic or break the anchor invariant.
//
// Engine is SUT: do NOT modify packages/snap-qc-engine/src/ to satisfy
// these tests.

import { describe, it, expect } from "vitest";
import {
  CA_BASELINE_PER,
  PILLAR_SHARES_UNNORMALIZED,
  PILLAR_MAX_DEFENSIBILITY_SHIFT,
  computeProjectedPER,
  pillarContribution,
  type PillarCoverage,
} from "../../src/index";

const PILLARS = [
  "utility_sua",
  "gig_income",
  "shared_lease",
  "assets",
  "benefit_impact",
] as const satisfies readonly (keyof PillarCoverage)[];

const ZERO_COVERAGE: PillarCoverage = {
  utility_sua: 0,
  gig_income: 0,
  shared_lease: 0,
  assets: 0,
  benefit_impact: 0,
};

/**
 * Theoretical cap on a single pillar's contribution in percentage points,
 * before the THESIS_CALIBRATION_FACTOR haircut is applied:
 *
 *   cap(pillar) = CA_BASELINE_PER × share × max_defensibility_shift
 *
 * The engine's actual contribution at full engagement is cap × calibration
 * (≈ 0.912 × cap), so it MUST always sit at or below the cap. The cap is
 * the falsification ceiling — a contribution exceeding its cap means the
 * formula has drifted past what FNS-380 + defensibility tiers can support.
 */
function pillarCap(pillar: keyof PillarCoverage): number {
  return (
    CA_BASELINE_PER *
    PILLAR_SHARES_UNNORMALIZED[pillar] *
    PILLAR_MAX_DEFENSIBILITY_SHIFT[pillar]
  );
}

describe("Lane A back-test: per-pillar contribution bounds", () => {
  for (const pillar of PILLARS) {
    it(`${pillar} contribution at full engagement does not exceed its PILLAR_MAX_DEFENSIBILITY_SHIFT cap`, () => {
      const contribution = pillarContribution(pillar, 1);
      const cap = pillarCap(pillar);
      // Tiny epsilon to absorb float rounding; the real assertion is "≤ cap".
      expect(contribution).toBeLessThanOrEqual(cap + 1e-12);
    });
  }

  it("sum of all pillar contributions at full engagement equals baseline - projected exactly", () => {
    // Anchors the calibration factor: the sum of caps × calibration must
    // equal the published reduction (5.48 pts). This is the calibration
    // identity the engine was built to satisfy.
    const sum = PILLARS.reduce(
      (acc, p) => acc + pillarContribution(p, 1),
      0,
    );
    // CA_BASELINE_PER - PROJECTED_PER_AT_FULL_ENGAGEMENT = 5.48
    expect(sum).toBeCloseTo(CA_BASELINE_PER - 5.5, 10);
  });
});

describe("Lane A back-test: monotonicity", () => {
  for (const pillar of PILLARS) {
    it(`increasing ${pillar} coverage from 0 → 1 monotonically decreases projected PER`, () => {
      const steps = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];
      const pers = steps.map((s) =>
        computeProjectedPER({ ...ZERO_COVERAGE, [pillar]: s }),
      );
      // Each successive PER must be ≤ the previous one (non-increasing).
      // For the `assets` pillar (shift=0), all values are equal — that's
      // still non-increasing, so the same loop covers both cases.
      for (let i = 1; i < pers.length; i++) {
        expect(pers[i]).toBeLessThanOrEqual(pers[i - 1] + 1e-12);
      }
    });
  }

  it("increasing any pillar coverage with all others held at 0.5 still never increases PER", () => {
    // Cross-check: monotonicity holds in the interior of the coverage cube,
    // not just along the axis from the origin. The math is linear so this
    // is implied by the per-axis test, but pin it explicitly to catch any
    // future non-linear refactor.
    const halfCoverage: PillarCoverage = {
      utility_sua: 0.5,
      gig_income: 0.5,
      shared_lease: 0.5,
      assets: 0.5,
      benefit_impact: 0.5,
    };
    for (const pillar of PILLARS) {
      const at0 = computeProjectedPER({ ...halfCoverage, [pillar]: 0 });
      const at1 = computeProjectedPER({ ...halfCoverage, [pillar]: 1 });
      expect(at1).toBeLessThanOrEqual(at0 + 1e-12);
    }
  });
});

describe("Lane A back-test: calibration anchor invariant", () => {
  it("at zero engagement, projected PER === CA_BASELINE_PER exactly", () => {
    expect(computeProjectedPER(ZERO_COVERAGE)).toBe(CA_BASELINE_PER);
  });

  it("at zero engagement, every pillar's contribution is exactly 0", () => {
    for (const pillar of PILLARS) {
      expect(pillarContribution(pillar, 0)).toBe(0);
    }
  });
});
