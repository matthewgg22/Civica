// @vitest-environment node
// Retrieval recall over the gold set (#685). NO API KEY NEEDED and no model
// call — retrieval is local and deterministic, so this runs in CI and on every
// corpus/chunking change.
//
// It asserts a FLOOR, not perfection. The point is to make a regression
// visible: if a chunking change or corpus edit drops recall, the number moves
// and someone has to look. Raise the floor as recall improves; never lower it
// to make a red run green.
import { describe, it, expect } from "vitest";
import { runRetrievalRecall, formatRecall } from "../eval/retrieval-recall";

describe("retrieval recall over the gold set", { timeout: 300_000 }, () => {
  it("surfaces the expected authority for most gold questions", async () => {
    const report = await runRetrievalRecall();

    // eslint-disable-next-line no-console
    console.log(formatRecall(report));

    // A run that scored nothing would otherwise pass silently at 0/0.
    expect(report.scored, "no gold case carried an expectCitation").toBeGreaterThan(0);

    // 100% as of 2026-08-10, after the gap-tolerant glossary fix (#685).
    // Asserting the full bar rather than a slack floor is deliberate at this
    // size: with only a handful of scoreable cases, a floor of 0.8 would let a
    // real regression through unnoticed. If a newly-added gold case fails here,
    // that is a conversation worth having — fix the retrieval or triage the
    // case explicitly. Do NOT lower this number to make a red run green.
    expect(report.recall, `misses: ${report.misses.map((m) => m.id).join(", ")}`).toBe(1);
  });
});
