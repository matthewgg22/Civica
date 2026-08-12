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
import nvPack from "./nv/pack.json";
import nvSupplements from "./nv/supplements.json";
import nvAuthorities from "./nv/authorities.json";
import nvFreshness from "./nv/freshness.json";
import azPack from "./az/pack.json";
import azSupplements from "./az/supplements.json";
import azAuthorities from "./az/authorities.json";
import azFreshness from "./az/freshness.json";
import orPack from "./or/pack.json";
import orSupplements from "./or/supplements.json";
import orAuthorities from "./or/authorities.json";
import orFreshness from "./or/freshness.json";
import wiPack from "./wi/pack.json";
import wiSupplements from "./wi/supplements.json";
import wiAuthorities from "./wi/authorities.json";
import wiFreshness from "./wi/freshness.json";
import mnPack from "./mn/pack.json";
import mnSupplements from "./mn/supplements.json";
import mnAuthorities from "./mn/authorities.json";
import mnFreshness from "./mn/freshness.json";
import paPack from "./pa/pack.json";
import paSupplements from "./pa/supplements.json";
import paAuthorities from "./pa/authorities.json";
import paFreshness from "./pa/freshness.json";
import ohPack from "./oh/pack.json";
import ohSupplements from "./oh/supplements.json";
import ohAuthorities from "./oh/authorities.json";
import ohFreshness from "./oh/freshness.json";
import ncPack from "./nc/pack.json";
import ncSupplements from "./nc/supplements.json";
import ncAuthorities from "./nc/authorities.json";
import ncFreshness from "./nc/freshness.json";
import njPack from "./nj/pack.json";
import njSupplements from "./nj/supplements.json";
import njAuthorities from "./nj/authorities.json";
import njFreshness from "./nj/freshness.json";
import vaPack from "./va/pack.json";
import vaSupplements from "./va/supplements.json";
import vaAuthorities from "./va/authorities.json";
import vaFreshness from "./va/freshness.json";
import tnPack from "./tn/pack.json";
import tnSupplements from "./tn/supplements.json";
import tnAuthorities from "./tn/authorities.json";
import tnFreshness from "./tn/freshness.json";
import inPack from "./in/pack.json";
import inSupplements from "./in/supplements.json";
import inAuthorities from "./in/authorities.json";
import inFreshness from "./in/freshness.json";
import moPack from "./mo/pack.json";
import moSupplements from "./mo/supplements.json";
import moAuthorities from "./mo/authorities.json";
import moFreshness from "./mo/freshness.json";
import mdPack from "./md/pack.json";
import mdSupplements from "./md/supplements.json";
import mdAuthorities from "./md/authorities.json";
import mdFreshness from "./md/freshness.json";
import coPack from "./co/pack.json";
import coSupplements from "./co/supplements.json";
import coAuthorities from "./co/authorities.json";
import coFreshness from "./co/freshness.json";
import scPack from "./sc/pack.json";
import scSupplements from "./sc/supplements.json";
import scAuthorities from "./sc/authorities.json";
import scFreshness from "./sc/freshness.json";
import alPack from "./al/pack.json";
import alSupplements from "./al/supplements.json";
import alAuthorities from "./al/authorities.json";
import alFreshness from "./al/freshness.json";
import laPack from "./la/pack.json";
import laSupplements from "./la/supplements.json";
import laAuthorities from "./la/authorities.json";
import laFreshness from "./la/freshness.json";
import kyPack from "./ky/pack.json";
import kySupplements from "./ky/supplements.json";
import kyAuthorities from "./ky/authorities.json";
import kyFreshness from "./ky/freshness.json";
import okPack from "./ok/pack.json";
import okSupplements from "./ok/supplements.json";
import okAuthorities from "./ok/authorities.json";
import okFreshness from "./ok/freshness.json";
import ctPack from "./ct/pack.json";
import ctSupplements from "./ct/supplements.json";
import ctAuthorities from "./ct/authorities.json";
import ctFreshness from "./ct/freshness.json";
import utPack from "./ut/pack.json";
import utSupplements from "./ut/supplements.json";
import utAuthorities from "./ut/authorities.json";
import utFreshness from "./ut/freshness.json";
import iaPack from "./ia/pack.json";
import iaSupplements from "./ia/supplements.json";
import iaAuthorities from "./ia/authorities.json";
import iaFreshness from "./ia/freshness.json";
import arPack from "./ar/pack.json";
import arSupplements from "./ar/supplements.json";
import arAuthorities from "./ar/authorities.json";
import arFreshness from "./ar/freshness.json";
import msPack from "./ms/pack.json";
import msSupplements from "./ms/supplements.json";
import msAuthorities from "./ms/authorities.json";
import msFreshness from "./ms/freshness.json";
import ksPack from "./ks/pack.json";
import ksSupplements from "./ks/supplements.json";
import ksAuthorities from "./ks/authorities.json";
import ksFreshness from "./ks/freshness.json";
import nmPack from "./nm/pack.json";
import nmSupplements from "./nm/supplements.json";
import nmAuthorities from "./nm/authorities.json";
import nmFreshness from "./nm/freshness.json";
import nePack from "./ne/pack.json";
import neSupplements from "./ne/supplements.json";
import neAuthorities from "./ne/authorities.json";
import neFreshness from "./ne/freshness.json";
import nhPack from "./nh/pack.json";
import nhSupplements from "./nh/supplements.json";
import nhAuthorities from "./nh/authorities.json";
import nhFreshness from "./nh/freshness.json";

/** Registered pack codes. Widens as Wave 1+ states land (WA, TX, NY, …). */
export type StateCode = "CA" | "WA" | "TX" | "NY" | "GA" | "MI" | "IL" | "FL" | "MA" | "NV" | "AZ" | "OR" | "WI" | "MN" | "PA" | "OH" | "NC" | "NJ" | "VA" | "TN" | "IN" | "MO" | "MD" | "CO" | "SC" | "AL" | "LA" | "KY" | "OK" | "CT" | "UT" | "IA" | "AR" | "MS" | "KS" | "NM" | "NE" | "NH";

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
  NV: buildPack(
    nvPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    nvSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    nvAuthorities as unknown as RawAuthorities,
    nvFreshness as { entries: PackFreshnessEntry[] },
  ),
  AZ: buildPack(
    azPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    azSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    azAuthorities as unknown as RawAuthorities,
    azFreshness as { entries: PackFreshnessEntry[] },
  ),
  OR: buildPack(
    orPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    orSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    orAuthorities as unknown as RawAuthorities,
    orFreshness as { entries: PackFreshnessEntry[] },
  ),
  WI: buildPack(
    wiPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    wiSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    wiAuthorities as unknown as RawAuthorities,
    wiFreshness as { entries: PackFreshnessEntry[] },
  ),
  MN: buildPack(
    mnPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    mnSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    mnAuthorities as unknown as RawAuthorities,
    mnFreshness as { entries: PackFreshnessEntry[] },
  ),
  PA: buildPack(
    paPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    paSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    paAuthorities as unknown as RawAuthorities,
    paFreshness as { entries: PackFreshnessEntry[] },
  ),
  OH: buildPack(
    ohPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    ohSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    ohAuthorities as unknown as RawAuthorities,
    ohFreshness as { entries: PackFreshnessEntry[] },
  ),
  NC: buildPack(
    ncPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    ncSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    ncAuthorities as unknown as RawAuthorities,
    ncFreshness as { entries: PackFreshnessEntry[] },
  ),
  NJ: buildPack(
    njPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    njSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    njAuthorities as unknown as RawAuthorities,
    njFreshness as { entries: PackFreshnessEntry[] },
  ),
  VA: buildPack(
    vaPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    vaSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    vaAuthorities as unknown as RawAuthorities,
    vaFreshness as { entries: PackFreshnessEntry[] },
  ),
  TN: buildPack(
    tnPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    tnSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    tnAuthorities as unknown as RawAuthorities,
    tnFreshness as { entries: PackFreshnessEntry[] },
  ),
  IN: buildPack(
    inPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    inSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    inAuthorities as unknown as RawAuthorities,
    inFreshness as { entries: PackFreshnessEntry[] },
  ),
  MO: buildPack(
    moPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    moSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    moAuthorities as unknown as RawAuthorities,
    moFreshness as { entries: PackFreshnessEntry[] },
  ),
  MD: buildPack(
    mdPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    mdSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    mdAuthorities as unknown as RawAuthorities,
    mdFreshness as { entries: PackFreshnessEntry[] },
  ),
  CO: buildPack(
    coPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    coSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    coAuthorities as unknown as RawAuthorities,
    coFreshness as { entries: PackFreshnessEntry[] },
  ),
  SC: buildPack(
    scPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    scSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    scAuthorities as unknown as RawAuthorities,
    scFreshness as { entries: PackFreshnessEntry[] },
  ),
  AL: buildPack(
    alPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    alSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    alAuthorities as unknown as RawAuthorities,
    alFreshness as { entries: PackFreshnessEntry[] },
  ),
  LA: buildPack(
    laPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    laSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    laAuthorities as unknown as RawAuthorities,
    laFreshness as { entries: PackFreshnessEntry[] },
  ),
  KY: buildPack(
    kyPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    kySupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    kyAuthorities as unknown as RawAuthorities,
    kyFreshness as { entries: PackFreshnessEntry[] },
  ),
  OK: buildPack(
    okPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    okSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    okAuthorities as unknown as RawAuthorities,
    okFreshness as { entries: PackFreshnessEntry[] },
  ),
  CT: buildPack(
    ctPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    ctSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    ctAuthorities as unknown as RawAuthorities,
    ctFreshness as { entries: PackFreshnessEntry[] },
  ),
  UT: buildPack(
    utPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    utSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    utAuthorities as unknown as RawAuthorities,
    utFreshness as { entries: PackFreshnessEntry[] },
  ),
  IA: buildPack(
    iaPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    iaSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    iaAuthorities as unknown as RawAuthorities,
    iaFreshness as { entries: PackFreshnessEntry[] },
  ),
  AR: buildPack(
    arPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    arSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    arAuthorities as unknown as RawAuthorities,
    arFreshness as { entries: PackFreshnessEntry[] },
  ),
  MS: buildPack(
    msPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    msSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    msAuthorities as unknown as RawAuthorities,
    msFreshness as { entries: PackFreshnessEntry[] },
  ),
  KS: buildPack(
    ksPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    ksSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    ksAuthorities as unknown as RawAuthorities,
    ksFreshness as { entries: PackFreshnessEntry[] },
  ),
  NM: buildPack(
    nmPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    nmSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    nmAuthorities as unknown as RawAuthorities,
    nmFreshness as { entries: PackFreshnessEntry[] },
  ),
  NE: buildPack(
    nePack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    neSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    neAuthorities as unknown as RawAuthorities,
    neFreshness as { entries: PackFreshnessEntry[] },
  ),
  NH: buildPack(
    nhPack as Omit<StatePack, "topics" | "authorities" | "freshness" | "supersessions">,
    nhSupplements as { supplements: PackTopic[]; supersessions?: Record<string, string> },
    nhAuthorities as unknown as RawAuthorities,
    nhFreshness as { entries: PackFreshnessEntry[] },
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
