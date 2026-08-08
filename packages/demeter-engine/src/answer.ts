// Shared assembly of a Demeter generation request, used by BOTH the
// answerQuestion() orchestrator and the answer-faithfulness eval — so what the
// eval grades is exactly what production sends. Returns the system blocks plus
// the citations retrieved for this question (the allowlist the citation
// verifier checks against).

import type Anthropic from "@anthropic-ai/sdk";
import { MAE_MODEL, MAE_SYSTEM_PROMPT } from "./system-prompt";
import {
  MAE_ENGINE_CITATIONS,
  MAE_CITATIONS_PROVENANCE,
  formatEngineParams,
} from "./engine-citations";
import { retrieve, formatRetrievedSources } from "./retrieval";

export interface MaeSystem {
  systemBlocks: Anthropic.TextBlockParam[];
  /** Citations of the chunks retrieved for this question (verifier allowlist). */
  retrievedCitations: string[];
}

/** Generation knobs shared by the orchestrator and the eval. */
export const MAE_GENERATION = {
  model: MAE_MODEL,
  max_tokens: 4096,
  thinking: { type: "adaptive" as const },
};

/** States with live engine dollar figures wired (packages/snap-rules). Pack
 *  states outside this set get an explicit "figures not wired" line rather
 *  than a swallowed UnknownStateError — honesty over silence. */
const ENGINE_PARAM_STATES = new Set(["CA", "MA"]);

/** Build Demeter's grounded system prompt for one question.
 *  Block 0 (cached): frozen instructions + authority map + provenance + live FY
 *  figures. Block 1 (un-cached): the verbatim eCFR/pack text retrieved for this Q.
 *
 *  `state` semantics (threaded end-to-end — eng review T-C):
 *    - a pack state code ("CA", "TX", …): state-scoped retrieval + freshness;
 *    - null: FEDERAL FLOOR — no state pack, no state supplements. Used for
 *      anonymous public users with no state selected. Never defaults to CA. */
export async function buildMaeSystem(
  lastUserText: string,
  state: string | null = "CA",
): Promise<MaeSystem> {
  let liveParams = "";
  if (state && ENGINE_PARAM_STATES.has(state)) {
    try {
      liveParams = formatEngineParams(state as "CA" | "MA", new Date());
    } catch (err) {
      console.error("[demeter] engine params unavailable:", err);
    }
  } else if (state) {
    liveParams =
      `NOTE: live ${state} benefit-calculation figures are not yet wired into this ` +
      `assistant — cite the verified ${state} policy sources below for rules, and ` +
      `direct users to their state agency for exact current dollar amounts.`;
  }
  const systemText = [MAE_SYSTEM_PROMPT, MAE_CITATIONS_PROVENANCE, MAE_ENGINE_CITATIONS, liveParams]
    .filter(Boolean)
    .join("\n\n");

  let retrievedBlock = "";
  let retrievedCitations: string[] = [];
  try {
    const chunks = await retrieve(lastUserText, { state });
    retrievedCitations = chunks.map((c) => c.citation);
    retrievedBlock = formatRetrievedSources(chunks, state);
  } catch (err) {
    console.error("[demeter] retrieval failed:", err);
  }

  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
  ];
  if (retrievedBlock) systemBlocks.push({ type: "text", text: retrievedBlock });

  return { systemBlocks, retrievedCitations };
}
