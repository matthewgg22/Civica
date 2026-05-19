#!/usr/bin/env tsx
/**
 * per_to_parquet.ts
 *
 * Converts USDA FNS SNAP Payment Error Rate annual CSVs to Hive-partitioned
 * Parquet under `data-ops/parquet/per/fy={YYYY}/by_state.parquet`, with the
 * mandatory `.parquet.provenance.json` sidecar for each FY.
 *
 * Inputs (drop manually, gitignored):
 *   data-ops/raw/per/{YYYY}_payment_error_rates.csv
 *
 * Outputs:
 *   data-ops/parquet/per/fy={YYYY}/by_state.parquet
 *   data-ops/parquet/per/fy={YYYY}/by_state.parquet.provenance.json
 *
 * Schema (canonical, after normalization):
 *   state_code        VARCHAR  -- USPS two-letter, "DC" allowed
 *   state_name        VARCHAR
 *   fiscal_year       INTEGER
 *   per_total         DOUBLE   -- percent, e.g. 10.98
 *   per_overpayment   DOUBLE   -- nullable
 *   per_underpayment  DOUBLE   -- nullable
 *
 * Run:
 *   pnpm data:build:per
 */
import { DuckDBInstance } from "@duckdb/node-api";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const PARSER_VERSION = "0.1.0";
const PARSER_PATH = "data-ops/parsers/per_to_parquet.ts";

const ROOT = process.cwd();
const RAW = join(ROOT, "data-ops", "raw", "per");
const OUT = join(ROOT, "data-ops", "parquet", "per");

function parseCliArg(name: string): string | undefined {
  // Supports `--name=value` and `--name value` forms.
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === `--${name}` && i + 1 < argv.length) return argv[i + 1];
    if (arg.startsWith(`--${name}=`)) return arg.slice(`--${name}=`.length);
  }
  return undefined;
}

interface Job {
  inputCsv: string;
  outputParquet: string;
  fiscalYear: number;
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function discoverJobs(
  rawDir: string = RAW,
  outDir: string = OUT,
): Promise<Job[]> {
  if (!(await fileExists(rawDir))) return [];
  const entries = await readdir(rawDir);
  const jobs: Job[] = [];
  for (const name of entries) {
    const m = /^(\d{4})_payment_error_rates\.csv$/i.exec(name);
    if (!m) continue;
    const fy = Number(m[1]);
    jobs.push({
      inputCsv: join(rawDir, name),
      outputParquet: join(outDir, `fy=${fy}`, "by_state.parquet"),
      fiscalYear: fy,
    });
  }
  return jobs;
}

/**
 * Normalize an arbitrary CSV into the canonical PER schema using DuckDB.
 *
 * Implementation strategy: read with read_csv_auto, then `SELECT … AS …`
 * the columns we need with case-insensitive lookups via a column-existence
 * check. To stay portable across slightly different upstream CSV shapes, we
 * read column names from DuckDB's schema, pick the best match per canonical
 * field, and project. Falls back to per_total = per_overpayment + per_underpayment
 * if the source doesn't carry a combined column.
 */
async function buildOne(conn: Awaited<ReturnType<Awaited<ReturnType<typeof DuckDBInstance.create>>["connect"]>>, job: Job): Promise<number> {
  const csvSql = job.inputCsv.replaceAll("'", "''");

  // Discover columns
  const desc = await conn.runAndReadAll(
    `DESCRIBE SELECT * FROM read_csv_auto('${csvSql}', header = true, sample_size = -1);`,
  );
  const cols = desc.getRowObjects().map((r) => String(r.column_name));
  const lower = new Map<string, string>(cols.map((c) => [c.toLowerCase(), c]));

  const pick = (...candidates: string[]): string | null => {
    for (const c of candidates) {
      const hit = lower.get(c.toLowerCase());
      if (hit) return hit;
    }
    return null;
  };

  const cState = pick("state_code", "state", "st", "postal_code");
  const cName = pick("state_name", "name", "state_full");
  const cFy = pick("fiscal_year", "fy", "year");
  const cTotal = pick(
    "per_total",
    "total_per",
    "payment_error_rate",
    "combined_payment_error_rate",
    "per",
  );
  const cOver = pick("per_overpayment", "overpayment_rate", "overpayment", "op_rate");
  const cUnder = pick(
    "per_underpayment",
    "underpayment_rate",
    "underpayment",
    "up_rate",
  );

  if (!cState || !cTotal) {
    throw new Error(
      `[per_to_parquet] ${job.inputCsv}: required columns missing (need state_code-like and per_total-like). Found: ${cols.join(", ")}`,
    );
  }

  const stateExpr = `UPPER(TRIM(CAST("${cState}" AS VARCHAR)))`;
  const nameExpr = cName ? `CAST("${cName}" AS VARCHAR)` : `CAST("${cState}" AS VARCHAR)`;
  const fyExpr = cFy ? `CAST("${cFy}" AS INTEGER)` : String(job.fiscalYear);
  const totalExpr = `CAST("${cTotal}" AS DOUBLE)`;
  const overExpr = cOver ? `CAST("${cOver}" AS DOUBLE)` : "NULL::DOUBLE";
  const underExpr = cUnder ? `CAST("${cUnder}" AS DOUBLE)` : "NULL::DOUBLE";

  await mkdir(dirname(job.outputParquet), { recursive: true });
  const parquetSql = job.outputParquet.replaceAll("'", "''");

  await conn.run(
    `COPY (
       SELECT
         ${stateExpr}                                 AS state_code,
         ${nameExpr}                                  AS state_name,
         ${fyExpr}                                    AS fiscal_year,
         ${totalExpr}                                 AS per_total,
         ${overExpr}                                  AS per_overpayment,
         ${underExpr}                                 AS per_underpayment
       FROM read_csv_auto('${csvSql}', header = true, sample_size = -1)
       WHERE ${stateExpr} IS NOT NULL
         AND LENGTH(${stateExpr}) = 2
     )
     TO '${parquetSql}' (FORMAT PARQUET);`,
  );

  const countResult = await conn.runAndReadAll(
    `SELECT COUNT(*)::BIGINT AS n FROM read_parquet('${parquetSql}');`,
  );
  return Number(countResult.getRows()[0]?.[0] ?? 0);
}

async function writeSidecar(
  job: Job,
  inputHash: string,
  rowCount: number,
  opts: { isSample?: boolean; sourceDirRel?: string } = {},
) {
  const sidecarPath = `${job.outputParquet}.provenance.json`;
  const fileName = job.inputCsv.split("/").pop();
  const sourceDirRel = opts.sourceDirRel ?? "data-ops/raw/per";
  const provenance = opts.isSample
    ? {
        source_url: `${sourceDirRel}/${fileName}`,
        source_kind: "sample-fixtures",
        publication_date: "2026-05-19",
        fiscal_year: job.fiscalYear,
        pulled_at: new Date().toISOString(),
        sha256_of_source: inputHash,
        parser_path: PARSER_PATH,
        parser_version: PARSER_VERSION,
        row_count: rowCount,
        notes:
          `Generated for demo purposes only. NOT real USDA data. ` +
          `Use ANALYTICS_USE_SAMPLE_DATA=true to query. ` +
          `Regenerate via \`pnpm data:build:sample\`.`,
      }
    : {
        source_url: `${sourceDirRel}/${fileName}`,
        source_kind: "usda_fns_per",
        publication_date: `FY${job.fiscalYear} publication`,
        fiscal_year: job.fiscalYear,
        pulled_at: new Date().toISOString(),
        sha256_of_source: inputHash,
        parser_path: PARSER_PATH,
        parser_version: PARSER_VERSION,
        row_count: rowCount,
        notes:
          `USDA FNS SNAP Payment Error Rate, FY${job.fiscalYear}. ` +
          "Canonical schema: state_code, state_name, fiscal_year, per_total, " +
          "per_overpayment, per_underpayment. See data-ops/raw/per/README.md.",
      };
  await writeFile(sidecarPath, `${JSON.stringify(provenance, null, 2)}\n`);
}

async function main() {
  // `--input <dir>` / `--output <dir>` overrides for the sample-data pipeline.
  // Paths are interpreted relative to the repo root (process.cwd()).
  const inputDir = parseCliArg("input");
  const outputDir = parseCliArg("output");
  const rawDir = inputDir ? join(ROOT, inputDir) : RAW;
  const outDir = outputDir ? join(ROOT, outputDir) : OUT;
  const isSample = (inputDir ?? "").includes("sample");
  const sourceDirRel = inputDir ?? "data-ops/raw/per";

  const jobs = await discoverJobs(rawDir, outDir);
  if (jobs.length === 0) {
    console.log(
      `No PER CSVs found under ${rawDir}. See data-ops/raw/per/README.md for the expected filenames.`,
    );
    return;
  }

  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();

  for (const job of jobs) {
    const inputHash = await sha256(job.inputCsv);
    const sidecarPath = `${job.outputParquet}.provenance.json`;

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
        /* fall through */
      }
    }

    const rowCount = await buildOne(conn, job);
    await writeSidecar(job, inputHash, rowCount, { isSample, sourceDirRel });
    console.log(`built ${job.outputParquet} (${rowCount} rows)`);
  }

  try {
    (conn as unknown as { disconnectSync?: () => void }).disconnectSync?.();
  } catch {
    /* version-dependent */
  }
}

// Allow programmatic use (tests) without exec-on-import.
export { discoverJobs, buildOne, writeSidecar, main as runPerParser };

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1] ?? "");
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
