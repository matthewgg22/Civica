// Civica-emit QC evaluation reader — TODO-5 / T8 shadow-mode instrumentation.
//
// Reads JSON-per-event objects from `civica-analytics/civica-emit/qc-evaluations/`
// written by apps/enrollment-api/src/lib/scoring.ts:emitQcEvaluation.
//
// MVP read model: DuckDB glob over httpfs reads the whole partition tree
// (`date=*/*.json`), Zod-validates each row, then filters by org_id in process.
// At pilot volume (<100 events) this is plenty; push filtering into DuckDB
// when row counts cross ~10k.
//
// Local override for tests: when ANALYTICS_LOCAL_PARQUET_DIR is set, the
// reader walks the local filesystem instead of httpfs. Same shape, no
// network, no DuckDB cold start.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  QcEvaluationSchema,
  ProvenanceSchema,
  type QcEvaluation,
  type Result,
} from "../schemas";
import { getDuckDBConnection, s3Path } from "../runtime/node";

const BUCKET_PREFIX = "civica-emit/qc-evaluations";

/**
 * All QC evaluation events for one org, in `emitted_at` ascending order.
 *
 * Empty array when the bucket prefix has no events yet (pre-pilot).
 * Throws when the partition tree exists but rows fail schema validation —
 * a hard signal that the emit schema drifted without a `schema_version` bump.
 */
export async function qcEvaluationsByOrg(opts: {
  orgId: string;
}): Promise<Result<QcEvaluation>> {
  const orgId = opts.orgId;
  const localDir = process.env.ANALYTICS_LOCAL_PARQUET_DIR;
  const rawRows = localDir
    ? await readJsonGlobLocal(localDir)
    : await readJsonGlobHttpfs();

  const allEvents = rawRows.map((r) => QcEvaluationSchema.parse(r));
  const filtered = allEvents
    .filter((ev) => ev.org_id === orgId)
    .sort((a, b) => a.emitted_at.localeCompare(b.emitted_at));

  return {
    rows: filtered,
    provenance: [
      ProvenanceSchema.parse({
        source_url: localDir
          ? `file://${localDir}/${BUCKET_PREFIX}`
          : `s3://civica-analytics/${BUCKET_PREFIX}`,
        source_kind: "civica_qc_evaluation",
        publication_date: new Date().toISOString().slice(0, 10),
        pulled_at: new Date().toISOString(),
        // Bucket reads have no upstream sha; mark synthesized provenance so
        // dashboards can distinguish it from parser-emitted sidecars.
        sha256_of_source: "synthesized-bucket-read",
        parser_path: "packages/analytics-engine/src/datasets/civicaEmit.ts",
        parser_version: "0.1.0",
        row_count: filtered.length,
        bucket_path: BUCKET_PREFIX,
        notes:
          "Live bucket read. Scanned all date=* partitions and filtered " +
          `by org_id=${orgId} in process.`,
      }),
    ],
  };
}

async function readJsonGlobHttpfs(): Promise<unknown[]> {
  const conn = await getDuckDBConnection();
  const glob = s3Path(`${BUCKET_PREFIX}/date=*/*.json`);
  // union_by_name keeps the column set wide enough to accept schema-version
  // drift across partitions; Zod's parse below catches anything materially
  // broken before it reaches a consumer.
  const sql = `SELECT * FROM read_json_auto('${esc(glob)}', union_by_name=true, maximum_object_size=1048576);`;
  try {
    const reader = await conn.runAndReadAll(sql);
    return reader.getRowObjects().map(coerceBigInts);
  } catch (err) {
    // Empty bucket / no matching partitions is the expected pre-pilot state.
    // DuckDB throws "No files found that match the pattern" — swallow it
    // and return [] so the caller renders cleanly.
    const msg = err instanceof Error ? err.message : String(err);
    if (/no files found|cannot list/i.test(msg)) return [];
    throw err;
  }
}

async function readJsonGlobLocal(localDir: string): Promise<unknown[]> {
  const root = join(localDir.replace(/\/$/, ""), BUCKET_PREFIX);
  const out: unknown[] = [];
  let partitions: string[];
  try {
    partitions = await readdir(root);
  } catch {
    return [];
  }
  for (const part of partitions) {
    if (!part.startsWith("date=")) continue;
    const dir = join(root, part);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const body = await readFile(join(dir, f), "utf8");
      out.push(JSON.parse(body));
    }
  }
  return out;
}

function esc(v: string): string {
  return v.replaceAll("'", "''");
}

function coerceBigInts(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (Array.isArray(value)) return value.map(coerceBigInts);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = coerceBigInts(v);
    }
    return out;
  }
  return value;
}
