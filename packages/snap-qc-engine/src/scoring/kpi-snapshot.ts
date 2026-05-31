// KPI snapshot builder — the three-pillar steering-tree composer.
//
// Locked by /plan-eng-review 2026-05-30 (Phase 1 = Pillar-1 error-rate
// subsystem + outcome unlock). Mirrors buildErrorRateSnapshot: PURE +
// deterministic, the engine owns every number, the caller supplies only live
// aggregate counts. Two runs over the same inputs return identical rows.
//
// Phase 1 emits Pillar-1 (Get In) rows only:
//   • LEADING  clean_packet_rate (1a) — from packet_error_risk (scored at submit)
//   • LEADING  element_clean_rate (1b) — per QC risk label
//   • MEASURED denial_rate — from packet_outcomes (ANY source; denial is self-reportable)
//   • MEASURED measured_per — from packet_outcomes AUTHORITATIVE sources ONLY
//              (county_authoritative / qc_sample) — the fidelity exclusion (P2).
//
// LEADING rows carry no CI (a census of today's packets, not a sample estimate).
// MEASURED rows are n-gated and carry a 95% Wilson band once at/above the gate —
// until authoritative outcomes exist (TODO-44), measured_per stays
// insufficient_sample and the dashboard shows the leading CPR with a badge.

import { ENGINE_VERSION } from "../version";
import { CA_BASELINE_PER } from "./error-risk";
import { wilsonInterval } from "./wilson";
import { MEASURED_MIN_N } from "./error-rate-snapshot";

export type KpiPillar = "get_in" | "stay_engaged" | "stay_on";

export type KpiKey =
  | "clean_packet_rate"
  | "element_clean_rate"
  | "operational_addressable_clean_rate"
  | "measured_per"
  | "denial_rate"
  | "active_relationship_rate"
  | "reporting_moment_coverage"
  | "churn_rate";

export type KpiSourceKind = "leading" | "measured";

/** One KPI row. Mirrors the snap_enrollment.kpi_snapshot columns. */
export interface KpiSnapshotRow {
  pillar: KpiPillar;
  kpi_key: KpiKey;
  /** Sub-dimension (e.g. the QC risk label for element_clean_rate); null for scalar KPIs. */
  element: string | null;
  /** Point estimate in percentage points; null when not yet computable (no packets / below n-gate). */
  value_pct: number | null;
  /** 95% Wilson band for measured rows; null for leading rows / pre-gate. */
  ci_low: number | null;
  ci_high: number | null;
  /** Sample size behind the row (packets / outcomes); null when not applicable. */
  n: number | null;
  /** External benchmark this KPI steers toward (e.g. published CA PER); null when none. */
  baseline_ref: number | null;
  source_kind: KpiSourceKind;
  meta: Record<string, unknown>;
  engine_version: string;
}

/** Per-element trigger count for the 1b Element-Clean Rate breakdown. */
export interface ElementTriggerCount {
  /** QC risk label (packet_error_risk.factors value), e.g. 'earned_income_unverified'. */
  element: string;
  /** How many of the scored packets triggered this element. */
  triggered: number;
}

/** Authoritative outcome counts for measured PER — county_authoritative + qc_sample ONLY. */
export interface AuthoritativeCounts {
  /** Authoritative outcomes (denominator) — QC reviews + county outcomes. */
  n: number;
  /** Those carrying a payment error (QC error_found, or county per_pct > 0). */
  errors: number;
  /** Optional provenance: how n splits across measured sources (e.g. { qc_sample, county_authoritative }). Surfaced in the measured_per row's meta.by_source. */
  bySource?: Record<string, number>;
}

export interface KpiSnapshotInputs {
  /** Pillar-1 LEADING: clean-packet inputs (latest packet_error_risk per submitted packet). */
  cpr: { cleanPackets: number; totalScored: number };
  /** Pillar-1 LEADING 1b: per-element trigger counts over the same totalScored packets. */
  elementTriggers: ElementTriggerCount[];
  /** Pillar-1 MEASURED: outcome counts from packet_outcomes. */
  outcomes: {
    /** approved + denied (decided) — denial_rate denominator. */
    decided: number;
    /** denied — denial_rate numerator. */
    denied: number;
    /** measured_per source, fidelity-excluded to authoritative outcomes. */
    authoritative: AuthoritativeCounts;
  };
  /** External benchmark for the get_in pillar (defaults to published CA PER). */
  baselineRef?: number;
  /** Min sample before a measured rate is reported (defaults to MEASURED_MIN_N = 30). */
  measuredMinN?: number;
}

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/**
 * Compose the KPI snapshot rows. PURE + deterministic. The caller supplies only
 * live aggregate counts (CPR clean/total, element triggers, outcome counts); the
 * engine owns every formula, the n-gate, and the Wilson band.
 */
export function buildKpiSnapshot(inputs: KpiSnapshotInputs): KpiSnapshotRow[] {
  const minN = inputs.measuredMinN ?? MEASURED_MIN_N;
  const baselineRef = round3(inputs.baselineRef ?? CA_BASELINE_PER);
  const { cleanPackets, totalScored } = inputs.cpr;
  const rows: KpiSnapshotRow[] = [];

  // ── Pillar 1 · LEADING · 1a Clean-Packet Rate (headline) ──────────────────
  rows.push({
    pillar: "get_in",
    kpi_key: "clean_packet_rate",
    element: null,
    value_pct: totalScored > 0 ? round3((cleanPackets / totalScored) * 100) : null,
    ci_low: null,
    ci_high: null,
    n: totalScored,
    baseline_ref: baselineRef,
    source_kind: "leading",
    meta:
      totalScored > 0
        ? {
            clean_packets: cleanPackets,
            definition: "tier=low share of submitted packets (latest packet_error_risk)",
          }
        : { clean_packets: 0, status: "no_packets" },
    engine_version: ENGINE_VERSION,
  });

  // ── Pillar 1 · LEADING · 1b Element-Clean Rate (per QC risk label) ────────
  for (const e of inputs.elementTriggers) {
    rows.push({
      pillar: "get_in",
      kpi_key: "element_clean_rate",
      element: e.element,
      value_pct:
        totalScored > 0 ? round3(((totalScored - e.triggered) / totalScored) * 100) : null,
      ci_low: null,
      ci_high: null,
      n: totalScored,
      baseline_ref: null,
      source_kind: "leading",
      meta: {
        triggered: e.triggered,
        definition: "share of submitted packets NOT triggering this element",
      },
      engine_version: ENGINE_VERSION,
    });
  }

  // ── Pillar 1 · MEASURED · denial_rate (lagging; ANY source — self-reportable) ─
  rows.push(
    measuredRate({
      pillar: "get_in",
      kpi_key: "denial_rate",
      numerator: inputs.outcomes.denied,
      denominator: inputs.outcomes.decided,
      minN,
      baselineRef: null,
      meta: { definition: "denied / (approved + denied) reported outcomes" },
    }),
  );

  // ── Pillar 1 · MEASURED · measured_per (AUTHORITATIVE ONLY — fidelity P2) ──
  // Authoritative = internal QC review (qc_outcomes) + county-authoritative
  // outcomes; NEVER self_report. by_source records the n split for provenance.
  const perMeta: Record<string, unknown> = {
    definition: "share of authoritative outcomes (qc / county) with a payment error",
    fidelity: "authoritative_only",
  };
  if (inputs.outcomes.authoritative.bySource) {
    perMeta.by_source = inputs.outcomes.authoritative.bySource;
  }
  rows.push(
    measuredRate({
      pillar: "get_in",
      kpi_key: "measured_per",
      numerator: inputs.outcomes.authoritative.errors,
      denominator: inputs.outcomes.authoritative.n,
      minN,
      baselineRef,
      meta: perMeta,
    }),
  );

  return rows;
}

/**
 * A measured-rate row: n is ALWAYS reported (so the outcome "appears" even at
 * low volume), but value_pct + 95% Wilson band only at/above the n-gate. Below
 * the gate it is an honest insufficient_sample (mirrors buildErrorRateSnapshot's
 * measured_overall).
 */
function measuredRate(p: {
  pillar: KpiPillar;
  kpi_key: KpiKey;
  numerator: number;
  denominator: number;
  minN: number;
  baselineRef: number | null;
  meta: Record<string, unknown>;
}): KpiSnapshotRow {
  const base: KpiSnapshotRow = {
    pillar: p.pillar,
    kpi_key: p.kpi_key,
    element: null,
    value_pct: null,
    ci_low: null,
    ci_high: null,
    n: p.denominator,
    baseline_ref: p.baselineRef,
    source_kind: "measured",
    meta: { ...p.meta },
    engine_version: ENGINE_VERSION,
  };

  if (p.denominator < p.minN) {
    return {
      ...base,
      meta: { ...base.meta, numerator: p.numerator, min_n: p.minN, status: "insufficient_sample" },
    };
  }

  const ci = wilsonInterval(p.numerator, p.denominator);
  return {
    ...base,
    value_pct: round3(ci.rate * 100),
    ci_low: round3(ci.lower * 100),
    ci_high: round3(ci.upper * 100),
    meta: { ...base.meta, numerator: p.numerator, min_n: p.minN, status: "measured" },
  };
}
