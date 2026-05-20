#!/usr/bin/env tsx
/**
 * obbba_scenarios_to_parquet.ts
 *
 * Converts the OBBBA conservative/mid/aggressive rollup JSON to a single
 * Parquet at `data-ops/parquet/obbba-scenarios/obbba_rollup.parquet`, plus
 * the mandatory `.parquet.provenance.json` sidecar.
 *
 * Input (drop manually, gitignored):
 *   data-ops/raw/obbba-scenarios/obbba_rollup.json
 *
 * Output:
 *   data-ops/parquet/obbba-scenarios/obbba_rollup.parquet
 *   data-ops/parquet/obbba-scenarios/obbba_rollup.parquet.provenance.json
 *
 * Schema:
 *   scenario   VARCHAR  (baseline | mid | aggressive)
 *   metric     VARCHAR
 *   value      DOUBLE
 *   narrative  VARCHAR  (nullable)
 *
 * Run:
 *   pnpm data:build:obbba-scenarios
 */
import { DuckDBInstance } from "@duckdb/node-api";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const PARSER_VERSION = "0.1.0";
const PARSER_PATH = "data-ops/parsers/obbba_scenarios_to_parquet.ts";

const ROOT = process.cwd();
const INPUT_JSON = join(ROOT, "data-ops", "raw", "obbba-scenarios", "obbba_rollup.json");
const OUT_PARQUET = join(
  ROOT,
  "data-ops",
  "parquet",
  "obbba-scenarios",
  "obbba_rollup.parquet",
);

type ScenarioName =
  | "baseline"
  | "mid"
  | "aggressive"
  | "current_law"
  | "obbba_full"
  | "obbba_with_bbce_removal"
  | "obbba_with_bbce_removal_and_lpie";

const VALID_SCENARIOS: ReadonlySet<string> = new Set([
  "baseline",
  "mid",
  "aggressive",
  "current_law",
  "obbba_full",
  "obbba_with_bbce_removal",
  "obbba_with_bbce_removal_and_lpie",
]);

interface ScenarioInput {
  scenario: ScenarioName;
  metric: string;
  value: number;
  narrative?: string;
}

interface RollupInput {
  model_version: string;
  publication_date: string;
  scenarios: ScenarioInput[];
}

interface FlatRow {
  scenario: ScenarioName;
  metric: string;
  value: number;
  narrative: string | null;
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

function flatten(rollup: RollupInput): FlatRow[] {
  return rollup.scenarios.map((s) => ({
    scenario: s.scenario,
    metric: s.metric,
    value: Number(s.value),
    narrative: s.narrative ?? null,
  }));
}

export async function buildFromInput(opts: {
  inputJsonPath: string;
  outputParquetPath: string;
}): Promise<{ rowCount: number; sidecarPath: string; modelVersion: string; publicationDate: string }> {
  const { inputJsonPath, outputParquetPath } = opts;
  const text = await readFile(inputJsonPath, "utf8");
  const rollup = JSON.parse(text) as RollupInput;

  if (!Array.isArray(rollup.scenarios) || rollup.scenarios.length === 0) {
    throw new Error(
      `[obbba_scenarios_to_parquet] ${inputJsonPath}: expected non-empty scenarios array.`,
    );
  }
  for (const s of rollup.scenarios) {
    if (!VALID_SCENARIOS.has(s.scenario)) {
      throw new Error(
        `[obbba_scenarios_to_parquet] invalid scenario "${s.scenario}" — ` +
          `must be one of ${[...VALID_SCENARIOS].join("|")}.`,
      );
    }
    if (typeof s.metric !== "string" || s.metric.length === 0) {
      throw new Error(`[obbba_scenarios_to_parquet] metric must be a non-empty string.`);
    }
    if (typeof s.value !== "number" || !Number.isFinite(s.value)) {
      throw new Error(`[obbba_scenarios_to_parquet] value must be a finite number.`);
    }
  }

  const rows = flatten(rollup);
  await mkdir(dirname(outputParquetPath), { recursive: true });

  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  const jsonTmp = `${outputParquetPath}.rows.json`;
  await writeFile(jsonTmp, JSON.stringify(rows));
  try {
    const parquetSql = outputParquetPath.replaceAll("'", "''");
    const jsonSql = jsonTmp.replaceAll("'", "''");
    await conn.run(
      `COPY (SELECT * FROM read_json_auto('${jsonSql}', maximum_object_size = 16777216)) ` +
        `TO '${parquetSql}' (FORMAT PARQUET);`,
    );
    const countResult = await conn.runAndReadAll(
      `SELECT COUNT(*)::BIGINT AS n FROM read_parquet('${parquetSql}');`,
    );
    const rowCount = Number(countResult.getRows()[0]?.[0] ?? 0);
    return {
      rowCount,
      sidecarPath: `${outputParquetPath}.provenance.json`,
      modelVersion: rollup.model_version,
      publicationDate: rollup.publication_date,
    };
  } finally {
    try {
      (conn as unknown as { disconnectSync?: () => void }).disconnectSync?.();
    } catch {
      /* version-dependent */
    }
    try {
      await unlink(jsonTmp);
    } catch {
      /* ignore */
    }
  }
}

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

async function main() {
  // `--input <dir>` / `--output <dir>` overrides for the sample-data pipeline.
  // When absent, fall back to the canonical data-ops/raw + data-ops/parquet
  // paths so real-data ingestion stays untouched.
  const inputDir = parseCliArg("input");
  const outputDir = parseCliArg("output");
  const inputJson = inputDir
    ? join(ROOT, inputDir, "obbba_rollup.json")
    : INPUT_JSON;
  const outParquet = outputDir
    ? join(ROOT, outputDir, "obbba_rollup.parquet")
    : OUT_PARQUET;
  const sourceUrl = inputDir
    ? `${inputDir}/obbba_rollup.json`
    : "data-ops/raw/obbba-scenarios/obbba_rollup.json";
  const isSample = (inputDir ?? "").includes("/sample/") || (inputDir ?? "").startsWith("data-ops/sample");

  if (!(await fileExists(inputJson))) {
    console.log(
      `No OBBBA rollup JSON found at ${inputJson}. See data-ops/raw/obbba-scenarios/README.md.`,
    );
    return;
  }

  const inputHash = await sha256(inputJson);
  const sidecarPath = `${outParquet}.provenance.json`;

  if ((await fileExists(outParquet)) && (await fileExists(sidecarPath))) {
    try {
      const prev = JSON.parse(await readFile(sidecarPath, "utf8")) as {
        sha256_of_source?: string;
      };
      if (prev.sha256_of_source === inputHash) {
        console.log(`unchanged ${outParquet}`);
        return;
      }
    } catch {
      /* fall through */
    }
  }

  const result = await buildFromInput({
    inputJsonPath: inputJson,
    outputParquetPath: outParquet,
  });

  const provenance = {
    source_url: sourceUrl,
    source_kind: isSample ? "sample-fixtures" : "cbo_distributional",
    publication_date: result.publicationDate,
    pulled_at: new Date().toISOString(),
    sha256_of_source: inputHash,
    parser_path: PARSER_PATH,
    parser_version: PARSER_VERSION,
    row_count: result.rowCount,
    notes: isSample
      ? `Generated for demo purposes only. NOT real OBBBA / CBO data. ` +
        `Use ANALYTICS_USE_SAMPLE_DATA=true to query. Regenerate via ` +
        `\`pnpm data:build:sample\`. (model_version=${result.modelVersion})`
      : `OBBBA macro scenario rollup (model_version=${result.modelVersion}). ` +
        "Civica-derived from CBO §10105 distributional model + USDA FNS PER. " +
        "See data-ops/METHODOLOGY.md.",
  };
  await writeFile(sidecarPath, `${JSON.stringify(provenance, null, 2)}\n`);
  console.log(`built ${outParquet} (${result.rowCount} rows)`);
}

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1] ?? "");
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
