import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DuckDBInstance } from "@duckdb/node-api";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { byRelevance, bySection } from "./cfr273";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_CSV = join(
  HERE,
  "..",
  "..",
  "..",
  "..",
  "data-ops",
  "test",
  "fixtures",
  "cfr-273",
  "rule_index.csv",
);

const ECFR_DATE = "2026-05-08";
let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "civica-cfr-"));
  process.env.ANALYTICS_LOCAL_PARQUET_DIR = workDir;
  const outputParquet = join(workDir, "cfr-273", `ecfr=${ECFR_DATE}`, "rule_index.parquet");
  await mkdir(dirname(outputParquet), { recursive: true });

  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  const csvSql = FIXTURE_CSV.replaceAll("'", "''");
  const parquetSql = outputParquet.replaceAll("'", "''");
  // Mirror the production cast policy from
  // packages/cfr-273/scripts/build-parquet.ts. Use the `types=` kwarg so
  // read_csv_auto never coerces "273.10" → 273.1 in the first place.
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
       FROM read_csv('${csvSql}', header = true, all_varchar = true)
     ) TO '${parquetSql}' (FORMAT PARQUET);`,
  );
  const countResult = await conn.runAndReadAll(
    `SELECT COUNT(*)::BIGINT AS n FROM read_parquet('${parquetSql}');`,
  );
  const rowCount = Number(countResult.getRows()[0]?.[0] ?? 0);
  await writeFile(
    `${outputParquet}.provenance.json`,
    JSON.stringify({
      source_url: "data-ops/test/fixtures/cfr-273/rule_index.csv",
      source_kind: "ecfr_rule_index",
      publication_date: ECFR_DATE,
      pulled_at: new Date().toISOString(),
      sha256_of_source: "fixture-hash",
      parser_path: "packages/cfr-273/scripts/build-parquet.ts",
      parser_version: "0.1.0",
      row_count: rowCount,
    }),
  );
});

afterAll(async () => {
  delete process.env.ANALYTICS_LOCAL_PARQUET_DIR;
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

describe("cfr273.byRelevance", () => {
  it("returns only HIGH-relevance citations", async () => {
    const { rows, provenance } = await byRelevance({ grade: "HIGH" });
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.every((r) => r.civica_relevance === "HIGH")).toBe(true);
    expect(provenance[0]?.source_kind).toBe("ecfr_rule_index");
  });

  it("returns LOW-relevance citations separately", async () => {
    const { rows } = await byRelevance({ grade: "LOW" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.section).toBe("273.10");
  });
});

describe("cfr273.bySection", () => {
  it("matches all rows under a section prefix", async () => {
    const { rows } = await bySection({ section: "273.9" });
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows.every((r) => r.section.startsWith("273.9"))).toBe(true);
  });

  it("strips '7 CFR' prefix gracefully", async () => {
    const { rows } = await bySection({ section: "7 CFR 273.10" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.section).toBe("273.10");
  });
});
