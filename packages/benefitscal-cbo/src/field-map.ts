/**
 * BenefitsCal CBO portal field map
 *
 * Maps Civica field names to BenefitsCal application form field IDs.
 * BenefitsCal uses the CalFresh SAWS-1 field structure internally.
 *
 * Field IDs were identified by inspecting the publicly visible BenefitsCal
 * application form at benefitscal.com (no CBO account required to view).
 *
 * NOTE: Fields marked TODO below are unconfirmed until a CBO Assister account
 * is approved by the county (LA DPSS or SF HSA, ~2-4 weeks). The IDs here are
 * best guesses from the visible form HTML. Verify during Phase 2 Playwright
 * build once the account is active.
 *
 * DO NOT remove TODOs — they are the Phase 2 verification checklist.
 */

// ---------------------------------------------------------------------------
// Primary applicant personal info
// ---------------------------------------------------------------------------

export const PERSONAL_INFO_FIELDS = {
  /** Primary applicant given name */
  firstName: "firstName",

  /** Primary applicant family name */
  lastName: "lastName",

  /** ISO 8601 date of birth: YYYY-MM-DD */
  dateOfBirth: "dateOfBirth",

  /**
   * TODO: BenefitsCal may request full SSN on the form (last4 won't suffice).
   * Civica only stores ssn_last4. Full SSN comes from document scan.
   * Verify field ID and whether partial SSN is accepted.
   */
  ssn: "ssn",

  // Address fields
  streetAddress: "streetAddress",
  city: "city",
  state: "state",
  zipCode: "zipCode",

  /**
   * TODO: Verify phone field ID. BenefitsCal may use "cellPhone" vs "homePhone"
   * vs a unified "phoneNumber". Civica stores one E.164 phone per applicant.
   */
  phoneNumber: "phoneNumber",
} as const;

// ---------------------------------------------------------------------------
// Household composition
// ---------------------------------------------------------------------------

export const HOUSEHOLD_FIELDS = {
  /**
   * Array of household members (excluding primary applicant).
   * Each member has: firstName, lastName, dateOfBirth, relationship.
   * TODO: Verify relationship enum values accepted by BenefitsCal form.
   */
  householdMembers: "householdMembers",
} as const;

// ---------------------------------------------------------------------------
// Income
// ---------------------------------------------------------------------------

export const INCOME_FIELDS = {
  /**
   * Income type string (e.g. "wages", "self_employment", "gig", "none").
   * TODO: Verify exact enum values BenefitsCal accepts for incomeType.
   * CalFresh SAWS-1 distinguishes ~12 income types; map from Civica income_type.
   */
  incomeType: "incomeType",

  /** Monthly gross income amount in USD */
  incomeAmount: "incomeAmount",

  /**
   * Frequency of income payment.
   * TODO: Verify BenefitsCal accepts "monthly" | "weekly" | "biweekly" | "annual".
   * May need mapping from Civica's "irregular" to a BenefitsCal-accepted value.
   */
  incomeFrequency: "incomeFrequency",
} as const;

// ---------------------------------------------------------------------------
// Utility allowance
// ---------------------------------------------------------------------------

export const UTILITY_FIELDS = {
  /**
   * TODO: BenefitsCal's utility section uses checkbox-based questions, not
   * a single "allowanceType" field. Mapping from Civica's SUA tier enum to
   * individual checkboxes (heat/gas, electricity, phone) requires form inspection
   * with a CBO account. This will be resolved in Phase 2.
   *
   * Expected structure after Phase 2 investigation:
   *   paysHeat: boolean
   *   paysElectricity: boolean
   *   paysPhone: boolean
   *   paysWater: boolean
   */
  utilityAllowanceType: "utilityAllowanceType", // TODO: replace with individual checkbox fields
} as const;

// ---------------------------------------------------------------------------
// Document upload
// ---------------------------------------------------------------------------

export const DOCUMENT_FIELDS = {
  /**
   * Document upload section field IDs.
   * TODO: BenefitsCal document upload UI uses separate upload buttons per
   * document type. Field IDs for each type must be confirmed via Playwright
   * inspection during Phase 2. Provisional names shown here.
   *
   * Expected structure:
   *   photoId: "uploadPhotoId"
   *   paystub: "uploadPaystub"
   *   utilityBill: "uploadUtilityBill"
   *   bankStatement: "uploadBankStatement"
   *   leaseAgreement: "uploadLeaseAgreement"
   *   other: "uploadOther"
   */
  documentUpload: "documentUpload", // TODO: replace with per-type upload field IDs
} as const;

// ---------------------------------------------------------------------------
// Consent / signature
// ---------------------------------------------------------------------------

export const CONSENT_FIELDS = {
  /**
   * BenefitsCal signature section.
   * TODO: Verify field IDs for:
   *   - Client electronic signature (in-person portal)
   *   - Telephonic signature attestation checkbox
   *   - Telephonic consent recorded timestamp field (if present)
   */
  clientSignatureType: "clientSignatureType", // TODO: verify field ID
  telephonicConsentDate: "telephonicConsentDate", // TODO: verify field ID
} as const;
