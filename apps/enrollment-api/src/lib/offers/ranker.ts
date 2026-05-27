/**
 * Weighted ranking + valid_until stamping for the offer resolver.
 *
 * Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (B-T2d).
 *
 * Initial weights (tunable via env in the route):
 *   w_cat=0.40  category overlap against user recent-tx categories
 *   w_sav=0.30  normalized expected savings_cents
 *   w_geo=0.20  county-match bonus (packet OR current = 1.0; statewide = 0.3)
 *   w_pop=0.10  popularity (impressions-weighted) when useFallback=true
 *
 * Per outside-voice recalibration TODO: first 30d of impression+click data
 * should drive a weight recalibration. Document via observability metric.
 *
 * Distance: computed CLIENT-SIDE from retailer pin lat/lng (the catalog
 * doesn't carry lat/lng yet — the FindHelp module's retailer pins are the
 * source of truth). This module stays distance-free.
 */

import type { PartnerOfferRow } from "./catalog.js";

export interface RankingInputs {
  txCategories: string[]; // user's distinct ebt_transactions.category set, last 60d
  counties: string[]; // from resolveCounties()
  useFallback: boolean; // true when txCategories is empty (unlinked / pre-packet)
  limit: number;
  validUntilMinutes?: number; // cache TTL stamp; defaults to 5
}

export interface RankedOffer extends PartnerOfferRow {
  score: number;
  valid_until: string; // ISO timestamp = min(offer.end_at, now + validUntilMinutes)
}

export const DEFAULT_WEIGHTS = {
  w_cat: 0.4,
  w_sav: 0.3,
  w_geo: 0.2,
  w_pop: 0.1,
} as const;

/**
 * Pure function. No DB access. Easy to unit-test.
 */
export function rank(
  candidates: PartnerOfferRow[],
  inputs: RankingInputs,
  weights = DEFAULT_WEIGHTS,
): RankedOffer[] {
  if (candidates.length === 0) return [];

  const ttlMin = inputs.validUntilMinutes ?? 5;
  const nowMs = Date.now();
  const cacheUntilMs = nowMs + ttlMin * 60_000;

  // Savings normalization: divide by the max in the candidate set so the
  // score lives in [0,1]. Single-candidate set normalizes to 1.0.
  const maxSavings = candidates.reduce(
    (m, o) => (o.expected_savings_cents > m ? o.expected_savings_cents : m),
    1, // floor at 1 to avoid div-by-zero
  );

  const txCategorySet = new Set(inputs.txCategories);
  const wantCounties = new Set(inputs.counties.filter((c) => c !== "STATEWIDE"));

  const ranked: RankedOffer[] = candidates.map((o) => {
    // Category overlap: fraction of offer's category_tags that the user has
    // posted a recent transaction in. Zero when useFallback=true (no signal).
    const categoryOverlap = inputs.useFallback
      ? 0
      : o.category_tags.length === 0
        ? 0
        : o.category_tags.filter((t) => txCategorySet.has(t)).length /
          o.category_tags.length;

    // Geo bonus: 1.0 if the offer is specifically targeted at one of the
    // user's counties, 0.3 if it's statewide and we fell back, 0 otherwise.
    let geoBonus = 0;
    if (o.county_fips_list.length === 0) {
      geoBonus = 0.3;
    } else {
      for (const c of o.county_fips_list) {
        if (wantCounties.has(c)) {
          geoBonus = 1.0;
          break;
        }
      }
    }

    // Popularity placeholder: until impression data flows, use the tier as
    // a proxy. top=1.0, standard=0.5, none=0. Real popularity comes from
    // partner_offer_events_aggregate once iOS emission lands.
    const popularity = o.tier === "top" ? 1.0 : o.tier === "standard" ? 0.5 : 0;

    const savingsNorm = o.expected_savings_cents / maxSavings;

    // When useFallback (no tx history), swap w_cat → w_pop contribution by
    // doubling the popularity weight to fill the gap.
    const effectiveWeights = inputs.useFallback
      ? { ...weights, w_cat: 0, w_pop: weights.w_pop + weights.w_cat }
      : weights;

    const score =
      effectiveWeights.w_cat * categoryOverlap +
      effectiveWeights.w_sav * savingsNorm +
      effectiveWeights.w_geo * geoBonus +
      effectiveWeights.w_pop * popularity;

    // valid_until = min(offer.end_at, now+TTL). If offer never expires
    // (end_at null), use the cache TTL.
    const offerEndMs = o.end_at ? new Date(o.end_at).getTime() : Infinity;
    const validUntilMs = Math.min(offerEndMs, cacheUntilMs);
    const valid_until = new Date(validUntilMs).toISOString();

    return { ...o, score, valid_until };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, inputs.limit);
}
