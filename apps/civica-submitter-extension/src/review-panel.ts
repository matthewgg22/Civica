// Pre-submit source-vs-filled trust panel (V1-6a, #316).
//
// The whole compliance posture rests on "a human reviews before submitting."
// This module turns that aspiration into a concrete pre-submit surface: given
// the persisted FillFingerprints (what Civica wrote on each prior page), it
// returns a tabular review of each filled field — what Civica wrote vs what
// the page currently shows — so the assister can spot any wrong value before
// clicking the portal's Submit button.
//
// HARD GUARANTEE — this module never submits and never mutates the portal DOM.
// Pure read; returns plain JS data. The render layer (content.ts) is responsible
// for painting the rows into the existing overlay shell. The assister still
// clicks the portal's own Submit control.
//
// SCOPE NOTE — the BenefitsCal "Review and Submit" page itself (portal step 9)
// hasn't been walked yet (no PORTAL_PAGES entry; V1-4 follow-up). Until that
// walk lands, rows for fields whose elements aren't present in the current
// document render as `not-on-page` — accurate for the summary-screen case,
// where the form-page elements simply aren't in the DOM. On a sub-page
// (income, expenses, etc.) the rows that ARE on the current page render as
// `match` or `human-edited`, which is the per-page review surface the
// assister can use mid-walk before advancing.

import type { FillFingerprint, ClearResult as _ClearResult } from "./fill-markers";
import type { PageFillState } from "./config";

export type ReviewRowStatus =
  | "match"           // page element still holds what Civica wrote
  | "human-edited"    // page element holds something different now
  | "not-on-page";    // element absent (we're on a summary screen, or it was removed)

export interface ReviewRow {
  /** Portal pageCode the fill happened on (e.g. "ABLPR", "ABNHA"). */
  pageCode: string;
  /** ms-since-epoch when the fill happened. Lets the panel show "filled 5m ago". */
  filledAt: number;
  /** Human-readable field label captured at fill time. Falls back to fingerprint key. */
  fieldLabel: string;
  /** Field type (text / radio / etc.) — drives how the value is formatted. */
  type: FillFingerprint["type"];
  /** What Civica wrote, formatted for display. e.g. "checked", "Sacramento", "01/05/1990". */
  civicaWrote: string;
  /**
   * What's currently in the DOM, formatted the same way as civicaWrote.
   * Null when the element isn't on the current page (the common case when
   * the assister is on a summary / review-and-submit screen).
   */
  currentlyOnPage: string | null;
  /** Diff verdict — drives row color in the rendered panel. */
  status: ReviewRowStatus;
}

export interface ReviewPanelSummary {
  totalFilled: number;
  matches: number;
  humanEdited: number;
  notOnPage: number;
  /** Most-recent filledAt across all states, for "Filled X ago" line. */
  lastFilledAt: number | null;
}

export interface ReviewPanel {
  rows: ReviewRow[];
  summary: ReviewPanelSummary;
}

/**
 * Format a single fingerprint's "what Civica wrote" for display. Mirrors
 * the format we use for the live value so the row reads as a clean diff.
 */
function formatFingerprintValue(fp: FillFingerprint): string {
  if (fp.type === "radio" || fp.type === "checkbox") {
    return fp.checked ? "checked" : "unchecked";
  }
  // text / date-password / select
  return (fp.value ?? "").trim() === "" ? "(empty)" : (fp.value ?? "");
}

/**
 * Format the element's CURRENT value the same way. Returns null when the
 * element doesn't exist on the current page (so callers can distinguish
 * absent-from-DOM from present-and-empty).
 */
function formatCurrentValue(el: Element | null, type: FillFingerprint["type"]): string | null {
  if (!el) return null;
  if (type === "radio" || type === "checkbox") {
    if (!(el instanceof HTMLInputElement)) return null;
    return el.checked ? "checked" : "unchecked";
  }
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    return el.value.trim() === "" ? "(empty)" : el.value;
  }
  return null;
}

/**
 * Re-locate an element by the synthetic key we stamped at fill time. Mirrors
 * `findByKey` in fill-markers.ts — duplicated here (rather than exported)
 * because the trust panel is a separate concern from the clear flow; coupling
 * them would force a refactor of fill-markers' internal helpers.
 */
function findByKey(key: string, root: ParentNode): Element | null {
  if (key.startsWith("#")) {
    try {
      return root.querySelector(key);
    } catch {
      // Malformed id (e.g. starts with a digit) — fall through to null.
      return null;
    }
  }
  // Synthetic data-civica-key. Escape any non-safe chars.
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
  try {
    return root.querySelector(`[data-civica-key="${safe}"]`);
  } catch {
    return null;
  }
}

/**
 * Per-row diff verdict.
 *
 * Decision matrix:
 *   element absent                                  → not-on-page
 *   element present AND current === civica-wrote   → match
 *   element present AND current !== civica-wrote   → human-edited
 */
function statusFor(
  fp: FillFingerprint,
  current: string | null,
): ReviewRowStatus {
  if (current == null) return "not-on-page";
  // (Empty | empty) collapses — a both-empty radio is a `match` not an edit.
  const civica = formatFingerprintValue(fp);
  return current === civica ? "match" : "human-edited";
}

/**
 * Pure compute: turn the persisted fingerprints into a flat table the panel
 * can render. Most-recently-filled page first (callers can re-sort).
 *
 * - `states` must be passed in (read via `readAllPageFillStatesForPacket`);
 *   keeping this pure makes the module trivially testable on a jsdom root.
 * - `root` defaults to `document`; tests pass a constructed jsdom Document.
 */
export function buildReviewPanel(
  states: PageFillState[],
  root: ParentNode = document,
): ReviewPanel {
  const rows: ReviewRow[] = [];
  let lastFilledAt: number | null = null;

  // States come from caller already sorted by filledAt desc; preserve order
  // so the table reads top-down as "the page you just filled, then prior pages."
  for (const state of states) {
    if (lastFilledAt == null || state.filledAt > lastFilledAt) {
      lastFilledAt = state.filledAt;
    }
    for (const fp of state.fingerprints) {
      const el = findByKey(fp.key, root);
      const current = formatCurrentValue(el, fp.type);
      rows.push({
        pageCode: state.pageCode,
        filledAt: state.filledAt,
        // Fall back to the synthetic key when the fingerprint pre-dates #316
        // (older drafts persisted without a label).
        fieldLabel: fp.label ?? fp.key,
        type: fp.type,
        civicaWrote: formatFingerprintValue(fp),
        currentlyOnPage: current,
        status: statusFor(fp, current),
      });
    }
  }

  const summary: ReviewPanelSummary = {
    totalFilled: rows.length,
    matches: rows.filter((r) => r.status === "match").length,
    humanEdited: rows.filter((r) => r.status === "human-edited").length,
    notOnPage: rows.filter((r) => r.status === "not-on-page").length,
    lastFilledAt,
  };

  return { rows, summary };
}

/**
 * Subset helper for the panel header: just the rows the assister NEEDS to
 * look at — anything Civica wrote that's no longer reflected on the page,
 * because that's where divergence between packet and portal lives.
 */
export function divergedRows(panel: ReviewPanel): ReviewRow[] {
  return panel.rows.filter((r) => r.status === "human-edited");
}
