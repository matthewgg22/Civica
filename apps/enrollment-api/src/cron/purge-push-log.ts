/**
 * Daily cron — purge user_push_log rows older than 30 days.
 *
 * Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (X-T5).
 *
 * The 24h cadence floor only needs the last 24h of history; the 30d window
 * gives ops debugging headroom without unbounded growth. Runs at 04:00 UTC
 * daily — off-hours for both PT and ET.
 */

import { makeServiceClient } from "../lib/supabase.js";
import type { Env } from "../types.js";

export type LogFn = (level: "info" | "warn" | "error", msg: string, ctx?: Record<string, unknown>) => void;

export async function purgeOldPushLog(env: Env, log: LogFn): Promise<{ rows_purged: number }> {
  const db = makeServiceClient(env);
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("user_push_log" as any) as any)
    .delete()
    .lt("sent_at", cutoff)
    .select("push_id");

  if (error) {
    log("error", "purge_push_log: delete failed", { error: error.message });
    return { rows_purged: 0 };
  }

  const count = Array.isArray(data) ? data.length : 0;
  log("info", "purge_push_log: complete", { rows_purged: count, cutoff });
  return { rows_purged: count };
}
