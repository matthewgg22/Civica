/**
 * Label-first DOM element resolver (V1-5, #314).
 *
 * The typed selector map (`selector-map.ts`) is *label-first*: every
 * `FieldSelector` carries the visible `<label>` text / accessible name as its
 * primary locator, with a stable CSS `fallbackSelector` only when the portal
 * happens to expose one (many BenefitsCal controls have positional ids like
 * `#text1` or random `lift-ux-id-<uuid>` ids that can't be selected reliably).
 *
 * This module is the runtime counterpart to Playwright's `getByLabel(...)`: it
 * walks the DOM to find the control a `FieldSelector` points at, trying the
 * label-based strategies first and only falling back to the CSS selector.
 *
 * Resolution order (first match wins):
 *   (a) a `<label>` whose trimmed text === `field.label`, resolved to its
 *       `for=` target or, failing that, a form control nested inside it;
 *   (b) an element whose `aria-label` === `field.label`;
 *   (c) an element whose `aria-labelledby` references node(s) whose combined
 *       trimmed text === `field.label`;
 *   (d) `field.fallbackSelector` (CSS), if present.
 * Returns null when nothing matches.
 *
 * Pure DOM. Browser-safe per the `/core` contract: NO playwright, NO imports
 * from `../driver`, NO I/O. Importable from the browser extension.
 */

import type { FieldSelector } from "./selector-map";

const CONTROL_SELECTOR = "input, select, textarea, button";

/** Trimmed text content of a node, collapsing internal whitespace runs. */
function normalizedText(node: Element | null): string {
  if (!node) return "";
  return (node.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** First form control descendant of `el` (used for wrapping `<label>`s). */
function nestedControl(el: Element): Element | null {
  return el.querySelector(CONTROL_SELECTOR);
}

/**
 * Strategy (a): a `<label>` whose visible text matches `label`. Prefers the
 * label's `for=` target; falls back to a control nested inside the label
 * (the "wrapping label" pattern, `<label>First<input/></label>`).
 */
function byLabelElement(label: string, root: ParentNode): Element | null {
  const labels = Array.from(root.querySelectorAll("label"));
  for (const labelEl of labels) {
    if (normalizedText(labelEl) !== label) continue;
    const forId = labelEl.getAttribute("for");
    if (forId) {
      // `<label for=id>` — resolve the target. Prefer a match inside `root`
      // (covers a detached test fragment); only widen to the owner document
      // when the target lives outside the search root (covers `root` being an
      // ancestor of the control while the label/control sit as siblings).
      const sel = `#${cssEscape(forId)}`;
      const target =
        root.querySelector(sel) ??
        (root instanceof Document || root instanceof DocumentFragment
          ? null
          : (root.ownerDocument?.querySelector(sel) ?? null));
      if (target) return target;
    }
    const nested = nestedControl(labelEl);
    if (nested) return nested;
  }
  return null;
}

/** Strategy (b): exact `aria-label` match on any control. */
function byAriaLabel(label: string, root: ParentNode): Element | null {
  // Attribute-selector match is exact; escape embedded quotes defensively.
  const escaped = label.replace(/"/g, '\\"');
  return root.querySelector(`[aria-label="${escaped}"]`);
}

/**
 * Strategy (c): `aria-labelledby` whose referenced node(s) combine to `label`.
 * Per ARIA, `aria-labelledby` may list multiple ids whose texts are joined
 * with a single space.
 */
function byAriaLabelledBy(label: string, root: ParentNode): Element | null {
  const ownerDoc =
    root instanceof Document || root instanceof DocumentFragment
      ? null
      : (root.ownerDocument ?? null);
  const refText = (id: string): string => {
    const sel = `#${cssEscape(id)}`;
    // Prefer a reference inside `root`; widen to the owner document only if the
    // referenced node lives outside the search root.
    const node = root.querySelector(sel) ?? ownerDoc?.querySelector(sel) ?? null;
    return normalizedText(node);
  };
  const candidates = Array.from(root.querySelectorAll("[aria-labelledby]"));
  for (const el of candidates) {
    const ids = (el.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean);
    if (ids.length === 0) continue;
    const text = ids.map(refText).filter(Boolean).join(" ");
    if (text === label) return el;
  }
  return null;
}

/**
 * CSS.escape shim — jsdom and all extension target browsers ship `CSS.escape`,
 * but guard for environments that don't so an id with no special chars still
 * works.
 */
function cssEscape(id: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(id);
  }
  return id.replace(/([^\w-])/g, "\\$1");
}

/**
 * Resolve the DOM element a {@link FieldSelector} points at, trying label-based
 * strategies before the CSS `fallbackSelector`. See module header for the full
 * resolution order. Returns null when no strategy matches.
 *
 * @param field the selector-map field to locate
 * @param root  the scope to search (defaults to `document`); pass a detached
 *              node in tests
 */
export function resolveField(
  field: FieldSelector,
  root: ParentNode = document,
): Element | null {
  return (
    byLabelElement(field.label, root) ??
    byAriaLabel(field.label, root) ??
    byAriaLabelledBy(field.label, root) ??
    (field.fallbackSelector ? root.querySelector(field.fallbackSelector) : null)
  );
}
