import { describe, it, expect, vi, beforeEach } from "vitest";
// A named type import rather than `typeof import("../retrieval")` inline in the
// annotation below. Same type, but consistent-type-imports forbids the inline
// form, and the named one says which module is being partially mocked at the
// top of the file instead of burying it in a generic argument.
import type * as RetrievalModule from "../retrieval";

// Degrade-path language threading (regression). The degraded answer is the
// verbatim-sources fallback — the LAST honesty backstop after a draft and a
// retry both failed verification. It re-retrieves, and that call used to drop
// `lang`, so a Spanish user got an UNEXPANDED query against an English corpus
// exactly when grounding mattered most. Here the retrieval module is mocked so
// the assertion is on the call itself, not on corpus content.

const retrieveMock = vi.hoisted(() => vi.fn());
const sdk = vi.hoisted(() => ({ stream: vi.fn(), create: vi.fn() }));

vi.mock("../retrieval", async (importOriginal) => {
  const actual = await importOriginal<typeof RetrievalModule>();
  return { ...actual, retrieve: retrieveMock };
});
vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = { stream: sdk.stream, create: sdk.create };
  },
}));

import { answerQuestion } from "../orchestrator";

// A citation no verifier accepts — forces draft AND retry to fail → degrade.
const FABRICATED = "bajo 7 CFR 999.99 sus beneficios se duplican cada mes. ";

function fakeStream(chunks: string[]) {
  const state = { aborted: false };
  return {
    abort: () => {
      state.aborted = true;
    },
    async finalMessage() {
      return { usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: "end_turn" };
    },
    async *[Symbol.asyncIterator]() {
      for (const text of chunks) {
        if (state.aborted) return;
        yield { type: "content_block_delta", delta: { type: "text_delta", text } };
      }
    },
  };
}

async function drain(req: Parameters<typeof answerQuestion>[0]) {
  const outcomes: string[] = [];
  for await (const _ of answerQuestion({
    ...req,
    events: { ...req.events, onVerified: (o) => outcomes.push(o) },
  })) {
    void _;
  }
  return outcomes;
}

describe("degraded answers retrieve in the user's language", () => {
  beforeEach(() => {
    retrieveMock.mockReset().mockResolvedValue([]);
    sdk.stream.mockReset().mockReturnValue(fakeStream(Array(12).fill(FABRICATED)));
    sdk.create.mockReset().mockResolvedValue({
      content: [{ type: "text", text: FABRICATED }],
      usage: { input_tokens: 10, output_tokens: 10 },
    });
  });

  it("passes lang: es to the fallback retrieve on the degrade path", async () => {
    const outcomes = await drain({
      messages: [{ role: "user", content: "¿Cuánto es el máximo para 4 personas?" }],
      audience: "public",
      state: "CA",
      lang: "es",
      apiKey: "test-key",
      events: { audit: async () => {} },
      meta: { staffUserId: null, mode: "public" },
    });

    expect(outcomes).toEqual(["degraded"]); // we really reached the fallback
    // Every retrieve in an ES request carries lang — grounding AND fallback.
    expect(retrieveMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    for (const [, opts] of retrieveMock.mock.calls) {
      expect(opts).toMatchObject({ state: "CA", lang: "es" });
    }
  });

  it("leaves English requests on the English path", async () => {
    await drain({
      messages: [{ role: "user", content: "What is the max for a family of 4?" }],
      audience: "public",
      state: "CA",
      apiKey: "test-key",
      events: { audit: async () => {} },
      meta: { staffUserId: null, mode: "public" },
    });
    for (const [, opts] of retrieveMock.mock.calls) {
      expect(opts.lang).not.toBe("es");
    }
  });
});
