/**
 * POST /me/redemptions — self-attest redemption recorder.
 *
 * Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (B-T5).
 *
 * Atomicity (A4 outside-voice fix): writes user_redemptions + bumps
 * user_savings_tally inside a single PG transaction via the SECURITY DEFINER
 * function `snap_enrollment.record_redemption`. Concurrent redemptions cannot
 * lose updates.
 *
 * Anti-inflation cap (per plan Long-term trajectory): server-side validates
 * `savings_cents <= offer.expected_savings_cents`. iOS-side UI also caps,
 * but server is the truth source.
 *
 * Distress race-condition handling: re-check on every write. If the user
 * flipped to active between offer fetch and redemption, silently no-op
 * (return 200, do not write, do not bump tally). User cannot see they were
 * suppressed.
 *
 * Audit-log scope (per E7/F10): /me/redemptions writes BOTH structured logs
 * AND audit_log (per-user retention is already counsel-covered by the
 * user_redemptions table itself). /me/offers/events does NOT write audit_log
 * — that's the privacy-posture boundary.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { makeServiceClient } from "../lib/supabase.js";
import { requireAuthenticated } from "../lib/auth.js";
import { isDistressed } from "../lib/offers/distress.js";
import type { Env, Variables } from "../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

interface RedemptionBody {
  offer_id: string;
  method: "self_attest" | "ocr";
  savings_cents: number;
}

function isValidRedemptionBody(b: unknown): b is RedemptionBody {
  if (!b || typeof b !== "object") return false;
  const x = b as Record<string, unknown>;
  if (typeof x.offer_id !== "string" || !/^[0-9a-f-]{36}$/i.test(x.offer_id)) return false;
  if (x.method !== "self_attest" && x.method !== "ocr") return false;
  if (typeof x.savings_cents !== "number" || !Number.isInteger(x.savings_cents) || x.savings_cents < 0) {
    return false;
  }
  // Sanity cap: $10,000 in savings on a single offer is implausible. Reject.
  if (x.savings_cents > 1_000_000) return false;
  return true;
}

app.post("/", async (c) => {
  const actor = c.get("actor");
  requireAuthenticated(actor.kind);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Body must be JSON" });
  }
  if (!isValidRedemptionBody(body)) {
    throw new HTTPException(400, { message: "Invalid redemption body" });
  }

  // v1 ships self-attest only. OCR ships in v1.1 behind a feature flag.
  if (body.method === "ocr") {
    throw new HTTPException(400, {
      message: "OCR redemption is not yet enabled. Use self_attest in v1.",
    });
  }

  const db = makeServiceClient(c.env);
  const log = c.get("log");

  // 1. Distress race-condition re-check — silent no-op if flipped to active.
  if (await isDistressed(db, actor.id)) {
    log?.info("me_redemption_suppressed_distress", {
      offer_endpoint: true,
      offer_id: body.offer_id,
    });
    return c.json({ status: "ok" }, 200);
  }

  // 2. Re-verify the offer is still active + within window AND read the
  //    anti-inflation cap.
  const nowIso = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: offerRow, error: offerErr } = await (db.schema("snap_enrollment").from("partner_offers" as any) as any)
    .select("offer_id, active, start_at, end_at, expected_savings_cents")
    .eq("offer_id", body.offer_id)
    .maybeSingle();

  if (offerErr) {
    log?.error("me_redemption_offer_lookup_failed", {
      offer_endpoint: true,
      offer_id: body.offer_id,
      error: offerErr.message,
    });
    throw new HTTPException(503, { message: "Redemption service temporarily unavailable" });
  }

  if (!offerRow) {
    return c.json({ status: "OFFER_NOT_FOUND" }, 410);
  }
  const offer = offerRow as {
    active: boolean;
    start_at: string | null;
    end_at: string | null;
    expected_savings_cents: number;
  };
  if (!offer.active) return c.json({ status: "OFFER_EXPIRED" }, 410);
  if (offer.end_at && offer.end_at <= nowIso) return c.json({ status: "OFFER_EXPIRED" }, 410);
  if (offer.start_at && offer.start_at > nowIso) return c.json({ status: "OFFER_NOT_YET_ACTIVE" }, 410);

  // 3. Anti-inflation cap — server is truth source.
  const cap = offer.expected_savings_cents;
  const finalSavings = Math.min(body.savings_cents, cap);

  // 4. Atomic INSERT + UPSERT via stored function (migration 20260588).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcData, error: rpcErr } = await (db as any).rpc("record_redemption", {
    p_user_id: actor.id,
    p_offer_id: body.offer_id,
    p_method: body.method,
    p_savings_cents: finalSavings,
  });

  if (rpcErr) {
    log?.error("me_redemption_rpc_failed", {
      offer_endpoint: true,
      offer_id: body.offer_id,
      error: (rpcErr as { message?: string }).message ?? String(rpcErr),
    });
    throw new HTTPException(500, { message: "Redemption record failed" });
  }

  // PostgREST returns table-function results as arrays of row objects.
  const firstRow = Array.isArray(rpcData)
    ? (rpcData[0] as { redemption_id: string; total_savings_cents: number } | undefined)
    : (rpcData as { redemption_id: string; total_savings_cents: number } | undefined);

  if (!firstRow) {
    log?.error("me_redemption_rpc_empty_result", { offer_endpoint: true, offer_id: body.offer_id });
    throw new HTTPException(500, { message: "Redemption record failed" });
  }

  // 5. Per-user audit_log write (E7/F10: redemptions ARE audit-logged,
  //    events are NOT). Fire-and-forget — do not block the response on it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (db.schema("snap_enrollment").from("ops_audit_log" as any) as any)
    .insert({
      actor_user_id: actor.id,
      endpoint: "/me/redemptions",
      method: "POST",
      status_code: 200,
      duration_ms: 0,
      request_ip: c.req.header("CF-Connecting-IP") ?? null,
      user_agent: c.req.header("User-Agent") ?? null,
    })
    .then(() => null)
    .catch(() => null);

  log?.info("me_redemption_recorded", {
    offer_endpoint: true,
    offer_id: body.offer_id,
    method: body.method,
    savings_cents: finalSavings,
    capped: finalSavings < body.savings_cents,
  });

  return c.json(
    {
      status: "ok",
      redemption_id: firstRow.redemption_id,
      savings_cents: finalSavings,
      total_savings_cents: firstRow.total_savings_cents,
      capped: finalSavings < body.savings_cents,
    },
    200,
  );
});

export default app;
