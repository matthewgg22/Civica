# Smoke test — DuckDB ↔ Supabase Storage round-trip

> Run this once after the bucket migration lands and after pulling fresh
> S3 credentials. It proves the Tier 3 pipe is wired up before any code
> depends on it. Per docs/data-architecture.md build order: this is step 2.
> **Do not proceed past this if it does not pass.** Report blocker.

## Prerequisites

1. Migration `20260535_civica_analytics_bucket.sql` applied (creates the bucket).
2. S3 credentials generated in Supabase dashboard → Project Settings → Storage → S3 Connection.
3. Credentials exported to your shell:
   ```sh
   export SUPABASE_S3_ENDPOINT='https://<project-ref>.supabase.co/storage/v1/s3'
   export SUPABASE_S3_ACCESS_KEY='<from dashboard>'
   export SUPABASE_S3_SECRET='<from dashboard>'
   export SUPABASE_S3_REGION='us-east-1'
   export SUPABASE_SERVICE_ROLE_KEY='<from dashboard>'  # for the upload step
   ```
4. `duckdb` CLI installed: `brew install duckdb` (≥ v1.1).

## Steps

### 1. Make a tiny CSV → Parquet locally

```sh
cd /tmp
cat > foo.csv <<'CSV'
state,per_total
CA,10.98
NY,14.09
TX,12.41
CSV
duckdb -c "COPY (FROM 'foo.csv') TO 'foo.parquet' (FORMAT PARQUET);"
ls -la foo.parquet  # ~1KB expected
```

### 2. Upload manually via Supabase dashboard

Storage → `civica-analytics` → `+ Create folder` → name `_smoke` → upload
`/tmp/foo.parquet` into it. Confirm the object lists at path `_smoke/foo.parquet`.

### 3. Query from `duckdb` CLI

```sh
duckdb <<SQL
INSTALL httpfs;
LOAD httpfs;
CREATE SECRET supabase_storage (
  TYPE S3,
  KEY_ID '$SUPABASE_S3_ACCESS_KEY',
  SECRET '$SUPABASE_S3_SECRET',
  ENDPOINT '$(echo "$SUPABASE_S3_ENDPOINT" | sed -e 's|^https://||')',
  REGION '$SUPABASE_S3_REGION',
  URL_STYLE 'path',
  USE_SSL true
);
SELECT * FROM read_parquet('s3://civica-analytics/_smoke/foo.parquet');
SQL
```

Expected output:

```
┌─────────┬───────────┐
│  state  │ per_total │
│ varchar │   double  │
├─────────┼───────────┤
│ CA      │     10.98 │
│ NY      │     14.09 │
│ TX      │     12.41 │
└─────────┴───────────┘
```

### 4. Cleanup

Delete `_smoke/foo.parquet` from the bucket via dashboard. Or leave it —
it's 1 KB.

## Success criteria

- Steps 2 and 3 complete with the expected table output.
- No `HTTP 403` (creds wrong), no `HTTP 404` (bucket name typo), no SSL
  errors (URL scheme).

## If it fails

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `HTTP 403 Forbidden` | Wrong access key or secret | Regenerate creds in dashboard; re-export. |
| `HTTP 404 NoSuchBucket` | Migration didn't apply | Apply `supabase/migrations/20260535_civica_analytics_bucket.sql`. |
| `IO Error: Connection refused` | Endpoint wrong | Endpoint is `https://<ref>.supabase.co/storage/v1/s3` — the project ref, not the project URL. |
| `Invalid argument: ENDPOINT must be host:port` | Schema in endpoint | DuckDB wants the host only; strip `https://`. |
| Empty result set | Parquet uploaded to wrong path | Re-check the bucket folder; path is case-sensitive. |

## After passing

Proceed to step 3 (data-ops scaffold) and step 4 (first dataset
end-to-end) in docs/data-architecture.md.

Once the FY24 cliff dataset is in the bucket:

```sh
pnpm tsx data-ops/parsers/section_10105_to_parquet.ts
pnpm tsx scripts/sync-to-supabase-storage.ts
# Then load /tools/cliff-preview?devtools=1 in the dashboard with
# ENABLE_ANALYTICS_PREVIEW=1 in the dashboard env.
```
