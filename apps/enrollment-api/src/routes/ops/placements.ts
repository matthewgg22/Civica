/**
 * GET /ops/placements — Panel 2 of /ops dashboard.
 *
 * Reshaped per D12: returns *planned* placements (from partner_offers catalog),
 * not *served* impressions. iOS click-event instrumentation lands in v1.1; at
 * that point this route swaps its source to partner_offer_events_aggregate.
 *
 * Response shape: aggregated by county_fips.
 *   - placement_count: number of active offers planned for the county
 *   - expected_revenue_cents: sum of catalog-level expected revenue
 *   - categories: distinct categories of offers in this county
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { makeServiceClient } from "../../lib/supabase.js";
import { requireOperator } from "../../lib/auth.js";
import { logOpsAccess } from "./audit.js";
import type { Env } from "../../types.js";

interface OfferRow {
  offer_id: string;
  name: string;
  partner_name: string;
  category: string;
  county_fips_list: string[];
  expected_revenue_cents: number;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const startedAt = Date.now();
  const actor = c.get("actor");
  requireOperator(actor.kind);

  const nowIso = new Date().toISOString();
  const db = makeServiceClient(c.env);

  // Pull active offers in their effective date window. Aggregation is done
  // in TypeScript rather than SQL because we need to unnest county_fips_list
  // and that's clumsier in a Supabase select than a small in-memory loop.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("partner_offers" as any) as any)
    .select("offer_id, name, partner_name, category, county_fips_list, expected_revenue_cents")
    .eq("active", true)
    .or(`start_at.is.null,start_at.lte.${nowIso}`)
    .or(`end_at.is.null,end_at.gt.${nowIso}`) as {
      data: OfferRow[] | null;
      error: { message: string } | null;
    };

  if (error) {
    logOpsAccess(c, actor, "/ops/placements", 500, Date.now() - startedAt);
    throw new HTTPException(500, { message: error.message });
  }

  const offers = data ?? [];

  // Aggregate: county_fips → { count, revenue, categories }
  const byCounty = new Map<string, { count: number; revenue: number; categories: Set<string> }>();
  for (const o of offers) {
    // Empty county_fips_list = statewide. We bucket statewide offers under "STATEWIDE"
    // so the map can surface them on every county or in a footer.
    const counties = o.county_fips_list.length > 0 ? o.county_fips_list : ["STATEWIDE"];
    for (const fips of counties) {
      const existing = byCounty.get(fips) ?? { count: 0, revenue: 0, categories: new Set<string>() };
      existing.count += 1;
      existing.revenue += o.expected_revenue_cents;
      existing.categories.add(o.category);
      byCounty.set(fips, existing);
    }
  }

  const placements = [...byCounty.entries()]
    .map(([county_fips, v]) => ({
      county_fips,
      placement_count: v.count,
      expected_revenue_cents: v.revenue,
      categories: [...v.categories].sort(),
    }))
    .sort((a, b) => b.placement_count - a.placement_count);

  const body = {
    placements,
    total_active_offers: offers.length,
    footer: "Showing planned placements. Served-impression data pending iOS click-event instrumentation.",
  };

  logOpsAccess(c, actor, "/ops/placements", 200, Date.now() - startedAt);
  return c.json(body);
});

export default app;
