import { z } from "zod";
import { readParquetWithProvenance } from "../runtime/node";
import { CfrCitationSchema, type CfrCitation, type Result } from "../schemas";

/**
 * Parquet row shape as DuckDB hands it back from `read_csv_auto`:
 *   - `section` is auto-detected as numeric for rows like "273.9"
 *   - `key_quote` is auto-detected as nullable when many rows are empty
 * Coerce both back into the canonical `CfrCitation` shape.
 */
const ParquetRowSchema = z.object({
  citation: z.string(),
  section: z.coerce.string(),
  topic: z.string(),
  heading: z.string(),
  summary: z.string(),
  household_types_affected: z.string(),
  civica_relevance: z.enum(["HIGH", "MEDIUM", "LOW"]),
  key_quote: z.union([z.string(), z.null()]).transform((v) => v ?? ""),
});

/**
 * The CFR-273 rule index is published with an `ecfr={DATE}` partition. We
 * default to the date currently mirrored in source-inventory.yaml; callers
 * can override via opts.ecfrDate when a newer mirror lands.
 */
const DEFAULT_ECFR_DATE = "2026-05-08";
const cfrBucketPath = (ecfrDate: string) =>
  `cfr-273/ecfr=${ecfrDate}/rule_index.parquet`;

async function readAll(ecfrDate: string) {
  return readParquetWithProvenance(cfrBucketPath(ecfrDate), ParquetRowSchema);
}

/**
 * All CFR-273 citations matching a relevance grade (HIGH / MEDIUM / LOW).
 *
 * The dashboard's "compliance focus" surface uses `HIGH` to render the
 * Civica-relevant subset; the full 223-row index can be browsed with `LOW`
 * + `MEDIUM` overlays.
 */
export async function byRelevance(opts: {
  grade: "HIGH" | "MEDIUM" | "LOW";
  ecfrDate?: string;
}): Promise<Result<CfrCitation>> {
  const { rows, provenance } = await readAll(opts.ecfrDate ?? DEFAULT_ECFR_DATE);
  return {
    rows: rows
      .filter((r) => r.civica_relevance === opts.grade)
      .map((r) => CfrCitationSchema.parse(r)),
    provenance: [provenance],
  };
}

/**
 * Citations matching a CFR section prefix (e.g. "273.9" matches all §273.9.*
 * rows). Comparison is case-insensitive substring against the `section`
 * column to keep query DX forgiving of "7 CFR 273.9" vs "273.9" inputs.
 */
export async function bySection(opts: {
  section: string;
  ecfrDate?: string;
}): Promise<Result<CfrCitation>> {
  const { rows, provenance } = await readAll(opts.ecfrDate ?? DEFAULT_ECFR_DATE);
  const needle = opts.section.toLowerCase().replace(/^7\s*cfr\s*/i, "").trim();
  return {
    rows: rows
      .filter(
        (r) =>
          r.section.toLowerCase().includes(needle) ||
          r.citation.toLowerCase().includes(needle),
      )
      .map((r) => CfrCitationSchema.parse(r)),
    provenance: [provenance],
  };
}
