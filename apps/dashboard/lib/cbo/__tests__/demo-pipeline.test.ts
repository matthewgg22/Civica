import { describe, it, expect } from "vitest";
import { buildPipeline } from "../demo-pipeline";
import { SUMMARY_QUESTIONS } from "../field-options";

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
    // Money reads with cents (authored "$1,450" normalized → "$1,450.00").
    const income = daniel.answers.find((a) => a.question === "Gross monthly income");
    expect(income?.answer).toBe("$1,450.00");
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

  it("renders dollar figures without the normalizeMoney mangling (regression)", () => {
    // Bug: the cents-normalizer matched only "$2" inside "$2,750.00" and produced
    // "$2.00,750.00". Guard: no answer carries cents immediately before a comma,
    // and the known asset figure reads correctly.
    const cases = buildPipeline("CA", new Date(), true).flatMap((g) => g.cases);
    for (const c of cases) {
      for (const a of c.answers) {
        expect(a.answer, `malformed money in ${c.caseId}: ${a.answer}`).not.toMatch(/\$\d[\d,]*\.\d{2},/);
      }
    }
    const daniel = cases.find((c) => c.caseId === "CF-2026-0209")!;
    const assets = daniel.answers.find((a) => a.question === "Countable assets (cash + bank)")!;
    expect(assets.answer).toBe("Under $2,750.00");
  });

  it("flags expedited-service cases where shelter exceeds income (273.2(i))", () => {
    const cases = buildPipeline("CA", new Date(), true).flatMap((g) => g.cases);
    // Elena: income 1640 < rent 2400 → expedited. Theresa: 1500 < 1600+180.
    const elena = cases.find((c) => c.caseId === "CF-2026-0184")!;
    const theresa = cases.find((c) => c.caseId === "CF-2026-0162")!;
    expect(elena.expedited).toBe(true);
    expect(elena.expeditedReason).toMatch(/shelter/i);
    expect(theresa.expedited).toBe(true);
    // Aisha: income 1800 > shelter 1520 → not expedited.
    const aisha = cases.find((c) => c.caseId === "CF-2026-0211")!;
    expect(aisha.expedited).toBe(false);
  });

  it("carries regulatory clocks — interview, 30/7-day processing, cure", () => {
    const cases = buildPipeline("CA", new Date(), true).flatMap((g) => g.cases);
    const elena = cases.find((c) => c.caseId === "CF-2026-0184")!;
    // Expedited → 7-day limit; she's at day 9 → overdue. Interview missed. Cure clock 1 day.
    expect(elena.processingLimit).toBe(7);
    expect(elena.processingDay).toBe(9);
    expect(elena.interview.status).toBe("missed");
    expect(elena.cureDaysLeft).toBe(1);
    // Sofia: non-expedited, near the 30-day wire.
    const sofia = cases.find((c) => c.caseId === "CF-2026-0201")!;
    expect(sofia.processingLimit).toBe(30);
    expect(sofia.processingDay).toBe(28);
    // Enrolled Maria: clock done (null), interview completed.
    const maria = cases.find((c) => c.caseId === "CF-2026-0179")!;
    expect(maria.processingDay).toBeNull();
    expect(maria.interview.status).toBe("completed");
  });

  // Phase-1 demo view-models: assignment + buddy + portal autofill.
  it("derives assignment/buddy/portal that ramp with the lifecycle phase", () => {
    const cases = buildPipeline("CA", new Date(), true).flatMap((g) => g.cases);

    for (const c of cases) {
      expect(c.assignment).toBeTruthy();
      expect(c.buddy).toBeTruthy();
      expect(c.portal).toBeTruthy();
    }

    // Aisha: requesting + Unassigned → unassigned caseworker, no buddy, locked portal.
    const aisha = cases.find((c) => c.caseId === "CF-2026-0211")!;
    expect(aisha.assignment.status).toBe("unassigned");
    expect(aisha.buddy.status).toBe("none");
    expect(aisha.portal.applicantApproved).toBe(false);
    expect(aisha.portal.cboApproved).toBe(false);

    // Live Jasmine → reviewing assignment, active buddy, partial portal (applicant
    // approved, CBO still reviewing → not the hero state).
    const jasmine = cases.find((c) => c.caseId === "CF-2026-0188")!;
    expect(jasmine.assignment.status).toBe("reviewing");
    expect(jasmine.buddy.status).toBe("active");
    expect(jasmine.portal.applicantApproved).toBe(true);
    expect(jasmine.portal.cboApproved).toBe(false);

    // Enrolled Maria → approved assignment, completed buddy, hero portal state
    // (both approved + consent recorded).
    const maria = cases.find((c) => c.caseId === "CF-2026-0179")!;
    expect(maria.assignment.status).toBe("approved");
    expect(maria.buddy.status).toBe("completed");
    expect(maria.portal.applicantApproved && maria.portal.cboApproved).toBe(true);
    expect(maria.portal.consent).not.toBeNull();
  });

  it("portal field map links approved answers to BenefitsCal fields", () => {
    const maria = buildPipeline("CA", new Date(), true)
      .flatMap((g) => g.cases)
      .find((c) => c.caseId === "CF-2026-0179")!;
    const fields = maria.portal.fieldMap.map((r) => r.benefitsCalField);
    expect(fields).toContain("County");
    expect(fields).toContain("Number in home");
    const hh = maria.portal.fieldMap.find((r) => r.benefitsCalField === "Number in home")!;
    expect(hh.value).toMatch(/\d+ (person|people)/);
  });

  // ── Full BenefitsCal questionnaire completeness (cbo-phase2) ────────────────
  // The expansion went from 25 → ~44 fields across 11 sections, filling the
  // gaps a CalFresh caseworker would pend on. Guard the new sections + questions
  // so a future edit can't silently shrink the application back.
  it("expands every case across all 11 intake sections", () => {
    const cases = buildPipeline("CA", new Date(), true).flatMap((g) => g.cases);
    const ALL_SECTIONS = [
      "Where you're applying",
      "About you",
      "Your household",
      "Residence",
      "Income & employment",
      "Student & work requirements",
      "Expenses & deductions",
      "Resources",
      "Special situations",
      "Documents",
      "Certification",
    ];
    for (const c of cases) {
      const sections = new Set(c.answers.map((a) => a.section));
      for (const s of ALL_SECTIONS) {
        expect(sections.has(s), `${c.caseId} missing section: ${s}`).toBe(true);
      }
    }
  });

  it("includes the gap-filling questions a CalFresh worker pends on", () => {
    const daniel = buildPipeline("CA", new Date(), true)
      .flatMap((g) => g.cases)
      .find((c) => c.caseId === "CF-2026-0209")!;
    const questions = new Set(daniel.answers.map((a) => a.question));
    for (const q of [
      "Programs applying for",
      "Received CalFresh before?",
      "Date of birth",
      "Citizenship / immigration status",
      "Authorized representative",
      "Home address",
      "Housing situation",
      "Other income (SSI, unemployment, child support received)",
      "Enrolled in higher education (half-time or more)?",
      "Weekly work hours",
      "Work registration / ABAWD",
      "Pays heating / cooling costs?",
      "Pays electricity or gas (separate from heating)?",
      "Pays for phone or internet?",
      "Receives HEAP energy assistance?",
      "Reduced hours or quit a job in the last 60 days?",
      "Fleeing felon or probation / parole violation?",
      "Drug-felony conviction?",
    ]) {
      expect(questions.has(q), `missing question: ${q}`).toBe(true);
    }
  });

  it("never leaves a summary (at-a-glance) field without an answer", () => {
    // Every SUMMARY_QUESTIONS entry must resolve to a real answer in every case,
    // or the collapsed dropdown view renders a blank row.
    const cases = buildPipeline("CA", new Date(), true).flatMap((g) => g.cases);
    for (const c of cases) {
      const byQ = new Map(c.answers.map((a) => [a.question, a]));
      for (const q of SUMMARY_QUESTIONS) {
        expect(byQ.has(q), `${c.caseId} summary missing: ${q}`).toBe(true);
      }
    }
  });

  it("derives a deterministic, county-correct synthetic home address", () => {
    const addrOf = (caseId: string) =>
      buildPipeline("CA", new Date(), true)
        .flatMap((g) => g.cases)
        .find((c) => c.caseId === caseId)!
        .answers.find((a) => a.question === "Home address")!.answer;

    // Shape: "<number> <street>[, Apt N], <City>, CA <zip>".
    for (const id of ["CF-2026-0184", "CF-2026-0179", "CF-2026-0203"]) {
      expect(addrOf(id)).toMatch(/^\d+ .+, .+, CA \d{5}$/);
    }
    // County → city mapping (Alameda seats in Oakland, not "Alameda").
    expect(addrOf("CF-2026-0184")).toContain("San Francisco, CA 94110"); // Elena
    expect(addrOf("CF-2026-0179")).toContain("Oakland, CA 94601"); // Maria (Alameda)
    expect(addrOf("CF-2026-0203")).toContain("Fresno, CA 93706"); // Carlos
    // Deterministic across builds (no Math.random / Date in the hash).
    expect(addrOf("CF-2026-0184")).toBe(addrOf("CF-2026-0184"));
  });

  it("derives ABAWD status from work + household composition (7 CFR 273.7)", () => {
    const cases = buildPipeline("CA", new Date(), true).flatMap((g) => g.cases);
    const abawd = (caseId: string) =>
      cases.find((c) => c.caseId === caseId)!.answers.find((a) => a.question === "Work registration / ABAWD")!.answer;

    // Elena: 1-person, employed, able-bodied → meets the work requirement.
    expect(abawd("CF-2026-0184")).toMatch(/meets work requirement/i);
    // Jasmine: household with children → exempt (dependent in home).
    expect(abawd("CF-2026-0188")).toMatch(/exempt/i);
    // Theresa: a 60+/disabled member → exempt.
    expect(abawd("CF-2026-0162")).toMatch(/exempt/i);
  });
});
