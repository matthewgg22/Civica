// A state named in the chat, so the scope can follow the conversation.
//
// The failure: someone types "im in boston", or names three states in a row,
// and nothing re-scopes. In one real transcript the picker stayed on CalFresh —
// one of the most generous state programs — while answering a Massachusetts
// household. That does not fail safe; it overstates what they will get.
//
// This DETECTS. It never switches. The chat offers, and the person confirms:
// silently re-scoping on a guess is how you end up answering the wrong state
// with more confidence than before.

import { STATE_NAMES } from "./state-names";

/** The larger US cities, and the ones a SNAP applicant is likely to name.
 *
 *  Deliberately NOT exhaustive, and deliberately excluding every ambiguous
 *  name — Springfield, Portland, Columbus, Kansas City, Charleston, Aurora and
 *  friends are absent, because a wrong guess here is worse than no guess. */
const CITY_STATE: Record<string, string> = {
  "new york": "NY", "nyc": "NY", "brooklyn": "NY", "queens": "NY", "bronx": "NY", "buffalo": "NY",
  "los angeles": "CA", "la": "CA", "san francisco": "CA", "sf": "CA", "san diego": "CA",
  "san jose": "CA", "sacramento": "CA", "oakland": "CA", "fresno": "CA", "long beach": "CA",
  "chicago": "IL", "houston": "TX", "san antonio": "TX", "dallas": "TX", "austin": "TX",
  "fort worth": "TX", "el paso": "TX", "phoenix": "AZ", "tucson": "AZ", "mesa": "AZ",
  "philadelphia": "PA", "philly": "PA", "pittsburgh": "PA", "jacksonville": "FL",
  "miami": "FL", "tampa": "FL", "orlando": "FL", "seattle": "WA", "spokane": "WA",
  "tacoma": "WA", "denver": "CO", "boston": "MA", "worcester": "MA", "springfield ma": "MA",
  "detroit": "MI", "grand rapids": "MI", "atlanta": "GA", "savannah": "GA",
  "las vegas": "NV", "vegas": "NV", "reno": "NV", "milwaukee": "WI", "madison": "WI",
  "minneapolis": "MN", "st paul": "MN", "saint paul": "MN", "baltimore": "MD",
  "newark": "NJ", "jersey city": "NJ", "charlotte": "NC", "raleigh": "NC",
  "nashville": "TN", "memphis": "TN", "indianapolis": "IN", "st louis": "MO",
  "saint louis": "MO", "new orleans": "LA", "cleveland": "OH", "cincinnati": "OH",
  "virginia beach": "VA", "richmond": "VA", "louisville": "KY", "oklahoma city": "OK",
  "albuquerque": "NM", "omaha": "NE", "honolulu": "HI", "anchorage": "AK",
  "salt lake city": "UT", "boise": "ID", "des moines": "IA", "wichita": "KS",
};

/** PLACES THAT ARE NOT ONE OF THE STATES WE COVER, and that a naive substring
 *  match gets actively wrong.
 *
 *  "Washington DC" contains the word "washington", so someone in the District
 *  was told about Washington State's program — a different agency, a different
 *  portal, different figures — and nothing in the interface said otherwise.
 *  Silently answering the wrong jurisdiction is the worst outcome available
 *  here, worse than admitting the gap.
 *
 *  Puerto Rico is here for a different reason: it does not run SNAP. It runs
 *  NAP, a block grant with its own rules, so every figure on this site is
 *  wrong there in a way no state pack would fix. */
const NOT_COVERED: Array<[RegExp, string]> = [
  [/\bwashington,?\s*d\.?\s?c\.?\b|\bdistrict of columbia\b|\bd\.c\.\b/i, "Washington, D.C."],
  [/\bpuerto rico\b/i, "Puerto Rico"],
  [/\bguam\b/i, "Guam"],
  [/\b(us |u\.s\. )?virgin islands\b/i, "the U.S. Virgin Islands"],
  [/\bamerican samoa\b/i, "American Samoa"],
];

/** A place they named that this product does not cover. Distinct from "no
 *  state mentioned": the chat should say so rather than carry on silently. */
export function detectUncoveredPlace(text: string): string | null {
  if (!text) return null;
  for (const [re, name] of NOT_COVERED) if (re.test(text)) return name;
  return null;
}

/** Phrases that mean the place is NOT where they live. "If I moved to Texas"
 *  must never re-scope anything. */
const HYPOTHETICAL = /\b(if i|if we|were i|thinking (about|of)|planning to|moving to|move to|what about|how about|used to|last year|when i lived)\b/i;

export interface StateMention {
  code: string;
  /** What to call it back to them — always the state, never the program. */
  name: string;
  /** The words that matched, so the offer can quote them. */
  matched: string;
}

/**
 * A state or well-known city named in this message, or null.
 *
 * Returns at most ONE. A message naming two states is ambiguous, and asking
 * about the wrong one is worse than not asking.
 */
export function detectState(text: string): StateMention | null {
  // An uncovered place wins outright. "Washington DC" must never fall through
  // to the substring pass and come back as Washington State.
  if (!text || HYPOTHETICAL.test(text) || detectUncoveredPlace(text)) return null;
  const hay = ` ${text.toLowerCase().replace(/[.,!?;:()"']/g, " ").replace(/\s+/g, " ")} `;

  const hits = new Map<string, string>();

  // Full state names first — unambiguous.
  for (const [code, name] of Object.entries(STATE_NAMES)) {
    if (hay.includes(` ${name.toLowerCase()} `)) hits.set(code, name);
  }
  // Then cities.
  for (const [city, code] of Object.entries(CITY_STATE)) {
    if (hay.includes(` ${city} `)) hits.set(code, city);
  }

  // Two-letter codes ONLY when written as a standalone capitalised token in the
  // original text — "in MA" is a state, "la" in "la comida" is not, and "in"
  // and "or" and "me" are all state codes.
  for (const m of text.matchAll(/\b([A-Z]{2})\b/g)) {
    const code = m[1]!;
    if (STATE_NAMES[code]) hits.set(code, code);
  }

  if (hits.size !== 1) return null;
  const [code, matched] = [...hits.entries()][0]!;
  return { code, name: STATE_NAMES[code]!, matched };
}
