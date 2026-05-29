import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** E.164 phone format: +1XXXXXXXXXX */
export const E164Schema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format (e.g. +14155551234)");
export type E164 = z.infer<typeof E164Schema>;

export const PostalAddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Must be 5- or 9-digit ZIP"),
  /**
   * California county NAME (e.g. "Sacramento"), NOT the portal's 2-digit
   * ordinal. Optional: intake collects it for SNAPAgencyDirectory routing, but
   * older packets may omit it. The portal's address-validation modal #2 expects
   * the ordinal — the `"ca-county-ordinal"` fill transform (V1-3, #313) maps
   * this name → ordinal at fill time. Left as a free string (not an enum of the
   * 58 counties) so an unrecognized value still round-trips through the schema;
   * the transform returns null for an unknown county → the field is skipped and
   * surfaced as "needs human".
   */
  county: z.string().min(1).optional(),
});
export type PostalAddress = z.infer<typeof PostalAddressSchema>;

// ---------------------------------------------------------------------------
// BenefitsCalPayload
//
// Represents all the data Civica will pre-fill into the BenefitsCal CBO
// portal application form. Produced by normalizeForPortal() — pure mapping,
// no I/O.
// ---------------------------------------------------------------------------

export const HouseholdMemberSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO 8601 date"),
  relationship: z.string().min(1),
});
export type HouseholdMember = z.infer<typeof HouseholdMemberSchema>;

export const IncomeSourceSchema = z.object({
  income_type: z.string().min(1),
  income_amount: z.number().nonnegative(),
  income_frequency: z.enum(["monthly", "weekly", "biweekly", "annual", "irregular"]),
});
export type IncomeSource = z.infer<typeof IncomeSourceSchema>;

export const DocumentItemSchema = z.object({
  type: z.string().min(1),
  url: z.string().url(),
});
export type DocumentItem = z.infer<typeof DocumentItemSchema>;

export const UtilityAllowanceTypeSchema = z.enum([
  "standard",
  "limited",
  "telephone_only",
  "none",
]);
export type UtilityAllowanceType = z.infer<typeof UtilityAllowanceTypeSchema>;

export const ClientSignatureTypeSchema = z.enum([
  "in_person",
  "telephonic",
  "async_portal",
]);
export type ClientSignatureType = z.infer<typeof ClientSignatureTypeSchema>;

// ---------------------------------------------------------------------------
// Demographic / eligibility enums (V1-2, #312)
//
// These back the step-1 portal pages the V1-1a walk flagged as schema gaps:
// ABMRS (marital status), ABCOS (college student), ABDOC (citizenship),
// ABASX (sex assigned at birth), ABGNR (gender). Logical keys here are the
// canonical Civica values; selector-map.ts maps each to the portal's option
// id/value. The extension's transform step (V1-3) does any value mapping.
// ---------------------------------------------------------------------------

/**
 * Marital status — the 8 options the ABMRS radio group exposes
 * (selector-map.ts `ABMRS.maritalStatus.optionValues`). `common_law` and
 * `domestic_partner` mirror the portal's "Common Law" / "Registered Domestic
 * Partner"; `never_married` is distinct from `single` per the portal walk.
 */
export const MaritalStatusSchema = z.enum([
  "single",
  "married",
  "divorced",
  "separated",
  "widowed",
  "domestic_partner",
  "common_law",
  "never_married",
]);
export type MaritalStatus = z.infer<typeof MaritalStatusSchema>;

/**
 * Citizenship status. ABDOC is a Yes/No "are you a U.S. citizen?" radio, but we
 * keep this expressive (3-way) so a non-citizen branch can carry a national vs.
 * non-citizen distinction without a schema change. `us_citizen` ⇒ ABDOC "Yes".
 */
export const CitizenshipStatusSchema = z.enum([
  "us_citizen",
  "us_national",
  "non_citizen",
]);
export type CitizenshipStatus = z.infer<typeof CitizenshipStatusSchema>;

/**
 * Sex assigned at birth — the 3 ABASX options
 * (selector-map.ts `ABASX.assignedSex.optionValues`). Optional: the portal page
 * is optional and intake may not collect it.
 */
export const SexAssignedAtBirthSchema = z.enum([
  "female",
  "male",
  "prefer_not_to_say",
]);
export type SexAssignedAtBirth = z.infer<typeof SexAssignedAtBirthSchema>;

export const BenefitsCalPayloadSchema = z.object({
  // Application identity
  packet_id: z.string().uuid(),

  // Personal info (primary applicant)
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO 8601 date"),
  /** Last 4 digits of SSN only — full SSN comes from document scan, not stored in Civica DB */
  ssn_last4: z.string().regex(/^\d{4}$/, "Must be exactly 4 digits"),
  address: PostalAddressSchema,
  phone: E164Schema,

  // Demographic / eligibility answers (V1-2, #312) — back the step-1 portal
  // pages flagged as schema gaps by the V1-1a walk. is_homeless → ABNHA
  // "experiencing homelessness?"; marital_status → ABMRS; is_college_student →
  // ABCOS; citizenship_status → ABDOC. sex_assigned_at_birth (ABASX) and gender
  // (ABGNR) are optional portal pages.
  //
  // ALL of these are OPTIONAL and OMITTED when intake has no answer (autoplan
  // Code Quality #3 + #311/V1-11). In the human-in-loop extension model a
  // missing eligibility field must be SURFACED to the reviewer (left unfilled →
  // "needs review"), NOT silently defaulted. These four drive SNAP eligibility
  // (non-citizen rules, student restrictions, shelter/expedite); a defaulted
  // "us_citizen"/"not a student"/"not homeless" that LOOKS filled is a silent
  // wrong-data risk the reviewer can't catch. normalize.ts only sets each when
  // intake actually provides a value.
  /** ABNHA "Are you experiencing homelessness?" — Yes/No radio. Omitted when absent. */
  is_homeless: z.boolean().optional(),
  /** ABMRS marital status. Omitted when absent → surfaced as needs-review. */
  marital_status: MaritalStatusSchema.optional(),
  /** ABCOS "Are you a college student?" (SNAP eligibility). Omitted when absent. */
  is_college_student: z.boolean().optional(),
  /** ABDOC citizenship (SNAP eligibility). Omitted when absent → needs-review. */
  citizenship_status: CitizenshipStatusSchema.optional(),
  /** ABASX — optional portal page; omit when intake didn't collect it. */
  sex_assigned_at_birth: SexAssignedAtBirthSchema.optional(),
  /**
   * ABGNR gender identity. The portal exposes 7 options the walk did not fully
   * enumerate, so this is a free string (the portal mapping is human-filled);
   * optional because the page is optional.
   */
  gender: z.string().min(1).optional(),

  // Household members (excluding primary applicant)
  household_members: z.array(HouseholdMemberSchema),

  // Income sources across all household members
  income_sources: z.array(IncomeSourceSchema),

  // Utility / SUA — maps to BenefitsCal's utility allowance section
  utility_allowance_type: UtilityAllowanceTypeSchema,

  // Documents to be attached via Playwright (Phase 2); Supabase Storage URLs
  document_urls: z.array(DocumentItemSchema),

  // Consent
  telephonic_consent_recorded_at: z.string().datetime().optional(),
  client_signature_type: ClientSignatureTypeSchema,
});
export type BenefitsCalPayload = z.infer<typeof BenefitsCalPayloadSchema>;

// ---------------------------------------------------------------------------
// SubmissionResult
//
// Returned from Phase 2 Playwright automation after a submission attempt.
// Stored in snap_enrollment.benefitscal_submissions.
// ---------------------------------------------------------------------------

export const SubmissionStatusSchema = z.enum([
  "submitted",
  "failed",
  "pending_navigator_review",
]);
export type SubmissionStatus = z.infer<typeof SubmissionStatusSchema>;

export const SubmissionResultSchema = z.object({
  benefitscal_confirmation_number: z.string().optional(),
  submitted_at: z.string().datetime(),
  submitted_by_navigator_id: z.string().uuid(),
  assister_account_id: z.string().min(1),
  status: SubmissionStatusSchema,
  error: z.string().optional(),
});
export type SubmissionResult = z.infer<typeof SubmissionResultSchema>;
