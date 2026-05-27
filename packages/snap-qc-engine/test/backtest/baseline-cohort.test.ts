// Lane A — Retrospective Back-test: baseline + full-engagement cohorts.
//
// Falsification harness for the population PER projection. Asserts that the
// shipped engine reproduces the published CA FY2024 baseline (10.98%) when
// no Civica pillars are engaged, and lands at the thesis-projected 5.50%
// when the full Civica stack is engaged at its best-achievable tier.
//
// Source of truth for expected values:
//   - CA_BASELINE_PER (10.98%): USDA FNS-380 FY2024 California row
//     https://fns-prod.azureedge.us/sites/default/files/resource-files/SNAPQC-FY2024.pdf
//   - PROJECTED_PER_AT_FULL_ENGAGEMENT (5.50%): docs/plans/civica-error-reduction-thesis.md §4
//
// If any assertion in this file fails, the engine projection is broken and
// THESIS_CALIBRATION_FACTOR must be recalibrated before any external claim
// using these numbers ships.
//
// Engine is SUT: do NOT modify packages/snap-qc-engine/src/ to satisfy these
// tests. See docs/plans/qc-error-rate-intelligence-redesign.md §3 non-goals.

import { describe, it, expect } from "vitest";
import {
  CA_BASELINE_PER,
  PROJECTED_PER_AT_FULL_ENGAGEMENT,
  computeEngagementImpliedPER,
  computeProjectedPER,
  pillarContribution,
  type PillarCoverage,
} from "../../src/index";

/**
 * Synthetic cohort: zero engagement.
 *
 * Represents a county/household with no Civica integration — what the
 * population PER should be in the un-served baseline state. By construction
 * of the formula (PER = baseline - sum(contributions); contributions = 0 at
 * coverage=0), this MUST equal CA_BASELINE_PER exactly.
 */
const ZERO_ENGAGEMENT: PillarCoverage = {
  utility_sua: 0,
  gig_income: 0,
  shared_lease: 0,
  assets: 0,
  benefit_impact: 0,
};

/**
 * Synthetic cohort: full Civica engagement at best-achievable tier per pillar.
 *
 * Mapping from plan narrative → engine PillarCoverage fields:
 *   - "shelter" pillar (lease OCR + SUA engine, strong tier) → utility_sua: 1.0
 *   - "income" pillar (Argyle payroll wire, strong tier)     → gig_income:  1.0
 *   - "calc" pillar (deterministic CDSS calc engine, strong) → benefit_impact: 1.0
 *   - "sharedLease" at moderate cap (classifier, moderate)   → shared_lease: 1.0
 *       NOTE: the moderate-tier ceiling is already encoded in
 *       PILLAR_MAX_DEFENSIBILITY_SHIFT.shared_lease = 0.56 (weak→moderate),
 *       so coverage = 1.0 means "fully engaged at the moderate-tier
 *       achievable result" — not "moderate engagement." This matches the
 *       per-packet defensibility story documented in error-risk.ts.
 *   - "assets" — no Civica integration, self-reported (shift = 0)
 *       Setting coverage to 0 here is equivalent to 1 (contribution is
 *       always zero). Pinned to 0 to reflect the shipped engineering state.
 *   - "obbba" — no PillarCoverage field exists in the v0.3.0 engine.
 *       OBBBA categorical-eligibility tracking is a future pillar
 *       (see redesign plan §3 + ENG-D7); not in scope for v1 falsification.
 */
const FULL_ENGAGEMENT: PillarCoverage = {
  utility_sua: 1,
  gig_income: 1,
  shared_lease: 1,
  assets: 0,
  benefit_impact: 1,
};

/**
 * Synthetic cohort: partial Civica engagement, used for additivity assertion.
 * Picked to span the shipped pillars at non-degenerate fractions so the
 * additivity check has signal across the formula's full reduction surface.
 */
const PARTIAL_ENGAGEMENT: PillarCoverage = {
  utility_sua: 0.5,
  gig_income: 0.3,
  shared_lease: 0.4,
  assets: 0,
  benefit_impact: 0.6,
};

// Plan §4 Stream A tolerances:
//   baseline cohort: within ±0.5pt of CA_BASELINE_PER
//   full-engagement cohort: within ±0.1pt of PROJECTED_PER_AT_FULL_ENGAGEMENT
const BASELINE_TOLERANCE_PTS = 0.5;
const FULL_ENGAGEMENT_TOLERANCE_PTS = 0.1;

describe("Lane A back-test: baseline cohort (zero engagement)", () => {
  it("computeEngagementImpliedPER at zero engagement is within ±0.5pt of CA_BASELINE_PER", () => {
    const per = computeEngagementImpliedPER(ZERO_ENGAGEMENT);
    expect(Math.abs(per - CA_BASELINE_PER)).toBeLessThanOrEqual(
      BASELINE_TOLERANCE_PTS,
    );
  });

  it("calibration anchor invariant: at zero engagement, projected PER === CA_BASELINE_PER exactly", () => {
    // Stronger assertion than the tolerance check above — the formula must
    // hit baseline exactly when no pillars are engaged. Any drift here means
    // someone added a non-zero floor or constant term to computeProjectedPER.
    expect(computeProjectedPER(ZERO_ENGAGEMENT)).toBe(CA_BASELINE_PER);
  });
});

describe("Lane A back-test: full Civica engagement cohort", () => {
  it("computeEngagementImpliedPER at full engagement is within ±0.1pt of PROJECTED_PER_AT_FULL_ENGAGEMENT", () => {
    const per = computeEngagementImpliedPER(FULL_ENGAGEMENT);
    expect(Math.abs(per - PROJECTED_PER_AT_FULL_ENGAGEMENT)).toBeLessThanOrEqual(
      FULL_ENGAGEMENT_TOLERANCE_PTS,
    );
  });

  it("assets pillar coverage is irrelevant to full-engagement PER (shift=0)", () => {
    // Sanity: assets contribution is 0 regardless of coverage, so toggling
    // assets between 0 and 1 must not move the projected PER. Documents
    // why FULL_ENGAGEMENT pins assets to 0 rather than 1.
    const withAssetsOff = computeEngagementImpliedPER(FULL_ENGAGEMENT);
    const withAssetsOn = computeEngagementImpliedPER({
      ...FULL_ENGAGEMENT,
      assets: 1,
    });
    expect(withAssetsOff).toBe(withAssetsOn);
  });
});

describe("Lane A back-test: partial-engagement additivity", () => {
  // The shipped engine's reduction term is purely linear in per-pillar
  // contributions: computeProjectedPER(c) = CA_BASELINE_PER - Σ pillarContribution(k, c[k]).
  // There is no cross-pillar interaction term, so additivity is EXACT
  // (tolerance = 0). If a non-linear interaction is ever added, this test
  // will catch it and force a deliberate decision about the new term.
  it("sum of per-pillar contributions equals (baseline - joint PER) exactly", () => {
    const jointPer = computeProjectedPER(PARTIAL_ENGAGEMENT);
    const sumOfContributions =
      pillarContribution("utility_sua", PARTIAL_ENGAGEMENT.utility_sua) +
      pillarContribution("gig_income", PARTIAL_ENGAGEMENT.gig_income) +
      pillarContribution("shared_lease", PARTIAL_ENGAGEMENT.shared_lease) +
      pillarContribution("assets", PARTIAL_ENGAGEMENT.assets) +
      pillarContribution("benefit_impact", PARTIAL_ENGAGEMENT.benefit_impact);

    expect(CA_BASELINE_PER - sumOfContributions).toBeCloseTo(jointPer, 10);
  });

  it("additivity holds for the three primary strong-tier pillars (shelter + income + calc)", () => {
    // Narrower form of the additivity check called out in the plan:
    // pillarContribution shelter + income + calc evaluated individually
    // matches the same vector evaluated jointly.
    const coverage: PillarCoverage = {
      utility_sua: 0.7,
      gig_income: 0.6,
      shared_lease: 0,
      assets: 0,
      benefit_impact: 0.8,
    };
    const joint = CA_BASELINE_PER - computeProjectedPER(coverage);
    const individual =
      pillarContribution("utility_sua", 0.7) +
      pillarContribution("gig_income", 0.6) +
      pillarContribution("benefit_impact", 0.8);
    // Exact within float precision because the engine math is linear.
    expect(joint).toBeCloseTo(individual, 10);
  });
});
