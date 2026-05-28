export { normalizeForPortal } from "./normalize";
export type { NormalizeInput, PacketAnswer, DocumentItem, PacketHouseholdMember, PacketIncomeSource, ApplicantInfo } from "./normalize";
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
export {
  submitToBenefitsCal,
  nodePlaywrightDriverFactory,
} from "./submitter";
export type {
  SubmitterOptions,
  SubmitterResult,
  TranscriptStep,
  BrowserDriver,
  BrowserDriverPage,
  BrowserDriverFactory,
} from "./submitter";
export { browserlessDriverFactory } from "./drivers/browserless";
export type {
  BrowserlessDriverOptions,
  BrowserlessFunctionResponse,
} from "./drivers/browserless";

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
