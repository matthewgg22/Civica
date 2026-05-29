/**
 * UI-polish tests for the content script (V1-6, #315).
 *
 * Covers the four additive surfaces layered on top of the existing fill core:
 *   1. Per-field fill markers — non-destructive attr + badge, distinct
 *      filled/review styling, cleaned on re-fill.
 *   2. The five explicit overlay states (loading/empty/error/partial/success),
 *      each forced and asserted to render distinctly.
 *   3. Cross-step continuity: Clear blanks ONLY Civica-written fields and
 *      leaves human-edited fields alone; persistence round-trips per page.
 *   4. The hydration/readiness gate: filling waits for a late-appearing field,
 *      and times out into the error state.
 *
 * jsdom env + the in-memory chrome.storage stub (test/setup.ts). Markers and
 * the readiness gate are pure DOM; the overlay touches only `document`.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  fillPage,
  runPageFill,
  clearPage,
  describeFill,
  renderOverlay,
  type OverlayState,
} from "../src/content";
import {
  markElement,
  clearAllMarkers,
  clearCivicaFills,
  fingerprintOf,
  FILL_ATTR,
  type FillFingerprint,
} from "../src/fill-markers";
import { waitFor } from "../src/readiness";
import { readPageFillState } from "../src/config";
import type { FieldSelector, PortalPage } from "@civica/benefitscal-cbo/core";

function page(fields: Record<string, FieldSelector>, pageCode = "TEST"): PortalPage {
  return { pageCode, title: "synthetic", urlPattern: /\/never-matches/, step: 1, fields };
}

const OVERLAY_ID = "civica-submitter-overlay";
const BADGE_CLASS = "civica-fill-badge";

beforeEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// 1. Per-field fill markers
// ---------------------------------------------------------------------------

describe("fill markers — non-destructive tagging", () => {
  it("a filled field gets data-civica-fill='filled' + a 'filled by Civica' badge", () => {
    document.body.innerHTML = `<label for="fn">First Name</label><input id="fn" />`;
    const fields = { fn: { label: "First Name", type: "text", source: "first_name" } as FieldSelector };
    runMark(page(fields), { first_name: "Maria" });

    const input = document.querySelector<HTMLInputElement>("#fn")!;
    expect(input.getAttribute(FILL_ATTR)).toBe("filled");
    // Value untouched by the marker itself (it was set by the fill).
    expect(input.value).toBe("Maria");
    const badge = document.querySelector(`.${BADGE_CLASS}[data-kind="filled"]`);
    expect(badge?.textContent).toContain("filled by Civica");
  });

  it("a located-but-unfilled field (unmapped option) gets the 'review' marker", () => {
    // citizenship value 'refugee' is unmapped → fillOptionGroup returns
    // needs-review while having located the No radio? No — it clicks nothing and
    // resolves no element. Use a transform-null select instead, which resolves
    // the element then declines to write it.
    document.body.innerHTML = `
      <label for="cty">County</label>
      <select id="cty"><option value="">--</option><option value="34">Sacramento</option></select>
    `;
    const fields = {
      county: {
        label: "County",
        type: "select",
        source: "address.county",
        transform: "ca-county-ordinal",
      } as FieldSelector,
    };
    // 'Cook' has no CA ordinal → transform null → needs-review, element resolved.
    runMark(page(fields), { address: { county: "Cook" } });
    const sel = document.querySelector<HTMLSelectElement>("#cty")!;
    expect(sel.getAttribute(FILL_ATTR)).toBe("review");
    expect(sel.value).toBe(""); // not written
  });

  it("markElement never changes value/checked/events of the element", () => {
    document.body.innerHTML = `<input id="x" value="keepme" />`;
    const el = document.querySelector<HTMLInputElement>("#x")!;
    let fired = 0;
    el.addEventListener("input", () => fired++);
    el.addEventListener("change", () => fired++);
    markElement(el, "filled", "X");
    expect(el.value).toBe("keepme");
    expect(fired).toBe(0); // marking dispatches no events
    expect(el.getAttribute(FILL_ATTR)).toBe("filled");
  });

  it("clearAllMarkers strips every attr + removes every badge", () => {
    document.body.innerHTML = `<input id="a" /><input id="b" />`;
    markElement(document.querySelector("#a")!, "filled", "A");
    markElement(document.querySelector("#b")!, "review", "B");
    expect(document.querySelectorAll(`[${FILL_ATTR}]`).length).toBe(2);
    expect(document.querySelectorAll(`.${BADGE_CLASS}`).length).toBe(2);
    clearAllMarkers();
    expect(document.querySelectorAll(`[${FILL_ATTR}]`).length).toBe(0);
    expect(document.querySelectorAll(`.${BADGE_CLASS}`).length).toBe(0);
  });

  it("re-fill clears stale markers first (no duplicate/leftover markers)", async () => {
    document.body.innerHTML = `<label for="fn">First Name</label><input id="fn" />`;
    const p = page({ fn: { label: "First Name", type: "text", source: "first_name" } as FieldSelector });
    await runPageFill(p, { first_name: "Maria" }, "pkt-1");
    expect(document.querySelectorAll(`.${BADGE_CLASS}`).length).toBe(1);
    // Second fill (e.g. a soft re-render or the Re-fill button) must not stack.
    await runPageFill(p, { first_name: "Maria" }, "pkt-1");
    expect(document.querySelectorAll(`.${BADGE_CLASS}`).length).toBe(1);
    expect(document.querySelectorAll(`[${FILL_ATTR}]`).length).toBe(1);
  });
});

// Helper: fill a page with the same marking callback runPageFill uses, but
// synchronously (no persistence) so marker assertions don't need async.
function runMark(p: PortalPage, payload: unknown): void {
  clearAllMarkers();
  fillPage(p, payload, document, (ev) => {
    if (!ev.element) return;
    if (ev.outcome === "filled") markElement(ev.element, "filled", ev.field.label);
    else if (ev.outcome === "needs-review" || ev.outcome === "not-found")
      markElement(ev.element, "review", ev.field.label);
  });
}

// ---------------------------------------------------------------------------
// 2. Five overlay states — force each, assert distinct render
// ---------------------------------------------------------------------------

describe("overlay — five explicit states render distinctly", () => {
  function stateAttr(): string | null {
    return document.getElementById(OVERLAY_ID)?.getAttribute("data-civica-state") ?? null;
  }
  function shadowText(): string {
    const host = document.getElementById(OVERLAY_ID);
    return host?.shadowRoot?.textContent ?? "";
  }

  const cases: Array<[OverlayState["status"], OverlayState]> = [
    ["loading", { status: "loading", title: "Civica Submitter", message: "Loading…" }],
    ["empty", { status: "empty", title: "No packet selected", message: "Pick a packet in Civica." }],
    ["error", { status: "error", title: "Could not load", message: "Reload and try again." }],
    ["partial", { status: "partial", title: "Review needed", message: "Filled 2 of 4 fields." }],
    ["success", { status: "success", title: "All filled", message: "Review, then click Next." }],
  ];

  for (const [status, state] of cases) {
    it(`renders the ${status} state with its own pill + copy`, () => {
      renderOverlay(state);
      expect(stateAttr()).toBe(status);
      expect(shadowText()).toContain(state.title);
      expect(shadowText()).toContain(state.message);
    });
  }

  it("only the loading state renders a spinner", () => {
    renderOverlay({ status: "loading", title: "L", message: "m" });
    expect(document.getElementById(OVERLAY_ID)?.shadowRoot?.querySelector(".spinner")).toBeTruthy();
    renderOverlay({ status: "success", title: "S", message: "m" });
    expect(document.getElementById(OVERLAY_ID)?.shadowRoot?.querySelector(".spinner")).toBeFalsy();
  });

  it("renders action buttons (type=button) when actions are present", () => {
    let clicked = false;
    renderOverlay({
      status: "partial",
      title: "T",
      message: "m",
      actions: [{ id: "refill", label: "Re-fill this page", onClick: () => { clicked = true; } }],
    });
    const btn = document
      .getElementById(OVERLAY_ID)
      ?.shadowRoot?.querySelector<HTMLButtonElement>('button[data-action="refill"]');
    expect(btn?.type).toBe("button"); // never a submit
    btn?.click();
    expect(clicked).toBe(true);
  });

  it("describeFill: all fillable filled + nothing pending → success", () => {
    const p = page({ fn: { label: "First Name", type: "text", source: "first_name" } as FieldSelector });
    const r = { fillable: 1, filled: 1, skippedNoValue: 0, notFound: 0, needsReview: 0, total: 1 };
    expect(describeFill(r, p, {}, "pkt", document).status).toBe("success");
  });

  it("describeFill: some filled, some need review → partial", () => {
    const p = page({});
    const r = { fillable: 4, filled: 2, skippedNoValue: 0, notFound: 0, needsReview: 2, total: 5 };
    const s = describeFill(r, p, {}, "pkt", document);
    expect(s.status).toBe("partial");
    expect(s.message).toContain("Filled 2 of 4");
  });

  it("describeFill: every fillable field not-found → error (structure changed)", () => {
    const p = page({});
    const r = { fillable: 3, filled: 0, skippedNoValue: 0, notFound: 3, needsReview: 0, total: 3 };
    expect(describeFill(r, p, {}, "pkt", document).status).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// 3. Cross-step continuity — Clear preserves human edits; persistence
// ---------------------------------------------------------------------------

describe("clearCivicaFills — blanks only Civica-written fields", () => {
  it("blanks a field still equal to what Civica wrote, leaves a human-edited one", () => {
    document.body.innerHTML = `<input id="a" /><input id="b" />`;
    const a = document.querySelector<HTMLInputElement>("#a")!;
    const b = document.querySelector<HTMLInputElement>("#b")!;
    // Civica wrote both.
    a.value = "Maria";
    b.value = "Smith";
    const fps: FillFingerprint[] = [
      fingerprintOf(a, "text"),
      fingerprintOf(b, "text"),
    ];
    // Human then edits b.
    b.value = "Smith-Jones";

    const res = clearCivicaFills(fps);
    expect(a.value).toBe(""); // still Civica's → cleared
    expect(b.value).toBe("Smith-Jones"); // human-edited → preserved
    expect(res.cleared).toBe(1);
    expect(res.preservedHumanEdits).toBe(1);
  });

  it("unchecks a checkbox still checked by Civica; leaves a human-unchecked one", () => {
    document.body.innerHTML = `
      <input type="checkbox" id="c1" />
      <input type="checkbox" id="c2" />
    `;
    const c1 = document.querySelector<HTMLInputElement>("#c1")!;
    const c2 = document.querySelector<HTMLInputElement>("#c2")!;
    c1.checked = true;
    c2.checked = true;
    const fps = [fingerprintOf(c1, "checkbox"), fingerprintOf(c2, "checkbox")];
    // Human unchecks c2.
    c2.checked = false;

    clearCivicaFills(fps);
    expect(c1.checked).toBe(false); // Civica's → reverted
    expect(c2.checked).toBe(false); // human already off → left
  });

  it("unchecks a radio still checked by Civica; leaves it if human moved the group", () => {
    document.body.innerHTML = `
      <input type="radio" name="g" id="y" />
      <input type="radio" name="g" id="n" />
    `;
    const y = document.querySelector<HTMLInputElement>("#y")!;
    const n = document.querySelector<HTMLInputElement>("#n")!;
    y.checked = true; // Civica picked Yes
    const fp = [fingerprintOf(y, "radio")];
    // Human picks No → y becomes unchecked.
    n.checked = true;
    y.checked = false;

    const res = clearCivicaFills(fp);
    expect(res.preservedHumanEdits).toBe(1); // y no longer checked → left alone
    expect(n.checked).toBe(true); // human's choice untouched
  });

  it("clearCivicaFills also removes the markers", () => {
    document.body.innerHTML = `<input id="a" />`;
    const a = document.querySelector<HTMLInputElement>("#a")!;
    a.value = "x";
    markElement(a, "filled", "A");
    clearCivicaFills([fingerprintOf(a, "text")]);
    expect(document.querySelector(`[${FILL_ATTR}]`)).toBeNull();
    expect(document.querySelector(`.${BADGE_CLASS}`)).toBeNull();
  });
});

describe("continuity — runPageFill persists state; clearPage reverts via storage", () => {
  it("runPageFill persists fingerprints; clearPage reads them and blanks the field", async () => {
    document.body.innerHTML = `<label for="fn">First Name</label><input id="fn" />`;
    const p = page(
      { fn: { label: "First Name", type: "text", source: "first_name" } as FieldSelector },
      "ABNMI",
    );
    await runPageFill(p, { first_name: "Maria" }, "pkt-9");

    const persisted = await readPageFillState("pkt-9", "ABNMI");
    expect(persisted?.fingerprints.length).toBe(1);
    expect(document.querySelector<HTMLInputElement>("#fn")?.value).toBe("Maria");

    // Now clear via the persisted state (simulates a fresh page load + Clear).
    await clearPage("pkt-9", "ABNMI", document);
    expect(document.querySelector<HTMLInputElement>("#fn")?.value).toBe("");
    // State dropped + cleared overlay shown.
    expect(await readPageFillState("pkt-9", "ABNMI")).toBeNull();
    expect(document.getElementById(OVERLAY_ID)?.getAttribute("data-civica-state")).toBe("empty");
  });
});

// ---------------------------------------------------------------------------
// 4. Hydration / readiness gate
// ---------------------------------------------------------------------------

describe("readiness gate — waitFor", () => {
  it("resolves true immediately when the predicate is already satisfied", async () => {
    document.body.innerHTML = `<input id="ready" />`;
    const ok = await waitFor((r) => r.querySelector("#ready") !== null, { timeoutMs: 500 });
    expect(ok).toBe(true);
  });

  it("resolves true once a late-appearing element is inserted", async () => {
    document.body.innerHTML = `<div id="host"></div>`;
    // Insert the target ~30ms later, after waitFor is already observing.
    setTimeout(() => {
      const input = document.createElement("input");
      input.id = "late";
      document.getElementById("host")!.appendChild(input);
    }, 30);
    const ok = await waitFor((r) => r.querySelector("#late") !== null, {
      timeoutMs: 1000,
      pollMs: 10,
    });
    expect(ok).toBe(true);
    expect(document.querySelector("#late")).toBeTruthy();
  });

  it("resolves false on timeout when the element never appears", async () => {
    document.body.innerHTML = `<div></div>`;
    const ok = await waitFor((r) => r.querySelector("#never") !== null, {
      timeoutMs: 60,
      pollMs: 10,
    });
    expect(ok).toBe(false);
  });
});

describe("runPageFill — readiness gate integration", () => {
  it("waits for a late field then fills it", async () => {
    document.body.innerHTML = `<div id="host"></div>`;
    const p = page({ fn: { label: "First Name", type: "text", source: "first_name", fallbackSelector: "#late" } as FieldSelector });
    // The field shows up 40ms after runPageFill starts waiting.
    setTimeout(() => {
      const wrap = document.createElement("div");
      wrap.innerHTML = `<label for="late">First Name</label><input id="late" />`;
      document.getElementById("host")!.appendChild(wrap);
    }, 40);

    await runPageFill(p, { first_name: "Maria" }, "pkt-late");
    expect(document.querySelector<HTMLInputElement>("#late")?.value).toBe("Maria");
    expect(document.getElementById(OVERLAY_ID)?.getAttribute("data-civica-state")).toBe("success");
  });

  it("times out into the error state when the field never hydrates", async () => {
    document.body.innerHTML = `<div></div>`;
    const p = page({ fn: { label: "Nope", type: "text", source: "first_name", fallbackSelector: "#never" } as FieldSelector });
    // Field is never inserted → the readiness gate times out. We inject a short
    // timeout (the production default is 5s) so the gate fails fast and we can
    // assert the error state without a multi-second wait.
    await runPageFill(p, { first_name: "Maria" }, "pkt-timeout", document, {
      readinessTimeoutMs: 80,
    });
    const host = document.getElementById(OVERLAY_ID);
    expect(host?.getAttribute("data-civica-state")).toBe("error");
    // The error state offers a Re-fill control.
    expect(
      host?.shadowRoot?.querySelector('button[data-action="refill"]'),
    ).toBeTruthy();
  });
});
