import { ENGINE_VERSION } from "../version";

// ---------------------------------------------------------------------------
// Retention-risk scorer — Unrath (2024) retention pillar
// ---------------------------------------------------------------------------
//
// Predicts P(exit at next SNAP reporting moment) for a household, separately
// from whether the exit would be a Type-1 error (still-eligible household
// pushed off by paperwork burden).
//
// Source: Unrath, M. (2024). "Targeting, Screening, and Retention: Evidence
// from the Supplemental Nutrition Assistance Program in California."
// https://mattunrath.github.io/files/research/Unrath_SNAP.pdf
//
// Calibration anchors (paper §4.4 and Table 4):
//   - Baseline exit rate in a reporting month for a zero-earnings case: 11%
//   - Baseline exit rate for cases with lowest benefit levels (<$50): 38%
//   - Each additional $500 in monthly earned income: +3-4pp exit risk
//   - >$500 benefit vs <$50 benefit: ~25pp lower exit risk
//   - Households with children: lower exit risk
//   - "Churned and returned" pattern: high re-exit risk (definitionally,
//     these households' prior exit was a paperwork artifact, not eligibility)
//
// Inputs the paper found WEAKLY predictive (deliberately excluded here):
//   - Race / ethnicity
//   - Primary language
//   - Prior TANF enrollment
//
// Outputs:
//   - risk_score: 0-100 integer; null for households with no scheduled
//     reporting moment (no SAR7 due in the next year)
//   - tier: "high" | "medium" | "low" | "no-reporting-window"
//   - would_be_type_1_error_if_exits: true when caller-supplied
//     `currently_eligible_per_rules` is true AND risk_score crosses the
//     medium threshold. Surfaces Unrath's central finding: most exits at
//     reporting moments are still-eligible households.
//   - top_signals: max 3 human-readable signal labels, ordered by magnitude
//   - engine_version
//
// What this scorer is NOT:
//   - Not a long-run survival predictor. Time horizon = the next scheduled
//     reporting moment.
//   - Not an eligibility determination. The caller passes in eligibility;
//     this scorer correlates it with exit risk.
//   - Not calibrated against Civica's own data yet. Coefficients are
//     anchored to Unrath's CA panel (16M Californians, 2005-2023) and will
//     need refinement once Civica accumulates retention outcomes.

export type PriorRecertOutcome =
  | "completed"            // Submitted SAR7 on time, stayed enrolled
  | "missed"               // SAR7 due, not submitted, exited
  | "churned_and_returned"; // Exited at reporting moment, re-enrolled within 90d

export type EarningsTrajectory = "rising" | "stable" | "falling" | "unknown";

export interface RetentionRiskInput {
  /** Monthly earned income from Argyle or self-reported. */
  monthly_earned_income_usd: number;
  /** Current monthly SNAP allotment. Use 0 for households between approval
   *  and first issuance. */
  monthly_benefit_amount_usd: number;
  /** True if any household member is under 18. */
  household_has_children: boolean;
  /** Days until next scheduled reporting moment (SAR7, recert, etc.). Use
   *  null when no reporting moment is scheduled within the prediction
   *  horizon — produces tier="no-reporting-window" with score=null. */
  days_to_next_reporting: number | null;
  /** Last 1-4 recert/SAR7 outcomes, most recent first. Empty array for new
   *  enrollees. */
  prior_recert_outcomes: PriorRecertOutcome[];
  /** Earnings direction over the last 3-6 months. "Unknown" when Argyle
   *  isn't wired or the household is new. */
  earnings_trajectory: EarningsTrajectory;
  /** Caller-supplied eligibility flag from snap-rules or recert-engine. The
   *  scorer does not re-evaluate eligibility — it correlates this flag with
   *  the predicted exit risk to surface Type-1 errors. */
  currently_eligible_per_rules: boolean;
}

export type RetentionRiskTier =
  | "high"
  | "medium"
  | "low"
  | "no-reporting-window";

export interface RetentionRiskResult {
  tier: RetentionRiskTier;
  /** 0-100 integer; null when no reporting moment is scheduled. */
  score: number | null;
  /** True when the caller flagged the household as eligible AND the
   *  predicted exit risk is at least medium. Direct surface for Unrath's
   *  Type-1 error finding. */
  would_be_type_1_error_if_exits: boolean;
  /** Top contributing signals, max 3, sorted by absolute contribution. */
  top_signals: string[];
  engine_version: string;
}

// ---------------------------------------------------------------------------
// Coefficients (Unrath calibration)
// ---------------------------------------------------------------------------

/** Baseline exit probability at a reporting moment for a zero-earnings,
 *  no-children, mid-benefit household. Paper §4.4 footnote: "the baseline
 *  exit rate in reporting months is 11 percent for cases with no earned
 *  income." */
const BASELINE_REPORTING_EXIT_RATE = 0.11;

/** Earnings uplift: each $500/month in earned income adds ~3.5pp to exit
 *  probability. Paper §4.4: "the likelihood of exiting in a reporting
 *  month increases by approximately three to four percentage points for
 *  each additional $500 in earned income." */
const EARNINGS_UPLIFT_PER_500 = 0.035;

/** Benefit dampener: each $500/month above a $50 floor reduces exit risk
 *  by ~10pp, until capped. Paper §4.4: "households receiving more than
 *  $500 in benefits each month are more than 25 percentage points less
 *  likely to leave than households receiving less than $50." Distributing
 *  25pp across the $50→$500+ range yields ~5pp per $100, or 10pp per $500
 *  with a cap. */
const BENEFIT_DAMPENER_PER_500 = 0.10;
const BENEFIT_DAMPENER_FLOOR_USD = 50;
const BENEFIT_DAMPENER_CAP = 0.25;

/** Children dampener: households with kids retain at higher rates. Paper
 *  §4.4: "cases without children are all more likely to exit." Magnitude
 *  estimated at ~5pp from Table 4 coefficients. */
const CHILDREN_DAMPENER = 0.05;

/** Trajectory adjustments. Paper §4.3 finds "quicker rebounds in earned
 *  income after enrollment also correspond with earlier exits." */
const TRAJECTORY_UPLIFT: Record<EarningsTrajectory, number> = {
  rising: 0.05,
  stable: 0,
  falling: -0.02,
  unknown: 0,
};

/** Churn pattern uplift. A household that previously "churned and
 *  returned" demonstrated that a prior exit was paperwork-driven, not
 *  eligibility-driven. Paper §4.2: CDSS-tracked churn rates show these
 *  households re-enroll within 1-3 months at high rates. */
const PRIOR_CHURN_UPLIFT = 0.10;

/** Missed-recert uplift. Households with a recent missed recert exit are
 *  at elevated risk of repeating the pattern, separate from the churn
 *  case (which captures returned-already). */
const PRIOR_MISSED_UPLIFT = 0.06;

/** Reporting-window scaling. The base coefficients above describe exit
 *  probability AT a reporting moment. For prediction horizons further
 *  out, we discount toward ambient (non-reporting-month) exit rates.
 *  Paper hazard plots (Appx Fig 4) show exit hazard concentrated in the
 *  reporting month with low ambient hazard between.
 *
 *  Tier mapping:
 *    days <= 7  → 1.00 (in the reporting moment itself)
 *    days <= 30 → 0.85 (imminent)
 *    days <= 90 → 0.45 (approaching)
 *    days >  90 → 0.15 (ambient floor)
 *    days = null → no-reporting-window, returns score=null
 */
function reportingWindowFactor(daysToNext: number): number {
  if (daysToNext <= 7) return 1.0;
  if (daysToNext <= 30) return 0.85;
  if (daysToNext <= 90) return 0.45;
  return 0.15;
}

// ---------------------------------------------------------------------------
// Tier thresholds
// ---------------------------------------------------------------------------

// Tier thresholds calibrated to Unrath's CA hazard distribution:
//   - Baseline zero-earnings reporting-month exit ≈ 11%
//   - "Advantaged exiter" profile (high earnings, low benefit, no kids) ≈ 25-35%
//   - High-churn pattern + rising income at imminent reporting ≈ 40-50%+
// "High" = the top exit-hazard quartile worth aggressive intervention.
const HIGH_TIER_THRESHOLD = 30;
const MEDIUM_TIER_THRESHOLD = 15;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

interface Signal {
  label: string;
  contribution: number;
}

export function scoreRetentionRisk(input: RetentionRiskInput): RetentionRiskResult {
  if (input.days_to_next_reporting === null) {
    return {
      tier: "no-reporting-window",
      score: null,
      would_be_type_1_error_if_exits: false,
      top_signals: [],
      engine_version: ENGINE_VERSION,
    };
  }

  const signals: Signal[] = [];

  let p = BASELINE_REPORTING_EXIT_RATE;

  const earningsUplift =
    (Math.max(0, input.monthly_earned_income_usd) / 500) * EARNINGS_UPLIFT_PER_500;
  if (earningsUplift > 0) {
    p += earningsUplift;
    signals.push({
      label: "earnings_above_threshold",
      contribution: earningsUplift,
    });
  }

  if (input.monthly_benefit_amount_usd > BENEFIT_DAMPENER_FLOOR_USD) {
    const benefitDampener = Math.min(
      BENEFIT_DAMPENER_CAP,
      ((input.monthly_benefit_amount_usd - BENEFIT_DAMPENER_FLOOR_USD) / 500) *
        BENEFIT_DAMPENER_PER_500,
    );
    p -= benefitDampener;
    signals.push({
      label: "high_benefit_amount_retains",
      contribution: -benefitDampener,
    });
  } else {
    // Households at the floor get an explicit signal — Unrath flags <$50
    // benefit cases as the highest-risk benefit bucket.
    signals.push({
      label: "low_benefit_amount_elevates_exit",
      contribution: 0,
    });
  }

  if (input.household_has_children) {
    p -= CHILDREN_DAMPENER;
    signals.push({
      label: "household_with_children_retains",
      contribution: -CHILDREN_DAMPENER,
    });
  }

  const trajectoryAdj = TRAJECTORY_UPLIFT[input.earnings_trajectory];
  if (trajectoryAdj !== 0) {
    p += trajectoryAdj;
    signals.push({
      label:
        input.earnings_trajectory === "rising"
          ? "earnings_rising_signals_exit"
          : "earnings_falling_signals_retention",
      contribution: trajectoryAdj,
    });
  }

  const mostRecent = input.prior_recert_outcomes[0];
  if (mostRecent === "churned_and_returned") {
    p += PRIOR_CHURN_UPLIFT;
    signals.push({
      label: "prior_churn_pattern",
      contribution: PRIOR_CHURN_UPLIFT,
    });
  } else if (mostRecent === "missed") {
    p += PRIOR_MISSED_UPLIFT;
    signals.push({
      label: "prior_missed_recert",
      contribution: PRIOR_MISSED_UPLIFT,
    });
  }

  // Clamp probability to [0, 1] before window scaling so a very-low-benefit
  // very-high-earnings household doesn't compound past 1.0.
  const clampedAtReporting = Math.max(0, Math.min(1, p));

  // Scale toward ambient exit rate based on distance to reporting moment.
  const windowFactor = reportingWindowFactor(input.days_to_next_reporting);
  const finalProb = clampedAtReporting * windowFactor;

  const score = Math.round(finalProb * 100);

  const tier: RetentionRiskTier =
    score >= HIGH_TIER_THRESHOLD
      ? "high"
      : score >= MEDIUM_TIER_THRESHOLD
        ? "medium"
        : "low";

  const wouldBeType1 =
    input.currently_eligible_per_rules && score >= MEDIUM_TIER_THRESHOLD;

  const topSignals = signals
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3)
    .map((s) => s.label);

  return {
    tier,
    score,
    would_be_type_1_error_if_exits: wouldBeType1,
    top_signals: topSignals,
    engine_version: ENGINE_VERSION,
  };
}
