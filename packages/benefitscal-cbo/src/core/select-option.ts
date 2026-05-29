/**
 * Radio/checkbox option-selection resolver (V1-6, #314).
 *
 * The typed selector map (`selector-map.ts`) carries a `source` dot-path for
 * each fillable field. Plain text/select/checkbox fields fill the resolved value
 * (optionally via a `transform`) directly. Eligibility radio *groups*, however,
 * need a value→option step the raw source→fillElement flow can't express: a
 * schema value like `citizenship_status: "us_citizen"` or `is_college_student:
 * true` must be turned into "click THIS option" within a multi-option group.
 *
 * This module is that step. Given a group `FieldSelector` (one carrying
 * `optionMap` + `options`, or `constant` + `options`, or `presenceOf` +
 * `options`) and the resolved payload value, it returns the per-option
 * `FieldSelector` (label + fallbackSelector) the consumer should locate and
 * click — or a typed reason it couldn't, so the consumer surfaces "needs review"
 * instead of guessing. It NEVER falls through to a default option: an
 * eligibility-critical value that isn't explicitly mapped is left for the human.
 *
 * Pure compute. Browser-safe per the `/core` contract: NO playwright, NO imports
 * from `../driver`, NO I/O, NO DOM. Importable from the browser extension.
 */

import type { FieldSelector } from "./selector-map";

/**
 * Normalize a resolved payload value to the canonical string an `optionMap` key
 * is written against:
 *   - booleans → `"true"` / `"false"`
 *   - the boolean-ish strings "true"/"false"/"yes"/"no"/"1"/"0" → `"true"`/`"false"`
 *   - numbers 1/0 → `"true"`/`"false"`; other numbers → their string form
 *   - everything else → the trimmed, lowercased string with spaces/hyphens
 *     collapsed to underscores (so "Domestic Partner"/"domestic-partner" →
 *     "domestic_partner", matching the schema enums)
 *
 * Returns null for null/undefined/empty so the caller treats a missing value as
 * "no value", never a default option.
 */
export function normalizeOptionValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (value === 1) return "true";
    if (value === 0) return "false";
    return String(value);
  }
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (s.length === 0) return null;
  const lower = s.toLowerCase();
  if (lower === "true" || lower === "yes" || lower === "1") return "true";
  if (lower === "false" || lower === "no" || lower === "0") return "false";
  return lower.replace(/[\s-]+/g, "_");
}

/**
 * Why an option could not be resolved (so the consumer can tally it correctly).
 *   - "no-value"     the source resolved to null/undefined/empty
 *   - "needs-review" the (normalized) value has no `optionMap` entry, or a
 *                    presence-`absent` case with no `absent` option, or the map
 *                    is malformed — never a guess
 */
export type OptionResolutionReason = "no-value" | "needs-review";

export interface ResolvedOption {
  ok: true;
  /** The per-option FieldSelector to locate + click. */
  option: FieldSelector;
  /** The option key that was selected (e.g. "Yes", "married", "present"). */
  key: string;
}
export interface UnresolvedOption {
  ok: false;
  reason: OptionResolutionReason;
}
export type OptionResolution = ResolvedOption | UnresolvedOption;

/** Look an option key up in `field.options`; needs-review if absent/missing. */
function pickOptionByKey(
  field: FieldSelector,
  key: string | undefined,
): OptionResolution {
  if (key === undefined) return { ok: false, reason: "needs-review" };
  const option = field.options?.[key];
  if (!option) {
    // The map names an option key with no matching `options` entry (a selector-
    // map bug) — don't guess, flag it.
    return { ok: false, reason: "needs-review" };
  }
  return { ok: true, option, key };
}

/**
 * Resolve which option of a group `field` to select.
 *
 * Resolution mode is determined by which group attribute the field carries
 * (exactly one is expected on a group field):
 *   - `constant`   → select `options[constant]` regardless of `resolvedValue`
 *                    (ABPRI applying-for-self = always "Yes").
 *   - `presenceOf` → the caller passes the value at the `presenceOf` path as
 *                    `resolvedValue`; select `options.present` when it is a
 *                    non-empty value, else `options.absent` (ABSSN). A missing
 *                    `absent` option ⇒ needs-review (we never auto-pick a no-SSN
 *                    answer from presence alone).
 *   - `optionMap`  → normalize `resolvedValue`, look it up in `optionMap` to get
 *                    an option key, then `options[key]`. An unmapped value ⇒
 *                    needs-review (no default); a null value ⇒ no-value.
 *
 * A field with NONE of those attributes is not a group field — returns
 * needs-review so the caller leaves it alone.
 */
export function resolveOption(
  field: FieldSelector,
  resolvedValue: unknown,
): OptionResolution {
  // 1. Constant — fixed option, ignores the payload entirely.
  if (field.constant !== undefined) {
    return pickOptionByKey(field, field.constant);
  }

  // 2. Presence — present/absent based on whether the value exists.
  if (field.presenceOf !== undefined) {
    const present =
      resolvedValue !== null &&
      resolvedValue !== undefined &&
      resolvedValue !== "";
    if (present) return pickOptionByKey(field, "present");
    // Absent: only auto-select if the map gives an explicit `absent` option;
    // otherwise leave it for the human (needs-review), never a guess.
    if (field.options?.absent) return pickOptionByKey(field, "absent");
    return { ok: false, reason: "needs-review" };
  }

  // 3. Value → option map.
  if (field.optionMap) {
    const normalized = normalizeOptionValue(resolvedValue);
    if (normalized === null) return { ok: false, reason: "no-value" };
    const key = field.optionMap[normalized];
    // Unmapped value → needs-review. Eligibility-critical: never default.
    return pickOptionByKey(field, key);
  }

  // Not a group field.
  return { ok: false, reason: "needs-review" };
}

/**
 * True when `field` is a radio/checkbox *group* — i.e. it carries per-option
 * locators in `options` and is driven by one of the V1-6 option-selection
 * mechanisms (`constant`, `presenceOf`, or `optionMap`). The consumer routes
 * these through {@link resolveOption} (resolve a schema value → which option to
 * click) instead of the plain source→transform→fillElement path.
 *
 * A `constant` on a field with NO `options` (e.g. the ABPRI CalFresh checkbox
 * `constant: "true"`) is NOT a group — it is a constant-direct fill: the
 * consumer fills the field itself with `constant` (see {@link constantValue}).
 */
export function isOptionGroupField(field: FieldSelector): boolean {
  if (field.options === undefined) return false;
  return (
    field.constant !== undefined ||
    field.presenceOf !== undefined ||
    field.optionMap !== undefined
  );
}

/**
 * The constant value a non-group field should be filled with, or null if it has
 * none. A field with `constant` set but NO `options` (the ABPRI `#snap`
 * checkbox) is filled directly with this value — no option indirection. Group
 * fields (those with `options`) return null here; they go through
 * {@link resolveOption} instead.
 */
export function constantValue(field: FieldSelector): string | null {
  if (field.options !== undefined) return null;
  return field.constant ?? null;
}
