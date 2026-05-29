// Canonical error-rate snapshot builder — the "truth point" composer.
//
// Surfaced by docs/findings/2026-05-29-error-rate-truth-point.md.
//
// This is the PURE, deterministic core of the error-rate truth point: given
// today's live inputs (pillar coverage + measured QC counts) it returns the
// canonical metric rows that get persisted to snap_enrollment.error_rate_snapshot
// and read back via v_error_rate_current.
//
// WHY PURE + HERE: the engine owns the math (mirrors wilsonInterval /
// computeEngagementImpliedPER). Two runs over the same inputs return identical
// rows, the arithmetic is unit-tested once, and the caller (the Workers refresh
// cron) only does I/O. That is what makes the snapshot drift-proof: the number
// is computed, never recalled.

import { ENGINE_VERSION } from "../version";
import {
  CA_BASELINE_PER,
  CA_BASELINE_FISCAL_YEAR,
  PROJECTED_PER_AT_FULL_ENGAGEMENT,
  computeEngagementImpliedPER,
  type PillarCoverage,
} from "./error-risk";
import { wilsonInterval } from "./wilson";

export type ErrorRateMetric =
  | "baseline_ca"
  | "projected_full_engagement"
  | "engagement_implied"
  | "measured_overall";

export type ErrorRateSource =
  | "usda_fns_published"
  | "engine_projection"
  | "engine_engagement_implied"
  | "measured_qc_sample";

/** One canonical metric row. Mirrors the snap_enrollment.error_rate_snapshot columns. */
export interface ErrorRateSnapshotRow {
  metric: ErrorRateMetric;
  /** Point estimate in percentage points; null when not yet computable. */
  per_pct: number | null;
  /** 95% Wilson band (percentage points) for measured_overall; null otherwise. */
  ci_low: number | null;
  ci_high: number | null;
  /** Sample size for measured_overall; null otherwise. */
  n: number | null;
  /** Fiscal year for the published baseline row; null otherwise. */
  fiscal_year: number | null;
  source: ErrorRateSource;
  meta: Record<string, unknown>;
  engine_version: string;
}

export interface MeasuredCounts {
  /** Completed QC reviews (denominator): qc_sampled AND error_found IS NOT NULL. */
  n: number;
  /** Confirmed errors (numerator): error_found = true. */
  errors: number;
}

export interface ErrorRateSnapshotInputs {
  /** Live pillar coverage (from v_qc_pillar_coverage). */
  coverage: PillarCoverage;
  /** Total non-deleted packets behind the coverage (context). */
  totalPackets: number;
  /** Completed QC review counts (from qc_outcomes). */
  measured: MeasuredCounts;
  /** Override the baseline FY label (defaults to the engine's CA_BASELINE_FISCAL_YEAR). */
  fiscalYear?: number;
  /** Min completed reviews before a measured PER is reported (default MEASURED_MIN_N). */
  measuredMinN?: number;
}

/**
 * Minimum completed QC reviews before measured PER is reported. Matches the
 * falsification gate in docs/plans/error-rate-engine-falsification.md (n >= 30).
 * Below this, measured_overall is emitted with per_pct = null (status carried in
 * meta) so the truth point honestly says "not enough sample yet" rather than a
 * noisy low-n rate.
 */
export const MEASURED_MIN_N = 30;

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/**
 * Compose the canonical error-rate snapshot rows. PURE + deterministic.
 *
 * Four metrics: published CA baseline, engine projection at full engagement,
 * live engagement-implied PER (from coverage), and measured PER (n-gated). The
 * engine supplies every fixed number (CA_BASELINE_PER, PROJECTED_*) and every
 * formula (computeEngagementImpliedPER, wilsonInterval); the caller supplies
 * only the two live inputs.
 */
export function buildErrorRateSnapshot(
  inputs: ErrorRateSnapshotInputs,
): ErrorRateSnapshotRow[] {
  const minN = inputs.measuredMinN ?? MEASURED_MIN_N;
  const fiscalYear = inputs.fiscalYear ?? CA_BASELINE_FISCAL_YEAR;
  const engagementImplied = computeEngagementImpliedPER(inputs.coverage);

  return [
    {
      metric: "baseline_ca",
      per_pct: round3(CA_BASELINE_PER),
      ci_low: null,
      ci_high: null,
      n: null,
      fiscal_year: fiscalYear,
      source: "usda_fns_published",
      meta: { label: "CA total PER (USDA FNS-380)" },
      engine_version: ENGINE_VERSION,
    },
    {
      metric: "projected_full_engagement",
      per_pct: round3(PROJECTED_PER_AT_FULL_ENGAGEMENT),
      ci_low: null,
      ci_high: null,
      n: null,
      fiscal_year: null,
      source: "engine_projection",
      meta: { baseline_ca_per: CA_BASELINE_PER },
      engine_version: ENGINE_VERSION,
    },
    {
      metric: "engagement_implied",
      per_pct: round3(engagementImplied),
      ci_low: null,
      ci_high: null,
      n: null,
      fiscal_year: null,
      source: "engine_engagement_implied",
      meta: { coverage: inputs.coverage, total_packets: inputs.totalPackets },
      engine_version: ENGINE_VERSION,
    },
    buildMeasuredRow(inputs.measured, minN),
  ];
}

function buildMeasuredRow(
  measured: MeasuredCounts,
  minN: number,
): ErrorRateSnapshotRow {
  const { n, errors } = measured;

  // Below the gate: report n but no rate — honest "insufficient sample".
  if (n < minN) {
    return {
      metric: "measured_overall",
      per_pct: null,
      ci_low: null,
      ci_high: null,
      n,
      fiscal_year: null,
      source: "measured_qc_sample",
      meta: { errors, min_n: minN, status: "insufficient_sample" },
      engine_version: ENGINE_VERSION,
    };
  }

  // At/above the gate: point estimate + 95% Wilson band, scaled to percentage.
  const ci = wilsonInterval(errors, n);
  return {
    metric: "measured_overall",
    per_pct: round3(ci.rate * 100),
    ci_low: round3(ci.lower * 100),
    ci_high: round3(ci.upper * 100),
    n,
    fiscal_year: null,
    source: "measured_qc_sample",
    meta: { errors, min_n: minN, status: "measured" },
    engine_version: ENGINE_VERSION,
  };
}
