// Live answer-faithfulness runner — generates a REAL Mae answer per gold
// question (using the exact production system assembly) and scores it with the
// deterministic scorers. Requires ANTHROPIC_API_KEY, so it is invoked only from
// the key-gated test (skipped in CI without a key) or ad hoc once Mae is
// activated. This is the harness that converts Mae from "principled" to
// "measured" — run it after every prompt/corpus change.
//
// Next layer (not yet wired): an LLM-judge pass for nuanced correctness/
// completeness on top of these deterministic checks.

import Anthropic from "@anthropic-ai/sdk";
import { buildMaeSystem, MAE_GENERATION } from "../answer";
import { ANSWER_GOLD, scoreAnswer, type AnswerScore } from "./answer-eval";

export interface LiveEvalResult extends AnswerScore {
  question: string;
  answer: string;
}

/** Generate + score every gold question. Throws if ANTHROPIC_API_KEY is unset. */
export async function runLiveAnswerEval(): Promise<LiveEvalResult[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("runLiveAnswerEval requires ANTHROPIC_API_KEY");
  }
  const client = new Anthropic();
  const results: LiveEvalResult[] = [];

  for (const g of ANSWER_GOLD) {
    const { systemBlocks, retrievedCitations } = await buildMaeSystem(g.question);
    const msg = await client.messages.create({
      ...MAE_GENERATION,
      max_tokens: 1024,
      system: systemBlocks,
      messages: [{ role: "user", content: g.question }],
    });
    const answer = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    results.push({ question: g.question, answer, ...scoreAnswer(answer, g, retrievedCitations) });
  }
  return results;
}
