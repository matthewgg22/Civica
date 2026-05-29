// Daily cron task — refresh the canonical error-rate snapshot (the "truth point").
//
// Surfaced by docs/findings/2026-05-29-error-rate-truth-point.md.
//
// Reads the two LIVE inputs from Postgres (pillar coverage + measured QC
// counts), hands them to @civica/snap-qc-engine buildErrorRateSnapshot (the
// engine owns the math), and writes ONE provenanced run into
// snap_enrollment.error_rate_snapshot. The view v_error_rate_current then
// exposes the latest run as the single canonical source every surface reads.
//
// Scheduling: piggybacks the existing 04:00 UTC daily slot in src/index.ts
// (CF Workers free-tier cron cap is 5 and we are already at it) — no new cron
// trigger. The work is a handful of aggregate reads + one engine call + one
// insert, so co-locating it with the daily purge is cheap.

import { buildErrorRateSnapshot, type PillarCoverage } from "@civica/snap-qc-engine";
import { makeServiceClient } from "../lib/supabase.js";
import type { Env } from "../types.js";

export type LogFn = (
  level: "info" | "warn" | "error",
  msg: string,
  ctx?: Record<string, unknown>,
) => void;

export type SnapshotResult = {
  rows_written: number;
  engagement_implied_per: number | null;
  measured_n: number;
  computed_at: string;
};

/**
 * Run one snapshot refresh. Returns counts so the scheduled handler can log
 * them. Errors propagate to the dispatcher (logged + Sentry breadcrumb).
 */
export async function refreshErrorRateSnapshot(env: Env, log: LogFn): Promise<SnapshotResult> {
  const db = makeServiceClient(env);

  // These views/tables aren't in the generated db-types yet (the migration
  // isn't applied → types not regenerated). Cast to any, mirroring the
  // user_push_log pattern in purge-push-log.ts. Tighten once db-types is
  // regenerated after the operator applies 20260597_error_rate_snapshot.sql.

  // 1. Live pillar coverage — one row from v_qc_pillar_coverage.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coverageResp = await (db.schema("snap_enrollment").from("v_qc_pillar_coverage" as any) as any)
    .select(
      "total_packets, gig_income_coverage, utility_sua_coverage, shared_lease_coverage, assets_coverage, benefit_impact_coverage",
    )
    .maybeSingle();
  if (coverageResp.error) {
    throw new Error(`v_qc_pillar_coverage read failed: ${coverageResp.error.message}`);
  }
  const cov = coverageResp.data;
  const coverage: PillarCoverage = {
    utility_sua: cov?.utility_sua_coverage ?? 0,
    gig_income: cov?.gig_income_coverage ?? 0,
    shared_lease: cov?.shared_lease_coverage ?? 0,
    assets: cov?.assets_coverage ?? 0,
    benefit_impact: cov?.benefit_impact_coverage ?? 0,
  };
  const totalPackets = cov?.total_packets ?? 0;

  // 2. Measured QC counts over COMPLETED reviews only (qc_sampled AND
  //    error_found IS NOT NULL) — same population the per-slice view uses.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qcOutcomes = () => db.schema("snap_enrollment").from("qc_outcomes" as any) as any;
  const nResp = await qcOutcomes()
    .select("*", { count: "exact", head: true })
    .eq("qc_sampled", true)
    .not("error_found", "is", null);
  if (nResp.error) {
    throw new Error(`qc_outcomes n read failed: ${nResp.error.message}`);
  }
  const errResp = await qcOutcomes()
    .select("*", { count: "exact", head: true })
    .eq("qc_sampled", true)
    .eq("error_found", true);
  if (errResp.error) {
    throw new Error(`qc_outcomes errors read failed: ${errResp.error.message}`);
  }
  const measured = { n: nResp.count ?? 0, errors: errResp.count ?? 0 };

  // 3. Engine owns the math.
  const computedAt = new Date().toISOString();
  const rows = buildErrorRateSnapshot({ coverage, totalPackets, measured });

  // 4. Persist one run — all rows share computed_at (the run key).
  const insertRows = rows.map((r) => ({
    computed_at: computedAt,
    engine_version: r.engine_version,
    metric: r.metric,
    slice_dim: r.slice_dim,
    slice_value: r.slice_value,
    per_pct: r.per_pct,
    ci_low: r.ci_low,
    ci_high: r.ci_high,
    n: r.n,
    fiscal_year: r.fiscal_year,
    source: r.source,
    meta: r.meta,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertResp = await (db.schema("snap_enrollment").from("error_rate_snapshot" as any) as any)
    .insert(insertRows)
    .select("snapshot_id");
  if (insertResp.error) {
    throw new Error(`error_rate_snapshot insert failed: ${insertResp.error.message}`);
  }

  const engagement =
    rows.find((r) => r.metric === "engagement_implied")?.per_pct ?? null;
  const result: SnapshotResult = {
    rows_written: (insertResp.data ?? []).length,
    engagement_implied_per: engagement,
    measured_n: measured.n,
    computed_at: computedAt,
  };
  log("info", "error_rate_snapshot: refreshed", { ...result });
  return result;
}
