// Alaska's real per-region utility standards (#631, split from #607/#619's
// single-region AK entry in states.ts).
//
// AK.sua_by_tier in states.ts models Alaska as ONE state-level value (the
// Central/Anchorage region) — a deliberate, disclosed simplification that
// unlocked the profile-harness but under-models every household outside
// Anchorage/Mat-Su, most severely Northwest (-77%) and Southwestern (-70%).
// This module is the real fix: a county_fips → region lookup, consulted by
// benefit-calc.ts BEFORE falling back to the state-level Central default —
// the same two-tier pattern already established for CA's ABAWD county
// waivers (#614's waiverCountiesFor()).
//
// Source: Alaska Dept. of Health / Division of Public Assistance, form
// FSP 77 (06-4198) rev 09/25, "Alaska SNAP Standards", effective 10/1/2025,
// fetched live 2026-08-09 at health.alaska.gov/media/wzalr0op/alaska-snap-standards.pdf.
//
// LUA figures are NOT a single number AK publishes directly per region —
// same caveat as the Central region's LUA in states.ts: this module sums
// each region's own electricity + sewer + water columns (excluding
// telephone, which has its own dedicated tier). If AK's actual LUA-
// equivalent determination combines these differently, every region here
// needs the same correction, not just Central.
//
// County FIPS current as of 2026-08-09 (Census Bureau ANSI codes via
// Wikipedia's "List of boroughs and census areas in Alaska", cross-checked
// against the source document's own census-area names). Two historical
// mergers/splits matter here:
//   - "Wade Hampton Census Area" (the document's own wording) was renamed
//     Kusilvak Census Area in 2015 — mapped to the CURRENT code (02158).
//   - "Skagway/Hoonah/Angoon" and "Wrangell/Petersburg" (the document's own
//     combined wording) are each now TWO separate boroughs/census areas —
//     mapped to both current codes.

import { Decimal } from "../decimal";

export interface AkUtilityRegionRates {
  HCSUA: Decimal;
  LUA: Decimal;
  phone: Decimal;
}

function region(heat: string, electricity: string, phone: string, sewer: string, water: string): AkUtilityRegionRates {
  return {
    HCSUA: new Decimal(heat),
    // Sum of the region's own non-heat, non-phone utility columns — see the
    // module-level LUA caveat above.
    LUA: new Decimal(electricity).add(new Decimal(sewer)).add(new Decimal(water)),
    phone: new Decimal(phone),
  };
}

const CENTRAL = region("625", "134", "26", "61", "59"); // Anchorage, Wasilla, Palmer
const NORTHERN = region("825", "170", "35", "45", "44"); // Fairbanks, North Slope, Denali, Yukon-Koyukuk, Copper River
const NORTHWEST = region("1107", "158", "37", "48", "63"); // Nome, Kotzebue
const SOUTH_CENTRAL = region("591", "109", "27", "65", "42"); // Aleutians, Kenai, Kodiak, Chugach
const SOUTHEASTERN = region("517", "72", "36", "81", "49"); // Juneau, Ketchikan, Sitka, Haines, Prince of Wales, Skagway/Hoonah-Angoon, Yakutat, Wrangell/Petersburg
const SOUTHWESTERN = region("1064", "169", "36", "54", "111"); // Bethel, Kusilvak, Bristol Bay, Dillingham, Lake and Peninsula

/** County FIPS ("SSCCC") → region rates, for every current AK borough/census
 *  area (30 total). Not exported directly — go through akUtilityRegionFor()
 *  so an unknown/malformed FIPS returns undefined rather than a KeyError. */
const AK_SUA_BY_COUNTY_FIPS: Record<string, AkUtilityRegionRates> = {
  // Central
  "02020": CENTRAL, // Anchorage
  "02170": CENTRAL, // Matanuska-Susitna
  // Northern
  "02090": NORTHERN, // Fairbanks North Star
  "02185": NORTHERN, // North Slope
  "02240": NORTHERN, // Southeast Fairbanks
  "02068": NORTHERN, // Denali
  "02290": NORTHERN, // Yukon-Koyukuk
  "02066": NORTHERN, // Copper River (split from Valdez-Cordova, 2019)
  // Northwest
  "02180": NORTHWEST, // Nome
  "02188": NORTHWEST, // Northwest Arctic
  // South Central
  "02013": SOUTH_CENTRAL, // Aleutians East
  "02016": SOUTH_CENTRAL, // Aleutians West
  "02122": SOUTH_CENTRAL, // Kenai Peninsula
  "02150": SOUTH_CENTRAL, // Kodiak Island
  "02063": SOUTH_CENTRAL, // Chugach (split from Valdez-Cordova, 2019)
  // Southeastern
  "02110": SOUTHEASTERN, // Juneau
  "02130": SOUTHEASTERN, // Ketchikan Gateway
  "02220": SOUTHEASTERN, // Sitka
  "02100": SOUTHEASTERN, // Haines
  "02198": SOUTHEASTERN, // Prince of Wales-Hyder
  "02230": SOUTHEASTERN, // Skagway
  "02105": SOUTHEASTERN, // Hoonah-Angoon
  "02282": SOUTHEASTERN, // Yakutat
  "02275": SOUTHEASTERN, // Wrangell
  "02195": SOUTHEASTERN, // Petersburg
  // Southwestern
  "02050": SOUTHWESTERN, // Bethel
  "02158": SOUTHWESTERN, // Kusilvak (renamed from Wade Hampton, 2015)
  "02060": SOUTHWESTERN, // Bristol Bay
  "02070": SOUTHWESTERN, // Dillingham
  "02164": SOUTHWESTERN, // Lake and Peninsula
};

/**
 * The real per-region SUA rates for an Alaska county, or undefined if the
 * FIPS is missing/unrecognized — callers MUST fall back to the state-level
 * Central default in that case (states.ts AK.sua_by_tier), never treat
 * undefined as "no SUA at all".
 */
export function akUtilityRegionFor(countyFips: string | undefined): AkUtilityRegionRates | undefined {
  if (!countyFips) return undefined;
  return AK_SUA_BY_COUNTY_FIPS[countyFips];
}
