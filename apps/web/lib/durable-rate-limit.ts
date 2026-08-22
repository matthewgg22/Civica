// Durable, cross-instance rate limiting on the counter RPC.
//
// apps/web/app/api/auth/rate-limit.ts is in-memory: it resets on cold start
// and each serverless instance keeps its own map, so an attacker's real
// allowance is (limit × instances). That is fine for the SMS route it was
// written for, where the spend is ours and the Console cap backstops it.
//
// It is NOT fine for emailing a sign-in link, because the cost of abuse lands
// on the RECIPIENT: someone types a stranger's address and that stranger gets
// the mail. So this uses snap_enrollment.demeter_increment_and_check — the
// same atomic counter behind the spend ceiling — which every instance shares.
//
// FAILS OPEN, consistent with the rest of the usage gate: a counter outage
// must not lock people out of signing in. The window is short and the caller
// still has the in-memory limiter as a second line.

import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase-server";

function hashed(value: string): string {
  const salt = process.env.DEMETER_IP_SALT ?? "demeter-v1";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 16);
}

/**
 * Count one hit against `namespace:hash(subject):window` and report whether it
 * is still under `max`.
 *
 * `subject` is hashed, never stored raw — it may be an IP or an email address,
 * and an email address in a counter table would be a record of who asked about
 * food assistance.
 */
export async function durableRateLimit(
  namespace: string,
  subject: string,
  max: number,
  windowMs: number,
  now: Date = new Date(),
): Promise<boolean> {
  const window = Math.floor(now.getTime() / windowMs);
  const bucket = `${namespace}:${hashed(subject)}:${window}`;
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .schema("snap_enrollment")
      .rpc("demeter_increment_and_check", { p_bucket: bucket, p_amount: 1 });
    if (error) throw error;
    return Number(data) <= max;
  } catch (err) {
    console.warn(
      "[durable-rate-limit] counter unavailable, allowing:",
      err instanceof Error ? err.message : String(err),
    );
    return true;
  }
}
