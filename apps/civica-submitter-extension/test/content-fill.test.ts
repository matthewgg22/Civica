/**
 * Targeted tests for the content script's field-fill loop (V1-5, #314).
 *
 * The content script now drives off the typed `PORTAL_PAGES` selector map +
 * the React-safe `fillElement` primitive + the label-first `resolveField`
 * resolver, all from `@civica/benefitscal-cbo/core`. To exercise the fill
 * machinery deterministically we construct synthetic PortalPage + FieldSelector
 * definitions rather than depending on the real map's exact field set.
 *
 * What we ARE testing:
 *   - Fields with no `source` are counted as "needs review" (no DOM mutation)
 *   - Fields resolve label-first (a <label> beats nothing) and fill
 *   - Text fields are written and dispatch input/change events
 *   - date-password fields reformat ISO → MM/DD/YYYY
 *   - Selects fill when a matching option exists, report not-found otherwise
 *   - Checkboxes toggle via click
 *   - Missing packet value → no-value; missing DOM element → not-found
 *   - fillPage aggregates filled / skippedNoValue / notFound / needsReview
 *
 * What we ARE NOT testing here:
 *   - The chrome.* messaging surface (jsdom doesn't ship it; covered by
 *     manual smoke tests in the README sideload flow).
 *   - The overlay rendering (purely cosmetic; visual QA via sideload).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { fillField, fillPage } from "../src/content";
import { PORTAL_PAGES_BY_CODE } from "@civica/benefitscal-cbo/core";
import type { FieldSelector, PortalPage } from "@civica/benefitscal-cbo/core";

function makeForm(html: string): ParentNode {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}

/** Build a minimal synthetic PortalPage from a fields object. */
function page(fields: Record<string, FieldSelector>): PortalPage {
  return {
    pageCode: "TEST",
    title: "synthetic test page",
    urlPattern: /\/never-matches/,
    step: 1,
    fields,
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("fillField — skip / needs-review rules", () => {
  it("returns needs-review for a field with no source (human fills)", () => {
    const root = makeForm(`<input aria-label="Gender identity" />`);
    const field: FieldSelector = { label: "Gender identity", type: "radio" };
    expect(fillField(field, { gender: "x" }, root)).toBe("needs-review");
  });

  it("returns needs-review for a button field even if it has a source", () => {
    const root = makeForm(`<button aria-label="Next">Next</button>`);
    const field: FieldSelector = { label: "Next", type: "button", source: "first_name" };
    expect(fillField(field, { first_name: "Maria" }, root)).toBe("needs-review");
  });

  it("returns no-value when the source path resolves to nothing", () => {
    const root = makeForm(`<input aria-label="First Name" />`);
    const field: FieldSelector = { label: "First Name", type: "text", source: "first_name" };
    expect(fillField(field, {}, root)).toBe("no-value");
  });

  it("returns not-found when the element cannot be located", () => {
    const root = makeForm(`<div></div>`);
    const field: FieldSelector = {
      label: "First Name",
      type: "text",
      source: "first_name",
      fallbackSelector: "#missing",
    };
    expect(fillField(field, { first_name: "Maria" }, root)).toBe("not-found");
  });
});

describe("fillField — write paths (label-first resolution)", () => {
  it("writes a text value located by <label for> and dispatches input + change", () => {
    const root = makeForm(`
      <label for="fn">First Name (required)</label>
      <input id="fn" />
    `);
    const input = root.querySelector<HTMLInputElement>("#fn");
    let inputFired = 0;
    let changeFired = 0;
    input?.addEventListener("input", () => inputFired++);
    input?.addEventListener("change", () => changeFired++);

    const field: FieldSelector = {
      label: "First Name (required)",
      type: "text",
      source: "first_name",
    };
    expect(fillField(field, { first_name: "Maria" }, root)).toBe("filled");
    expect(input?.value).toBe("Maria");
    expect(inputFired).toBe(1);
    expect(changeFired).toBe(1);
  });

  it("resolves via fallbackSelector when no label is present (positional id)", () => {
    const root = makeForm(`<input id="text1" />`);
    const field: FieldSelector = {
      label: "First Name (required)",
      fallbackSelector: "#text1",
      type: "text",
      source: "first_name",
    };
    expect(fillField(field, { first_name: "Maria" }, root)).toBe("filled");
    expect(root.querySelector<HTMLInputElement>("#text1")?.value).toBe("Maria");
  });

  it("reformats ISO date-of-birth to MM/DD/YYYY for date-password fields", () => {
    const root = makeForm(`<input id="dob" type="password" />`);
    const field: FieldSelector = {
      label: "Date of Birth (required)",
      fallbackSelector: "#dob",
      type: "date-password",
      source: "date_of_birth",
    };
    expect(fillField(field, { date_of_birth: "1985-03-12" }, root)).toBe("filled");
    expect(root.querySelector<HTMLInputElement>("#dob")?.value).toBe("03/12/1985");
  });

  it("resolves a nested dotted source path (address.zip)", () => {
    const root = makeForm(`<input aria-label="Zip Code (required)" />`);
    const field: FieldSelector = {
      label: "Zip Code (required)",
      type: "text",
      source: "address.zip",
    };
    expect(fillField(field, { address: { zip: "95814" } }, root)).toBe("filled");
    expect(
      root.querySelector<HTMLInputElement>('[aria-label="Zip Code (required)"]')?.value,
    ).toBe("95814");
  });

  it("selects an option when it exists in a <select>", () => {
    const root = makeForm(`
      <label for="st">State</label>
      <select id="st">
        <option value="CA">California</option>
        <option value="MA">Massachusetts</option>
      </select>
    `);
    const field: FieldSelector = { label: "State", type: "select", source: "address.state" };
    expect(fillField(field, { address: { state: "CA" } }, root)).toBe("filled");
    expect(root.querySelector<HTMLSelectElement>("#st")?.value).toBe("CA");
  });

  it("returns not-found when a select option does not exist", () => {
    const root = makeForm(`
      <label for="st">State</label>
      <select id="st"><option value="CA">California</option></select>
    `);
    const field: FieldSelector = { label: "State", type: "select", source: "address.state" };
    // fillElement returns false (no matching option) → surfaced as not-found.
    expect(fillField(field, { address: { state: "NY" } }, root)).toBe("not-found");
  });

  it("clicks a checkbox to flip its state", () => {
    const root = makeForm(`<input type="checkbox" aria-label="CalFresh" />`);
    const cb = root.querySelector<HTMLInputElement>('[aria-label="CalFresh"]');
    expect(cb?.checked).toBe(false);
    const field: FieldSelector = {
      label: "CalFresh",
      type: "checkbox",
      source: "wants_calfresh",
    };
    expect(fillField(field, { wants_calfresh: true }, root)).toBe("filled");
    expect(cb?.checked).toBe(true);
  });
});

describe("fillField — value transforms (V1-3, #313)", () => {
  it("applies ca-county-ordinal: county NAME → ordinal lands in the select", () => {
    const root = makeForm(`
      <label for="cty">County</label>
      <select id="cty">
        <option value="">--</option>
        <option value="01">Alameda</option>
        <option value="34">Sacramento</option>
      </select>
    `);
    const field: FieldSelector = {
      label: "County",
      type: "select",
      source: "address.county",
      transform: "ca-county-ordinal",
    };
    // Packet carries the NAME (with the " County" suffix); the transform maps it
    // to "34" before fillElement, which selects the matching option.
    expect(fillField(field, { address: { county: "Sacramento County" } }, root)).toBe(
      "filled",
    );
    expect(root.querySelector<HTMLSelectElement>("#cty")?.value).toBe("34");
  });

  it("counts an unmappable county as needs-review (no garbage written)", () => {
    const root = makeForm(`
      <label for="cty">County</label>
      <select id="cty"><option value="">--</option><option value="34">Sacramento</option></select>
    `);
    const field: FieldSelector = {
      label: "County",
      type: "select",
      source: "address.county",
      transform: "ca-county-ordinal",
    };
    // "Cook" has no CA ordinal → transform returns null → skipped.
    expect(fillField(field, { address: { county: "Cook" } }, root)).toBe(
      "needs-review",
    );
    // The select keeps its default (empty) value — nothing garbage written.
    expect(root.querySelector<HTMLSelectElement>("#cty")?.value).toBe("");
  });

  it("applies phone-10digit: E.164 → bare 10-digit before fill", () => {
    const root = makeForm(`<input aria-label="Mobile Phone" />`);
    const field: FieldSelector = {
      label: "Mobile Phone",
      type: "text",
      source: "phone",
      transform: "phone-10digit",
    };
    expect(fillField(field, { phone: "+15551234567" }, root)).toBe("filled");
    expect(
      root.querySelector<HTMLInputElement>('[aria-label="Mobile Phone"]')?.value,
    ).toBe("5551234567");
  });

  it("treats an unknown transform name as needs-review (selector-map bug guard)", () => {
    const root = makeForm(`<input aria-label="County" />`);
    const field: FieldSelector = {
      label: "County",
      type: "text",
      source: "address.county",
      transform: "does-not-exist",
    };
    expect(fillField(field, { address: { county: "Sacramento" } }, root)).toBe(
      "needs-review",
    );
  });

  it("a no-value source short-circuits before the transform runs", () => {
    const root = makeForm(`<input aria-label="Mobile Phone" />`);
    const field: FieldSelector = {
      label: "Mobile Phone",
      type: "text",
      source: "phone",
      transform: "phone-10digit",
    };
    expect(fillField(field, {}, root)).toBe("no-value");
  });
});

describe("fillField — eligibility radio/checkbox option groups (V1-6, #314)", () => {
  // --- Helpers building the real-shape group fields the selector map encodes.
  const homelessField: FieldSelector = {
    label: "Are you experiencing homelessness?",
    type: "radio",
    source: "is_homeless",
    optionMap: { true: "Yes", false: "No" },
    options: {
      Yes: { label: "Yes", fallbackSelector: "#radioCard_0", type: "radio" },
      No: { label: "No", fallbackSelector: "#radioCard_1", type: "radio" },
    },
  };
  const studentField: FieldSelector = {
    label: "Are you a college student?",
    type: "radio",
    source: "is_college_student",
    optionMap: { true: "Yes", false: "No" },
    options: {
      Yes: { label: "Yes", fallbackSelector: "#CollegeStudentE_radio_button_0", type: "radio" },
      No: { label: "No", fallbackSelector: "#CollegeStudentE_radio_button_1", type: "radio" },
    },
  };
  const citizenField: FieldSelector = {
    label: "Are you a U.S. citizen?",
    type: "radio",
    source: "citizenship_status",
    optionMap: { us_citizen: "Yes", us_national: "Yes", non_citizen: "No" },
    options: {
      Yes: { label: "Yes", fallbackSelector: "#citizen_radio_0", type: "radio" },
      No: { label: "No", fallbackSelector: "#citizen_radio_1", type: "radio" },
    },
  };
  const maritalField: FieldSelector = {
    label: "Marital status",
    type: "radio",
    source: "marital_status",
    optionMap: { married: "married", single: "single", domestic_partner: "registeredDomesticPartner" },
    options: {
      married: { label: "Married", fallbackSelector: "#maritalStatus_2", type: "radio" },
      single: { label: "Single", fallbackSelector: "#maritalStatus_6", type: "radio" },
      registeredDomesticPartner: {
        label: "Registered Domestic Partner",
        fallbackSelector: "#maritalStatus_4",
        type: "radio",
      },
    },
  };
  const ssnField: FieldSelector = {
    label: "Do you have a Social Security Number?",
    type: "radio",
    presenceOf: "ssn_last4",
    options: { present: { label: "Yes", fallbackSelector: "#ssn_group0", type: "radio" } },
  };
  const calFreshField: FieldSelector = {
    label: "CalFresh",
    type: "checkbox",
    fallbackSelector: "input[type=checkbox]#snap",
    constant: "true",
  };
  const applyingForSelfField: FieldSelector = {
    label: "Are you applying for benefits for yourself?",
    type: "radio",
    constant: "Yes",
    options: {
      Yes: { label: "Yes", fallbackSelector: "#label_0", type: "radio" },
      No: { label: "No", fallbackSelector: "#label_1", type: "radio" },
    },
  };

  function radioGroup(name: string): ParentNode {
    return makeForm(`
      <input type="radio" name="${name}" id="${name}_0" value="y" />
      <input type="radio" name="${name}" id="${name}_1" value="n" />
    `);
  }

  it("is_college_student=true clicks ABCOS Yes (not No)", () => {
    const root = makeForm(`
      <input type="radio" name="g" id="CollegeStudentE_radio_button_0" value="y" />
      <input type="radio" name="g" id="CollegeStudentE_radio_button_1" value="n" />
    `);
    expect(fillField(studentField, { is_college_student: true }, root)).toBe("filled");
    expect(root.querySelector<HTMLInputElement>("#CollegeStudentE_radio_button_0")?.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>("#CollegeStudentE_radio_button_1")?.checked).toBe(false);
  });

  it("is_college_student=false clicks ABCOS No", () => {
    const root = makeForm(`
      <input type="radio" name="g" id="CollegeStudentE_radio_button_0" value="y" />
      <input type="radio" name="g" id="CollegeStudentE_radio_button_1" value="n" />
    `);
    expect(fillField(studentField, { is_college_student: false }, root)).toBe("filled");
    expect(root.querySelector<HTMLInputElement>("#CollegeStudentE_radio_button_1")?.checked).toBe(true);
  });

  it("citizenship_status='non_citizen' clicks ABDOC No (not Yes)", () => {
    const root = makeForm(`
      <input type="radio" name="c" id="citizen_radio_0" value="y" />
      <input type="radio" name="c" id="citizen_radio_1" value="n" />
    `);
    expect(fillField(citizenField, { citizenship_status: "non_citizen" }, root)).toBe("filled");
    expect(root.querySelector<HTMLInputElement>("#citizen_radio_1")?.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>("#citizen_radio_0")?.checked).toBe(false);
  });

  it("citizenship_status='us_national' clicks ABDOC Yes", () => {
    const root = makeForm(`
      <input type="radio" name="c" id="citizen_radio_0" value="y" />
      <input type="radio" name="c" id="citizen_radio_1" value="n" />
    `);
    expect(fillField(citizenField, { citizenship_status: "us_national" }, root)).toBe("filled");
    expect(root.querySelector<HTMLInputElement>("#citizen_radio_0")?.checked).toBe(true);
  });

  it("marital_status='married' selects the Married radio (id _2)", () => {
    const root = makeForm(`
      <input type="radio" name="m" id="maritalStatus_2" value="2" />
      <input type="radio" name="m" id="maritalStatus_6" value="6" />
      <input type="radio" name="m" id="maritalStatus_4" value="4" />
    `);
    expect(fillField(maritalField, { marital_status: "married" }, root)).toBe("filled");
    expect(root.querySelector<HTMLInputElement>("#maritalStatus_2")?.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>("#maritalStatus_6")?.checked).toBe(false);
  });

  it("marital_status='domestic_partner' selects the Registered Domestic Partner radio (id _4)", () => {
    const root = makeForm(`
      <input type="radio" name="m" id="maritalStatus_2" value="2" />
      <input type="radio" name="m" id="maritalStatus_4" value="4" />
    `);
    expect(fillField(maritalField, { marital_status: "domestic_partner" }, root)).toBe("filled");
    expect(root.querySelector<HTMLInputElement>("#maritalStatus_4")?.checked).toBe(true);
  });

  it("program selection: CalFresh checkbox is checked (constant true)", () => {
    const root = makeForm(`<input type="checkbox" id="snap" />`);
    const cb = root.querySelector<HTMLInputElement>("#snap");
    expect(cb?.checked).toBe(false);
    // No packet field for program — the constant drives it regardless of payload.
    expect(fillField(calFreshField, {}, root)).toBe("filled");
    expect(cb?.checked).toBe(true);
  });

  it("program selection: applying-for-self constant clicks Yes regardless of payload", () => {
    const root = makeForm(`
      <input type="radio" name="label" id="label_0" value="y" />
      <input type="radio" name="label" id="label_1" value="n" />
    `);
    expect(fillField(applyingForSelfField, {}, root)).toBe("filled");
    expect(root.querySelector<HTMLInputElement>("#label_0")?.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>("#label_1")?.checked).toBe(false);
  });

  it("ssn_last4 present → ABSSN Yes (#ssn_group0) branch", () => {
    const root = makeForm(`
      <input type="radio" name="SSN_IND" id="ssn_group0" value="0" />
      <input type="radio" name="SSN_IND" id="ssn_group1" value="1" />
      <input type="radio" name="SSN_IND" id="ssn_group2" value="2" />
    `);
    expect(fillField(ssnField, { ssn_last4: "1234" }, root)).toBe("filled");
    expect(root.querySelector<HTMLInputElement>("#ssn_group0")?.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>("#ssn_group1")?.checked).toBe(false);
    expect(root.querySelector<HTMLInputElement>("#ssn_group2")?.checked).toBe(false);
  });

  // --- The eligibility-correctness regression: unmapped/absent → click NOTHING.

  it("REGRESSION: a missing citizenship_status clicks NO radio (needs-review)", () => {
    const root = makeForm(`
      <input type="radio" name="c" id="citizen_radio_0" value="y" />
      <input type="radio" name="c" id="citizen_radio_1" value="n" />
    `);
    expect(fillField(citizenField, {}, root)).toBe("no-value");
    expect(root.querySelector<HTMLInputElement>("#citizen_radio_0")?.checked).toBe(false);
    expect(root.querySelector<HTMLInputElement>("#citizen_radio_1")?.checked).toBe(false);
  });

  it("REGRESSION: an UNMAPPED citizenship value (e.g. 'refugee') clicks NOTHING (needs-review)", () => {
    const root = makeForm(`
      <input type="radio" name="c" id="citizen_radio_0" value="y" />
      <input type="radio" name="c" id="citizen_radio_1" value="n" />
    `);
    expect(fillField(citizenField, { citizenship_status: "refugee" }, root)).toBe("needs-review");
    expect(root.querySelector<HTMLInputElement>("#citizen_radio_0")?.checked).toBe(false);
    expect(root.querySelector<HTMLInputElement>("#citizen_radio_1")?.checked).toBe(false);
  });

  it("REGRESSION: a missing is_homeless clicks neither homelessness radio", () => {
    const root = radioGroup("radioCard");
    expect(fillField(homelessField, {}, root)).toBe("no-value");
    expect(root.querySelector<HTMLInputElement>("#radioCard_0")?.checked).toBe(false);
    expect(root.querySelector<HTMLInputElement>("#radioCard_1")?.checked).toBe(false);
  });

  it("REGRESSION: a missing ssn_last4 clicks NO SSN radio (no auto-pick of a no-SSN answer)", () => {
    const root = makeForm(`
      <input type="radio" name="SSN_IND" id="ssn_group0" value="0" />
      <input type="radio" name="SSN_IND" id="ssn_group1" value="1" />
      <input type="radio" name="SSN_IND" id="ssn_group2" value="2" />
    `);
    expect(fillField(ssnField, {}, root)).toBe("needs-review");
    expect(root.querySelector<HTMLInputElement>("#ssn_group0")?.checked).toBe(false);
    expect(root.querySelector<HTMLInputElement>("#ssn_group1")?.checked).toBe(false);
    expect(root.querySelector<HTMLInputElement>("#ssn_group2")?.checked).toBe(false);
  });

  it("is_homeless=true resolves the Yes option by label when no fallback id is present", () => {
    // Label-first resolution still works for option groups.
    const labelFirst: FieldSelector = {
      label: "Are you experiencing homelessness?",
      type: "radio",
      source: "is_homeless",
      optionMap: { true: "Yes", false: "No" },
      options: {
        Yes: { label: "Yes", type: "radio" },
        No: { label: "No", type: "radio" },
      },
    };
    const root = makeForm(`
      <label>Yes<input type="radio" name="h" id="hy" /></label>
      <label>No<input type="radio" name="h" id="hn" /></label>
    `);
    expect(fillField(labelFirst, { is_homeless: true }, root)).toBe("filled");
    expect(root.querySelector<HTMLInputElement>("#hy")?.checked).toBe(true);
  });

  it("returns not-found when the mapped option's element is absent from the page", () => {
    const root = makeForm(`<div></div>`);
    expect(fillField(citizenField, { citizenship_status: "us_citizen" }, root)).toBe("not-found");
  });
});

describe("fillPage — aggregate counts", () => {
  it("splits counts across filled / no-value / not-found / needs-review", () => {
    const root = makeForm(`
      <label for="fn">First Name</label><input id="fn" />
      <label for="ln">Last Name</label><input id="ln" />
      <input aria-label="Gender identity" />
    `);
    const p = page({
      firstName: { label: "First Name", type: "text", source: "first_name" },
      lastName: { label: "Last Name", type: "text", source: "last_name" },
      // no source → needs manual review
      gender: { label: "Gender identity", type: "radio" },
      // has source but element absent → not found
      ssn: { label: "SSN", type: "text", source: "ssn_last4", fallbackSelector: "#nope" },
      // has source but payload has no value → no-value
      dob: { label: "Date of Birth", type: "date-password", source: "date_of_birth", fallbackSelector: "#dobx" },
    });
    const result = fillPage(p, { first_name: "Maria", last_name: "G", ssn_last4: "1234" }, root);

    expect(result.total).toBe(5);
    expect(result.fillable).toBe(4); // all but `gender`
    expect(result.filled).toBe(2); // firstName + lastName
    expect(result.needsReview).toBe(1); // gender
    expect(result.notFound).toBe(1); // ssn — element absent
    expect(result.skippedNoValue).toBe(1); // dob — no payload value
  });

  it("counts an all-needs-review page (no sources) with zero fillable", () => {
    const root = makeForm(`<input aria-label="Gender identity" />`);
    const p = page({
      gender: { label: "Gender identity", type: "radio" },
    });
    const result = fillPage(p, {}, root);
    expect(result.fillable).toBe(0);
    expect(result.filled).toBe(0);
    expect(result.needsReview).toBe(1);
  });

  it("counts a transform-null field as fillable AND needs-review", () => {
    const root = makeForm(`
      <label for="cty">County</label>
      <select id="cty"><option value="">--</option><option value="34">Sacramento</option></select>
    `);
    const p = page({
      county: {
        label: "County",
        type: "select",
        source: "address.county",
        transform: "ca-county-ordinal",
      },
    });
    // "Cook" → null from the transform → skipped, but it HAS a source so it
    // counts as fillable too (fillable + needsReview can exceed total).
    const result = fillPage(p, { address: { county: "Cook" } }, root);
    expect(result.total).toBe(1);
    expect(result.fillable).toBe(1);
    expect(result.filled).toBe(0);
    expect(result.needsReview).toBe(1);
    expect(root.querySelector<HTMLSelectElement>("#cty")?.value).toBe("");
  });
});

describe("fillPage — real selector-map pages (V1-6, #314)", () => {
  it("drives the real ABPRI page: #snap checked, applying-for-self Yes, TANF/Medi-Cal untouched", () => {
    const root = makeForm(`
      <input type="checkbox" id="snap" />
      <input type="checkbox" id="tanf" />
      <input type="checkbox" id="medicaid" />
      <input type="radio" name="label" id="label_0" value="y" />
      <input type="radio" name="label" id="label_1" value="n" />
    `);
    const abpri = PORTAL_PAGES_BY_CODE.ABPRI!;
    // No program data in the packet — program selection is policy (constants).
    const result = fillPage(abpri, { packet_id: "x" }, root);

    // calFresh (constant) + applyingForSelf (constant group) are fillable+filled.
    expect(result.filled).toBe(2);
    expect(result.fillable).toBe(2);
    // cashAid + mediCal carry no source/constant → needs-review (left unchecked).
    expect(result.needsReview).toBe(2);

    expect(root.querySelector<HTMLInputElement>("#snap")?.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>("#tanf")?.checked).toBe(false);
    expect(root.querySelector<HTMLInputElement>("#medicaid")?.checked).toBe(false);
    expect(root.querySelector<HTMLInputElement>("#label_0")?.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>("#label_1")?.checked).toBe(false);
  });

  it("drives the real ABDOC page from citizenship_status=us_citizen → Yes", () => {
    const root = makeForm(`
      <input type="radio" name="citizen_radio" id="citizen_radio_0" value="y" />
      <input type="radio" name="citizen_radio" id="citizen_radio_1" value="n" />
    `);
    const abdoc = PORTAL_PAGES_BY_CODE.ABDOC!;
    const result = fillPage(abdoc, { citizenship_status: "us_citizen" }, root);
    expect(result.filled).toBe(1);
    expect(root.querySelector<HTMLInputElement>("#citizen_radio_0")?.checked).toBe(true);
  });
});
