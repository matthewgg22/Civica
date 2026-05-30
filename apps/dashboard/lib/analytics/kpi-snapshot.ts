// Server-only loader for the KPI "steering tree" truth point.
//
// Reads snap_enrollment.v_kpi_current — the latest run written by the
// apps/enrollment-api kpi-snapshot cron — and shapes it for the dashboard. The
// numbers are produced by @civica/snap-qc-engine buildKpiSnapshot; this module
// only READS + MAPS, never computes (mirrors error-rate-snapshot.ts).
//
// Phase 1 holds Pillar-1 (Get In) rows only: clean_packet_rate (1a) +
// element_clean_rate (1b) leading; denial_rate + measured_per measured. The
// `source_kind` discriminator drives the leading/measured badge in the panel.

import { createServiceClient } from "../supabase";

export interface KpiView {
  pillar: string;
  kpiKey: string;
  /** Sub-dimension (QC risk label for element_clean_rate); null for scalar KPIs. */
  element: string | null;
  /** Point estimate in percentage points; null when not computable (no packets / below n-gate). */
  valuePct: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  n: number | null;
  /** External benchmark (e.g. published CA PER); null when none. */
  baselineRef: number | null;
  /** 'leading' (in-app proxy) | 'measured' (real lagging outcome). */
  sourceKind: string;
  meta: Record<string, unknown>;
}

export interface KpiTruthPoint {
  /** False when the service key is absent or the snapshot has never run. */
  available: boolean;
  computedAt: string | null;
  engineVersion: string | null;
  /** Scalar KPIs (element null) keyed by kpi_key. */
  byKey: Partial<Record<string, KpiView>>;
  // Pillar-1 convenience accessors (null until the KPI exists).
  cleanPacketRate: KpiView | null;
  denialRate: KpiView | null;
  measuredPer: KpiView | null;
  /** element_clean_rate (1b) rows — one per QC risk label. */
  elementClean: KpiView[];
}

/** Raw row shape from v_kpi_current (NUMERIC arrives as string over the wire). */
interface RawKpiRow {
  computed_at: string | null;
  engine_version: string | null;
  pillar: string;
  kpi_key: string;
  element: string | null;
  value_pct: number | string | null;
  ci_low: number | string | null;
  ci_high: number | string | null;
  n: number | null;
  baseline_ref: number | string | null;
  source_kind: string | null;
  meta: Record<string, unknown> | null;
}

const UNAVAILABLE: KpiTruthPoint = {
  available: false,
  computedAt: null,
  engineVersion: null,
  byKey: {},
  cleanPacketRate: null,
  denialRate: null,
  measuredPer: null,
  elementClean: [],
};

// Postgres NUMERIC comes over the wire as a string; coerce defensively.
function num(v: number | string | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

function toView(r: RawKpiRow): KpiView {
  return {
    pillar: r.pillar,
    kpiKey: r.kpi_key,
    element: r.element ?? null,
    valuePct: num(r.value_pct),
    ciLow: num(r.ci_low),
    ciHigh: num(r.ci_high),
    n: r.n ?? null,
    baselineRef: num(r.baseline_ref),
    sourceKind: r.source_kind ?? "",
    meta: r.meta ?? {},
  };
}

/**
 * Pure mapper: raw v_kpi_current rows → render-ready truth point.
 * Exported for tests (no Supabase needed).
 */
export function mapKpiRows(rows: RawKpiRow[]): KpiTruthPoint {
  if (!rows || rows.length === 0) return UNAVAILABLE;

  const byKey: Partial<Record<string, KpiView>> = {};
  const elementClean: KpiView[] = [];

  for (const r of rows) {
    const view = toView(r);
    if (view.kpiKey === "element_clean_rate" && view.element !== null) {
      elementClean.push(view);
    } else if (view.element === null) {
      byKey[view.kpiKey] = view;
    }
  }

  return {
    available: true,
    computedAt: rows[0]?.computed_at ?? null,
    engineVersion: rows[0]?.engine_version ?? null,
    byKey,
    cleanPacketRate: byKey.clean_packet_rate ?? null,
    denialRate: byKey.denial_rate ?? null,
    measuredPer: byKey.measured_per ?? null,
    elementClean,
  };
}

/**
 * Read the current KPI truth point. Server-only (service-role client). Returns
 * { available: false } when the service key is absent (local dev) or the view
 * does not exist yet (migration not applied) — callers render a "pending"
 * state rather than 500. Mirrors getErrorRateTruthPoint.
 */
export async function getKpiTruthPoint(): Promise<KpiTruthPoint> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return UNAVAILABLE;

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return UNAVAILABLE;
  }

  const { data, error } = await supabase
    .schema("snap_enrollment")
    .from("v_kpi_current")
    .select(
      "computed_at, engine_version, pillar, kpi_key, element, value_pct, ci_low, ci_high, n, baseline_ref, source_kind, meta",
    );

  if (error) return UNAVAILABLE; // missing relation / migration not applied yet
  return mapKpiRows((data ?? []) as RawKpiRow[]);
}
