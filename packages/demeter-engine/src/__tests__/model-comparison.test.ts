// @vitest-environment node
// Model comparison (#602) — DOUBLE-GATED, and deliberately so.
//
// It needs ANTHROPIC_API_KEY *and* an explicit EVAL_MODELS list. The key alone
// is not enough: the live answer eval already runs on a key, and if this ran
// on the same signal, anyone running the normal suite with a key would silently
// pay for N full gold-set sweeps instead of one.
//
//   ANTHROPIC_API_KEY=... \
//   EVAL_MODELS=claude-sonnet-5,claude-haiku-4-5,claude-opus-4-8 \
//   pnpm vitest run src/__tests__/model-comparison.test.ts
//
// Start with a subset. EVAL_ONLY still applies, so a two-case smoke run proves
// the harness before committing to the full sweep:
//   EVAL_ONLY=<id1>,<id2> EVAL_MODELS=claude-sonnet-5,claude-haiku-4-5 …
//
// This asserts almost nothing about which model wins. It is an INSTRUMENT: it
// prints the numbers that make the pin decision arguable from evidence. The
// only assertion is that every model actually produced a result — a run where
// one model silently returned nothing would otherwise read as a clean sweep.
import { describe, it, expect } from "vitest";
import { runModelComparison, formatComparison } from "../eval/run-model-comparison";

const models = (process.env.EVAL_MODELS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const enabled = !!process.env.ANTHROPIC_API_KEY && models.length > 0;

describe.skipIf(!enabled)("model comparison", { timeout: 3_600_000 }, () => {
  it("scores the gold set once per candidate model", async () => {
    const report = await runModelComparison(models);

    // eslint-disable-next-line no-console
    console.log(formatComparison(report));

    expect(report.scorecards).toHaveLength(models.length);
    for (const s of report.scorecards) {
      // A model that produced zero cases means the run broke, not that it
      // scored perfectly — every share would be 0 and the row would look
      // flawless next to models that actually answered.
      expect(s.cases, `${s.model} produced no results`).toBeGreaterThan(0);
    }
  });
});
