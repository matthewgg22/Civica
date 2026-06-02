// State-keyed engine constants tests — added 2026-06-01 for MA pilot rollout.
//
// Verifies the new MA_* constants + STATE_CONSTANTS registry + *ForState
// functions. The CA-default functions (pillarContribution, computeProjectedPER,
// etc.) remain covered by population-per.test.ts; this file covers the
// state-aware variants and the parity guarantee that state="CA" gives the same
// result as the legacy unparameterized API.

import { describe, it, expect } from "vitest";
import {
  CA_BASELINE_PER,
  CA_BASELINE_FISCAL_YEAR,
  MA_BASELINE_PER,
  MA_BASELINE_FISCAL_YEAR,
  MA_INCOME_GROUP_PER_FY23,
  MA_ELEMENT_ATTRIBUTION_FY23,
  STATE_CONSTANTS,
  computeProjectedPER,
  computeProjectedPERForState,
  computeEngagementImpliedPERForState,
  pillarContribution,
  pillarContributionForState,
  perPacketGapContributionForState,
  PROJECTED_PER_AT_FULL_ENGAGEMENT,
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

describe("STATE_CONSTANTS registry", () => {
  it("includes CA and MA", () => {
    expect(STATE_CONSTANTS.CA.stateCode).toBe("CA");
    expect(STATE_CONSTANTS.MA.stateCode).toBe("MA");
  });

  it("CA baselinePer matches CA_BASELINE_PER constant", () => {
    expect(STATE_CONSTANTS.CA.baselinePer).toBe(CA_BASELINE_PER);
    expect(STATE_CONSTANTS.CA.baselineFiscalYear).toBe(CA_BASELINE_FISCAL_YEAR);
  });

  it("MA baselinePer is the FNS-380 FY2024 MA published rate", () => {
    expect(MA_BASELINE_PER).toBe(14.10);
    expect(MA_BASELINE_FISCAL_YEAR).toBe(2024);
    expect(STATE_CONSTANTS.MA.baselinePer).toBe(MA_BASELINE_PER);
  });

  it("MA baseline is higher than CA baseline (the FY24 published direction)", () => {
    expect(MA_BASELINE_PER).toBeGreaterThan(CA_BASELINE_PER);
  });
});

describe("MA_INCOME_GROUP_PER_FY23", () => {
  it("captures the earned-any / no-earned split from QC microdata", () => {
    expect(MA_INCOME_GROUP_PER_FY23.earned_any).toBeCloseTo(15.24, 2);
    expect(MA_INCOME_GROUP_PER_FY23.no_earned).toBeCloseTo(5.38, 2);
    expect(MA_INCOME_GROUP_PER_FY23.total).toBeCloseTo(7.76, 2);
  });
});

describe("MA_ELEMENT_ATTRIBUTION_FY23", () => {
  it("shelter + wages dominate (~62% combined)", () => {
    const shelter = MA_ELEMENT_ATTRIBUTION_FY23["363"].share_pct;
    const wages = MA_ELEMENT_ATTRIBUTION_FY23["311"].share_pct;
    expect(shelter + wages).toBeGreaterThan(60);
    expect(shelter + wages).toBeLessThan(65);
  });

  it("medical-deduction over-indexes vs CA (the MA pilot pitch headline)", () => {
    expect(MA_ELEMENT_ATTRIBUTION_FY23["365"].share_pct).toBeGreaterThan(8);
  });
});

describe("computeProjectedPERForState parity", () => {
  it("state=CA matches the legacy CA-default function", () => {
    expect(computeProjectedPERForState(FULL_COVERAGE, "CA")).toBeCloseTo(
      computeProjectedPER(FULL_COVERAGE),
      6,
    );
    expect(computeProjectedPERForState(ZERO_COVERAGE, "CA")).toBeCloseTo(
      computeProjectedPER(ZERO_COVERAGE),
      6,
    );
  });

  it("default state arg is CA", () => {
    expect(computeProjectedPERForState(FULL_COVERAGE)).toBeCloseTo(
      computeProjectedPER(FULL_COVERAGE),
      6,
    );
  });
});

describe("computeProjectedPERForState — MA", () => {
  it("zero coverage returns the MA baseline (14.10)", () => {
    expect(computeProjectedPERForState(ZERO_COVERAGE, "MA")).toBeCloseTo(MA_BASELINE_PER, 6);
  });

  it("full coverage produces a meaningful reduction (~50% off baseline)", () => {
    const projected = computeProjectedPERForState(FULL_COVERAGE, "MA");
    // Same fractional reduction as CA (~50%) applied to MA's higher baseline → ~7.06%.
    expect(projected).toBeGreaterThan(6);
    expect(projected).toBeLessThan(8);
  });

  it("MA at full coverage is higher than CA at full coverage (higher baseline)", () => {
    const maProjected = computeProjectedPERForState(FULL_COVERAGE, "MA");
    const caProjected = computeProjectedPER(FULL_COVERAGE);
    expect(maProjected).toBeGreaterThan(caProjected);
    expect(caProjected).toBeCloseTo(PROJECTED_PER_AT_FULL_ENGAGEMENT, 6);
  });

  it("computeEngagementImpliedPERForState mirrors computeProjectedPERForState", () => {
    expect(computeEngagementImpliedPERForState(FULL_COVERAGE, "MA")).toBeCloseTo(
      computeProjectedPERForState(FULL_COVERAGE, "MA"),
      6,
    );
  });
});

describe("pillarContributionForState", () => {
  it("state=CA matches legacy pillarContribution", () => {
    for (const pillar of ["utility_sua", "gig_income", "shared_lease", "assets", "benefit_impact"] as const) {
      expect(pillarContributionForState(pillar, 1.0, "CA")).toBeCloseTo(
        pillarContribution(pillar, 1.0),
        6,
      );
    }
  });

  it("MA contributions sum to ~MA baseline-projected gap", () => {
    let sum = 0;
    for (const pillar of ["utility_sua", "gig_income", "shared_lease", "assets", "benefit_impact"] as const) {
      sum += pillarContributionForState(pillar, 1.0, "MA");
    }
    const projected = computeProjectedPERForState(FULL_COVERAGE, "MA");
    expect(MA_BASELINE_PER - projected).toBeCloseTo(sum, 6);
  });

  it("engagement is clamped to [0, 1]", () => {
    expect(pillarContributionForState("gig_income", -1, "MA")).toBe(0);
    expect(pillarContributionForState("gig_income", 1.5, "MA")).toBeCloseTo(
      pillarContributionForState("gig_income", 1.0, "MA"),
      6,
    );
  });
});

describe("perPacketGapContributionForState", () => {
  it("returns null for null score", () => {
    expect(perPacketGapContributionForState(null, "MA")).toBeNull();
  });

  it("scales by state baseline", () => {
    // At score=80 (the ceiling), gap = baseline - projected.
    const caCeil = perPacketGapContributionForState(80, "CA")!;
    const maCeil = perPacketGapContributionForState(80, "MA")!;
    expect(maCeil).toBeGreaterThan(caCeil); // MA baseline > CA → bigger gap
  });

  it("clamps out-of-range scores", () => {
    expect(perPacketGapContributionForState(0, "MA")).toBeCloseTo(0, 6);
    expect(perPacketGapContributionForState(200, "MA")).toBeCloseTo(
      perPacketGapContributionForState(80, "MA")!,
      6,
    );
  });
});
