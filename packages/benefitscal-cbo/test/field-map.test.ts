/**
 * Shape invariants for APPLICATION_FORM_PAGES + CONFIRMATION_PAGE.
 *
 * Added per /plan-eng-review (2026-05-27) finding T1. The current field map
 * is mostly TODO-flagged because the live BenefitsCal CBO Manager portal
 * hasn't been walked yet (TODO-14). The runtime fill loop in the extension
 * + server submitter both branch on `todo: true` to skip, so today's smoke
 * test covers the structural correctness of the data without asserting
 * selectors are real.
 *
 * When TODO-14 lands and selectors get filled in, this file is the first
 * place a typo or duplicate URL pattern will surface as a failed
 * assertion. Treat it as the structural integrity contract.
 */

import { describe, it, expect } from "vitest";
import {
  APPLICATION_FORM_PAGES,
  CONFIRMATION_PAGE,
  type FieldFillKind,
} from "../src/field-map";

const VALID_KINDS: ReadonlySet<FieldFillKind> = new Set<FieldFillKind>([
  "text",
  "date",
  "select",
  "checkbox",
  "radio",
  "phone",
  "ssn_last4",
  "currency_monthly",
  "file_upload",
]);

describe("APPLICATION_FORM_PAGES — structural invariants", () => {
  it("has at least one page", () => {
    expect(APPLICATION_FORM_PAGES.length).toBeGreaterThan(0);
  });

  it("every page has a unique non-empty step identifier", () => {
    const steps = APPLICATION_FORM_PAGES.map((p) => p.step);
    for (const step of steps) {
      expect(step).toBeTruthy();
      expect(typeof step).toBe("string");
    }
    expect(new Set(steps).size).toBe(steps.length);
  });

  it("every page has a urlPattern that is a RegExp", () => {
    for (const page of APPLICATION_FORM_PAGES) {
      expect(page.urlPattern).toBeInstanceOf(RegExp);
      expect(page.urlPattern.source.length).toBeGreaterThan(0);
    }
  });

  it("no two pages share the same urlPattern source", () => {
    const sources = APPLICATION_FORM_PAGES.map((p) => p.urlPattern.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("every page has a non-empty fields[] array", () => {
    for (const page of APPLICATION_FORM_PAGES) {
      expect(Array.isArray(page.fields)).toBe(true);
      expect(page.fields.length).toBeGreaterThan(0);
    }
  });

  it("every field has a non-empty selector + source and a valid kind", () => {
    for (const page of APPLICATION_FORM_PAGES) {
      for (const field of page.fields) {
        expect(field.selector, `${page.step}: missing selector`).toBeTruthy();
        expect(field.source, `${page.step}: missing source`).toBeTruthy();
        expect(
          VALID_KINDS.has(field.kind),
          `${page.step}: invalid kind ${field.kind}`,
        ).toBe(true);
      }
    }
  });

  it("nextButtonSelector, when present, is non-empty", () => {
    for (const page of APPLICATION_FORM_PAGES) {
      if (page.nextButtonSelector !== undefined) {
        expect(page.nextButtonSelector.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("CONFIRMATION_PAGE — structural invariants", () => {
  it("has a urlPattern that is a RegExp", () => {
    expect(CONFIRMATION_PAGE.urlPattern).toBeInstanceOf(RegExp);
  });

  it("has a non-empty caseNumberSelector", () => {
    expect(CONFIRMATION_PAGE.caseNumberSelector).toBeTruthy();
    expect(typeof CONFIRMATION_PAGE.caseNumberSelector).toBe("string");
  });

  it("applicationIdSelector, when present, is non-empty", () => {
    if (CONFIRMATION_PAGE.applicationIdSelector !== undefined) {
      expect(CONFIRMATION_PAGE.applicationIdSelector.length).toBeGreaterThan(0);
    }
  });

  it("its urlPattern does not collide with any APPLICATION_FORM_PAGES pattern", () => {
    const formSources = APPLICATION_FORM_PAGES.map((p) => p.urlPattern.source);
    expect(formSources).not.toContain(CONFIRMATION_PAGE.urlPattern.source);
  });
});

describe("TODO-14 tracking — every field is currently flagged todo:true", () => {
  // When TODO-14 lands and selectors get verified, this expectation flips
  // to "at least one field is no longer todo". Leaving this assertion in
  // place so the verification milestone has a concrete signal.
  it("every field has todo: true until live selectors are captured", () => {
    const totalFields = APPLICATION_FORM_PAGES.flatMap((p) => p.fields);
    const todoFields = totalFields.filter((f) => f.todo === true);
    expect(todoFields.length).toBe(totalFields.length);
  });

  it("CONFIRMATION_PAGE is flagged todo until live selectors are captured", () => {
    expect(CONFIRMATION_PAGE.todo).toBe(true);
  });
});
