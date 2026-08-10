import { describe, it, expect } from "vitest";
import {
  thinkingConfigFor,
  usesLegacyThinking,
  LEGACY_THINKING_BUDGET_TOKENS,
} from "../thinking-config";
import { MAE_GENERATION, ANSWER_LIMITS } from "../index";

describe("per-model thinking configuration", () => {
  it("keeps the pinned model on adaptive — production behaviour is unchanged", () => {
    expect(thinkingConfigFor(MAE_GENERATION.model)).toEqual({ type: "adaptive" });
  });

  it("sends the legacy shape to Haiku 4.5, which rejects adaptive with a 400", () => {
    // The actual API error this exists to prevent:
    //   "adaptive thinking is not supported on this model"
    // Every comparison case against Haiku errored before this — reporting a
    // model as unusable when only the request shape was wrong.
    expect(thinkingConfigFor("claude-haiku-4-5")).toEqual({
      type: "enabled",
      budget_tokens: LEGACY_THINKING_BUDGET_TOKENS,
    });
  });

  it("matches dated snapshot ids, not just aliases", () => {
    expect(usesLegacyThinking("claude-haiku-4-5-20251001")).toBe(true);
  });

  it("budget_tokens stays under max_tokens — the API rejects >=", () => {
    expect(LEGACY_THINKING_BUDGET_TOKENS).toBeLessThan(ANSWER_LIMITS.MAX_OUTPUT_TOKENS);
  });

  it("defaults an UNKNOWN model to adaptive rather than the deprecated shape", () => {
    // Denylist, not allowlist: a model released after this file should fail
    // loudly on the first case if it needs the old shape, not be silently
    // scored on a worse configuration that looks like a capability gap.
    expect(thinkingConfigFor("claude-something-new-9")).toEqual({ type: "adaptive" });
    expect(usesLegacyThinking("claude-opus-4-8")).toBe(false);
    expect(usesLegacyThinking("claude-sonnet-5")).toBe(false);
  });
});
