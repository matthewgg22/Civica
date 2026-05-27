/**
 * Offer resolver — thin orchestrator over distress / county / catalog / ranker.
 *
 * Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (B-T2e).
 *
 * Flow:
 *   1. isDistressed → if true, return { offers: [], free_resources }
 *   2. resolveCounties → OR-match packet + current
 *   3. fetchCandidates → state + active + window + county overlap
 *   4. fetchRecentTxCategories → for category-match scoring
 *   5. rank → weighted score + valid_until stamping
 */

import { isDistressed } from "./distress.js";
import { resolveCounties } from "./county.js";
import { fetchCandidates, fetchRecentTxCategories } from "./catalog.js";
import { rank, type RankedOffer } from "./ranker.js";
import { getFreeResources, type FreeResource } from "./free-resources.js";

export interface ResolveInput {
  userId: string;
  stateCode: "CA" | "MA";
  packetCountyFips?: string | null;
  currentCountyFips?: string | null;
  limit?: number;
}

export interface ResolveOutput {
  offers: RankedOffer[];
  free_resources: FreeResource[] | null;
  /** Diagnostic metadata for the route's Sentry tag set. */
  meta: {
    distressed: boolean;
    counties: string[];
    statewideFallback: boolean;
    candidateCount: number;
    txCategoriesCount: number;
    useFallback: boolean;
  };
}

export async function resolveOffers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  input: ResolveInput,
): Promise<ResolveOutput> {
  const distressed = await isDistressed(db, input.userId);
  const counties = resolveCounties(input.packetCountyFips, input.currentCountyFips);
  const statewideFallback = counties.length === 1 && counties[0] === "STATEWIDE";

  if (distressed) {
    return {
      offers: [],
      free_resources: getFreeResources(input.stateCode),
      meta: {
        distressed: true,
        counties,
        statewideFallback,
        candidateCount: 0,
        txCategoriesCount: 0,
        useFallback: false,
      },
    };
  }

  const candidates = await fetchCandidates(db, {
    stateCode: input.stateCode,
    counties,
  });

  const txCategories = await fetchRecentTxCategories(db, input.userId, 60);
  const useFallback = txCategories.length === 0;

  const ranked = rank(candidates, {
    txCategories,
    counties,
    useFallback,
    limit: input.limit ?? 6,
  });

  return {
    offers: ranked,
    free_resources: null,
    meta: {
      distressed: false,
      counties,
      statewideFallback,
      candidateCount: candidates.length,
      txCategoriesCount: txCategories.length,
      useFallback,
    },
  };
}
