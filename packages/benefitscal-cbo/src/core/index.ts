/**
 * @civica/benefitscal-cbo/core — browser-safe surface.
 *
 * Pure compute: packet normalization, payload schemas, the typed portal
 * selector map, the React-safe fill primitive, and the label-first DOM
 * resolver. NOTHING in this subtree may import `playwright`, the `submitter`,
 * or the `browserless` driver — the browser extension
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
  CONFIRMATION_PAGE,
} from "./selector-map";
export type {
  FieldType,
  FieldSelector,
  PortalPage,
  ConfirmationPageSelector,
} from "./selector-map";

// Label-first DOM resolver (V1-5, #314). The runtime counterpart to
// Playwright's getByLabel — turns a label-first FieldSelector into the DOM
// element it points at. Pure DOM; consumed by the browser extension.
export { resolveField } from "./locate";

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

