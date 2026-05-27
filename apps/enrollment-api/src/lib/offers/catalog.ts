/**
 * Catalog query for the offer resolver.
 *
 * Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (B-T2c).
 *
 * Fetches active partner_offers in a given state matching ANY of the
 * supplied counties (or statewide-fallback when only "STATEWIDE" is passed).
 * Date-window filters applied. No ranking / scoring here — that's ranker.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shape we read off partner_offers for the resolver. Mirrors the columns
 * added in 20260587 + the original columns from 20260579.
 */
export interface PartnerOfferRow {
  offer_id: string;
  name: string;
  partner_name: string;
  category: string;
  description: string | null;
  county_fips_list: string[];
  expected_revenue_cents: number;
  expected_savings_cents: number;
  start_at: string | null;
  end_at: string | null;
  tier: "top" | "standard" | "none";
  state_code: "CA" | "MA";
  category_tags: string[]; // enum values surface as text from PostgREST
  merchant_id: string | null;
  merchant_name_normalized: string | null;
}

export interface CatalogQuery {
  stateCode: "CA" | "MA";
  counties: string[]; // from resolveCounties(); may be ["STATEWIDE"]
}

/**
 * Returns the active candidate set. Ranking happens downstream.
 *
 * Strategy: pull all active offers for the state, then filter by county
 * in TypeScript. County membership requires unnest+ANY against the
 * county_fips_list array; doing it in SQL via .contains() is workable but
 * the existing /ops/placements route already established the in-memory
 * filter pattern, and the catalog is small (hundreds of rows).
 */
export async function fetchCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, "snap_enrollment", any> | any,
  q: CatalogQuery,
): Promise<PartnerOfferRow[]> {
  const nowIso = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("partner_offers" as any) as any)
    .select(
      "offer_id, name, partner_name, category, description, county_fips_list, expected_revenue_cents, expected_savings_cents, start_at, end_at, tier, state_code, category_tags, merchant_id, merchant_name_normalized",
    )
    .eq("active", true)
    .eq("state_code", q.stateCode)
    .or(`start_at.is.null,start_at.lte.${nowIso}`)
    .or(`end_at.is.null,end_at.gt.${nowIso}`);

  if (error) return [];

  const offers = (data ?? []) as PartnerOfferRow[];
  const wantStatewide = q.counties.includes("STATEWIDE");
  const wantCounties = new Set(q.counties.filter((c) => c !== "STATEWIDE"));

  return offers.filter((o) => {
    // Empty county_fips_list = statewide offer; matches any caller.
    if (o.county_fips_list.length === 0) return true;
    // Caller explicitly wants statewide-only — exclude county-bound offers.
    if (wantStatewide && wantCounties.size === 0) return false;
    // County overlap match.
    for (const c of o.county_fips_list) {
      if (wantCounties.has(c)) return true;
    }
    return false;
  });
}

/**
 * Fetches the user's recent transaction categories from ebt_transactions.
 * Drives the resolver's category-match score. Empty result = useFallback
 * branch in ranker.ts (county-popularity ranking).
 *
 * Note: ebt_transactions has RLS owner-only — gateway calls this with
 * service-role client which bypasses RLS. The user_id filter is the
 * security boundary.
 */
export async function fetchRecentTxCategories(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, "snap_enrollment", any> | any,
  userId: string,
  windowDays = 60,
): Promise<string[]> {
  const sinceIso = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("ebt_transactions" as any) as any)
    .select("category, ebt_cards!inner(user_id)")
    .eq("ebt_cards.user_id", userId)
    .gte("posted_at", sinceIso);

  if (error || !Array.isArray(data)) return [];

  const seen = new Set<string>();
  for (const row of data as Array<{ category: string }>) {
    if (typeof row.category === "string") seen.add(row.category);
  }
  return [...seen];
}
