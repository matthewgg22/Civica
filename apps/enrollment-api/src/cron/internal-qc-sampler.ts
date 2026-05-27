// ---------------------------------------------------------------------------
// Cron: prospective QC sampler.
//
// Per docs/plans/error-rate-engine-falsification.md (T4, ENG-D2):
//   - Selects submission-stage packets via modular hash over packet_id:
//     sha256(packet_id) interpreted as a BigInt, mod 10 == 0 → sampled.
//   - Stateless. Duplicate cron ticks never double-insert because the
//     migration's uq_packet_qc_samples_packet_stage unique index makes
//     `ON CONFLICT (packet_id, sample_stage) DO NOTHING` idempotent.
//   - Determinism: same packet_id set → same selection across calls.
//   - No-op safety: empty submission window → zero writes.
//
// Each tick:
//   1. Read all packets with submitted_at IS NOT NULL that don't already
//      have a sample row at sample_stage='submission'.
//   2. For each candidate, compute the hash; keep ones where (mod 10 == 0).
//   3. INSERT one row per keeper. ON CONFLICT DO NOTHING absorbs concurrent
//      ticks AND any candidate that slipped through the not-already-sampled
//      filter due to a phantom read.
//
// Path note: handlers for scheduled() live under src/cron/ (mirrors
// buddy-app-metadata-cleanup.ts, ebt-probe.ts, etc.). The plan §19 calls
// out src/routes/ but routes are HTTP handlers — cron isn't a route.
// ---------------------------------------------------------------------------

import { makeServiceClient } from "../lib/supabase.js";
import type { Env } from "../types.js";

/** Modular cadence — every 10th packet (10% sampling rate per §4 Stream B). */
export const SAMPLE_MODULUS = 10;

/** Max candidates read per tick. Keeps a misconfigured cron from scanning
 *  the whole submitted-packets backlog if it ever falls behind. */
const CANDIDATE_BATCH = 500;

export type SamplerResult = {
  candidates: number;
  selected: number;
  inserted: number;
  skipped_no_org: number;
};

type CandidatePacket = {
  packet_id: string;
  applicant_id: string;
  org_id: string | null;
  submitted_at: string;
};

/**
 * Run one cron tick. Returns counts so the scheduled handler can log them.
 * Errors propagate to the dispatcher (logs + Sentry breadcrumb).
 */
export async function runInternalQcSampler(env: Env): Promise<SamplerResult> {
  const db = makeServiceClient(env);

  // Pull submitted packets that don't already have a submission-stage sample.
  // We anti-join via a NOT IN subquery — fine at our volume, swap to a left-
  // join NULL filter if the candidate table grows beyond a few thousand rows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sampledRowsResp = await (db.schema("snap_enrollment").from("packet_qc_samples" as any) as any)
    .select("packet_id")
    .eq("sample_stage", "submission") as {
      data: Array<{ packet_id: string }> | null;
      error: { message: string } | null;
    };
  if (sampledRowsResp.error) {
    throw new Error(`packet_qc_samples select failed: ${sampledRowsResp.error.message}`);
  }
  const alreadySampled = new Set((sampledRowsResp.data ?? []).map((r) => r.packet_id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidatesResp = await (db.schema("snap_enrollment").from("snap_packets" as any) as any)
    .select("packet_id, applicant_id, org_id, submitted_at")
    .not("submitted_at", "is", null)
    .is("deleted_at", null)
    .order("submitted_at", { ascending: true })
    .limit(CANDIDATE_BATCH) as {
      data: CandidatePacket[] | null;
      error: { message: string } | null;
    };
  if (candidatesResp.error) {
    throw new Error(`snap_packets select failed: ${candidatesResp.error.message}`);
  }

  const allCandidates = candidatesResp.data ?? [];
  const fresh = allCandidates.filter((p) => !alreadySampled.has(p.packet_id));

  // Deterministic modular selection.
  const selectedAll: CandidatePacket[] = [];
  for (const packet of fresh) {
    if (await packetHashMatches(packet.packet_id)) {
      selectedAll.push(packet);
    }
  }

  // org_id is nullable on snap_packets but NOT NULL on packet_qc_samples.
  // Drop rows missing org_id; surface the count in the result so an
  // observability alert can fire if it ever spikes.
  const selected = selectedAll.filter((p) => p.org_id !== null);
  const skipped_no_org = selectedAll.length - selected.length;

  if (selected.length === 0) {
    return {
      candidates: fresh.length,
      selected: 0,
      inserted: 0,
      skipped_no_org,
    };
  }

  const rows = selected.map((p) => ({
    packet_id: p.packet_id,
    applicant_id: p.applicant_id,
    org_id: p.org_id as string, // narrowed above
    sample_stage: "submission" as const,
    submitted_at: p.submitted_at,
  }));

  // ON CONFLICT DO NOTHING via supabase-js: `upsert` with ignoreDuplicates.
  // The unique index uq_packet_qc_samples_packet_stage backs the ON CONFLICT.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertResp = await (db.schema("snap_enrollment").from("packet_qc_samples" as any) as any)
    .upsert(rows, { onConflict: "packet_id,sample_stage", ignoreDuplicates: true })
    .select("sample_id") as {
      data: Array<{ sample_id: string }> | null;
      error: { message: string } | null;
    };
  if (insertResp.error) {
    throw new Error(`packet_qc_samples insert failed: ${insertResp.error.message}`);
  }

  return {
    candidates: fresh.length,
    selected: selected.length,
    inserted: (insertResp.data ?? []).length,
    skipped_no_org,
  };
}

/**
 * Modular hash selector — deterministic and stateless.
 *
 * Uses Web Crypto (available in Workers runtime + Node ≥ 19). Takes the
 * first 8 bytes of sha256(packet_id) as a BigInt and returns true iff
 * (bytes mod SAMPLE_MODULUS) === 0.
 *
 * Exported for tests; production callers use runInternalQcSampler().
 */
export async function packetHashMatches(packetId: string): Promise<boolean> {
  const data = new TextEncoder().encode(packetId);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const view = new DataView(digest);
  // Read 8 bytes as an unsigned 64-bit BigInt. JS Number can only safely
  // represent 53 bits; BigInt avoids modular-bias issues at large packet
  // counts and keeps the test math exact.
  const hi = BigInt(view.getUint32(0));
  const lo = BigInt(view.getUint32(4));
  const u64 = (hi << 32n) | lo;
  return u64 % BigInt(SAMPLE_MODULUS) === 0n;
}
