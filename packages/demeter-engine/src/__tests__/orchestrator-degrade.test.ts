import { describe, it, expect, vi, beforeEach } from "vitest";

// Verifier-degrade spec (T12 / T-A + F2-eng): only the Anthropic SDK is mocked —
// retrieval, verification, trailer, and audit run REAL. The contract under
// test is the honesty ladder:
//   clean stream            → incremental deltas, outcome "clean"
//   bad cite, retry clean   → recompose frame, retry text, outcome "recomposed"
//   bad cite twice          → degrade to verbatim sources, outcome "degraded"
// Degraded counts as a FAIL for the 97% metric — the audit record must say so.

const sdk = vi.hoisted(() => ({
  stream: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = { stream: sdk.stream, create: sdk.create };
  },
}));

import { answerQuestion, type AnswerFrame } from "../orchestrator";
import type { MaeAuditRecord } from "../audit";

// A fabricated authority no verifier pass will accept.
const FABRICATED = "under 7 CFR 999.99 your benefits double every month. ";
// Clean text: no citations at all → nothing to flag.
const CLEAN = "SNAP is the federal nutrition assistance program. ";

function fakeStream(chunks: string[], stopReason = "end_turn") {
  const state = { aborted: false };
  return {
    abort: () => {
      state.aborted = true;
    },
    async finalMessage() {
      return { usage: { input_tokens: 100, output_tokens: 50 }, stop_reason: stopReason };
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

function baseRequest(audits: MaeAuditRecord[], outcomes: string[]) {
  return {
    messages: [{ role: "user" as const, content: "What is SNAP?" }],
    audience: "public" as const,
    state: null, // federal floor
    apiKey: "test-key",
    events: {
      audit: async (r: MaeAuditRecord) => {
        audits.push(r);
      },
      onVerified: (o: string) => {
        outcomes.push(o);
      },
    },
    meta: { staffUserId: null, mode: "public" as const, scopeRef: "SPEC" },
  };
}

describe("answerQuestion verifier ladder", () => {
  const audits: MaeAuditRecord[] = [];
  const outcomes: string[] = [];

  beforeEach(() => {
    audits.length = 0;
    outcomes.length = 0;
    sdk.stream.mockReset();
    sdk.create.mockReset();
  });

  it("clean stream releases checkpointed deltas and audits outcome clean", async () => {
    // >350 chars so at least one incremental checkpoint fires mid-stream.
    sdk.stream.mockReturnValue(fakeStream(Array(12).fill(CLEAN)));
    const frames = await collect(baseRequest(audits, outcomes));

    expect(frames.filter((f) => f.type === "recompose")).toHaveLength(0);
    const text = frames.filter((f) => f.type === "delta").map((f) => f.text).join("");
    expect(text).toContain("federal nutrition assistance");
    expect(outcomes).toEqual(["clean"]);
    expect(audits[0]!.verifierOutcome).toBe("clean");
    expect(audits[0]!.scopeRef).toBe("SPEC");
  });

  it("fabricated citation aborts BEFORE any tainted text is released, then a clean retry recomposes", async () => {
    sdk.stream.mockReturnValue(fakeStream(Array(12).fill(FABRICATED)));
    sdk.create.mockResolvedValue({
      content: [{ type: "text", text: "Honest retry: the sources do not cover this." }],
      usage: { input_tokens: 80, output_tokens: 20 },
    });
    const frames = await collect(baseRequest(audits, outcomes));

    const kinds = frames.map((f) => f.type);
    // Nothing leaked ahead of the recompose marker.
    expect(kinds.indexOf("recompose")).toBe(0);
    const text = frames.filter((f) => f.type === "delta").map((f) => f.text).join("");
    expect(text).not.toContain("999.99");
    expect(text).toContain("Honest retry");
    expect(outcomes).toEqual(["recomposed"]);
  });

  it("fabricated citation twice degrades to an honest refusal, not a source dump", async () => {
    // This asserted `toContain("verbatim source text")` — the old fallback
    // pasted the whole retrieved block. In production that meant someone who
    // typed "four people, $4k, Boston" received several hundred words of
    // 7 CFR 273.8 on vehicle resource exclusions under an internal-sounding
    // apology. Refusing to guess was right; that was not how to say so.
    sdk.stream.mockReturnValue(fakeStream(Array(12).fill(FABRICATED)));
    sdk.create.mockResolvedValue({
      content: [{ type: "text", text: FABRICATED }],
      usage: { input_tokens: 80, output_tokens: 20 },
    });
    const frames = await collect(baseRequest(audits, outcomes));

    const text = frames.filter((f) => f.type === "delta").map((f) => f.text).join("");

    // Still refuses the unverifiable claim — the guardrail is the point.
    expect(text).not.toContain("benefits double");
    expect(outcomes).toEqual(["degraded"]);
    expect(audits[0]!.verifierOutcome).toBe("degraded");

    // Says what it could not do, and hands over.
    expect(text).toMatch(/could not check this one/i);
    expect(text).toMatch(/state SNAP agency/i);

    // NO raw regulation, and NO invented figure — a static fallback cannot know
    // the household size or the state, so any number here would be exactly the
    // fabrication the gate just prevented.
    expect(text).not.toContain("verbatim source text");
    expect(text).not.toMatch(/§|eCFR, eff\./);
    expect(text).not.toMatch(/\$\s?\d/);
    // Short enough to read. The dump ran to several hundred words.
    expect(text.split(/\s+/).length).toBeLessThan(120);
  });

  it("Spanish answers may echo the USER'S own numbers without tripping the gate", async () => {
    // "$1,500" appears only in the question — repeating it is not invention.
    sdk.stream.mockReturnValue(
      fakeStream(Array(12).fill("Con ingresos de $1,500 al mes, depende del tamaño del hogar. ")),
    );
    const frames = await collect({
      ...baseRequest(audits, outcomes),
      messages: [{ role: "user" as const, content: "Gano $1,500 al mes — ¿califico?" }],
      lang: "es" as const,
    });

    expect(frames.map((f) => f.type)).not.toContain("recompose");
    expect(outcomes).toEqual(["clean"]);
  });

  it("Spanish answers with numbers absent from the grounding also trip the ladder", async () => {
    // "$12,345" appears in no retrieved source — the ES numeric gate must abort.
    sdk.stream.mockReturnValue(
      fakeStream(Array(12).fill("El límite es $12,345 cada mes para todos. ")),
    );
    sdk.create.mockResolvedValue({
      content: [{ type: "text", text: "Las fuentes provistas no cubren esa cifra." }],
      usage: { input_tokens: 80, output_tokens: 20 },
    });
    const frames = await collect({ ...baseRequest(audits, outcomes), lang: "es" as const });

    expect(frames.map((f) => f.type)).toContain("recompose");
    const text = frames.filter((f) => f.type === "delta").map((f) => f.text).join("");
    expect(text).not.toContain("$12,345");
    expect(outcomes).toEqual(["recomposed"]);
  });

  // The gap this session's advisor review found: citation verification only
  // confirms a CITED SECTION was retrieved, not that a dollar figure sitting
  // next to it is real. This gate used to be Spanish-only; these two mirror
  // the Spanish pair above for English — the majority-language, default
  // surface — to prove numbersOk is no longer gated by req.lang.
  it("English answers may echo the USER'S own numbers without tripping the gate", async () => {
    // "$1,500" appears only in the question — repeating it is not invention.
    sdk.stream.mockReturnValue(
      fakeStream(Array(12).fill("With $1,500 a month in income, it depends on household size. ")),
    );
    const frames = await collect({
      ...baseRequest(audits, outcomes),
      messages: [{ role: "user" as const, content: "I make $1,500 a month — do I qualify?" }],
    });

    expect(frames.map((f) => f.type)).not.toContain("recompose");
    expect(outcomes).toEqual(["clean"]);
  });

  it("English answers with numbers absent from the grounding also trip the ladder", async () => {
    // "$12,345" appears in no retrieved source — the (now-unconditional)
    // numeric gate must abort even though nothing about the citation is wrong.
    sdk.stream.mockReturnValue(
      fakeStream(Array(12).fill("The limit is $12,345 a month for everyone. ")),
    );
    sdk.create.mockResolvedValue({
      content: [{ type: "text", text: "The provided sources don't cover that figure." }],
      usage: { input_tokens: 80, output_tokens: 20 },
    });
    const frames = await collect(baseRequest(audits, outcomes));

    expect(frames.map((f) => f.type)).toContain("recompose");
    const text = frames.filter((f) => f.type === "delta").map((f) => f.text).join("");
    expect(text).not.toContain("$12,345");
    expect(outcomes).toEqual(["recomposed"]);
  });
});
