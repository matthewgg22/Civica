import { ENGINE_VERSION } from "../version";
import type { Defensibility, FlowKind, QcResult } from "../schemas";

// USDA CA FY2023 QC element-attribution weights.
// Source: USDA FNS QC microdata — ca_fy2023_element_attribution.csv
// Each weight = share of CA errored cases attributable to the elements that
// flow covers, normalized to the 5 flows Civica currently evaluates.
//
// Element mapping:
//   utility-sua  → 363 Shelter deduction (sua-portion ~81.6%) + 364 SUA = 39.94×0.816+4.49 = 37.1%
//   gig-income   → 311 Wages (21.35%) + 312 Self-employment (5.16%) = 26.5%
//   shared-lease → 363 Shelter deduction (remainder ~18.4%) = 39.94×0.184 = 7.3%
//   assets       → 211 Bank accounts (0.01%) + 221 Real property (0.01%) ≈ 0%
//   benefit-impact-projection → 520 Arithmetic (2.03%) + 150 Unit comp (1.91%) = 3.9%
//
// Unmapped elements (RSDI 11%, SSI 7.6%, other unearned 6.3%, medical 3.9%, etc.)
// account for ~33% of CA errors and are not yet covered by a FlowKind.
// Update annually; rerun golden fixtures on any change.
export const ERROR_WEIGHT: Record<FlowKind, number> = {
  "utility-sua": 0.495, // 363 shelter (sua share) + 364 SUA — 7 CFR 273.9(d)
  "gig-income": 0.354, // 311 wages + 312 SE — 7 CFR 273.9(b)
  "shared-lease": 0.098, // 363 shelter (unverifiable share) — 7 CFR 273.9(d)
  assets: 0.002, // 211+221 — 7 CFR 273.8 (near-zero in CA QC data)
  "benefit-impact-projection": 0.051, // 520 arithmetic + 150 unit comp
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

// ---------------------------------------------------------------------------
// USDA reference data — not used in scoring yet; inform future calibration
// ---------------------------------------------------------------------------

/**
 * National FY2023 payment error rate by income-source group.
 * Source: USDA FNS QC microdata — qc_trend_fy21_fy23.csv / qc_fy2023_by_income_type.csv
 *
 * Key finding: wage-only households have a ~2.7× higher PER (15.61%) than
 * no-earned-income households (5.84%). Civica's TAM skews toward earned-income
 * households, so the Civica population PER is structurally higher than the
 * national average.
 */
export const INCOME_GROUP_PER_FY23 = {
  wage_only: 15.61, // 22.1% of national caseload
  mixed_wage_se: 19.26, // 0.6% of caseload — highest PER group
  se_only: 6.62, // 4.6% of caseload
  no_earned: 5.84, // 72.7% of caseload
  civica_tam: 13.95, // any earned income — Civica's target population
} as const;

/**
 * CA FY2023 payment error rate by income-source group.
 * Source: USDA FNS QC microdata — ca_fy2023_by_income_type.csv
 *
 * CA no-earned PER (8.44%) runs above the national no-earned rate (5.84%),
 * largely driven by higher RSDI/SSI attribution (11+7.6% of CA errors vs. 9+6% national).
 */
export const CA_INCOME_GROUP_PER_FY23 = {
  wage_only: 16.79, // 20.0% of CA caseload; mean $59 error/case
  mixed_wage_se: 15.84, // 0.8% of CA caseload; mean $74 error/case
  se_only: 7.77, // 5.8% of CA caseload; mean $32 error/case
  no_earned: 8.44, // 73.3% of CA caseload; mean $23 error/case
} as const;

/**
 * CA FY2023 error attribution by USDA element code.
 * Source: ca_fy2023_element_attribution.csv
 * These are the raw percentages that feed ERROR_WEIGHT above.
 */
export const CA_ELEMENT_ATTRIBUTION_FY23: Record<string, { label: string; share_pct: number }> = {
  "363": { label: "Shelter deduction", share_pct: 39.94 },
  "311": { label: "Wages", share_pct: 21.35 },
  "331": { label: "RSDI", share_pct: 11.06 },
  "333": { label: "SSI", share_pct: 7.65 },
  "346": { label: "Other unearned income", share_pct: 6.25 },
  "312": { label: "Self-employment", share_pct: 5.16 },
  "364": { label: "Standard utility allowance", share_pct: 4.49 },
  "365": { label: "Medical expense deduction", share_pct: 3.88 },
  "350": { label: "Child support received", share_pct: 2.31 },
  "334": { label: "Unemployment compensation", share_pct: 2.23 },
  "520": { label: "Arithmetic computation", share_pct: 2.03 },
  "150": { label: "Unit composition", share_pct: 1.91 },
  "366": { label: "Child support paid deduction", share_pct: 1.74 },
  "342": { label: "Contributions", share_pct: 1.30 },
  "323": { label: "Dependent care deduction", share_pct: 0.87 },
};
