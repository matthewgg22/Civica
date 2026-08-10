// Live answer-faithfulness runner — drives the REAL production pipeline
// (answerQuestion: PII → state-threaded grounding → incremental verification →
// retry → degrade → trailer) for every gold case, then applies the
// deterministic scorers. Requires ANTHROPIC_API_KEY, so it is invoked only
// from the key-gated test (skipped in CI without a key) or ad hoc. This is the
// harness that converts Demeter from "principled" to "measured" — run it after
// every prompt/corpus change.
//
// A degraded outcome counts as a FAIL (the 97% metric's definition), enforced
// via the notDegraded check on every case.
//
// Next layer (not yet wired): an LLM-judge pass for nuanced correctness/
// completeness on top of these deterministic checks.

import { answerQuestion } from "../orchestrator";
import { buildMaeSystem, MAE_GENERATION } from "../answer";
import { ALL_GOLD, scoreAnswer, type AnswerScore } from "./answer-eval";

export interface LiveEvalResult extends AnswerScore {
  question: string;
  answer: string;
  verifierOutcome: string;
  /** The verdict the READER would have seen ("certain" / "uncertain"), lifted
   *  off the audit record. Undefined only if the pipeline emitted no record. */
  certainty: string | undefined;
  /** WHY that verdict — e.g. "authority_not_retrieved", "grounded". This is the
   *  field that turns an uncertain RATE into a ranked list of causes (#685). */
  certaintyCode: string | undefined;
  /** Which model generated this answer — needed once results from several
   *  models land in one report. */
  model: string;
}

export interface LiveEvalOptions {
  /** Generate with this model instead of the pin (#602 comparison runs).
   *  Omit for the normal case: score the model production actually uses. */
  model?: string;
}

/** Generate + score every gold question. Throws if ANTHROPIC_API_KEY is unset. */
export async function runLiveAnswerEval(opts: LiveEvalOptions = {}): Promise<LiveEvalResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("runLiveAnswerEval requires ANTHROPIC_API_KEY");
  }
  const results: LiveEvalResult[] = [];

  // EVAL_ONLY="id1,id2" reruns a subset — for iterating on a fix without
  // paying for the full gold set.
  const only = process.env.EVAL_ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
  if (only?.length) {
    // A typo'd id would otherwise filter to zero cases and the suite would
    // pass VACUOUSLY (no cases → no assertions → green). Fail loudly instead.
    const unknown = only.filter((id) => !ALL_GOLD.some((g) => g.id === id));
    if (unknown.length) {
      throw new Error(
        `EVAL_ONLY names unknown case id(s): ${unknown.join(", ")}. Known ids: ${ALL_GOLD.map((g) => g.id).join(", ")}`,
      );
    }
  }
  const cases = only?.length ? ALL_GOLD.filter((g) => only.includes(g.id)) : ALL_GOLD;
  if (!cases.length) throw new Error("No eval cases selected — refusing to pass vacuously.");

  for (const g of cases) {
    // The scorers verify citations against what retrieval ACTUALLY surfaced
    // for this question — same grounding call the pipeline makes.
    // Gold cases were authored against the staff persona; the audience the
    // suite runs as is a separate question worth revisiting now that public
    // is Demeter's primary surface, but that's an eval-content decision, not
    // this fix's — pinning "staff" here preserves the existing gold answers'
    // grounding rather than silently changing what they're scored against.
    const audience = "staff" as const;
    const { retrievedCitations } = await buildMaeSystem(
      g.question,
      audience,
      g.state === undefined ? undefined : g.state,
      g.lang ?? "en",
    );

    let answer = "";
    let outcome = "clean";
    // The certainty verdict is already computed by the pipeline and attached to
    // the audit record; the eval used to throw that record away. Capturing it
    // costs nothing and is the metric that distinguishes a model which answers
    // well from one that hedges its way through the gates.
    let certainty: string | undefined;
    let certaintyCode: string | undefined;
    const request: Parameters<typeof answerQuestion>[0] = {
      messages: [{ role: "user", content: g.question }],
      audience,
      apiKey,
      events: {
        onVerified: (o) => (outcome = o),
        audit: async (rec) => {
          certainty = rec.certainty;
          certaintyCode = rec.certaintyCode;
        },
      },
      meta: { staffUserId: null, mode: "eval" },
      ...(opts.model ? { modelOverride: opts.model } : {}),
      ...(g.state === undefined ? {} : { state: g.state }),
      ...(g.lang ? { lang: g.lang } : {}),
    };
    for await (const frame of answerQuestion(request)) {
      // Deltas only — the trailer's own citation lines would double-count.
      if (frame.type === "delta") answer += frame.text;
    }

    const score = scoreAnswer(answer, g, retrievedCitations);
    score.checks.notDegraded = outcome !== "degraded";
    score.pass = Object.values(score.checks).every(Boolean);
    results.push({
      question: g.question,
      answer,
      verifierOutcome: outcome,
      certainty,
      certaintyCode,
      model: opts.model ?? MAE_GENERATION.model,
      ...score,
    });
  }
  return results;
}
