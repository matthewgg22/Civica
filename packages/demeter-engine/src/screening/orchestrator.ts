// screenHousehold() — one turn of the CBO screening tool (frames 03-05 of the
// design mockup). Sibling to answerQuestion(), not a replacement: the public
// chat stays open Q&A with no accounts; this is the accounts-gated path.
//
// Per turn:
//   1. re-extract what the USER has stated across the whole visible
//      conversation (facts-extraction.ts, scope "conversation")
//   2. overlay onto the accumulated facts: fresh arrays REPLACE, silent
//      fields survive (overlayFactsSnapshot below)
//   3. classify: not-enough-info / needs-review / one of the four verdict
//      outcomes (classify.ts, which calls the REAL snap-rules engine)
//
// No streaming, no incremental citation verification — those exist to keep
// a public LLM answer honest sentence-by-sentence. This is a different
// shape: bounded tool-call extraction feeding a deterministic engine, so the
// number on screen is never an LLM's arithmetic, only its listening.
//
// WHY WHOLE-CONVERSATION RE-EXTRACTION, NOT PER-TURN MERGE (#898 P0-1): the
// original design extracted only the latest turn and merged household
// members by member_id — but member_id is a slug the model re-invents on
// every independent call, so the same son arrived as "child_1", then "son",
// then "student" across a real 25-turn conversation, and the household
// silently inflated to FIVE members (the rail showed a $1,100 estimate
// computed with the HH-5 standard deduction and max allotment). Income lines
// APPENDED on re-statement the same way. One extraction call that re-reads
// everything visible produces one consistent set of ids per call, making
// cross-call id drift structurally impossible.

import { extractFacts, type PartialFacts } from "./facts-extraction";
import { classifyScreening, type ScreeningClassification } from "./classify";

/** Overlay a fresh whole-conversation extraction onto the accumulated facts.
 *
 *  The drift-prone ARRAYS (household, income) are replaced wholesale
 *  whenever the fresh pass provides them — it re-read everything visible, so
 *  what it returns IS the current state of those lists, and merging would
 *  reintroduce exactly the duplicate-id inflation this exists to fix. Fields
 *  the fresh pass is silent on survive from the accumulated copy: the client
 *  windows the conversation it sends, so a fact stated eleven turns ago may
 *  no longer be visible to the extractor while still being true — the
 *  client-held facts are how it survives. */
export function overlayFactsSnapshot(
  base: PartialFacts,
  fresh: PartialFacts,
  /** True when the extraction read the WHOLE conversation, not a tail window.
   *
   *  THE BUG THIS EXISTS FOR (#966). `fresh.household ?? base.household` falls
   *  through only on null/undefined, and an empty array is neither — so a pass
   *  returning `household: []` OVERWROTE a known household rather than leaving
   *  it alone. The extraction tool's own instruction sanctions returning empty
   *  arrays ("if the message stated nothing new, call this with empty
   *  arrays/omitted fields"), and `extraction.empty` does not catch it: a patch
   *  carrying any other fact is not empty, so the overlay ran and wiped both
   *  arrays. Measured: a household of two and $1,500 of income both became [].
   *
   *  Household size sets every threshold in the calculation, so this changed
   *  the estimate silently, in any conversation long enough for the early
   *  turns to fall outside the client's 20-message window.
   *
   *  WHY A FLAG AND NOT "IGNORE EMPTY ARRAYS": an empty array is genuinely
   *  ambiguous. Over a truncated window it means "not mentioned in what I
   *  read". Over the whole conversation it means "they told me they have
   *  none" — which is load-bearing, and the reason a household with no income
   *  lands at the maximum allotment. Only the caller knows which, so only the
   *  caller can say. Default false: the safe reading. */
  windowComplete = false,
): PartialFacts {
  const out: PartialFacts = {};
  /** An empty fresh array is authoritative only over a complete window. */
  const take = <T>(f: T[] | undefined, b: T[] | undefined): T[] | undefined => {
    if (f === undefined) return b;
    if (f.length > 0) return f;
    if (windowComplete) return f;      // "they have none" — recordable
    return b ?? f;                     // "not mentioned here" — keep what we knew
  };
  const household = take(fresh.household, base.household);
  if (household) out.household = household;
  const income = take(fresh.income, base.income);
  if (income) out.income = income;
  const shelter = fresh.shelter || base.shelter ? { ...base.shelter, ...fresh.shelter } : undefined;
  if (shelter) out.shelter = shelter;
  const deductions =
    fresh.deductions || base.deductions ? { ...base.deductions, ...fresh.deductions } : undefined;
  if (deductions) out.deductions = deductions;
  const assets = fresh.assets ?? base.assets;
  if (assets !== undefined) out.assets = assets;
  const cat_elig = fresh.cat_elig ?? base.cat_elig;
  if (cat_elig !== undefined) out.cat_elig = cat_elig;
  return out;
}

export interface ScreeningTurnRequest {
  /** Full conversation so far, INCLUDING the new user turn last. */
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  /** True when `messages` IS the whole conversation rather than a tail window.
   *  Decides whether an empty household/income array means "they have none"
   *  or "not mentioned in what I read" — see overlayFactsSnapshot (#966). */
  windowComplete?: boolean;
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

  const extraction = await extractFacts(req.messages, req.apiKey, req.signal, "conversation");
  const facts = extraction.empty
    ? req.facts
    : overlayFactsSnapshot(req.facts, extraction.patch, req.windowComplete === true);

  const classification = classifyScreening(facts, req.state, asOf);

  return {
    facts,
    extractedNothing: extraction.empty,
    classification,
    usage: extraction.usage,
  };
}
