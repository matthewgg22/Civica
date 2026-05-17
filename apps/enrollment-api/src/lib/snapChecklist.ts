// Canonical source: packages/snap-rules/src/index.ts
// Inlined here because enrollment-api CI uses standalone npm (not pnpm workspace).
// Migrate this import once enrollment-api-ci.yml switches to pnpm.
import caRules from "../../../../packages/snap-rules/src/data/ca.json";
import maRules from "../../../../packages/snap-rules/src/data/ma.json";

type AlwaysCondition = { always: true };
type AnswerEqualsCondition = { answer_key: string; equals: string | number | boolean };
type AnswerContainsCondition = { answer_key: string; contains: string };
type AnswerTruthyCondition = { answer_key: string; truthy: true };
type AnswerOneOfCondition = { answer_key: string; one_of: string[] };
type HouseholdSizeGteCondition = { household_size_gte: number };

type Condition =
  | AlwaysCondition
  | AnswerEqualsCondition
  | AnswerContainsCondition
  | AnswerTruthyCondition
  | AnswerOneOfCondition
  | HouseholdSizeGteCondition;

interface DocReq {
  category: string;
  document_kind: string;
  label_en: string;
  label_es: string;
  helper_en: string;
  helper_es: string;
  required_when: Condition;
  is_required: boolean;
  alt_kinds?: string[];
}

interface RulesData {
  document_requirements: DocReq[];
}

const STATE_DATA: Record<string, RulesData> = {
  CA: caRules as RulesData,
  MA: maRules as RulesData,
};

export interface SeedDocItem {
  document_kind: string;
  label_en: string;
  is_required: boolean;
}

function getNestedValue(answers: Record<string, unknown>, key: string): unknown {
  const parts = key.split(".");
  let val: unknown = answers;
  for (const part of parts) {
    if (val === null || typeof val !== "object") return undefined;
    val = (val as Record<string, unknown>)[part];
  }
  return val;
}

function evaluateCondition(
  cond: Condition,
  householdSize: number,
  answers: Record<string, unknown>,
): boolean {
  if ("always" in cond) return true;
  if ("household_size_gte" in cond) return householdSize >= cond.household_size_gte;

  const val = getNestedValue(answers, cond.answer_key);

  if ("equals" in cond) return val === cond.equals;
  if ("truthy" in cond) return Boolean(val);
  if ("contains" in cond) {
    if (Array.isArray(val)) return (val as unknown[]).includes(cond.contains);
    if (typeof val === "string") return val.includes(cond.contains);
    return false;
  }
  if (typeof val === "string") return (cond as AnswerOneOfCondition).one_of.includes(val);
  return false;
}

export function seedDocumentItems(
  stateCode: "CA" | "MA",
  householdSize: number,
  answers: Record<string, unknown>,
): SeedDocItem[] {
  const rules = STATE_DATA[stateCode];
  if (!rules) throw new Error(`No rules found for state: ${stateCode}`);
  return rules.document_requirements
    .filter((req) => evaluateCondition(req.required_when, householdSize, answers))
    .map((req) => ({
      document_kind: req.document_kind,
      label_en: req.label_en,
      is_required: req.is_required,
    }));
}
