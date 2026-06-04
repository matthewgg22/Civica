// Stage 1: Elicitation.
// Completeness gate + plausibility checks → DETERMINE or ELICIT.
// Never produces a silent default; engine SKIP is surfaced as a product gap.

import type { Facts } from "@civica/snap-rules";
import type {
  AnsweredAxes,
  ElicitationResult,
  ElicitationQuestion,
} from "./types";
import {
  DETERMINATIVE_FIELDS,
  isFieldPresent,
} from "./manifest";
import { runPlausibilityChecks } from "./plausibility";

// ─── Minimum facts gate ───────────────────────────────────────────────────────

export function hasMinimumFacts(f: Partial<Facts>): boolean {
  return (
    Array.isArray(f.household) &&
    f.household.length > 0 &&
    Array.isArray(f.income) &&
    f.shelter != null &&
    typeof f.shelter.rent === "number" &&
    f.shelter.sua_tier != null &&
    f.deductions != null &&
    f.assets != null &&
    f.cat_elig != null
  );
}

// ─── Stage 1 entry point ──────────────────────────────────────────────────────

export function evaluateElicitation(
  partialFacts: Partial<Facts>,
  answeredAxes: AnsweredAxes,
  _state: "CA" | "MA",
): ElicitationResult {
  // Collect missing determinative fields
  const missingFields: string[] = [];
  const nextQuestions: ElicitationQuestion[] = [];

  for (const entry of DETERMINATIVE_FIELDS) {
    if (entry.optional) continue;

    // Skip fields whose branch predicate says they're not applicable
    if (!entry.branchPredicate(partialFacts, answeredAxes)) continue;

    if (!isFieldPresent(partialFacts, entry.path)) {
      missingFields.push(entry.path);
      nextQuestions.push(entry.question);
    }
  }

  // Plausibility cross-checks (independent of missing fields)
  const plausibilityFlags = runPlausibilityChecks(partialFacts, answeredAxes);

  // P-08 blocking: even if all fields are present, informal housing is indeterminate
  const hasBlockingFlag = plausibilityFlags.some((f) => f.severity === "blocking");

  const status =
    missingFields.length === 0 &&
    !hasBlockingFlag &&
    hasMinimumFacts(partialFacts)
      ? "DETERMINE"
      : "ELICIT";

  return {
    status,
    missing_fields: missingFields,
    plausibility_flags: plausibilityFlags,
    next_questions: nextQuestions,
  };
}
