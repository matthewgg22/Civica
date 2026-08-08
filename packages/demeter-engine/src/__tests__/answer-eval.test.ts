import { describe, it, expect } from "vitest";
import { scoreAnswer, ANSWER_GOLD } from "../eval/answer-eval";
import { ANSWER_FIXTURES } from "../eval/answer-fixtures";

// Validates the deterministic answer scorers (no API key needed) on hand-written
// good/bad answers: a faithful answer passes; a failing one trips the specific
// check it was built to (hallucinated citation, missing disclaimer, stale rule,
// failure to refuse, PII echo).

const goldById = Object.fromEntries(ANSWER_GOLD.map((g) => [g.id, g]));

describe("Mae answer-faithfulness scorers", () => {
  it("covers every gold case with a fixture", () => {
    expect(ANSWER_FIXTURES.map((f) => f.id).sort()).toEqual(ANSWER_GOLD.map((g) => g.id).sort());
  });

  for (const fx of ANSWER_FIXTURES) {
    it(`${fx.id}: good answer passes`, () => {
      const score = scoreAnswer(fx.good, goldById[fx.id]!, fx.retrievedCitations);
      expect(score.pass, JSON.stringify(score.checks)).toBe(true);
    });

    it(`${fx.id}: bad answer fails (${fx.badTrips})`, () => {
      const score = scoreAnswer(fx.bad, goldById[fx.id]!, fx.retrievedCitations);
      expect(score.pass).toBe(false);
      expect(score.checks[fx.badTrips], `expected ${fx.badTrips} to fail`).toBe(false);
    });
  }
});
