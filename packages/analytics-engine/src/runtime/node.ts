import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { readFile } from "node:fs/promises";
import type { z, ZodTypeAny } from "zod";
import { getDuckDBConnection } from "./duckdb-client";
import { ProvenanceSchema, type Provenance } from "../schemas";

const BUCKET = "civica-analytics";

/**
 * Optional local-filesystem override for tests + CLI workflows that don't
 * want to hit Supabase Storage. When `ANALYTICS_LOCAL_PARQUET_DIR` is set,
 * `readParquetWithProvenance(bucketPath, …)` resolves `bucketPath` relative
 * to that directory and uses a one-shot in-memory DuckDB (no httpfs / no
 * Supabase credentials required).
 *
 * Production reads (Supabase Storage over httpfs) still use the cached
 * `getDuckDBConnection()` and `s3Path()`.
 */
function localDirOverride(): string | null {
  const v = process.env.ANALYTICS_LOCAL_PARQUET_DIR;
  return v && v.length > 0 ? v : null;
}

let localConn: Promise<DuckDBConnection> | null = null;
async function getLocalConnection(): Promise<DuckDBConnection> {
  if (localConn) return localConn;
  localConn = (async () => {
    const instance = await DuckDBInstance.create(":memory:");
    return instance.connect();
  })();
  return localConn;
}

/**
 * Read one parquet object and its sibling `.provenance.json` sidecar.
 * Returns rows validated against `schema` plus the parsed provenance entry.
 *
 * `bucketPath` is the object key inside the civica-analytics bucket
 * (no leading slash, no bucket prefix).
 */
export async function readParquetWithProvenance<S extends ZodTypeAny>(
  bucketPath: string,
  schema: S,
): Promise<{ rows: z.infer<S>[]; provenance: Provenance }> {
  const localDir = localDirOverride();
  if (localDir) {
    return readParquetWithProvenanceLocal(localDir, bucketPath, schema);
  }
  const conn = await getDuckDBConnection();
  const dataS3 = s3Path(bucketPath);
  const sidecarS3 = s3Path(`${bucketPath}.provenance.json`);

  const dataReader = await conn.runAndReadAll(
    `SELECT * FROM read_parquet('${esc(dataS3)}');`,
  );
  const rows = dataReader
    .getRowObjects()
    .map((row: Record<string, unknown>) => schema.parse(coerceBigInts(row)));

  // DuckDB can read JSON over httpfs with read_json_auto; one row, one struct.
  const sidecarReader = await conn.runAndReadAll(
    `SELECT * FROM read_json_auto('${esc(sidecarS3)}', maximum_object_size = 1048576);`,
  );
  const [provRow] = sidecarReader.getRowObjects();
  if (!provRow) {
    throw new Error(`Missing provenance sidecar for s3://${BUCKET}/${bucketPath}`);
  }
  const provenance = ProvenanceSchema.parse(
    coerceBigInts({ ...provRow, bucket_path: bucketPath }),
  );

  return { rows, provenance };
}

/** Run a raw DuckDB SQL query (cross-tier joins, ad-hoc aggregations). */
export async function rawQuery<S extends ZodTypeAny>(
  sql: string,
  schema: S,
): Promise<z.infer<S>[]> {
  const conn = await getDuckDBConnection();
  const reader = await conn.runAndReadAll(sql);
  return reader.getRowObjects().map((row: Record<string, unknown>) => schema.parse(row));
}

export function s3Path(bucketPath: string): string {
  return `s3://${BUCKET}/${bucketPath}`;
}

/**
 * DuckDB returns BIGINT columns as JS `bigint`. Most of our Zod schemas use
 * `z.number()`. Recursively coerce bigint → number on the row objects before
 * validation. Safe for analytical row counts (always within Number.MAX_SAFE_INTEGER).
 */
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

async function readParquetWithProvenanceLocal<S extends ZodTypeAny>(
  localDir: string,
  bucketPath: string,
  schema: S,
): Promise<{ rows: z.infer<S>[]; provenance: Provenance }> {
  const conn = await getLocalConnection();
  const dataPath = `${localDir.replace(/\/$/, "")}/${bucketPath}`;
  const sidecarPath = `${dataPath}.provenance.json`;
  const dataReader = await conn.runAndReadAll(
    `SELECT * FROM read_parquet('${esc(dataPath)}');`,
  );
  const rows = dataReader.getRowObjects().map((row: Record<string, unknown>) =>
    schema.parse(coerceBigInts(row)),
  );
  // Read the sidecar via plain fs so DuckDB's date auto-detection doesn't
  // hand us Date objects where the schema wants ISO strings.
  let provRow: Record<string, unknown>;
  try {
    provRow = JSON.parse(await readFile(sidecarPath, "utf8"));
  } catch (err) {
    throw new Error(`Missing provenance sidecar at ${sidecarPath}: ${(err as Error).message}`);
  }
  const provenance = ProvenanceSchema.parse({ ...provRow, bucket_path: bucketPath });
  return { rows, provenance };
}

function esc(v: string): string {
  return v.replaceAll("'", "''");
}

export type { DuckDBConnection };
export { getDuckDBConnection };
