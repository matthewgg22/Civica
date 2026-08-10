// Chat → structured Facts, incrementally.
//
// composeVerdict/computeBenefit (packages/snap-rules) take a fully-formed
// Facts object. A caseworker types free text one turn at a time — "she's 62,
// on $1,180 SSA" — and never states the whole household at once. This is the
// bridge: an Anthropic tool-call that extracts ONLY what the latest turn
// actually said, which the caller merges onto what's already known.
//
// Deliberately narrow: the tool is instructed to extract facts VERBATIM from
// what the user stated, never to infer or assume a value that wasn't said.
// A screening tool that guesses a household fact and computes a benefit from
// the guess is worse than one that asks — this mirrors the "never invent a
// number" discipline already used for the citation verifier.

import Anthropic from "@anthropic-ai/sdk";
import type { Facts } from "@civica/snap-rules";
// Single source of truth for the pin. This file used to hardcode its own copy
// of the model string, so the two could drift — and did not drift only because
// nothing had changed the model since they were written.
import { MAE_MODEL } from "../system-prompt";

/** Deep-partial Facts: only fields the extractor is confident about. */
export type PartialFacts = {
  household?: Array<Partial<Facts["household"][number]> & { member_id: string }>;
  income?: Facts["income"];
  shelter?: Partial<Facts["shelter"]>;
  deductions?: Facts["deductions"];
  assets?: Facts["assets"];
  cat_elig?: Facts["cat_elig"];
  expedited?: boolean;
};

export interface ExtractionResult {
  patch: PartialFacts;
  /** True when the model extracted nothing new from this turn — e.g. the
   *  user asked a question rather than stating a fact. */
  empty: boolean;
  usage: { inputTokens: number; outputTokens: number };
}

const EXTRACT_TOOL = {
  name: "record_household_facts",
  description:
    "Record ONLY the household facts the user explicitly stated in their latest message. " +
    "Never infer, assume, or fill in a value the user did not say. If the message asked a " +
    "question or stated nothing new, call this with empty arrays/omitted fields.",
  input_schema: {
    type: "object" as const,
    properties: {
      household: {
        type: "array",
        description: "Household members explicitly mentioned. member_id is a stable slug you assign (e.g. 'applicant', 'spouse', 'child_1').",
        items: {
          type: "object",
          properties: {
            member_id: { type: "string" },
            age: { type: "number" },
            role: { type: "string", enum: ["head", "spouse", "child", "other"] },
            disability: { type: "boolean" },
            elderly: { type: "boolean" },
            student: { type: "string" },
          },
          required: ["member_id"],
        },
      },
      income: {
        type: "array",
        description: "Income sources explicitly stated, one entry per source per member.",
        items: {
          type: "object",
          properties: {
            member: { type: "string" },
            type: {
              type: "string",
              enum: ["wages", "self_employment", "ssa", "ssi", "tanf", "unearned_other"],
            },
            amount: { type: "number" },
            freq: { type: "string", enum: ["monthly", "weekly", "biweekly", "annual"] },
          },
          required: ["member", "type", "amount"],
        },
      },
      shelter: {
        type: "object",
        properties: {
          rent: { type: "number" },
          homeless_deduction: { type: "boolean" },
        },
      },
      deductions: {
        type: "object",
        properties: {
          dependent_care: { type: "number" },
          medical_unreimbursed: { type: "number" },
          child_support_paid: { type: "number" },
        },
      },
      assets: {
        type: "number",
        description: "Countable liquid resources in dollars, ONLY if the user stated a figure.",
      },
      cat_elig: {
        type: "string",
        enum: ["pure_SSI", "pure_TANF", "NPA"],
        description: "Set ONLY if the user stated every household member receives SSI or TANF/GA.",
      },
    },
  },
};

/** Extract the facts stated in the LATEST user turn. Prior turns provide
 *  context (so "she" resolves), but only new facts are returned — the caller
 *  owns merging onto accumulated state. */
export async function extractFacts(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create(
    {
      model: MAE_MODEL,
      max_tokens: 1024,
      // Thinking OFF, stated explicitly because the default flipped. On Opus
      // 4.8 an omitted `thinking` field meant no thinking; on Sonnet 5 it
      // means ADAPTIVE. Since max_tokens caps thinking + output together,
      // inheriting the new default would have let reasoning eat into a
      // 1024-token budget and truncate the tool call this request exists to
      // produce. This is a mechanical extraction behind a forced tool_choice,
      // so there is nothing for thinking to buy.
      //
      // (The usual caveat that thinking-off makes Sonnet 5 less tool-eager
      // does not apply: tool_choice forces the call.)
      thinking: { type: "disabled" as const },
      system:
        "You extract SNAP household facts from a caseworker's conversation with an eligibility " +
        "screening assistant. Extract ONLY what was explicitly stated in the LATEST user message " +
        "— use earlier turns for context (pronouns, running total) but do not re-extract facts " +
        "already established there. Never guess a number, age, or status that wasn't said.",
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "record_household_facts" },
    },
    { signal },
  );

  const call = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "record_household_facts",
  );
  const patch = (call?.input as PartialFacts) ?? {};
  const empty =
    !patch.household?.length &&
    !patch.income?.length &&
    !patch.shelter &&
    !patch.deductions &&
    patch.assets === undefined &&
    !patch.cat_elig;

  return {
    patch,
    empty,
    usage: {
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
    },
  };
}

/** Merge a patch onto accumulated facts. Household members merge by
 *  member_id; everything else is a shallow overlay — a new value REPLACES
 *  the old one (a caseworker correcting "actually $1,300" should win). */
export function mergeFactsPatch(base: PartialFacts, patch: PartialFacts): PartialFacts {
  const household = [...(base.household ?? [])];
  for (const m of patch.household ?? []) {
    const i = household.findIndex((h) => h.member_id === m.member_id);
    if (i >= 0) household[i] = { ...household[i], ...m };
    else household.push(m);
  }
  const merged: PartialFacts = {};
  if (household.length) merged.household = household;
  const income = patch.income?.length ? [...(base.income ?? []), ...patch.income] : base.income;
  if (income) merged.income = income;
  const shelter = patch.shelter ? { ...base.shelter, ...patch.shelter } : base.shelter;
  if (shelter) merged.shelter = shelter;
  const deductions = patch.deductions ? { ...base.deductions, ...patch.deductions } : base.deductions;
  if (deductions) merged.deductions = deductions;
  const assets = patch.assets ?? base.assets;
  if (assets !== undefined) merged.assets = assets;
  const catElig = patch.cat_elig ?? base.cat_elig;
  if (catElig !== undefined) merged.cat_elig = catElig;
  const expedited = patch.expedited ?? base.expedited;
  if (expedited !== undefined) merged.expedited = expedited;
  return merged;
}
