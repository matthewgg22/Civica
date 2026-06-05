/**
 * Fill-value transforms (V1-3, #313).
 *
 * The typed selector map (`selector-map.ts`) carries a `source` dot-path back
 * into the prepared `BenefitsCalPayload` for each fillable field. For most
 * fields the payload value can be written verbatim. A few portal controls,
 * though, expect a DIFFERENT representation than the value Civica carries:
 *
 *   - The address-validation county `<select>` (ADDRESS_VALIDATION_FLOW /
 *     ABNHA) takes the 2-digit alphabetical CA county ORDINAL as its option
 *     value, but the packet carries the county NAME ("Sacramento").
 *   - The ABCON phone inputs historically reject the E.164 `+1XXXXXXXXXX` the
 *     payload stores; the portal wants a bare 10-digit national number.
 *
 * Rather than special-casing these in the extension's fill loop, each such
 * `FieldSelector` declares a `transform` name (V1-3 adds the optional
 * `transform?: string`); the consumer looks the function up in {@link TRANSFORMS}
 * and applies it to the resolved value before calling `fillElement`. A transform
 * returning `null` means "this value can't be mapped" — the consumer SKIPS the
 * fill and counts it as "needs review" rather than writing a garbage value
 * (e.g. an out-of-state / misspelled county that has no CA ordinal).
 *
 * Pure functions. Browser-safe per the `/core` contract: NO playwright, NO
 * imports from `../driver`, NO I/O. Importable from the browser extension.
 */

import { CA_COUNTY_ORDINALS } from "./selector-map";

// ---------------------------------------------------------------------------
// County name → 2-digit ordinal.
// ---------------------------------------------------------------------------

/**
 * Lowercased, suffix-stripped lookup built once from `CA_COUNTY_ORDINALS` so
 * the resolver is case-insensitive and tolerates a trailing " County".
 * Key: normalized county name (lowercase, no " county" suffix, collapsed
 * whitespace). Value: the 2-digit ordinal.
 */
const NORMALIZED_COUNTY_ORDINALS: Record<string, string> = Object.fromEntries(
  Object.entries(CA_COUNTY_ORDINALS).map(([name, ordinal]) => [
    normalizeCountyKey(name),
    ordinal,
  ]),
);

/** Normalize a county name for lookup: trim, collapse spaces, lowercase, strip a trailing " county". */
function normalizeCountyKey(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\s+county$/, "")
    .trim();
}

/**
 * Resolve a CA county NAME to its 2-digit alphabetical ordinal (the value the
 * portal's `select#county` option carries). Case-insensitive; tolerates a
 * trailing " County" ("Sacramento County" → "34"). Returns `null` for an
 * unknown county (e.g. an out-of-CA county or a typo) so the caller can surface
 * "needs human" rather than picking the wrong option.
 *
 * @example resolveCountyOrdinal("Sacramento")        // "34"
 * @example resolveCountyOrdinal("sacramento county") // "34"
 * @example resolveCountyOrdinal("Cook")              // null
 */
export function resolveCountyOrdinal(countyName: string): string | null {
  if (typeof countyName !== "string") return null;
  const key = normalizeCountyKey(countyName);
  if (key.length === 0) return null;
  return NORMALIZED_COUNTY_ORDINALS[key] ?? null;
}

// ---------------------------------------------------------------------------
// E.164 → 10-digit national phone.
// ---------------------------------------------------------------------------

/**
 * Strip an E.164 (or loosely-formatted) phone string down to a bare 10-digit
 * US national number — the form the ABCON phone inputs accept. Drops a leading
 * `+1`/`1` country code and any non-digit punctuation. Closes the V1-5 phone
 * gap where the fill primitive wrote the `+1`-prefixed value the portal rejects.
 *
 * Returns the 10 significant digits when the input contains exactly a US number
 * (10 digits, or 11 with a leading `1`). For any other digit count it returns
 * whatever digits remain so a partial/odd input still surfaces for the assister
 * to eyeball, rather than vanishing — callers may additionally length-check.
 *
 * @example formatPhone10Digit("+15551234567") // "5551234567"
 * @example formatPhone10Digit("(555) 123-4567") // "5551234567"
 */
export function formatPhone10Digit(e164: string): string {
  if (typeof e164 !== "string") return "";
  const digits = e164.replace(/\D/g, "");
  // 11-digit US number with leading country code "1" → drop it.
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

// ---------------------------------------------------------------------------
// Transform registry.
// ---------------------------------------------------------------------------

/**
 * Named value transforms keyed by the `FieldSelector.transform` string. A
 * transform maps a resolved payload value (already stringified by the caller)
 * to the representation the portal control expects, or returns `null` to mean
 * "unmappable — skip this fill and flag for human review".
 *
 * Wiring contract (the extension's `fillField`):
 *   1. resolve `field.source` → value
 *   2. if `field.transform` is set, `value = TRANSFORMS[field.transform](value)`
 *   3. if the transform returned `null`, SKIP (count as needs-review)
 *   4. otherwise `fillElement(el, field.type, value)`
 */
/**
 * Map a `PayFrequencySchema` value to the portal's visible frequency option
 * TEXT (resolved by `fillSelect`'s text fallback — the option values weren't
 * captured in the walk). Used by income (`ABEIC #oftenPaid`) and expense
 * (`ABAPH #dropdownoptiongroup`) frequency selects. `irregular` has no portal
 * option → returns null (needs-review). (#499)
 */
const PAY_FREQUENCY_PORTAL_TEXT: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Bi-Weekly",
  semimonthly: "Semi-Monthly",
  monthly: "Monthly",
  daily: "Daily",
  quarterly: "Quarterly",
  semiannual: "Semi Annually",
  annual: "Annually",
  onetime: "One-Time Only",
  hourly: "Hourly",
  // `irregular` intentionally absent → null (no portal option).
};

export function snapPayFrequency(v: string): string | null {
  return PAY_FREQUENCY_PORTAL_TEXT[v.trim().toLowerCase()] ?? null;
}

export const TRANSFORMS: Record<string, (v: string) => string | null> = {
  "ca-county-ordinal": resolveCountyOrdinal,
  // formatPhone10Digit never returns null; the registry signature allows it.
  "phone-10digit": (v) => formatPhone10Digit(v),
  "snap-pay-frequency": snapPayFrequency,
};

/** The set of valid transform names (for selector-map contract tests). */
export type TransformName = keyof typeof TRANSFORMS;
