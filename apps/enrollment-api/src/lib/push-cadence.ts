/**
 * Push cadence policy enforcement for the offer-moment platform.
 *
 * Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (B-T6).
 *
 * Gates (per the cadence policy block in the plan):
 *   1. perksOn === true                         — user has not opted out
 *   2. NOT distressed                            — silent-honor override (E3)
 *   3. NOT within quiet hours (user-local TZ)   — DESIGN.md respect
 *   4. NOT within 24h of previous perk_offer    — DB-enforced via unique
 *                                                  partial index (F12 fix)
 *
 * Quiet hours model: stored as TIME (no timezone) in ebt_notification_prefs.
 * Interpreted against the recipient-local clock. Wrap-around supported
 * (e.g., 21:00–08:00 spans midnight).
 *
 * 24h floor model: unique partial index on user_push_log
 * `(user_id, date_trunc('day', sent_at)) WHERE category = 'perk_offer'`
 * makes the floor a DB invariant. The route calls `tryRecordPerkPush()`
 * which INSERT … ON CONFLICT DO NOTHING — collision = suppressed.
 *
 * The cadence check pre-gates BEFORE the insert (cheap query) so the route
 * can early-return without doing the APNs payload build. The post-insert
 * ON CONFLICT is the safety net for fan-out races (e.g., digest cron firing
 * while deposit_landed webhook fires for the same user in the same UTC day).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isDistressed } from "./offers/distress.js";

export interface CadenceDecision {
  send: boolean;
  reason:
    | "ok"
    | "perks_off"
    | "distress"
    | "quiet_hours"
    | "within_24h"
    | "prefs_unavailable";
}

export interface NotificationPrefs {
  perks_on: boolean;
  quiet_start: string; // "21:00" or "21:00:00"
  quiet_end: string;   // "08:00" or "08:00:00"
}

/**
 * Parses a TIME literal ("HH:MM" or "HH:MM:SS") to minutes-since-midnight.
 * Returns null for malformed input.
 */
export function parseTimeMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/.exec(t);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/**
 * True iff `nowMinutes` falls inside [start, end), accounting for ranges
 * that wrap midnight (e.g., 21:00–08:00 is quiet from 21:00 today through
 * 08:00 tomorrow).
 */
export function isInQuietHours(
  nowMinutes: number,
  quietStart: string,
  quietEnd: string,
): boolean {
  const startM = parseTimeMinutes(quietStart);
  const endM = parseTimeMinutes(quietEnd);
  if (startM === null || endM === null) return false; // fail open
  if (startM === endM) return false; // zero-length window
  if (startM < endM) {
    // Same-day window (e.g., 02:00 - 06:00)
    return nowMinutes >= startM && nowMinutes < endM;
  }
  // Wraps midnight (e.g., 21:00 - 08:00 — quiet from 21:00 OR before 08:00)
  return nowMinutes >= startM || nowMinutes < endM;
}

/**
 * Resolves the user's local "now" minutes-since-midnight from a UTC clock
 * and a TZ offset in hours. Negative-mod-safe via the `((x % 1440) + 1440)`
 * idiom.
 */
export function userLocalMinutes(nowUtcMs: number, tzOffsetHours: number): number {
  const localMs = nowUtcMs + tzOffsetHours * 60 * 60_000;
  const localDate = new Date(localMs);
  return localDate.getUTCHours() * 60 + localDate.getUTCMinutes();
}

/**
 * Pre-flight cadence check. Returns a decision; the caller decides whether
 * to build the APNs payload + invoke tryRecordPerkPush().
 *
 * The 24h floor pre-check uses a SELECT against user_push_log, but the
 * authoritative enforcement is the unique partial index inside
 * tryRecordPerkPush(). Skipping the pre-check is acceptable; doing both
 * saves the APNs round-trip on suppression.
 */
export async function shouldSendPerkOfferPush(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, "snap_enrollment", any> | any,
  args: {
    userId: string;
    prefs: NotificationPrefs;
    nowUtcMs: number;
    tzOffsetHours: number;
  },
): Promise<CadenceDecision> {
  // 1. User preference (cheapest check first)
  if (!args.prefs.perks_on) return { send: false, reason: "perks_off" };

  // 2. Quiet hours (no DB hit)
  const minutes = userLocalMinutes(args.nowUtcMs, args.tzOffsetHours);
  if (isInQuietHours(minutes, args.prefs.quiet_start, args.prefs.quiet_end)) {
    return { send: false, reason: "quiet_hours" };
  }

  // 3. Distress (single indexed query)
  if (await isDistressed(db, args.userId)) {
    return { send: false, reason: "distress" };
  }

  // 4. 24h floor pre-check (will be re-enforced by unique partial index)
  const since = new Date(args.nowUtcMs - 24 * 60 * 60_000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("user_push_log" as any) as any)
    .select("push_id")
    .eq("user_id", args.userId)
    .eq("category", "perk_offer")
    .gte("sent_at", since)
    .limit(1);

  if (error) {
    // Fail closed: if we can't verify the floor, suppress. Safer than spamming.
    return { send: false, reason: "prefs_unavailable" };
  }
  if (Array.isArray(data) && data.length > 0) {
    return { send: false, reason: "within_24h" };
  }

  return { send: true, reason: "ok" };
}

/**
 * Atomically records a perk_offer push. ON CONFLICT DO NOTHING against the
 * unique partial index `(user_id, date_trunc('day', sent_at))` — race-safe
 * against concurrent fan-out (digest + deposit_landed both firing same
 * user same UTC day).
 *
 * Returns true on successful insert. Returns false when the index suppressed
 * the row (already exists for today). The caller should NOT send APNs when
 * this returns false.
 */
export async function tryRecordPerkPush(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, "snap_enrollment", any> | any,
  args: { userId: string; offerId: string },
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("user_push_log" as any) as any)
    .insert(
      {
        user_id: args.userId,
        category: "perk_offer",
        offer_id: args.offerId,
        sent_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date_trunc_day", ignoreDuplicates: true },
    )
    .select("push_id");

  if (error) {
    // The unique partial index throws as a constraint violation. Supabase
    // returns the error; we map that to "did not record" so the caller
    // suppresses APNs.
    return false;
  }
  // ignoreDuplicates returns empty array on conflict, single-element on insert.
  return Array.isArray(data) && data.length > 0;
}

/**
 * Convenience: read the user's notification prefs in one call. Returns null
 * when the row doesn't exist yet (user hasn't visited prefs screen — apply
 * plan defaults at the caller).
 */
export async function readNotificationPrefs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, "snap_enrollment", any> | any,
  userId: string,
): Promise<NotificationPrefs | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("ebt_notification_prefs" as any) as any)
    .select("perks_on, quiet_start, quiet_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as { perks_on: boolean; quiet_start: string; quiet_end: string };
  return {
    perks_on: row.perks_on,
    quiet_start: row.quiet_start,
    quiet_end: row.quiet_end,
  };
}

/** Plan default per §4.4: perks-on, 9pm-8am quiet. */
export const DEFAULT_PREFS: NotificationPrefs = {
  perks_on: true,
  quiet_start: "21:00",
  quiet_end: "08:00",
};
