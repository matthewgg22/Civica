// CA county ABAWD waivers — FY2026 (Nov 1, 2025 – Oct 31, 2026)
// OBBBA §10102(b) tightened waiver criteria; CA's prior broad statewide waiver
// ended Nov 1, 2025. County-level waivers require unemployment > 10%.
//
// Wave 1 — ACL 25-79 (Nov 7, 2025): Colusa (13.0%), Imperial (18.7%), Tulare (10.4%)
// Wave 2 — ACL 26-15 (Feb 26, 2026): Alpine, Merced, Monterey, Plumas
// All 7 waivers expire Oct 31, 2026. No renewals announced as of May 2026.
//
// FIPS format: "SSCCC" (2-digit state + 3-digit county), zero-padded.
export const CA_WAIVER_COUNTY_FIPS = new Set<string>([
  '06011', // Colusa    — confirmed ACL 25-79 (Nov 7, 2025)
  '06025', // Imperial  — confirmed ACL 25-79 (Nov 7, 2025)
  '06107', // Tulare    — confirmed ACL 25-79 (Nov 7, 2025)
  '06003', // Alpine    — confirmed ACL 26-15 (Feb 26, 2026)
  '06047', // Merced    — confirmed ACL 26-15 (Feb 26, 2026)
  '06053', // Monterey  — confirmed ACL 26-15 (Feb 26, 2026)
  '06063', // Plumas    — confirmed ACL 26-15 (Feb 26, 2026)
]);
export const MA_WAIVER_COUNTY_FIPS = new Set<string>([]);

/**
 * Waiver windows. A county waiver is not a permanent property of the county —
 * it is a dated grant, and honoring an expired one over-approves exactly as
 * badly as ignoring a live one under-approves.
 *
 * CA: FY2026 grant, Nov 1 2025 – Oct 31 2026 (ACL 25-79, ACL 26-15). No
 * renewals announced as of May 2026, so after the end date NO California
 * county is waived and statewide time limits (ACL 25-93) apply everywhere.
 */
export const WAIVER_WINDOWS: Record<string, { start: string; end: string }> = {
  CA: { start: "2025-11-01", end: "2026-10-31" },
  MA: { start: "1970-01-01", end: "2025-06-30" }, // expired; DTA OLGTM-2025-31
};

const WAIVER_SETS: Record<string, Set<string>> = {
  CA: CA_WAIVER_COUNTY_FIPS,
  MA: MA_WAIVER_COUNTY_FIPS,
};

/**
 * Is this county under a live ABAWD waiver on `asOf`?
 *
 * Returns false for an unknown state, an absent county, or a date outside the
 * grant window. Callers must NOT read a false as "deny" on its own — absent
 * county data means unknown, not unwaived. See #614.
 */
export function isWaivedCounty(
  state: string | undefined,
  countyFips: string | undefined,
  asOf: Date,
): boolean {
  if (!state || !countyFips) return false;
  const set = WAIVER_SETS[state];
  const win = WAIVER_WINDOWS[state];
  if (!set || !win) return false;
  const day = asOf.toISOString().slice(0, 10);
  if (day < win.start || day > win.end) return false;
  return set.has(countyFips);
}
