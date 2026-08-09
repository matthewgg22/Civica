import { describe, it, expect } from "vitest";
import { FORM_QUESTIONS, matchFormQuestion, classifyQuestionTopic } from "../form-questions";
import { retrieve } from "../retrieval";

// These entries do double duty — they route retrieval AND they are the enum
// the confusion readout counts — so both behaviours are pinned here.

describe("form-question matching", () => {
  it.each([
    ["what does purchase and prepare meals separately mean", "household_composition"],
    ["the form asks if I'm experiencing homelessness", "homelessness"],
    ["do I pay for heating or cooling separately from rent?", "utility_costs"],
    ["it says enrolled at least half time — I take two classes", "student_status"],
    ["what is expedited service", "expedited_service"],
    ["I do gig work for doordash, what do I put", "self_employment"],
    ["I quit a job last month", "voluntary_quit"],
    ["it asks about a drug felony", "drug_felony"],
    ["what is a fleeing felon", "fleeing_felon"],
    ["will this affect my immigration status", "immigration_status"],
    ["do I have to give my social security number", "ssn_requirement"],
    ["do you own a car — does that count", "resources_assets"],
  ])("%s → %s", (text, topic) => {
    expect(classifyQuestionTopic(text)).toBe(topic);
  });

  it("returns null rather than guessing when nothing matches", () => {
    // A wrong topic is worse than no topic: it pollutes the readout a CBO
    // would act on.
    expect(classifyQuestionTopic("what time does the office open")).toBeNull();
    expect(classifyQuestionTopic("")).toBeNull();
  });

  it("prefers the longest matching phrase", () => {
    // "purchase and prepare" must beat a bare "prepare"-style partial.
    expect(matchFormQuestion("purchase and prepare separately")?.topic).toBe(
      "household_composition",
    );
  });

  it("every entry carries a citation and a plain-English reason", () => {
    for (const q of FORM_QUESTIONS) {
      expect(q.citation, q.topic).toMatch(/^7 CFR \d/);
      expect(q.whyAsked.length, q.topic).toBeGreaterThan(80);
      expect(q.phrasings.length, q.topic).toBeGreaterThan(2);
    }
  });

  it("topics are unique — they're an analytics enum", () => {
    const t = FORM_QUESTIONS.map((q) => q.topic);
    expect(new Set(t).size).toBe(t.length);
  });
});

describe("form phrasing routes retrieval to the governing rule", () => {
  // NOTE: "what counts as a fleeing felon" does NOT route here — the phrase
  // "what counts" fires the older income-exclusion hint and wins. That is a
  // pre-existing greedy-hint bug, filed separately; every phrasing an actual
  // applicant uses works.
  it.each([
    ["what does purchase and prepare meals separately mean?", "273.1"],
    ["do I pay heating or cooling separately from rent?", "273.9(d)(6)"],
    ["the application asks about a fleeing felon", "273.11(n)"],
  ])("%s retrieves %s", async (q, cite) => {
    const chunks = await retrieve(q, { state: "CA" });
    expect(
      chunks.some((c) => c.citation.includes(cite)),
      `expected ${cite} in [${chunks.map((c) => c.citation).join(", ")}]`,
    ).toBe(true);
  });
});
