import { describe, it, expect } from "vitest";
import { buildPipeline } from "../demo-pipeline";

// Runs the REAL engine (assessPacket + computeBenefit) over the synthetic
// caseload, so it guards the three-engine wiring end to end.
describe("buildPipeline", () => {
  it("returns empty phases when the synthetic trigger is off", () => {
    const groups = buildPipeline("CA", new Date(), false);
    expect(groups.every((g) => g.cases.length === 0)).toBe(true);
  });

  it("enriches synthetic cases with benefit, deduction trace, and recommendations", () => {
    const cases = buildPipeline("CA", new Date(), true).flatMap((g) => g.cases);
    expect(cases.length).toBeGreaterThan(0);

    const c = cases.find((x) => x.estimatedBenefitUsd !== null);
    expect(c, "expected at least one case with a benefit estimate").toBeTruthy();
    expect(c!.deduction).not.toBeNull();
    expect(c!.deduction!.monthly_benefit).toBe(c!.estimatedBenefitUsd);
    expect(Array.isArray(c!.recommendations)).toBe(true);
    // verification needs (still-needed-to-determine) remain populated
    expect(Array.isArray(c!.verificationNeeds)).toBe(true);
  });

  it("expands each case into a full application across all intake sections", () => {
    const cases = buildPipeline("CA", new Date(), true).flatMap((g) => g.cases);
    // Daniel P. — sparse 5 authored answers should expand into a full intake.
    const daniel = cases.find((c) => c.caseId === "CF-2026-0209")!;
    expect(daniel.answers.length).toBeGreaterThanOrEqual(20);
    const sections = new Set(daniel.answers.map((a) => a.section));
    for (const s of [
      "Where you're applying",
      "About you",
      "Your household",
      "Income & employment",
      "Expenses & deductions",
      "Resources",
      "Documents",
      "Certification",
    ]) {
      expect(sections.has(s), `missing section: ${s}`).toBe(true);
    }
    // Sections render in intake order (Documents after Income).
    const idx = (s: string) => daniel.answers.findIndex((a) => a.section === s);
    expect(idx("Income & employment")).toBeLessThan(idx("Documents"));
    // Derived value tracks engineInputs (income 1450 → "$1,450").
    const income = daniel.answers.find((a) => a.question === "Gross monthly income");
    expect(income?.answer).toBe("$1,450");
  });

  it("preserves hand-authored navigator flags when overlaying the full application", () => {
    const cases = buildPipeline("CA", new Date(), true).flatMap((g) => g.cases);
    // Daniel's authored "Photo ID: Not yet uploaded" flag must survive expansion,
    // and must NOT be duplicated by the derived Documents base row.
    const daniel = cases.find((c) => c.caseId === "CF-2026-0209")!;
    const photoIds = daniel.answers.filter((a) => a.question === "Photo ID");
    expect(photoIds).toHaveLength(1);
    expect(photoIds[0]).toMatchObject({ answer: "Not yet uploaded", flagged: true });

    // Elena's flagged SSN override replaces the derived "Provided" row (no dup).
    const elena = cases.find((c) => c.caseId === "CF-2026-0184")!;
    const ssn = elena.answers.filter((a) => a.question === "Social Security Number");
    expect(ssn).toHaveLength(1);
    expect(ssn[0].flagged).toBe(true);
  });
});
