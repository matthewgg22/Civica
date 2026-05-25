/**
 * GET /ops/partner-pnl — Panel 6 of /ops dashboard.
 *
 * Partner-offer P&L, impressions-only in v1.
 *
 * Per D12: iOS doesn't emit click/conversion events yet, so v1 reads only the
 * impression rows from partner_offer_events_aggregate. v1.1 unlocks clicks +
 * conversions once iOS instrumentation lands.
 *
 * Per D13: partner_offer_events_aggregate has NO user_id (county-bucketed
 * only). Revenue-per-active-tracker uses the global active count from
 * ebt_card_aggregates_v as denominator.
 *
 * Redistribution % = $saved / ($saved + $revenue) — the redistribution-framed
 * monetization story.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { makeServiceClient } from "../../lib/supabase.js";
import { requireOperator } from "../../lib/auth.js";
import { logOpsAccess } from "./audit.js";
import type { Env } from "../../types.js";

interface EventRow {
  offer_id: string;
  event_type: "impression" | "click" | "conversion";
  revenue_cents: number;
}

interface OfferRow {
  offer_id: string;
  expected_savings_cents: number;
}

interface AggRow {
  total_balance_cents: number;
  active_tracker_count: number;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const startedAt = Date.now();
  const actor = c.get("actor");
  requireOperator(actor.kind);

  const daysParam = c.req.query("days");
  const days = Math.max(1, Math.min(365, daysParam ? parseInt(daysParam, 10) : 30));
  if (Number.isNaN(days)) {
    throw new HTTPException(400, { message: "days must be a positive integer" });
  }
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

  const db = makeServiceClient(c.env);

  // Events in window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events, error: eErr } = await (db.schema("snap_enrollment").from("partner_offer_events_aggregate" as any) as any)
    .select("offer_id, event_type, revenue_cents")
    .gte("occurred_at", sinceIso) as { data: EventRow[] | null; error: { message: string } | null };

  if (eErr) {
    logOpsAccess(c, actor, "/ops/partner-pnl", 500, Date.now() - startedAt);
    throw new HTTPException(500, { message: eErr.message });
  }
  const eventRows = events ?? [];

  // Catalog for expected_savings_cents per offer
  const offerIds = [...new Set(eventRows.map((e) => e.offer_id))];
  const savingsByOffer = new Map<string, number>();
  if (offerIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: offers, error: oErr } = await (db.schema("snap_enrollment").from("partner_offers" as any) as any)
      .select("offer_id, expected_savings_cents")
      .in("offer_id", offerIds) as { data: OfferRow[] | null; error: { message: string } | null };
    if (oErr) {
      logOpsAccess(c, actor, "/ops/partner-pnl", 500, Date.now() - startedAt);
      throw new HTTPException(500, { message: oErr.message });
    }
    for (const o of offers ?? []) {
      savingsByOffer.set(o.offer_id, o.expected_savings_cents);
    }
  }

  let impressions = 0;
  let clicks = 0;
  let conversions = 0;
  let revenueCents = 0;
  let savedCents = 0;
  for (const ev of eventRows) {
    if (ev.event_type === "impression") {
      impressions += 1;
      savedCents += savingsByOffer.get(ev.offer_id) ?? 0;
    } else if (ev.event_type === "click") {
      clicks += 1;
    } else {
      conversions += 1;
    }
    revenueCents += ev.revenue_cents;
  }

  // Active-tracker denominator from the view
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agg, error: aErr } = await (db.schema("snap_enrollment").from("ebt_card_aggregates_v" as any) as any)
    .select("total_balance_cents, active_tracker_count")
    .maybeSingle() as { data: AggRow | null; error: { message: string } | null };

  if (aErr) {
    logOpsAccess(c, actor, "/ops/partner-pnl", 500, Date.now() - startedAt);
    throw new HTTPException(500, { message: aErr.message });
  }
  const activeTrackers = agg?.active_tracker_count ?? 0;

  const revenuePerActiveTrackerCents = activeTrackers > 0
    ? Math.round(revenueCents / activeTrackers)
    : 0;
  const redistributionPct = (revenueCents + savedCents) > 0
    ? Math.round((savedCents / (revenueCents + savedCents)) * 1000) / 10
    : 0;

  const body = {
    window_days: days,
    impressions,
    clicks,
    conversions,
    revenue_cents: revenueCents,
    saved_cents: savedCents,
    revenue_per_active_tracker_cents: revenuePerActiveTrackerCents,
    redistribution_pct: redistributionPct,
    active_trackers: activeTrackers,
    footer: "Click + conversion data pending iOS instrumentation. v1 shows impression-derived estimates only.",
  };

  logOpsAccess(c, actor, "/ops/partner-pnl", 200, Date.now() - startedAt);
  return c.json(body);
});

export default app;
