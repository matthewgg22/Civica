// Public API for @civica/state-connectors.
//
// Three concerns, exported as namespaces so callers self-document at the
// call site (usps.validate(), fips.fromAddress(), agencyDirectory.lookup()).

export * as usps from "./usps/client";
export * as fips from "./fips/resolver";
export * as agencyDirectory from "./agency-directory/lookup";

export {
  AddressSchema,
  NormalizedAddressSchema,
  ValidationResultSchema,
  CountyResultSchema,
  AgencyContactSchema,
  CountyAgencySchema,
  StateAgencyRecordSchema,
  AgencyLookupResultSchema,
} from "./schemas";

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
} from "./schemas";

export type {
  USPSCredentials,
  USPSClientOptions,
  USPSAddressApiResponse,
  USPSTokenResponse,
} from "./usps/types";
