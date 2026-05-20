/**
 * sample-data.test.ts — round-trip validation of the demo / sample dataset.
 *
 * Mirrors the production read path (`readParquetWithProvenance`) with two
 * flips:
 *   1. ANALYTICS_LOCAL_PARQUET_DIR → a tmp dir we lay out as the bucket
 *   2. ANALYTICS_USE_SAMPLE_DATA=true → engine prepends `sample/` to all paths
 *
 * The fixture is built once by `runSampleGenerator()` + the two parsers,
 * which is also what `pnpm data:build:sample` runs in CI. If determinism
 * regresses, this suite will catch it (sha256 of CSV/JSON gets re-validated
 * on each run by the parsers' "unchanged" short-circuit).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DuckDBInstance } from "@duckdb/node-api";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOne } from "../../../../data-ops/parsers/per_to_parquet";
import { buildFromInput } from "../../../../data-ops/parsers/obbba_scenarios_to_parquet";
import { runSampleGenerator } from "../../../../scripts/generate-sample-analytics-data";
import { analytics } from "../../src";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..", "..");

let workDir: string;

beforeAll(async () => {
  // 1. Run the deterministic generator targeting the repo root so it lands
  //    its CSVs + JSON under the canonical data-ops/sample/ source tree.
  //    This is the same code path `pnpm data:build:sample` invokes.
  await runSampleGenerator({ root: REPO_ROOT });

  // 2. Stand up a private bucket-shaped tmp dir. The engine prepends
  //    `sample/` to every bucketPath when ANALYTICS_USE_SAMPLE_DATA is set,
  //    so we mirror that layout here.
  workDir = await mkdtemp(join(tmpdir(), "civica-sample-"));
  process.env.ANALYTICS_LOCAL_PARQUET_DIR = workDir;
  process.env.ANALYTICS_USE_SAMPLE_DATA = "true";

  const sampleParquetRoot = join(workDir, "sample");
  await mkdir(sampleParquetRoot, { recursive: true });

  // 3. Build the PER parquet + sidecars (per_to_parquet.buildOne handles the
  //    parquet emit; we hand-roll the sidecars to keep the test self-contained
  //    and pin known-good provenance values).
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  for (const fy of [2023, 2024]) {
    const inputCsv = join(
      REPO_ROOT,
      "data-ops",
      "sample",
      "per",
      `${fy}_payment_error_rates.csv`,
    );
    const outputParquet = join(
      sampleParquetRoot,
      "per",
      `fy=${fy}`,
      "by_state.parquet",
    );
    await mkdir(dirname(outputParquet), { recursive: true });
    const rowCount = await buildOne(conn, {
      inputCsv,
      outputParquet,
      fiscalYear: fy,
    });
    const sidecar = {
      source_url: `data-ops/sample/per/${fy}_payment_error_rates.csv`,
      source_kind: "sample-fixtures",
      publication_date: "2026-05-19",
      fiscal_year: fy,
      pulled_at: new Date().toISOString(),
      sha256_of_source: "test-fixture",
      parser_path: "data-ops/parsers/per_to_parquet.ts",
      parser_version: "0.1.0",
      row_count: rowCount,
      notes:
        "Generated for demo purposes only. NOT real USDA data. " +
        "Use ANALYTICS_USE_SAMPLE_DATA=true to query.",
    };
    await writeFile(`${outputParquet}.provenance.json`, JSON.stringify(sidecar));
  }

  // 4. Build the OBBBA scenario parquet from the just-generated JSON.
  const obbbaJson = join(
    REPO_ROOT,
    "data-ops",
    "sample",
    "obbba-scenarios",
    "obbba_rollup.json",
  );
  const obbbaOut = join(
    sampleParquetRoot,
    "obbba-scenarios",
    "obbba_rollup.parquet",
  );
  const obbbaResult = await buildFromInput({
    inputJsonPath: obbbaJson,
    outputParquetPath: obbbaOut,
  });
  await writeFile(
    obbbaResult.sidecarPath,
    JSON.stringify({
      source_url: "data-ops/sample/obbba-scenarios/obbba_rollup.json",
      source_kind: "sample-fixtures",
      publication_date: obbbaResult.publicationDate,
      pulled_at: new Date().toISOString(),
      sha256_of_source: "test-fixture",
      parser_path: "data-ops/parsers/obbba_scenarios_to_parquet.ts",
      parser_version: "0.1.0",
      row_count: obbbaResult.rowCount,
      notes:
        "Generated for demo purposes only. NOT real OBBBA / CBO data. " +
        `Use ANALYTICS_USE_SAMPLE_DATA=true to query. (model_version=${obbbaResult.modelVersion})`,
    }),
  );
});

afterAll(async () => {
  delete process.env.ANALYTICS_LOCAL_PARQUET_DIR;
  delete process.env.ANALYTICS_USE_SAMPLE_DATA;
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

describe("sample analytics dataset", () => {
  it("paymentErrorRate.byState returns CA's deterministic value (10.98) for FY24", async () => {
    const { rows, provenance } = await analytics.paymentErrorRate.byState({
      fy: 2024,
      state: "CA",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state_code).toBe("CA");
    expect(rows[0]?.per_total).toBeCloseTo(10.98, 2);
    expect(provenance[0]?.source_kind).toBe("sample-fixtures");
    expect(provenance[0]?.bucket_path?.startsWith("sample/")).toBe(true);
  });

  it("paymentErrorRate.byState returns all 53 jurisdictions when unfiltered", async () => {
    const { rows } = await analytics.paymentErrorRate.byState({ fy: 2024 });
    expect(rows).toHaveLength(53);
  });

  it("paymentErrorRate.trend returns FY23 + FY24 CA rows", async () => {
    const { rows, provenance } = await analytics.paymentErrorRate.trend({
      stateCode: "CA",
      fyRange: [2023, 2024],
    });
    expect(rows.map((r) => r.fiscal_year)).toEqual([2023, 2024]);
    expect(rows[0]?.per_total).toBeCloseTo(9.85, 2);
    expect(rows[1]?.per_total).toBeCloseTo(10.98, 2);
    expect(rows[1]?.trend_delta).toBeCloseTo(10.98 - 9.85, 2);
    expect(provenance).toHaveLength(2);
    expect(provenance.every((p) => p.source_kind === "sample-fixtures")).toBe(true);
  });

  it("obbbaScenarios.compare returns 20 rows (4 scenarios × 5 metrics)", async () => {
    const { rows, provenance } = await analytics.obbbaScenarios.compare();
    expect(rows).toHaveLength(20);
    const scenarios = new Set(rows.map((r) => r.scenario));
    expect(scenarios).toEqual(
      new Set([
        "current_law",
        "obbba_full",
        "obbba_with_bbce_removal",
        "obbba_with_bbce_removal_and_lpie",
      ]),
    );
    const metrics = new Set(rows.map((r) => r.metric));
    expect(metrics.size).toBe(5);
    expect(provenance[0]?.source_kind).toBe("sample-fixtures");
  });

  it("every returned row carries sample-fixtures provenance, never real-source markers", async () => {
    const per = await analytics.paymentErrorRate.byState({ fy: 2024 });
    const obbba = await analytics.obbbaScenarios.compare();
    for (const p of [...per.provenance, ...obbba.provenance]) {
      expect(p.source_kind).toBe("sample-fixtures");
      expect(p.notes ?? "").toMatch(/demo/i);
    }
  });
});
