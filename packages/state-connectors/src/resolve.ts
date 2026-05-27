// One-shot address → { county FIPS + administering agency } resolver.
//
// Combines the three existing primitives (fips.fromZipFast → fips.fromAddress
// → agencyDirectory.lookup) into a single call so route handlers don't have
// to chain them by hand. Used by the live-submission router (which county
// agency owns this address?) and by the QC audit trail (county-level error
// attribution).
//
// Fast path: ZIP in the curated anchor table → resolve immediately, no
// network. Slow path: Census geocoder API → exact parcel. Both paths feed
// into the same agency lookup, so the shape of the result is stable
// regardless of which path resolved the county.

import type { Address, CountyResult, AgencyLookupResult } from "./schemas";
import { fromAddress, fromZipFast, type FipsResolverOptions } from "./fips/resolver";
import { lookup as agencyLookup } from "./agency-directory/lookup";

export interface ResolveOptions extends FipsResolverOptions {
  /**
   * When true, always hit the Census geocoder even if the ZIP is in the fast
   * table. Useful when the caller already knows the parcel is on a county
   * boundary and wants the authoritative answer. Default: false.
   */
  skipFastPath?: boolean;
}

export interface ResolvedAddress {
  /** County FIPS / name from fast path or Census API. */
  county: CountyResult;
  /** Administering SNAP agency (county-specific when enumerated; state fallback otherwise). */
  agency: AgencyLookupResult;
}

/**
 * Resolve a full address to { county, agency } in one call.
 *
 * Tries the ZIP fast path first (anchor table — see fips/data/SOURCES.md);
 * falls back to the Census geocoder when the ZIP isn't in the table or
 * `skipFastPath: true` is passed. Throws if neither path resolves the
 * county — that means the address is malformed or the Census API is down.
 *
 * Agency lookup is best-effort: when the county isn't enumerated in the
 * agency-directory (only CA + MA have per-county data today), the result
 * still includes the state-level agency contact with `fallback_to_state: true`.
 */
export async function byAddress(
  address: Address,
  options: ResolveOptions = {},
): Promise<ResolvedAddress> {
  const county = await resolveCounty(address, options);
  if (!county) {
    throw new Error(
      `state-connectors: could not resolve county for address ${address.street}, ` +
        `${address.city} ${address.state} ${address.zip} (ZIP not in fast table, Census API returned no match).`,
    );
  }
  const agency = agencyLookup({ stateCode: address.state, countyFips: county.fips });
  if (!agency) {
    throw new Error(
      `state-connectors: county ${county.fips} resolved but agency-directory has no record for state ${address.state}.`,
    );
  }
  return { county, agency };
}

/**
 * ZIP-only variant: take a 5-digit ZIP (no street/city) and resolve the
 * dominant county via the fast table, then look up the agency. Returns
 * undefined when the ZIP isn't in the fast table — no Census fallback,
 * because that API requires a street address.
 *
 * Useful for low-friction surfaces (apply-now buttons, locality-aware
 * marketing pages) where collecting a full address is too heavy.
 */
export function byZip(
  zip: string,
  stateCode: string,
): ResolvedAddress | undefined {
  const county = fromZipFast(zip);
  if (!county) return undefined;
  const agency = agencyLookup({ stateCode, countyFips: county.fips });
  if (!agency) return undefined;
  return { county, agency };
}

async function resolveCounty(
  address: Address,
  options: ResolveOptions,
): Promise<CountyResult | undefined> {
  if (!options.skipFastPath) {
    const fast = fromZipFast(address.zip);
    if (fast) return fast;
  }
  return fromAddress(address, options);
}
