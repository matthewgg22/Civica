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

// Typed selector map (V1-1a, #310) — the materialized form of the live
// production CBO portal walk in `portal-map/SELECTORS.md`. This is the
// authoritative selector data; `field-map.ts` below is the deprecated
// placeholder kept only until the extension migrates in V1-5 (#314).
export {
  PORTAL_PAGES,
  PORTAL_PAGES_BY_CODE,
  ABNAV_START_BUTTONS,
  ENTRY_FLOW_BUTTONS,
  ADDRESS_VALIDATION_FLOW,
  CA_COUNTY_ORDINALS,
  NEXT_BUTTON,
} from "./selector-map";
export type {
  FieldType,
  FieldSelector,
  PortalPage,
} from "./selector-map";

// React-safe DOM fill primitive (V1-1b, #311). Pure DOM; the shared, correct
// fill engine that `content.ts` adopts in V1-5 (#314). See fill.ts header for
// why a plain `el.value = x` is dropped by React's controlled inputs.
export {
  reactSetValue,
  fillElement,
  fillText,
  fillDatePassword,
  fillSelect,
  fillRadio,
  fillCheckbox,
  formatDateForPortal,
  coerceBoolean,
} from "./fill";

// New unified field-map shape — consumed by both the server-side Playwright
// submitter and the browser extension content script. Selectors carry TODO
// markers until TODO-14 (live CBO Manager portal walkthrough) clears them.
// DEPRECATED: prefer PORTAL_PAGES above; see selector-map.ts / field-map.ts.
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
