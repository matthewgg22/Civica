/**
 * GET /ops/cohorts — Panel 4 of /ops dashboard.
 *
 * Per enrollment month (last 6 by default), reports:
 *   - packet_count: number of packets submitted in that month
 *   - currently_active: number of those packets whose applicant has an
 *                       active ebt_card (synced in past 14d, valid cookie)
 *
 * v1 limitation: the plan's 30/60/90/180-day bucket grid requires balance/sync
 * snapshot history that doesn't exist yet. v1 ships with a single "currently
 * active" bucket per cohort. v1.1 adds the bucketed view once a daily snapshot
 * table is added.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { makeServiceClient } from "../../lib/supabase.js";
import { requireOperator } from "../../lib/auth.js";
import { logOpsAccess } from "./audit.js";
import type { Env } from "../../types.js";

interface PacketRow {
  packet_id: string;
  submitted_at: string;
  applicant_id: string;
}

interface ApplicantRow {
  applicant_id: string;
  auth_uid: string | null;
}

interface CardRow {
  user_id: string;
  last_synced_at: string | null;
  session_cookie_expires_at: string;
}

const COHORT_MONTHS_DEFAULT = 6;
const ACTIVE_WINDOW_DAYS = 14;

function monthBucket(iso: string): string {
  // "2026-04-17T..." → "2026-04"
  return iso.slice(0, 7);
}

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const startedAt = Date.now();
  const actor = c.get("actor");
  requireOperator(actor.kind);

  const monthsParam = c.req.query("months");
  const months = Math.max(1, Math.min(24, monthsParam ? parseInt(monthsParam, 10) : COHORT_MONTHS_DEFAULT));
  if (Number.isNaN(months)) {
    throw new HTTPException(400, { message: "months must be a positive integer" });
  }
  const sinceIso = new Date(Date.now() - months * 31 * 86_400_000).toISOString();

  const db = makeServiceClient(c.env);

  // Step 1: packets in window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packets, error: pErr } = await (db.schema("snap_enrollment").from("snap_packets" as any) as any)
    .select("packet_id, submitted_at, applicant_id")
    .gte("submitted_at", sinceIso)
    .is("deleted_at", null)
    .not("submitted_at", "is", null) as { data: PacketRow[] | null; error: { message: string } | null };

  if (pErr) {
    logOpsAccess(c, actor, "/ops/cohorts", 500, Date.now() - startedAt);
    throw new HTTPException(500, { message: pErr.message });
  }
  const packetRows = packets ?? [];

  if (packetRows.length === 0) {
    logOpsAccess(c, actor, "/ops/cohorts", 200, Date.now() - startedAt);
    return c.json({ cohorts: [], note: "Need 30+ days of enrollment data to compute first cohort." });
  }

  // Step 2: applicants → auth_uid
  const applicantIds = [...new Set(packetRows.map((p) => p.applicant_id))];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: applicants, error: aErr } = await (db.schema("snap_enrollment").from("applicants" as any) as any)
    .select("applicant_id, auth_uid")
    .in("applicant_id", applicantIds) as { data: ApplicantRow[] | null; error: { message: string } | null };

  if (aErr) {
    logOpsAccess(c, actor, "/ops/cohorts", 500, Date.now() - startedAt);
    throw new HTTPException(500, { message: aErr.message });
  }
  const authUidByApplicant = new Map<string, string>();
  for (const a of applicants ?? []) {
    if (a.auth_uid) authUidByApplicant.set(a.applicant_id, a.auth_uid);
  }

  // Step 3: active cards for those auth_uids
  const authUids = [...authUidByApplicant.values()];
  const activeCardUsers = new Set<string>();
  if (authUids.length > 0) {
    const cutoffIso = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000).toISOString();
    const nowIso = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cards, error: cErr } = await (db.schema("snap_enrollment").from("ebt_cards" as any) as any)
      .select("user_id, last_synced_at, session_cookie_expires_at")
      .in("user_id", authUids)
      .gte("last_synced_at", cutoffIso)
      .gt("session_cookie_expires_at", nowIso) as { data: CardRow[] | null; error: { message: string } | null };

    if (cErr) {
      logOpsAccess(c, actor, "/ops/cohorts", 500, Date.now() - startedAt);
      throw new HTTPException(500, { message: cErr.message });
    }
    for (const card of cards ?? []) {
      activeCardUsers.add(card.user_id);
    }
  }

  // Step 4: cohort by enrollment month
  const cohortMap = new Map<string, { packet_count: number; currently_active: number }>();
  for (const p of packetRows) {
    const bucket = monthBucket(p.submitted_at);
    const existing = cohortMap.get(bucket) ?? { packet_count: 0, currently_active: 0 };
    existing.packet_count += 1;
    const authUid = authUidByApplicant.get(p.applicant_id);
    if (authUid && activeCardUsers.has(authUid)) existing.currently_active += 1;
    cohortMap.set(bucket, existing);
  }

  const cohorts = [...cohortMap.entries()]
    .map(([enrollment_month, v]) => ({
      enrollment_month,
      packet_count: v.packet_count,
      currently_active: v.currently_active,
      active_pct: v.packet_count > 0 ? Math.round((v.currently_active / v.packet_count) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.enrollment_month.localeCompare(b.enrollment_month));

  const body = {
    cohorts,
    active_window_days: ACTIVE_WINDOW_DAYS,
    note: "v1: single 'currently active' bucket per cohort. v1.1 will add 30/60/90/180-day buckets when balance snapshot history exists.",
  };

  logOpsAccess(c, actor, "/ops/cohorts", 200, Date.now() - startedAt);
  return c.json(body);
});

export default app;
