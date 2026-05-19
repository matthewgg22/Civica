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

interface ScenarioInput {
  scenario: "baseline" | "mid" | "aggressive";
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
  scenario: "baseline" | "mid" | "aggressive";
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
    if (!["baseline", "mid", "aggressive"].includes(s.scenario)) {
      throw new Error(
        `[obbba_scenarios_to_parquet] invalid scenario "${s.scenario}" — must be baseline|mid|aggressive.`,
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

async function main() {
  if (!(await fileExists(INPUT_JSON))) {
    console.log(
      `No OBBBA rollup JSON found at ${INPUT_JSON}. See data-ops/raw/obbba-scenarios/README.md.`,
    );
    return;
  }

  const inputHash = await sha256(INPUT_JSON);
  const sidecarPath = `${OUT_PARQUET}.provenance.json`;

  if ((await fileExists(OUT_PARQUET)) && (await fileExists(sidecarPath))) {
    try {
      const prev = JSON.parse(await readFile(sidecarPath, "utf8")) as {
        sha256_of_source?: string;
      };
      if (prev.sha256_of_source === inputHash) {
        console.log(`unchanged ${OUT_PARQUET}`);
        return;
      }
    } catch {
      /* fall through */
    }
  }

  const result = await buildFromInput({
    inputJsonPath: INPUT_JSON,
    outputParquetPath: OUT_PARQUET,
  });

  const provenance = {
    source_url: "data-ops/raw/obbba-scenarios/obbba_rollup.json",
    source_kind: "cbo_distributional",
    publication_date: result.publicationDate,
    pulled_at: new Date().toISOString(),
    sha256_of_source: inputHash,
    parser_path: PARSER_PATH,
    parser_version: PARSER_VERSION,
    row_count: result.rowCount,
    notes:
      `OBBBA macro scenario rollup (model_version=${result.modelVersion}). ` +
      "Civica-derived from CBO §10105 distributional model + USDA FNS PER. " +
      "See data-ops/METHODOLOGY.md.",
  };
  await writeFile(sidecarPath, `${JSON.stringify(provenance, null, 2)}\n`);
  console.log(`built ${OUT_PARQUET} (${result.rowCount} rows)`);
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
