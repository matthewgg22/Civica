// A SUGGESTION of which state someone is in. Never a selection.
//
// The criteria asked for "Use my current location" with a manual fallback. Two
// ways to do that, and the obvious one is worse:
//
//   navigator.geolocation gives coordinates, which then need reverse geocoding
//   to a state — a third-party API call carrying a real person's lat/lon, on a
//   benefits site, for a hint. It also fires a browser permission prompt, and a
//   permission prompt on first load is exactly the friction this audience does
//   not need.
//
//   Vercel already resolves the request IP to a region at the edge and hands it
//   over in a header. No prompt, no coordinates, no third party, and nothing
//   collected that the request did not already contain.
//
// So this reads the header. It is a HINT: the picker offers it, and a tap
// applies it. Nothing is ever auto-selected, because people help family in
// other states and a confidently wrong state is worse than no state — every
// figure in an answer is scoped by it.
//
// Absent locally and in tests (no edge, no header), which is correct: no
// header, no suggestion, and the picker looks exactly as it did.

import { headers } from "next/headers";

/** Vercel's edge geo headers. `city` and `latitude` also exist and are
 *  deliberately unread — the region is the only field that maps to what this
 *  product needs to know, and reading more would be collecting more. */
const REGION_HEADER = "x-vercel-ip-country-region";
const COUNTRY_HEADER = "x-vercel-ip-country";

/** A two-letter US state/territory code, or null. Validated against the codes
 *  we actually answer for — the header is edge-supplied, not user input, but it
 *  reaches a scope that changes every number in an answer, so it is checked
 *  rather than trusted. */
export async function geoHint(known: string[]): Promise<string | null> {
  try {
    const h = await headers();
    // Outside the US the region means something else entirely (a Canadian
    // province, a German Land), and mapping it onto a US state would be
    // confidently wrong in the one field that scopes the whole answer.
    if ((h.get(COUNTRY_HEADER) ?? "").toUpperCase() !== "US") return null;
    const region = (h.get(REGION_HEADER) ?? "").toUpperCase().trim();
    if (!/^[A-Z]{2}$/.test(region)) return null;
    return known.includes(region) ? region : null;
  } catch {
    // headers() throws outside a request scope (static render). No hint is the
    // right answer there, not a crash.
    return null;
  }
}
