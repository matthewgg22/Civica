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

  // 3. Pillar-2 LEADING · Active-Relationship Rate.
  //    Active packet = a live navigator relationship (status not Draft/Closed,
  //    not deleted). Numerator = active packets with a navigator touchpoint in
  //    the trailing 30 days (navigator_outreach_queue.contacted_at). Plain
  //    two-query intersection in JS (volume is small) — avoids fragile embeds.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const cutoff30 = new Date(Date.now() - 30 * DAY_MS).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packets = () => db.schema("snap_enrollment").from("snap_packets" as any) as any;
  const activeResp = await packets()
    .select("packet_id")
    .not("status", "in", "(Draft,Closed)")
    .is("deleted_at", null);
  if (activeResp.error) {
    throw new Error(`snap_packets active read failed: ${activeResp.error.message}`);
  }
  const activeIds = new Set<string>((activeResp.data ?? []).map((r: { packet_id: string }) => r.packet_id));
  const activeTotal = activeIds.size;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navQueue = () => db.schema("snap_enrollment").from("navigator_outreach_queue" as any) as any;
  const contactedResp = await navQueue()
    .select("packet_id, contacted_at")
    .not("contacted_at", "is", null)
    .gte("contacted_at", cutoff30);
  if (contactedResp.error) {
    throw new Error(`navigator_outreach_queue read failed: ${contactedResp.error.message}`);
  }
  const contactedActive = new Set<string>(
    (contactedResp.data ?? [])
      .map((r: { packet_id: string }) => r.packet_id)
      .filter((id: string) => activeIds.has(id)),
  );
  const contactedRecently = contactedActive.size;

  // 4. Pillar-3 · recertification lifecycle (reporting-moment coverage + churn).
  //    recertifications carries the cert_period_end (the reporting moment) and a
  //    terminal status/outcome. Empty until the recert lifecycle begins → honest
  //    "no upcoming recerts" / insufficient_sample.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recerts = () => db.schema("snap_enrollment").from("recertifications" as any) as any;
  const todayISO = new Date().toISOString().slice(0, 10);
  const in60ISO = new Date(Date.now() + 60 * DAY_MS).toISOString().slice(0, 10);

  // RMC denominator: recerts whose deadline falls in the next 60 days.
  const upcomingResp = await recerts()
    .select("recert_id, cert_period_end")
    .gte("cert_period_end", todayISO)
    .lte("cert_period_end", in60ISO);
  if (upcomingResp.error) {
    throw new Error(`recertifications upcoming read failed: ${upcomingResp.error.message}`);
  }
  const upcoming = (upcomingResp.data ?? []) as { recert_id: string; cert_period_end: string }[];
  const upcomingTotal = upcoming.length;

  // RMC numerator: of those, the ones with prep activity (recert outreach OR a
  // practice session) started ≥14 days before the deadline. Only queried when
  // there are upcoming recerts (skips two reads in the common empty case).
  let prepStartedAhead = 0;
  if (upcomingTotal > 0) {
    const upcomingIds = upcoming.map((r) => r.recert_id);
    const deadlineById = new Map(upcoming.map((r) => [r.recert_id, r.cert_period_end]));
    const aheadOfDeadline = (recertId: string, ts: string | null): boolean => {
      if (!ts) return false;
      const end = deadlineById.get(recertId);
      if (!end) return false;
      return new Date(ts).getTime() <= new Date(end).getTime() - 14 * DAY_MS;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outreachLog = () => db.schema("snap_enrollment").from("recert_outreach_log" as any) as any;
    const logResp = await outreachLog()
      .select("recert_id, sent_at")
      .in("recert_id", upcomingIds)
      .not("sent_at", "is", null);
    if (logResp.error) {
      throw new Error(`recert_outreach_log read failed: ${logResp.error.message}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const practice = () => db.schema("snap_enrollment").from("recert_practice_sessions" as any) as any;
    const practiceResp = await practice()
      .select("recert_id, started_at")
      .in("recert_id", upcomingIds);
    if (practiceResp.error) {
      throw new Error(`recert_practice_sessions read failed: ${practiceResp.error.message}`);
    }
    const prepared = new Set<string>();
    for (const r of (logResp.data ?? []) as { recert_id: string; sent_at: string | null }[]) {
      if (aheadOfDeadline(r.recert_id, r.sent_at)) prepared.add(r.recert_id);
    }
    for (const r of (practiceResp.data ?? []) as { recert_id: string; started_at: string | null }[]) {
      if (aheadOfDeadline(r.recert_id, r.started_at)) prepared.add(r.recert_id);
    }
    prepStartedAhead = prepared.size;
  }

  // Churn denominator: terminal recerts (resolved one way or another).
  const terminalResp = await recerts()
    .select("*", { count: "exact", head: true })
    .in("status", ["approved", "denied", "opted_out", "lapsed"]);
  if (terminalResp.error) {
    throw new Error(`recertifications terminal read failed: ${terminalResp.error.message}`);
  }
  // Churn numerator: procedural fall-off (lapsed / opted out) — the Type-1 signal.
  const churnedResp = await recerts()
    .select("*", { count: "exact", head: true })
    .in("status", ["opted_out", "lapsed"]);
  if (churnedResp.error) {
    throw new Error(`recertifications churned read failed: ${churnedResp.error.message}`);
  }

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
    stayEngaged: {
      activeRelationship: { contactedRecently, activeTotal },
    },
    stayOn: {
      reportingMoment: { prepStartedAhead, upcomingTotal },
      recert: { churned: churnedResp.count ?? 0, terminal: terminalResp.count ?? 0 },
    },
  };

  // 5. Engine owns the math.
  const computedAt = new Date().toISOString();
  const rows = buildKpiSnapshot(inputs);

  // 6. Persist one run — all rows share computed_at (the run key).
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
