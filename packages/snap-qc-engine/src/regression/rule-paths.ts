// Unified rule-path registry: federal + CA + MA.
//
// A "rule path" is one branch of the eligibility-math graph that the
// held-out ERE regression set must exercise. Federal paths come from a
// hand-curated registry (federal-rule-paths.ts) because the canonical
// source is Swift code. State paths are derived from the corresponding
// snap-rules data file — adding a row to ca.json / ma.json
// automatically adds a rule path here.
//
// This module is read by:
//   - test/regression-coverage.test.ts (the meta-test that asserts
//     every rule path has ≥1 fixture in the held-out manifest).
//   - Future tooling that wants to enumerate "what would a 100%-coverage
//     held-out dataset look like" (e.g., the counsel-graded eval set
//     scoping work in TODO-31).

import { loadRules } from "@civica/snap-rules";

import { FEDERAL_RULE_PATHS } from "./federal-rule-paths.js";

export type Jurisdiction = "federal" | "CA" | "MA";

export type RulePathCategory =
  | "allotment"
  | "income-test"
  | "deduction"
  | "exemption"
  | "document-requirement";

export interface RulePath {
  /**
   * Stable identifier; convention is `{jurisdiction-slug}/{group}/{name}`.
   * Federal paths use `federal/...`; state paths use `ca/...` / `ma/...`.
   * IDs are URL-safe: lowercase, hyphens, slashes, no spaces.
   */
  readonly id: string;
  readonly jurisdiction: Jurisdiction;
  readonly category: RulePathCategory;
  /** Plain-English description for ops dashboards + audit reports. */
  readonly description: string;
  /**
   * Pointer back to the canonical source — Swift file for federal,
   * JSON path for state. Used during quarterly rule-refresh audits to
   * verify the registry hasn't drifted from the source of truth.
   */
  readonly swift_source?: string;
  readonly json_source?: string;
}

function stateDocumentRequirementPaths(jurisdiction: "CA" | "MA"): readonly RulePath[] {
  const slug = jurisdiction.toLowerCase();
  const data = loadRules(jurisdiction);
  return data.document_requirements.map((req) => ({
    id: `${slug}/document-requirement/${req.category}/${req.document_kind}`,
    jurisdiction,
    category: "document-requirement" as const,
    description: `${jurisdiction} document requirement: ${req.category} (${req.document_kind}).`,
    json_source: `packages/snap-rules/src/data/${slug}.json#document_requirements`,
  }));
}

/**
 * Enumerate every rule path the held-out ERE regression set must cover.
 * Pure function over the federal registry + the state JSON data —
 * deterministic, no I/O beyond the static imports above.
 */
export function enumerateRulePaths(): readonly RulePath[] {
  return [
    ...FEDERAL_RULE_PATHS,
    ...stateDocumentRequirementPaths("CA"),
    ...stateDocumentRequirementPaths("MA"),
  ];
}

/**
 * Convenience: rule paths grouped by jurisdiction. Used by ops
 * dashboards + the coverage report formatter.
 */
export function enumerateRulePathsByJurisdiction(): Record<Jurisdiction, readonly RulePath[]> {
  const all = enumerateRulePaths();
  return {
    federal: all.filter((p) => p.jurisdiction === "federal"),
    CA: all.filter((p) => p.jurisdiction === "CA"),
    MA: all.filter((p) => p.jurisdiction === "MA"),
  };
}
