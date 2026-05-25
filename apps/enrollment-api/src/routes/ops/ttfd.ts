/**
 * GET /ops/ttfd — Panel 5 of /ops dashboard.
 *
 * Median days from packet submission to first posted EBT deposit.
 *
 * "First deposit" = MIN(ebt_deposits.posted_at) for the user. ebt_deposits is
 * populated by the Fly scraper as it observes new deposits land on the card.
 *
 * Per Reviewer Concern #2: this avoids adding a denormalized ebt_cards.first_deposit_at
 * column for v1. If derive-from-deposits proves too slow, v1.1 can add the
 * column with a one-time backfill from MIN(ebt_deposits.posted_at).
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
  county_fips: string | null;
}

interface ApplicantRow {
  applicant_id: string;
  auth_uid: string | null;
}

interface DepositRow {
  card_id: string;
  posted_at: string;
}

interface CardRow {
  id: string;
  user_id: string;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const lo = sorted[mid - 1];
    const hi = sorted[mid];
    if (lo === undefined || hi === undefined) return null;
    return (lo + hi) / 2;
  }
  return sorted[mid] ?? null;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const startedAt = Date.now();
  const actor = c.get("actor");
  requireOperator(actor.kind);

  const db = makeServiceClient(c.env);

  // Step 1: submitted packets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packets, error: pErr } = await (db.schema("snap_enrollment").from("snap_packets" as any) as any)
    .select("packet_id, submitted_at, applicant_id, county_fips")
    .is("deleted_at", null)
    .not("submitted_at", "is", null) as { data: PacketRow[] | null; error: { message: string } | null };

  if (pErr) {
    logOpsAccess(c, actor, "/ops/ttfd", 500, Date.now() - startedAt);
    throw new HTTPException(500, { message: pErr.message });
  }
  const packetRows = packets ?? [];
  if (packetRows.length === 0) {
    logOpsAccess(c, actor, "/ops/ttfd", 200, Date.now() - startedAt);
    return c.json({ median_days: null, county_trend: [], note: "No submitted packets yet." });
  }

  // Step 2: applicant → auth_uid
  const applicantIds = [...new Set(packetRows.map((p) => p.applicant_id))];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: applicants, error: aErr } = await (db.schema("snap_enrollment").from("applicants" as any) as any)
    .select("applicant_id, auth_uid")
    .in("applicant_id", applicantIds) as { data: ApplicantRow[] | null; error: { message: string } | null };

  if (aErr) {
    logOpsAccess(c, actor, "/ops/ttfd", 500, Date.now() - startedAt);
    throw new HTTPException(500, { message: aErr.message });
  }
  const authUidByApplicant = new Map<string, string>();
  for (const a of applicants ?? []) {
    if (a.auth_uid) authUidByApplicant.set(a.applicant_id, a.auth_uid);
  }

  // Step 3: cards for auth_uids
  const authUids = [...new Set([...authUidByApplicant.values()])];
  const cardIdsByUser = new Map<string, string[]>();
  if (authUids.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cards, error: cErr } = await (db.schema("snap_enrollment").from("ebt_cards" as any) as any)
      .select("id, user_id")
      .in("user_id", authUids) as { data: CardRow[] | null; error: { message: string } | null };
    if (cErr) {
      logOpsAccess(c, actor, "/ops/ttfd", 500, Date.now() - startedAt);
      throw new HTTPException(500, { message: cErr.message });
    }
    for (const card of cards ?? []) {
      const arr = cardIdsByUser.get(card.user_id) ?? [];
      arr.push(card.id);
      cardIdsByUser.set(card.user_id, arr);
    }
  }

  // Step 4: deposits for those cards
  const allCardIds = [...cardIdsByUser.values()].flat();
  const firstDepositByCard = new Map<string, string>();
  if (allCardIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deposits, error: dErr } = await (db.schema("snap_enrollment").from("ebt_deposits" as any) as any)
      .select("card_id, posted_at")
      .in("card_id", allCardIds)
      .not("posted_at", "is", null) as { data: DepositRow[] | null; error: { message: string } | null };
    if (dErr) {
      logOpsAccess(c, actor, "/ops/ttfd", 500, Date.now() - startedAt);
      throw new HTTPException(500, { message: dErr.message });
    }
    for (const d of deposits ?? []) {
      const existing = firstDepositByCard.get(d.card_id);
      if (!existing || d.posted_at < existing) firstDepositByCard.set(d.card_id, d.posted_at);
    }
  }

  // Step 5: per-packet TTFD + per-county aggregation
  const allDays: number[] = [];
  const byCounty = new Map<string, number[]>();
  for (const p of packetRows) {
    const authUid = authUidByApplicant.get(p.applicant_id);
    if (!authUid) continue;
    const cardIds = cardIdsByUser.get(authUid) ?? [];
    if (cardIds.length === 0) continue;
    // Earliest deposit across all of this user's cards.
    let firstAt: string | null = null;
    for (const cid of cardIds) {
      const dep = firstDepositByCard.get(cid);
      if (dep && (!firstAt || dep < firstAt)) firstAt = dep;
    }
    if (!firstAt) continue;
    const days = (new Date(firstAt).getTime() - new Date(p.submitted_at).getTime()) / 86_400_000;
    if (days < 0) continue; // deposit-before-submit is impossible; defensively skip clock skew
    allDays.push(days);
    const county = p.county_fips ?? "00000";
    const list = byCounty.get(county) ?? [];
    list.push(days);
    byCounty.set(county, list);
  }

  const countyTrend = [...byCounty.entries()]
    .map(([county_fips, days]) => ({
      county_fips,
      n: days.length,
      median_days: median(days),
    }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);

  const body = {
    median_days: median(allDays),
    n: allDays.length,
    county_trend: countyTrend,
  };

  logOpsAccess(c, actor, "/ops/ttfd", 200, Date.now() - startedAt);
  return c.json(body);
});

export default app;
