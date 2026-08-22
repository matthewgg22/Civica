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
            // Was free text (#898 second pass): the model wrote "college" /
            // "high school", and the engine's student gate matches only its
            // exact fixture tokens — so a real transcript's full-time college
            // student silently counted as a fully-eligible member. Small
            // stated-facts enum, mapped to engine tokens after parsing.
            student: {
              type: "string",
              enum: ["high_school", "higher_ed_half_time_plus", "higher_ed_less_than_half", "none"],
              description:
                "ONLY if stated. higher_ed_half_time_plus = college/university at least " +
                "half-time; higher_ed_less_than_half = enrolled but less than half-time; " +
                "none = explicitly not a student. Omit when enrollment wasn't mentioned.",
            },
            // Was missing entirely (#895): completeness REQUIRES a per-member
            // immigration status, so with no way to record one, "we're both
            // citizens" was silently dropped and no extracted household could
            // ever reach computable — in chat grounding OR the worksheet.
            immigration: {
              type: "string",
              enum: ["citizen", "lpr", "refugee", "cofa", "undocumented"],
              description:
                "ONLY if explicitly stated ('we're citizens', 'I have a green card' → lpr). " +
                "Omit when not stated — never guess.",
            },
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
          // Mapped to the engine's SUA tier below (#895). Without any way to
          // record utilities, every extracted shelter object failed schema
          // validation on the required sua_tier and surfaced as "one detail
          // we recorded does not look right".
          utilities: {
            type: "string",
            enum: ["heating_cooling", "other_utilities", "phone_only", "none"],
            description:
              "ONLY if explicitly stated: heating_cooling when they pay heat or A/C " +
              "separately from rent; other_utilities for electric/water/etc. without " +
              "heat; phone_only; none when they say utilities are included. Omit when " +
              "not stated.",
          },
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
        // The old description ("set ONLY if ... receives") made the NEGATIVE
        // unrecordable: "no SSI or TANF" — exactly what completeness needs to
        // hear to mark this answered — had to be dropped, so the question
        // stayed permanently open no matter what the user said (#895).
        description:
          'Set "pure_SSI" or "pure_TANF" ONLY if the user stated EVERY household member ' +
          'receives it. Set "NPA" if the user stated nobody receives SSI or TANF/GA. ' +
          "Omit when they haven't said either way.",
      },
    },
  },
};

/** Extract the facts stated in the LATEST user turn (default), or across the
 *  whole visible conversation (`scope: "conversation"`).
 *
 *  The per-turn default serves the worksheet, whose CLIENT accumulates state
 *  across turns and merges each patch (mergeFactsPatch below). The
 *  conversation scope serves the chat's engine-grounding step (#895), where
 *  the server is stateless per request and there is nothing to merge onto —
 *  each request re-reads whatever the visible window still contains. Prior
 *  turns provide context either way (so "she" resolves). */
export async function extractFacts(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  apiKey: string,
  signal?: AbortSignal,
  scope: "latest_turn" | "conversation" = "latest_turn",
): Promise<ExtractionResult> {
  const client = new Anthropic({ apiKey });
  const scopeInstruction =
    scope === "conversation"
      ? "Extract every household fact the USER stated anywhere in this conversation — " +
        "user messages only; never treat something the assistant said as a stated fact. " +
        "If the user corrected a figure later, the correction wins."
      : "Extract ONLY what was explicitly stated in the LATEST user message " +
        "— use earlier turns for context (pronouns, running total) but do not re-extract facts " +
        "already established there.";
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
        "You extract SNAP household facts from a conversation with an eligibility " +
        "screening assistant. " +
        scopeInstruction +
        " Never guess a number, age, or status that wasn't said.",
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "record_household_facts" },
    },
    { signal },
  );

  const call = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "record_household_facts",
  );
  const patch = (call?.input as PartialFacts & { shelter?: { utilities?: string } }) ?? {};
  // NORMALIZE INCOME TO MONTHLY (#895). snap-rules never reads `freq` — the
  // field exists on the schema but every gate and the benefit calc treat
  // `amount` as a monthly figure (all 90 counting oracle profiles state
  // monthly amounts). So "$600 a week" recorded as-is computed as $600 a
  // MONTH — caught live as a household handed the maximum allotment instead
  // of a near-minimum benefit. Converted here, at the one seam both
  // consumers (worksheet merge, chat grounding) share, using the same
  // factors 7 CFR 273.10(c)(2) mandates for exactly this conversion.
  const TO_MONTHLY: Record<string, number> = { weekly: 4.3, biweekly: 2.15, annual: 1 / 12 };
  for (const line of patch.income ?? []) {
    const factor = TO_MONTHLY[line.freq ?? ""];
    if (factor !== undefined && typeof line.amount === "number") {
      line.amount = Math.round(line.amount * factor * 100) / 100;
      line.freq = "monthly";
    }
  }
  // Student enrollment: the tool records stated facts in plain terms; the
  // engine's student gate (7 CFR 273.5) reads its own exact tokens. Anything
  // that is neither a tool enum value nor an engine token is DROPPED rather
  // than passed through — an unconstrained string reaching the gate is
  // exactly the silent-miscount this mapping exists to prevent, and an
  // absent field is the permissive default (not subject), consistent with
  // how the ABAWD gate treats an unknown work_class.
  const STUDENT_TOKEN: Record<string, string> = {
    high_school: "not",
    higher_ed_less_than_half: "not",
    none: "not",
    higher_ed_half_time_plus: "he_halftime_subject",
  };
  for (const m of patch.household ?? []) {
    if (m.student === undefined) continue;
    const mapped = STUDENT_TOKEN[m.student];
    if (mapped) m.student = mapped;
    else if (!/^(not$|he_halftime_subject$|he_exempt:)/.test(m.student)) delete m.student;
  }
  // The tool records utilities in plain terms; the engine's ShelterSchema
  // wants its SUA tier enum. Map here so BOTH consumers (worksheet merge,
  // chat grounding) receive engine-shaped facts.
  if (patch.shelter && "utilities" in patch.shelter) {
    const TIER: Record<string, "HCSUA" | "LUA" | "phone" | "none"> = {
      heating_cooling: "HCSUA",
      other_utilities: "LUA",
      phone_only: "phone",
      none: "none",
    };
    const tier = TIER[patch.shelter.utilities ?? ""];
    delete patch.shelter.utilities;
    if (tier) (patch.shelter as { sua_tier?: string }).sua_tier = tier;
  }
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
 *  the old one (a caseworker correcting "actually $1,300" should win).
 *
 *  ⚠ DO NOT use this across INDEPENDENT extraction calls. member_id is a
 *  slug the model re-invents per call, so merging two calls' outputs by id
 *  duplicates every member ("child_1" + "son" = two people) — the exact
 *  household-inflation bug of #898 P0-1. screenHousehold now uses
 *  whole-conversation re-extraction + overlayFactsSnapshot instead; this
 *  stays only for merging patches WITHIN one consistent id-space. */
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
