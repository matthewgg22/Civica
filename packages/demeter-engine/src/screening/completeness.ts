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
  const merged = { ...SHAPE_DEFAULTS, ...facts } as unknown as Facts;
  // The overlay is SHALLOW, so a stated shelter object REPLACES the default
  // one wholesale — and the extractor knows rent long before it knows the
  // SUA tier (utilities may simply never come up). Zod requires sua_tier on
  // every shelter object, so a rent-only shelter validated as "one detail we
  // recorded does not look right" — a permanent, unactionable checklist item
  // that kept every real extracted household from ever reaching computable
  // (#895). "none" is the conservative floor: it can only UNDERSTATE the
  // benefit (utility allowances raise deductions), never overstate it, and
  // engine-grounding says so out loud when this default was applied.
  if (facts.shelter && facts.shelter.sua_tier === undefined) {
    merged.shelter = { ...merged.shelter, sua_tier: "none" };
  }
  return merged;
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

/** A Zod path turned into something a person can act on, or null.
 *
 *  These went to the reader verbatim. A panel headed "Still needed" listed
 *  "Missing: household.0.age" and "Missing: household.1.age" — internal field
 *  paths, one per household member, in a list otherwise written in English.
 *  It told someone nothing about what to say next, and it leaked the shape of
 *  our own data model into a page aimed at people applying for food
 *  assistance.
 *
 *  The array index is stripped first, so two members missing an age collapse
 *  into one line rather than counting twice against the "still needed" badge.
 *
 *  Anything unrecognised returns NULL and is dropped from the visible list —
 *  it stays in rawErrors, where the diagnostics belong. A field we forgot to
 *  name here is a gap in this table, and showing the reader its internal name
 *  does not fill it. */
/** Shown when a malformed field has no human name in the table below. Says
 *  that something is outstanding without naming an internal field. */
const UNNAMED = "One detail we recorded does not look right — tell Demeter again in your own words";

function humanLabel(path: string): string | null {
  const generic = path.replace(/\.\d+\./g, ".").replace(/\.\d+$/, "");
  const LABELS: Record<string, string> = {
    "household": "Who lives with you",
    "household.age": "Everyone's age",
    "household.member_id": "Who lives with you",
    "household.role": "How each person is related to you",
    "household.disability": "Whether anyone has a disability",
    "household.elderly": "Whether anyone is 60 or over",
    "household.student": "Whether anyone is a student",
    "household.immigration": "Citizenship or qualified status",
    "income": "Income, and how often it is paid",
    "income.amount": "How much the income is",
    "income.freq": "How often that income is paid",
    "income.type": "What kind of income it is",
    "income.member": "Who the income belongs to",
    "shelter": "Rent or shelter cost",
    "shelter.rent": "Rent or shelter cost",
    "shelter.homeless_deduction": "Whether the household is homeless",
    "deductions.dependent_care": "Childcare or dependent care costs",
    "deductions.medical_unreimbursed": "Out-of-pocket medical costs",
    "deductions.child_support_paid": "Child support you pay",
    "assets": "Countable assets, if any",
    "cat_elig": "Whether the household receives SSI or TANF",
  };
  return LABELS[generic] ?? null;
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
    // An unmapped path still has to SURFACE — dropping it silently would let
    // stillNeeded empty out while the facts are malformed, and composeVerdict
    // would then be asked to run on data Zod has already rejected. It surfaces
    // as a sentence rather than as a field path.
    const label = humanLabel(err.split(":")[0]!.trim()) ?? UNNAMED;
    if (!stillNeeded.includes(label)) stillNeeded.push(label);
  }

  // rawErrors is checked SEPARATELY from the visible list. They are no longer
  // the same thing now that labels are deduplicated and humanised, and
  // "computable" is a claim about the data, not about the panel.
  return { computable: stillNeeded.length === 0 && rawErrors.length === 0, stillNeeded, rawErrors };
}
