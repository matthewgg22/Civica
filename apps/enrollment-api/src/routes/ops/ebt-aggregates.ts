/**
 * GET /ops/ebt-aggregates — Panel 1 of /ops dashboard.
 *
 * Returns total $ across all tracked Civica user cards, # active trackers,
 * and total card count. Reads the snap_enrollment.ebt_card_aggregates_v view.
 *
 * Per D14: v1 ships with the plain SUM query via the view. When this endpoint's
 * p99 crosses 200ms (alert configured), v1.1 swaps the view for a snapshot
 * table refreshed every 60s by a cron.
 *
 * 30d trend is NOT included in v1 because ebt_cards has no balance-history
 * snapshots. v1.1 adds a daily snapshot table to power the Sparkline.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { makeServiceClient } from "../../lib/supabase.js";
import { requireOperator } from "../../lib/auth.js";
import { logOpsAccess } from "./audit.js";
import type { Env } from "../../types.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const startedAt = Date.now();
  const actor = c.get("actor");
  requireOperator(actor.kind);

  const db = makeServiceClient(c.env);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("ebt_card_aggregates_v" as any) as any)
    .select("total_balance_cents, active_tracker_count, total_card_count, latest_balance_at")
    .maybeSingle() as {
      data: {
        total_balance_cents: number;
        active_tracker_count: number;
        total_card_count: number;
        latest_balance_at: string | null;
      } | null;
      error: { message: string } | null;
    };

  if (error) {
    logOpsAccess(c, actor, "/ops/ebt-aggregates", 500, Date.now() - startedAt);
    throw new HTTPException(500, { message: error.message });
  }

  const body = {
    total_balance_cents: data?.total_balance_cents ?? 0,
    active_tracker_count: data?.active_tracker_count ?? 0,
    total_card_count: data?.total_card_count ?? 0,
    latest_balance_at: data?.latest_balance_at ?? null,
    freshness_label: "Updated every 30s · scraper freshness ≤30 min",
  };

  logOpsAccess(c, actor, "/ops/ebt-aggregates", 200, Date.now() - startedAt);
  return c.json(body);
});

export default app;
