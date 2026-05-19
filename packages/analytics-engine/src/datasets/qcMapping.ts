import { readParquetWithProvenance } from "../runtime/node";
import {
  CivicaControlSchema,
  QcCategoryCoverageSchema,
  QcCategoryMappingStatusSchema,
  type QcCategoryCoverage,
  type QcCategoryMapping,
  type Result,
} from "../schemas";
import { z } from "zod";

const QC_MAPPING_PATH = "qc-mappings/v1/category_mapping.parquet";

// Parquet row shape: control + case-example arrays are stored as JSON strings.
const ParquetRowSchema = z.object({
  element_code: z.string(),
  cdss_error_category: z.string(),
  weighted_count: z.number(),
  share_of_errored_cases_pct: z.number(),
  cfr_basis: z.string(),
  obbba_section: z.string(),
  dollar_attribution_methodology: z.string(),
  status: QcCategoryMappingStatusSchema,
  civica_controls_json: z.string(),
  case_examples_json: z.string(),
  has_civica_control: z.boolean(),
  control_count: z.number(),
});

function hydrate(row: z.infer<typeof ParquetRowSchema>): QcCategoryMapping {
  const controls = z
    .array(CivicaControlSchema)
    .parse(JSON.parse(row.civica_controls_json));
  const examples = z.array(z.string()).parse(JSON.parse(row.case_examples_json));
  return {
    element_code: row.element_code,
    cdss_error_category: row.cdss_error_category,
    weighted_count: row.weighted_count,
    share_of_errored_cases_pct: row.share_of_errored_cases_pct,
    cfr_basis: row.cfr_basis,
    obbba_section: row.obbba_section,
    dollar_attribution_methodology: row.dollar_attribution_methodology,
    status: row.status,
    civica_controls: controls,
    case_examples: examples,
    has_civica_control: row.has_civica_control,
    control_count: row.control_count,
  };
}

async function readAll(): Promise<{
  rows: QcCategoryMapping[];
  provenance: Awaited<ReturnType<typeof readParquetWithProvenance>>["provenance"];
}> {
  const { rows, provenance } = await readParquetWithProvenance(
    QC_MAPPING_PATH,
    ParquetRowSchema,
  );
  return { rows: rows.map(hydrate), provenance };
}

/**
 * Look up mapping by partial / case-insensitive `cdss_error_category` substring.
 * Omitting `category` returns all rows.
 */
export async function byCategory(
  opts: { category?: string } = {},
): Promise<Result<QcCategoryMapping>> {
  const { rows, provenance } = await readAll();
  const filtered = opts.category
    ? rows.filter((r) =>
        r.cdss_error_category.toLowerCase().includes(opts.category!.toLowerCase()),
      )
    : rows;
  return { rows: filtered, provenance: [provenance] };
}

/**
 * Look up by CFR citation prefix (e.g. "7 CFR 273.9" matches all §273.9 rows).
 */
export async function byCfrSection(opts: {
  section: string;
}): Promise<Result<QcCategoryMapping>> {
  const { rows, provenance } = await readAll();
  const needle = opts.section.toLowerCase();
  return {
    rows: rows.filter((r) => r.cfr_basis.toLowerCase().includes(needle)),
    provenance: [provenance],
  };
}

/**
 * Coverage rollup for the state-audit dashboard. One row per category with the
 * boolean "does Civica have a real control for this?" plus weight share.
 */
export async function coverage(): Promise<Result<QcCategoryCoverage>> {
  const { rows, provenance } = await readAll();
  const out = rows.map((r) =>
    QcCategoryCoverageSchema.parse({
      element_code: r.element_code,
      cdss_error_category: r.cdss_error_category,
      has_civica_control: r.has_civica_control,
      status: r.status,
      share_of_errored_cases_pct: r.share_of_errored_cases_pct,
    }),
  );
  return { rows: out, provenance: [provenance] };
}
