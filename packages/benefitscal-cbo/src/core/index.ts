/**
 * @civica/benefitscal-cbo/core — browser-safe surface.
 *
 * Pure compute: packet normalization, payload schemas, and the portal
 * field-map. NOTHING in this subtree may import `playwright`, the
 * `submitter`, or the `browserless` driver — the browser extension
 * (`apps/civica-submitter-extension`) imports from here and must stay
 * bundleable for a browser/extension target.
 *
 * Server-only browser-automation code lives in `../driver`.
 */

export { normalizeForPortal } from "./normalize";
export type {
  NormalizeInput,
  PacketAnswer,
  DocumentItem,
  PacketHouseholdMember,
  PacketIncomeSource,
  ApplicantInfo,
} from "./normalize";
export type {
  BenefitsCalPayload,
  SubmissionResult,
  HouseholdMember,
  IncomeSource,
  DocumentItem as BenefitsCalDocumentItem,
  PostalAddress,
  E164,
  UtilityAllowanceType,
  ClientSignatureType,
  SubmissionStatus,
} from "./schemas";
export {
  BenefitsCalPayloadSchema,
  SubmissionResultSchema,
  HouseholdMemberSchema,
  IncomeSourceSchema,
  PostalAddressSchema,
  E164Schema,
  UtilityAllowanceTypeSchema,
  ClientSignatureTypeSchema,
  SubmissionStatusSchema,
} from "./schemas";

// New unified field-map shape — consumed by both the server-side Playwright
// submitter and the browser extension content script. Selectors carry TODO
// markers until TODO-14 (live CBO Manager portal walkthrough) clears them.
export { APPLICATION_FORM_PAGES, CONFIRMATION_PAGE } from "./field-map";
export type {
  FieldFillKind,
  FieldFill,
  FormPage,
  ConfirmationPage,
} from "./field-map";
// Legacy exports retained for backward compatibility — new code should
// prefer APPLICATION_FORM_PAGES above.
export {
  PERSONAL_INFO_FIELDS,
  HOUSEHOLD_FIELDS,
  INCOME_FIELDS,
  UTILITY_FIELDS,
  DOCUMENT_FIELDS,
  CONSENT_FIELDS,
} from "./field-map";
