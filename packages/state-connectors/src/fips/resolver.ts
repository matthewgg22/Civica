import type { Address, CountyResult } from "../schemas.js";
import zipTable from "./data/zip-to-county.json";

interface ZipEntry {
  fips: string; // 5-digit county FIPS
  county_name: string;
}
const { _meta, ...rest } = zipTable as Record<string, ZipEntry | { note: string }>;
void _meta;
const ZIP_TABLE = rest as Record<string, ZipEntry>;

const CENSUS_BASE_URL = "https://geocoding.geo.census.gov/geocoder/geographies/address";

interface CensusGeocodeResponse {
  result?: {
    addressMatches?: Array<{
      geographies?: {
        Counties?: Array<{ STATE: string; COUNTY: string; NAME: string }>;
      };
    }>;
  };
}

export interface FipsResolverOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

// API path — exact, slow (~1-2s), ground truth from the Census geocoder.
export async function fromAddress(
  address: Address,
  opts: FipsResolverOptions = {},
): Promise<CountyResult | undefined> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = new URL(opts.baseUrl ?? CENSUS_BASE_URL);
  url.searchParams.set("street", address.street);
  url.searchParams.set("city", address.city);
  url.searchParams.set("state", address.state);
  url.searchParams.set("zip", address.zip.slice(0, 5));
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("layers", "Counties");
  url.searchParams.set("format", "json");

  const res = await fetchImpl(url.toString(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`Census geocoder failed: ${res.status}`);
  }
  const body = (await res.json()) as CensusGeocodeResponse;
  const county = body.result?.addressMatches?.[0]?.geographies?.Counties?.[0];
  if (!county) return undefined;

  return {
    fips: `${county.STATE}${county.COUNTY}`,
    state_fips: county.STATE,
    county_fips: county.COUNTY,
    county_name: county.NAME,
    source: "census_api",
  };
}

// Local fast path — instant, fuzzy because ZIPs can cross county lines.
// Returns the dominant county per the HUD USPS ZIP-to-county crosswalk
// snapshot (Q4 2024). See data/SOURCES.md.
export function fromZipFast(zip: string): CountyResult | undefined {
  const z5 = zip.slice(0, 5);
  const entry = ZIP_TABLE[z5];
  if (!entry) return undefined;
  return {
    fips: entry.fips,
    state_fips: entry.fips.slice(0, 2),
    county_fips: entry.fips.slice(2),
    county_name: entry.county_name,
    source: "zip_table",
  };
}
