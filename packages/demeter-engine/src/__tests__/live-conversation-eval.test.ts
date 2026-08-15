// @vitest-environment node
// Live MULTI-TURN conversational eval — drives the real pipeline through
// whole scripted conversations and checks for the shapes that only show up
// across turns (a model imitating its own trailer, a clarifying question
// repeated verbatim). Requires ANTHROPIC_API_KEY, so it is SKIPPED in CI
// without a key — same convention as live-answer-eval.test.ts. Run after any
// prompt/orchestrator change that could affect multi-turn behavior:
//   ANTHROPIC_API_KEY=... pnpm vitest run src/__tests__/live-conversation-eval.test.ts
//
// This complements, not replaces, live-answer-eval.test.ts: that one scores
// single questions against deterministic checks (citation, disclaimer,
// specific figures); this one runs full conversations and prints the whole
// transcript, because the two automated checks below (duplicate trailer,
// repeated ask) catch only the two SPECIFIC shapes already found and fixed
// — tone, task continuity, and warmth still want a person reading the
// printed report, per this repo's dominant QA lesson.
import { describe, it, expect } from "vitest";
import { runConversations, formatTranscript, CONVERSATION_GOLD } from "../eval/conversation-eval";

const hasKey = !!process.env.ANTHROPIC_API_KEY;

describe.skipIf(!hasKey)("Demeter live multi-turn conversation eval", { timeout: 1_800_000 }, () => {
  it("no conversation shows a duplicated trailer or a verbatim-repeated ask", async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY!;
    const results = await runConversations(CONVERSATION_GOLD, apiKey);

    // eslint-disable-next-line no-console
    console.log(`\n${results.map(formatTranscript).join("\n\n")}`);

    for (const r of results) {
      expect(r.duplicateTrailerTurns, `${r.id}: duplicated trailer apparatus`).toEqual([]);
      expect(r.repeatedAskTurns, `${r.id}: same bolded ask repeated verbatim`).toEqual([]);
    }
  });
});
