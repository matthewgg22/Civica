import { z } from "zod";

/**
 * Schemas for Tier 3 query results. Column shapes follow the actual Parquet
 * files produced by `data-ops/parsers/` — they're the contract between
 * parsers and consumers.
 *
 * Per docs/data-architecture.md: "Schemas are discovered during parser
 * implementation." Add a schema here when a new parser ships; remove a
 * column when a parser drops it.
 */

export const ProvenanceSchema = z.object({
  source_url: z.string(),
  source_kind: z.enum([
    "usda_fns_per",
    "usda_fns_benefits",
    "usda_qc_microdata",
    "usda_state_options",
    "ecfr_rule_index",
    "cbo_distributional",
    "state_foia",
    "federal_foia",
    "nga_compilation",
    "aei_secondary",
    "civica_qc_evaluation",
    "section_10105_cliff",
    "civica_qc_mapping",
    "sample-fixtures",
  ]),
  publication_date: z.string(),
  fiscal_year: z.number().int().optional(),
  pulled_at: z.string(),
  sha256_of_source: z.string(),
  parser_path: z.string(),
  parser_version: z.string(),
  row_count: z.number().int().nonnegative(),
  notes: z.string().optional(),
  bucket_path: z.string().optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export type Result<T> = {
  rows: T[];
  provenance: Provenance[];
};

// ---------------------------------------------------------------------------
// Payment Error Rates (per/) — T10 phase 2
// ---------------------------------------------------------------------------

export const PERSchema = z.object({
  state_code: z.string().length(2),
  state_name: z.string(),
  fiscal_year: z.number().int(),
  per_total: z.number(),
  per_overpayment: z.number().optional(),
  per_underpayment: z.number().optional(),
});
export type PER = z.infer<typeof PERSchema>;

export const PERTrendSchema = PERSchema.extend({
  trend_delta: z.number().optional(),
});
export type PERTrend = z.infer<typeof PERTrendSchema>;

// ---------------------------------------------------------------------------
// §10105 cliff (section-10105/)
// ---------------------------------------------------------------------------

export const LiabilitySchema = z.object({
  state: z.string(),
  fy24_per_pct: z.number(),
  fy24_benefits_millions: z.number(),
  tier: z.string(),
  state_share_pct: z.number(),
  delayed_to_fy29: z.boolean(),
  fy28_state_liability_millions: z.number(),
  annualized_liability_at_tier_millions: z.number(),
});
export type Liability = z.infer<typeof LiabilitySchema>;

/**
 * Multi-scenario projection (FY28 adjusted). Adds conservative/mid/aggressive
 * columns on top of the FY24 baseline shape.
 */
export const LiabilityScenarioSchema = LiabilitySchema.extend({
  fy28_benefits_conservative_millions: z.number(),
  fy28_liability_conservative_millions: z.number(),
  fy29_annualized_conservative_millions: z.number(),
  fy28_benefits_mid_millions: z.number(),
  fy28_liability_mid_millions: z.number(),
  fy29_annualized_mid_millions: z.number(),
  fy28_benefits_aggressive_millions: z.number(),
  fy28_liability_aggressive_millions: z.number(),
  fy29_annualized_aggressive_millions: z.number(),
});
export type LiabilityScenario = z.infer<typeof LiabilityScenarioSchema>;

/**
 * Result of `analytics.section10105.fy29Cliff()` — states whose FY24 PER
 * triggers the delayed-implementation clause (PER × 1.5 ≥ 20%, i.e. ≥ 13.33%).
 */
export const CliffEntrySchema = LiabilitySchema.pick({
  state: true,
  fy24_per_pct: true,
  fy24_benefits_millions: true,
  tier: true,
  delayed_to_fy29: true,
  annualized_liability_at_tier_millions: true,
});
export type CliffEntry = z.infer<typeof CliffEntrySchema>;

// ---------------------------------------------------------------------------
// CFR-273 rule index (cfr-273/)
// ---------------------------------------------------------------------------

export const CfrCitationSchema = z.object({
  citation: z.string(),
  section: z.string(),
  topic: z.string(),
  heading: z.string(),
  summary: z.string(),
  household_types_affected: z.string(),
  civica_relevance: z.enum(["HIGH", "MEDIUM", "LOW"]),
  key_quote: z.string(),
});
export type CfrCitation = z.infer<typeof CfrCitationSchema>;

// ---------------------------------------------------------------------------
// Stubs — schemas live here when parsers land
// ---------------------------------------------------------------------------

export const ErrorCauseRollupSchema = z.object({
  income_source: z.string(),
  year: z.number().int(),
  error_count: z.number().int(),
  case_count: z.number().int(),
});
export type ErrorCauseRollup = z.infer<typeof ErrorCauseRollupSchema>;

export const FoiaIndexSchema = z.object({
  state_code: z.string().optional(),
  request_date: z.string(),
  slug: z.string(),
  pdf_path: z.string(),
  scope: z.string(),
  findings: z.string(),
});
export type FoiaIndex = z.infer<typeof FoiaIndexSchema>;

/**
 * Scenario rollup row.
 *
 * Two scenario vocabularies are supported:
 *  - Real-data (CBO distributional rollup): baseline | mid | aggressive
 *  - Sample-fixtures (demo path, ANALYTICS_USE_SAMPLE_DATA=true):
 *      current_law | obbba_full | obbba_with_bbce_removal
 *      | obbba_with_bbce_removal_and_lpie
 *
 * Both share the same { scenario, metric, value } shape so the dashboard
 * `obbbaScenarios.compare()` consumer doesn't need to fork.
 */
export const ScenarioRowSchema = z.object({
  scenario: z.enum([
    "baseline",
    "mid",
    "aggressive",
    "current_law",
    "obbba_full",
    "obbba_with_bbce_removal",
    "obbba_with_bbce_removal_and_lpie",
  ]),
  metric: z.string(),
  value: z.number(),
});
export type ScenarioRow = z.infer<typeof ScenarioRowSchema>;

// ---------------------------------------------------------------------------
// QC Category Mapping (qc-mappings/) — T7
// ---------------------------------------------------------------------------

export const CivicaControlSchema = z.object({
  control_id: z.string(),
  control_description: z.string(),
  evidence_link: z.string(),
  defensibility_impact: z.string(),
});
export type CivicaControl = z.infer<typeof CivicaControlSchema>;

export const QcCategoryMappingStatusSchema = z.enum([
  "documented",
  "hypothesized",
  "refuted",
]);
export type QcCategoryMappingStatus = z.infer<typeof QcCategoryMappingStatusSchema>;

export const QcCategoryMappingSchema = z.object({
  element_code: z.string(),
  cdss_error_category: z.string(),
  weighted_count: z.number(),
  share_of_errored_cases_pct: z.number(),
  cfr_basis: z.string(),
  obbba_section: z.string(),
  dollar_attribution_methodology: z.string(),
  status: QcCategoryMappingStatusSchema,
  civica_controls: z.array(CivicaControlSchema),
  case_examples: z.array(z.string()),
  has_civica_control: z.boolean(),
  control_count: z.number().int().nonnegative(),
});
export type QcCategoryMapping = z.infer<typeof QcCategoryMappingSchema>;

export const QcCategoryCoverageSchema = z.object({
  element_code: z.string(),
  cdss_error_category: z.string(),
  has_civica_control: z.boolean(),
  status: QcCategoryMappingStatusSchema,
  share_of_errored_cases_pct: z.number(),
});
export type QcCategoryCoverage = z.infer<typeof QcCategoryCoverageSchema>;

export const QcEvaluationSchema = z.object({
  org_id: z.string(),
  evaluation_id: z.string(),
  packet_id: z.string(),
  defensibility_score_numeric: z.number(),
  evaluated_at: z.string(),
});
export type QcEvaluation = z.infer<typeof QcEvaluationSchema>;
