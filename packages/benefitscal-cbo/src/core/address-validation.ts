/**
 * Address validation modal flow (V1-5 PR2, #314).
 *
 * When the extension lands on the ABNHA home-address page and the portal
 * triggers its 2-modal address-validation flow (USPS couldn't validate the
 * address), the extension MUST surface the modal to the human reviewer and
 * WAIT for their action before resuming.
 *
 * Key design constraint (AC #3): NO auto-accept of suggested addresses. The
 * reviewer manually selects the validated address. This is a compliance
 * posture: incorrect address → incorrect county routing → SNAP case assigned
 * to wrong office. The human is the gate.
 *
 * Mechanism:
 *   1. Extension detects the portal's address-validation modal in the DOM.
 *   2. Extension dispatches `civica:address-validation-required` (CustomEvent)
 *      on `document` with `{ detail: { addressOptions } }`. The trust panel
 *      (V1-6a, already shipped) listens and surfaces the options.
 *   3. Extension suspends the section walk (returns a Promise that resolves on
 *      a `civica:address-validation-resolved` CustomEvent from the reviewer's
 *      UI, or on timeout with a manual-entry fallback).
 *   4. When no valid address options are detected, the extension dispatches
 *      `civica:address-validation-required` with an empty `addressOptions` —
 *      the trust panel surfaces "address requires manual entry".
 *
 * Per-member behavior:
 *   When a household has multiple members with distinct addresses (steps 2-9),
 *   the modal fires SEQUENTIALLY — one per member, in walk order. The extension
 *   waits for resolution before proceeding to the next member's address page.
 *
 * Pure compute. Browser-safe: no playwright, no driver imports.
 * Event names are string constants exported for test stubs.
 */

import { ADDRESS_VALIDATION_FLOW } from "./selector-map";

// ---------------------------------------------------------------------------
// Event name constants (exported for tests to dispatch synthetic events).
// ---------------------------------------------------------------------------

/**
 * Dispatched UP the DOM tree when the portal's address-validation modal is
 * detected. `detail.addressOptions` is an array of suggested address strings
 * scraped from the modal; may be empty if USPS returned no suggestions.
 *
 * Listeners (the trust panel) surface these options to the reviewer for
 * manual selection.
 */
export const ADDRESS_VALIDATION_REQUIRED_EVENT =
  "civica:address-validation-required" as const;

/**
 * Dispatched BY the reviewer's UI (trust panel or any listener) when the
 * reviewer has made a selection (or confirmed manual entry). The extension
 * `awaitAddressResolution()` listens for this event to resume the walk.
 *
 * `detail.selectedAddress` carries the string the reviewer chose, or `null`
 * for a manual-entry decision (extension logs it and moves on — the human
 * will type it into the portal directly).
 */
export const ADDRESS_VALIDATION_RESOLVED_EVENT =
  "civica:address-validation-resolved" as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddressOption {
  /** Human-readable address string as displayed by the portal in the modal. */
  label: string;
  /**
   * Portal-internal value for this option (e.g. an option value or data
   * attribute). May be undefined if only the label was scraped.
   */
  value?: string;
}

export interface AddressValidationRequiredDetail {
  /** Options scraped from the portal's modal. Empty array = manual entry needed. */
  addressOptions: AddressOption[];
  /**
   * The pageCode context (usually "ABNHA" for the primary applicant home-address
   * page; step-2 member pages will carry their own code once T7 walk lands).
   */
  pageCode: string;
  /**
   * Index (0-based) of the household member this modal is for.
   * 0 = primary applicant.
   */
  memberIndex: number;
}

export interface AddressValidationResolvedDetail {
  /**
   * The reviewer-chosen address string. `null` means the reviewer elected
   * manual entry — the extension logs and resumes the walk without auto-filling
   * the modal's confirmation flow.
   */
  selectedAddress: string | null;
}

// ---------------------------------------------------------------------------
// addressOptions scraper
// ---------------------------------------------------------------------------

/**
 * Scrape the address options the portal's modal is currently displaying.
 *
 * The walk (SELECTORS.md) documents two modals:
 *   - Modal #1 "Can't validate": a single "USE THIS ADDRESS" button (accept as-is).
 *   - Modal #2 "What county?": a county `<select>` (filled by the ca-county-ordinal
 *     transform) + a "CONTINUE" button.
 *
 * For the "USE THIS ADDRESS" modal, the only "address option" is the address
 * the applicant entered — we surface it as a single option with the label
 * "Use the address I entered" so the reviewer can confirm or choose manual entry.
 *
 * For the county modal (modal #2), the options are the CA counties; that modal
 * is handled separately via the ADDRESS_VALIDATION_FLOW.countySelect field in
 * content.ts. This function focuses on detecting modal #1.
 *
 * @param root - The root node to search (document by default in the extension;
 *               a synthetic div in tests).
 * @returns Array of address options scraped from the current portal modal. Empty
 *          if no modal is detected.
 */
export function scrapeAddressOptions(root: ParentNode): AddressOption[] {
  const options: AddressOption[] = [];

  // Modal #1: "USE THIS ADDRESS" button present → single "use as entered" option.
  const useThisAddress = root.querySelector<HTMLElement>(
    `button[aria-label="${ADDRESS_VALIDATION_FLOW.useThisAddressButton.label}"],` +
    // Fallback: find a button whose visible text matches the label.
    `button`,
  );
  if (useThisAddress) {
    // Narrow: only count it when the text matches (querySelector above may pick up
    // unrelated buttons via the bare `button` fallback).
    const label = ADDRESS_VALIDATION_FLOW.useThisAddressButton.label;
    // Find the button whose textContent trimmed matches the label.
    const allButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
    const matchingBtn = allButtons.find(
      (btn) => btn.textContent?.trim() === label,
    );
    if (matchingBtn) {
      options.push({
        label: "Use the address I entered",
        value: "use-this-address",
      });
    }
  }

  // Extended: If the portal renders a list of candidate addresses (not observed
  // in the v1 walk, but guard here for forward-compat), scrape them.
  // Pattern: look for a `<ul>` or `<ol>` within a modal container whose items
  // each contain an address-like string. This is advisory only — if no list is
  // found, we return the "use as entered" option (or empty for no modal).
  const listItems = Array.from(
    root.querySelectorAll<HTMLLIElement>("[role=dialog] li, [role=alertdialog] li"),
  );
  for (const li of listItems) {
    const text = li.textContent?.trim();
    if (text && text.length > 0 && !options.some((o) => o.label === text)) {
      options.push({ label: text });
    }
  }

  return options;
}

// ---------------------------------------------------------------------------
// dispatchAddressValidationRequired
// ---------------------------------------------------------------------------

/**
 * Dispatch the `civica:address-validation-required` event on `document` (or a
 * test target), signalling the trust panel to surface the address options to the
 * reviewer. The extension suspends the walk until
 * `civica:address-validation-resolved` arrives.
 *
 * @param detail  - The event detail (addressOptions + context).
 * @param target  - Event target; defaults to `document`. Tests pass a synthetic target.
 */
export function dispatchAddressValidationRequired(
  detail: AddressValidationRequiredDetail,
  target: EventTarget = document,
): void {
  target.dispatchEvent(
    new CustomEvent<AddressValidationRequiredDetail>(
      ADDRESS_VALIDATION_REQUIRED_EVENT,
      { detail, bubbles: true, composed: true },
    ),
  );
}

// ---------------------------------------------------------------------------
// awaitAddressResolution
// ---------------------------------------------------------------------------

/**
 * Returns a Promise that resolves when the reviewer dispatches
 * `civica:address-validation-resolved` (or when `timeoutMs` elapses).
 *
 * On timeout: resolves with `{ selectedAddress: null }` — treated as a manual-
 * entry decision (the reviewer didn't interact; extension logs and resumes).
 *
 * Per-member sequential behavior: callers invoke this once per household member
 * address page in walk order; each call resolves independently.
 *
 * @param target    - Event target to listen on (document by default).
 * @param timeoutMs - Milliseconds to wait before falling back to null.
 *                    Default 300_000 (5 minutes) — reviewers need time.
 */
export function awaitAddressResolution(
  target: EventTarget = document,
  timeoutMs = 300_000,
): Promise<AddressValidationResolvedDetail> {
  return new Promise<AddressValidationResolvedDetail>((resolve) => {
    let settled = false;

    const handler = (e: Event) => {
      if (settled) return;
      settled = true;
      target.removeEventListener(ADDRESS_VALIDATION_RESOLVED_EVENT, handler);
      clearTimeout(timer);
      const detail = (e as CustomEvent<AddressValidationResolvedDetail>).detail;
      resolve(detail ?? { selectedAddress: null });
    };

    target.addEventListener(ADDRESS_VALIDATION_RESOLVED_EVENT, handler);

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      target.removeEventListener(ADDRESS_VALIDATION_RESOLVED_EVENT, handler);
      // Timeout: fall back to manual-entry decision.
      resolve({ selectedAddress: null });
    }, timeoutMs);
  });
}

// ---------------------------------------------------------------------------
// handleAddressValidationModal — composite entry point
// ---------------------------------------------------------------------------

/**
 * Full address-validation modal handling (AC #3, V1-5 PR2):
 *   1. Scrape any address options from the current DOM.
 *   2. Dispatch `civica:address-validation-required` so the trust panel can
 *      surface options to the reviewer.
 *   3. Await `civica:address-validation-resolved` (or timeout → manual-entry).
 *   4. Return the resolution detail for the caller to log / act on.
 *
 * NO auto-accept: the extension NEVER clicks "USE THIS ADDRESS" on its own.
 * The reviewer makes the selection; the extension only notifies + waits.
 *
 * @param pageCode    - The current portal pageCode context.
 * @param memberIndex - 0-based member index (0 = primary applicant).
 * @param root        - DOM root to scrape (document by default; synthetic div in tests).
 * @param target      - Event target for dispatch + listen (document by default).
 * @param timeoutMs   - Resolution wait timeout in ms.
 */
export async function handleAddressValidationModal(
  pageCode: string,
  memberIndex: number,
  root: ParentNode = document,
  target: EventTarget = document,
  timeoutMs = 300_000,
): Promise<AddressValidationResolvedDetail> {
  const addressOptions = scrapeAddressOptions(root);

  dispatchAddressValidationRequired(
    { addressOptions, pageCode, memberIndex },
    target,
  );

  return awaitAddressResolution(target, timeoutMs);
}
