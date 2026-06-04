// @vitest-environment jsdom
/**
 * Unit tests for the address-validation modal flow (V1-5 PR2, #314).
 *
 * AC #3 from issue #314: the address validation modal is surfaced to the human
 * reviewer and NOT auto-accepted. The extension fires the
 * civica:address-validation-required event and waits for the reviewer to dispatch
 * civica:address-validation-resolved before resuming.
 *
 * Test coverage:
 *   1. Modal-appears + human-selects: extension fires the CustomEvent + pauses;
 *      after civica:address-validation-resolved, extension resumes with the selection.
 *   2. Modal-with-no-valid-address: extension surfaces "address requires manual entry"
 *      (empty addressOptions array) via the event.
 *   3. Multiple HH members with distinct addresses: modal fires per-member sequentially.
 *   4. Timeout fallback: if reviewer doesn't respond, resolves with selectedAddress=null.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  scrapeAddressOptions,
  dispatchAddressValidationRequired,
  awaitAddressResolution,
  handleAddressValidationModal,
  ADDRESS_VALIDATION_REQUIRED_EVENT,
  ADDRESS_VALIDATION_RESOLVED_EVENT,
} from "../src/core/address-validation";
import type {
  AddressValidationResolvedDetail,
} from "../src/core/address-validation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoot(html: string): Element {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}

/**
 * A simple EventTarget implementation for test isolation (avoids polluting
 * document with test event listeners).
 */
function makeTarget(): EventTarget {
  return new EventTarget();
}

/** Dispatch the resolved event on a target with a given selection. */
function resolveWith(target: EventTarget, selectedAddress: string | null): void {
  const detail: AddressValidationResolvedDetail = { selectedAddress };
  target.dispatchEvent(
    new CustomEvent(ADDRESS_VALIDATION_RESOLVED_EVENT, {
      detail,
      bubbles: true,
      composed: true,
    }),
  );
}

// ---------------------------------------------------------------------------
// scrapeAddressOptions
// ---------------------------------------------------------------------------

describe("scrapeAddressOptions — DOM scraping", () => {
  it("returns empty array when no modal is in the DOM", () => {
    const root = makeRoot("<div>No modal here</div>");
    expect(scrapeAddressOptions(root)).toEqual([]);
  });

  it("returns a single 'use as entered' option when the USE THIS ADDRESS button is present", () => {
    const root = makeRoot(
      `<div><button>USE THIS ADDRESS</button></div>`,
    );
    const opts = scrapeAddressOptions(root);
    expect(opts.length).toBe(1);
    expect(opts[0]?.label).toBe("Use the address I entered");
    expect(opts[0]?.value).toBe("use-this-address");
  });

  it("includes list items inside a role=dialog as additional address options", () => {
    const root = makeRoot(`
      <div role="dialog">
        <ul>
          <li>123 Main St, Sacramento, CA 95814</li>
          <li>123 Main Street, Sacramento, CA 95814</li>
        </ul>
      </div>
    `);
    const opts = scrapeAddressOptions(root);
    expect(opts.length).toBe(2);
    expect(opts.some((o) => o.label.includes("Main St"))).toBe(true);
    expect(opts.some((o) => o.label.includes("Main Street"))).toBe(true);
  });

  it("does not duplicate a list item that matches a button label", () => {
    const root = makeRoot(`
      <div>
        <button>USE THIS ADDRESS</button>
        <div role="dialog">
          <ul><li>Use the address I entered</li></ul>
        </div>
      </div>
    `);
    const opts = scrapeAddressOptions(root);
    const labels = opts.map((o) => o.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });
});

// ---------------------------------------------------------------------------
// dispatchAddressValidationRequired + awaitAddressResolution
// ---------------------------------------------------------------------------

describe("dispatchAddressValidationRequired — CustomEvent dispatch", () => {
  it("fires civica:address-validation-required on the target", () => {
    const target = makeTarget();
    let received: CustomEvent | null = null;
    target.addEventListener(ADDRESS_VALIDATION_REQUIRED_EVENT, (e) => {
      received = e as CustomEvent;
    });

    dispatchAddressValidationRequired(
      { addressOptions: [], pageCode: "ABNHA", memberIndex: 0 },
      target,
    );

    expect(received).not.toBeNull();
    expect((received as unknown as CustomEvent).type).toBe(ADDRESS_VALIDATION_REQUIRED_EVENT);
  });

  it("includes addressOptions, pageCode, and memberIndex in the event detail", () => {
    const target = makeTarget();
    let detail: Record<string, unknown> | null = null;
    target.addEventListener(ADDRESS_VALIDATION_REQUIRED_EVENT, (e) => {
      detail = (e as CustomEvent).detail as Record<string, unknown>;
    });

    dispatchAddressValidationRequired(
      {
        addressOptions: [{ label: "123 Main St", value: "main" }],
        pageCode: "ABNHA",
        memberIndex: 1,
      },
      target,
    );

    expect(detail).not.toBeNull();
    expect(detail?.["pageCode"]).toBe("ABNHA");
    expect(detail?.["memberIndex"]).toBe(1);
    const addressOptions = detail?.["addressOptions"];
    expect(Array.isArray(addressOptions) && (addressOptions as unknown[]).length).toBe(1);
  });
});

describe("awaitAddressResolution — Promise lifecycle", () => {
  it("resolves with the selectedAddress when civica:address-validation-resolved fires", async () => {
    const target = makeTarget();
    const promise = awaitAddressResolution(target, 5000);

    // Simulate reviewer confirming the address.
    resolveWith(target, "123 Main St, Sacramento, CA 95814");

    const result = await promise;
    expect(result.selectedAddress).toBe("123 Main St, Sacramento, CA 95814");
  });

  it("resolves with selectedAddress=null on timeout (manual-entry fallback)", async () => {
    vi.useFakeTimers();
    const target = makeTarget();
    const promise = awaitAddressResolution(target, 100);

    vi.advanceTimersByTime(200);

    const result = await promise;
    expect(result.selectedAddress).toBeNull();
    vi.useRealTimers();
  });

  it("resolves with selectedAddress=null when reviewer dispatches null selection", async () => {
    const target = makeTarget();
    const promise = awaitAddressResolution(target, 5000);

    resolveWith(target, null);

    const result = await promise;
    expect(result.selectedAddress).toBeNull();
  });

  it("only resolves once (first event wins; subsequent events ignored)", async () => {
    const target = makeTarget();
    const promise = awaitAddressResolution(target, 5000);

    resolveWith(target, "First choice");
    resolveWith(target, "Second choice");

    const result = await promise;
    expect(result.selectedAddress).toBe("First choice");
  });
});

// ---------------------------------------------------------------------------
// Test 1 (AC #3): Modal-appears + human-selects → extension fires + pauses
// ---------------------------------------------------------------------------

describe("handleAddressValidationModal — modal appears + human selects (AC #3)", () => {
  it("fires civica:address-validation-required and resolves after reviewer responds", async () => {
    const root = makeRoot(`<div><button>USE THIS ADDRESS</button></div>`);
    const target = makeTarget();

    let eventFired = false;
    let receivedOptions: unknown[] = [];
    target.addEventListener(ADDRESS_VALIDATION_REQUIRED_EVENT, (e) => {
      eventFired = true;
      receivedOptions = (e as CustomEvent).detail?.addressOptions ?? [];
    });

    // Simulate reviewer responding after a tick.
    const resolveTimer = setTimeout(() => resolveWith(target, "123 Main St, Sacramento"), 10);

    const result = await handleAddressValidationModal("ABNHA", 0, root, target, 5000);

    clearTimeout(resolveTimer);
    expect(eventFired).toBe(true);
    expect(receivedOptions.length).toBe(1); // "Use the address I entered"
    expect(result.selectedAddress).toBe("123 Main St, Sacramento");
  });

  it("does NOT auto-click 'USE THIS ADDRESS' — the event fires and extension waits", async () => {
    const root = makeRoot(`<div><button>USE THIS ADDRESS</button></div>`);
    const target = makeTarget();
    const btn = root.querySelector("button")!;
    const clickSpy = vi.fn();
    btn.addEventListener("click", clickSpy);

    // Resolve immediately so the test doesn't hang.
    setTimeout(() => resolveWith(target, null), 5);

    await handleAddressValidationModal("ABNHA", 0, root, target, 5000);

    // The button should NEVER have been clicked automatically.
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 2 (AC #3): Modal with no valid address → "address requires manual entry"
// ---------------------------------------------------------------------------

describe("handleAddressValidationModal — no valid address options", () => {
  it("fires civica:address-validation-required with empty addressOptions when no modal is in DOM", async () => {
    const root = makeRoot("<div>No modal</div>");
    const target = makeTarget();

    let receivedOptions: unknown[] = [{ placeholder: true } as unknown]; // Non-empty default to detect the change
    target.addEventListener(ADDRESS_VALIDATION_REQUIRED_EVENT, (e) => {
      receivedOptions = ((e as CustomEvent).detail?.addressOptions ?? []) as unknown[];
    });

    setTimeout(() => resolveWith(target, null), 5);

    const result = await handleAddressValidationModal("ABNHA", 0, root, target, 5000);

    // Empty addressOptions → trust panel shows "address requires manual entry"
    expect(receivedOptions).toEqual([]);
    // Reviewer elected manual entry (null).
    expect(result.selectedAddress).toBeNull();
  });

  it("resolves with selectedAddress=null for manual-entry decision", async () => {
    const root = makeRoot("<div></div>");
    const target = makeTarget();

    setTimeout(() => resolveWith(target, null), 5);

    const result = await handleAddressValidationModal("ABNHA", 0, root, target, 5000);
    expect(result.selectedAddress).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 3: Multiple HH members — modal fires per-member sequentially
// ---------------------------------------------------------------------------

describe("handleAddressValidationModal — multiple HH members fire sequentially", () => {
  it("fires a separate event per member with distinct memberIndex values", async () => {
    const root0 = makeRoot(`<div><button>USE THIS ADDRESS</button></div>`);
    const root1 = makeRoot(`<div><button>USE THIS ADDRESS</button></div>`);
    const target = makeTarget();

    const capturedIndices: number[] = [];
    target.addEventListener(ADDRESS_VALIDATION_REQUIRED_EVENT, (e) => {
      capturedIndices.push((e as CustomEvent).detail?.memberIndex as number);
    });

    // Member 0 — resolve then member 1.
    const p0 = handleAddressValidationModal("ABNHA", 0, root0, target, 5000);
    setTimeout(() => resolveWith(target, "123 Elm St"), 5);
    await p0;

    const p1 = handleAddressValidationModal("ABNHA", 1, root1, target, 5000);
    setTimeout(() => resolveWith(target, "456 Oak Ave"), 5);
    await p1;

    // Two events fired, in order.
    expect(capturedIndices).toEqual([0, 1]);
  });

  it("each member's promise resolves independently with the correct selection", async () => {
    const root = makeRoot(`<div><button>USE THIS ADDRESS</button></div>`);
    const target = makeTarget();

    const p0 = handleAddressValidationModal("ABNHA", 0, root, target, 5000);
    setTimeout(() => resolveWith(target, "Primary address"), 5);
    const result0 = await p0;

    const p1 = handleAddressValidationModal("ABNHA", 1, root, target, 5000);
    setTimeout(() => resolveWith(target, "Member 1 address"), 5);
    const result1 = await p1;

    expect(result0.selectedAddress).toBe("Primary address");
    expect(result1.selectedAddress).toBe("Member 1 address");
  });
});

// ---------------------------------------------------------------------------
// Event name constants
// ---------------------------------------------------------------------------

describe("address validation event name constants", () => {
  it("ADDRESS_VALIDATION_REQUIRED_EVENT is the expected string", () => {
    expect(ADDRESS_VALIDATION_REQUIRED_EVENT).toBe(
      "civica:address-validation-required",
    );
  });

  it("ADDRESS_VALIDATION_RESOLVED_EVENT is the expected string", () => {
    expect(ADDRESS_VALIDATION_RESOLVED_EVENT).toBe(
      "civica:address-validation-resolved",
    );
  });
});
