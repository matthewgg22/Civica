// Pre-registered PER regression — spec + results loader.
//
// WHY THIS FILE EXISTS
// --------------------
// Civica's pitch promises a *causal* reduction in the SNAP payment error
// rate (plus faster decisions, higher handoff + recert completion, more
// navigator throughput). That promise is only credible if the measurement
// plan is fixed BEFORE the outcome data lands — otherwise it's unfalsifiable
// p-hacking. This module is the dashboard's half of that lock:
//
//   • PREREGISTERED_SPEC below is the human-curated, PR-reviewed analysis
//     plan: the dependent variables, the treatment, the model family per
//     DV, and the direction we bet on — frozen on PREREG_LOCKED_AT. It is
//     the 1:1 mirror of the Python SPEC in
//     tools/per-regression/src/build_per_regression.py.
//
//   • The numbers come from per-regression-results.json, a build-time
//     artifact emitted by that harness (estimate, robust SE, statistic,
//     p-value, 95% CI, n, R²/pseudo-R²). Today it is computed on a
//     FOIA-shaped SYNTHETIC population with planted effects (watermarked);
//     when the FOIA'd CDSS QC data lands, the harness reruns on real cases,
//     the JSON is overwritten, source_kind flips to "foia", and this file —
//     and the /findings/regression panel — need ZERO changes.
//
// getRegressionReport() joins the spec to the results by dvKey and derives
// every display string (p-value, significance stars, CI, sign-vs-hypothesis,
// and the synthetic self-test "does the 95% CI cover the planted effect?").
//
// Pure + framework-free: no React, no `server-only`, no fs. The JSON is a
// bundled import, so this is safe to unit-test directly under vitest and to
// import from either a Server Component or (if ever needed) the client.

import rawResults from "./per-regression-results.json";

// ---------------------------------------------------------------------------
// Artifact shape — mirrors the JSON the harness writes.
// ---------------------------------------------------------------------------

export type ModelFamily = "ols" | "logit" | "poisson";
export type Frame = "case" | "navigator_month";
export type HypothesizedSign = "negative" | "positive";
export type SourceKind = "synthetic" | "foia";

export interface TreatmentEstimate {
  estimate: number;
  std_error: number;
  statistic: number;
  p_value: number;
  ci_low: number;
  ci_high: number;
  n: number;
  r2: number | null;
  pseudo_r2: number | null;
  /** Planted ground-truth effect (synthetic only); null for real data. */
  true_effect: number | null;
}

export interface ResultModel {
  dv_key: string;
  dv_label: string;
  unit: string;
  model_family: ModelFamily;
  frame: Frame;
  hypothesized_sign: HypothesizedSign;
  interpretation: string;
  treatment_key: string;
  treatment: TreatmentEstimate;
}

export interface RegressionProvenance {
  source_kind: SourceKind;
  generated_at: string;
  seed: number | null;
  spec_version: string;
  prereg_locked_at: string;
  prereg_finding: string;
  git_sha: string | null;
  environment: Record<string, string>;
  treatment_key: string;
  baseline_anchor: { ca_total_per_fy2024: number; source: string };
}

export interface RegressionArtifact {
  schema_version: string;
  source_kind: SourceKind;
  watermark: string | null;
  n_cases: number;
  n_navigator_months: number;
  controls: string[];
  provenance: RegressionProvenance;
  models: ResultModel[];
}

const ARTIFACT = rawResults as unknown as RegressionArtifact;

// ---------------------------------------------------------------------------
// Pre-registered plan — the reviewed contract. Mirror of the Python SPEC.
// `plainClaim` is the pitch-facing one-liner; everything else must match the
// harness (the parity test in __tests__/per-regression.test.ts enforces it).
// ---------------------------------------------------------------------------

export const PREREG_LOCKED_AT = "2026-05-28";

export interface PreregisteredDV {
  dvKey: string;
  dvLabel: string;
  unit: string;
  modelFamily: ModelFamily;
  frame: Frame;
  hypothesizedSign: HypothesizedSign;
  /** Plain-English directional claim for the pitch audience. */
  plainClaim: string;
}

export const PREREGISTERED_SPEC: readonly PreregisteredDV[] = [
  {
    dvKey: "payment_error",
    dvLabel: "Payment error rate per case",
    unit: "percentage points",
    modelFamily: "ols",
    frame: "case",
    hypothesizedSign: "negative",
    plainClaim: "Civica-assisted cases carry a lower payment error rate.",
  },
  {
    dvKey: "time_to_decision_days",
    dvLabel: "Time to eligibility decision",
    unit: "days",
    modelFamily: "ols",
    frame: "case",
    hypothesizedSign: "negative",
    plainClaim: "Civica-assisted cases reach a decision faster.",
  },
  {
    dvKey: "intake_to_handoff_complete",
    dvLabel: "Intake → handoff completion",
    unit: "log-odds",
    modelFamily: "logit",
    frame: "case",
    hypothesizedSign: "positive",
    plainClaim:
      "Civica-assisted cases more often reach a complete, submission-ready handoff.",
  },
  {
    dvKey: "recert_success",
    dvLabel: "Recertification success",
    unit: "log-odds",
    modelFamily: "logit",
    frame: "case",
    hypothesizedSign: "positive",
    plainClaim:
      "Civica-assisted households more often recertify without churning off.",
  },
  {
    dvKey: "apps_per_navigator_month",
    dvLabel: "Apps per navigator-month",
    unit: "log-rate",
    modelFamily: "poisson",
    frame: "navigator_month",
    hypothesizedSign: "positive",
    plainClaim:
      "Navigator-months with more Civica adoption complete more applications.",
  },
];

// ---------------------------------------------------------------------------
// Formatting helpers — pure, exported for direct unit testing.
// ---------------------------------------------------------------------------

/** APA-style p-value: "< 0.001" for tiny values, else 3 decimals. */
export function formatPValue(p: number): string {
  if (!Number.isFinite(p)) return "—";
  if (p < 0.001) return "< 0.001";
  return p.toFixed(3);
}

/** Significance stars by conventional thresholds. "ns" when not significant. */
export function significanceStars(p: number): string {
  if (!Number.isFinite(p)) return "";
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  return "ns";
}

export function isSignificant(p: number, alpha = 0.05): boolean {
  return Number.isFinite(p) && p < alpha;
}

/** Signed number with fixed decimals, using a real minus glyph for display. */
export function formatSigned(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const fixed = Math.abs(value).toFixed(digits);
  return (value < 0 ? "−" : "+") + fixed;
}

/** 95% CI as "[−3.62, −2.24]" with a real minus glyph. */
export function formatCI(low: number, high: number, digits = 2): string {
  const fmt = (v: number) =>
    (v < 0 ? "−" : "") + Math.abs(v).toFixed(digits);
  return `[${fmt(low)}, ${fmt(high)}]`;
}

/** Does the estimate point the direction we pre-registered? */
export function signMatchesHypothesis(
  estimate: number,
  hypothesizedSign: HypothesizedSign,
): boolean {
  return hypothesizedSign === "negative" ? estimate < 0 : estimate > 0;
}

/** Synthetic self-test: does the 95% CI cover the planted effect? null for real data. */
export function recoversTruth(t: TreatmentEstimate): boolean | null {
  if (t.true_effect === null) return null;
  return t.ci_low <= t.true_effect && t.true_effect <= t.ci_high;
}

// ---------------------------------------------------------------------------
// Joined view — spec ⨝ results by dvKey, plus derived display fields.
// ---------------------------------------------------------------------------

export interface RenderedModel {
  spec: PreregisteredDV;
  result: TreatmentEstimate;
  interpretation: string;
  /** Display fields. */
  estimateFormatted: string;
  ciFormatted: string;
  pFormatted: string;
  stars: string;
  significant: boolean;
  signMatchesHypothesis: boolean;
  /** Synthetic only: CI covers planted effect. null when source is real. */
  recoversTruth: boolean | null;
}

export interface RegressionReport {
  sourceKind: SourceKind;
  isSynthetic: boolean;
  watermark: string | null;
  schemaVersion: string;
  nCases: number;
  nNavigatorMonths: number;
  controls: string[];
  provenance: RegressionProvenance;
  treatmentKey: string;
  models: RenderedModel[];
  /** Convenience: count of DVs whose estimate matched its hypothesis. */
  directionalHits: number;
}

/** Look up a result model by dv key. */
function findResult(dvKey: string): ResultModel | undefined {
  return ARTIFACT.models.find((m) => m.dv_key === dvKey);
}

/**
 * Build the rendered report. Iterates the PRE-REGISTERED spec (not the JSON)
 * so the plan drives the output order and a missing/renamed result surfaces
 * as a thrown error at build time rather than a silently dropped row.
 */
export function getRegressionReport(): RegressionReport {
  const models: RenderedModel[] = PREREGISTERED_SPEC.map((spec) => {
    const result = findResult(spec.dvKey);
    if (!result) {
      throw new Error(
        `[per-regression] pre-registered DV "${spec.dvKey}" has no matching ` +
          `result in per-regression-results.json. Re-run the harness.`,
      );
    }
    const t = result.treatment;
    return {
      spec,
      result: t,
      interpretation: result.interpretation,
      estimateFormatted: formatSigned(t.estimate, 2),
      ciFormatted: formatCI(t.ci_low, t.ci_high, 2),
      pFormatted: formatPValue(t.p_value),
      stars: significanceStars(t.p_value),
      significant: isSignificant(t.p_value),
      signMatchesHypothesis: signMatchesHypothesis(
        t.estimate,
        spec.hypothesizedSign,
      ),
      recoversTruth: recoversTruth(t),
    };
  });

  return {
    sourceKind: ARTIFACT.source_kind,
    isSynthetic: ARTIFACT.source_kind === "synthetic",
    watermark: ARTIFACT.watermark,
    schemaVersion: ARTIFACT.schema_version,
    nCases: ARTIFACT.n_cases,
    nNavigatorMonths: ARTIFACT.n_navigator_months,
    controls: ARTIFACT.controls,
    provenance: ARTIFACT.provenance,
    treatmentKey: ARTIFACT.provenance.treatment_key,
    models,
    directionalHits: models.filter((m) => m.signMatchesHypothesis).length,
  };
}

/** Raw artifact escape hatch (e.g., for a provenance footer). */
export function getRegressionArtifact(): RegressionArtifact {
  return ARTIFACT;
}
