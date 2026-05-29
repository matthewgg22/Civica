// Server-only loader for the canonical error-rate "truth point".
//
// Reads snap_enrollment.v_error_rate_current — the latest snapshot run written
// by the apps/enrollment-api error-rate-snapshot cron — and shapes it for the
// dashboard. The numbers are produced by @civica/snap-qc-engine; this module
// only READS + MAPS, never computes. That separation is the whole point:
// everyone (this dashboard, the API, an AI insight-draft step) references one
// identical source. See docs/findings/2026-05-29-error-rate-truth-point.md.
//
// Two row layers: TOP-LINE metrics (slice_dim null → byMetric) and SLICED
// breakdowns (slice_dim set → slices[metric]): per-pillar attribution,
// income-group PER cohorts, and USDA element shares.

import type { ErrorRateMetric } from "@civica/snap-qc-engine";
import { createServiceClient } from "../supabase";

export interface ErrorRateMetricView {
  metric: ErrorRateMetric;
  /** Breakdown dimension ('pillar'|'income_group'|'element'); null for top-line. */
  sliceDim: string | null;
  /** Value within sliceDim (e.g. 'utility_sua', 'wage_only', '363'); null for top-line. */
  sliceValue: string | null;
  /** Point estimate in percentage points; null when not yet computable. */
  perPct: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  n: number | null;
  fiscalYear: number | null;
  source: string;
  meta: Record<string, unknown>;
}

export interface ErrorRateTruthPoint {
  /** False when the service key is absent or the snapshot has never run. */
  available: boolean;
  computedAt: string | null;
  engineVersion: string | null;
  /** Top-line metrics (slice_dim null), keyed by metric. */
  byMetric: Partial<Record<ErrorRateMetric, ErrorRateMetricView>>;
  /** Sliced rows grouped by metric (pillar_contribution / income_group_per / element_attribution). */
  slices: Partial<Record<ErrorRateMetric, ErrorRateMetricView[]>>;
  // Top-line convenience accessors (null until the metric exists).
  baselineCa: number | null;
  projected: number | null;
  engagementImplied: number | null;
  measured: ErrorRateMetricView | null;
  // Sliced convenience accessors (empty until populated).
  pillarContributions: ErrorRateMetricView[];
  incomeGroups: ErrorRateMetricView[];
  elements: ErrorRateMetricView[];
}

/** Raw row shape from v_error_rate_current (NUMERIC arrives as string). */
interface RawSnapshotRow {
  computed_at: string | null;
  engine_version: string | null;
  metric: string;
  slice_dim: string | null;
  slice_value: string | null;
  per_pct: number | string | null;
  ci_low: number | string | null;
  ci_high: number | string | null;
  n: number | null;
  fiscal_year: number | null;
  source: string | null;
  meta: Record<string, unknown> | null;
}

const UNAVAILABLE: ErrorRateTruthPoint = {
  available: false,
  computedAt: null,
  engineVersion: null,
  byMetric: {},
  slices: {},
  baselineCa: null,
  projected: null,
  engagementImplied: null,
  measured: null,
  pillarContributions: [],
  incomeGroups: [],
  elements: [],
};

// Postgres NUMERIC comes over the wire as a string; coerce defensively.
function num(v: number | string | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

function toView(r: RawSnapshotRow): ErrorRateMetricView {
  return {
    metric: r.metric as ErrorRateMetric,
    sliceDim: r.slice_dim ?? null,
    sliceValue: r.slice_value ?? null,
    perPct: num(r.per_pct),
    ciLow: num(r.ci_low),
    ciHigh: num(r.ci_high),
    n: r.n ?? null,
    fiscalYear: r.fiscal_year ?? null,
    source: r.source ?? "",
    meta: r.meta ?? {},
  };
}

/**
 * Pure mapper: raw v_error_rate_current rows → render-ready truth point.
 * Exported for tests (no Supabase needed).
 */
export function mapTruthPointRows(rows: RawSnapshotRow[]): ErrorRateTruthPoint {
  if (!rows || rows.length === 0) return UNAVAILABLE;

  const byMetric: Partial<Record<ErrorRateMetric, ErrorRateMetricView>> = {};
  const slices: Partial<Record<ErrorRateMetric, ErrorRateMetricView[]>> = {};

  for (const r of rows) {
    const view = toView(r);
    if (view.sliceDim === null) {
      byMetric[view.metric] = view;
    } else {
      (slices[view.metric] ??= []).push(view);
    }
  }

  return {
    available: true,
    computedAt: rows[0]?.computed_at ?? null,
    engineVersion: rows[0]?.engine_version ?? null,
    byMetric,
    slices,
    baselineCa: byMetric.baseline_ca?.perPct ?? null,
    projected: byMetric.projected_full_engagement?.perPct ?? null,
    engagementImplied: byMetric.engagement_implied?.perPct ?? null,
    measured: byMetric.measured_overall ?? null,
    pillarContributions: slices.pillar_contribution ?? [],
    incomeGroups: slices.income_group_per ?? [],
    elements: slices.element_attribution ?? [],
  };
}

/**
 * Read the current canonical error-rate truth point. Server-only (service-role
 * client). Returns { available: false } when the service key is absent (local
 * dev) or the table/view does not exist yet (migration not applied) — callers
 * render a "pending" state rather than 500.
 */
export async function getErrorRateTruthPoint(): Promise<ErrorRateTruthPoint> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return UNAVAILABLE;

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return UNAVAILABLE;
  }

  const { data, error } = await supabase
    .schema("snap_enrollment")
    .from("v_error_rate_current")
    .select(
      "computed_at, engine_version, metric, slice_dim, slice_value, per_pct, ci_low, ci_high, n, fiscal_year, source, meta",
    );

  if (error) return UNAVAILABLE; // missing relation / migration not applied yet
  return mapTruthPointRows((data ?? []) as RawSnapshotRow[]);
}
