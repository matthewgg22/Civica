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

  // P0-1 of the third-pass audit (#898): a REAL 25-turn MA conversation's
  // estimate rail showed $1,100 — computed for a household of FIVE, when the
  // real household was three. Root cause: per-turn extraction + merge keyed
  // on member_id, a slug the model re-invents on every independent call, so
  // the same son arrived as "child_1", then "son", then "student" across
  // turns and the household inflated turn by turn. The fix re-reads the
  // whole visible conversation each turn (one consistent set of ids per
  // call) and REPLACES the drift-prone arrays when the fresh extraction
  // provides them — while still keeping prior facts for anything the fresh
  // pass is silent on, so figures that scrolled out of the message window
  // survive in the client-held facts.
  describe("household inflation (#898 P0-1)", () => {
    it("re-stated members under NEW ids replace the old ones — never merge into duplicates", async () => {
      // The client has 3 accumulated members under one set of ids…
      const priorFacts = {
        household: [
          { member_id: "a", age: 56, role: "head" },
          { member_id: "b", age: 15, role: "child" },
          { member_id: "c", age: 20, role: "child" },
        ],
        assets: 600,
      };
      // …and the fresh whole-conversation extraction returns the SAME three
      // people under different slugs, exactly as happens across independent
      // calls.
      sdk.create.mockResolvedValue(
        toolResult({
          household: [
            { member_id: "applicant", age: 56, role: "head" },
            { member_id: "child_15", age: 15, role: "child" },
            { member_id: "son_20", age: 20, role: "child" },
          ],
        }),
      );
      const r = await screenHousehold({
        messages: [{ role: "user", content: "it's me and my two kids, 15 and 20" }],
        facts: priorFacts,
        state: "MA",
        apiKey: "k",
        asOf: ASOF,
      });
      expect(r.facts.household).toHaveLength(3);
      // And a field the fresh extraction was silent on survives from the
      // prior facts — retention is the point of keeping the client copy.
      expect(r.facts.assets).toBe(600);
    });

    it("re-stated income replaces rather than appends — no duplicate lines", async () => {
      const priorFacts = {
        income: [
          { member: "a", type: "self_employment", amount: 1600 },
          { member: "c", type: "wages", amount: 400 },
        ],
      };
      sdk.create.mockResolvedValue(
        toolResult({
          income: [
            { member: "applicant", type: "self_employment", amount: 1600 },
            { member: "son_20", type: "wages", amount: 400 },
          ],
        }),
      );
      const r = await screenHousehold({
        messages: [{ role: "user", content: "uber about $1,600, my son makes $400" }],
        facts: priorFacts,
        state: "MA",
        apiKey: "k",
        asOf: ASOF,
      });
      expect(r.facts.income).toHaveLength(2);
    });
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
