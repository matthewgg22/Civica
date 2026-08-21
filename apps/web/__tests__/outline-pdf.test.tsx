// The outline PDF must be ONE PAGE for a real household (#898 P2-8).
//
// A real 25-turn MA conversation (2026-08-20) produced a six-section outline —
// three people, two income lines, rent, savings, two still-to-work-out items —
// and the renderer spilled "Still to work out" plus the disclaimer onto a
// second sheet while a fifth of page one sat empty. The tester's feedback was
// direct: this should be a one-pager someone can put beside the real
// application and copy from. A two-page document is a two-page document to
// print, carry, and lose half of — and the half that strands is the list of
// what's still missing.
//
// This renders the REAL component through @react-pdf/renderer with exactly
// that household and counts the pages in the produced PDF. Page objects in the
// output are `/Type /Page` (the tree root is `/Type /Pages` — note the
// negative lookahead).
import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { OutlinePdf } from "../lib/outline-pdf";
import type { OutlineInput } from "../lib/demeter-outline";

function pageCount(buf: Buffer): number {
  return (buf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

// The household from the audit conversation, verbatim in shape.
const MA_INPUT: OutlineInput = {
  facts: {
    household: [
      { member_id: "applicant", age: 45, role: "head" },
      { member_id: "child_15", age: 15, role: "child" },
      { member_id: "son_20", age: 20, role: "child", student: "he_halftime_subject" },
    ],
    income: [
      { member: "applicant", type: "self_employment", amount: 1600 },
      { member: "son_20", type: "wages", amount: 400 },
    ],
    shelter: { rent: 1400 },
    assets: 600,
  },
  stateName: "Massachusetts",
  agency: "Department of Transitional Assistance (DTA)",
  portalName: "DTA Connect",
  portalUrl: "https://dtaconnect.eohhs.mass.gov",
  stillNeeded: [
    "Whether anyone pays for utilities separately from rent",
    "Citizenship or immigration status for each household member",
  ],
  generatedAt: new Date("2026-08-21"),
};

describe("outline PDF layout (#898 P2-8)", () => {
  it("the audit household's outline fits on one page", async () => {
    const buf = await renderToBuffer(<OutlinePdf input={MA_INPUT} />);
    expect(pageCount(buf)).toBe(1);
  }, 30_000);

  it("a fuller household — five people, four income lines, every cost — still fits on one page", async () => {
    const input: OutlineInput = {
      ...MA_INPUT,
      facts: {
        household: [
          { member_id: "a", age: 45, role: "head" },
          { member_id: "b", age: 44, role: "spouse" },
          { member_id: "c", age: 15, role: "child" },
          { member_id: "d", age: 20, role: "child", student: "he_halftime_subject" },
          { member_id: "e", age: 71, role: "parent", elderly: true },
        ],
        income: [
          { member: "a", type: "self_employment", amount: 1600 },
          { member: "b", type: "wages", amount: 900 },
          { member: "d", type: "wages", amount: 400 },
          { member: "e", type: "ssa", amount: 1180 },
        ],
        shelter: { rent: 1850 },
        deductions: { dependent_care: 300, medical_unreimbursed: 145, child_support_paid: 200 },
        assets: 1200,
      },
      stillNeeded: [
        "Whether anyone pays for utilities separately from rent",
        "Citizenship or immigration status for each household member",
        "Whether the 71-year-old files for SNAP as part of this household",
      ],
    };
    const buf = await renderToBuffer(<OutlinePdf input={input} />);
    expect(pageCount(buf)).toBe(1);
  }, 30_000);
});
