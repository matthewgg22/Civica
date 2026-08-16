// Alaska's real zone-based maximum SNAP allotment + minimum-benefit table
// (#814, following #631's ak-utility-regions.ts pattern for AK's SUA, and
// distinct from #804/#815's bbce/asset_waiver correction).
//
// states.ts's `AllotmentTier = "48" | "AK"` and every AK StatePolicy
// snapshot's `allotment_tier: "AK"` have been correctly authored since #806 —
// but until this fix, federal-tables.ts's `maxAllotmentFor()` /
// `minimumBenefitFor()` took no state parameter at all and ALWAYS returned
// the single 48-contiguous national table, silently understating every AK
// household's benefit ceiling (and floor). See #814.
//
// ── Source (dollar figures) ─────────────────────────────────────────────
// USDA FNS's own official "SNAP FY 2026 Maximum Allotment Amounts for
// Alaska, Hawaii, Guam, and U.S. Virgin Islands" table AND the FY26 COLA
// memo's "Maximum SNAP Allotments for Alaska" / "MINIMUM SNAP ALLOTMENTS"
// tables (both effective 10/1/2025-9/30/2026), fetched via
// fns-prod.azureedge.us/sites/default/files/resource-files/snap-fy26allotments-AKHIGUVI.pdf
// and health.alaska.gov's mirrored copy of the same COLA memo
// (health.alaska.gov/media/4nunu3ob/fy2026-cola-memo.pdf) — both matched
// exactly. Cross-checked a third time against
// packages/demeter-engine/src/states/ak/supplements.json's
// zone-structure-allotments supplement (which independently cites the same
// two USDA publications for its HH1/HH4/add-on figures) — every overlapping
// figure matches exactly. HH2/3/5/6/7/8 (not quoted in the corpus
// supplement, which only cites HH1/HH4/add-on) come directly from the two
// USDA PDFs above, fetched 2026-08-15.
//
// ── Source (zone GEOGRAPHY — which AK community is in which zone) ──────
// A DIFFERENT source than the dollar figures: 7 CFR 272.7(b), "Procedures
// for program administration in Alaska" — the federal regulation defining
// Rural I / Rural II / Urban Alaska TFP (Thrifty Food Plan) areas by
// borough/census-area/named-place. The AK corpus pack explicitly flags
// (supplements.json, zone-structure-allotments) that "this pack did not
// locate a single DOH-published master list assigning every individual
// Alaska community to a zone." 7 CFR 272.7(b) IS that master list —
// published federally, not by DOH, so the corpus pack's own search (scoped
// to health.alaska.gov) didn't surface it. Fetched 2026-08-15 via
// govinfo.gov's CFR-2012-title7-vol4 codification PDF
// (govinfo.gov/content/pkg/CFR-2012-title7-vol4/pdf/CFR-2012-title7-vol4-sec272-7.pdf),
// pdftotext-extracted verbatim (not summarized) and separately cross-checked
// against a paraphrase pass of the current eCFR/Cornell LII text — both
// matched. Per the regulation's own amendment history (Amdt. 132, 43 FR
// 47884, Oct 17 1979; redesignated by Amdt. 211, 47 FR 53315, Nov 26 1982;
// later amendments — Amdt. 356/59 FR 29713/1994, 71 FR 28763/2006, 76 FR
// 27606/2011 — touch only paragraphs (f)-(h), the public-notification and
// data-collection provisions, NOT the paragraph (b) area definitions used
// here), the zone geography itself has not been amended since original
// 1980s enactment — it predates several current AK borough/census-area
// boundaries (see renaming/splitting notes below), the same kind of gap
// ak-utility-regions.ts already had to resolve for the utility-region table.
//
// ── Zone geography is a DIFFERENT axis than the utility-region table ────
// Per supplements.json's own flagship finding: AK's maximum-allotment zones
// (Urban/Rural I/Rural II, THIS file) and AK's SUA utility regions
// (Central/Northern/Northwest/South Central/Southeastern/Southwestern,
// ak-utility-regions.ts) are two SEPARATE geographic systems that do not
// share boundaries. Do not assume a county's utility region implies its
// allotment zone — several counties differ (e.g. Copper River Census Area
// is Northern for utilities but Rural I for allotment; Kenai Peninsula
// Borough is South Central for utilities but majority-Urban for
// allotment).
//
// ── Historical borough renamings/splits reconciled here (post-dating the
// 1980s regulation's place names; same discipline as ak-utility-regions.ts's
// Wade Hampton → Kusilvak footnote) ─────────────────────────────────────
//   - "Kobuk Census Area" → Northwest Arctic Borough (incorporated 1986).
//   - "Wade Hampton Census Area" → Kusilvak Census Area (renamed 2015).
//   - "Valdez-Cordova Census Area" split (2019) into Chugach Census Area
//     (contains Valdez, the CFR's Urban exception, plus Cordova/rest,
//     the CFR's Rural I default — a genuine SPLIT within one modern FIPS,
//     see "Known limitations" below) and Copper River Census Area (does
//     NOT contain Valdez or Dayville, so it resolves unambiguously to
//     Rural I in full).
//   - "Skagway-Yakutat-Angoon Census Area" split (~2007) into Skagway
//     Municipality (the CFR's named Urban exception, in full), Hoonah-Angoon
//     Census Area, and Yakutat City and Borough (neither of the latter two
//     contains Skagway, so both resolve unambiguously to Rural I in full).
//   - "Wrangell-Petersburg Census Area" split (2008/2013) into Wrangell
//     City and Borough and Petersburg Borough — both today ARE (are
//     coextensive with) the CFR's named Urban-exception towns.
//   - "Denali in the Matanuska-Susitna Borough" (the CFR's own 1980s
//     wording, predating Denali Borough's 1990 incorporation as its own,
//     independent borough carved out of the old Mat-Su area) → today's
//     independent Denali Borough is that same area's direct successor.
//   - "Prince of Wales-Outer Ketchikan Census Area" → Prince of
//     Wales-Hyder Census Area (reorganized ~2008).
//
// ── Known limitations (disclosed, not silently papered over) ────────────
// The CFR defines several zones at a SUB-borough, named-place granularity
// finer than this codebase's county_fips (SSCCC) resolution — e.g. "all of
// Kodiak Island Borough EXCEPT Kodiak [city]" cannot be expressed as one
// FIPS-to-zone entry. Two response strategies, both used below and
// disclosed per-entry:
//   1. Where the NAMED EXCEPTION is a small population/area relative to the
//      rest of the same modern FIPS unit, this file maps the WHOLE unit to
//      the majority zone (e.g. Yukon-Koyukuk Census Area → Rural II despite
//      the CFR's "except the city of Nenana," population ~340 against a
//      ~145,000-sq-mi census area) — the same kind of representative-
//      default judgment states.ts's own comments already make explicit for
//      AK's single-region SUA fallback ("the most populous area, the same
//      representative-default choice every non-regional state here already
//      makes") and for CA's ABAWD waiver-county fallback ("ONLY the
//      fallback the gate uses when a household's county_fips isn't known").
//   2. Where the split is NOT clearly lopsided (Chugach Census Area: Valdez,
//      the CFR's Urban exception, is a comparable-or-larger population than
//      Cordova+rest, the CFR's Rural I default), this file deliberately
//      leaves that ONE county OUT of the table entirely — it is not
//      "assumed Urban," it FALLS THROUGH to the Urban state-level default
//      the same way an unmapped/unrecognized FIPS always has, and that
//      fallthrough happens to be a reasonable approximation here (Valdez
//      is the borough's largest town) but is not claimed as a resolved
//      answer. A household in Cordova specifically is under-modeled by
//      this fallthrough; that gap is disclosed here rather than resolved
//      by invented certainty.
// No individual AK community's zone assignment is invented here beyond
// what 7 CFR 272.7(b) states or a documented majority-share judgment call
// over it — per this task's own instruction, a defensible PARTIAL mapping
// with an Urban-fallback default is preferred over invented full coverage.

// ── Standard deduction + shelter cap (#866) ─────────────────────────────
// A DIFFERENT axis again from both the zone-based max-allotment table
// above and the six-region SUA table (ak-utility-regions.ts) — Alaska's
// Standard Deduction and Maximum Excess Shelter Deduction are each a
// SINGLE statewide figure, not zone- or region-specific. Confirmed
// directly from Alaska DOH's own current SNAP Standards PDF (FSP 77, rev
// 09/25, effective 10/1/2025-9/30/2026, health.alaska.gov/media/wzalr0op/
// alaska-snap-standards.pdf), cross-checked exactly against USDA FNS's own
// FY2026 national Maximum Allotments and Deductions table, and
// independently re-confirmed against packages/demeter-engine/src/states/
// ak/supplements.json:120 ("resources-and-deductions" supplement): "a
// Standard Deduction of $358 for households of 1-5 members and $374 for
// 6+ (both figures matching USDA's national FY2026 Alaska-specific column
// exactly)... an Excess Shelter Deduction capped at $1,189/month for most
// households... this $1,189 figure also matches USDA's national FY2026
// table exactly." Prior to #866, federal-tables.ts's standardDeductionFor()/
// shelterCapFor() took no state parameter at all and always returned the
// 48-contiguous table's $209/$223/$261/$299 SD and $744 shelter cap for
// every state including AK, understating AK benefits (up to ~$45/mo from
// the SD alone, more where shelter-capped). See issue #866.

import { Decimal } from "../decimal";

export type AkAllotmentZone = "urban" | "rural1" | "rural2";

export interface AkZoneAllotments {
  zone: AkAllotmentZone;
  /** FNS max allotment by household size, Alaska's zone-specific table. */
  max_allotment: Map<number, Decimal>;
  max_allotment_each_additional: Decimal;
  /** AK's own zone-specific minimum-benefit floor (1-2 person HH), higher
   *  than the federal default ($24 FY26) every other state uses. */
  minimum_benefit: Decimal;
}

function zoneTable(
  zone: AkAllotmentZone,
  bySize: [string, string, string, string, string, string, string, string],
  eachAdditional: string,
  minimumBenefit: string,
): AkZoneAllotments {
  const max_allotment = new Map<number, Decimal>();
  bySize.forEach((v, i) => max_allotment.set(i + 1, new Decimal(v)));
  return {
    zone,
    max_allotment,
    max_allotment_each_additional: new Decimal(eachAdditional),
    minimum_benefit: new Decimal(minimumBenefit),
  };
}

// FY26 (10/1/2025-9/30/2026). HH1-8 verbatim from both USDA source PDFs
// cited above (matched exactly); add-on and minimum-benefit from the same.
export const AK_URBAN = zoneTable(
  "urban",
  ["385", "707", "1015", "1285", "1529", "1838", "2031", "2314"],
  "282",
  "31",
);
export const AK_RURAL_I = zoneTable(
  "rural1",
  ["491", "901", "1295", "1639", "1950", "2344", "2590", "2950"],
  "360",
  "39",
);
export const AK_RURAL_II = zoneTable(
  "rural2",
  ["598", "1097", "1576", "1995", "2374", "2853", "3152", "3591"],
  "438",
  "48",
);

// #866: AK's own statewide Standard Deduction ($358 HH1-5, $374 HH6+) and
// Maximum Excess Shelter Deduction ($1,189) — NOT zone-specific, see the
// header note above. Consulted by federal-tables.ts's
// standardDeductionFor()/shelterCapFor() when state === "AK", the same
// state-branch-first/federal-fallback shape maxAllotmentFor()/
// minimumBenefitFor() already use for AK's zone table.
export const AK_STANDARD_DEDUCTION = new Map<number, Decimal>([
  [1, new Decimal("358")],
  [2, new Decimal("358")],
  [3, new Decimal("358")],
  [4, new Decimal("358")],
  [5, new Decimal("358")],
  [6, new Decimal("374")],
]);
export const AK_SHELTER_CAP = new Decimal("1189");

/**
 * County FIPS ("SSCCC") → allotment zone, for the AK boroughs/census areas
 * this file can confidently resolve from 7 CFR 272.7(b) — NOT all 30
 * (compare ak-utility-regions.ts's full 30-county utility-region table).
 * Every entry below is either an unambiguous whole-unit match to the CFR
 * text, or a documented majority-share judgment call per the "Known
 * limitations" note above. Chugach Census Area (02063) is deliberately
 * OMITTED — see that note — and falls through to the Urban default like
 * any other unmapped FIPS.
 */
const AK_ALLOTMENT_ZONE_BY_COUNTY_FIPS: Record<string, AkAllotmentZone> = {
  // ── Urban — unambiguous whole-borough match to 7 CFR 272.7(b)(3) ──────
  "02020": "urban", // Anchorage — "the entire Anchorage Borough"
  "02090": "urban", // Fairbanks North Star — "the entire Fairbanks-North Star Borough"
  "02110": "urban", // Juneau — "the entire Juneau Borough"
  "02100": "urban", // Haines — "the entire Haines Borough"
  "02230": "urban", // Skagway — CFR's named Urban exception, now its own full borough

  // ── Urban — majority-share judgment call (CFR names a small carve-out
  // within a modern FIPS unit that is overwhelmingly the Urban-designated
  // portion) ──────────────────────────────────────────────────────────
  "02170": "urban", // Matanuska-Susitna — CFR: "the entire Matanuska-Susitna
  // Borough except for Denali and Skwentna." Denali is its own separate
  // FIPS (02068, mapped Rural II below) since 1990 — no longer part of this
  // borough at all. Only Skwentna (population ~40) remains an un-modeled
  // Rural I pocket inside modern Mat-Su.
  "02122": "urban", // Kenai Peninsula — CFR: "all places in Kenai Peninsula
  // Borough that are on the Kenai Peninsula except for those specifically
  // designated as Rural I" (the west-of-Cook-Inlet + outer-coastal
  // communities enumerated under Rural I below) — those are a small
  // population share of a borough whose road-connected core (Kenai,
  // Soldotna, Homer, Seward) is the clear majority.
  "02220": "urban", // Sitka — CFR: "Sitka in the Sitka Borough" is the Urban
  // exception; the remainder of the (very large, mostly uninhabited)
  // borough is Rural I, but Sitka city holds nearly the entire borough
  // population.
  "02130": "urban", // Ketchikan Gateway — CFR: "Ketchikan, Saxman, and Ward
  // Cove in the Ketchikan-Gateway Borough" together account for
  // essentially all of the borough's populated area.
  "02275": "urban", // Wrangell — CFR's named Urban-exception town; the
  // modern Wrangell City and Borough is built around it.
  "02195": "urban", // Petersburg — same reasoning as Wrangell.
  "02240": "urban", // Southeast Fairbanks — CFR: "Big Delta, Delta Junction,
  // and Fort Greely in the Southeast-Fairbanks Census Area" hold the
  // majority of this census area's population; the remainder is Rural I.

  // ── Rural I — unambiguous whole-unit match (the CFR's named Urban
  // exception for the old combined area does not exist within this
  // specific modern successor FIPS) ─────────────────────────────────────
  "02066": "rural1", // Copper River Census Area — successor to
  // Valdez-Cordova CA that does NOT contain Valdez or Dayville (those are
  // in Chugach CA, 02063, deliberately left unmapped — see header note).
  "02105": "rural1", // Hoonah-Angoon Census Area — successor to
  // Skagway-Yakutat-Angoon CA that does not contain Skagway.
  "02282": "rural1", // Yakutat — same reasoning as Hoonah-Angoon.

  // ── Rural I — majority-share judgment call ─────────────────────────
  "02150": "rural1", // Kodiak Island — CFR: "all places in Kodiak Island
  // Borough with the exception of Kodiak" is Rural I; Kodiak city itself
  // is Urban. Mapped Rural I here since DOH's own general framing
  // (supplements.json: Urban = "Anchorage, Fairbanks, Juneau metro areas")
  // does not include Kodiak among its Urban examples, and the borough's
  // land area/village count is overwhelmingly the Rural I portion.
  "02198": "rural1", // Prince of Wales-Hyder — CFR: "all places ... except
  // Craig, Hyder, and Metlakatla" is Rural I; those three named places are
  // a small share of this large, sparsely populated census area.

  // ── Rural II — unambiguous whole-unit match to 7 CFR 272.7(b)(2) ─────
  "02185": "rural2", // North Slope Borough
  "02180": "rural2", // Nome Census Area
  "02158": "rural2", // Kusilvak Census Area (renamed from Wade Hampton, 2015)
  "02050": "rural2", // Bethel Census Area
  "02070": "rural2", // Dillingham Census Area — half of the CFR's combined
  // "Dillingham-Bristol Bay Borough" wording.
  "02060": "rural2", // Bristol Bay Borough — other half of the same wording.
  "02188": "rural2", // Northwest Arctic Borough (formerly Kobuk Census Area,
  // incorporated 1986).
  "02068": "rural2", // Denali Borough — direct successor to the CFR's
  // "Denali in the Matanuska-Susitna Borough," independently incorporated
  // 1990.

  // ── Rural II — majority-share judgment call ────────────────────────
  "02290": "rural2", // Yukon-Koyukuk Census Area — CFR: "Yukon-Koyukuk
  // Census Area except for the city of Nenana" (population ~340 within a
  // ~145,000-sq-mi census area — Nenana itself is Rural I and is NOT
  // separately resolvable at county_fips granularity).
  "02013": "rural2", // Aleutians East Borough — CFR: "all places in the
  // Aleutian Islands except for Cold Bay and Adak" is Rural II; Cold Bay
  // (in this borough) is the CFR's small named Urban exception.
  "02016": "rural2", // Aleutians West Census Area — same CFR clause; Adak
  // (in this census area) is the other named Urban exception.
  "02164": "rural2", // Lake and Peninsula Borough — NOT separately named in
  // 7 CFR 272.7(b) (this borough incorporated in 1989, after the
  // regulation's 1980s enactment). Mapped Rural II by strong geographic
  // analogy: remote, road-disconnected Alaska Peninsula/Bristol Bay
  // region, grouped with Dillingham/Bristol Bay in every other regional
  // classification this codebase and Alaska DOH use, including
  // ak-utility-regions.ts's own SOUTHWESTERN utility-region grouping.
  // Disclosed as an analogy-based call, not a direct CFR citation.
};

/**
 * The real zone-specific max-allotment/minimum-benefit table for an Alaska
 * county, or undefined if the FIPS is missing, unrecognized, or one of the
 * genuinely-split counties this file deliberately leaves unmapped (Chugach
 * Census Area, 02063 — see the header "Known limitations" note). Callers
 * MUST fall back to the Urban zone (AK_URBAN) in that case — the same
 * representative-default choice states.ts's AK.sua_by_tier comment already
 * documents for the single-region SUA fallback, and DOH's own framing of
 * Anchorage/Fairbanks/Juneau as Alaska's "metro areas."
 */
export function akAllotmentZoneFor(countyFips: string | undefined): AkZoneAllotments | undefined {
  if (!countyFips) return undefined;
  const zone = AK_ALLOTMENT_ZONE_BY_COUNTY_FIPS[countyFips];
  if (!zone) return undefined;
  return zone === "urban" ? AK_URBAN : zone === "rural1" ? AK_RURAL_I : AK_RURAL_II;
}
