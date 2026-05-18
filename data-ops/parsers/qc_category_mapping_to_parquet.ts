#!/usr/bin/env tsx
/**
 * qc_category_mapping_to_parquet.ts
 *
 * Converts `data-ops/derived/qc_category_mapping.yaml` (federal FNS QC ELEMENT
 * codes → Civica controls) to Parquet under
 * `data-ops/parquet/qc-mappings/v1/category_mapping.parquet`, with the
 * mandatory `.parquet.provenance.json` sidecar.
 *
 * Mapping data is global (federal regulation). No org_id partitioning.
 *
 * Run:
 *   pnpm data:build:qc-mapping
 */
import { DuckDBInstance } from "@duckdb/node-api";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";

const PARSER_VERSION = "0.1.0";
const PARSER_PATH = "data-ops/parsers/qc_category_mapping_to_parquet.ts";

const ROOT = process.cwd();
const INPUT_YAML = join(ROOT, "data-ops", "derived", "qc_category_mapping.yaml");
const OUT_PARQUET = join(
  ROOT,
  "data-ops",
  "parquet",
  "qc-mappings",
  "v1",
  "category_mapping.parquet",
);

interface CivicaControl {
  control_id: string;
  control_description: string;
  evidence_link: string;
  defensibility_impact: string;
}

interface CategoryYaml {
  cdss_error_category: string;
  element_code: string;
  weighted_count: number;
  share_of_errored_cases_pct: number;
  cfr_basis: string;
  obbba_section: string;
  dollar_attribution_methodology: string;
  civica_controls: CivicaControl[];
  case_examples: string[];
  status: "documented" | "hypothesized" | "refuted";
}

interface MappingYaml {
  version: number;
  source_publication: string;
  source_pulled_at: string;
  categories: CategoryYaml[];
}

interface FlatRow {
  element_code: string;
  cdss_error_category: string;
  weighted_count: number;
  share_of_errored_cases_pct: number;
  cfr_basis: string;
  obbba_section: string;
  dollar_attribution_methodology: string;
  status: string;
  civica_controls_json: string;
  case_examples_json: string;
  has_civica_control: boolean;
  control_count: number;
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

function flatten(mapping: MappingYaml): FlatRow[] {
  return mapping.categories.map((c) => {
    const controls = c.civica_controls ?? [];
    return {
      element_code: c.element_code,
      cdss_error_category: c.cdss_error_category,
      weighted_count: c.weighted_count,
      share_of_errored_cases_pct: c.share_of_errored_cases_pct,
      cfr_basis: c.cfr_basis,
      obbba_section: c.obbba_section,
      dollar_attribution_methodology: c.dollar_attribution_methodology,
      status: c.status,
      civica_controls_json: JSON.stringify(controls),
      case_examples_json: JSON.stringify(c.case_examples ?? []),
      has_civica_control: c.status === "documented" && controls.length > 0,
      control_count: controls.length,
    };
  });
}

async function main() {
  if (!(await fileExists(INPUT_YAML))) {
    console.error(`MISSING ${INPUT_YAML}`);
    process.exit(1);
  }

  const yamlText = await readFile(INPUT_YAML, "utf8");
  const mapping = parseYaml(yamlText) as MappingYaml;
  const rows = flatten(mapping);

  const inputHash = await sha256(INPUT_YAML);
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

  await mkdir(dirname(OUT_PARQUET), { recursive: true });

  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();

  // Load rows into DuckDB via a JSON intermediate (simplest type-correct path).
  const jsonTmp = `${OUT_PARQUET}.rows.json`;
  await writeFile(jsonTmp, JSON.stringify(rows));
  try {
    const parquetSqlPath = OUT_PARQUET.replaceAll("'", "''");
    const jsonSqlPath = jsonTmp.replaceAll("'", "''");
    await conn.run(
      `COPY (SELECT * FROM read_json_auto('${jsonSqlPath}', maximum_object_size = 16777216)) ` +
        `TO '${parquetSqlPath}' (FORMAT PARQUET);`,
    );

    const countResult = await conn.runAndReadAll(
      `SELECT COUNT(*)::BIGINT AS n FROM read_parquet('${parquetSqlPath}');`,
    );
    const rowCount = Number(countResult.getRows()[0]?.[0] ?? 0);

    const provenance = {
      source_url: "data-ops/derived/qc_category_mapping.yaml",
      source_kind: "civica_qc_mapping",
      publication_date: mapping.source_pulled_at,
      pulled_at: new Date().toISOString(),
      sha256_of_source: inputHash,
      parser_path: PARSER_PATH,
      parser_version: PARSER_VERSION,
      row_count: rowCount,
      notes:
        `Civica-curated mapping from federal FNS QC ELEMENT codes to Civica ` +
        `controls. Underlying error-category ranking source: ${mapping.source_publication}. ` +
        `Schema v${mapping.version}. See data-ops/METHODOLOGY.md (2026-05-18 — QC mapping).`,
    };
    await writeFile(sidecarPath, `${JSON.stringify(provenance, null, 2)}\n`);

    console.log(`built ${OUT_PARQUET} (${rowCount} rows)`);
  } finally {
    try {
      (conn as unknown as { disconnectSync?: () => void }).disconnectSync?.();
    } catch {
      /* DuckDB version may not expose disconnectSync */
    }
    try {
      await (await import("node:fs/promises")).unlink(jsonTmp);
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
