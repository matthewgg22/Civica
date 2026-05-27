/**
 * /me/offers — applicant-side offer surface for the offer-moment platform.
 *
 * Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (B-T3 + B-T4).
 *
 * Routes:
 *   GET  /me/offers?packet_county=&current_county=&state_code=&limit=
 *        → resolved offer list OR free_resources payload (distress honor)
 *   GET  /me/offers/:id
 *        → single-offer refetch for staleness verification on tap
 *   POST /me/offers/events
 *        → impression/click event emission (county-bucketed, no user_id retained)
 *
 * Auth: requireAuthenticated — pre-packet applicants need to see statewide
 * offers; staff actors land here too without harm (resolver still applies
 * per-user distress check + tx-category match).
 *
 * Privacy posture (per E7/F10):
 *   - /me/offers + /me/offers/:id: NO audit_log writes. Sentry tags only.
 *   - /me/offers/events:           county-bucketed aggregate write, no user_id.
 *   The /me/redemptions route (separate file) IS audit-logged per-user.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { makeServiceClient } from "../lib/supabase.js";
import { requireAuthenticated } from "../lib/auth.js";
import { resolveOffers } from "../lib/offers/resolver.js";
import { isDistressed } from "../lib/offers/distress.js";
import type { Logger } from "../lib/logger.js";
import type { Env, Variables } from "../types.js";

/**
 * Lightweight inline structured-log helper. Per X-T3 (Sentry offer_endpoint
 * tagging), routes write structured JSON via c.get("log"). The structured
 * fields land in Cloudflare Logs and downstream Sentry integration.
 *
 * Tags are written as fields here; a follow-up X-T3 commit can promote them
 * to Sentry scope tags once the codebase has a Sentry tag helper.
 */
function withTags(
  log: Logger | undefined,
  msg: string,
  tags: Record<string, string | number | boolean | null>,
): void {
  log?.info(msg, { offer_endpoint: true, ...tags });
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

function parseStateCode(raw: string | undefined): "CA" | "MA" {
  return raw === "MA" ? "MA" : "CA";
}

function parseLimit(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 6;
  return Math.min(20, Math.floor(n));
}

function parseCounty(raw: string | undefined | null): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  return /^\d{5}$/.test(raw) ? raw : null;
}

// ────────────────────────────────────────────────────────────────────────────
// GET /me/offers — resolved list (or free_resources when distressed)
// ────────────────────────────────────────────────────────────────────────────

app.get("/", async (c) => {
  const actor = c.get("actor");
  requireAuthenticated(actor.kind);

  const url = new URL(c.req.url);
  const packetCounty = parseCounty(url.searchParams.get("packet_county"));
  const currentCounty = parseCounty(url.searchParams.get("current_county"));
  const stateCode = parseStateCode(url.searchParams.get("state_code") ?? undefined);
  const limit = parseLimit(url.searchParams.get("limit") ?? undefined);

  const db = makeServiceClient(c.env);

  try {
    const result = await resolveOffers(db, {
      userId: actor.id,
      stateCode,
      packetCountyFips: packetCounty,
      currentCountyFips: currentCounty,
      limit,
    });

    withTags(c.get("log") as Logger | undefined, "me_offers_resolved", {
      distressed: result.meta.distressed,
      statewide_fallback: result.meta.statewideFallback,
      use_fallback: result.meta.useFallback,
      county_mismatch:
        packetCounty && currentCounty && packetCounty !== currentCounty ? true : false,
      candidate_count: result.meta.candidateCount,
      served_count: result.offers.length,
    });

    return c.json({
      offers: result.offers,
      free_resources: result.free_resources,
      meta: {
        state_code: stateCode,
        served_count: result.offers.length,
        free_resources_count: result.free_resources?.length ?? 0,
        valid_until_window_minutes: 5,
      },
    });
  } catch (err) {
    (c.get("log") as Logger | undefined)?.error("me_offers_resolver_failed", {
      offer_endpoint: true,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new HTTPException(503, { message: "Offer service temporarily unavailable" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /me/offers/:id — staleness re-verify on tap
// ────────────────────────────────────────────────────────────────────────────

app.get("/:id", async (c) => {
  const actor = c.get("actor");
  requireAuthenticated(actor.kind);

  const offerId = c.req.param("id");
  if (!/^[0-9a-f-]{36}$/i.test(offerId)) {
    throw new HTTPException(400, { message: "Invalid offer id" });
  }

  const db = makeServiceClient(c.env);

  // Re-check distress on every tap-resolve — the user may have transitioned
  // to active distress between the initial /me/offers fetch and this tap.
  if (await isDistressed(db, actor.id)) {
    withTags(c.get("log") as Logger | undefined, "me_offers_single_suppressed_distress", {
      offer_id: offerId,
    });
    return c.json({ status: "OFFER_SUPPRESSED" }, 410);
  }

  const nowIso = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("partner_offers" as any) as any)
    .select(
      "offer_id, name, partner_name, category, description, county_fips_list, expected_savings_cents, expected_revenue_cents, start_at, end_at, tier, state_code, category_tags, merchant_id",
    )
    .eq("offer_id", offerId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    (c.get("log") as Logger | undefined)?.error("me_offers_single_fetch_failed", {
      offer_endpoint: true,
      offer_id: offerId,
    });
    throw new HTTPException(503, { message: "Offer service temporarily unavailable" });
  }

  if (!data) {
    withTags(c.get("log") as Logger | undefined, "me_offers_single_expired", { offer_id: offerId });
    return c.json({ status: "OFFER_EXPIRED" }, 410);
  }

  // Validate the date window — catalog row is active but its end_at may have
  // lapsed between catalog reads (the .eq("active", true) doesn't catch that).
  const offer = data as { start_at: string | null; end_at: string | null };
  if (offer.end_at && offer.end_at <= nowIso) {
    withTags(c.get("log") as Logger | undefined, "me_offers_single_expired_end_at", { offer_id: offerId });
    return c.json({ status: "OFFER_EXPIRED" }, 410);
  }
  if (offer.start_at && offer.start_at > nowIso) {
    withTags(c.get("log") as Logger | undefined, "me_offers_single_not_yet_active", { offer_id: offerId });
    return c.json({ status: "OFFER_NOT_YET_ACTIVE" }, 410);
  }

  withTags(c.get("log") as Logger | undefined, "me_offers_single_resolved", { offer_id: offerId });
  return c.json({
    status: "OK",
    offer: data,
    valid_until: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /me/offers/events — impression/click emission (county-bucketed)
// ────────────────────────────────────────────────────────────────────────────

interface EventBody {
  offer_id: string;
  event_type: "impression" | "click";
  county_fips: string | null;
  occurred_at?: string;
}

function isValidEventBody(b: unknown): b is EventBody {
  if (!b || typeof b !== "object") return false;
  const x = b as Record<string, unknown>;
  if (typeof x.offer_id !== "string") return false;
  if (x.event_type !== "impression" && x.event_type !== "click") return false;
  if (x.county_fips !== null && typeof x.county_fips !== "string") return false;
  return true;
}

app.post("/events", async (c) => {
  const actor = c.get("actor");
  requireAuthenticated(actor.kind);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Body must be JSON" });
  }
  if (!isValidEventBody(body)) {
    throw new HTTPException(400, { message: "Invalid event body" });
  }

  const db = makeServiceClient(c.env);

  // Distress race-condition re-check: if the user flipped to active between
  // resolver call and this event write, silently no-op the write. The user
  // sees success; the event_aggregate row is not written; structured log
  // records the suppression for forensic trail (without user_id retained).
  if (await isDistressed(db, actor.id)) {
    withTags(c.get("log") as Logger | undefined, "offer_event_suppressed_distress", {
      event_type: body.event_type,
      offer_id: body.offer_id,
    });
    return c.json({ status: "ok" }, 200);
  }

  // Bucket: caller-supplied county_fips, or "00000" sentinel for unknown.
  const countyFips =
    typeof body.county_fips === "string" && /^\d{5}$/.test(body.county_fips)
      ? body.county_fips
      : "00000";

  // Revenue accounting: copy from catalog at write time so the aggregate row
  // reflects the per-event revenue contract that was active when the event
  // fired. (If admin later renegotiates the partner contract, old events
  // keep their original revenue figure.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: offerRow } = await (db.schema("snap_enrollment").from("partner_offers" as any) as any)
    .select("expected_revenue_cents")
    .eq("offer_id", body.offer_id)
    .maybeSingle();

  const revenueCents =
    offerRow && typeof (offerRow as { expected_revenue_cents?: number }).expected_revenue_cents === "number"
      ? (offerRow as { expected_revenue_cents: number }).expected_revenue_cents
      : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db.schema("snap_enrollment").from("partner_offer_events_aggregate" as any) as any)
    .insert({
      offer_id: body.offer_id,
      county_fips: countyFips,
      event_type: body.event_type,
      revenue_cents: body.event_type === "impression" ? revenueCents : 0,
      occurred_at: body.occurred_at ?? new Date().toISOString(),
    });

  if (error) {
    (c.get("log") as Logger | undefined)?.error("offer_event_write_failed", {
      offer_endpoint: true,
      event_type: body.event_type,
      offer_id: body.offer_id,
      error: error.message,
    });
    throw new HTTPException(500, { message: "Event write failed" });
  }

  withTags(c.get("log") as Logger | undefined, "offer_event_recorded", {
    event_type: body.event_type,
    offer_id: body.offer_id,
  });
  return c.json({ status: "ok" }, 200);
});

export default app;
