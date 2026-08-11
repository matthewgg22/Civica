// State-pack registry (Wave 0 of docs/plans/mae-state-corpus-framework.md).
//
// A State Pack is DATA, not code: everything Mae knows about one state's SNAP
// program — curated policy supplements, citation-authority formats, freshness
// dates, program identity — lives in versioned JSON under states/<code>/, with
// PROVENANCE.md naming where each piece came from and who verified it.
//
// The code layer (retrieval, citation verifier, freshness) is state-
// PARAMETERIZED, never state-branching: it asks the registry for a pack and
// merges it with the federal layer. Adding a state is a new directory plus one
// REGISTRY entry plus a green eval — zero edits to retrieval logic.
//
// Layering rule (framework §3): federal 7 CFR text and the OBBBA supersession
// notes live ONCE in the shared layer. Only genuinely-state content belongs in
// a pack. County-administered states (CA, NY, MN, WI, VA) additionally carry an
// admin_note warning that operative practice can vary by county.

import caPack from "./ca/pack.json";
import caSupplements from "./ca/supplements.json";
import caAuthorities from "./ca/authorities.json";
import caFreshness from "./ca/freshness.json";
import waPack from "./wa/pack.json";
import waSupplements from "./wa/supplements.json";
import waAuthorities from "./wa/authorities.json";
import waFreshness from "./wa/freshness.json";
import txPack from "./tx/pack.json";
import txSupplements from "./tx/supplements.json";
import txAuthorities from "./tx/authorities.json";
import txFreshness from "./tx/freshness.json";
import nyPack from "./ny/pack.json";
import nySupplements from "./ny/supplements.json";
import nyAuthorities from "./ny/authorities.json";
import nyFreshness from "./ny/freshness.json";
import gaPack from "./ga/pack.json";
import gaSupplements from "./ga/supplements.json";
import gaAuthorities from "./ga/authorities.json";
import gaFreshness from "./ga/freshness.json";
import miPack from "./mi/pack.json";
import miSupplements from "./mi/supplements.json";
import miAuthorities from "./mi/authorities.json";
import miFreshness from "./mi/freshness.json";
import ilPack from "./il/pack.json";
import ilSupplements from "./il/supplements.json";
import ilAuthorities from "./il/authorities.json";
import ilFreshness from "./il/freshness.json";
import flPack from "./fl/pack.json";
import flSupplements from "./fl/supplements.json";
import flAuthorities from "./fl/authorities.json";
import flFreshness from "./fl/freshness.json";
import maPack from "./ma/pack.json";
import maSupplements from "./ma/supplements.json";
import maAuthorities from "./ma/authorities.json";
import maFreshness from "./ma/freshness.json";

/** Registered pack codes. Widens as Wave 1+ states land (WA, TX, NY, …). */
export type StateCode = "CA" | "WA" | "TX" | "NY" | "GA" | "MI" | "IL" | "FL" | "MA";

/** Launch state; used when a caller does not specify. Preserves the pre-pack
 *  behavior in which the (then-hardcoded) CA content applied to every query. */
export const DEFAULT_STATE: StateCode = "CA";

export interface PackTopic {
  key: string;
  /** "supplement" = leads results alongside the corpus; "external" = also
   *  suppresses distractor corpus sections (suppress_sections). */
  kind: "supplement" | "external";
  terms: string[];
  suppress_sections?: string[];
  citation: string;
  heading: string;
  text: string;
  source_url: string;
}

export interface PackAuthorityPattern {
  key: string;
  regex: string;
  flags: string;
  /** Display template over match groups, e.g. "AC$1 $2" / "MPP $1". */
  template: string;
  /** Group normalization applied before templating. */
  normalize: "upper" | "none";
  /** How a displayed citation is checked against the known set:
   *  "exact" — set membership of the display string;
   *  "second-word-base" — first word + second word truncated at "." or "("
   *  (MPP 63-300.5(j) → "MPP 63-300"). */
  match: "exact" | "second-word-base";
  note?: string;
}

export interface CompiledAuthorityPattern extends PackAuthorityPattern {
  compiled: RegExp;
  known: Set<string>;
}

export interface PackFreshnessEntry {
  key: string;
  /** "expires": warn when now > date. "not-yet-effective": warn when now < date. */
  kind: "expires" | "not-yet-effective";
  date: string;
  warning: string;
}

export interface StatePack {
  code: StateCode;
  program: string;
  agency: string;
  admin_model: "state" | "county";
  admin_note?: string;
  system?: string;
  portal?: { name: string; url: string };
  update_channels: { name: string; url: string }[];
  topics: PackTopic[];
  /** State addenda appended AFTER the federal OBBBA supersession note for a
   *  section (e.g. CA's ABAWD resumption date on 273.24). Never replaces the
   *  federal note — Layer 1 stays one copy. */
  supersessions?: Record<string, string>;
  authorities: CompiledAuthorityPattern[];
  freshness: PackFreshnessEntry[];
}

interface RawAuthorities {
  patterns: PackAuthorityPattern[];
  known: Record<string, { value: string; note?: string | null }[]>;
}

function buildPack(
  pack: Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
  supplements: { supplements: PackTopic[]; supersessions?: Record<string, string> },
  authorities: RawAuthorities,
  freshness: { entries: PackFreshnessEntry[] },
): StatePack {
  return {
    ...pack,
    topics: supplements.supplements,
    ...(supplements.supersessions ? { supersessions: supplements.supersessions } : {}),
    authorities: authorities.patterns.map((p) => ({
      ...p,
      // Fresh RegExp per pack build; consumers must not share lastIndex state.
      compiled: new RegExp(p.regex, p.flags),
      known: new Set((authorities.known[p.key] ?? []).map((k) => k.value)),
    })),
    freshness: freshness.entries,
  };
}

const REGISTRY: Record<StateCode, StatePack> = {
  CA: buildPack(
    caPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    caSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    caAuthorities as unknown as RawAuthorities,
    caFreshness as { entries: PackFreshnessEntry[] },
  ),
  WA: buildPack(
    waPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    waSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    waAuthorities as unknown as RawAuthorities,
    waFreshness as { entries: PackFreshnessEntry[] },
  ),
  TX: buildPack(
    txPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    txSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    txAuthorities as unknown as RawAuthorities,
    txFreshness as { entries: PackFreshnessEntry[] },
  ),
  NY: buildPack(
    nyPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    nySupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    nyAuthorities as unknown as RawAuthorities,
    nyFreshness as { entries: PackFreshnessEntry[] },
  ),
  GA: buildPack(
    gaPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    gaSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    gaAuthorities as unknown as RawAuthorities,
    gaFreshness as { entries: PackFreshnessEntry[] },
  ),
  MI: buildPack(
    miPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    miSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    miAuthorities as unknown as RawAuthorities,
    miFreshness as { entries: PackFreshnessEntry[] },
  ),
  IL: buildPack(
    ilPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    ilSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    ilAuthorities as unknown as RawAuthorities,
    ilFreshness as { entries: PackFreshnessEntry[] },
  ),
  FL: buildPack(
    flPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    flSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    flAuthorities as unknown as RawAuthorities,
    flFreshness as { entries: PackFreshnessEntry[] },
  ),
  MA: buildPack(
    maPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    maSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    maAuthorities as unknown as RawAuthorities,
    maFreshness as { entries: PackFreshnessEntry[] },
  ),
};

/** Pack for a state code, or null when no pack is registered. Callers treat
 *  null as "federal-only" — never a hard error, so an unknown state degrades
 *  to the federal floor exactly as the system prompt describes.
 *
 *  Argument semantics (eng review T-C — the CA-leak fix):
 *    - undefined (arg omitted): legacy DEFAULT_STATE (CA) — the staff dashboard's
 *      historical behavior only. New callers pass an explicit value.
 *    - null: EXPLICIT federal floor — no pack. An anonymous public user with no
 *      state selected must never inherit California supplements. */
export function getStatePack(code?: string | null): StatePack | null {
  if (code === null) return null;
  if (code === undefined) return REGISTRY[DEFAULT_STATE];
  const upper = code.toUpperCase() as StateCode;
  return REGISTRY[upper] ?? null;
}

export function registeredStates(): StateCode[] {
  return Object.keys(REGISTRY) as StateCode[];
}
