import { describe, it, expect, vi, beforeEach } from "vitest";

// Orchestrator ∘ engine-grounding integration (#895). Only the Anthropic SDK
// is mocked; extraction-block formatting, classifyScreening, snap-rules, the
// numeric gate, and the trailer all run REAL. The contracts under test:
//
//   1. a money-bearing conversation with a state gets a VERIFIED ENGINE
//      COMPUTATION system block, and the ENGINE'S figure passes the numeric
//      gate (outcome clean) even though it appears in no retrieved source and
//      no user turn — the exact class of number that used to deadlock;
//   2. the federal floor (state null) never attempts the paid extraction;
//   3. an extraction failure costs nothing — the answer streams as before.

const sdk = vi.hoisted(() => ({ stream: vi.fn(), create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = { stream: sdk.stream, create: sdk.create };
  },
}));

import { answerQuestion, type AnswerFrame } from "../orchestrator";
import { classifyScreening } from "../screening/classify";
import type { PartialFacts } from "../screening/facts-extraction";

// The same complete, computable household the module spec uses — the real
// engine APPROVEs it with a real dollar benefit.
const COMPUTABLE: PartialFacts = {
  household: [{ member_id: "a", age: 62, role: "head", immigration: "citizen" }],
  income: [{ member: "a", type: "ssa", amount: 1180 }],
  shelter: { rent: 600, sua_tier: "none" },
  deductions: { medical_unreimbursed: 175 },
  assets: 500,
  cat_elig: "NPA",
};

function fakeStream(chunks: string[]) {
  const state = { aborted: false };
  return {
    abort: () => {
      state.aborted = true;
    },
    async finalMessage() {
      return { usage: { input_tokens: 100, output_tokens: 50 }, stop_reason: "end_turn" };
    },
    async *[Symbol.asyncIterator]() {
      for (const text of chunks) {
        if (state.aborted) return;
        yield { type: "content_block_delta", delta: { type: "text_delta", text } };
      }
    },
  };
}

async function collect(req: Parameters<typeof answerQuestion>[0]): Promise<AnswerFrame[]> {
  const frames: AnswerFrame[] = [];
  for await (const f of answerQuestion(req)) frames.push(f);
  return frames;
}

function streamSystemBlocks(): string[] {
  const call = sdk.stream.mock.calls[0]?.[0] as { system?: Array<{ text: string }> } | undefined;
  return (call?.system ?? []).map((b) => b.text);
}

describe("answerQuestion × engine grounding (#895)", () => {
  const outcomes: string[] = [];
  const usages: Array<[number, number]> = [];

  beforeEach(() => {
    outcomes.length = 0;
    usages.length = 0;
    sdk.stream.mockReset();
    sdk.create.mockReset();
  });

  const baseRequest = (content: string, state: string | null) => ({
    messages: [{ role: "user" as const, content }],
    audience: "public" as const,
    state,
    apiKey: "test-key",
    events: {
      onVerified: (o: string) => {
        outcomes.push(o);
      },
      onUsage: (i: number, o: number) => {
        usages.push([i, o]);
      },
    },
    meta: { staffUserId: null, mode: "public" as const, scopeRef: "SPEC" },
  });

  it("injects the engine block and its figure passes the numeric gate", async () => {
    // What will the real engine say for this household? Ask it directly, so
    // the test stays true even when FY figures move.
    const expected = classifyScreening(COMPUTABLE, "CA", new Date());
    const benefit = expected.verdict?.benefit;
    expect(typeof benefit).toBe("number");

    sdk.create.mockResolvedValue({
      content: [{ type: "tool_use", name: "record_household_facts", input: COMPUTABLE }],
      usage: { input_tokens: 200, output_tokens: 60 },
    });
    // The streamed answer quotes the ENGINE'S benefit — a figure in no
    // retrieved source and no user turn. Pre-#895 the gate degraded exactly
    // this shape.
    sdk.stream.mockReturnValue(
      fakeStream(Array(12).fill(`Your estimated benefit is $${benefit} a month. `)),
    );

    const frames = await collect(
      baseRequest("I'm 62, I get $1,180 a month in social security, rent is $600", "CA"),
    );

    const blocks = streamSystemBlocks();
    const engineBlock = blocks.find((b) => b.includes("VERIFIED ENGINE COMPUTATION"));
    expect(engineBlock, "engine block missing from the system sent to the model").toBeTruthy();
    expect(engineBlock).toContain(`$${benefit}`);

    const text = frames.filter((f) => f.type === "delta").map((f) => f.text).join("");
    expect(text).toContain(`$${benefit}`);
    expect(outcomes).toEqual(["clean"]);
    // Extraction spend reached onUsage (200/60 extraction + 100/50 stream).
    expect(usages).toEqual([[300, 110]]);
  });

  it("federal floor (state null) never attempts the paid extraction", async () => {
    sdk.stream.mockReturnValue(
      fakeStream(Array(12).fill("SNAP eligibility depends on your household. ")),
    );
    await collect(baseRequest("I make $2,000 a month, do I qualify?", null));

    // No extraction call — create is reserved for the (unused) retry.
    expect(sdk.create).not.toHaveBeenCalled();
    expect(streamSystemBlocks().some((b) => b.includes("VERIFIED ENGINE COMPUTATION"))).toBe(false);
    expect(outcomes).toEqual(["clean"]);
  });

  it("a failed extraction costs the reader nothing — the answer streams as before", async () => {
    sdk.create.mockRejectedValue(new Error("extraction api down"));
    sdk.stream.mockReturnValue(
      fakeStream(Array(12).fill("General SNAP information without figures. ")),
    );

    const frames = await collect(baseRequest("I make $2,000 a month, do I qualify?", "CA"));

    const text = frames.filter((f) => f.type === "delta").map((f) => f.text).join("");
    expect(text).toContain("General SNAP information");
    expect(outcomes).toEqual(["clean"]);
    expect(streamSystemBlocks().some((b) => b.includes("VERIFIED ENGINE COMPUTATION"))).toBe(false);
  });
});
