/**
 * React-safe DOM fill primitive (V1-1b, #311).
 *
 * BenefitsCal is a React app built on the CalSAWS "lift-ux" component library
 * (see `selector-map.ts`). Its inputs are *controlled* — React owns the value
 * via internal state and re-renders from it. Setting `el.value = x` directly
 * mutates the DOM node but does NOT notify React's value tracker, so on the
 * next render (or on submit) React overwrites the field back to its own state
 * and the value is dropped. This was confirmed in a live walk: a plain DOM set
 * left the field validating as *empty*. The existing extension content script
 * (`apps/civica-submitter-extension/src/content.ts` `writeText`) has exactly
 * this bug; it will adopt this primitive in V1-5 (#314).
 *
 * The fix: write through the prototype's *native* `value` setter
 * (`HTMLInputElement.prototype`'s `value` descriptor) rather than the instance.
 * React patches the instance-level descriptor to feed its `_valueTracker`; the
 * prototype setter is the un-patched one. Calling it updates the tracker's
 * cached value out from under React, so when we then dispatch a bubbling
 * `input` event React's `onChange` fires and React adopts our value as its own
 * state. This is precisely the trick Playwright's `.fill()` performs for free —
 * the pure-DOM path must do it by hand.
 *
 * Pure DOM. Browser-safe per the `/core` contract: NO playwright, NO imports
 * from `../driver`, NO I/O. Importable from the browser extension.
 */

import type { FieldType } from "./selector-map";

// ---------------------------------------------------------------------------
// The React fix — native value setter.
// ---------------------------------------------------------------------------

type ValueElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * Write `value` into a controlled input/textarea/select through the element
 * prototype's *native* `value` setter, then dispatch bubbling `input` + `change`
 * events. The native setter bypasses the instance-level setter React installs
 * for its value tracker, which is what makes React's `onChange` actually fire
 * and adopt the new value (a plain `el.value = x` is silently reverted on the
 * next React render). See file header for the full rationale.
 */
export function reactSetValue(el: ValueElement, value: string): void {
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  // The prototype always carries a `value` accessor; `!` is safe here.
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// ---------------------------------------------------------------------------
// Date formatting (date-password fields).
// ---------------------------------------------------------------------------

/**
 * Format a date for the portal's MM/DD/YYYY text inputs (e.g. the ABRDT DOB
 * `type=password` field). Accepts an ISO `YYYY-MM-DD` (optionally with a time
 * component) and returns `MM/DD/YYYY`. Anything already non-ISO is passed
 * through unchanged so a value that's already MM/DD/YYYY is idempotent.
 */
export function formatDateForPortal(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

// ---------------------------------------------------------------------------
// Per-kind fill functions. Each guards its element type and returns true only
// when the element was actually written/affirmed.
// ---------------------------------------------------------------------------

/**
 * Fill a plain text `<input>`/`<textarea>` (FieldType "text"). React-safe.
 * Idempotent: writing the same value twice leaves the field in the same state.
 */
export function fillText(el: Element, value: string): boolean {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    return false;
  }
  reactSetValue(el, value);
  return true;
}

/**
 * Fill the DOB-style `type=password` text input (FieldType "date-password").
 * Identical to {@link fillText} except the value is normalized to MM/DD/YYYY
 * first. The portal renders DOB as `type=password` to defeat browser autofill;
 * it is still a text field as far as the DOM is concerned.
 */
export function fillDatePassword(el: Element, value: string): boolean {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    return false;
  }
  reactSetValue(el, formatDateForPortal(value));
  return true;
}

/**
 * Select an option in a `<select>` (FieldType "select"). React-safe. Returns
 * false when no `<option>` matches (so the caller can surface "option not
 * found" rather than silently leaving the prior value), mirroring
 * `content.ts`'s `writeSelect`.
 *
 * Matching is two-tier:
 *   1. by option `value` — for selects whose internal codes a transform
 *      produces (county ordinal "34", state "CA").
 *   2. fallback by visible option TEXT (case-insensitive, trimmed) — for
 *      selects whose option values the portal walk did not capture but whose
 *      labels are known (pay/expense frequency dropdowns, relationship). The
 *      matched option's `value` is still written, so React's controlled
 *      <select> adopts it. (#499)
 */
export function fillSelect(el: Element, value: string): boolean {
  if (!(el instanceof HTMLSelectElement)) return false;
  const byValue = Array.from(el.options).find((opt) => opt.value === value);
  if (byValue) {
    reactSetValue(el, value);
    return true;
  }
  const target = value.trim().toLowerCase();
  const byText = Array.from(el.options).find(
    (opt) => opt.text.trim().toLowerCase() === target,
  );
  if (byText) {
    reactSetValue(el, byText.value);
    return true;
  }
  return false;
}

/**
 * Select a radio button (FieldType "radio"). The selector map models radio
 * groups as one `FieldSelector` per option (e.g. `…Yes` / `…No`), so the
 * caller resolves the *specific* radio element to choose. We `.click()` it
 * (rather than setting `.checked`/`.value`) so React's synthetic event and the
 * group's deselection both fire. Idempotent: an already-checked radio is left
 * untouched. Pass `value` to additionally require `el.value === value` before
 * clicking (matches `content.ts`'s `writeRadio` contract); omit it to click the
 * resolved radio unconditionally.
 */
export function fillRadio(el: Element, value?: string): boolean {
  if (!(el instanceof HTMLInputElement) || el.type !== "radio") return false;
  if (value !== undefined && el.value !== value) return false;
  if (!el.checked) el.click();
  return true;
}

/**
 * Toggle a `<input type=checkbox>` (FieldType "checkbox") to `checked`. Uses
 * `.click()` (not a `.checked` set) so React's synthetic change event fires,
 * and only when the current state differs from the desired state — so it is
 * idempotent and never flips an already-correct box. Mirrors `content.ts`'s
 * `writeCheckbox`.
 */
export function fillCheckbox(el: Element, checked: boolean): boolean {
  if (!(el instanceof HTMLInputElement) || el.type !== "checkbox") return false;
  if (el.checked === checked) return true;
  el.click();
  return true;
}

// ---------------------------------------------------------------------------
// Dispatcher — fill by FieldType.
// ---------------------------------------------------------------------------

/**
 * Coerce assorted truthy/falsey representations to a boolean for checkbox
 * fills. Strings "true"/"yes"/"1" (case-insensitive) and non-zero numbers are
 * truthy; everything else is false. Mirrors `content.ts`'s `coerceBoolean`.
 */
export function coerceBoolean(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "yes" || s === "1";
  }
  if (typeof v === "number") return v !== 0;
  return false;
}

/**
 * Fill a single resolved DOM element by its portal {@link FieldType}.
 *
 * - `text`          → {@link fillText}
 * - `date-password` → {@link fillDatePassword} (value normalized to MM/DD/YYYY)
 * - `select`        → {@link fillSelect} (false if the option value is absent)
 * - `radio`         → {@link fillRadio} (clicks the matching radio)
 * - `checkbox`      → {@link fillCheckbox} (toggles via click; value coerced)
 * - `button`        → not a fill target; always returns false
 *
 * Returns true when the element was written/affirmed, false otherwise (wrong
 * element type, missing select option, non-matching radio value, or a `button`
 * kind). Idempotent across repeated calls with the same value.
 */
export function fillElement(el: Element, kind: FieldType, value: string): boolean {
  switch (kind) {
    case "text":
      return fillText(el, value);
    case "date-password":
      return fillDatePassword(el, value);
    case "select":
      return fillSelect(el, value);
    case "radio":
      return fillRadio(el, value);
    case "checkbox":
      return fillCheckbox(el, coerceBoolean(value));
    case "button":
      // Buttons are navigation, not data entry — never filled by this primitive.
      return false;
    default: {
      const exhaustive: never = kind;
      void exhaustive;
      return false;
    }
  }
}
