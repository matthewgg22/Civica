// Model comparison over the gold answer set (#602).
//
// The question this exists to settle: Demeter's answers are checked
// MECHANICALLY before a reader sees them — citation verifier, numeric
// equivalence gate, certainty verdict — so a weaker model should fail by
// tripping those gates rather than by shipping a confident wrong answer. If
// that holds, a cheaper model is a cost decision. If it doesn't, it isn't.
//
// The metric that decides it is NOT the pass rate alone. A model can post a
// respectable pass rate while quietly answering "we can't be certain" to
// everything: every gate green, nothing wrong, and a product that has stopped
// being useful. So `uncertainShare` and `degradedShare` are reported beside
// `passRate`, and a comparison that ignores them is misread.
//
// COST. Each model runs the FULL gold set through the real pipeline, retries
// included — one sweep of three models is three times the spend of a normal
// eval run. Nothing here runs unless a model list is passed explicitly; there
// is no default fan-out, and EVAL_ONLY still subsets the cases for a cheap
// smoke run first.

import { runLiveAnswerEval, type LiveEvalResult } from "./run-live-answer-eval";

export interface ModelScorecard {
  model: string;
  cases: number;
  /** Cases passing every deterministic check (degraded counts as a fail). */
  passRate: number;
  /** Share with no unrecognized citation — the fabrication check. */
  citationsFaithfulRate: number;
  /** Share the READER would have seen marked uncertain. HIGH IS BAD even when
   *  passRate looks fine: this is the "safe but useless" failure, and it is the
   *  single number most likely to separate a usable cheap model from one that
   *  hedges. Read it before the pass rate. */
  uncertainShare: number;
  /** Share whose first draft failed citation checks and was regenerated. Not a
   *  failure — the machinery working — but a rising rate is the earliest sign
   *  a model is struggling to stay inside the grounding. */
  recomposedShare: number;
  /** Share that fell all the way back to the honest degraded answer. */
  degradedShare: number;
  failedCaseIds: string[];
}

export interface ComparisonReport {
  scorecards: ModelScorecard[];
  /** Every raw result, so a surprising rate can be traced to its answers
   *  rather than taken on faith. */
  results: LiveEvalResult[];
}

function scorecard(model: string, rs: LiveEvalResult[]): ModelScorecard {
  const n = rs.length;
  const share = (k: number) => (n === 0 ? 0 : k / n);
  return {
    model,
    cases: n,
    passRate: share(rs.filter((r) => r.pass).length),
    // `citationsFaithful` is the one check the scorer sets unconditionally on
    // every case (answer-eval.ts); the rest are gated on per-case expectations.
    citationsFaithfulRate: share(rs.filter((r) => r.checks.citationsFaithful).length),
    // Certainty is the reader-facing verdict, NOT a verifier outcome — the
    // ladder only emits clean/recomposed/degraded. Conflating the two would
    // silently report 0% uncertain forever, which is why this reads the
    // captured verdict instead.
    uncertainShare: share(rs.filter((r) => r.certainty === "uncertain").length),
    recomposedShare: share(rs.filter((r) => r.verifierOutcome === "recomposed").length),
    degradedShare: share(rs.filter((r) => r.verifierOutcome === "degraded").length),
    failedCaseIds: rs.filter((r) => !r.pass).map((r) => r.id),
  };
}

/**
 * Run the gold set once per model and return a scorecard for each.
 *
 * Sequential on purpose: these are long, retry-heavy runs against a rate-limited
 * key, and interleaving them would turn a 429 on one model into a phantom
 * quality difference between models.
 */
export async function runModelComparison(models: string[]): Promise<ComparisonReport> {
  if (!models.length) {
    throw new Error(
      "runModelComparison needs an explicit model list — refusing to guess and spend.",
    );
  }
  const deduped = [...new Set(models)];
  if (deduped.length !== models.length) {
    // Running the same model twice and reporting it as two columns would look
    // like reproducibility evidence while measuring nothing.
    throw new Error(`Duplicate models in comparison list: ${models.join(", ")}`);
  }

  const results: LiveEvalResult[] = [];
  const scorecards: ModelScorecard[] = [];
  for (const model of deduped) {
    const rs = await runLiveAnswerEval({ model });
    results.push(...rs);
    scorecards.push(scorecard(model, rs));
  }
  return { scorecards, results };
}

/**
 * The per-case detail the aggregate table throws away (#685).
 *
 * The first sweep printed rates only, which was enough to choose a model and
 * useless for the obvious follow-up: WHY is a quarter of the gold set marked
 * uncertain? `certainty_code` already carries that answer per case; it was just
 * never surfaced. Grouping by it turns "24% uncertain" into a ranked list of
 * causes, which is the difference between a number and a work item.
 *
 * Costs nothing — it reads results already in memory. Not printing it meant
 * paying for a full sweep again to recover data the first run had.
 */
export function formatDiagnostics(report: ComparisonReport): string {
  const out: string[] = [];
  for (const s of report.scorecards) {
    const rs = report.results.filter((r) => r.model === s.model);
    const uncertain = rs.filter((r) => r.certainty === "uncertain");
    const byCode = new Map<string, string[]>();
    for (const r of uncertain) {
      const code = r.certaintyCode ?? "(no code)";
      byCode.set(code, [...(byCode.get(code) ?? []), r.id]);
    }
    out.push(`  ${s.model} — why answers were uncertain (${uncertain.length}/${rs.length}):`);
    if (byCode.size === 0) out.push("    (none)");
    for (const [code, ids] of [...byCode].sort((a, b) => b[1].length - a[1].length)) {
      out.push(`    ${String(ids.length).padStart(3)}  ${code}`);
      out.push(`         ${ids.join(", ")}`);
    }
    if (s.failedCaseIds.length) {
      out.push(`    failed checks: ${s.failedCaseIds.join(", ")}`);
    }
    out.push("");
  }
  return out.join("\n");
}

/** Fixed-width report. Printed by the key-gated test so an ad-hoc run shows
 *  numbers rather than a green bar. */
export function formatComparison(report: ComparisonReport): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`.padStart(7);
  const rows = report.scorecards.map(
    (s) =>
      `  ${s.model.padEnd(22)} ${pct(s.passRate)}  ${pct(s.citationsFaithfulRate)}  ` +
      `${pct(s.uncertainShare)}  ${pct(s.recomposedShare)}  ${pct(s.degradedShare)}   ${s.cases}`,
  );
  return [
    "",
    "  MODEL COMPARISON — gold answer set",
    `  ${"model".padEnd(22)} ${"pass".padStart(7)}  ${"cites".padStart(7)}  ` +
      `${"uncert".padStart(7)}  ${"recomp".padStart(7)}  ${"degrad".padStart(7)}   cases`,
    ...rows,
    "",
    "  A high pass rate next to a high uncertain share is not a win — it is a",
    "  model hedging its way through the gates. Read both columns.",
    "",
    formatDiagnostics(report),
  ].join("\n");
}
