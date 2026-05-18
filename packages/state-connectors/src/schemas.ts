import { z } from "zod";

// Canonical postal address. Inputs may be partial; normalized outputs from
// USPS use the same shape but with fields uppercased and zip4 populated.
export const AddressSchema = z.object({
  street: z.string().min(1),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-?\d{4})?$/),
});
export type Address = z.infer<typeof AddressSchema>;

export const NormalizedAddressSchema = z.object({
  street: z.string(),
  street2: z.string().optional(),
  city: z.string(),
  state: z.string().length(2),
  zip5: z.string().length(5),
  zip4: z.string().length(4).optional(),
});
export type NormalizedAddress = z.infer<typeof NormalizedAddressSchema>;

// USPS Delivery Point Validation. Y = confirmed deliverable,
// N = not deliverable, S = secondary info present but ignored.
export const DPVSchema = z.enum(["Y", "N", "S"]);
export type DPV = z.infer<typeof DPVSchema>;

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  normalized: NormalizedAddressSchema.optional(),
  delivery_point_validation: DPVSchema.optional(),
  warnings: z.array(z.string()).default([]),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const CountyResultSchema = z.object({
  fips: z.string().length(5),
  state_fips: z.string().length(2),
  county_fips: z.string().length(3),
  county_name: z.string(),
  source: z.enum(["census_api", "zip_table"]),
});
export type CountyResult = z.infer<typeof CountyResultSchema>;

export const AgencyContactSchema = z.object({
  name: z.string(),
  abbreviation: z.string().optional(),
  url: z.string().url().optional(),
  snap_program_name: z.string().optional(),
  application_portal: z.string().url().optional(),
  snap_office_phone: z.string().optional(),
  snap_office_url: z.string().url().optional(),
});
export type AgencyContact = z.infer<typeof AgencyContactSchema>;

export const CountyAgencySchema = z.object({
  fips: z.string().length(5),
  name: z.string(),
  administering_agency: AgencyContactSchema,
});
export type CountyAgency = z.infer<typeof CountyAgencySchema>;

export const StateAgencyRecordSchema = z.object({
  state_code: z.string().length(2),
  state_name: z.string(),
  state_agency: AgencyContactSchema,
  populated: z.boolean().default(true),
  counties: z.array(CountyAgencySchema).default([]),
});
export type StateAgencyRecord = z.infer<typeof StateAgencyRecordSchema>;

export const AgencyLookupResultSchema = z.object({
  state: AgencyContactSchema,
  county: CountyAgencySchema.optional(),
  // True when the requested county wasn't enumerated and we fell back to state.
  fallback_to_state: z.boolean(),
});
export type AgencyLookupResult = z.infer<typeof AgencyLookupResultSchema>;
