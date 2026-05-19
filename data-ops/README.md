# data-ops/

Source artifacts and parsers for Civica's analytical tier (Tier 3 in
[docs/data-architecture.md](../docs/data-architecture.md)). Mirrors the
`civica-analytics` Supabase Storage bucket layout but holds the inputs
and the code that turns them into Parquet.

## Layout

```
raw/         immutable downloads (PDFs, CSVs, FOIA responses)        — NOT committed
parsers/     idempotent CSV/PDF → Parquet scripts                    — committed
parquet/     local Parquet outputs before upload                     — NOT committed
derived/     tiny rollups (a few KB) that ride along with code        — committed
manifests/   refresh cadence + source inventory (YAML, hand-curated) — committed
PROVENANCE.md   human-readable source ledger                          — committed
METHODOLOGY.md  append-only analytical decision log                   — committed
```

`raw/` and `parquet/` are gitignored (`data-ops/.gitignore`). They live
in Supabase Storage instead — pushed by `scripts/sync-to-supabase-storage.ts`.

## Workflow

1. Drop a source file under `data-ops/raw/<dataset>/...`
2. Add or update a parser under `data-ops/parsers/<dataset>_to_parquet.{ts,py}`
3. Run the parser → emits `data-ops/parquet/<bucket-path>` + `.provenance.json` sidecar
4. `pnpm tsx scripts/sync-to-supabase-storage.ts` → uploads everything new
5. Query through `@civica/analytics-engine` (Node) or `duckdb` CLI

## Operator runbook — loading Matthew's Desktop data

Session C (this PR) ships parsers for three external sources. They auto-detect
missing raw files and no-op gracefully; you only need to copy the files Matthew
already has on Desktop.

### 1. PER (USDA SNAP Payment Error Rate)

```sh
# From the repo root, with the worktree as cwd:
mkdir -p data-ops/raw/per
cp ~/Desktop/Civica\ USDA\ data/per/2024_payment_error_rates.csv \
   data-ops/raw/per/2024_payment_error_rates.csv
# Optional: add prior years to enable analytics.paymentErrorRate.trend()
cp ~/Desktop/Civica\ USDA\ data/per/2023_payment_error_rates.csv \
   data-ops/raw/per/2023_payment_error_rates.csv
pnpm data:build:per
```

The parser is forgiving on column names — `state_code`/`state`/`postal_code`,
`per_total`/`payment_error_rate`/`combined_payment_error_rate`, etc. — see
`data-ops/raw/per/README.md` for the alias list. Output:
`data-ops/parquet/per/fy={YYYY}/by_state.parquet` (+ `.provenance.json`).

### 2. §10105 cliff (already wired in T10 phase 1)

```sh
mkdir -p data-ops/raw/section-10105
cp ~/Desktop/Civica\ USDA\ data/civica_state_liability_fy24.csv \
   data-ops/raw/section-10105/civica_state_liability_fy24.csv
cp ~/Desktop/Civica\ USDA\ data/data/state_liability_fy28_adjusted.csv \
   data-ops/raw/section-10105/state_liability_fy28_adjusted.csv
pnpm data:build:section-10105
```

### 3. OBBBA scenarios

```sh
mkdir -p data-ops/raw/obbba-scenarios
cp ~/Desktop/Civica\ USDA\ data/obbba_rollup.json \
   data-ops/raw/obbba-scenarios/obbba_rollup.json
pnpm data:build:obbba-scenarios
```

If the Desktop file is a different name (e.g. `obbba_scenarios.json`), just
rename it to `obbba_rollup.json` — the parser path is fixed. Schema is
documented in `data-ops/raw/obbba-scenarios/README.md`.

### 4. CFR-273 + QC mapping (no Desktop copy needed)

Both source CSVs ship in the repo. Just rebuild:

```sh
pnpm data:build:cfr-273
pnpm data:build:qc-mapping
```

### 5. Build everything, then push to Supabase Storage

```sh
pnpm data:build:all

# One-time per machine: set credentials. See .env.example.
export SUPABASE_URL='https://<ref>.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='<service role key>'

# Dry-run first to confirm the file list:
pnpm data:sync -- --dry-run
pnpm data:sync
```

The sync script is idempotent — it sha256-compares each local file against
the remote and skips matches. Safe to re-run after every parser run.

### 6. Verify the analytics-engine reads it

```sh
# Set the DuckDB-over-S3 credentials (separate from service-role keys above).
# See packages/analytics-engine/src/runtime/duckdb-client.ts.
export SUPABASE_S3_ENDPOINT='https://<ref>.supabase.co/storage/v1/s3'
export SUPABASE_S3_ACCESS_KEY='<storage access key>'
export SUPABASE_S3_SECRET='<storage secret>'

# Smoke-test from a quick node script or REPL:
node --input-type=module -e "
  import('@civica/analytics-engine').then(async (m) => {
    const r = await m.analytics.paymentErrorRate.byState({ fy: 2024 });
    console.log(r.rows.length, 'states; provenance:', r.provenance[0]?.source_kind);
  });
"
```

## See also

- [PROVENANCE.md](./PROVENANCE.md) — source ledger (lift from `~/Desktop/Civica USDA data/PROVENANCE.md`)
- [METHODOLOGY.md](./METHODOLOGY.md) — analytical decision log
- [SMOKE_TEST.md](./SMOKE_TEST.md) — DuckDB ↔ Supabase Storage round-trip verification
- [manifests/refresh-cadence.yaml](./manifests/refresh-cadence.yaml) — what refreshes when
- [manifests/source-inventory.yaml](./manifests/source-inventory.yaml) — machine-readable PROVENANCE
