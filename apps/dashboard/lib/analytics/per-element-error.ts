// Per-element SNAP-QC error regression — loader for the real-microdata artifact.
//
// Produced by tools/per-element-error-regression on the USDA QC FY2023 CA
// public-use file: one logistic model PER error element (shelter, wages, …)
// asking which household characteristics predict an error in that element.
// This module only READS + SHAPES the artifact; the engine (Python/statsmodels)
// owns the numbers (same separation as per-regression.ts).
//
// IMPORTANT framing carried through from the harness: the DV is QC
// variance-citation per element (the engine's element-attribution basis), NOT
// the dollar-weighted PER. Unweighted logistic, HC1 robust SEs, n≈867 CA cases.

import artifact from "./per-element-error-results.json";

export interface PerElementTerm {
  name: string;
  coef: number;
  odds_ratio: number;
  or_ci_low: number;
  or_ci_high: number;
  p_value: number;
}

export interface PerElementModel {
  dvKey: string;
  elementCode: number | null;
  label: string;
  n: number;
  nEvents: number;
  samplePrevalencePct: number;
  weightedPrevalencePct: number;
  weightedShareOfErroredPct: number | null;
  underpowered: boolean;
  converged: boolean;
  reason: string | null;
  pseudoR2: number | null;
  quasiSeparation: boolean;
  terms: PerElementTerm[];
}

export interface PerElementReport {
  sourceKind: string;
  fiscalYear: number;
  scope: string;
  nCases: number;
  nModeled: number;
  predictors: string[];
  modelFamily: string;
  dvBasis: string;
  minEventsForPower: number;
  models: PerElementModel[];
  /** Converged, powered, non-separated models — the trustworthy subset. */
  reliable: PerElementModel[];
}

interface RawModel {
  dv_key: string;
  element_code: number | null;
  label: string;
  n: number;
  n_events: number;
  sample_prevalence_pct: number;
  weighted_prevalence_pct: number;
  weighted_share_of_errored_pct: number | null;
  underpowered: boolean;
  converged?: boolean;
  reason?: string;
  pseudo_r2?: number;
  quasi_separation?: boolean;
  terms?: PerElementTerm[];
}

function toModel(r: RawModel): PerElementModel {
  return {
    dvKey: r.dv_key,
    elementCode: r.element_code ?? null,
    label: r.label,
    n: r.n,
    nEvents: r.n_events,
    samplePrevalencePct: r.sample_prevalence_pct,
    weightedPrevalencePct: r.weighted_prevalence_pct,
    weightedShareOfErroredPct: r.weighted_share_of_errored_pct ?? null,
    underpowered: r.underpowered,
    converged: r.converged ?? false,
    reason: r.reason ?? null,
    pseudoR2: r.pseudo_r2 ?? null,
    quasiSeparation: r.quasi_separation ?? false,
    terms: r.terms ?? [],
  };
}

/** A term is a reliable signal when it is significant AND its OR CI excludes 1. */
export function isSignificant(t: PerElementTerm): boolean {
  return t.p_value < 0.05 && (t.or_ci_low > 1 || t.or_ci_high < 1);
}

export function getPerElementErrorReport(): PerElementReport {
  const a = artifact as unknown as {
    source_kind: string;
    fiscal_year: number;
    scope: string;
    n_cases: number;
    n_modeled: number;
    predictors: string[];
    model_family: string;
    dv_basis: string;
    min_events_for_power: number;
    models: RawModel[];
  };
  const models = a.models.map(toModel);
  return {
    sourceKind: a.source_kind,
    fiscalYear: a.fiscal_year,
    scope: a.scope,
    nCases: a.n_cases,
    nModeled: a.n_modeled,
    predictors: a.predictors,
    modelFamily: a.model_family,
    dvBasis: a.dv_basis,
    minEventsForPower: a.min_events_for_power,
    models,
    reliable: models.filter((m) => m.converged && !m.underpowered && !m.quasiSeparation),
  };
}
