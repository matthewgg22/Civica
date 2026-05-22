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
