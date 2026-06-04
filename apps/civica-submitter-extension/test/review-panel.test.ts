/**
 * Tests for the pre-submit trust panel pure-compute module (V1-6a, #316).
 *
 * Covers the four acceptance criteria from the issue body:
 *   1. The panel lists every field the extension filled with source vs on-page value.
 *   2. Any divergence (page value != packet value) is visually flagged ⇒ status='human-edited'.
 *   3. The panel does NOT click Submit — verified by the module's pure-read shape
 *      (no DOM mutations are exposed; tests assert no side effects after build).
 *   4. A seeded divergence is flagged in the panel (the canonical test).
 *
 * Plus: the "not-on-page" case (the realistic Review & Submit summary screen,
 * where the form-page elements aren't in the DOM at all).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { fingerprintOf, type FillFingerprint } from "../src/fill-markers";
import type { PageFillState } from "../src/config";
import {
  buildReviewPanel,
  divergedRows,
  type ReviewRow,
} from "../src/review-panel";

// ---------------------------------------------------------------------------
// Test helpers — keep the per-test DOM minimal so a failed assertion points at
// the actual logic, not at over-elaborate test infra.
// ---------------------------------------------------------------------------

function makeState(pageCode: string, fingerprints: FillFingerprint[], filledAt = 1_700_000_000_000): PageFillState {
  return { packetId: "pkt1", pageCode, filledAt, fingerprints };
}

function findById(id: string): Element {
  const el = document.getElementById(id);
  if (!el) throw new Error(`test fixture missing element #${id}`);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// AC #1 — every fingerprint becomes a row with label + civicaWrote + status
// ---------------------------------------------------------------------------

describe("buildReviewPanel — every fingerprint becomes a row", () => {
  it("rows.length === total fingerprints across all states", () => {
    document.body.innerHTML = `
      <input id="fname" type="text" value="Ada" />
      <input id="lname" type="text" value="Lovelace" />
    `;
    const fnameFp = fingerprintOf(findById("fname"), "text", "First Name");
    const lnameFp = fingerprintOf(findById("lname"), "text", "Last Name");
    const panel = buildReviewPanel(
      [makeState("ABNMI", [fnameFp, lnameFp])],
      document,
    );
    expect(panel.rows).toHaveLength(2);
    expect(panel.rows.map((r) => r.fieldLabel)).toEqual(["First Name", "Last Name"]);
    expect(panel.summary.totalFilled).toBe(2);
  });

  it("falls back to fingerprint key when label is absent (back-compat for pre-#316 drafts)", () => {
    document.body.innerHTML = `<input id="legacy" type="text" value="x" />`;
    // Older fingerprint shape: no label.
    const legacyFp = fingerprintOf(findById("legacy"), "text"); // no label arg
    const panel = buildReviewPanel(
      [makeState("ABNMI", [legacyFp])],
      document,
    );
    // The fingerprint stored the element id as its key ("#legacy").
    expect(panel.rows[0]?.fieldLabel).toBe("#legacy");
  });
});

// ---------------------------------------------------------------------------
// AC #2 + #4 — divergence flagged as 'human-edited'
// ---------------------------------------------------------------------------

describe("buildReviewPanel — divergence detection", () => {
  it("text field: match when current value == civica's write", () => {
    document.body.innerHTML = `<input id="email" type="text" value="ada@example.com" />`;
    const fp = fingerprintOf(findById("email"), "text", "Email");
    const panel = buildReviewPanel([makeState("ABCNT", [fp])], document);
    expect(panel.rows[0]?.status).toBe("match");
    expect(panel.summary.matches).toBe(1);
    expect(panel.summary.humanEdited).toBe(0);
  });

  it("text field: human-edited when current value != civica's write (the canonical AC #4 test)", () => {
    // Civica wrote ada@example.com, then the assister edited the field.
    document.body.innerHTML = `<input id="email" type="text" value="ada@example.com" />`;
    const fp = fingerprintOf(findById("email"), "text", "Email");
    // Simulate the human editing the input AFTER Civica filled it.
    (findById("email") as HTMLInputElement).value = "lovelace@example.com";
    const panel = buildReviewPanel([makeState("ABCNT", [fp])], document);
    expect(panel.rows[0]?.status).toBe("human-edited");
    expect(panel.rows[0]?.civicaWrote).toBe("ada@example.com");
    expect(panel.rows[0]?.currentlyOnPage).toBe("lovelace@example.com");
    expect(panel.summary.humanEdited).toBe(1);
    // divergedRows() surfaces exactly the flagged row.
    expect(divergedRows(panel)).toHaveLength(1);
    expect(divergedRows(panel)[0]?.fieldLabel).toBe("Email");
  });

  it("checkbox: human-unchecked is flagged", () => {
    document.body.innerHTML = `<input id="snap" type="checkbox" checked />`;
    const cb = findById("snap") as HTMLInputElement;
    const fp = fingerprintOf(cb, "checkbox", "Applying for SNAP");
    // Human unchecks after Civica filled.
    cb.checked = false;
    const panel = buildReviewPanel([makeState("ABPRI", [fp])], document);
    expect(panel.rows[0]?.status).toBe("human-edited");
    expect(panel.rows[0]?.civicaWrote).toBe("checked");
    expect(panel.rows[0]?.currentlyOnPage).toBe("unchecked");
  });

  it("radio: human-picked-different-option is flagged via still-checked=false", () => {
    document.body.innerHTML = `
      <input id="opt-yes" name="hasSSN" type="radio" checked />
      <input id="opt-no"  name="hasSSN" type="radio" />
    `;
    const fp = fingerprintOf(findById("opt-yes") as HTMLInputElement, "radio", "Has SSN: Yes");
    // Assister picks "No" — browser unchecks the Yes radio on Yes/No group exclusion.
    (findById("opt-yes") as HTMLInputElement).checked = false;
    (findById("opt-no") as HTMLInputElement).checked = true;
    const panel = buildReviewPanel([makeState("ABSSN", [fp])], document);
    expect(panel.rows[0]?.status).toBe("human-edited");
  });

  it("select: human-changed-option is flagged", () => {
    document.body.innerHTML = `
      <select id="county">
        <option value="34">Sacramento</option>
        <option value="19">Los Angeles</option>
      </select>
    `;
    const sel = findById("county") as HTMLSelectElement;
    sel.value = "34";
    const fp = fingerprintOf(sel, "select", "County");
    sel.value = "19";
    const panel = buildReviewPanel([makeState("ABNHA", [fp])], document);
    expect(panel.rows[0]?.status).toBe("human-edited");
    expect(panel.rows[0]?.civicaWrote).toBe("34");
    expect(panel.rows[0]?.currentlyOnPage).toBe("19");
  });
});

// ---------------------------------------------------------------------------
// The Review & Submit summary screen case — form fields not in DOM
// ---------------------------------------------------------------------------

describe("buildReviewPanel — not-on-page (summary screen)", () => {
  it("rows render 'not-on-page' when the original element isn't in the document", () => {
    // First create the element + fingerprint it (mimics fill at the form page).
    document.body.innerHTML = `<input id="phone" type="text" value="5551234567" />`;
    const fp = fingerprintOf(findById("phone"), "text", "Phone");
    // Then simulate navigation to the Review & Submit page (different DOM).
    document.body.innerHTML = `<div class="review-summary">Civica · review your application</div>`;
    const panel = buildReviewPanel([makeState("ABCNT", [fp])], document);
    expect(panel.rows[0]?.status).toBe("not-on-page");
    expect(panel.rows[0]?.currentlyOnPage).toBeNull();
    // civicaWrote is still populated — that's the "what we filled" half of the diff.
    expect(panel.rows[0]?.civicaWrote).toBe("5551234567");
    expect(panel.summary.notOnPage).toBe(1);
  });

  it("the panel survives a malformed key (defensive parse)", () => {
    document.body.innerHTML = "";
    // Fingerprint stamped with a key that wouldn't be a valid CSS selector.
    const fp: FillFingerprint = {
      key: "#9bad-id-starts-with-digit",
      type: "text",
      value: "x",
      label: "Bad key",
    };
    const panel = buildReviewPanel([makeState("ABNMI", [fp])], document);
    // Doesn't throw; row lands as not-on-page.
    expect(panel.rows[0]?.status).toBe("not-on-page");
  });
});

// ---------------------------------------------------------------------------
// AC #3 — module exposes no submit / DOM-mutating surface
// ---------------------------------------------------------------------------

describe("buildReviewPanel — pure-read posture", () => {
  it("does not mutate the document on build (no submit, no field rewrites)", () => {
    document.body.innerHTML = `<input id="x" type="text" value="hello" />`;
    const fp = fingerprintOf(findById("x"), "text", "X");
    const before = (findById("x") as HTMLInputElement).value;
    buildReviewPanel([makeState("PG", [fp])], document);
    const after = (findById("x") as HTMLInputElement).value;
    expect(after).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Mixed state — sort order + summary tally
// ---------------------------------------------------------------------------

describe("buildReviewPanel — multi-page aggregate", () => {
  it("preserves caller-supplied state order (most-recent first) + tallies summary correctly", () => {
    document.body.innerHTML = `
      <input id="fname" type="text" value="Ada" />
      <input id="email" type="text" value="ada@example.com" />
    `;
    const fnameFp = fingerprintOf(findById("fname"), "text", "First Name");
    const emailFp = fingerprintOf(findById("email"), "text", "Email");
    // Human edits the email AFTER both fills.
    (findById("email") as HTMLInputElement).value = "edited@example.com";

    const states: PageFillState[] = [
      makeState("ABCNT", [emailFp], 1_700_000_002_000), // most recent
      makeState("ABNMI", [fnameFp], 1_700_000_001_000),
    ];
    const panel = buildReviewPanel(states, document);

    // Caller's order preserved — Email row first.
    expect(panel.rows.map((r: ReviewRow) => r.fieldLabel)).toEqual([
      "Email",
      "First Name",
    ]);
    expect(panel.summary.totalFilled).toBe(2);
    expect(panel.summary.matches).toBe(1);
    expect(panel.summary.humanEdited).toBe(1);
    expect(panel.summary.notOnPage).toBe(0);
    expect(panel.summary.lastFilledAt).toBe(1_700_000_002_000);
  });
});
