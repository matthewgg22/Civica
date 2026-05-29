/**
 * Contract tests for the typed BenefitsCal selector map (V1-1a, #310).
 *
 * The map at `src/core/selector-map.ts` materializes the prose walk in
 * `portal-map/SELECTORS.md`. These assertions are the structural integrity
 * contract: they pin down the page coverage, the address-validation county
 * ordinals (the gotcha the first walk missed), label completeness, and that
 * every urlPattern matches its documented `/ApplyForBenefits/XXXXX` path.
 *
 * When V1-5 (#314) migrates `content.ts` onto PORTAL_PAGES, this file is the
 * first place a typo or dropped page surfaces.
 */

import { describe, it, expect } from "vitest";
import {
  PORTAL_PAGES,
  PORTAL_PAGES_BY_CODE,
  ABNAV_START_BUTTONS,
  ENTRY_FLOW_BUTTONS,
  ADDRESS_VALIDATION_FLOW,
  CA_COUNTY_ORDINALS,
  NEXT_BUTTON,
  type FieldType,
  type PortalPage,
} from "../../src/core/selector-map";

const VALID_FIELD_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  "text",
  "select",
  "radio",
  "checkbox",
  "date-password",
  "button",
]);

const codeOf = (p: PortalPage) => p.pageCode;

describe("PORTAL_PAGES — page coverage", () => {
  it("covers the login + dashboard entry pages", () => {
    const codes = PORTAL_PAGES.map(codeOf);
    expect(codes).toContain("LOGIN");
    expect(codes).toContain("CBDAS");
  });

  it("covers the entry-flow chain ABOVR → ABHLT → ABDEI → ABSNC → ABNAV", () => {
    const codes = PORTAL_PAGES.map(codeOf);
    for (const code of ["ABOVR", "ABHLT", "ABDEI", "ABSNC", "ABNAV"]) {
      expect(codes, `missing entry-flow page ${code}`).toContain(code);
    }
  });

  it("covers the step-1 pages required by #310 (ABLPR, ABNMI, ABNHA at minimum)", () => {
    const codes = PORTAL_PAGES.map(codeOf);
    for (const code of ["ABLPR", "ABNMI", "ABNHA"]) {
      expect(codes, `missing step-1 page ${code}`).toContain(code);
    }
  });

  it("covers every step-1 sub-page documented in SELECTORS.md", () => {
    const codes = new Set(PORTAL_PAGES.map(codeOf));
    const documentedStep1 = [
      "ABLPR",
      "ABNMI",
      "ABNHA",
      "ABMAD",
      "ABCON",
      "ABCOP",
      "ABPRI",
      "ABCSD",
      "ABDIS",
      "ABCOS",
      "ABCFA",
      "ABCFS",
      "ABRDT",
      "ABSSN",
      "ABNSN",
      "ABMRS",
      "ABCID",
      "ABDOC",
      "ABBID",
      "ABASX",
      "ABGNR",
    ];
    for (const code of documentedStep1) {
      expect(codes.has(code), `missing step-1 page ${code}`).toBe(true);
    }
  });

  it("has unique page codes", () => {
    const codes = PORTAL_PAGES.map(codeOf);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("PORTAL_PAGES_BY_CODE indexes every page", () => {
    expect(Object.keys(PORTAL_PAGES_BY_CODE).length).toBe(PORTAL_PAGES.length);
    expect(PORTAL_PAGES_BY_CODE.ABNMI?.title).toMatch(/name/i);
  });

  it("tags step-1 sub-pages with step === 1 and entry pages with step === 0", () => {
    expect(PORTAL_PAGES_BY_CODE.ABNMI?.step).toBe(1);
    expect(PORTAL_PAGES_BY_CODE.ABLPR?.step).toBe(1);
    expect(PORTAL_PAGES_BY_CODE.CBDAS?.step).toBe(0);
    expect(PORTAL_PAGES_BY_CODE.ABNAV?.step).toBe(0);
  });
});

describe("address-validation flow — county select", () => {
  it("encodes select#county with 2-digit ordinal optionValues", () => {
    const county = ADDRESS_VALIDATION_FLOW.countySelect;
    expect(county.type).toBe("select");
    expect(county.fallbackSelector).toBe("select#county");
    expect(county.optionValues).toBeDefined();
  });

  it("maps Sacramento to ordinal '34' (SELECTORS.md anchor)", () => {
    expect(ADDRESS_VALIDATION_FLOW.countySelect.optionValues?.Sacramento).toBe(
      "34",
    );
    expect(CA_COUNTY_ORDINALS.Sacramento).toBe("34");
  });

  it("maps Alameda to ordinal '01' (alphabetical-first anchor)", () => {
    expect(CA_COUNTY_ORDINALS.Alameda).toBe("01");
  });

  it("enumerates all 58 CA counties with zero-padded 2-digit ordinals", () => {
    const ordinals = Object.values(CA_COUNTY_ORDINALS);
    expect(ordinals.length).toBe(58);
    for (const ord of ordinals) {
      expect(ord).toMatch(/^\d{2}$/);
    }
  });

  it("exposes the USE THIS ADDRESS and CONTINUE buttons by label", () => {
    expect(ADDRESS_VALIDATION_FLOW.useThisAddressButton.label).toBe(
      "USE THIS ADDRESS",
    );
    expect(ADDRESS_VALIDATION_FLOW.useThisAddressButton.type).toBe("button");
    expect(ADDRESS_VALIDATION_FLOW.continueButton.label).toBe("CONTINUE");
    expect(ADDRESS_VALIDATION_FLOW.continueButton.type).toBe("button");
  });
});

describe("PORTAL_PAGES — field invariants", () => {
  it("every field has a non-empty label", () => {
    for (const page of PORTAL_PAGES) {
      for (const [name, field] of Object.entries(page.fields)) {
        expect(
          field.label,
          `${page.pageCode}.${name}: empty label`,
        ).toBeTruthy();
        expect(typeof field.label).toBe("string");
        expect(field.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("every field has a valid FieldType", () => {
    for (const page of PORTAL_PAGES) {
      for (const [name, field] of Object.entries(page.fields)) {
        expect(
          VALID_FIELD_TYPES.has(field.type),
          `${page.pageCode}.${name}: invalid type ${field.type}`,
        ).toBe(true);
      }
    }
  });

  it("every fallbackSelector, when present, is non-empty", () => {
    for (const page of PORTAL_PAGES) {
      for (const [name, field] of Object.entries(page.fields)) {
        if (field.fallbackSelector !== undefined) {
          expect(
            field.fallbackSelector.length,
            `${page.pageCode}.${name}: empty fallbackSelector`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("info-only pages carry no fields", () => {
    for (const page of PORTAL_PAGES) {
      if (page.infoOnly) {
        expect(
          Object.keys(page.fields).length,
          `${page.pageCode}: infoOnly page should have no fields`,
        ).toBe(0);
      }
    }
  });

  it("models the ABRDT date-of-birth input as type=date-password", () => {
    const dob = PORTAL_PAGES_BY_CODE.ABRDT?.fields.dateOfBirth;
    expect(dob?.type).toBe("date-password");
    expect(dob?.fallbackSelector).toBe("#birthDate_primary_input");
  });

  it("models all ABPRI program selectors as checkboxes (snap/tanf/medicaid)", () => {
    const fields = PORTAL_PAGES_BY_CODE.ABPRI?.fields ?? {};
    expect(fields.calFresh?.type).toBe("checkbox");
    expect(fields.cashAid?.type).toBe("checkbox");
    expect(fields.mediCal?.type).toBe("checkbox");
    expect(fields.calFresh?.fallbackSelector).toContain("#snap");
  });
});

describe("PORTAL_PAGES — urlPattern correctness", () => {
  it("every urlPattern is a RegExp with a non-empty source", () => {
    for (const page of PORTAL_PAGES) {
      expect(page.urlPattern).toBeInstanceOf(RegExp);
      expect(page.urlPattern.source.length).toBeGreaterThan(0);
    }
  });

  it("no two pages share the same urlPattern source", () => {
    const sources = PORTAL_PAGES.map((p) => p.urlPattern.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("each /ApplyForBenefits/XXXXX page urlPattern matches its documented path", () => {
    for (const page of PORTAL_PAGES) {
      // Step-0 dashboard/login use other path roots; only assert the
      // ApplyForBenefits-coded pages here.
      if (page.pageCode === "LOGIN" || page.pageCode === "CBDAS") continue;
      const docPath =
        page.pageCode === "ABOVR"
          ? "/ApplyForBenefits/begin/ABOVR"
          : `/ApplyForBenefits/${page.pageCode}`;
      expect(
        page.urlPattern.test(docPath),
        `${page.pageCode}: urlPattern ${page.urlPattern} does not match ${docPath}`,
      ).toBe(true);
    }
  });

  it("CBDAS + LOGIN match their dashboard/login paths", () => {
    expect(PORTAL_PAGES_BY_CODE.CBDAS?.urlPattern.test("/CBO/CBDAS")).toBe(true);
    expect(PORTAL_PAGES_BY_CODE.LOGIN?.urlPattern.test("/cbo/login")).toBe(true);
  });
});

describe("ABNAV hub + entry-flow buttons", () => {
  it("encodes all 9 ABNAV Start buttons by accessible label", () => {
    const labels = Object.values(ABNAV_START_BUTTONS).map((b) => b.label);
    expect(labels.length).toBe(9);
    expect(labels).toContain("Start Your Information");
    // SELECTORS.md: aria says "Household" (not "Household Details") and
    // "Review and Submit" (with "and", not "&").
    expect(labels).toContain("Start Household Not Available");
    expect(labels).toContain("Start Review and Submit Not Available");
    for (const b of Object.values(ABNAV_START_BUTTONS)) {
      expect(b.type).toBe("button");
    }
  });

  it("encodes the entry-flow button sequence (New Application, BEGIN, Next...)", () => {
    const labels = ENTRY_FLOW_BUTTONS.map((b) => b.label);
    expect(labels[0]).toBe("New Application");
    expect(labels).toContain("BEGIN");
    expect(labels.filter((l) => l === "Next").length).toBeGreaterThanOrEqual(1);
    for (const b of ENTRY_FLOW_BUTTONS) {
      expect(b.type).toBe("button");
    }
  });

  it("the shared NEXT_BUTTON is a button selected by the label 'Next'", () => {
    expect(NEXT_BUTTON.type).toBe("button");
    expect(NEXT_BUTTON.label).toBe("Next");
  });
});
