/**
 * Targeted tests for the content script's field-fill loop.
 *
 * The real APPLICATION_FORM_PAGES from @civica/benefitscal-cbo are all
 * tagged `todo: true` until TODO-14 (live CBO portal selector capture)
 * lands. To exercise the fill machinery, we construct synthetic page +
 * field definitions in tests rather than reaching into the real data.
 *
 * What we ARE testing:
 *   - TODO-flagged fields are skipped (no DOM mutation)
 *   - file_upload kind is always skipped (browser security)
 *   - Text fields are written and dispatch input/change events
 *   - Date fields are reformatted from ISO to MM/DD/YYYY
 *   - Phone fields drop the leading +1
 *   - Selects, checkboxes are written when matching options exist
 *
 * What we ARE NOT testing here:
 *   - The chrome.* messaging surface (jsdom doesn't ship it; covered by
 *     manual smoke tests in the README sideload flow).
 *   - The overlay rendering (purely cosmetic; visual QA via sideload).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { fillField, fillPage } from "../src/content";
import type { FieldFill, FormPage } from "@civica/benefitscal-cbo/field-map";

function makeForm(html: string): ParentNode {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("fillField — skip rules", () => {
  it("skips fields tagged todo: true", () => {
    const root = makeForm(`<input name="firstName" />`);
    const field: FieldFill = {
      selector: "[name=firstName]",
      source: "first_name",
      kind: "text",
      todo: true,
    };
    const filled = fillField(field, { first_name: "Maria" }, root);
    expect(filled).toBe(false);
    const input = root.querySelector<HTMLInputElement>("[name=firstName]");
    expect(input?.value).toBe("");
  });

  it("skips file_upload kind even when not tagged todo", () => {
    const root = makeForm(`<input type="file" name="photo" />`);
    const field: FieldFill = {
      selector: "[name=photo]",
      source: "document_urls",
      kind: "file_upload",
    };
    const filled = fillField(field, { document_urls: [{ url: "https://x/y" }] }, root);
    expect(filled).toBe(false);
  });

  it("skips when the source path resolves to null", () => {
    const root = makeForm(`<input name="firstName" />`);
    const field: FieldFill = {
      selector: "[name=firstName]",
      source: "first_name",
      kind: "text",
    };
    const filled = fillField(field, {}, root);
    expect(filled).toBe(false);
  });

  it("skips when the selector does not match anything", () => {
    const root = makeForm(`<div></div>`);
    const field: FieldFill = {
      selector: "[name=missing]",
      source: "first_name",
      kind: "text",
    };
    const filled = fillField(field, { first_name: "Maria" }, root);
    expect(filled).toBe(false);
  });
});

describe("fillField — write paths", () => {
  it("writes a text value and dispatches input + change events", () => {
    const root = makeForm(`<input name="firstName" />`);
    const input = root.querySelector<HTMLInputElement>("[name=firstName]");
    expect(input).not.toBeNull();
    let inputFired = 0;
    let changeFired = 0;
    input?.addEventListener("input", () => inputFired++);
    input?.addEventListener("change", () => changeFired++);

    const field: FieldFill = {
      selector: "[name=firstName]",
      source: "first_name",
      kind: "text",
    };
    const filled = fillField(field, { first_name: "Maria" }, root);

    expect(filled).toBe(true);
    expect(input?.value).toBe("Maria");
    expect(inputFired).toBe(1);
    expect(changeFired).toBe(1);
  });

  it("reformats ISO dates to MM/DD/YYYY", () => {
    const root = makeForm(`<input name="dob" />`);
    const field: FieldFill = {
      selector: "[name=dob]",
      source: "date_of_birth",
      kind: "date",
    };
    fillField(field, { date_of_birth: "1985-03-12" }, root);
    expect(root.querySelector<HTMLInputElement>("[name=dob]")?.value).toBe("03/12/1985");
  });

  it("strips +1 country code from phones (E.164 → 10 digits)", () => {
    const root = makeForm(`<input name="phone" />`);
    const field: FieldFill = {
      selector: "[name=phone]",
      source: "phone",
      kind: "phone",
    };
    fillField(field, { phone: "+14155551234" }, root);
    expect(root.querySelector<HTMLInputElement>("[name=phone]")?.value).toBe("4155551234");
  });

  it("writes ssn_last4 verbatim", () => {
    const root = makeForm(`<input name="ssn" />`);
    const field: FieldFill = {
      selector: "[name=ssn]",
      source: "ssn_last4",
      kind: "ssn_last4",
    };
    fillField(field, { ssn_last4: "1234" }, root);
    expect(root.querySelector<HTMLInputElement>("[name=ssn]")?.value).toBe("1234");
  });

  it("selects an option when it exists in a <select>", () => {
    const root = makeForm(`
      <select name="state">
        <option value="CA">California</option>
        <option value="MA">Massachusetts</option>
      </select>
    `);
    const field: FieldFill = {
      selector: "[name=state]",
      source: "address.state",
      kind: "select",
    };
    const filled = fillField(field, { address: { state: "CA" } }, root);
    expect(filled).toBe(true);
    expect(root.querySelector<HTMLSelectElement>("[name=state]")?.value).toBe("CA");
  });

  it("returns false when a select option does not exist", () => {
    const root = makeForm(`
      <select name="state">
        <option value="CA">California</option>
      </select>
    `);
    const field: FieldFill = {
      selector: "[name=state]",
      source: "address.state",
      kind: "select",
    };
    const filled = fillField(field, { address: { state: "NY" } }, root);
    expect(filled).toBe(false);
  });

  it("clicks a checkbox to flip its state", () => {
    const root = makeForm(`<input type="checkbox" name="paysHeat" />`);
    const cb = root.querySelector<HTMLInputElement>("[name=paysHeat]");
    expect(cb?.checked).toBe(false);
    const field: FieldFill = {
      selector: "[name=paysHeat]",
      source: "utility_allowance_type",
      kind: "checkbox",
    };
    const filled = fillField(field, { utility_allowance_type: true }, root);
    expect(filled).toBe(true);
    expect(cb?.checked).toBe(true);
  });
});

describe("fillPage — aggregate counts", () => {
  it("returns counts split by filled vs skipped (TODO fields count as skipped)", () => {
    const root = makeForm(`
      <input name="firstName" />
      <input name="lastName" />
      <input name="ssn" />
    `);
    const page: FormPage = {
      step: "synthetic_test_page",
      urlPattern: /\/never-matches/,
      fields: [
        { selector: "[name=firstName]", source: "first_name", kind: "text" },
        { selector: "[name=lastName]", source: "last_name", kind: "text" },
        // tagged todo — counts as skipped
        { selector: "[name=ssn]", source: "ssn_last4", kind: "ssn_last4", todo: true },
      ],
    };
    const result = fillPage(
      page,
      { first_name: "Maria", last_name: "G", ssn_last4: "1234" },
      root,
    );
    expect(result.total).toBe(3);
    expect(result.filled).toBe(2);
    expect(result.skipped).toBe(1);
    // SSN field was tagged todo — should NOT have been written
    expect(root.querySelector<HTMLInputElement>("[name=ssn]")?.value).toBe("");
  });

  it("returns all-skipped counts when nothing in the payload matches", () => {
    const root = makeForm(`<input name="firstName" />`);
    const page: FormPage = {
      step: "synthetic_test_page",
      urlPattern: /\/never-matches/,
      fields: [{ selector: "[name=firstName]", source: "first_name", kind: "text" }],
    };
    const result = fillPage(page, {}, root);
    expect(result.filled).toBe(0);
    expect(result.skipped).toBe(1);
  });
});
