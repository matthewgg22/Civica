import { describe, it, expect } from "vitest";
import { FORM_QUESTIONS } from "@civica/demeter-engine";
import { formQuestionHeading, representativePhrasing, topicLabel } from "../../../../components/SnapOverview";

// Generative-engine optimization is only worth anything if the structured data
// and the visible page agree. Structured data that says something the page
// does not is cloaking — it is worth LESS than no structured data, because it
// gets the page distrusted rather than ignored. These pin the two properties
// that keep them in agreement, plus the one content rule that keeps the page
// from rotting.

describe("form-question FAQ derivation", () => {
  it("derives the heading from the entry, so visible copy and JSON-LD cannot drift", () => {
    // Both the <dt> and the JSON-LD Question.name call this same function —
    // that shared call IS the anti-drift mechanism, so it is pinned here.
    for (const q of FORM_QUESTIONS) {
      const heading = formQuestionHeading(q);
      expect(heading).toContain(representativePhrasing(q));
      expect(heading.startsWith("What does")).toBe(true);
    }
  });

  it("picks the LONGEST phrasing — the one closest to the printed form", () => {
    const q = FORM_QUESTIONS.find((f) => f.topic === "household_composition")!;
    // "purchase and prepare" is form language; "eat together" is not.
    expect(representativePhrasing(q).length).toBe(
      Math.max(...q.phrasings.map((p) => p.length)),
    );
  });

  it("carries NO dollar figures — this content must not rot at the October COLA", () => {
    // The entire reason the page explains mechanisms instead of amounts. A
    // figure added to a whyAsked would silently publish a number that goes
    // stale on a schedule nobody is watching, in the one place (structured
    // data) where a machine will quote it verbatim.
    for (const q of FORM_QUESTIONS) {
      expect(q.whyAsked, `${q.topic} must not hardcode an amount`).not.toMatch(/\$\s?\d/);
    }
  });

  it("every entry names a governing rule, so each answer is attributable", () => {
    for (const q of FORM_QUESTIONS) {
      expect(q.citation, q.topic).toMatch(/^7 CFR \d/);
    }
  });

  it("topics render as readable labels", () => {
    expect(topicLabel("household_composition")).toBe("Household composition");
    expect(topicLabel("missed_interview")).toBe("Missed interview");
  });

  it("covers the FOIA-sourced confusion points, not just form lines", () => {
    // The four added from the CDSS production this session — the ones the
    // corpus says actually stop people, as distinct from form phrasing.
    const topics = FORM_QUESTIONS.map((q) => q.topic);
    for (const t of [
      "missed_interview",
      "repeat_verification",
      "abawd_work_requirement",
      "denial_notice_validity",
    ]) {
      expect(topics, `${t} should be published on the entry page`).toContain(t);
    }
  });
});
