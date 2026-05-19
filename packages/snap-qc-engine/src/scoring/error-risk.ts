import { ENGINE_VERSION } from "../version";
import type { Defensibility, FlowKind, QcResult } from "../schemas";

// USDA FY2024 QC national error-rate distribution weights.
// Each weight represents the proportion of all CA payment errors attributable
// to that error category (derived from FNS QC database, data.gov, FY2024).
// Update annually after USDA publishes QC data; rerun golden fixtures on any change.
export const ERROR_WEIGHT: Record<FlowKind, number> = {
  "utility-sua": 0.505, // 7 CFR 273.9(d) — shelter/utility overclaim
  "gig-income": 0.268, // 7 CFR 273.9(b) — earned income unreported
  "shared-lease": 0.114, // 7 CFR 273.9(d) — shelter cost unverifiable
  assets: 0.082, // 7 CFR 273.8 — asset test errors
  "benefit-impact-projection": 0.031, // categorical / student eligibility
};

// Per-flow error probability by defensibility score.
// Calibrated so that an all-strong packet scores ~5 (low) and an all-weak
// packet scores ~80 (high), anchored to CA FY2024 10.98% PER as the expected
// mean across the Civica applicant population.
const DEFENSIBILITY_ERROR_PROB: Record<Defensibility, number> = {
  strong: 0.05, // API-verified; rarely cited in QC
  moderate: 0.35, // partial verification; elevated risk
  weak: 0.80, // self-declared or no corroboration; high QC citation rate
};

// Human-readable QC risk label surfaced in the navigator risk badge.
const FLOW_RISK_LABEL: Record<FlowKind, string> = {
  "utility-sua": "shelter_utility_unverified",
  "gig-income": "earned_income_unverified",
  "shared-lease": "shelter_cost_unverifiable",
  assets: "assets_unverified",
  "benefit-impact-projection": "benefit_calculation_risk",
};

export type ErrorRiskTier = "high" | "medium" | "low" | "incomplete";

export interface ErrorRiskResult {
  tier: ErrorRiskTier;
  /** 0–100 integer; null when packet is incomplete (no flows evaluated yet). */
  score: number | null;
  /** Top QC risk labels for weak flows, sorted by USDA error weight DESC, max 3. */
  factors: string[];
  engine_version: string;
}

type ScoringInput = Pick<QcResult, "flow" | "defensibility_score">;

/**
 * Scores a packet's pre-submission error risk from one or more QcResult values.
 *
 * The score is a weighted sum of per-flow error probabilities, where weights
 * are the USDA FY2024 national QC error-type distribution. Weights are
 * renormalized to the flows actually evaluated, so a packet with only one
 * completed flow can still be scored.
 *
 * Returns { tier: 'incomplete', score: null } when no flows have been evaluated.
 */
export function scoreErrorRisk(results: ScoringInput[]): ErrorRiskResult {
  if (results.length === 0) {
    return { tier: "incomplete", score: null, factors: [], engine_version: ENGINE_VERSION };
  }

  let totalWeight = 0;
  for (const r of results) {
    totalWeight += ERROR_WEIGHT[r.flow];
  }

  let weightedSum = 0;
  for (const r of results) {
    const prob = DEFENSIBILITY_ERROR_PROB[r.defensibility_score];
    const normalizedWeight = ERROR_WEIGHT[r.flow] / totalWeight;
    weightedSum += prob * normalizedWeight;
  }

  const score = Math.round(weightedSum * 100);

  const tier: ErrorRiskTier =
    score >= 60 ? "high" : score >= 25 ? "medium" : "low";

  const factors = results
    .filter((r) => r.defensibility_score === "weak")
    .sort((a, b) => ERROR_WEIGHT[b.flow] - ERROR_WEIGHT[a.flow])
    .slice(0, 3)
    .map((r) => FLOW_RISK_LABEL[r.flow]);

  return { tier, score, factors, engine_version: ENGINE_VERSION };
}
