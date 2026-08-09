import { describe, it, expect, vi, beforeEach } from "vitest";

// Only the SDK is mocked — merge, completeness and the classifier all run
// for real, same discipline as orchestrator-degrade.test.ts for the public
// chat.

const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = { create: sdk.create };
  },
}));

import { screenHousehold } from "../orchestrator";

function toolResult(input: Record<string, unknown>) {
  return {
    content: [{ type: "tool_use", name: "record_household_facts", id: "t1", input }],
    usage: { input_tokens: 50, output_tokens: 30 },
  };
}

const ASOF = new Date("2026-08-08");

describe("screenHousehold", () => {
  beforeEach(() => sdk.create.mockReset());

  it("first turn: extracts a new household member and classifies not-enough-information", async () => {
    sdk.create.mockResolvedValue(
      toolResult({ household: [{ member_id: "a", age: 62, role: "head" }] }),
    );
    const r = await screenHousehold({
      messages: [{ role: "user", content: "She's 62." }],
      facts: {},
      state: "CA",
      apiKey: "k",
      asOf: ASOF,
    });
    expect(r.extractedNothing).toBe(false);
    expect(r.facts.household).toEqual([{ member_id: "a", age: 62, role: "head" }]);
    expect(r.classification.outcome).toBe("not_enough_information");
  });

  it("accumulates facts across turns until the screening becomes computable", async () => {
    // Fallback for the final no-new-facts turn, after the queued per-turn
    // mocks below are exhausted.
    sdk.create.mockResolvedValue(toolResult({}));
    let facts = {};
    const turns: Array<[Record<string, unknown>, string]> = [
      [{ household: [{ member_id: "a", age: 62, role: "head", immigration: "citizen" }] }, "She's 62, a citizen."],
      [{ income: [{ member: "a", type: "ssa", amount: 1180 }] }, "SSA $1,180/mo."],
      [{ shelter: { rent: 600, sua_tier: "none" } }, "Rent $600."],
      [{ assets: 500 }, "About $500 in savings."],
      [{ cat_elig: "NPA" }, "No SSI or TANF."],
    ];
    for (const [patch, text] of turns) {
      sdk.create.mockResolvedValueOnce(toolResult(patch));
      const r = await screenHousehold({
        messages: [{ role: "user", content: text }],
        facts,
        state: "CA",
        apiKey: "k",
        asOf: ASOF,
      });
      facts = r.facts;
    }
    const final = await screenHousehold({
      messages: [{ role: "user", content: "Anything else?" }],
      facts,
      state: "CA",
      apiKey: "k",
      asOf: ASOF,
    });
    // No new facts this turn — classification runs on what's already known.
    expect(final.classification.completeness.computable).toBe(true);
    expect(["likely_eligible", "categorically_eligible"]).toContain(final.classification.outcome);
  });

  it("a question with no stated facts leaves the worksheet untouched", async () => {
    sdk.create.mockResolvedValue(toolResult({}));
    const priorFacts = { household: [{ member_id: "a", age: 62, role: "head" }] };
    const r = await screenHousehold({
      messages: [{ role: "user", content: "What documents does she need?" }],
      facts: priorFacts,
      state: "CA",
      apiKey: "k",
      asOf: ASOF,
    });
    expect(r.extractedNothing).toBe(true);
    expect(r.facts).toEqual(priorFacts); // untouched, not merged with {}
  });

  it("reports usage even on a no-op extraction turn", async () => {
    sdk.create.mockResolvedValue(toolResult({}));
    const r = await screenHousehold({
      messages: [{ role: "user", content: "ok" }],
      facts: {},
      state: "CA",
      apiKey: "k",
      asOf: ASOF,
    });
    expect(r.usage.inputTokens).toBeGreaterThan(0);
  });
});
