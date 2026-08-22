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
import { degradeLeads } from "../lang";

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

    // Says what it could not do, hands over to someone who can, AND offers to
    // keep working. Matched as behaviour rather than as a sentence: the copy
    // was rewritten because the old version put the burden back on the reader
    // ("ask me something narrower") and the version after that told them it
    // did not want to repeat itself while repeating itself. What has to stay
    // true is the shape — no number, a real place to go, and a way to continue
    // here.
    expect(text).toMatch(/can'?t|cannot|not going to guess/i);
    expect(text).toMatch(/state agency|SNAP agency|caseworker/i);
    // It must not end the conversation. A refusal that offers nothing next is
    // where people leave.
    expect(text).toMatch(/application|documents|interview/i);
    // And it must not blame the reader or make them manage our failure.
    expect(text).not.toMatch(/ask me something narrower|preguntarme algo más específico/i);

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

  // Regression, 2026-08-16: the retry's own corrective instruction used to be
  // ONE citation-shaped message ("cite only the sources provided") regardless
  // of which gate actually aborted the stream — so a numeric mismatch was
  // told to fix a citation problem it didn't have, got no real information to
  // self-correct with, and reliably reached for the same unverifiable figure
  // again on the retry too. This asserts the retry call actually receives
  // guidance matched to what really failed.
  describe("the retry's corrective instruction is failure-specific", () => {
    function correctiveTextSentToRetry(): string {
      const call = sdk.create.mock.calls[0]?.[0] as
        | { system?: Array<{ text: string }> }
        | undefined;
      const blocks = call?.system ?? [];
      return blocks[blocks.length - 1]?.text ?? "";
    }

    it("a citation-only failure gets citation guidance, not numeric guidance", async () => {
      sdk.stream.mockReturnValue(fakeStream(Array(12).fill(FABRICATED))); // no $ figures at all
      sdk.create.mockResolvedValue({
        content: [{ type: "text", text: "Honest retry: the sources do not cover this." }],
        usage: { input_tokens: 80, output_tokens: 20 },
      });
      await collect(baseRequest(audits, outcomes));

      const corrective = correctiveTextSentToRetry();
      expect(corrective).toContain("cited a source that is not in the provided source text");
      expect(corrective).not.toContain("dollar amount or percentage");
    });

    it("a numeric-only failure gets numeric guidance, not citation guidance", async () => {
      // No citation at all in this text — only an unverifiable dollar figure.
      sdk.stream.mockReturnValue(
        fakeStream(Array(12).fill("The limit is $12,345 a month for everyone. ")),
      );
      sdk.create.mockResolvedValue({
        content: [{ type: "text", text: "The provided sources don't cover that figure." }],
        usage: { input_tokens: 80, output_tokens: 20 },
      });
      await collect(baseRequest(audits, outcomes));

      const corrective = correctiveTextSentToRetry();
      expect(corrective).toContain("dollar amount or percentage");
      expect(corrective).toContain("×4.3");
      expect(corrective).not.toContain("cited a source that is not in the provided source text");
    });
  });

  // Regression, 2026-08-16: a real transcript got the DEGRADE_AGAIN
  // paragraph (already a REWORDED repeat) a second time — three identical-
  // feeling refusals in the same conversation. A bare "has this degraded
  // before?" boolean can only ever pick DEGRADE vs DEGRADE_AGAIN, so a third
  // occurrence got DEGRADE_AGAIN's own text verbatim again.
  it("degrading a THIRD time in one conversation escalates past DEGRADE_AGAIN, not repeats it", async () => {
    // Two prior assistant turns already carrying a real degrade — one from
    // each tier, exactly like a genuine conversation history would.
    const priorDegradeMessages = degradeLeads("en")
      .slice(0, 2)
      .map((lead) => ({ role: "assistant" as const, content: `${lead} (rest of the refusal.)` }));

    sdk.stream.mockReturnValue(fakeStream(Array(12).fill(FABRICATED)));
    sdk.create.mockResolvedValue({
      content: [{ type: "text", text: FABRICATED }], // retry ALSO fails → degrades again
      usage: { input_tokens: 80, output_tokens: 20 },
    });

    const frames = await collect({
      ...baseRequest(audits, outcomes),
      messages: [
        { role: "user", content: "first question" },
        ...priorDegradeMessages,
        { role: "user", content: "I get 150 a day for 4 days a week" },
      ],
    });

    const text = frames.filter((f) => f.type === "delta").map((f) => f.text).join("");
    expect(outcomes).toEqual(["degraded"]);
    // NOT DEGRADE_AGAIN's lead a second time — that's the exact bug.
    expect(text).not.toContain(degradeLeads("en")[1]);
    // The escalation tier's own lead, pointing at the estimate tool instead
    // of repeating a refusal.
    expect(text).toContain(degradeLeads("en")[2]);
    expect(text).toMatch(/build my estimate/i);
  });
});
