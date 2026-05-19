import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFromInput } from "../../../../data-ops/parsers/obbba_scenarios_to_parquet";
import { compare } from "./obbbaScenarios";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(
  HERE,
  "..",
  "..",
  "..",
  "..",
  "data-ops",
  "test",
  "fixtures",
  "obbba-scenarios",
  "obbba_rollup.json",
);

let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "civica-obbba-"));
  process.env.ANALYTICS_LOCAL_PARQUET_DIR = workDir;
  const outputParquet = join(workDir, "obbba-scenarios", "obbba_rollup.parquet");
  const { rowCount, sidecarPath, publicationDate, modelVersion } = await buildFromInput({
    inputJsonPath: FIXTURE,
    outputParquetPath: outputParquet,
  });
  await writeFile(
    sidecarPath,
    JSON.stringify({
      source_url: "data-ops/raw/obbba-scenarios/obbba_rollup.json",
      source_kind: "cbo_distributional",
      publication_date: publicationDate,
      pulled_at: new Date().toISOString(),
      sha256_of_source: "fixture-hash",
      parser_path: "data-ops/parsers/obbba_scenarios_to_parquet.ts",
      parser_version: "0.1.0",
      row_count: rowCount,
      notes: `model_version=${modelVersion}`,
    }),
  );
});

afterAll(async () => {
  delete process.env.ANALYTICS_LOCAL_PARQUET_DIR;
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

describe("obbbaScenarios.compare", () => {
  it("returns all rollup rows when no filter is supplied", async () => {
    const { rows, provenance } = await compare();
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r.scenario))).toEqual(
      new Set(["baseline", "mid", "aggressive"]),
    );
    expect(provenance[0]?.source_kind).toBe("cbo_distributional");
  });

  it("filters by metric", async () => {
    const { rows } = await compare({ metric: "fy29_annualized_state_liability_billions" });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.metric === "fy29_annualized_state_liability_billions")).toBe(true);
  });

  it("returns empty rows (not an error) for an unknown metric", async () => {
    const { rows } = await compare({ metric: "nonexistent_metric" });
    expect(rows).toHaveLength(0);
  });
});
