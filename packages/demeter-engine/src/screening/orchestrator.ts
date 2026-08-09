// screenHousehold() — one turn of the CBO screening tool (frames 03-05 of the
// design mockup). Sibling to answerQuestion(), not a replacement: the public
// chat stays open Q&A with no accounts; this is the accounts-gated path.
//
// Per turn:
//   1. extract what the LATEST message stated (facts-extraction.ts)
//   2. merge onto the accumulated household facts (mergeFactsPatch)
//   3. classify: not-enough-info / needs-review / one of the four verdict
//      outcomes (classify.ts, which calls the REAL snap-rules engine)
//
// No streaming, no incremental citation verification — those exist to keep
// a public LLM answer honest sentence-by-sentence. This is a different
// shape: bounded tool-call extraction feeding a deterministic engine, so the
// number on screen is never an LLM's arithmetic, only its listening.

import { extractFacts, mergeFactsPatch, type PartialFacts } from "./facts-extraction";
import { classifyScreening, type ScreeningClassification } from "./classify";

export interface ScreeningTurnRequest {
  /** Full conversation so far, INCLUDING the new user turn last. */
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  /** Facts accumulated from all prior turns in this case. */
  facts: PartialFacts;
  state: string;
  apiKey: string;
  signal?: AbortSignal;
  asOf?: Date;
}

export interface ScreeningTurnResult {
  /** Facts after merging what this turn added. Persist this for the next turn. */
  facts: PartialFacts;
  /** True when the extractor found nothing new — the turn was a question,
   *  not a stated fact. Callers may still want to answer it (open Q&A path)
   *  rather than only updating the worksheet. */
  extractedNothing: boolean;
  classification: ScreeningClassification;
  usage: { inputTokens: number; outputTokens: number };
}

export async function screenHousehold(req: ScreeningTurnRequest): Promise<ScreeningTurnResult> {
  const asOf = req.asOf ?? new Date();

  const extraction = await extractFacts(req.messages, req.apiKey, req.signal);
  const facts = extraction.empty ? req.facts : mergeFactsPatch(req.facts, extraction.patch);

  const classification = classifyScreening(facts, req.state, asOf);

  return {
    facts,
    extractedNothing: extraction.empty,
    classification,
    usage: extraction.usage,
  };
}
