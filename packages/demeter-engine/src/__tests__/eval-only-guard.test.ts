import { describe, it, expect, afterEach, vi } from "vitest";
import { runLiveAnswerEval } from "../eval/run-live-answer-eval";
import { ALL_GOLD } from "../eval/answer-eval";

// EVAL_ONLY guard (regression): a typo'd case id used to filter the gold set
// to ZERO cases — the runner returned [], the suite asserted over an empty
// array, and the live eval reported GREEN having generated nothing. A
// measurement harness that passes vacuously is worse than no harness.

afterEach(() => vi.unstubAllEnvs());

describe("runLiveAnswerEval EVAL_ONLY filter", () => {
  it("throws on an unknown case id instead of silently running zero cases", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("EVAL_ONLY", "es-expedited,typo-not-a-real-id");
    await expect(runLiveAnswerEval()).rejects.toThrow(/unknown case id/i);
  });

  it("names the offending id and lists the known ids", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("EVAL_ONLY", "nope");
    await expect(runLiveAnswerEval()).rejects.toThrow(/nope/);
    await expect(runLiveAnswerEval()).rejects.toThrow(/es-expedited/); // known-id list
  });

  it("still requires an API key before anything else", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(runLiveAnswerEval()).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  it("gold ids are unique — duplicates would make EVAL_ONLY ambiguous", () => {
    const ids = ALL_GOLD.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
