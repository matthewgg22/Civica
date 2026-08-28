import { describe, it, expect, vi, beforeEach } from "vitest";

// Crisis safety net (launch audit 2026-08-28). The crisis addendum only ASKS
// the model to surface 988 / the DV hotline; this proves the orchestrator makes
// it a guarantee. Only the Anthropic SDK is mocked — the crisis gate, streaming,
// and trailer run real — so these assert the end-to-end contract:
//   crisis message + model omits the number  → deterministic net appended
//   crisis message + model includes it       → NOT duplicated
//   non-crisis message                        → never appended
//
// The whole point is the asymmetry crisis.ts is built on: a person in a
// self-harm crisis must not be answered with paperwork alone, even if the model
// silently drops the resource.

const sdk = vi.hoisted(() => ({ stream: vi.fn(), create: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = { stream: sdk.stream, create: sdk.create };
  },
}));

import { answerQuestion, type AnswerFrame } from "../orchestrator";
import type { AnswerLang } from "../lang";

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

async function answerText(userMessage: string, streamChunks: string[], lang: AnswerLang = "en"): Promise<string> {
  sdk.stream.mockReturnValue(fakeStream(streamChunks));
  const frames: AnswerFrame[] = [];
  for await (const f of answerQuestion({
    messages: [{ role: "user", content: userMessage }],
    audience: "public",
    state: null, // federal floor — no pack dependency
    apiKey: "test-key",
    lang,
    meta: { staffUserId: null, mode: "public", scopeRef: "SPEC" },
  })) {
    frames.push(f);
  }
  // Delta frames are the answer body; the trailer is separate furniture.
  return frames.filter((f) => f.type === "delta").map((f) => (f as { text: string }).text).join("");
}

// A benefits answer with NO crisis resource in it — the model "not complying".
const NO_RESOURCE = Array(6).fill("SNAP can help with groceries; here is how eligibility works. ");

describe("crisis safety net", () => {
  beforeEach(() => {
    sdk.stream.mockReset();
    sdk.create.mockReset();
  });

  it("appends the 988 line when a self-harm message gets an answer without it", async () => {
    const text = await answerText("I don't want to be here anymore, I want to die", NO_RESOURCE);
    expect(text).toContain("988");
    expect(text).toMatch(/Suicide & Crisis Lifeline/i);
  });

  it("does NOT duplicate 988 when the model already included it", async () => {
    const withNumber = [...NO_RESOURCE, "If you're struggling, call or text 988 anytime. "];
    const text = await answerText("I want to die", withNumber);
    // Exactly one 988 — the model's; the net recognized it and stayed silent.
    expect((text.match(/988/g) ?? []).length).toBe(1);
  });

  it("appends the DV hotline when an abuse message gets an answer without it", async () => {
    const text = await answerText("my husband hits me and I'm scared to go home", NO_RESOURCE);
    expect(text).toContain("1-800-799-7233");
    expect(text).toContain("88788");
  });

  it("localizes the net to the answer language", async () => {
    const text = await answerText("quiero morir", NO_RESOURCE, "es");
    expect(text).toContain("988");
    expect(text).toMatch(/no estás solo/i); // Spanish net, not the English one
  });

  it("never appends a net to an ordinary, non-crisis question", async () => {
    const text = await answerText("What is the gross income limit for a household of three?", NO_RESOURCE);
    expect(text).not.toContain("988");
    expect(text).not.toContain("799-7233");
  });
});
