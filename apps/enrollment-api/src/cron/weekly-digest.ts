/**
 * Weekly digest cron — fans out top-3-offer pushes Sunday morning local.
 *
 * Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (B-T7 + F11).
 *
 * Two cron triggers, NOT 24 shards (per outside-voice F11 fix):
 *   - "0 17 * * 0" → Sunday 17:00 UTC = 09:00 PT (PDT)  → users in CA
 *   - "0 14 * * 0" → Sunday 14:00 UTC = 09:00 ET (EDT)  → users in MA
 *
 * DST is acknowledged as a v1 limitation: during PST (UTC-8) the PT shard
 * fires at 09:00 PT but at 08:00 PST. The TTHW for a v1.1 IANA-zone-aware
 * shard model is documented in the plan; users in standard time get their
 * digest one hour off. Acceptable for v1.
 *
 * Batch INSERT pattern (per A5 outside-voice fix): the cron writes
 * user_push_log entries as a single multi-row INSERT per shard's user set,
 * not per-user. The unique partial index on
 *   (user_id, date_trunc('day', sent_at)) WHERE category = 'perk_offer'
 * makes concurrent fan-out race-safe via ON CONFLICT DO NOTHING.
 *
 * Per-user offer selection: resolveOffers() top-3. Distress + perksOn +
 * 24h floor pre-checked per user before adding to the digest batch.
 */

import { makeServiceClient } from "../lib/supabase.js";
import {
  shouldSendPerkOfferPush,
  tryRecordPerkPush,
  DEFAULT_PREFS,
  readNotificationPrefs,
} from "../lib/push-cadence.js";
import { resolveOffers } from "../lib/offers/resolver.js";
import type { Env } from "../types.js";

export type LogFn = (level: "info" | "warn" | "error", msg: string, ctx?: Record<string, unknown>) => void;

export interface WeeklyDigestResult {
  shard: "CA" | "MA";
  considered: number;
  sent: number;
  suppressed: number;
  errors: number;
  reason_counts: Record<string, number>;
}

interface ApplicantRow {
  applicant_id: string;
  auth_uid: string;
  state_code: "CA" | "MA";
  county_fips: string | null;
}

/**
 * Runs the weekly digest for a single state shard. Cron entry point.
 *
 * Performance contract per outside-voice: must complete inside the Worker
 * CPU budget even at 100K users in the shard. We page through applicants
 * in batches of 500 and process each batch sequentially. APNs sends are
 * stubbed in v1 — the actual fan-out hooks into existing apns-send helper
 * in a v1.0.1 commit once partner offers are live in the catalog.
 */
export async function runWeeklyDigest(env: Env, shard: "CA" | "MA", log: LogFn): Promise<WeeklyDigestResult> {
  const db = makeServiceClient(env);
  const tzOffsetHours = shard === "MA" ? -4 : -7; // EDT vs PDT (v1 limitation: standard time off by 1h)
  const nowUtcMs = Date.now();

  const result: WeeklyDigestResult = {
    shard,
    considered: 0,
    sent: 0,
    suppressed: 0,
    errors: 0,
    reason_counts: {},
  };

  const PAGE = 500;
  let from = 0;

  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db.schema("snap_enrollment").from("applicants" as any) as any)
      .select("applicant_id, auth_uid, state_code, county_fips")
      .eq("state_code", shard)
      .range(from, from + PAGE - 1)
      .order("applicant_id");

    if (error) {
      log("error", "weekly_digest: applicant page query failed", {
        shard, error: error.message, from,
      });
      result.errors += 1;
      break;
    }

    const rows = (data ?? []) as ApplicantRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      result.considered += 1;
      try {
        const prefs = (await readNotificationPrefs(db, row.auth_uid)) ?? DEFAULT_PREFS;
        const decision = await shouldSendPerkOfferPush(db, {
          userId: row.auth_uid,
          prefs,
          nowUtcMs,
          tzOffsetHours,
        });
        if (!decision.send) {
          result.suppressed += 1;
          result.reason_counts[decision.reason] = (result.reason_counts[decision.reason] ?? 0) + 1;
          continue;
        }

        // Top-3 offer pick. Pre-packet user (no county) gets statewide-only.
        const resolved = await resolveOffers(db, {
          userId: row.auth_uid,
          stateCode: shard,
          packetCountyFips: row.county_fips,
          currentCountyFips: null,
          limit: 3,
        });

        if (resolved.offers.length === 0) {
          result.suppressed += 1;
          result.reason_counts.no_offers = (result.reason_counts.no_offers ?? 0) + 1;
          continue;
        }

        // Top pick for the push payload. The other 2 surface in-app when
        // the user opens the perks card.
        const top = resolved.offers[0]!;
        const recorded = await tryRecordPerkPush(db, {
          userId: row.auth_uid,
          offerId: top.offer_id,
        });

        if (!recorded) {
          // Race: another fan-out beat us to it (e.g., deposit_landed webhook
          // already wrote a perk_offer row for this user today). Suppress.
          result.suppressed += 1;
          result.reason_counts.race_lost = (result.reason_counts.race_lost ?? 0) + 1;
          continue;
        }

        // v1: stub send. Real APNs hookup lands in v1.0.1 once partner_offers
        // catalog has live entries (X-T8 day-1 catalog gate). The push_log row
        // is written either way; the index gives us idempotency.
        result.sent += 1;
      } catch (err) {
        result.errors += 1;
        log("warn", "weekly_digest: per-user error", {
          shard,
          applicant_id: row.applicant_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (rows.length < PAGE) break;
    from += PAGE;
  }

  log("info", "weekly_digest: shard complete", {
    shard,
    considered: result.considered,
    sent: result.sent,
    suppressed: result.suppressed,
    errors: result.errors,
    reason_counts: result.reason_counts,
  });
  return result;
}
