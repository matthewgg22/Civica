import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression (live conversational QA, 2026-08-15): the model was seen
// imitating its own PRIOR-turn trailer — a second certainty banner, a
// duplicate "Citation:" checklist, even an invented banner label matching
// NEITHER real verdict ("◑ **HIGH CONFIDENCE**", which certainty.ts never
// emits — only CERTAIN/UNCERTAIN exist) — inside a later answer. Two
// independent live transcripts reproduced this in one QA batch (a
// mixed-status-household scenario's 4th turn, and a medical-resident
// scenario's 5th turn) — not a one-off.
//
// The cause: the pipeline's own appended trailer (banner + citation
// checklist + freshness footer) is exactly what apps/web stores as that
// turn's rendered content, and exactly what gets resent as conversation
// history on every later call (see route.ts / DemeterChat.tsx — the client
// stores and resends `fullRef.current`, delta+trailer both). The model
// seeing its own "past turn" already wearing the house citation-apparatus
// format is what taught it to reproduce that format — a system-prompt
// instruction not to write its own "Citation check" section cannot survive
// its own violation showing up as an example in the transcript.
//
// The client already de-duplicates for DISPLAY (dropDuplicateTrailerLines /
// dropDuplicateFooter in DemeterChat.tsx) — that hides the symptom on
// screen but does nothing about what gets sent back to the model. This spec
// covers the fix at the cause: stripAppendedTrailer removes the trailer from
// ASSISTANT history before it ever reaches the model again.

const sdk = vi.hoisted(() => ({ stream: vi.fn(), create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = { stream: sdk.stream, create: sdk.create };
  },
}));

import { answerQuestion, stripAppendedTrailer } from "../orchestrator";

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

// The exact shape formatCertaintyBanner + formatCitationTrailer +
// formatFreshnessFooter produce together (certainty.ts / citation-verifier.ts
// / freshness.ts) — copied from a real generated trailer, not hand-invented.
const REAL_TRAILER =
  "\n\n---\n✓ **CERTAIN** — Every rule cited here comes from regulation text pulled for your question — check it yourself below.\n" +
  "\n_Check it yourself:_ 7 CFR 273.6\n\n**Citation:**\n" +
  "- ◑ recognized authority, but not in the retrieved text — confirm against source: 7 CFR 273.6\n\n" +
  "*Source: [eCFR 2026-06-02; federal figures FY26 (current through 2026-09-30)](https://www.ecfr.gov/current/title-7/part-273).*";

describe("stripAppendedTrailer", () => {
  it("removes a real pipeline trailer, leaving only the substantive answer", () => {
    const body = "For the kids, HHSC needs proof of identity and citizenship.";
    expect(stripAppendedTrailer(body + REAL_TRAILER)).toBe(body);
  });

  it("removes an invented banner label matching neither real verdict — production saw '◑ **HIGH CONFIDENCE**'", () => {
    const body = "Free meals your employer gives you in-kind don't count as income.";
    const invented =
      body +
      "\n\n---\n◑ **HIGH CONFIDENCE** — This matches well-established SNAP rules.\n\n" +
      "_Check it yourself:_ 7 CFR 273.9(c)";
    expect(stripAppendedTrailer(invented)).toBe(body);
  });

  it("removes a stray inline source line the model wrote mid-answer, not only a trailing block", () => {
    const body = "Bring at least a month or two of earnings summaries.";
    const withInlineSource =
      body +
      "\n\n*Source: [7 CFR 273.10(c)(3), eCFR 2026-06-02](https://www.ecfr.gov/current/title-7/section-273.10).*";
    expect(stripAppendedTrailer(withInlineSource)).toBe(body);
  });

  it("leaves ordinary answer text with no trailer untouched", () => {
    const body = "SNAP counts gross income, before taxes and deductions.";
    expect(stripAppendedTrailer(body)).toBe(body);
  });

  it("never returns empty — a message that is somehow ALL trailer keeps its original text rather than going empty into the API", () => {
    const allTrailer = REAL_TRAILER.trim();
    expect(stripAppendedTrailer(allTrailer)).toBe(allTrailer);
  });
});

describe("answerQuestion — assistant history sent upstream never carries the trailer", () => {
  beforeEach(() => {
    sdk.stream.mockReset();
    sdk.create.mockReset();
  });

  it("strips a prior assistant turn's trailer before it reaches the model", async () => {
    sdk.stream.mockReturnValue(
      fakeStream(Array(12).fill("Household size depends on who buys and cooks together. ")),
    );
    const priorAnswer = "You should not be asked for your own SSN." + REAL_TRAILER;

    const req = {
      messages: [
        { role: "user" as const, content: "What documents do the kids need?" },
        { role: "assistant" as const, content: priorAnswer },
        { role: "user" as const, content: "And what about my husband and me?" },
      ],
      audience: "public" as const,
      state: null,
      apiKey: "test-key",
      meta: { staffUserId: null, mode: "public" as const },
    };
    for await (const _f of answerQuestion(req)) {
      /* drain */
    }

    expect(sdk.stream).toHaveBeenCalledTimes(1);
    const sentMessages = sdk.stream.mock.calls[0]![0].messages as Array<{
      role: string;
      content: string;
    }>;
    const sentAssistantTurn = sentMessages.find((m) => m.role === "assistant")!;
    expect(sentAssistantTurn.content).not.toMatch(/CERTAIN|Citation:|Check it yourself|Source:/);
    expect(sentAssistantTurn.content).toContain("You should not be asked for your own SSN.");
  });
});
