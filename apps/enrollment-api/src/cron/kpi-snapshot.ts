// Daily cron task — refresh the KPI snapshot (three-pillar steering-tree truth point).
//
// Locked by /plan-eng-review 2026-05-30. Reads the LIVE inputs from Postgres,
// hands them to @civica/snap-qc-engine buildKpiSnapshot (the engine owns the
// math), and writes ONE provenanced run into snap_enrollment.kpi_snapshot.
// v_kpi_current then exposes the latest run as the canonical source the
// dashboard pillar-tree reads.
//
// Inputs (Phase 1 = Pillar 1 / Get In):
//   • LEADING  — packet_error_risk (20260555), the LATEST row per SUBMITTED packet.
//                scoreAndPersist() writes one at submit (best-effort). CPR = tier=low
//                share; element-clean = per-risk-label trigger share.
//   • MEASURED · denial_rate — packet_outcomes (20260600), ANY source (self-reportable).
//   • MEASURED · measured_per — AUTHORITATIVE feeds ONLY (P2 fidelity; never self_report):
//                internal QC review (qc_outcomes, 20260555 — same source as
//                error_rate_snapshot.measured_overall, so the two agree) + county-
//                authoritative packet_outcomes (the future webhook feed, TODO-44).
//
// Scheduling: piggybacks the existing 04:00 UTC daily slot in src/index.ts,
// right after the error-rate snapshot refresh — no new cron trigger.

import {
  buildKpiSnapshot,
  type KpiSnapshotInputs,
  type ElementTriggerCount,
} from "@civica/snap-qc-engine";
import { makeServiceClient } from "../lib/supabase.js";
import type { Env } from "../types.js";

export type LogFn = (
  level: "info" | "warn" | "error",
  msg: string,
  ctx?: Record<string, unknown>,
) => void;

export type KpiSnapshotResult = {
  rows_written: number;
  clean_packet_rate: number | null;
  total_scored: number;
  /** Total authoritative outcomes behind measured_per (qc + county). */
  measured_per_n: number;
  /** Provenance split: internal QC reviews vs county-authoritative outcomes. */
  qc_n: number;
  county_n: number;
  computed_at: string;
};

/**
 * Run one KPI snapshot refresh. Returns counts so the scheduled handler can log
 * them. Errors propagate to the dispatcher (logged + Sentry breadcrumb).
 */
export async function refreshKpiSnapshot(env: Env, log: LogFn): Promise<KpiSnapshotResult> {
  const db = makeServiceClient(env);

  // These tables/views aren't in the generated db-types yet (migrations not
  // applied → types not regenerated). Cast to any, mirroring error-rate-snapshot.ts.

  // 1. Pillar-1 LEADING — latest packet_error_risk per SUBMITTED packet.
  //    packet_error_risk is a history table (one row per scoring); dedup to the
  //    latest per packet in JS. "submitted" = snap_packets.submitted_at NOT NULL
  //    (excludes drafts that were scored via the /error-risk endpoint).
  //    TODO(scale): replace fetch+JS-dedup with a SQL view / RPC when volume grows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const riskResp = await (db.schema("snap_enrollment").from("packet_error_risk" as any) as any)
    .select("packet_id, tier, factors, created_at, snap_packets!inner(submitted_at, deleted_at)")
    .not("snap_packets.submitted_at", "is", null)
    .is("snap_packets.deleted_at", null)
    .order("created_at", { ascending: false });
  if (riskResp.error) {
    throw new Error(`packet_error_risk read failed: ${riskResp.error.message}`);
  }

  type RiskRow = { packet_id: string; tier: string; factors: unknown };
  const latestByPacket = new Map<string, RiskRow>();
  for (const r of (riskResp.data ?? []) as RiskRow[]) {
    // Rows arrive created_at DESC → first seen per packet is the latest.
    if (!latestByPacket.has(r.packet_id)) latestByPacket.set(r.packet_id, r);
  }
  const latest = [...latestByPacket.values()];
  const totalScored = latest.length;
  const cleanPackets = latest.filter((r) => r.tier === "low").length;

  // 1b: per-element trigger counts. factors is a JSONB string[] of QC risk
  // labels; count distinct labels per packet (a packet triggering a label twice
  // still counts once).
  const triggerCounts = new Map<string, number>();
  for (const r of latest) {
    const factors = Array.isArray(r.factors) ? (r.factors as string[]) : [];
    for (const label of new Set(factors)) {
      triggerCounts.set(label, (triggerCounts.get(label) ?? 0) + 1);
    }
  }
  const elementTriggers: ElementTriggerCount[] = [...triggerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([element, triggered]) => ({ element, triggered }));

  // 2a. Pillar-1 MEASURED · denial_rate — packet_outcomes, ANY source (denial is
  //     self-reportable). decided = approved + denied.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outcomes = () => db.schema("snap_enrollment").from("packet_outcomes" as any) as any;
  const decidedResp = await outcomes()
    .select("*", { count: "exact", head: true })
    .in("outcome", ["approved", "denied"]);
  if (decidedResp.error) {
    throw new Error(`packet_outcomes decided read failed: ${decidedResp.error.message}`);
  }
  const deniedResp = await outcomes()
    .select("*", { count: "exact", head: true })
    .eq("outcome", "denied");
  if (deniedResp.error) {
    throw new Error(`packet_outcomes denied read failed: ${deniedResp.error.message}`);
  }

  // 2b. Pillar-1 MEASURED · measured_per — AUTHORITATIVE feeds ONLY (fidelity
  //     exclusion; never self_report). Two feeds, summed:
  //       • Internal QC review — qc_outcomes (completed reviews; error_found).
  //         SAME source + math as error_rate_snapshot.measured_overall, so the two
  //         measured PERs agree by construction. Live TODAY (the hourly QC sampler).
  //       • County-authoritative — packet_outcomes(source=county_authoritative),
  //         the future signed-webhook feed (TODO-44); 0 until it lands.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qcOutcomes = () => db.schema("snap_enrollment").from("qc_outcomes" as any) as any;
  const qcNResp = await qcOutcomes()
    .select("*", { count: "exact", head: true })
    .eq("qc_sampled", true)
    .not("error_found", "is", null);
  if (qcNResp.error) {
    throw new Error(`qc_outcomes n read failed: ${qcNResp.error.message}`);
  }
  const qcErrResp = await qcOutcomes()
    .select("*", { count: "exact", head: true })
    .eq("qc_sampled", true)
    .eq("error_found", true);
  if (qcErrResp.error) {
    throw new Error(`qc_outcomes errors read failed: ${qcErrResp.error.message}`);
  }
  const countyNResp = await outcomes()
    .select("*", { count: "exact", head: true })
    .eq("source", "county_authoritative");
  if (countyNResp.error) {
    throw new Error(`packet_outcomes county n read failed: ${countyNResp.error.message}`);
  }
  const countyErrResp = await outcomes()
    .select("*", { count: "exact", head: true })
    .eq("source", "county_authoritative")
    .gt("per_pct", 0);
  if (countyErrResp.error) {
    throw new Error(`packet_outcomes county errors read failed: ${countyErrResp.error.message}`);
  }

  const qcN = qcNResp.count ?? 0;
  const countyN = countyNResp.count ?? 0;

  const inputs: KpiSnapshotInputs = {
    cpr: { cleanPackets, totalScored },
    elementTriggers,
    outcomes: {
      decided: decidedResp.count ?? 0,
      denied: deniedResp.count ?? 0,
      authoritative: {
        n: qcN + countyN,
        errors: (qcErrResp.count ?? 0) + (countyErrResp.count ?? 0),
        bySource: { qc_sample: qcN, county_authoritative: countyN },
      },
    },
  };

  // 3. Engine owns the math.
  const computedAt = new Date().toISOString();
  const rows = buildKpiSnapshot(inputs);

  // 4. Persist one run — all rows share computed_at (the run key).
  const insertRows = rows.map((r) => ({
    computed_at: computedAt,
    engine_version: r.engine_version,
    pillar: r.pillar,
    kpi_key: r.kpi_key,
    element: r.element,
    value_pct: r.value_pct,
    ci_low: r.ci_low,
    ci_high: r.ci_high,
    n: r.n,
    baseline_ref: r.baseline_ref,
    source_kind: r.source_kind,
    meta: r.meta,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertResp = await (db.schema("snap_enrollment").from("kpi_snapshot" as any) as any)
    .insert(insertRows)
    .select("snapshot_id");
  if (insertResp.error) {
    throw new Error(`kpi_snapshot insert failed: ${insertResp.error.message}`);
  }

  const cpr = rows.find((r) => r.kpi_key === "clean_packet_rate")?.value_pct ?? null;
  const result: KpiSnapshotResult = {
    rows_written: (insertResp.data ?? []).length,
    clean_packet_rate: cpr,
    total_scored: totalScored,
    measured_per_n: inputs.outcomes.authoritative.n,
    qc_n: qcN,
    county_n: countyN,
    computed_at: computedAt,
  };
  log("info", "kpi_snapshot: refreshed", { ...result });
  return result;
}
