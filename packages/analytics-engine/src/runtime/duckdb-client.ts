import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

/**
 * Lazily-initialized in-process DuckDB connection wired to Supabase Storage
 * via the CREATE SECRET pattern in docs/data-architecture.md.
 *
 * Required env (server runtime only):
 *   SUPABASE_S3_ENDPOINT   e.g. https://<ref>.supabase.co/storage/v1/s3
 *   SUPABASE_S3_ACCESS_KEY
 *   SUPABASE_S3_SECRET
 *   SUPABASE_S3_REGION     defaults to us-east-1
 *
 * Reuses one DuckDB instance per process. Cold start ~200 ms.
 */

let cached: Promise<DuckDBConnection> | null = null;

export function getDuckDBConnection(): Promise<DuckDBConnection> {
  if (cached) return cached;
  cached = init();
  return cached;
}

async function init(): Promise<DuckDBConnection> {
  const endpoint = required("SUPABASE_S3_ENDPOINT");
  const key = required("SUPABASE_S3_ACCESS_KEY");
  const secret = required("SUPABASE_S3_SECRET");
  const region = process.env.SUPABASE_S3_REGION ?? "us-east-1";

  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();

  await conn.run(`INSTALL httpfs;`);
  await conn.run(`LOAD httpfs;`);
  await conn.run(`
    CREATE OR REPLACE SECRET supabase_storage (
      TYPE S3,
      KEY_ID '${esc(key)}',
      SECRET '${esc(secret)}',
      ENDPOINT '${esc(stripScheme(endpoint))}',
      REGION '${esc(region)}',
      URL_STYLE 'path',
      USE_SSL true
    );
  `);
  return conn;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `[@civica/analytics-engine] Missing env ${name}. See docs/data-architecture.md § DuckDB credentials.`,
    );
  }
  return v;
}

function esc(v: string): string {
  return v.replaceAll("'", "''");
}

/** DuckDB's S3 ENDPOINT wants host[:port], not a full URL. */
function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
