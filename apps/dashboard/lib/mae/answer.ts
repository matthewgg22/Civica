// Shared assembly of a Mae generation request, used by BOTH the streaming route
// (/api/mae) and the answer-faithfulness eval — so what the eval grades is
// exactly what production sends. Returns the system blocks plus the citations
// retrieved for this question (the allowlist the citation verifier checks against).

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

/** Generation knobs shared by the route and the eval. */
export const MAE_GENERATION = {
  model: MAE_MODEL,
  max_tokens: 4096,
  thinking: { type: "adaptive" as const },
};

/** Build Mae's grounded system prompt for one question.
 *  Block 0 (cached): frozen instructions + authority map + provenance + live FY
 *  figures. Block 1 (un-cached): the verbatim eCFR text retrieved for this Q. */
export async function buildMaeSystem(
  lastUserText: string,
  state: "CA" | "MA" = "CA",
): Promise<MaeSystem> {
  let liveParams = "";
  try {
    liveParams = formatEngineParams(state, new Date());
  } catch (err) {
    console.error("[mae] engine params unavailable:", err);
  }
  const systemText = [MAE_SYSTEM_PROMPT, MAE_CITATIONS_PROVENANCE, MAE_ENGINE_CITATIONS, liveParams]
    .filter(Boolean)
    .join("\n\n");

  let retrievedBlock = "";
  let retrievedCitations: string[] = [];
  try {
    const chunks = await retrieve(lastUserText);
    retrievedCitations = chunks.map((c) => c.citation);
    retrievedBlock = formatRetrievedSources(chunks);
  } catch (err) {
    console.error("[mae] retrieval failed:", err);
  }

  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
  ];
  if (retrievedBlock) systemBlocks.push({ type: "text", text: retrievedBlock });

  return { systemBlocks, retrievedCitations };
}
