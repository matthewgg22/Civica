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
  PacketExpense,
  ApplicantInfo,
} from "./normalize";
export type {
  BenefitsCalPayload,
  SubmissionResult,
  HouseholdMember,
  IncomeSource,
  PayFrequency,
  Expense,
  ExpenseType,
  DocumentItem as BenefitsCalDocumentItem,
  PostalAddress,
  E164,
  UtilityAllowanceType,
  ClientSignatureType,
  SubmissionStatus,
  MaritalStatus,
  CitizenshipStatus,
  SexAssignedAtBirth,
} from "./schemas";
export {
  BenefitsCalPayloadSchema,
  SubmissionResultSchema,
  HouseholdMemberSchema,
  IncomeSourceSchema,
  PayFrequencySchema,
  ExpenseSchema,
  ExpenseTypeSchema,
  PostalAddressSchema,
  E164Schema,
  UtilityAllowanceTypeSchema,
  ClientSignatureTypeSchema,
  SubmissionStatusSchema,
  MaritalStatusSchema,
  CitizenshipStatusSchema,
  SexAssignedAtBirthSchema,
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

// Fill-value transforms (V1-3, #313). Map a resolved payload value to the
// representation a portal control expects (county NAME → ordinal, E.164 →
// 10-digit). Pure functions; the extension applies the named transform from a
// FieldSelector's `transform` before fillElement. Returning null → skip + flag.
export {
  resolveCountyOrdinal,
  formatPhone10Digit,
  TRANSFORMS,
} from "./transforms";
export type { TransformName } from "./transforms";

// Label-first DOM resolver (V1-5, #314). The runtime counterpart to
// Playwright's getByLabel — turns a label-first FieldSelector into the DOM
// element it points at. Pure DOM; consumed by the browser extension.
export { resolveField } from "./locate";

// Household-member payload scoping (V1-5 PR4, #314). Wraps the payload so a
// repeating step-2 page's `household_members[0].X` source paths resolve to the
// Nth member. Pure compute; consumed by content.ts and the step-2 tests.
export { scopePayloadForMember } from "./member-scope";

// Radio/checkbox option-selection resolver (V1-6, #314). Turns a schema value
// (or a constant / a presence test) into the specific option of a radio/checkbox
// group to click — or a typed "needs-review" reason, never a default. Pure
// compute; consumed by the browser extension's fill loop.
export {
  resolveOption,
  isOptionGroupField,
  constantValue,
  normalizeOptionValue,
} from "./select-option";
export type {
  OptionResolution,
  ResolvedOption,
  UnresolvedOption,
  OptionResolutionReason,
} from "./select-option";

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

// Dynamic section sequence (V1-5 PR1, #314). Returns the ordered pageCodes
// the extension walks for a given payload + staff-elected flow type.
// D8: undefined flowType → multi-program (safe superset).
// D12: flowType collected from staff activation dropdown, not from the packet.
export { sectionSequence } from "./section-sequence";
export type { FlowType } from "./section-sequence";

// Address validation modal flow (V1-5 PR2, #314). Surfaces the ABNHA 2-modal
// address-validation flow to the human reviewer; NO auto-accept. The extension
// fires civica:address-validation-required and awaits civica:address-validation-resolved.
export {
  scrapeAddressOptions,
  dispatchAddressValidationRequired,
  awaitAddressResolution,
  handleAddressValidationModal,
  ADDRESS_VALIDATION_REQUIRED_EVENT,
  ADDRESS_VALIDATION_RESOLVED_EVENT,
} from "./address-validation";
export type {
  AddressOption,
  AddressValidationRequiredDetail,
  AddressValidationResolvedDetail,
} from "./address-validation";

