// The outline's notes section (owner, 2026-08-27): "for additional
// information or questions in chat that didnt fit in pdf should still be
// included as notes".
//
// THE GAP. The outline is built from structured facts, so a caveat that
// changes how a FIELD SHOULD BE READ has nowhere to live. The Uber case from
// the reported transcript is exactly it: "self-employment income requires a
// caseworker calculation" is not a number, but someone copying their income
// figure onto the real form needs it beside that figure, or they will write
// down their gross earnings and be wrong.
import { describe, it, expect } from "vitest";
import { buildOutline, outlineToText, type OutlineInput } from "../lib/demeter-outline";

const base: OutlineInput = {
  facts: { household: [{ member_id: "self", role: "self" }] },
  stateName: "California",
  agency: "CDSS",
  portalName: "BenefitsCal",
  portalUrl: "https://benefitscal.com",
  stillNeeded: ["How much rent you pay"],
  generatedAt: new Date("2026-08-27T00:00:00Z"),
} as OutlineInput;

const headings = (i: OutlineInput) => buildOutline(i).map((s) => s.heading);
const notesSection = (i: OutlineInput) =>
  buildOutline(i).find((s) => s.heading.startsWith("Worth knowing"));

describe("the notes section", () => {
  it("is absent when the conversation raised nothing a field cannot hold", () => {
    expect(notesSection(base)).toBeUndefined();
    expect(headings(base).some((h) => h.startsWith("Worth knowing"))).toBe(false);
  });

  it("carries the caveat that changes how a figure should be read", () => {
    const s = notesSection({
      ...base,
      notes: ["Self-employment income requires a caseworker calculation."],
    })!;
    expect(s, "no notes section").toBeTruthy();
    expect(s.lines).toContain("Self-employment income requires a caseworker calculation.");
    // Not a checklist: these are things to KNOW, not things to go and do.
    expect(s.kind).toBeUndefined();
  });

  it("comes after the open items, not before them", () => {
    // "Still to work out" is the actionable list; pushing it down a phone
    // screen behind reference text is the wrong trade.
    const h = headings({ ...base, notes: ["A caveat."] });
    expect(h.indexOf("Still to work out")).toBeLessThan(
      h.findIndex((x) => x.startsWith("Worth knowing")),
    );
  });

  it("drops blanks and repeats rather than printing them", () => {
    const s = notesSection({
      ...base,
      notes: ["  ", "Same note.", "Same note.", ""],
    })!;
    expect(s.lines).toEqual(["Same note."]);
  });

  it("reaches the rendered document, not just the model", () => {
    const text = outlineToText({ ...base, notes: ["Mileage comes off first."] });
    expect(text).toContain("Mileage comes off first.");
  });
});
