#!/usr/bin/env tsx
/**
 * sync-to-supabase-storage.ts
 *
 * Mirrors `data-ops/parquet/` (and any sidecar `.parquet.provenance.json`)
 * to the `civica-analytics` Supabase Storage bucket. Idempotent: skips
 * files whose sha256 matches the object already in the bucket.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   pnpm tsx scripts/sync-to-supabase-storage.ts [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const BUCKET = "civica-analytics";

const dryRun = process.argv.includes("--dry-run");

/**
 * Optional `--prefix <name>` (default: none). When passed, walks
 * `data-ops/<prefix>/parquet/` instead of `data-ops/parquet/` and uploads
 * each file to `<prefix>/<relative-path>` inside the bucket.
 *
 * Used by `pnpm data:sync -- --prefix sample` so demo data lands at
 * `sample/per/fy=2024/by_state.parquet` etc., never colliding with the
 * real-data layout at the bucket root.
 */
function parsePrefix(): string | null {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--prefix" && i + 1 < argv.length) return argv[i + 1] ?? null;
    if (arg.startsWith("--prefix=")) return arg.slice("--prefix=".length);
  }
  return null;
}

const PREFIX = parsePrefix();
const LOCAL_ROOT = PREFIX
  ? join(process.cwd(), "data-ops", PREFIX, "parquet")
  : join(process.cwd(), "data-ops", "parquet");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. See .env.example.",
  );
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function remoteSha(path: string): Promise<string | null> {
  // Supabase Storage doesn't expose ETag-as-sha; we round-trip via download.
  // Cheap enough for week-1 datasets; switch to manifest if it gets slow.
  const { data, error } = await client.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return sha256(buf);
}

async function main() {
  let exists = false;
  try {
    await stat(LOCAL_ROOT);
    exists = true;
  } catch {
    /* fallthrough */
  }
  if (!exists) {
    console.log(`No local parquet to sync (${LOCAL_ROOT} missing). Done.`);
    return;
  }

  let uploaded = 0;
  let skipped = 0;
  for await (const file of walk(LOCAL_ROOT)) {
    const relPath = relative(LOCAL_ROOT, file);
    const remotePath = PREFIX ? `${PREFIX}/${relPath}` : relPath;
    const buf = await readFile(file);
    const localHash = sha256(buf);

    const remoteHash = await remoteSha(remotePath);
    if (remoteHash === localHash) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] upload ${remotePath} (${buf.length} bytes)`);
      uploaded++;
      continue;
    }

    const contentType = file.endsWith(".json")
      ? "application/json"
      : file.endsWith(".parquet")
        ? "application/vnd.apache.parquet"
        : "application/octet-stream";

    const { error } = await client.storage.from(BUCKET).upload(remotePath, buf, {
      upsert: true,
      contentType,
    });
    if (error) {
      console.error(`FAIL ${remotePath}: ${error.message}`);
      process.exitCode = 1;
      continue;
    }
    console.log(`uploaded ${remotePath}`);
    uploaded++;
  }

  console.log(`\n${uploaded} uploaded, ${skipped} unchanged.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
