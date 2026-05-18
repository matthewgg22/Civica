#!/usr/bin/env tsx
/**
 * section_10105_to_parquet.ts
 *
 * Converts §10105 state-liability CSVs (FY24 baseline + FY28 multi-scenario)
 * to Parquet under `data-ops/parquet/section-10105/` and writes the mandatory
 * `.parquet.provenance.json` sidecar for each.
 *
 * Uses DuckDB via @duckdb/node-api — it reads CSV and writes Parquet natively
 * with no schema-by-hand needed for these tabular inputs.
 *
 * Inputs (drop manually, gitignored):
 *   data-ops/raw/section-10105/civica_state_liability_fy24.csv
 *   data-ops/raw/section-10105/state_liability_fy28_adjusted.csv
 *
 * Outputs:
 *   data-ops/parquet/section-10105/fy=2024/state_liability.parquet (+ .provenance.json)
 *   data-ops/parquet/section-10105/fy=2028/state_liability_adjusted.parquet (+ .provenance.json)
 *
 * Run:
 *   pnpm tsx data-ops/parsers/section_10105_to_parquet.ts
 */
import { DuckDBInstance } from "@duckdb/node-api";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const PARSER_VERSION = "0.1.0";
const PARSER_PATH = "data-ops/parsers/section_10105_to_parquet.ts";

const ROOT = process.cwd();
const RAW = join(ROOT, "data-ops", "raw", "section-10105");
const OUT = join(ROOT, "data-ops", "parquet", "section-10105");

interface Job {
  inputCsv: string;
  outputParquet: string;
  fiscalYear: number;
  notes: string;
}

const jobs: Job[] = [
  {
    inputCsv: join(RAW, "civica_state_liability_fy24.csv"),
    outputParquet: join(OUT, "fy=2024", "state_liability.parquet"),
    fiscalYear: 2024,
    notes:
      "FY24 baseline state liability using FY24 PER as proxy for FY25/FY26. " +
      "50 states + DC. See data-ops/METHODOLOGY.md 2026-05-12 entry.",
  },
  {
    inputCsv: join(RAW, "state_liability_fy28_adjusted.csv"),
    outputParquet: join(OUT, "fy=2028", "state_liability_adjusted.parquet"),
    fiscalYear: 2028,
    notes:
      "FY28 multi-scenario projection (conservative/mid/aggressive). " +
      "Folds OBBBA §10101 and §10102 participation/TFP reductions into " +
      "the benefit denominator. See METHODOLOGY.md.",
  },
];

async function sha256(path: string): Promise<string> {
  const buf = await readFile(path);
  return createHash("sha256").update(buf).digest("hex");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();

  for (const job of jobs) {
    if (!(await fileExists(job.inputCsv))) {
      console.warn(`SKIP ${job.inputCsv} — not present. See raw/section-10105/README.md.`);
      continue;
    }

    await mkdir(dirname(job.outputParquet), { recursive: true });

    const inputHash = await sha256(job.inputCsv);
    const sidecarPath = `${job.outputParquet}.provenance.json`;

    // Idempotence: if output parquet exists and sidecar's source hash matches, skip.
    if ((await fileExists(job.outputParquet)) && (await fileExists(sidecarPath))) {
      try {
        const prev = JSON.parse(await readFile(sidecarPath, "utf8")) as {
          sha256_of_source?: string;
        };
        if (prev.sha256_of_source === inputHash) {
          console.log(`unchanged ${job.outputParquet}`);
          continue;
        }
      } catch {
        /* fall through and rebuild */
      }
    }

    // DuckDB: COPY (FROM read_csv_auto(...)) TO 'path.parquet' (FORMAT PARQUET);
    const csvSqlPath = job.inputCsv.replaceAll("'", "''");
    const parquetSqlPath = job.outputParquet.replaceAll("'", "''");
    await conn.run(
      `COPY (SELECT * FROM read_csv_auto('${csvSqlPath}', header = true)) ` +
        `TO '${parquetSqlPath}' (FORMAT PARQUET);`,
    );

    const countResult = await conn.runAndReadAll(
      `SELECT COUNT(*)::BIGINT AS n FROM read_parquet('${parquetSqlPath}');`,
    );
    const rowCount = Number(countResult.getRows()[0]?.[0] ?? 0);

    const provenance = {
      source_url: `data-ops/raw/section-10105/${job.inputCsv.split("/").pop()}`,
      source_kind: "section_10105_cliff",
      publication_date: "2026-05-12",
      fiscal_year: job.fiscalYear,
      pulled_at: new Date().toISOString(),
      sha256_of_source: inputHash,
      parser_path: PARSER_PATH,
      parser_version: PARSER_VERSION,
      row_count: rowCount,
      notes: job.notes,
    };
    await writeFile(sidecarPath, `${JSON.stringify(provenance, null, 2)}\n`);

    console.log(`built ${job.outputParquet} (${rowCount} rows)`);
  }

  conn.disconnectSync();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
