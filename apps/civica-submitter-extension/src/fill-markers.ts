// Per-field fill markers (V1-6, #315).
//
// After the content script fills a portal field, we visually mark the touched
// element so the assister can SEE exactly what Civica wrote vs what they must
// check by hand. The assister is the compliance gate; a bare count in the
// banner doesn't tell them *which* fields to verify. Markers close that gap.
//
// Hard guarantee — NON-DESTRUCTIVE. A marker never changes an element's value,
// its `checked` state, its event listeners, its tab order, or its
// interactivity. It is purely visual and fully reversible:
//   - A `data-civica-fill="filled|review"` attribute on the element drives an
//     injected, `civica-`-scoped stylesheet that paints a coloured left-border
//     + outline. The attribute is the ONLY mutation to the portal's own DOM
//     node, and stripping it fully reverts the visual.
//   - A small "filled by Civica" badge is an absolutely-positioned element
//     parented to <body> (NOT inserted near the field, so it can't disturb the
//     portal's layout or be caught by the portal's form logic). It is removed
//     wholesale on cleanup.
//
// We also record, per marked element, the exact value Civica wrote (its
// "fingerprint"). That record is what lets the Clear control later blank ONLY
// the fields whose current value still matches what Civica wrote — never a
// field the human has since edited. See `clearCivicaFills`.

import { reactSetValue } from "@civica/benefitscal-cbo/core";
import type { FieldType } from "@civica/benefitscal-cbo/core";

/** Visual class of a marker. `filled` = Civica wrote it; `review` = needs a human. */
export type MarkerKind = "filled" | "review";

/** Attribute we tag a touched element with. Unique `civica-` prefix. */
export const FILL_ATTR = "data-civica-fill";
/** Attribute pinning a badge to the element it annotates (for cleanup pairing). */
const BADGE_ATTR = "data-civica-badge";
/** id of the single injected marker stylesheet. */
const MARKER_STYLE_ID = "civica-fill-marker-style";
/** Class on every floating badge element (parented to <body>). */
const BADGE_CLASS = "civica-fill-badge";

/**
 * What Civica wrote into one element, captured at fill time so the Clear
 * control can later tell "still what Civica wrote" from "the human edited it".
 *   - For text/date/select: `value` is the string written; clear blanks it iff
 *     the element's current value still equals `value`.
 *   - For radio/checkbox: `checked` is the state Civica set (always true — we
 *     only ever check, never uncheck); clear reverts iff still checked.
 */
export interface FillFingerprint {
  /** A stable key for the element (its id, else a synthetic data-attr token). */
  key: string;
  type: FieldType;
  /** Written string value (text/date/select). Undefined for radio/checkbox. */
  value?: string;
  /** Whether Civica set this control checked (radio/checkbox). */
  checked?: boolean;
}

// ---------------------------------------------------------------------------
// Marker stylesheet (injected once).
// ---------------------------------------------------------------------------

/**
 * Inject the marker stylesheet exactly once. Scoped entirely behind the
 * `[data-civica-fill]` attribute selector and the `.civica-fill-badge` class so
 * it cannot affect any portal element we didn't tag. Uses `!important` on the
 * outline so a hostile portal rule can't visually swallow the marker, but ONLY
 * on cosmetic outline/border properties — never on anything that affects
 * layout flow or interactivity.
 */
function ensureMarkerStyle(doc: Document): void {
  if (doc.getElementById(MARKER_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = MARKER_STYLE_ID;
  style.textContent = `
    [${FILL_ATTR}="filled"] {
      outline: 2px solid #1f4d3b !important;
      outline-offset: 1px !important;
      border-left: 3px solid #1f4d3b !important;
    }
    [${FILL_ATTR}="review"] {
      outline: 2px dashed #B5511E !important;
      outline-offset: 1px !important;
      border-left: 3px solid #B5511E !important;
    }
    .${BADGE_CLASS} {
      position: absolute;
      z-index: 2147483646;
      font: 600 10px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 2px 5px;
      border-radius: 3px;
      pointer-events: none;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    }
    .${BADGE_CLASS}[data-kind="filled"] { background: #1f4d3b; color: #fff; }
    .${BADGE_CLASS}[data-kind="review"] { background: #B5511E; color: #fff; }
  `;
  (doc.head ?? doc.documentElement).appendChild(style);
}

// ---------------------------------------------------------------------------
// Element keys + fingerprints.
// ---------------------------------------------------------------------------

let keyCounter = 0;

/**
 * A stable, lookup-able key for an element. Prefers the element's existing id;
 * otherwise stamps a synthetic `data-civica-key` token (and reuses it on
 * re-fill). The key lets a persisted fingerprint be re-bound to the element on
 * a later page load.
 */
function elementKey(el: Element): string {
  if (el.id) return `#${el.id}`;
  const existing = el.getAttribute("data-civica-key");
  if (existing) return existing;
  const synthetic = `civica-key-${++keyCounter}`;
  el.setAttribute("data-civica-key", synthetic);
  return synthetic;
}

/** Re-find an element from a key produced by {@link elementKey}. */
function findByKey(key: string, root: ParentNode): Element | null {
  if (key.startsWith("#")) return root.querySelector(key);
  return root.querySelector(`[data-civica-key="${cssEscape(key)}"]`);
}

/** Minimal CSS.escape shim (jsdom lacks it in some envs). */
function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(s);
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

/** Build the fingerprint of what Civica just wrote into `el`. */
export function fingerprintOf(el: Element, type: FieldType): FillFingerprint {
  const key = elementKey(el);
  if (type === "radio" || type === "checkbox") {
    return { key, type, checked: true };
  }
  const value =
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
      ? el.value
      : undefined;
  return { key, type, value };
}

// ---------------------------------------------------------------------------
// Apply / clear markers.
// ---------------------------------------------------------------------------

/**
 * Visually mark one element. NON-DESTRUCTIVE: sets the `data-civica-fill`
 * attribute (drives the injected outline) and appends a floating badge to
 * <body> positioned over the element. Never touches value/checked/events.
 */
export function markElement(el: Element, kind: MarkerKind, label: string): void {
  const doc = el.ownerDocument ?? document;
  ensureMarkerStyle(doc);
  el.setAttribute(FILL_ATTR, kind);
  // Give the element a stable key now so cleanup + clear can pair to it.
  const key = elementKey(el);
  placeBadge(el, key, kind, label, doc);
}

/**
 * Create or reposition the floating badge for `el`. Parented to <body> at
 * absolute document coordinates so it scrolls with the page and never disturbs
 * the portal's own layout. Reuses an existing badge for the same key.
 */
function placeBadge(
  el: Element,
  key: string,
  kind: MarkerKind,
  label: string,
  doc: Document,
): void {
  const body = doc.body;
  if (!body) return;
  let badge = body.querySelector<HTMLElement>(
    `.${BADGE_CLASS}[${BADGE_ATTR}="${cssEscape(key)}"]`,
  );
  if (!badge) {
    badge = doc.createElement("div");
    badge.className = BADGE_CLASS;
    badge.setAttribute(BADGE_ATTR, key);
    body.appendChild(badge);
  }
  badge.setAttribute("data-kind", kind);
  badge.textContent = kind === "filled" ? "filled by Civica" : "Civica · review";
  badge.title = label;
  // Position at the element's top-left in document coordinates. jsdom returns a
  // zeroed rect, which is fine (badge stacks at 0,0 in tests; visual-only).
  const rect = el.getBoundingClientRect();
  const win = doc.defaultView;
  const scrollX = win?.scrollX ?? 0;
  const scrollY = win?.scrollY ?? 0;
  badge.style.left = `${Math.max(0, rect.left + scrollX)}px`;
  badge.style.top = `${Math.max(0, rect.top + scrollY - 14)}px`;
}

/**
 * Remove ALL Civica markers from the document: strip every `data-civica-fill`
 * attribute and remove every floating badge. Called before a re-fill (so stale
 * markers never linger) and by the Clear control. Leaves the element's value /
 * checked state and the `data-civica-key` token untouched — clearing the
 * *visual* is independent of blanking values.
 */
export function clearAllMarkers(root: ParentNode = document): void {
  const doc =
    root instanceof Document
      ? root
      : (root as Element).ownerDocument ?? document;
  for (const el of Array.from(root.querySelectorAll(`[${FILL_ATTR}]`))) {
    el.removeAttribute(FILL_ATTR);
  }
  const badgeHost = doc.body ?? doc;
  for (const badge of Array.from(badgeHost.querySelectorAll(`.${BADGE_CLASS}`))) {
    badge.remove();
  }
}

// ---------------------------------------------------------------------------
// Clear Civica-written values (the safe, human-edit-preserving path).
// ---------------------------------------------------------------------------

export interface ClearResult {
  /** Fields blanked/unchecked because they still held what Civica wrote. */
  cleared: number;
  /** Fields left alone because the human had since changed them. */
  preservedHumanEdits: number;
  /** Fingerprinted fields whose element was no longer on the page. */
  missing: number;
}

/**
 * Clear ONLY the fields Civica wrote, preserving anything the human edited.
 *
 * Safety rule (the whole point): for each fingerprint we re-find the element
 * and revert it ONLY when its CURRENT state still equals what Civica wrote:
 *   - text/date/select: blank it iff `el.value === fingerprint.value`.
 *   - checkbox: uncheck (via click, React-safe) iff it is still `checked`.
 *   - radio: uncheck iff it is still `checked` (the human picking a different
 *     option in the group already unchecked ours → we skip it).
 * If the current state differs, the human touched it → we leave it.
 *
 * Also removes all markers. Returns a tally for the overlay.
 */
export function clearCivicaFills(
  fingerprints: FillFingerprint[],
  root: ParentNode = document,
): ClearResult {
  let cleared = 0;
  let preservedHumanEdits = 0;
  let missing = 0;

  for (const fp of fingerprints) {
    const el = findByKey(fp.key, root);
    if (!el) {
      missing++;
      continue;
    }
    if (fp.type === "radio" || fp.type === "checkbox") {
      if (el instanceof HTMLInputElement && el.checked) {
        // Still checked → still Civica's value. Uncheck React-safely.
        if (el.type === "checkbox") {
          el.click(); // checked → unchecked, fires React onChange
        } else {
          // Radios don't uncheck via click; set + dispatch so React adopts it.
          el.checked = false;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        cleared++;
      } else {
        preservedHumanEdits++;
      }
      continue;
    }
    // text / date-password / select
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      if (el.value === (fp.value ?? "")) {
        reactSetValue(el, el instanceof HTMLSelectElement ? "" : "");
        cleared++;
      } else {
        preservedHumanEdits++;
      }
    } else {
      missing++;
    }
  }

  clearAllMarkers(root);
  return { cleared, preservedHumanEdits, missing };
}
