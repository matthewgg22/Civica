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

## See also

- [PROVENANCE.md](./PROVENANCE.md) — source ledger (lift from `~/Desktop/Civica USDA data/PROVENANCE.md`)
- [METHODOLOGY.md](./METHODOLOGY.md) — analytical decision log
- [SMOKE_TEST.md](./SMOKE_TEST.md) — DuckDB ↔ Supabase Storage round-trip verification
- [manifests/refresh-cadence.yaml](./manifests/refresh-cadence.yaml) — what refreshes when
- [manifests/source-inventory.yaml](./manifests/source-inventory.yaml) — machine-readable PROVENANCE
