import { describe, expect, it } from "vitest";
import { buildPipeline } from "../demo-pipeline";
import {
  buildDeficiencyItems,
  deficiencyDocument,
  cureDateLabel,
  type DeficiencyDoc,
} from "../deficiency-notice";

const cases = buildPipeline("CA", new Date(), true).flatMap((g) => g.cases);

describe("deficiency-notice", () => {
  it("turns a case with gaps into citable, deduped items", () => {
    // Elena has a flagged SSN (does not match SSA) + outstanding documents.
    const elena = cases.find((c) => c.caseId === "CF-2026-0184")!;
    const items = buildDeficiencyItems(elena);
    expect(items.length).toBeGreaterThan(0);
    // Every item carries a 7 CFR citation and a non-empty action.
    for (const it of items) {
      expect(it.citation).toMatch(/7 CFR 273\./);
      expect(it.action.length).toBeGreaterThan(0);
    }
    // The flagged SSN surfaces as an SSN item citing 273.6.
    const ssn = items.find((i) => /social security/i.test(i.category));
    expect(ssn?.citation).toContain("273.6");
    // Categories are deduped (no two items share a category).
    const cats = items.map((i) => i.category);
    expect(new Set(cats).size).toBe(cats.length);
  });

  it("computes the ~10-day cure deadline from a fixed 'now'", () => {
    // Jun 8 2026 + 10 days = Jun 18 2026.
    expect(cureDateLabel(new Date(2026, 5, 8))).toMatch(/June 18, 2026/);
  });

  const docData = (items: DeficiencyDoc["items"]): DeficiencyDoc => ({
    applicant: "Elena V.",
    caseId: "CF-2026-0184",
    county: "San Francisco",
    generatedAt: "2026-06-08",
    cureBy: "June 18, 2026",
    items,
  });

  it("renders a PDF notice with the cure deadline, items, and the honesty footer", () => {
    const items = [
      { category: "Earned income", citation: "7 CFR 273.9 / 273.2(f)(1)(i)", action: "pay stubs for the last 30 days" },
    ];
    const html = deficiencyDocument(docData(items), { forWord: false });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("window.print()");
    expect(html).toContain("June 18, 2026");
    expect(html).toContain("Earned income");
    expect(html).toContain("273.2(h)"); // the cure-period rule
    expect(html).toMatch(/not the county's official Notice of Action/i);
  });

  it("renders a Word notice (Office namespaces, no print button)", () => {
    const html = deficiencyDocument(docData([]), { forWord: true });
    expect(html).toContain("urn:schemas-microsoft-com:office:word");
    expect(html).not.toContain("window.print()");
  });

  it("emits a 'ready to file' notice when nothing is outstanding", () => {
    const html = deficiencyDocument(docData([]), { forWord: false });
    expect(html).toMatch(/ready to file/i);
  });
});
