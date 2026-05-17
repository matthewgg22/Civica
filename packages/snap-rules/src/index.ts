import caRaw from "../data/ca.json";
import maRaw from "../data/ma.json";

export type {
  DocumentRequirement,
  DocumentCategory,
  RequiredWhen,
  RulesFile,
  StateCode,
} from "./schema.js";
export {
  DocumentRequirementSchema,
  RulesFileSchema,
  DOCUMENT_CATEGORIES,
  SUPPORTED_VERSIONS,
} from "./schema.js";

import type { DocumentCategory, DocumentRequirement, RulesFile } from "./schema.js";
import { RulesFileSchema } from "./schema.js";

const RAW_FILES: Record<string, unknown> = {
  CA: caRaw,
  MA: maRaw,
};

const _cache = new Map<string, RulesFile>();

export function loadRules(stateCode: string): RulesFile {
  const key = stateCode.toUpperCase();
  const cached = _cache.get(key);
  if (cached) return cached;

  const raw = RAW_FILES[key];
  if (!raw) throw new Error(`@civica/snap-rules: no rules file for state "${stateCode}"`);

  const parsed = RulesFileSchema.parse(raw);
  _cache.set(key, parsed);
  return parsed;
}

export const SUPPORTED_STATES = Object.keys(RAW_FILES) as string[];

// Canonical human-readable labels for document_kind values. Derived from
// ca.json so the dashboard, API, and iOS all share one source of truth.
// Falls back to prettified category string for any future categories not
// yet in the rules files.
export const DOCUMENT_KIND_LABELS: Record<string, string> = (() => {
  const ca = loadRules("CA");
  return Object.fromEntries(ca.document_requirements.map((r) => [r.category, r.label]));
})();

// ---------------------------------------------------------------------------
// Checklist evaluation
// ---------------------------------------------------------------------------

export interface ChecklistAnswers {
  household_size?: number;
  has_earned_income?: boolean;
  has_unearned_income?: boolean;
  claims_shelter_deduction?: boolean;
  claims_utility_deduction?: boolean;
}

export type ChecklistItemStatus = "required" | "n_a";

export interface ChecklistItem {
  category: DocumentCategory;
  label: string;
  helper_text_en: string;
  helper_text_es: string;
  status: ChecklistItemStatus;
}

export interface ChecklistResult {
  items: ChecklistItem[];
  flags: string[];
}

function conditionMet(req: DocumentRequirement, answers: ChecklistAnswers): boolean {
  const when = req.required_when;

  if ("always" in when) return true;

  if ("household_size_gte" in when) {
    // Default to 1 — any real SNAP application has at least one person.
    return (answers.household_size ?? 1) >= when.household_size_gte;
  }

  if ("has_earned_income" in when) return answers.has_earned_income === true;
  if ("has_unearned_income" in when) return answers.has_unearned_income === true;
  if ("claims_shelter_deduction" in when) return answers.claims_shelter_deduction === true;
  if ("claims_utility_deduction" in when) return answers.claims_utility_deduction === true;

  return false;
}

/**
 * Evaluate the document checklist for a given state and set of applicant answers.
 *
 * Returns only items where the condition is met (status "required"). Items
 * whose condition is not met are omitted entirely so the caller can insert
 * only the applicable rows into required_document_items.
 *
 * The returned `flags` array always contains the orientation disclaimer.
 * Additional flags may be added in future versions (e.g. stale-rules notice).
 */
export function evaluateChecklist({
  state,
  answers,
}: {
  state: string;
  answers: ChecklistAnswers;
}): ChecklistResult {
  const rules = loadRules(state);

  const items: ChecklistItem[] = rules.document_requirements
    .filter((req) => conditionMet(req, answers))
    .map((req) => ({
      category: req.category,
      label: req.label,
      helper_text_en: req.helper_text_en,
      helper_text_es: req.helper_text_es,
      status: "required" as const,
    }));

  return {
    items,
    flags: [
      "Orientation only — does not determine eligibility. Actual requirements are determined by your state agency.",
    ],
  };
}
