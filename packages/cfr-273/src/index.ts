import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";

/**
 * @civica/cfr-273 — typed accessor for the 223-row 7 CFR Part 273 rule
 * index. Source of truth is `data/rule_index.csv` (also mirrored to
 * `s3://civica-analytics/cfr-273/ecfr=2026-05-08/rule_index.parquet` for
 * cross-tier analytical joins; see scripts/build-parquet.ts).
 */

export const RelevanceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type Relevance = z.infer<typeof RelevanceSchema>;

export const CfrCitationSchema = z.object({
  citation: z.string(),
  section: z.string(),
  topic: z.string(),
  heading: z.string(),
  summary: z.string(),
  household_types_affected: z.string(),
  civica_relevance: RelevanceSchema,
  key_quote: z.string(),
});
export type CfrCitation = z.infer<typeof CfrCitationSchema>;

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "..", "data", "rule_index.csv");

let cached: CfrCitation[] | null = null;

export function allCitations(): readonly CfrCitation[] {
  if (cached) return cached;
  cached = parseCsv(readFileSync(CSV_PATH, "utf8"));
  return cached;
}

export function byRelevance(grade: Relevance): readonly CfrCitation[] {
  return allCitations().filter((c) => c.civica_relevance === grade);
}

export function bySection(section: string): readonly CfrCitation[] {
  return allCitations().filter((c) => c.section === section);
}

/**
 * Minimal RFC-4180-ish CSV parser. The rule_index.csv source uses doubled
 * quotes inside quoted fields (Python csv default) — handled here. We avoid
 * a dep because this file is loaded at every dashboard build.
 */
export function parseCsv(input: string): CfrCitation[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows;
  if (!header) throw new Error("cfr-273: empty CSV");
  const idx = (name: string) => {
    const at = header.indexOf(name);
    if (at < 0) throw new Error(`cfr-273: missing column ${name}`);
    return at;
  };
  const cols = {
    citation: idx("citation"),
    section: idx("section"),
    topic: idx("topic"),
    heading: idx("heading"),
    summary: idx("summary"),
    household_types_affected: idx("household_types_affected"),
    civica_relevance: idx("civica_relevance"),
    key_quote: idx("key_quote"),
  };

  return body
    .filter((r) => r.length > 1)
    .map((r) =>
      CfrCitationSchema.parse({
        citation: r[cols.citation] ?? "",
        section: r[cols.section] ?? "",
        topic: r[cols.topic] ?? "",
        heading: r[cols.heading] ?? "",
        summary: r[cols.summary] ?? "",
        household_types_affected: r[cols.household_types_affected] ?? "",
        civica_relevance: r[cols.civica_relevance] ?? "LOW",
        key_quote: r[cols.key_quote] ?? "",
      }),
    );
}
