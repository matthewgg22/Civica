// @vitest-environment jsdom
//
/**
 * Unit tests for the label-first DOM resolver (V1-5, #314).
 *
 * `resolveField` is the runtime counterpart to Playwright's getByLabel: given a
 * label-first FieldSelector, it walks the DOM trying (a) <label> text →
 * for-target / nested control, (b) aria-label, (c) aria-labelledby, then
 * (d) the CSS fallbackSelector. These tests cover each strategy plus the
 * not-found case, in jsdom.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resolveField } from "../../src/core/locate";
import type { FieldSelector } from "../../src/core/selector-map";

function mount(html: string): ParentNode {
  const div = document.createElement("div");
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("resolveField — strategy (a): <label for=...>", () => {
  it("resolves a label[for] to its target control", () => {
    const root = mount(`
      <label for="fname">First Name (required)</label>
      <input id="fname" type="text" />
    `);
    const field: FieldSelector = {
      label: "First Name (required)",
      type: "text",
    };
    const el = resolveField(field, root);
    expect(el).not.toBeNull();
    expect((el as HTMLInputElement).id).toBe("fname");
  });

  it("trims/collapses whitespace in label text before matching", () => {
    const root = mount(`
      <label for="z">   Zip   Code   (required)   </label>
      <input id="z" type="text" />
    `);
    const field: FieldSelector = {
      label: "Zip Code (required)",
      type: "text",
    };
    expect((resolveField(field, root) as HTMLInputElement)?.id).toBe("z");
  });
});

describe("resolveField — strategy (a): wrapping <label>", () => {
  it("resolves a control nested inside a matching label (no for=)", () => {
    const root = mount(`
      <label>City (required)<input type="text" name="city" /></label>
    `);
    const field: FieldSelector = { label: "City (required)", type: "text" };
    const el = resolveField(field, root);
    expect(el).not.toBeNull();
    expect((el as HTMLInputElement).name).toBe("city");
  });
});

describe("resolveField — strategy (b): aria-label", () => {
  it("resolves an exact aria-label match when no <label> exists", () => {
    const root = mount(`<input aria-label="Mobile Phone" name="mob" />`);
    const field: FieldSelector = { label: "Mobile Phone", type: "text" };
    const el = resolveField(field, root);
    expect((el as HTMLInputElement)?.name).toBe("mob");
  });

  it("does not match a partial aria-label", () => {
    const root = mount(`<input aria-label="Mobile Phone Number" name="mob" />`);
    const field: FieldSelector = { label: "Mobile Phone", type: "text" };
    expect(resolveField(field, root)).toBeNull();
  });
});

describe("resolveField — strategy (c): aria-labelledby", () => {
  it("resolves via a single aria-labelledby reference", () => {
    const root = mount(`
      <span id="dob-label">Date of Birth (required)</span>
      <input aria-labelledby="dob-label" id="dob" />
    `);
    const field: FieldSelector = {
      label: "Date of Birth (required)",
      type: "date-password",
    };
    expect((resolveField(field, root) as HTMLInputElement)?.id).toBe("dob");
  });

  it("joins multiple aria-labelledby ids with a single space", () => {
    const root = mount(`
      <span id="a">Address</span><span id="b">Line 1 (required)</span>
      <input aria-labelledby="a b" id="addr" />
    `);
    const field: FieldSelector = {
      label: "Address Line 1 (required)",
      type: "text",
    };
    expect((resolveField(field, root) as HTMLInputElement)?.id).toBe("addr");
  });
});

describe("resolveField — strategy (d): fallbackSelector", () => {
  it("falls back to the CSS selector when no label strategy matches", () => {
    const root = mount(`<input id="text1" type="text" />`);
    const field: FieldSelector = {
      // label intentionally absent from the DOM
      label: "First Name (required)",
      fallbackSelector: "#text1",
      type: "text",
    };
    expect((resolveField(field, root) as HTMLInputElement)?.id).toBe("text1");
  });

  it("prefers a matching label over the fallbackSelector", () => {
    const root = mount(`
      <label for="real">State</label>
      <select id="real"></select>
      <select id="text1"></select>
    `);
    const field: FieldSelector = {
      label: "State",
      fallbackSelector: "#text1",
      type: "select",
    };
    expect((resolveField(field, root) as HTMLSelectElement)?.id).toBe("real");
  });
});

describe("resolveField — not found", () => {
  it("returns null when nothing matches and there is no fallbackSelector", () => {
    const root = mount(`<input id="other" />`);
    const field: FieldSelector = { label: "Nonexistent Field", type: "text" };
    expect(resolveField(field, root)).toBeNull();
  });

  it("returns null when the fallbackSelector matches nothing", () => {
    const root = mount(`<div></div>`);
    const field: FieldSelector = {
      label: "Nope",
      fallbackSelector: "#missing",
      type: "text",
    };
    expect(resolveField(field, root)).toBeNull();
  });
});
