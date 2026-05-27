// Public API for @civica/state-connectors.
//
// Three primitive concerns, exported as namespaces so callers self-document
// at the call site (usps.validate(), fips.fromAddress(), agencyDirectory.lookup()).
// Plus a one-shot `resolve` namespace that combines fips + agency-directory
// into a single call for route handlers.

export * as usps from "./usps/client";
export * as fips from "./fips/resolver";
export * as agencyDirectory from "./agency-directory/lookup";
export * as resolve from "./resolve";
export type { ResolveOptions, ResolvedAddress } from "./resolve";

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
