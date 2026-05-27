/**
 * County resolution for the offer resolver.
 *
 * Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md
 *   (B-T2b + outside-voice County boundary edge case).
 *
 * Pure function, OR-matches packet_county (from packet) and current_county
 * (from device location, when granted). Returns ["STATEWIDE"] when neither
 * is present — the catalog query uses STATEWIDE as the bucket for offers
 * with empty county_fips_list.
 *
 * Edge case (acknowledged): user with stale packet who moved within CA
 * sees offers from BOTH counties. Documented limitation for v1.
 */

const STATEWIDE_BUCKET = "STATEWIDE" as const;

/**
 * Returns the deduped list of county FIPS codes the offer resolver should
 * query against. Empty inputs collapse to ["STATEWIDE"].
 *
 * @param packetCounty 5-digit FIPS from the applicant's most recent packet
 * @param currentCounty 5-digit FIPS from the device's current location (when granted)
 */
export function resolveCounties(
  packetCounty?: string | null,
  currentCounty?: string | null,
): string[] {
  const seen = new Set<string>();
  for (const c of [packetCounty, currentCounty]) {
    if (typeof c === "string" && c.length === 5 && /^\d{5}$/.test(c)) {
      seen.add(c);
    }
  }
  if (seen.size === 0) return [STATEWIDE_BUCKET];
  return [...seen];
}

/**
 * True iff the resolver fell back to the statewide bucket — used by the
 * route to log a `county_mismatch=true` Sentry tag when packet and current
 * disagree, or `pre_packet=true` when neither was supplied.
 */
export function isStatewideFallback(counties: string[]): boolean {
  return counties.length === 1 && counties[0] === STATEWIDE_BUCKET;
}
