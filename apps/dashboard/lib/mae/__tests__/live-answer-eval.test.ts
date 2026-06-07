// @vitest-environment node
// Live answer eval — generates REAL Mae answers and scores them. Requires
// ANTHROPIC_API_KEY (real generation + the embedding model), so it is SKIPPED in
// CI without a key. Run it after activation and after any prompt/corpus change:
//   ANTHROPIC_API_KEY=... pnpm vitest run lib/mae/__tests__/live-answer-eval.test.ts
import { describe, it, expect } from "vitest";
import { runLiveAnswerEval } from "../eval/run-live-answer-eval";

const hasKey = !!process.env.ANTHROPIC_API_KEY;

describe.skipIf(!hasKey)("Mae live answer faithfulness", { timeout: 180_000 }, () => {
  it("every gold answer passes the deterministic faithfulness checks", async () => {
    const results = await runLiveAnswerEval();
    for (const r of results) {
      expect(r.pass, `${r.id}: ${JSON.stringify(r.checks)}\n${r.answer}`).toBe(true);
    }
  });
});
