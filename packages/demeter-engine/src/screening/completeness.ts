// "Still needed" — what's missing before a screening can run.
//
// A naive approach would merge PartialFacts onto a skeleton with defaults
// (assets: 0, income: []) and run the Zod schema — but that makes "asset
// value confirmed as $0" and "asset question never asked" indistinguishable,
// and the mockup explicitly lists "Countable assets, if any" as still-needed
// on an otherwise well-populated screening. So the fields that matter to a
// caseworker are checked directly against what was ACTUALLY stated, before
// any skeleton default is applied. Zod only catches malformed data among
// what the extractor already recorded (a negative age, say) — it is not the
// source of "still needed".
//
// KNOWN GAP, not silently papered over: distinguishing "household has zero
// income" from "income question never asked" needs its own signal from the
// extractor (a confirmed-none flag), which doesn't exist yet. Until it does,
// this module does not ask about income at all beyond household size — an
// intentional v1 scope line, not an oversight.

import { validateFacts, type Facts } from "@civica/snap-rules";
import type { PartialFacts } from "./facts-extraction";

// Fields required by the Zod schema that carry NO "still needed" semantics —
// a caseworker is never asked "any deductions?" as its own checklist item,
// the mockup's own still-needed lists never include it, and an empty object
// is a legitimate real answer, not a placeholder for one nobody gave.
//
// EXPORTED and used by BOTH assessCompleteness (to run the shape check) and
// classifyScreening (before calling composeVerdict) — they must apply the
// IDENTICAL fill, or "computable: true" and "the engine can actually run on
// this" can disagree, which is exactly the bug this comment is here to
// prevent from being reintroduced.
const SHAPE_DEFAULTS = {
  household: [] as unknown[],
  income: [] as unknown[],
  shelter: { rent: 0, sua_tier: "none" },
  deductions: {},
  assets: 0,
  cat_elig: "NPA",
};

/** Fill in ONLY the shape defaults above — every field a caseworker is
 *  actually asked about must already be present, or the caller has a bug. */
export function completeFactsShape(facts: PartialFacts): Facts {
  return { ...SHAPE_DEFAULTS, ...facts } as unknown as Facts;
}

export interface CompletenessResult {
  /** True once composeVerdict can run without throwing on shape alone. Does
   *  NOT mean the verdict will be a determination — just that it's callable. */
  computable: boolean;
  /** De-duplicated, ordered checklist for the UI. */
  stillNeeded: string[];
  /** Raw Zod issues among fields that WERE provided — malformed data, not
   *  missing data. Never shown to a user; audit trail only. */
  rawErrors: string[];
}

export function assessCompleteness(facts: PartialFacts): CompletenessResult {
  const stillNeeded: string[] = [];

  // Household size leads — nothing else is answerable without it.
  if (!facts.household?.length) {
    stillNeeded.push("Household size");
  } else {
    // Immigration/citizenship status is optional in the Zod schema (not
    // every profile needs it filled), so it can never surface as a Zod
    // error — it has to be checked explicitly, per member.
    if (facts.household.some((m) => m.immigration === undefined)) {
      stillNeeded.push("Citizenship or qualified status");
    }
  }

  if (facts.assets === undefined) stillNeeded.push("Countable assets, if any");
  if (facts.cat_elig === undefined) stillNeeded.push("Whether the household receives SSI or TANF");
  if (facts.shelter?.rent === undefined) stillNeeded.push("Rent or shelter cost");

  // Zod runs over a shape-completed merge ONLY to catch malformed data among
  // what was actually provided (invalid age, bad enum) — never to invent a
  // "still needed" item, since its skeleton defaults would make everything
  // look answered.
  const rawErrors = validateFacts(completeFactsShape(facts)) ?? [];
  for (const err of rawErrors) {
    const path = err.split(":")[0]!.trim();
    const label = `Missing: ${path}`;
    if (!stillNeeded.includes(label)) stillNeeded.push(label);
  }

  return { computable: stillNeeded.length === 0, stillNeeded, rawErrors };
}
