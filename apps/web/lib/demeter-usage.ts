// Durable rate-limit + spend controls for the public Demeter chat
// (eng review decisions 2A + T-B; Supabase-backed, NOT the in-memory
// per-instance limiters — those reset on every cold start and multiply by
// instance count on serverless).
//
// Two buckets in snap_enrollment.demeter_usage, both incremented through the
// atomic service-role-only RPC (migration 20260610):
//   spend:<YYYY-MM>         — dollars, LAGGING counter: checked before a
//                             request, settled with actual cost after the
//                             stream ends (callers use Next's after(); never
//                             fire-and-forget — a frozen lambda drops those).
//   ip:<sha256/16>:<window> — requests per IP per 60s window.
//
// FAIL-OPEN (T-B): if Supabase is unreachable the chat answers anyway and
// logs — availability wins because the Anthropic Console workspace cap ($200)
// is the hard backstop that cannot undercount. IPs are stored only as a
// truncated salted hash — never raw — this audience's privacy is the point.

import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase-server";

export const SPEND_CEILING_USD = Number(process.env.DEMETER_SPEND_CEILING_USD ?? 200);
export const RATE_LIMIT_PER_MINUTE = Number(process.env.DEMETER_RATE_PER_MINUTE ?? 10);

// Pinned-model pricing for settle (claude-sonnet-5, USD per million tokens).
// Overridable so a repriced or re-pinned model is a config change, not a deploy.
//
// THESE DEFAULTS WERE ALREADY WRONG. They said $15/$75, which is not Opus 4.8's
// price — Opus 4.8 is $5/$25 — so every answer was settled at 3x its real cost
// and the $200 ceiling would have tripped after roughly a third of the spend it
// was meant to allow. Erring toward cutting the service off early is the safe
// direction, which is exactly why nobody would have noticed.
//
// Sonnet 5 list price is $3/$15. Anthropic is running an introductory $2/$10
// through 2026-08-31; LIST is encoded deliberately, because pricing that
// UNDER-counts spend lets real cost run past the ceiling, and an intro rate
// hardcoded here would silently become an under-count the day it lapses.
// Over-counting for the remaining intro window is the direction that fails safe.
const INPUT_USD_PER_MTOK = Number(process.env.DEMETER_INPUT_USD_PER_MTOK ?? 3);
const OUTPUT_USD_PER_MTOK = Number(process.env.DEMETER_OUTPUT_USD_PER_MTOK ?? 15);

function ipBucket(ip: string, now: Date): string {
  const salt = process.env.DEMETER_IP_SALT ?? "demeter-v1";
  const hash = createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16);
  const window = Math.floor(now.getTime() / 60_000);
  return `ip:${hash}:${window}`;
}

function spendBucket(now: Date): string {
  return `spend:${now.toISOString().slice(0, 7)}`;
}

async function increment(bucket: string, amount: number): Promise<number> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .schema("snap_enrollment")
    .rpc("demeter_increment_and_check", { p_bucket: bucket, p_amount: amount });
  if (error) throw error;
  return Number(data);
}

export type UsageGate =
  | { allowed: true }
  | { allowed: false; reason: "rate_limited" | "at_capacity" };

/** Pre-answer gate: per-IP rate window + the monthly spend ceiling.
 *  The rate increment counts this request; the spend check reads the lagging
 *  total (increment 0). Fail-open on any counter error. */
export async function checkUsageGate(ip: string, now: Date = new Date()): Promise<UsageGate> {
  try {
    const requests = await increment(ipBucket(ip, now), 1);
    if (requests > RATE_LIMIT_PER_MINUTE) return { allowed: false, reason: "rate_limited" };
    const spend = await increment(spendBucket(now), 0);
    if (spend >= SPEND_CEILING_USD) return { allowed: false, reason: "at_capacity" };
    return { allowed: true };
  } catch (err) {
    console.warn(
      "[demeter-usage] counter unavailable — failing open:",
      err instanceof Error ? err.message : String(err),
    );
    return { allowed: true };
  }
}

export function costUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * INPUT_USD_PER_MTOK + outputTokens * OUTPUT_USD_PER_MTOK) / 1_000_000;
}

/** Rough token estimate for the abort path, where the SDK never reports usage
 *  (the engine's onUsage fires 0/0): chars/4, both directions. */
export function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}

/** Post-answer settle with actual (or estimated) cost. Call from Next's
 *  after() so a frozen lambda can't drop the write. Best-effort. */
export async function settleSpend(dollars: number, now: Date = new Date()): Promise<void> {
  if (!(dollars > 0)) return;
  try {
    await increment(spendBucket(now), Math.round(dollars * 10_000) / 10_000);
  } catch (err) {
    console.warn(
      "[demeter-usage] settle failed (spend undercounted; Console cap backstops):",
      err instanceof Error ? err.message : String(err),
    );
  }
}
