// External replication — burden-reducing policy → SNAP participation.
//
// WHY THIS FILE EXISTS
// --------------------
// The pre-registered harness (per-regression.ts) measures *Civica's* causal
// effect, but needs production traffic that does not exist yet. This module is
// the dashboard's half of the COMPLEMENTARY external test: on 25 years of
// public state-panel data, does the *mechanism* Civica relies on hold — does
// lowering administrative/procedural burden raise participation?
//
// The numbers come from policy-regression-results.json, emitted by
// tools/snap-policy-regression (two-way fixed-effects + a BBCE event study,
// cluster-robust by state, on 51 states × 1996-2020). source_kind is
// "public_panel" — real, already-published data, no FOIA, no synthesis.
//
// Pure + framework-free (no React, no fs): the JSON is a bundled import, so
// this is unit-testable directly and importable from a Server Component.

import rawResults from "./policy-regression-results.json";
import { formatPValue, isSignificant, significanceStars } from "./per-regression";

// ---------------------------------------------------------------------------
// Artifact shape — mirrors the JSON the harness writes.
// ---------------------------------------------------------------------------

export type LeverKind =
  | "reduces_burden"
  | "expands_eligibility"
  | "increases_burden";

export interface LeverEstimate {
  key: string;
  label: string;
  kind: LeverKind;
  estimate_pct: number;
  ci_low_pct: number;
  ci_high_pct: number;
  std_error_pct: number;
  p_value: number;
}

export interface EventPoint {
  year_label: string;
  estimate_pct: number;
  ci_low_pct: number;
  ci_high_pct: number;
  p_value: number;
}

export interface PolicyRegressionArtifact {
  schema_version: string;
  source_kind: "public_panel";
  analysis: string;
  analysis_locked_at: string;
  panel: { unit: string; n_rows: number; states: number; period: string };
  twfe: {
    outcome: string;
    spec: string;
    n: number;
    states: number;
    within_r2: number;
    levers: LeverEstimate[];
  };
  event_study: {
    treatment: string;
    reference: string;
    never_adopter_states: number;
    points: EventPoint[];
  };
  benchmark: string;
  provenance: {
    generated_at: string;
    git_sha: string | null;
    environment: Record<string, string>;
    outcome_source: string;
    treatment_source: string;
    panel_file: string;
  };
}

const ARTIFACT = rawResults as unknown as PolicyRegressionArtifact;

// ---------------------------------------------------------------------------
// Derived display layer.
// ---------------------------------------------------------------------------

/** A burden-reducing or eligibility-expanding lever is hypothesized to RAISE
 *  participation (+); an interview requirement is hypothesized to lower it. */
export function hypothesizedPositive(kind: LeverKind): boolean {
  return kind !== "increases_burden";
}

/** Percent value with a real minus glyph: 8.9 → "+8.9%", -4.0 → "−4.0%". */
export function formatPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return (value < 0 ? "−" : "+") + Math.abs(value).toFixed(digits) + "%";
}

/** 95% CI in percent: "[+3.3%, +14.5%]". */
export function formatPctCI(low: number, high: number, digits = 1): string {
  const f = (v: number) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(digits) + "%";
  return `[${f(low)}, ${f(high)}]`;
}

export interface RenderedLever extends LeverEstimate {
  estimatePct: string;
  ciPct: string;
  pFormatted: string;
  stars: string;
  significant: boolean;
  /** Estimate points the hypothesized direction (sign matches kind). */
  directionMatches: boolean;
}

export interface RenderedEventPoint extends EventPoint {
  estimatePct: string;
  ciPct: string;
  /** Pre-period (lead) vs post-adoption (lag), by the "−"/"+"/"0" label. */
  isPre: boolean;
  significant: boolean;
}

export interface PolicyRegressionReport {
  sourceKind: "public_panel";
  panel: PolicyRegressionArtifact["panel"];
  spec: string;
  outcome: string;
  n: number;
  states: number;
  withinR2: number;
  levers: RenderedLever[];
  eventStudy: {
    treatment: string;
    reference: string;
    neverAdopterStates: number;
    points: RenderedEventPoint[];
  };
  benchmark: string;
  provenance: PolicyRegressionArtifact["provenance"];
  /** Convenience: significant burden-reducing/eligibility levers (the headline). */
  significantPositiveLevers: number;
}

function renderLever(l: LeverEstimate): RenderedLever {
  const wantPositive = hypothesizedPositive(l.kind);
  const directionMatches = wantPositive
    ? l.estimate_pct > 0
    : l.estimate_pct < 0;
  return {
    ...l,
    estimatePct: formatPct(l.estimate_pct),
    ciPct: formatPctCI(l.ci_low_pct, l.ci_high_pct),
    pFormatted: formatPValue(l.p_value),
    stars: significanceStars(l.p_value),
    significant: isSignificant(l.p_value),
    directionMatches,
  };
}

function renderPoint(p: EventPoint): RenderedEventPoint {
  return {
    ...p,
    estimatePct: formatPct(p.estimate_pct),
    ciPct: formatPctCI(p.ci_low_pct, p.ci_high_pct),
    isPre: p.year_label.trim().startsWith("-") || p.year_label.includes("<=-"),
    significant: isSignificant(p.p_value),
  };
}

export function getPolicyRegressionReport(): PolicyRegressionReport {
  const t = ARTIFACT.twfe;
  const levers = t.levers.map(renderLever);
  return {
    sourceKind: ARTIFACT.source_kind,
    panel: ARTIFACT.panel,
    spec: t.spec,
    outcome: t.outcome,
    n: t.n,
    states: t.states,
    withinR2: t.within_r2,
    levers,
    eventStudy: {
      treatment: ARTIFACT.event_study.treatment,
      reference: ARTIFACT.event_study.reference,
      neverAdopterStates: ARTIFACT.event_study.never_adopter_states,
      points: ARTIFACT.event_study.points.map(renderPoint),
    },
    benchmark: ARTIFACT.benchmark,
    provenance: ARTIFACT.provenance,
    significantPositiveLevers: levers.filter(
      (l) => l.significant && hypothesizedPositive(l.kind) && l.estimate_pct > 0,
    ).length,
  };
}

export function getPolicyRegressionArtifact(): PolicyRegressionArtifact {
  return ARTIFACT;
}
