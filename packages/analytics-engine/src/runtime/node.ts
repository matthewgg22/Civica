import type { DuckDBConnection } from "@duckdb/node-api";
import type { z, ZodTypeAny } from "zod";
import { getDuckDBConnection } from "./duckdb-client";
import { ProvenanceSchema, type Provenance } from "../schemas";

const BUCKET = "civica-analytics";

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
  const conn = await getDuckDBConnection();
  const dataS3 = s3Path(bucketPath);
  const sidecarS3 = s3Path(`${bucketPath}.provenance.json`);

  const dataReader = await conn.runAndReadAll(
    `SELECT * FROM read_parquet('${esc(dataS3)}');`,
  );
  const rows = dataReader.getRowObjects().map((row: Record<string, unknown>) => schema.parse(row));

  // DuckDB can read JSON over httpfs with read_json_auto; one row, one struct.
  const sidecarReader = await conn.runAndReadAll(
    `SELECT * FROM read_json_auto('${esc(sidecarS3)}', maximum_object_size = 1048576);`,
  );
  const [provRow] = sidecarReader.getRowObjects();
  if (!provRow) {
    throw new Error(`Missing provenance sidecar for s3://${BUCKET}/${bucketPath}`);
  }
  const provenance = ProvenanceSchema.parse({ ...provRow, bucket_path: bucketPath });

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

function esc(v: string): string {
  return v.replaceAll("'", "''");
}

export type { DuckDBConnection };
export { getDuckDBConnection };
