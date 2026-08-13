// The outlined application is the product's actual deliverable: a document
// someone can put beside the real form and copy from. These pin the things
// that would make it worse than useless — a figure that is wrong, a section
// that reads as a form they failed to fill in, or a tidy page that could be
// mistaken for having applied.

import { describe, it, expect } from "vitest";
import { buildOutline, outlineToText, type OutlineInput } from "../lib/demeter-outline";

const base: OutlineInput = {
  facts: {},
  stateName: null,
  agency: null,
  portalName: null,
  portalUrl: null,
  stillNeeded: [],
  generatedAt: new Date("2026-08-12T00:00:00Z"),
};

const full: OutlineInput = {
  ...base,
  facts: {
    household: [
      { member_id: "applicant", age: 34, role: "head", immigration: "citizen" },
      { member_id: "child_1", age: 6, role: "child", immigration: "citizen" },
    ],
    income: [{ member: "applicant", type: "self_employment", amount: 3000, freq: "monthly" }],
    shelter: { rent: 1400, sua_tier: "none" },
    assets: 250,
  },
  stateName: "Florida",
  agency: "Florida Department of Children and Families (DCF)",
  portalName: "MyACCESS Florida",
  portalUrl: "https://www.myaccessflorida.com/",
  stillNeeded: ["Citizenship or qualified status"],
};

describe("the outlined application", () => {
  it("puts the sections in the order the application asks for them", () => {
    const headings = buildOutline(full).map((s) => s.heading);
    expect(headings).toEqual([
      "Where this application goes",
      "Who is in the household",
      "Income, before tax",
      "Costs that can reduce what counts",
      "Savings and resources",
      "Still to work out",
    ]);
  });

  it("drops sections with nothing in them rather than showing them empty", () => {
    // A page of "not provided" reads as a form someone failed to fill in. What
    // is outstanding belongs in one honest list at the end, not scattered as
    // blanks through the document.
    expect(buildOutline(base)).toEqual([]);
  });

  it("says the income figure is before tax, where the figure is", () => {
    // People quote take-home. Putting the correction anywhere else means the
    // number is read first and the caveat second, or not at all.
    const income = buildOutline(full).find((s) => s.heading === "Income, before tax")!;
    expect(income.lines.join(" ")).toMatch(/BEFORE tax/i);
    expect(income.lines[0]).toContain("$3,000");
    expect(income.lines[0]).toContain("a month");
  });

  it("never prints $NaN when assets came through as words", () => {
    // The schema allows a string here — someone can answer "none" as easily as
    // a number — and this document may be handed to a caseworker.
    const text = outlineToText({ ...full, facts: { ...full.facts, assets: "none" } });
    expect(text).not.toContain("NaN");
    expect(text).toContain("none");
  });

  it("states plainly that it is not an application and was not submitted", () => {
    // A tidy document is exactly the kind of thing someone could mistake for
    // having applied. It has to say so before anything else.
    const text = outlineToText(full);
    expect(text).toMatch(/NOT an application/);
    expect(text).toMatch(/has not been sent/i);
  });

  it("carries where to actually apply, with the link", () => {
    expect(outlineToText(full)).toContain("https://www.myaccessflorida.com/");
  });

  it("says Demeter can be wrong", () => {
    expect(outlineToText(full)).toMatch(/can make mistakes/i);
  });

  it("lists what is still outstanding, once, at the end", () => {
    const text = outlineToText(full);
    expect(text).toContain("STILL TO WORK OUT");
    expect(text.indexOf("STILL TO WORK OUT")).toBeGreaterThan(text.indexOf("WHO IS IN THE HOUSEHOLD"));
  });

  it("renders a household as people, not as field paths", () => {
    const hh = buildOutline(full).find((s) => s.heading === "Who is in the household")!;
    expect(hh.lines[0]).toContain("2 people");
    expect(hh.lines.join(" ")).not.toMatch(/household\.\d|member_id:/);
  });

  // Caught by LOOKING at the rendered PDF: household members printed as
  // "applicant" and "child_1" — the extractor's own slugs, on a page someone
  // hands to a caseworker. A slug there is worse than a generic label; it
  // reads as a reference number they are supposed to recognise.
  it("never prints the extractor's member_id slugs", () => {
    const text = outlineToText(full);
    expect(text).not.toContain("applicant");
    expect(text).not.toContain("child_1");
    expect(text).toContain("You — age 34");
    expect(text).toContain("Child — age 6");
  });

  it("names whose income it is by role, not by slug", () => {
    const income = buildOutline(full).find((s) => s.heading === "Income, before tax")!;
    expect(income.lines[0]).toContain("(You)");
    expect(income.lines[0]).not.toContain("applicant");
  });

  it("does not label income at all in a one-person household", () => {
    const solo = {
      ...full,
      facts: {
        ...full.facts,
        household: [{ member_id: "applicant", age: 34, role: "head", immigration: "citizen" }],
      },
    };
    const income = buildOutline(solo).find((s) => s.heading === "Income, before tax")!;
    expect(income.lines[0]).not.toContain("(");
  });
});
