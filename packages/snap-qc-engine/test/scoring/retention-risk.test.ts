import { describe, it, expect } from "vitest";
import {
  scoreRetentionRisk,
  type RetentionRiskInput,
} from "../../src/scoring/retention-risk";

// ---------------------------------------------------------------------------
// Fixtures — a "stable, eligible, low-risk" household as the canonical base.
// Each test overrides only the fields under examination.
// ---------------------------------------------------------------------------

const baseEligibleHousehold: RetentionRiskInput = {
  monthly_earned_income_usd: 0,
  monthly_benefit_amount_usd: 400,
  household_has_children: true,
  days_to_next_reporting: 60,
  prior_recert_outcomes: ["completed"],
  earnings_trajectory: "stable",
  currently_eligible_per_rules: true,
};

// ---------------------------------------------------------------------------
// 1. No-reporting-window short-circuit
// ---------------------------------------------------------------------------

describe("scoreRetentionRisk — no reporting window", () => {
  it("returns no-reporting-window tier and null score when no SAR7 scheduled", () => {
    const result = scoreRetentionRisk({
      ...baseEligibleHousehold,
      days_to_next_reporting: null,
    });
    expect(result.tier).toBe("no-reporting-window");
    expect(result.score).toBeNull();
    expect(result.would_be_type_1_error_if_exits).toBe(false);
    expect(result.top_signals).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Calibration anchors (Unrath §4.4)
// ---------------------------------------------------------------------------

describe("scoreRetentionRisk — calibration to Unrath baselines", () => {
  it("a zero-earnings, no-kids, low-benefit case AT a reporting moment scores near 11% (paper baseline)", () => {
    // Strip kids dampener + benefit dampener to isolate the base rate.
    const result = scoreRetentionRisk({
      ...baseEligibleHousehold,
      household_has_children: false,
      monthly_benefit_amount_usd: 40, // below the dampener floor
      monthly_earned_income_usd: 0,
      days_to_next_reporting: 5, // in the reporting moment
      earnings_trajectory: "stable",
      prior_recert_outcomes: [],
    });
    // Paper §4.4: "the baseline exit rate in reporting months is 11 percent
    // for cases with no earned income."
    expect(result.score).toBe(11);
    expect(result.tier).toBe("low");
  });

  it("each +$500 in earnings adds ~3-4pp at the reporting moment", () => {
    const at0 = scoreRetentionRisk({
      ...baseEligibleHousehold,
      household_has_children: false,
      monthly_benefit_amount_usd: 40,
      monthly_earned_income_usd: 0,
      days_to_next_reporting: 5,
      earnings_trajectory: "stable",
      prior_recert_outcomes: [],
    });
    const at500 = scoreRetentionRisk({
      ...baseEligibleHousehold,
      household_has_children: false,
      monthly_benefit_amount_usd: 40,
      monthly_earned_income_usd: 500,
      days_to_next_reporting: 5,
      earnings_trajectory: "stable",
      prior_recert_outcomes: [],
    });
    const delta = (at500.score ?? 0) - (at0.score ?? 0);
    expect(delta).toBeGreaterThanOrEqual(3);
    expect(delta).toBeLessThanOrEqual(4);
  });

  it("benefit >$500 households score materially lower than <$50 households (Unrath: ~25pp gap)", () => {
    const lowBenefit = scoreRetentionRisk({
      ...baseEligibleHousehold,
      household_has_children: false,
      monthly_benefit_amount_usd: 40,
      monthly_earned_income_usd: 0,
      days_to_next_reporting: 5,
      earnings_trajectory: "stable",
      prior_recert_outcomes: [],
    });
    const highBenefit = scoreRetentionRisk({
      ...baseEligibleHousehold,
      household_has_children: false,
      monthly_benefit_amount_usd: 550,
      monthly_earned_income_usd: 0,
      days_to_next_reporting: 5,
      earnings_trajectory: "stable",
      prior_recert_outcomes: [],
    });
    const gap = (lowBenefit.score ?? 0) - (highBenefit.score ?? 0);
    // Allow some tolerance — calibration is approximate, not exact.
    expect(gap).toBeGreaterThanOrEqual(8);
    expect(gap).toBeLessThanOrEqual(25);
  });
});

// ---------------------------------------------------------------------------
// 3. Profile shapes — high-risk and low-risk archetypes
// ---------------------------------------------------------------------------

describe("scoreRetentionRisk — household profiles", () => {
  it("Unrath's 'advantaged exiter' profile (high earnings, low benefit, no kids, rising income) scores high", () => {
    const result = scoreRetentionRisk({
      monthly_earned_income_usd: 2000,
      monthly_benefit_amount_usd: 40,
      household_has_children: false,
      days_to_next_reporting: 5,
      prior_recert_outcomes: ["completed"],
      earnings_trajectory: "rising",
      currently_eligible_per_rules: true,
    });
    expect(result.tier).toBe("high");
    // Unrath: "advantaged exiter" hazard ≈ 25-35% at the reporting moment.
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.top_signals).toContain("earnings_above_threshold");
  });

  it("the 'stable family' profile (kids, no earnings, decent benefit, stable) scores low even at reporting moment", () => {
    const result = scoreRetentionRisk({
      monthly_earned_income_usd: 0,
      monthly_benefit_amount_usd: 550,
      household_has_children: true,
      days_to_next_reporting: 5,
      prior_recert_outcomes: ["completed", "completed"],
      earnings_trajectory: "stable",
      currently_eligible_per_rules: true,
    });
    expect(result.tier).toBe("low");
    expect(result.top_signals).toContain("household_with_children_retains");
    expect(result.top_signals).toContain("high_benefit_amount_retains");
  });
});

// ---------------------------------------------------------------------------
// 4. Type-1 error surface (Unrath C2 — the central finding)
// ---------------------------------------------------------------------------

describe("scoreRetentionRisk — would_be_type_1_error_if_exits", () => {
  it("flags type-1 error when caller marks household eligible AND risk is at least medium", () => {
    const result = scoreRetentionRisk({
      monthly_earned_income_usd: 1500,
      monthly_benefit_amount_usd: 40,
      household_has_children: false,
      days_to_next_reporting: 5,
      prior_recert_outcomes: [],
      earnings_trajectory: "stable",
      currently_eligible_per_rules: true,
    });
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.would_be_type_1_error_if_exits).toBe(true);
  });

  it("does NOT flag type-1 error when caller marks household ineligible (intended exit)", () => {
    const result = scoreRetentionRisk({
      monthly_earned_income_usd: 1500,
      monthly_benefit_amount_usd: 40,
      household_has_children: false,
      days_to_next_reporting: 5,
      prior_recert_outcomes: [],
      earnings_trajectory: "stable",
      currently_eligible_per_rules: false,
    });
    expect(result.would_be_type_1_error_if_exits).toBe(false);
  });

  it("does NOT flag type-1 error when risk is low, even if household is eligible", () => {
    const result = scoreRetentionRisk(baseEligibleHousehold);
    expect(result.tier).toBe("low");
    expect(result.would_be_type_1_error_if_exits).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Reporting-window scaling (Unrath C1 — exits cluster at reporting)
// ---------------------------------------------------------------------------

describe("scoreRetentionRisk — reporting window scaling", () => {
  const profile = (days: number): RetentionRiskInput => ({
    monthly_earned_income_usd: 2000,
    monthly_benefit_amount_usd: 40,
    household_has_children: false,
    days_to_next_reporting: days,
    prior_recert_outcomes: ["churned_and_returned"],
    earnings_trajectory: "rising",
    currently_eligible_per_rules: true,
  });

  it("imminent reporting (≤7d) > approaching (≤30d) > mid (≤90d) > ambient (>90d)", () => {
    const imminent = scoreRetentionRisk(profile(5));
    const approaching = scoreRetentionRisk(profile(20));
    const mid = scoreRetentionRisk(profile(60));
    const ambient = scoreRetentionRisk(profile(180));
    expect(imminent.score ?? 0).toBeGreaterThan(approaching.score ?? 0);
    expect(approaching.score ?? 0).toBeGreaterThan(mid.score ?? 0);
    expect(mid.score ?? 0).toBeGreaterThan(ambient.score ?? 0);
  });

  it("a profile that scores high at reporting moment can score low far from it", () => {
    const imminent = scoreRetentionRisk(profile(5));
    const farOut = scoreRetentionRisk(profile(300));
    expect(imminent.tier).toBe("high");
    expect(farOut.tier).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// 6. Prior recert outcomes (Unrath churn finding)
// ---------------------------------------------------------------------------

describe("scoreRetentionRisk — prior recert outcomes", () => {
  it("'churned_and_returned' prior pattern adds risk and surfaces as a top signal", () => {
    const withChurn = scoreRetentionRisk({
      ...baseEligibleHousehold,
      household_has_children: false,
      days_to_next_reporting: 5,
      prior_recert_outcomes: ["churned_and_returned"],
    });
    const without = scoreRetentionRisk({
      ...baseEligibleHousehold,
      household_has_children: false,
      days_to_next_reporting: 5,
      prior_recert_outcomes: ["completed"],
    });
    expect((withChurn.score ?? 0) - (without.score ?? 0)).toBeGreaterThanOrEqual(8);
    expect(withChurn.top_signals).toContain("prior_churn_pattern");
  });

  it("'missed' prior recert adds risk distinct from churn pattern", () => {
    const withMissed = scoreRetentionRisk({
      ...baseEligibleHousehold,
      household_has_children: false,
      days_to_next_reporting: 5,
      prior_recert_outcomes: ["missed"],
    });
    expect(withMissed.top_signals).toContain("prior_missed_recert");
  });

  it("empty prior_recert_outcomes (new enrollee) does not add or subtract risk", () => {
    const newEnrollee = scoreRetentionRisk({
      ...baseEligibleHousehold,
      household_has_children: false,
      days_to_next_reporting: 5,
      prior_recert_outcomes: [],
    });
    const completed = scoreRetentionRisk({
      ...baseEligibleHousehold,
      household_has_children: false,
      days_to_next_reporting: 5,
      prior_recert_outcomes: ["completed"],
    });
    expect(newEnrollee.score).toBe(completed.score);
  });
});

// ---------------------------------------------------------------------------
// 7. Earnings trajectory (Unrath §4.3 — rebounding earnings predicts exit)
// ---------------------------------------------------------------------------

describe("scoreRetentionRisk — earnings trajectory", () => {
  const profile = (trajectory: RetentionRiskInput["earnings_trajectory"]): RetentionRiskInput => ({
    monthly_earned_income_usd: 800,
    monthly_benefit_amount_usd: 200,
    household_has_children: false,
    days_to_next_reporting: 5,
    prior_recert_outcomes: ["completed"],
    earnings_trajectory: trajectory,
    currently_eligible_per_rules: true,
  });

  it("rising earnings adds risk; falling earnings reduces it; stable/unknown are neutral", () => {
    const rising = scoreRetentionRisk(profile("rising"));
    const stable = scoreRetentionRisk(profile("stable"));
    const falling = scoreRetentionRisk(profile("falling"));
    const unknown = scoreRetentionRisk(profile("unknown"));
    expect((rising.score ?? 0)).toBeGreaterThan(stable.score ?? 0);
    expect((stable.score ?? 0)).toBeGreaterThan(falling.score ?? 0);
    expect(unknown.score).toBe(stable.score);
  });
});

// ---------------------------------------------------------------------------
// 8. Defensive boundary cases
// ---------------------------------------------------------------------------

describe("scoreRetentionRisk — defensive boundaries", () => {
  it("negative earnings input is coerced to zero (no error, no negative uplift)", () => {
    const result = scoreRetentionRisk({
      ...baseEligibleHousehold,
      monthly_earned_income_usd: -500,
      days_to_next_reporting: 5,
    });
    const baseline = scoreRetentionRisk({
      ...baseEligibleHousehold,
      monthly_earned_income_usd: 0,
      days_to_next_reporting: 5,
    });
    expect(result.score).toBe(baseline.score);
  });

  it("very large earnings clamp the at-reporting probability to 100% before window scaling", () => {
    const result = scoreRetentionRisk({
      monthly_earned_income_usd: 100000,
      monthly_benefit_amount_usd: 0,
      household_has_children: false,
      days_to_next_reporting: 5,
      prior_recert_outcomes: ["churned_and_returned"],
      earnings_trajectory: "rising",
      currently_eligible_per_rules: false,
    });
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.tier).toBe("high");
  });

  it("returns max 3 top signals even when many apply", () => {
    const result = scoreRetentionRisk({
      monthly_earned_income_usd: 2000,
      monthly_benefit_amount_usd: 40,
      household_has_children: true,
      days_to_next_reporting: 5,
      prior_recert_outcomes: ["churned_and_returned"],
      earnings_trajectory: "rising",
      currently_eligible_per_rules: true,
    });
    expect(result.top_signals.length).toBeLessThanOrEqual(3);
  });

  it("returns engine_version on every result", () => {
    const result = scoreRetentionRisk(baseEligibleHousehold);
    expect(result.engine_version).toBeTruthy();
    expect(typeof result.engine_version).toBe("string");
  });
});
