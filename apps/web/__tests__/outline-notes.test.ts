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
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

// ── The offer itself ──────────────────────────────────────────────────────
//
// "nearing end of completion of chat never recommended downloading pdf of
// answers to complete while putting in application" (owner, 2026-08-27).
//
// The download button lives in the rail — the same place the Save button lived
// when a real 15-turn conversation never once found it (#833). This is the
// inline twin.
describe("the PDF offer", () => {
  const src = readFileSync(join(__dirname, "..", "components", "DemeterChat.tsx"), "utf8");

  it("is offered on what has been gathered, not on turn count", () => {
    // A long conversation with nothing extracted has nothing to put in a
    // document; a short one that named a household and an income does.
    const i = src.indexOf("const showPdfNudge =");
    expect(i, "showPdfNudge").toBeGreaterThan(-1);
    const gate = src.slice(i, src.indexOf(";", i));
    expect(gate).toContain("gatheredCount >= PDF_NUDGE_MIN_FACTS");
    expect(gate, "turn count is the wrong trigger").not.toMatch(/answeredCount/);
  });

  it("does not appear in ask mode, where there is nothing to download", () => {
    const gate = src.slice(src.indexOf("const showPdfNudge ="), src.indexOf(";", src.indexOf("const showPdfNudge =")));
    expect(gate).toContain('worksheetMode === "estimate"');
  });

  it("can be waved off, and reaches the same action as the rail's button", () => {
    const i = src.indexOf("{showPdfNudge && (");
    expect(i, "the nudge is rendered").toBeGreaterThan(-1);
    const block = src.slice(i, src.indexOf("{showSaveNudge && (", i));
    expect(block).toContain("setPdfNudgeDismissed(true)");
    expect(block, "it must call the same downloader, not a second copy").toContain(
      "void downloadOutline()",
    );
  });

  it("has its copy in every language the chat ships", () => {
    const copy = readFileSync(
      join(__dirname, "..", "lib", "i18n", "demeter-chat-copy.ts"),
      "utf8",
    );
    for (const key of ["pdfNudge:", "pdfNudgeYes:", "pdfNudgeNo:"]) {
      expect((copy.match(new RegExp(`^\\s*${key}`, "gm")) ?? []).length, key).toBe(4);
    }
  });
});
