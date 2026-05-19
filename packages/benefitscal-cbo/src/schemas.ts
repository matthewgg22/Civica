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
