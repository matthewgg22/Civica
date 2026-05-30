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
// Numbers come from policy-regression-results.json (schema 2.x), emitted by
// tools/snap-policy-regression: an R² ladder by policy family across three
// outcomes, a parsimonious interpretable-coefficient spec, a state-trend
// robustness pass, and a BBCE event study — all two-way FE, cluster-robust by
// state, on 51 states × 1996-2020. source_kind = "public_panel" (real data).
//
// Pure + framework-free: the JSON is a bundled import, so this is unit-testable
// directly and importable from a Server Component.

import rawResults from "./policy-regression-results.json";
import { formatPValue, isSignificant, significanceStars } from "./per-regression";

// ---------------------------------------------------------------------------
// Artifact shape — mirrors the JSON the harness writes (schema 2.x).
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
  p_value: number;
}

export interface EventPoint {
  year_label: string;
  estimate_pct: number;
  ci_low_pct: number;
  ci_high_pct: number;
  p_value: number;
}

export interface R2LadderOutcome {
  key: string;
  label: string;
  /** Cumulative within-R² at [+eligibility, +transaction-cost, +procedural]. */
  within_r2: number[];
}

export interface ParsimoniousOutcome {
  key: string;
  label: string;
  within_r2: number;
  levers: LeverEstimate[];
}

export interface PolicyRegressionArtifact {
  schema_version: string;
  source_kind: "public_panel";
  analysis: string;
  analysis_locked_at: string;
  design: string;
  panel: { unit: string; n_rows: number; states: number; period: string; n_levers: number };
  r2_ladder: {
    block_labels: string[];
    cumulative: string[];
    outcomes: R2LadderOutcome[];
    note: string;
  };
  parsimonious: {
    levers_used: string[];
    n: number;
    states: number;
    outcomes: ParsimoniousOutcome[];
  };
  robustness: { spec: string; within_r2: number; levers: LeverEstimate[] };
  event_study: {
    treatment: string;
    reference: string;
    never_adopter_states: number;
    points: EventPoint[];
  };
  collinearity_note: string;
  benchmark: string;
  provenance: {
    generated_at: string;
    git_sha: string | null;
    environment: Record<string, string>;
    outcome_source: string;
    treatment_source: string;
    panel_file: string;
    cycle_control: string;
  };
}

const ARTIFACT = rawResults as unknown as PolicyRegressionArtifact;

// ---------------------------------------------------------------------------
// Formatting helpers.
// ---------------------------------------------------------------------------

export function hypothesizedPositive(kind: LeverKind): boolean {
  return kind !== "increases_burden";
}

/** Percent with a real minus glyph: 8.9 → "+8.9%", -4.0 → "−4.0%". */
export function formatPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return (value < 0 ? "−" : "+") + Math.abs(value).toFixed(digits) + "%";
}

/** 95% CI in percent: "[+3.3%, +14.5%]". */
export function formatPctCI(low: number, high: number, digits = 1): string {
  const f = (v: number) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(digits) + "%";
  return `[${f(low)}, ${f(high)}]`;
}

// ---------------------------------------------------------------------------
// Derived display layer.
// ---------------------------------------------------------------------------

export interface RenderedLever extends LeverEstimate {
  estimatePct: string;
  ciPct: string;
  pFormatted: string;
  stars: string;
  significant: boolean;
  directionMatches: boolean;
}

export interface RenderedEventPoint extends EventPoint {
  estimatePct: string;
  ciPct: string;
  isPre: boolean;
  significant: boolean;
}

export interface RenderedParsimoniousOutcome {
  key: string;
  label: string;
  withinR2: number;
  levers: RenderedLever[];
}

export interface PolicyRegressionReport {
  sourceKind: "public_panel";
  panel: PolicyRegressionArtifact["panel"];
  design: string;
  r2Ladder: { cumulative: string[]; outcomes: R2LadderOutcome[]; note: string };
  parsimonious: {
    leversUsed: string[];
    n: number;
    states: number;
    outcomes: RenderedParsimoniousOutcome[];
  };
  robustness: { spec: string; withinR2: number; levers: RenderedLever[] };
  eventStudy: {
    treatment: string;
    reference: string;
    neverAdopterStates: number;
    points: RenderedEventPoint[];
  };
  collinearityNote: string;
  benchmark: string;
  provenance: PolicyRegressionArtifact["provenance"];
  /** Significant burden/eligibility levers in the participation spec (headline). */
  significantPositiveLevers: number;
}

function renderLever(l: LeverEstimate): RenderedLever {
  const wantPositive = hypothesizedPositive(l.kind);
  return {
    ...l,
    estimatePct: formatPct(l.estimate_pct),
    ciPct: formatPctCI(l.ci_low_pct, l.ci_high_pct),
    pFormatted: formatPValue(l.p_value),
    stars: significanceStars(l.p_value),
    significant: isSignificant(l.p_value),
    directionMatches: wantPositive ? l.estimate_pct > 0 : l.estimate_pct < 0,
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
  const pars = ARTIFACT.parsimonious;
  const participation = pars.outcomes.find((o) => o.key === "participation");
  return {
    sourceKind: ARTIFACT.source_kind,
    panel: ARTIFACT.panel,
    design: ARTIFACT.design,
    r2Ladder: {
      cumulative: ARTIFACT.r2_ladder.cumulative,
      outcomes: ARTIFACT.r2_ladder.outcomes,
      note: ARTIFACT.r2_ladder.note,
    },
    parsimonious: {
      leversUsed: pars.levers_used,
      n: pars.n,
      states: pars.states,
      outcomes: pars.outcomes.map((o) => ({
        key: o.key,
        label: o.label,
        withinR2: o.within_r2,
        levers: o.levers.map(renderLever),
      })),
    },
    robustness: {
      spec: ARTIFACT.robustness.spec,
      withinR2: ARTIFACT.robustness.within_r2,
      levers: ARTIFACT.robustness.levers.map(renderLever),
    },
    eventStudy: {
      treatment: ARTIFACT.event_study.treatment,
      reference: ARTIFACT.event_study.reference,
      neverAdopterStates: ARTIFACT.event_study.never_adopter_states,
      points: ARTIFACT.event_study.points.map(renderPoint),
    },
    collinearityNote: ARTIFACT.collinearity_note,
    benchmark: ARTIFACT.benchmark,
    provenance: ARTIFACT.provenance,
    significantPositiveLevers: (participation?.levers ?? []).filter(
      (l) => isSignificant(l.p_value) && hypothesizedPositive(l.kind) && l.estimate_pct > 0,
    ).length,
  };
}

export function getPolicyRegressionArtifact(): PolicyRegressionArtifact {
  return ARTIFACT;
}
