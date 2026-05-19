import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DuckDBInstance } from "@duckdb/node-api";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOne } from "../../../../data-ops/parsers/per_to_parquet";
import { byState, trend } from "./paymentErrorRate";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, "..", "..", "..", "..", "data-ops", "test", "fixtures", "per");

let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "civica-per-"));
  process.env.ANALYTICS_LOCAL_PARQUET_DIR = workDir;

  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();

  for (const fy of [2023, 2024]) {
    const inputCsv = join(FIXTURE_DIR, `${fy}_payment_error_rates.csv`);
    const outputParquet = join(workDir, "per", `fy=${fy}`, "by_state.parquet");
    await mkdir(dirname(outputParquet), { recursive: true });
    const rowCount = await buildOne(conn, { inputCsv, outputParquet, fiscalYear: fy });
    const sidecar = {
      source_url: `data-ops/raw/per/${fy}_payment_error_rates.csv`,
      source_kind: "usda_fns_per",
      publication_date: `FY${fy} publication`,
      fiscal_year: fy,
      pulled_at: new Date().toISOString(),
      sha256_of_source: "fixture-hash",
      parser_path: "data-ops/parsers/per_to_parquet.ts",
      parser_version: "0.1.0",
      row_count: rowCount,
    };
    await writeFile(`${outputParquet}.provenance.json`, JSON.stringify(sidecar));
  }
});

afterAll(async () => {
  delete process.env.ANALYTICS_LOCAL_PARQUET_DIR;
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

describe("paymentErrorRate.byState", () => {
  it("returns all states for an FY when no state filter is supplied", async () => {
    const { rows, provenance } = await byState({ fy: 2024 });
    expect(rows.length).toBe(6);
    expect(provenance).toHaveLength(1);
    expect(provenance[0]?.source_kind).toBe("usda_fns_per");
    expect(provenance[0]?.fiscal_year).toBe(2024);
  });

  it("filters to a single state when state is supplied", async () => {
    const { rows } = await byState({ fy: 2024, state: "CA" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state_code).toBe("CA");
    expect(rows[0]?.per_total).toBeCloseTo(10.98, 2);
  });

  it("is case-insensitive on state code", async () => {
    const { rows } = await byState({ fy: 2024, state: "ny" });
    expect(rows[0]?.state_code).toBe("NY");
  });
});

describe("paymentErrorRate.trend", () => {
  it("returns a sorted FY series for one state with deltas", async () => {
    const { rows, provenance } = await trend({ stateCode: "CA", fyRange: [2023, 2024] });
    expect(rows.map((r) => r.fiscal_year)).toEqual([2023, 2024]);
    expect(rows[0]?.trend_delta).toBeUndefined();
    expect(rows[1]?.trend_delta).toBeCloseTo(10.98 - 9.84, 2);
    expect(provenance).toHaveLength(2);
  });

  it("silently skips missing FYs rather than throwing", async () => {
    // FY2022 fixture isn't loaded; FY2023+2024 are.
    const { rows } = await trend({ stateCode: "CA", fyRange: [2022, 2024] });
    expect(rows.map((r) => r.fiscal_year)).toEqual([2023, 2024]);
  });

  it("rejects an inverted fyRange", async () => {
    await expect(trend({ stateCode: "CA", fyRange: [2024, 2023] })).rejects.toThrow();
  });
});
