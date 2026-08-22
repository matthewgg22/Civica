// Shared assembly of a Demeter generation request, used by BOTH the
// answerQuestion() orchestrator and the answer-faithfulness eval — so what the
// eval grades is exactly what production sends. Returns the system blocks plus
// the citations retrieved for this question (the allowlist the citation
// verifier checks against).

import type Anthropic from "@anthropic-ai/sdk";
import type { AnswerLang } from "./lang";
import { MAE_MODEL, STAFF_SYSTEM_PROMPT, PUBLIC_SYSTEM_PROMPT } from "./system-prompt";
import {
  MAE_ENGINE_CITATIONS,
  MAE_CITATIONS_PROVENANCE,
  formatEngineParams,
} from "./engine-citations";
import { retrieve, formatRetrievedSources } from "./retrieval";

/** Who's asking — selects which persona prompt is sent. No default: the bug
 *  this type exists to prevent was exactly an audience flag that got set on a
 *  request and silently never reached prompt selection (see system-prompt.ts). */
export type Audience = "staff" | "public";

export interface MaeSystem {
  systemBlocks: Anthropic.TextBlockParam[];
  /** Citations of the chunks retrieved for this question (verifier allowlist). */
  retrievedCitations: string[];
  /** The retrieved source TEXT. The verifier needs it, not only the chunk
   *  labels: regulations cross-reference each other, and a citation the source
   *  itself quotes is a real authority rather than an invention. */
  retrievedText: string;
}

/** Generation knobs shared by the orchestrator and the eval. */
export const MAE_GENERATION = {
  model: MAE_MODEL,
  max_tokens: 4096,
  thinking: { type: "adaptive" as const },
};

// The hardcoded ENGINE_PARAM_STATES = {"CA","MA"} that used to live here is
// gone. It was written when snap-rules had two states and silently froze at
// two while the engine grew to eleven — so TX, WA and GA, which all have BOTH
// a verified corpus pack AND authored engine math, were being told "figures
// not yet wired" and answered without the live FY numbers they could have had.
//
// Asking the engine is the source of truth: getEngineParams throws
// UnknownStateError for a state it has no policy for, and that throw is the
// only reliable signal. Deriving it this way means a state authored in
// snap-rules tomorrow gets live figures here with no edit to this file — the
// class of drift that produced the bug in the first place.

/** Build Demeter's grounded system prompt for one question.
 *  Block 0 (cached): frozen instructions + authority map + provenance + live FY
 *  figures. Block 1 (un-cached): the verbatim eCFR/pack text retrieved for this Q.
 *
 *  `audience` selects the persona (REQUIRED, no default — see the Audience
 *  type doc). `state` semantics (threaded end-to-end — eng review T-C):
 *    - a pack state code ("CA", "TX", …): state-scoped retrieval + freshness;
 *    - null: FEDERAL FLOOR — no state pack, no state supplements. Used for
 *      anonymous public users with no state selected. Never defaults to CA. */
export async function buildMaeSystem(
  lastUserText: string,
  audience: Audience,
  state: string | null = "CA",
  lang: AnswerLang = "en",
): Promise<MaeSystem> {
  let liveParams = "";
  if (state) {
    try {
      liveParams = formatEngineParams(state, new Date());
    } catch {
      // No authored policy for this state. Say so plainly rather than let the
      // model fill the silence with a figure it recalled — honesty over
      // silence, and silence over invention.
      liveParams =
        `NOTE: live ${state} benefit-calculation figures are not yet wired into this ` +
        `assistant — cite the verified ${state} policy sources below for rules, and ` +
        `direct users to their state agency for exact current dollar amounts.`;
    }
  }
  const personaPrompt = audience === "public" ? PUBLIC_SYSTEM_PROMPT : STAFF_SYSTEM_PROMPT;
  const systemText = [personaPrompt, MAE_CITATIONS_PROVENANCE, MAE_ENGINE_CITATIONS, liveParams]
    .filter(Boolean)
    .join("\n\n");

  let retrievedBlock = "";
  let retrievedCitations: string[] = [];
  try {
    const chunks = await retrieve(lastUserText, { state, lang });
    retrievedCitations = chunks.map((c) => c.citation);
    retrievedBlock = formatRetrievedSources(chunks, state);
  } catch (err) {
    console.error("[demeter] retrieval failed:", err);
  }

  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
  ];
  if (retrievedBlock) systemBlocks.push({ type: "text", text: retrievedBlock });

  return { systemBlocks, retrievedCitations, retrievedText: retrievedBlock };
}
