import { z } from "zod";
import caRules from "./data/ca.json";
import maRules from "./data/ma.json";

// ---------------------------------------------------------------------------
// Condition schema — each variant uses .strict() so the union correctly
// distinguishes variants that share the answer_key field.
// ---------------------------------------------------------------------------

const AlwaysCondition = z.object({ always: z.literal(true) }).strict();

const AnswerEqualsCondition = z
  .object({ answer_key: z.string(), equals: z.union([z.string(), z.number(), z.boolean()]) })
  .strict();

const AnswerContainsCondition = z
  .object({ answer_key: z.string(), contains: z.string() })
  .strict();

const AnswerTruthyCondition = z
  .object({ answer_key: z.string(), truthy: z.literal(true) })
  .strict();

const AnswerOneOfCondition = z
  .object({ answer_key: z.string(), one_of: z.array(z.string()).min(1) })
  .strict();

const HouseholdSizeGteCondition = z
  .object({ household_size_gte: z.number().int().min(1) })
  .strict();

export const ConditionSchema = z.union([
  AlwaysCondition,
  AnswerEqualsCondition,
  AnswerContainsCondition,
  AnswerTruthyCondition,
  AnswerOneOfCondition,
  HouseholdSizeGteCondition,
]);

export type Condition = z.infer<typeof ConditionSchema>;

// ---------------------------------------------------------------------------
// Document requirement schema — both _en and _es required; build fails if
// either is absent because the Zod parse in tests will reject it.
// ---------------------------------------------------------------------------

export const DocumentRequirementSchema = z
  .object({
    category: z.string().min(1),
    document_kind: z.enum([
      "paystub",
      "photo_id",
      "lease",
      "utility_bill",
      "bank_statement",
      "tax_return",
      "benefit_letter",
      "other",
    ]),
    label_en: z.string().min(1),
    label_es: z.string().min(1),
    helper_en: z.string().min(1),
    helper_es: z.string().min(1),
    required_when: ConditionSchema,
    is_required: z.boolean(),
    alt_kinds: z
      .array(
        z.enum([
          "paystub",
          "photo_id",
          "lease",
          "utility_bill",
          "bank_statement",
          "tax_return",
          "benefit_letter",
          "other",
        ]),
      )
      .optional(),
    counsel_note: z.string().optional(),
  })
  .strict();

export type DocumentRequirement = z.infer<typeof DocumentRequirementSchema>;

// ---------------------------------------------------------------------------
// Flag schema
// ---------------------------------------------------------------------------

export const FlagSchema = z
  .object({
    key: z.string().min(1),
    trigger_when: ConditionSchema,
    label_en: z.string().min(1),
    label_es: z.string().min(1),
    context_en: z.string().min(1),
    context_es: z.string().min(1),
    counsel_note: z.string().optional(),
  })
  .strict();

export type Flag = z.infer<typeof FlagSchema>;

// ---------------------------------------------------------------------------
// Top-level rules file schema — loader rejects unknown versions.
// ---------------------------------------------------------------------------

export const RulesFileSchema = z
  .object({
    $schema: z.string().optional(),
    state_code: z.enum(["CA", "MA"]),
    version: z.literal(1),
    as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    document_requirements: z.array(DocumentRequirementSchema),
    flags: z.array(FlagSchema),
  })
  .strict();

export type RulesFile = z.infer<typeof RulesFileSchema>;

// ---------------------------------------------------------------------------
// Loader — validates and returns typed rules for a state.
// Throws if version is unknown or schema is invalid.
// ---------------------------------------------------------------------------

const STATE_DATA: Record<string, unknown> = {
  CA: caRules,
  MA: maRules,
};

export function loadRules(stateCode: "CA" | "MA"): RulesFile {
  const raw = STATE_DATA[stateCode];
  if (raw === undefined) throw new Error(`No rules found for state: ${stateCode}`);
  return RulesFileSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Condition evaluator
// ---------------------------------------------------------------------------

type Answers = Record<string, unknown>;

function getNestedValue(answers: Answers, key: string): unknown {
  const parts = key.split(".");
  let val: unknown = answers;
  for (const part of parts) {
    if (val === null || typeof val !== "object") return undefined;
    val = (val as Record<string, unknown>)[part];
  }
  return val;
}

function evaluateCondition(cond: Condition, input: EvaluateInput): boolean {
  if ("always" in cond) return true;
  if ("household_size_gte" in cond) return input.household_size >= cond.household_size_gte;

  // All remaining variants carry answer_key.
  const val = getNestedValue(input.answers, cond.answer_key);

  if ("equals" in cond) return val === cond.equals;
  if ("truthy" in cond) return Boolean(val);
  if ("contains" in cond) {
    if (Array.isArray(val)) return (val as unknown[]).includes(cond.contains);
    if (typeof val === "string") return val.includes(cond.contains);
    return false;
  }
  // one_of
  if (typeof val === "string") return cond.one_of.includes(val);
  return false;
}

// ---------------------------------------------------------------------------
// evaluateChecklist — public API consumed by dashboard and enrollment-api.
// ---------------------------------------------------------------------------

export interface EvaluateInput {
  state_code: "CA" | "MA";
  household_size: number;
  answers: Record<string, unknown>;
}

export interface RequiredDocumentItem {
  category: string;
  document_kind: string;
  label_en: string;
  label_es: string;
  helper_en: string;
  helper_es: string;
  is_required: boolean;
  alt_kinds?: string[];
}

export interface ActiveFlag {
  key: string;
  label_en: string;
  label_es: string;
  context_en: string;
  context_es: string;
}

export interface EvaluateOutput {
  state_code: "CA" | "MA";
  required_items: RequiredDocumentItem[];
  active_flags: ActiveFlag[];
}

export function evaluateChecklist(input: EvaluateInput): EvaluateOutput {
  const rules = loadRules(input.state_code);

  const required_items: RequiredDocumentItem[] = rules.document_requirements
    .filter((req) => evaluateCondition(req.required_when, input))
    .map((req) => ({
      category: req.category,
      document_kind: req.document_kind,
      label_en: req.label_en,
      label_es: req.label_es,
      helper_en: req.helper_en,
      helper_es: req.helper_es,
      is_required: req.is_required,
      ...(req.alt_kinds !== undefined && { alt_kinds: req.alt_kinds }),
    }));

  const active_flags: ActiveFlag[] = rules.flags
    .filter((flag) => evaluateCondition(flag.trigger_when, input))
    .map((flag) => ({
      key: flag.key,
      label_en: flag.label_en,
      label_es: flag.label_es,
      context_en: flag.context_en,
      context_es: flag.context_es,
    }));

  return { state_code: input.state_code, required_items, active_flags };
}

// ---------------------------------------------------------------------------
// Work requirements (OBBBA §10102) — re-exported from the sub-module
// ---------------------------------------------------------------------------

export type { ExemptionType, WorkRequirementInput, WorkRequirementResult } from './work-requirements/types.js';
export { evaluateWorkRequirement } from './work-requirements/evaluate.js';
export { CA_WAIVER_COUNTY_FIPS, MA_WAIVER_COUNTY_FIPS } from './work-requirements/waiver-counties.js';
