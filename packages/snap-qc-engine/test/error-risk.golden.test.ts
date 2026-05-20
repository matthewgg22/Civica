import { describe, expect, it } from "vitest";
import { scoreErrorRisk, ENGINE_VERSION } from "../src/index";
import type { ErrorRiskResult } from "../src/scoring/error-risk";
import type { Defensibility, FlowKind } from "../src/schemas";

// Frozen golden fixtures for scoreErrorRisk().
// Scores are computed from USDA CA FY2023 ERROR_WEIGHT constants + DEFENSIBILITY_ERROR_PROB.
// Recalibrated 2026-05-20: weights updated from real CA FY2023 element attribution data
//   (ca_fy2023_element_attribution.csv). Key changes: assets 0.082→0.002 (near-zero in CA
//   QC data), gig-income 0.268→0.354 (added SE income element 312), utility-sua 0.505→0.495.
// Any further change that shifts a score requires an intentional fixture update + PR comment.
// ENGINE_VERSION major bump requires full re-authoring of all fixtures.

type FlowResult = { flow: FlowKind; defensibility_score: Defensibility };

const FIXTURES: Array<{
  id: string;
  input: FlowResult[];
  expected: ErrorRiskResult;
}> = [
  {
    id: "ca-low-01-all-strong",
    // 5 flows, all API-verified: minimal QC citation risk
    input: [
      { flow: "utility-sua", defensibility_score: "strong" },
      { flow: "gig-income", defensibility_score: "strong" },
      { flow: "shared-lease", defensibility_score: "strong" },
      { flow: "assets", defensibility_score: "strong" },
      { flow: "benefit-impact-projection", defensibility_score: "strong" },
    ],
    expected: { tier: "low", score: 5, factors: [], engine_version: ENGINE_VERSION },
  },
  {
    id: "ca-low-02-single-flow-strong",
    // Only utility evaluated (packet still in progress); strong → low risk so far
    input: [{ flow: "utility-sua", defensibility_score: "strong" }],
    expected: { tier: "low", score: 5, factors: [], engine_version: ENGINE_VERSION },
  },
  {
    id: "ca-medium-01-utility-weak-rest-strong",
    // Shelter/utility self-declared; highest CA weight (0.495) drives score to 42
    input: [
      { flow: "utility-sua", defensibility_score: "weak" },
      { flow: "gig-income", defensibility_score: "strong" },
      { flow: "shared-lease", defensibility_score: "strong" },
      { flow: "assets", defensibility_score: "strong" },
      { flow: "benefit-impact-projection", defensibility_score: "strong" },
    ],
    expected: {
      tier: "medium",
      score: 42,
      factors: ["shelter_utility_unverified"],
      engine_version: ENGINE_VERSION,
    },
  },
  {
    id: "ca-medium-02-gig-weak-rest-strong",
    // Income self-declared; gig-income weight raised to 0.354 (now includes SE element 312)
    // Score 32 — solidly medium (was a boundary 25 under the prior placeholder weight)
    input: [
      { flow: "utility-sua", defensibility_score: "strong" },
      { flow: "gig-income", defensibility_score: "weak" },
      { flow: "shared-lease", defensibility_score: "strong" },
      { flow: "assets", defensibility_score: "strong" },
      { flow: "benefit-impact-projection", defensibility_score: "strong" },
    ],
    expected: {
      tier: "medium",
      score: 32,
      factors: ["earned_income_unverified"],
      engine_version: ENGINE_VERSION,
    },
  },
  {
    id: "ca-high-01-utility-and-gig-weak",
    // Two top-weight flows weak (utility 0.495 + gig 0.354 = 0.849 of risk budget)
    // Score 69 — was 63 under prior weights; increase reflects gig-income weight
    // correction (SE income element 312 added, assets weight corrected to near-zero)
    input: [
      { flow: "utility-sua", defensibility_score: "weak" },
      { flow: "gig-income", defensibility_score: "weak" },
      { flow: "shared-lease", defensibility_score: "strong" },
      { flow: "assets", defensibility_score: "strong" },
      { flow: "benefit-impact-projection", defensibility_score: "strong" },
    ],
    expected: {
      tier: "high",
      score: 69,
      factors: ["shelter_utility_unverified", "earned_income_unverified"],
      engine_version: ENGINE_VERSION,
    },
  },
  {
    id: "ca-high-02-all-weak",
    // Worst-case packet: all flows self-declared / unverified
    // factors capped at 3, sorted by USDA weight DESC
    input: [
      { flow: "utility-sua", defensibility_score: "weak" },
      { flow: "gig-income", defensibility_score: "weak" },
      { flow: "shared-lease", defensibility_score: "weak" },
      { flow: "assets", defensibility_score: "weak" },
      { flow: "benefit-impact-projection", defensibility_score: "weak" },
    ],
    expected: {
      tier: "high",
      score: 80,
      factors: [
        "shelter_utility_unverified",
        "earned_income_unverified",
        "shelter_cost_unverifiable",
      ],
      engine_version: ENGINE_VERSION,
    },
  },
  {
    id: "ca-incomplete-01-no-flows",
    // No flows evaluated yet — packet in progress; must not show a red badge
    input: [],
    expected: { tier: "incomplete", score: null, factors: [], engine_version: ENGINE_VERSION },
  },
];

describe("scoreErrorRisk golden fixtures", () => {
  it("has at least 6 fixtures (coverage: all tiers including incomplete)", () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(6);
  });

  it("covers all four tiers", () => {
    const tiers = new Set(FIXTURES.map((f) => f.expected.tier));
    expect(tiers).toContain("high");
    expect(tiers).toContain("medium");
    expect(tiers).toContain("low");
    expect(tiers).toContain("incomplete");
  });
});

describe.each(FIXTURES.map((f) => [f.id, f] as const))(
  "scoreErrorRisk golden: %s",
  (_id, fixture) => {
    it("returns frozen score, tier, and factors", () => {
      const actual = scoreErrorRisk(fixture.input);
      expect(actual.tier).toBe(fixture.expected.tier);
      expect(actual.score).toBe(fixture.expected.score);
      expect(actual.factors).toEqual(fixture.expected.factors);
    });

    it("engine_version matches ENGINE_VERSION constant", () => {
      const actual = scoreErrorRisk(fixture.input);
      const [expectMajor] = fixture.expected.engine_version.split(".");
      const [actualMajor] = actual.engine_version.split(".");
      expect(actualMajor).toBe(expectMajor);
    });
  },
);
