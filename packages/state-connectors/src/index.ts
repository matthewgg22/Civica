// Public API for @civica/state-connectors.
//
// Three concerns, exported as namespaces so callers self-document at the
// call site (usps.validate(), fips.fromAddress(), agencyDirectory.lookup()).

export * as usps from "./usps/client.js";
export * as fips from "./fips/resolver.js";
export * as agencyDirectory from "./agency-directory/lookup.js";

export {
  AddressSchema,
  NormalizedAddressSchema,
  ValidationResultSchema,
  CountyResultSchema,
  AgencyContactSchema,
  CountyAgencySchema,
  StateAgencyRecordSchema,
  AgencyLookupResultSchema,
} from "./schemas.js";

export type {
  Address,
  NormalizedAddress,
  DPV,
  ValidationResult,
  CountyResult,
  AgencyContact,
  CountyAgency,
  StateAgencyRecord,
  AgencyLookupResult,
} from "./schemas.js";

export type {
  USPSCredentials,
  USPSClientOptions,
  USPSAddressApiResponse,
  USPSTokenResponse,
} from "./usps/types.js";
