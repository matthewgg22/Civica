/**
 * GET /ops/notifications — Panel 3 of /ops dashboard.
 *
 * Aggregates notification_outlay_events for the past N days into a
 * channel × category matrix with counts and cost.
 *
 * cost_cents is stored at write time (per the migration's design note) so
 * this route never recomputes — it just sums.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { makeServiceClient } from "../../lib/supabase.js";
import { requireOperator } from "../../lib/auth.js";
import { logOpsAccess } from "./audit.js";
import type { Env } from "../../types.js";

interface OutlayRow {
  channel: "push" | "sms" | "email";
  category: string;
  cost_cents: number;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const startedAt = Date.now();
  const actor = c.get("actor");
  requireOperator(actor.kind);

  // Default to 30d; allow ?days=N override for ops investigation.
  const daysParam = c.req.query("days");
  const days = Math.max(1, Math.min(365, daysParam ? parseInt(daysParam, 10) : 30));
  if (Number.isNaN(days)) {
    throw new HTTPException(400, { message: "days must be a positive integer" });
  }
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

  const db = makeServiceClient(c.env);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("notification_outlay_events" as any) as any)
    .select("channel, category, cost_cents")
    .gte("sent_at", sinceIso) as {
      data: OutlayRow[] | null;
      error: { message: string } | null;
    };

  if (error) {
    logOpsAccess(c, actor, "/ops/notifications", 500, Date.now() - startedAt);
    throw new HTTPException(500, { message: error.message });
  }

  const rows = data ?? [];

  // channel × category matrix
  const matrix = new Map<string, Map<string, { count: number; cost_cents: number }>>();
  let totalCount = 0;
  let totalCostCents = 0;

  for (const r of rows) {
    if (!matrix.has(r.channel)) matrix.set(r.channel, new Map());
    const channelMap = matrix.get(r.channel)!;
    const cell = channelMap.get(r.category) ?? { count: 0, cost_cents: 0 };
    cell.count += 1;
    cell.cost_cents += r.cost_cents;
    channelMap.set(r.category, cell);
    totalCount += 1;
    totalCostCents += r.cost_cents;
  }

  const cells: Array<{ channel: string; category: string; count: number; cost_cents: number }> = [];
  for (const [channel, byCat] of matrix) {
    for (const [category, v] of byCat) {
      cells.push({ channel, category, count: v.count, cost_cents: v.cost_cents });
    }
  }

  const body = {
    window_days: days,
    cells,
    total_count: totalCount,
    total_cost_cents: totalCostCents,
  };

  logOpsAccess(c, actor, "/ops/notifications", 200, Date.now() - startedAt);
  return c.json(body);
});

export default app;
