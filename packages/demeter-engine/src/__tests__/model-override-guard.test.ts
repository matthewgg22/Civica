// The modelOverride guard, tested WITHOUT a key: the throw has to happen
// before any network call, or the guard is decorative.
import { describe, it, expect } from "vitest";
import { answerQuestion } from "../orchestrator";

describe("modelOverride is eval-only", () => {
  it("throws when a non-eval request tries to change the model", async () => {
    const gen = answerQuestion({
      messages: [{ role: "user", content: "What is SNAP?" }],
      audience: "public",
      apiKey: "sk-not-used-the-guard-fires-first",
      modelOverride: "claude-haiku-4-5",
      meta: { mode: "public" },
    });
    // Rejecting is the point: a silently-ignored override would make a
    // comparison run look like it measured three models when it measured one
    // three times — plausible numbers, wrong conclusion.
    await expect(gen.next()).rejects.toThrow(/eval-only/);
  });

  it("throws when mode is absent entirely, not just when it is wrong", async () => {
    const gen = answerQuestion({
      messages: [{ role: "user", content: "What is SNAP?" }],
      audience: "public",
      apiKey: "sk-not-used-the-guard-fires-first",
      modelOverride: "claude-haiku-4-5",
    });
    await expect(gen.next()).rejects.toThrow(/eval-only/);
  });
});
