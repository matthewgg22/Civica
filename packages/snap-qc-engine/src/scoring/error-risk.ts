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
 * CA FY2024 baseline payment-error rate (USDA FNS-380, published June 2025).
 * 10.98% = 9.26% overpayment + 1.67% underpayment.
 * Source: USDA FNS-380 FY2024 California row.
 */
export const CA_BASELINE_PER = 10.98;

/**
 * Projected PER for a Civica-served household at full stack engagement.
 * Per docs/plans/civica-error-reduction-thesis.md §4.
 *
 * At full pillar engagement (Argyle income wire, lease OCR + SUA engine,
 * shared-lease classifier, deterministic calc), the projected PER lands at
 * ~5.5% — roughly half the CA baseline. The reduction of 5.48 pts is
 * distributed across the four addressable pillars by their USDA-380 share.
 */
export const PROJECTED_PER_AT_FULL_ENGAGEMENT = 5.5;

/**
 * Pillar-level un-renormalized FNS-380 shares for population PER computation.
 *
 * Distinct from ERROR_WEIGHT above (which renormalizes to sum to 1.0 across
 * Civica's 5 evaluated flows for per-packet scoreErrorRisk). These shares sum
 * to ~0.748 with the remaining ~0.252 absorbed into RESIDUAL_FLOOR_SHARE
 * below — so the population PER formula has an explicit irreducible-floor
 * term and is honest about elements outside Civica's verification stack.
 *
 * Row-by-row USDA FNS-380 / CA microdata citations:
 *   utility_sua:    FNS-380 element 363 (Shelter deduction, sua-portion 81.6%)
 *                   + 364 (SUA) = 39.94×0.816 + 4.49 = 37.10
 *                   Source: ca_fy2023_element_attribution.csv rows 363, 364.
 *   gig_income:     FNS-380 element 311 (Wages, 21.35%)
 *                   + 312 (Self-employment, 5.16%) = 26.51
 *                   Source: ca_fy2023_element_attribution.csv rows 311, 312.
 *   shared_lease:   FNS-380 element 363 (Shelter deduction, remainder 18.4%)
 *                   = 39.94×0.184 = 7.35
 *                   Source: ca_fy2023_element_attribution.csv row 363 (non-sua portion).
 *   assets:         FNS-380 element 211 (Bank accounts, 0.01%)
 *                   + 221 (Real property, 0.01%) ≈ 0.02
 *                   Source: ca_fy2023_element_attribution.csv rows 211, 221.
 *   benefit_impact: FNS-380 element 520 (Arithmetic computation, 2.03%)
 *                   + 150 (Unit composition, 1.91%) = 3.94
 *                   Source: ca_fy2023_element_attribution.csv rows 520, 150.
 *
 * Measurement window: CA FY2023 (Oct 2022 - Sep 2023). Update on next USDA
 * QC microdata release.
 *
 * Closes eng review cross-model tension #3 (2026-05-25): magic numbers now
 * have row-by-row FNS-380 citations rather than opaque renormalized weights.
 */
export const PILLAR_SHARES_UNNORMALIZED = {
  utility_sua: 0.371,
  gig_income: 0.265,
  shared_lease: 0.073,
  assets: 0.002,
  benefit_impact: 0.039,
} as const;

/**
 * Residual share of CA's payment-error surface that is structurally outside
 * Civica's verification stack: RSDI (11.06%), SSI (7.65%), other unearned
 * income (6.25%), medical deduction (3.88%), child support received (2.31%)
 * + paid (1.74%), unemployment (2.23%), contributions (1.30%), dependent
 * care (0.87%). These don't move with engagement of Civica's pillars; they
 * are the irreducible floor for PER on a Civica-served household.
 *
 * Computed as 1 - sum(PILLAR_SHARES_UNNORMALIZED) = 1 - 0.750 = 0.250.
 *
 * NOTE: this differs slightly from the previously-quoted 19.6% residual
 * (which excluded shared-lease from Civica's surface). The cleaner accounting
 * here treats shared-lease as Civica-addressable (the classifier is shipped
 * logic, UI integration pending) so residual reflects only elements that
 * cannot be reduced by any current or planned Civica integration.
 */
export const RESIDUAL_FLOOR_SHARE =
  1 -
  (PILLAR_SHARES_UNNORMALIZED.utility_sua +
    PILLAR_SHARES_UNNORMALIZED.gig_income +
    PILLAR_SHARES_UNNORMALIZED.shared_lease +
    PILLAR_SHARES_UNNORMALIZED.assets +
    PILLAR_SHARES_UNNORMALIZED.benefit_impact);

/**
 * Per-pillar maximum defensibility-shift fraction — the reduction in error
 * probability a pillar can achieve when fully engaged at its best-achievable
 * tier (vs. the weak/self-reported baseline).
 *
 * Derived from DEFENSIBILITY_ERROR_PROB above:
 *   shelter / income / calc → weak (0.80) → strong (0.05): shift = 0.75
 *   shared-lease → weak (0.80) → moderate (0.35): shift = 0.56
 *   assets → stays weak (self-reported, no API): shift = 0
 *
 * These tiers reflect the SHIPPED engineering state, not a theoretical maximum.
 * The shared-lease classifier achieves moderate (not strong) because OCR + name
 * matching can't reach the API-verified bar that Argyle provides for income.
 */
export const PILLAR_MAX_DEFENSIBILITY_SHIFT = {
  utility_sua: 0.75,    // weak → strong: SUA engine + lease OCR (API-grade verification)
  gig_income: 0.75,     // weak → strong: Argyle payroll wire
  shared_lease: 0.56,   // weak → moderate: sublease classifier (deterministic, not API)
  assets: 0,            // stays weak: self-reported, no Civica integration
  benefit_impact: 0.75, // weak → strong: deterministic CDSS calc engine
} as const;

/**
 * Per-packet pillar coverage [0, 1]. Inputs to the population PER functions.
 * Distinct type from `ScoringInput[]` so TypeScript catches shape mis-use.
 * Closes eng review architecture finding A4 (2026-05-25).
 */
export interface PillarCoverage {
  utility_sua: number;
  gig_income: number;
  shared_lease: number;
  assets: number;
  benefit_impact: number;
}

const PILLAR_KEYS = [
  "utility_sua",
  "gig_income",
  "shared_lease",
  "assets",
  "benefit_impact",
] as const satisfies readonly (keyof PillarCoverage)[];

/**
 * Clamp + NaN-coerce to [0, 1]. Defensive boundary for population PER inputs
 * which derive from 0/0-prone division (e.g. coverage = argyleConnected /
 * totalPackets where totalPackets may be 0). Closes eng review CQ2 (2026-05-25).
 */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Theoretical maximum PER reduction in percentage points: what the formula
 * would produce at full engagement using pure DEFENSIBILITY_ERROR_PROB
 * arithmetic with no real-world leakage. Computes to ~6.01 pts.
 */
const THEORETICAL_MAX_REDUCTION_PTS =
  CA_BASELINE_PER *
  (PILLAR_SHARES_UNNORMALIZED.utility_sua * PILLAR_MAX_DEFENSIBILITY_SHIFT.utility_sua +
    PILLAR_SHARES_UNNORMALIZED.gig_income * PILLAR_MAX_DEFENSIBILITY_SHIFT.gig_income +
    PILLAR_SHARES_UNNORMALIZED.shared_lease * PILLAR_MAX_DEFENSIBILITY_SHIFT.shared_lease +
    PILLAR_SHARES_UNNORMALIZED.assets * PILLAR_MAX_DEFENSIBILITY_SHIFT.assets +
    PILLAR_SHARES_UNNORMALIZED.benefit_impact * PILLAR_MAX_DEFENSIBILITY_SHIFT.benefit_impact);

/**
 * Calibration factor reconciling the theoretical max PER reduction (~6.01 pts
 * from pure defensibility-shift × share arithmetic) with the published thesis
 * target (5.48 pts reduction → 5.5% projected PER per
 * docs/plans/civica-error-reduction-thesis.md §4).
 *
 * Computes to ≈ 0.912.
 *
 * Interpretation: even at API-verified strong defensibility, ~9% of the
 * theoretical reduction is lost to real-world leakage (applicant errors after
 * verification, document-mismatches the API can't catch, edge-case QC findings).
 * This is the empirical haircut the thesis applies to anchor at 5.5% rather
 * than the unrealistic 4.97% theoretical floor.
 *
 * Closes eng review choice A (cross-model tension follow-up, 2026-05-25):
 * the factor is named and traceable in code, not hidden inside interpolation.
 */
export const THESIS_CALIBRATION_FACTOR =
  (CA_BASELINE_PER - PROJECTED_PER_AT_FULL_ENGAGEMENT) /
  THEORETICAL_MAX_REDUCTION_PTS;

/**
 * Contribution of one pillar's engagement to PER reduction, in percentage
 * points. At full engagement (1.0) across all pillars, contributions sum to
 * `CA_BASELINE_PER - PROJECTED_PER_AT_FULL_ENGAGEMENT` (≈ 5.48 pts).
 *
 * Math (option A, 2026-05-25): tier-aware per-pillar calculation.
 *
 *   contribution = baseline × pillar_share × max_defensibility_shift
 *                × engagement × THESIS_CALIBRATION_FACTOR
 *
 * Tier-aware means shared-lease (moderate tier achievable) contributes
 * proportionally less per share-unit than shelter / income / calc (strong
 * tier achievable). This honors the per-pillar defensibility story
 * documented in §3.2 of the redesign plan.
 */
export function pillarContribution(
  pillar: keyof PillarCoverage,
  engagement: number,
): number {
  const e = clamp01(engagement);
  return (
    CA_BASELINE_PER *
    PILLAR_SHARES_UNNORMALIZED[pillar] *
    PILLAR_MAX_DEFENSIBILITY_SHIFT[pillar] *
    e *
    THESIS_CALIBRATION_FACTOR
  );
}

/**
 * Population-level PER projection at the supplied pillar coverage.
 *
 * At full coverage (all = 1.0): returns PROJECTED_PER_AT_FULL_ENGAGEMENT (5.5%).
 * At zero coverage (all = 0.0): returns CA_BASELINE_PER (10.98%).
 * At partial coverage: linearly interpolated by share-weighted engagement.
 *
 * Use this for forward-looking projections (what would the formula say if
 * coverage reached X% across pillars).
 */
export function computeProjectedPER(coverage: PillarCoverage): number {
  let totalReduction = 0;
  for (const key of PILLAR_KEYS) {
    totalReduction += pillarContribution(key, coverage[key]);
  }
  return CA_BASELINE_PER - totalReduction;
}

/**
 * Engagement-implied PER from observed coverage rates today.
 *
 * Mathematically identical to `computeProjectedPER` — same formula, different
 * intent: this is the formula applied with TODAY's observed engagement
 * substituted for the required-engagement assumptions used in the projection.
 *
 * Named distinctly so callers signal intent (forward-looking projection vs.
 * current-data realization). Closes eng review cross-model tension #2
 * (2026-05-25): the page no longer claims "measured PER" — only what the
 * formula projects given today's coverage. True measured PER requires QC
 * outcomes ≥ 30 sampled cases.
 */
export function computeEngagementImpliedPER(coverage: PillarCoverage): number {
  return computeProjectedPER(coverage);
}

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
