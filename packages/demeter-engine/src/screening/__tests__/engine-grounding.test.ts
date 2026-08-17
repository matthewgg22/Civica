import { describe, it, expect, vi, beforeEach } from "vitest";

// Engine-grounding spec (#895) — the synthesis step. Only the Anthropic SDK
// (the extraction call) is mocked; classifyScreening and the snap-rules
// engine underneath it run REAL, so a block claiming "Estimated monthly
// benefit: $X" in these tests carries a figure the actual verified engine
// computed.

const sdk = vi.hoisted(() => ({ create: vi.fn(), stream: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = { create: sdk.create, stream: sdk.stream };
  },
}));

import {
  shouldAttemptEngineGrounding,
  buildEngineGroundingBlock,
} from "../engine-grounding";
import type { PartialFacts } from "../facts-extraction";

/** A tool_use response the mocked extraction call returns. */
function extractionResponse(patch: PartialFacts) {
  return {
    content: [{ type: "tool_use", name: "record_household_facts", input: patch }],
    usage: { input_tokens: 120, output_tokens: 40 },
  };
}

// The classify.test.ts likely_eligible fixture — a complete, computable
// household the real engine APPROVEs with a real dollar benefit.
const COMPUTABLE: PartialFacts = {
  household: [{ member_id: "a", age: 62, role: "head", immigration: "citizen" }],
  income: [{ member: "a", type: "ssa", amount: 1180 }],
  shelter: { rent: 600, sua_tier: "none" },
  deductions: { medical_unreimbursed: 175 },
  assets: 500,
  cat_elig: "NPA",
};

const MSG = (content: string) => [{ role: "user" as const, content }];

describe("shouldAttemptEngineGrounding — the cheap trigger", () => {
  it("requires a state: money talk on the federal floor never triggers", () => {
    expect(shouldAttemptEngineGrounding(MSG("I make $2,000 a month"), null)).toBe(false);
    expect(shouldAttemptEngineGrounding(MSG("I make $2,000 a month"), undefined)).toBe(false);
  });

  it("triggers on the money shapes real transcripts used", () => {
    for (const text of [
      "I make $2,000 a month",
      "I get 150 a day for 4 days a week",
      "my income is 74k a year",
      "about 600 per week from the diner",
    ]) {
      expect(shouldAttemptEngineGrounding(MSG(text), "MA"), text).toBe(true);
    }
  });

  it("does not trigger on money-free conversation or bare small numbers", () => {
    for (const text of [
      "how do I apply?",
      "I have 2 kids and I'm 30",
      "the interview took 30 days to schedule",
    ]) {
      expect(shouldAttemptEngineGrounding(MSG(text), "MA"), text).toBe(false);
    }
  });

  it("ignores money in ASSISTANT turns — only the user's own figures trigger", () => {
    const messages = [
      { role: "user" as const, content: "how do I apply?" },
      { role: "assistant" as const, content: "The limit is $2,292 a month for two people." },
      { role: "user" as const, content: "ok, and then what?" },
    ];
    expect(shouldAttemptEngineGrounding(messages, "MA")).toBe(false);
  });
});

describe("buildEngineGroundingBlock", () => {
  beforeEach(() => {
    sdk.create.mockReset();
  });

  it("computable household → block carries the REAL engine's verdict and dollar benefit", async () => {
    sdk.create.mockResolvedValue(extractionResponse(COMPUTABLE));
    const { text, usage } = await buildEngineGroundingBlock(
      MSG("I'm 62, get $1,180 in social security, rent is $600"),
      "CA",
      "test-key",
    );
    expect(text).toContain("VERIFIED ENGINE COMPUTATION");
    expect(text).toContain("LIKELY ELIGIBLE");
    expect(text).toMatch(/Estimated monthly benefit: \$\d+/);
    // The facts the computation used are restated, so the block doubles as a
    // compact in-window record of what has been established (#891 notes).
    expect(text).toContain("$1180");
    expect(text).toContain("$600/month");
    // Extraction spend is reported for the caller's settle.
    expect(usage).toEqual({ inputTokens: 120, outputTokens: 40 });
  });

  it("incomplete facts → CANNOT COMPUTE + the engine's own still-needed list, no invented figures", async () => {
    sdk.create.mockResolvedValue(
      extractionResponse({ income: [{ member: "a", type: "wages", amount: 2000, freq: "monthly" }] }),
    );
    const { text } = await buildEngineGroundingBlock(MSG("I make $2,000 a month"), "MA", "test-key");
    expect(text).toContain("CANNOT COMPUTE YET");
    expect(text).toContain("Still needed");
    expect(text).toContain("Household size");
    expect(text).not.toMatch(/Estimated monthly benefit/);
  });

  it("self-employment → county-review framing, never an asserted benefit figure", async () => {
    sdk.create.mockResolvedValue(
      extractionResponse({
        ...COMPUTABLE,
        income: [{ member: "a", type: "self_employment", amount: 2000 }],
      }),
    );
    const { text } = await buildEngineGroundingBlock(
      MSG("I clean houses for cash, about $2,000 a month"),
      "MA",
      "test-key",
    );
    expect(text).toContain("NEEDS COUNTY REVIEW");
    expect(text).not.toMatch(/Estimated monthly benefit/);
  });

  // Second-pass live battery, 2026-08-17: a two-job household ($300/week +
  // $250 biweekly) DEGRADED — the block grounded each converted line ($1,290,
  // $537.50) but not their SUM, and the county-review guidance explicitly
  // invites comparing "the user's stated figures against the income limits",
  // so the model totals them — a derived+derived figure the numeric gate's
  // user-arithmetic can't admit. The engine is the right place to state the
  // total (summing income lines IS eligibility arithmetic), so the block must
  // carry it whenever more than one income line exists.
  it("multiple income lines → the block states the engine's own monthly TOTAL", async () => {
    sdk.create.mockResolvedValue(
      extractionResponse({
        ...COMPUTABLE,
        income: [
          { member: "a", type: "wages", amount: 1290, freq: "monthly" },
          { member: "a", type: "wages", amount: 537.5, freq: "monthly" },
        ],
      }),
    );
    const { text } = await buildEngineGroundingBlock(
      MSG("I make $300 a week at a cafe and $250 every two weeks cleaning offices"),
      "CA",
      "test-key",
    );
    expect(text).toContain("Total stated gross income: $1,828/month");
  });

  it("an empty extraction returns no block at all", async () => {
    sdk.create.mockResolvedValue(extractionResponse({}));
    const { text } = await buildEngineGroundingBlock(MSG("what is snap?"), "CA", "test-key");
    expect(text).toBeNull();
  });

  it("an extraction failure returns no block instead of throwing — grounding never costs the answer", async () => {
    sdk.create.mockRejectedValue(new Error("api down"));
    const { text, usage } = await buildEngineGroundingBlock(
      MSG("I make $2,000 a month"),
      "CA",
      "test-key",
    );
    expect(text).toBeNull();
    expect(usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});
