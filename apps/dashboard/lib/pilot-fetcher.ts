// Pilot cohort measurement tooling — TODO-12.
//
// Cohort = packets whose `created_at` falls in a [since, until) window.
// No new DB schema; operator defines the cohort via URL params on /pilot.
// When packet_status_history.occurred_at lags created_at materially, transition
// medians fall back to the snap_packets timestamp columns (submitted_at /
// handed_off_at / closed_at).
//
// Demo-data fallback mirrors the rest of the dashboard: when the live query
// returns nothing in the window AND DEMO_FALLBACK !== "false", we layer in
// the fixtures from lib/demo-data.ts. This keeps `/pilot` rendering on a
// fresh staging clone before the cohort is even enrolled.
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "./supabase";
import {
  DEMO_PACKETS,
  DEMO_HISTORY,
  DEMO_RISK_ROWS,
  isDemoFallbackEnabled,
  type DemoPacket,
  type DemoHistoryRow,
  type DemoRiskRow,
} from "./demo-data";

export const PACKET_STATUSES = [
  "Draft",
  "Submitted for Review",
  "Needs Documents",
  "Needs Applicant Clarification",
  "In Navigator Review",
  "Ready for Handoff",
  "Handed Off",
  "Closed",
] as const;
export type PacketStatus = (typeof PACKET_STATUSES)[number];

const TERMINAL_STATUSES: ReadonlySet<PacketStatus> = new Set(["Handed Off", "Closed"]);

// Stage transitions whose medians we report. Each one maps to a column on
// snap_packets that the trigger populates when the status hits that stage,
// so we can compute durations without joining packet_status_history.
const STAGE_TRANSITIONS = [
  { key: "created_to_submitted",   label: "Created → Submitted",     fromCol: "created_at",   toCol: "submitted_at" },
  { key: "submitted_to_handed_off", label: "Submitted → Handed Off", fromCol: "submitted_at", toCol: "handed_off_at" },
  { key: "handed_off_to_closed",   label: "Handed Off → Closed",     fromCol: "handed_off_at", toCol: "closed_at" },
] as const;
export type StageKey = (typeof STAGE_TRANSITIONS)[number]["key"];

// 72h = stalled. Tunable later; matches the existing "needs attention" rule.
const STALL_THRESHOLD_MS = 72 * 60 * 60 * 1000;

export interface PilotPacket {
  packet_id: string;
  applicant_id: string;
  status: PacketStatus;
  county: string | null;
  created_at: string;
  submitted_at: string | null;
  handed_off_at: string | null;
  closed_at: string | null;
  updated_at: string;
  latest_risk_score: number | null;
  latest_risk_tier: string | null;
}

export interface PilotCohortReport {
  window: { since: string; until: string };
  cohort_size: number;
  source: "live" | "demo";
  funnel: Array<{ status: PacketStatus; count: number; pct: number }>;
  stage_durations: Array<{
    key: StageKey;
    label: string;
    /** Sample size (packets that completed the transition). */
    n: number;
    median_hours: number | null;
    p75_hours: number | null;
  }>;
  stalled: Array<{
    packet_id: string;
    status: PacketStatus;
    hours_in_status: number;
    county: string | null;
  }>;
  risk: {
    n_with_score: number;
    avg_score: number | null;
    high_tier_count: number;
    medium_tier_count: number;
    low_tier_count: number;
  };
  packets: PilotPacket[];
}

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function percentile(xs: number[], p: number): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx]!;
}

function computeReport(
  packets: PilotPacket[],
  since: string,
  until: string,
  source: "live" | "demo",
  latestHistoryByPacket: Map<string, { to_status: string; occurred_at: string }>,
): PilotCohortReport {
  const cohort_size = packets.length;

  // Funnel — current-status counts, sorted in canonical lifecycle order.
  const byStatus = new Map<PacketStatus, number>();
  for (const s of PACKET_STATUSES) byStatus.set(s, 0);
  for (const p of packets) byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
  const funnel = PACKET_STATUSES.map((status) => {
    const count = byStatus.get(status) ?? 0;
    return {
      status,
      count,
      pct: cohort_size === 0 ? 0 : count / cohort_size,
    };
  });

  // Stage durations — from snap_packets columns (populated by triggers).
  const stage_durations = STAGE_TRANSITIONS.map(({ key, label, fromCol, toCol }) => {
    const durations: number[] = [];
    for (const p of packets) {
      const fromVal = (p as unknown as Record<string, string | null>)[fromCol] ?? null;
      const toVal = (p as unknown as Record<string, string | null>)[toCol] ?? null;
      if (fromVal && toVal) {
        const h = hoursBetween(fromVal, toVal);
        if (h >= 0) durations.push(h);
      }
    }
    return {
      key,
      label,
      n: durations.length,
      median_hours: median(durations),
      p75_hours: percentile(durations, 0.75),
    };
  });

  // Stalled — non-terminal status, last status change > 72h ago.
  const now = Date.now();
  const stalled = packets
    .filter((p) => !TERMINAL_STATUSES.has(p.status))
    .map((p) => {
      const lastChange = latestHistoryByPacket.get(p.packet_id);
      const lastTs = lastChange?.occurred_at ?? p.updated_at;
      const hours = (now - new Date(lastTs).getTime()) / 3_600_000;
      return { packet_id: p.packet_id, status: p.status, hours_in_status: hours, county: p.county };
    })
    .filter((row) => row.hours_in_status * 3_600_000 > STALL_THRESHOLD_MS)
    .sort((a, b) => b.hours_in_status - a.hours_in_status)
    .slice(0, 10);

  // Risk — from latest_risk_score per packet.
  const withScore = packets.filter((p) => p.latest_risk_score != null);
  const avg_score = withScore.length === 0
    ? null
    : withScore.reduce((s, p) => s + (p.latest_risk_score ?? 0), 0) / withScore.length;
  const risk = {
    n_with_score: withScore.length,
    avg_score,
    high_tier_count: packets.filter((p) => p.latest_risk_tier === "high").length,
    medium_tier_count: packets.filter((p) => p.latest_risk_tier === "medium").length,
    low_tier_count: packets.filter((p) => p.latest_risk_tier === "low").length,
  };

  return {
    window: { since, until },
    cohort_size,
    source,
    funnel,
    stage_durations,
    stalled,
    risk,
    packets,
  };
}

function buildDemoReport(since: string, until: string): PilotCohortReport {
  const sinceMs = new Date(since).getTime();
  const untilMs = new Date(until).getTime();

  // Latest risk row per packet — DEMO_RISK_ROWS is unsorted, so reduce manually.
  const latestRiskByPacket = new Map<string, DemoRiskRow>();
  for (const r of DEMO_RISK_ROWS) {
    const cur = latestRiskByPacket.get(r.packet_id);
    if (!cur || new Date(r.created_at).getTime() > new Date(cur.created_at).getTime()) {
      latestRiskByPacket.set(r.packet_id, r);
    }
  }

  // Latest history row per packet.
  const latestHistoryByPacket = new Map<string, { to_status: string; occurred_at: string }>();
  for (const h of DEMO_HISTORY) {
    const cur = latestHistoryByPacket.get(h.packet_id);
    if (!cur || new Date(h.occurred_at).getTime() > new Date(cur.occurred_at).getTime()) {
      latestHistoryByPacket.set(h.packet_id, { to_status: h.to_status, occurred_at: h.occurred_at });
    }
  }

  const inWindow = (p: DemoPacket): boolean => {
    const t = new Date(p.created_at).getTime();
    return t >= sinceMs && t < untilMs;
  };

  const packets: PilotPacket[] = DEMO_PACKETS.filter(inWindow).map((p) => {
    const r = latestRiskByPacket.get(p.packet_id);
    return {
      packet_id: p.packet_id,
      applicant_id: p.applicant_id,
      status: p.status as PacketStatus,
      county: p.county ?? null,
      created_at: p.created_at,
      submitted_at: p.submitted_at,
      handed_off_at: p.handed_off_at,
      closed_at: p.closed_at,
      updated_at: p.updated_at,
      latest_risk_score: r?.score ?? null,
      latest_risk_tier: r?.tier ?? null,
    };
  });

  return computeReport(packets, since, until, "demo", latestHistoryByPacket);
}

/**
 * Fetch the pilot cohort report for the [since, until) window.
 *
 * Returns demo-fixture-backed results when the live query is empty and
 * DEMO_FALLBACK !== "false". Cohort membership is purely time-based:
 * a packet is in the cohort iff `created_at` ∈ [since, until).
 */
export async function fetchPilotCohort(since: string, until: string): Promise<PilotCohortReport> {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);

  // Pull all cohort packets with status + timestamps.
  const { data: rawPackets, error: pErr } = await (
    supabase.schema("snap_enrollment").from("snap_packets" as any) as any
  )
    .select(
      "packet_id, applicant_id, status, county, created_at, submitted_at, handed_off_at, closed_at, updated_at, deleted_at",
    )
    .gte("created_at", since)
    .lt("created_at", until)
    .is("deleted_at", null);

  const liveRows: PilotPacket[] = !pErr && Array.isArray(rawPackets)
    ? (rawPackets as Array<Record<string, unknown>>).map((row) => ({
        packet_id: String(row.packet_id),
        applicant_id: String(row.applicant_id),
        status: row.status as PacketStatus,
        county: (row.county as string | null) ?? null,
        created_at: String(row.created_at),
        submitted_at: (row.submitted_at as string | null) ?? null,
        handed_off_at: (row.handed_off_at as string | null) ?? null,
        closed_at: (row.closed_at as string | null) ?? null,
        updated_at: String(row.updated_at ?? row.created_at),
        latest_risk_score: null,
        latest_risk_tier: null,
      }))
    : [];

  if (liveRows.length === 0 && isDemoFallbackEnabled()) {
    return buildDemoReport(since, until);
  }

  const packetIds = liveRows.map((p) => p.packet_id);
  if (packetIds.length === 0) {
    return computeReport([], since, until, "live", new Map());
  }

  // Latest risk per packet — order by created_at desc, take first per packet.
  const { data: riskRows } = await supabase
    .schema("snap_enrollment")
    .from("packet_error_risk" as any)
    .select("packet_id, score, tier, created_at")
    .in("packet_id", packetIds)
    .order("created_at", { ascending: false });
  const latestRiskByPacket = new Map<string, { score: number | null; tier: string | null }>();
  if (Array.isArray(riskRows)) {
    for (const r of riskRows as unknown as Array<{ packet_id: string; score: number | null; tier: string | null }>) {
      if (!latestRiskByPacket.has(r.packet_id)) {
        latestRiskByPacket.set(r.packet_id, { score: r.score, tier: r.tier });
      }
    }
  }
  for (const p of liveRows) {
    const r = latestRiskByPacket.get(p.packet_id);
    if (r) {
      p.latest_risk_score = r.score;
      p.latest_risk_tier = r.tier;
    }
  }

  // Latest history per packet (for stall detection).
  const { data: histRows } = await supabase
    .schema("snap_enrollment")
    .from("packet_status_history" as any)
    .select("packet_id, to_status, occurred_at")
    .in("packet_id", packetIds)
    .order("occurred_at", { ascending: false });
  const latestHistoryByPacket = new Map<string, { to_status: string; occurred_at: string }>();
  if (Array.isArray(histRows)) {
    for (const h of histRows as unknown as Array<{ packet_id: string; to_status: string; occurred_at: string }>) {
      if (!latestHistoryByPacket.has(h.packet_id)) {
        latestHistoryByPacket.set(h.packet_id, { to_status: h.to_status, occurred_at: h.occurred_at });
      }
    }
  }

  return computeReport(liveRows, since, until, "live", latestHistoryByPacket);
}

/**
 * Resolve [since, until) from URL search params, defaulting to the last 30 days.
 * Accepts ISO date strings (YYYY-MM-DD) or full ISO timestamps. Invalid values
 * fall back to the default window.
 */
export function resolveCohortWindow(params: { since?: string; until?: string }): {
  since: string;
  until: string;
} {
  const now = new Date();
  const defaultUntil = now.toISOString();
  const defaultSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const parse = (raw: string | undefined, fallback: string): string => {
    if (!raw) return fallback;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
  };

  return {
    since: parse(params.since, defaultSince),
    until: parse(params.until, defaultUntil),
  };
}
