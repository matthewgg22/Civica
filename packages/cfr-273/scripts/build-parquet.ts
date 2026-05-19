#!/usr/bin/env tsx
/**
 * Mirror data/rule_index.csv into Tier 3 (Parquet) so analytics-engine
 * can join CFR citations against PER / liability / QC data in DuckDB.
 *
 * Output:
 *   data-ops/parquet/cfr-273/ecfr=2026-05-08/rule_index.parquet
 *   data-ops/parquet/cfr-273/ecfr=2026-05-08/rule_index.parquet.provenance.json
 */
import { DuckDBInstance } from "@duckdb/node-api";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const PARSER_VERSION = "0.1.0";
const ECFR_DATE = "2026-05-08";
const ROOT = process.cwd();
const CSV = join(ROOT, "packages", "cfr-273", "data", "rule_index.csv");
const OUT = join(
  ROOT,
  "data-ops",
  "parquet",
  "cfr-273",
  `ecfr=${ECFR_DATE}`,
  "rule_index.parquet",
);

async function main() {
  await mkdir(dirname(OUT), { recursive: true });

  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  // Force all columns to VARCHAR via `all_varchar = true`. Without this,
  // DuckDB's auto-typer treats `section` "273.10" as float 273.1 (silent
  // data loss) and inferred-NULL `key_quote` columns trip strict consumers.
  await conn.run(
    `COPY (
       SELECT
         citation,
         section,
         topic,
         heading,
         summary,
         household_types_affected,
         civica_relevance,
         COALESCE(key_quote, '') AS key_quote
       FROM read_csv('${CSV.replaceAll("'", "''")}', header = true, all_varchar = true)
     ) TO '${OUT.replaceAll("'", "''")}' (FORMAT PARQUET);`,
  );

  const buf = await readFile(CSV);
  const provenance = {
    source_url: "packages/cfr-273/data/rule_index.csv",
    source_kind: "ecfr_rule_index",
    publication_date: ECFR_DATE,
    pulled_at: new Date().toISOString(),
    sha256_of_source: createHash("sha256").update(buf).digest("hex"),
    parser_path: "packages/cfr-273/scripts/build-parquet.ts",
    parser_version: PARSER_VERSION,
    row_count: 223,
    notes:
      "Civica-curated index of 7 CFR Part 273 (SNAP rules). " +
      "Mirror of Tier 2 @civica/cfr-273 package. Same content as " +
      "data/rule_index.csv, exposed as Parquet for cross-tier joins.",
  };
  await writeFile(`${OUT}.provenance.json`, `${JSON.stringify(provenance, null, 2)}\n`);

  try {
    (conn as unknown as { disconnectSync?: () => void }).disconnectSync?.();
  } catch {
    /* @duckdb/node-api dropped disconnectSync in newer alphas */
  }
  console.log(`built ${OUT} (${provenance.row_count} rows)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
