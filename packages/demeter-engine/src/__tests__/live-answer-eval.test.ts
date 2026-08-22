// @vitest-environment node
// Live answer eval — generates REAL Mae answers and scores them. Requires
// ANTHROPIC_API_KEY (real generation + the embedding model), so it is SKIPPED in
// CI without a key. Run it after activation and after any prompt/corpus change:
//   ANTHROPIC_API_KEY=... pnpm vitest run lib/mae/__tests__/live-answer-eval.test.ts
import { describe, it, expect } from "vitest";
import { runLiveAnswerEval } from "../eval/run-live-answer-eval";

const hasKey = !!process.env.ANTHROPIC_API_KEY;

// 25 gold cases (EN + ES + distress) through the full pipeline, retries
// included — budget generously.
describe.skipIf(!hasKey)("Demeter live answer faithfulness", { timeout: 1_500_000 }, () => {
  it("every gold answer passes the deterministic faithfulness checks", async () => {
    const results = await runLiveAnswerEval();

    // Print a readable report so an ad-hoc run (pnpm mae:eval) shows results,
    // not just a green/red bar.
    const passed = results.filter((r) => r.pass).length;
    const report = results
      .map((r) => {
        const failed = Object.entries(r.checks)
          .filter(([, ok]) => !ok)
          .map(([k]) => k);
        const flag = r.pass ? "✓" : `✗ ${failed.join(",")}`;
        return `  ${flag}  ${r.id}: ${r.answer.replace(/\s+/g, " ").slice(0, 120)}…`;
      })
      .join("\n");
    // eslint-disable-next-line no-console
    console.log(`\nMAE LIVE ANSWER EVAL — ${passed}/${results.length} passed\n${report}`);

    for (const r of results) {
      expect(r.pass, `${r.id}: ${JSON.stringify(r.checks)}\n${r.answer}`).toBe(true);
    }
  });
});
