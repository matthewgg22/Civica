# Data Architecture — Civica Analytical Tier

**Status:** LOCKED 2026-05-18 via /plan-eng-review T10 design pass
**Pattern:** Three-tier (operational / reference / analytical); Supabase end-to-end
**Owner:** Coordinator session (claude/clever-albattani-816917)

## Summary

Civica's data lives in three tiers, each with different lifecycle and access patterns. This document specs the analytical tier (Tier 3) — the home for external data (USDA payment error rates, OBBBA scenario models, CFR-273 rule index, FOIA / state-FOIA responses, ACS PUMS slices) and Civica-emitted analytical exports (QC evaluation events for pilot instrumentation).

Storage: Cloudflare R2 was considered; **Supabase Storage chosen** to stay within one vendor (existing Supabase project, one auth model, one bill). Query engine: **DuckDB** — runs anywhere, reads Parquet over S3-compatible HTTP, has a Postgres extension for cross-tier joins to operational data on the same Supabase project.

This document is the spec consumed by T10 (build session). T4, T5, T7, T8 consume the typed `@civica/analytics-engine` API surface defined below.

## Three tiers (recap)

| Tier | Purpose | Storage | Lifecycle |
|------|---------|---------|-----------|
| 1 — Operational | Live applicant data, audit trail | Supabase Postgres (`snap_enrollment` schema) | Hot, transactional, RLS-gated, append-only audit |
| 2 — Reference | Versioned code-shaped data (rules, copy, types) | `packages/*` in repo | Versioned with code releases; small (KB to MB) |
| 3 — Analytical | External datasets + Civica-emit analytical exports | Supabase Storage + DuckDB | Cold reads; refreshed on source-publish cadence |

Operational data never goes through Tier 3. Analytical data never goes into Tier 1. Reference data is what flows between them as versioned code.

## Storage layout — `civica-analytics` bucket

One Supabase Storage bucket. Prefix-namespaced. Service-role for write; controlled read.

```
civica-analytics/
├── per/                                          USDA payment error rates
│   ├── fy=2024/by_state.parquet                  (Hive-partitioned by FY)
│   ├── fy=2024/by_state.parquet.provenance.json
│   ├── fy=2025/by_state.parquet
│   └── fy=2025/by_state.parquet.provenance.json
│
├── benefits/                                     state federal benefit totals
│   ├── fy=2024/by_state_annual.parquet
│   └── fy=2024/by_state_monthly.parquet
│
├── qc-microdata/                                 USDA QC public-use microdata
│   ├── fy=2020/cases.parquet
│   ├── fy=2021/cases.parquet
│   ├── fy=2022/cases.parquet
│   └── fy=2023/cases.parquet
│
├── state-options/                                State Options Report
│   └── edition=17/by_state_by_option.parquet
│
├── cfr-273/                                      Rule index (mirror of packages/cfr-273)
│   └── ecfr=2026-05-08/rule_index.parquet
│
├── section-10105/                                §10105 cliff calculator outputs
│   ├── fy=2024/state_liability.parquet           (the existing Desktop CSV, productized)
│   └── fy=2028/state_liability_adjusted.parquet
│
├── obbba-scenarios/
│   └── obbba_rollup.parquet                      (the existing Desktop JSON)
│
├── state-foia/{state_code}/                      State FOIA responses
│   └── 2026-05-15-acl-25-68/
│       ├── response.pdf                          (original)
│       ├── extracted.parquet                     (if structured data was extracted)
│       └── metadata.yaml                         (request date, FOIA #, scope, findings)
│
├── federal-foia/
│   └── 2026-04-20-usda-fns-er-stats/
│       ├── response.pdf
│       └── metadata.yaml
│
├── secondary/                                    Context sources (CBO, AEI, NGA)
│   ├── cbo/
│   ├── aei/
│   └── nga/
│
└── civica-emit/                                  Civica's own analytical exports
    └── qc-evaluations/
        └── date=2026-05-20/evaluations.parquet   (T8 territory)
```

## Naming conventions (locked)

### Federal annual datasets — Hive partition by fiscal year
- Path: `{dataset}/fy={YYYY}/{table}.parquet`
- DuckDB reads `read_parquet('s3://civica-analytics/per/fy=*/by_state.parquet', hive_partitioning=1)` and gets the FY column automatically.
- Re-publishing FY24 with corrections: overwrite the file. The `.provenance.json` sidecar records `publication_date` so consumers can detect changes.

### FOIA + state FOIA — date-stamped paths
- Path: `state-foia/{state_code}/{YYYY-MM-DD}-{slug}/...`
- Never overwritten; every FOIA response is its own directory.
- `metadata.yaml` is human-curated (request date, FOIA tracking number, scope, key findings).

### Civica-emit data — date-partitioned
- Path: `civica-emit/{dataset}/date={YYYY-MM-DD}/{table}.parquet`
- Pilot evaluations accumulate; daily files keep them queryable without single-file growth.

## Provenance sidecar (mandatory, every parquet)

Every `.parquet` file has a sibling `.parquet.provenance.json`:

```json
{
  "source_url": "https://www.fns.usda.gov/snap/qc/per",
  "source_kind": "usda_fns_per",
  "publication_date": "2025-06-30",
  "fiscal_year": 2024,
  "pulled_at": "2026-05-18T22:30:00Z",
  "sha256_of_source": "abc123...",
  "parser_path": "data-ops/parsers/per_pdf_to_parquet.py",
  "parser_version": "0.1.0",
  "row_count": 53,
  "notes": "FY24 PER. 50 states + DC + Guam + USVI + national rollup."
}
```

`source_kind` is a controlled vocabulary (`usda_fns_per`, `usda_fns_benefits`, `usda_qc_microdata`, `usda_state_options`, `ecfr_rule_index`, `cbo_distributional`, `state_foia`, `federal_foia`, `nga_compilation`, `aei_secondary`, `civica_qc_evaluation`). Used by analytics-engine to render citation footnotes on dashboards.

## `@civica/analytics-engine` — the typed query API

Package location: `packages/analytics-engine/`

Three runtime adapters:
- `packages/analytics-engine/src/runtime/node.ts` — DuckDB native (server-side: Fly.io engine, Next.js server components, Workers via WASM if needed)
- `packages/analytics-engine/src/runtime/python.ts` — wraps Python parsers
- `packages/analytics-engine/src/runtime/browser.ts` — DuckDB-WASM (**deferred for MVP**, see below)

Every query function returns:

```typescript
type Result<T> = {
  rows: T[];
  provenance: Provenance[];   // one entry per parquet file read
};
```

API surface (initial):

```typescript
analytics.paymentErrorRate.byState({ fy: 2024, state?: 'CA' }): Result<PER>
analytics.paymentErrorRate.trend({ stateCode: 'CA', fyRange: [2020, 2024] }): Result<PERTrend>

analytics.section10105.tierLiability({ scenario: 'baseline'|'mid'|'aggressive', fy: 2028 }): Result<Liability>
analytics.section10105.fy29Cliff(): Result<CliffEntry>

analytics.cfr273.byRelevance({ grade: 'HIGH'|'MEDIUM'|'LOW' }): Result<CfrCitation>
analytics.cfr273.bySection({ section: '273.9' }): Result<CfrCitation>

analytics.qcMicrodata.errorCausesByIncomeSource({ years: number[] }): Result<ErrorCauseRollup>

analytics.stateFoia.byState({ stateCode: 'CA' }): Result<FoiaIndex>
analytics.federalFoia.list(): Result<FoiaIndex>

analytics.obbbaScenarios.compare(): Result<ScenarioRow>

analytics.civicaEmit.qcEvaluations.byOrg({ orgId: 'civica' }): Result<QcEvaluation>  // T8 consumer
```

Schema types (Zod) live at `packages/analytics-engine/src/schemas.ts`. **Schemas are discovered during parser implementation** — the parser sees actual source data and the schema reflects that. The API surface above is the contract; column names within each row type can evolve in T10's build phase as parsers are written.

## DuckDB credentials pattern

**Server runtimes (Node, Python):**

Env vars:
- `SUPABASE_S3_ENDPOINT` (e.g. `https://<project-ref>.supabase.co/storage/v1/s3`)
- `SUPABASE_S3_ACCESS_KEY`
- `SUPABASE_S3_SECRET`
- `SUPABASE_S3_REGION` (default `us-east-1`; Supabase requires a region even if unused)

DuckDB init:

```sql
INSTALL httpfs;
LOAD httpfs;
CREATE SECRET supabase_storage (
  TYPE S3,
  KEY_ID '${SUPABASE_S3_ACCESS_KEY}',
  SECRET '${SUPABASE_S3_SECRET}',
  ENDPOINT '${SUPABASE_S3_ENDPOINT}',
  REGION '${SUPABASE_S3_REGION}',
  URL_STYLE 'path'
);
```

After CREATE SECRET, queries use `read_parquet('s3://civica-analytics/...')` transparently.

**Browser runtime (DuckDB-WASM):** DEFERRED for MVP. When promoted, will use Supabase Edge Function returning signed URLs scoped to specific files; browser never sees service-role creds.

## Multi-tenant rule for Tier 3

Per [docs/multi-tenant-design.md](./multi-tenant-design.md):

- **External / public datasets** (USDA, FOIA, CFR, CBO, AEI, NGA) are tenant-agnostic. No `org_id` column.
- **Civica-emit datasets** (`civica-emit/qc-evaluations/`) include an `org_id` column on every row. For MVP all rows are `'civica'`. Cross-tenant aggregations are simple `GROUP BY org_id`.

## Cross-tier joins (Postgres ↔ Parquet)

DuckDB's `postgres_scanner` extension reads Supabase Postgres directly. Same Supabase project = no FDW dance. Example: rolling up shadow-mode pilot evaluations against state-level FY24 PER in one query:

```sql
SELECT
  pkt.org_id,
  per.state_code,
  per.per_total,
  COUNT(eval.evaluation_id) AS evaluations,
  AVG(eval.defensibility_score_numeric) AS avg_defensibility
FROM postgres_scan('host=... dbname=postgres', 'snap_enrollment', 'snap_packets') pkt
JOIN read_parquet('s3://civica-analytics/per/fy=2024/by_state.parquet') per
  ON pkt.state_code = per.state_code
JOIN read_parquet('s3://civica-analytics/civica-emit/qc-evaluations/date=*/evaluations.parquet') eval
  ON pkt.packet_id = eval.packet_id
WHERE pkt.org_id = current_setting('app.current_org_id')
GROUP BY pkt.org_id, per.state_code, per.per_total;
```

This is the shape that T5 (state-facing surface) eventually runs to render per-state evaluation summaries.

## `data-ops/` workspace layout

Lives at repo root. Mirrors the bucket structure but for source artifacts + parsers.

```
data-ops/
├── raw/                          immutable downloads → R2-equivalent in Supabase Storage
│   ├── usda-per/fy24/snap-fy24QC-PER.pdf
│   ├── usda-qc-microdata/
│   ├── state-foia/ca-cdss/...
│   └── federal-foia/...
│   (NOT committed; synced via scripts/sync-to-supabase-storage.ts)
│
├── parsers/                      idempotent, hash-skip
│   ├── per_pdf_to_parquet.py
│   ├── qc_microdata_to_parquet.py
│   ├── state_options_to_parquet.py
│   ├── cfr_273_csv_to_parquet.ts  (your existing CSV → parquet)
│   ├── obbba_scenarios_to_parquet.ts
│   ├── section_10105_to_parquet.ts
│   └── foia_pdf_extract.py        (OCR + structured extract)
│
├── parquet/                      intermediate local builds before upload
│   (NOT committed; ephemeral)
│
├── derived/                      tiny rollups; committed because tiny
│   ├── state_liability_fy24.csv
│   └── obbba_rollup.json
│
├── manifests/
│   ├── refresh-cadence.yaml      what refreshes when, expected next pull
│   └── source-inventory.yaml     machine-readable PROVENANCE
│
├── PROVENANCE.md                 human-readable; same shape as ~/Desktop/Civica USDA data/PROVENANCE.md
└── METHODOLOGY.md                append-only decision log; same shape
```

`PROVENANCE.md` and `METHODOLOGY.md` patterns lift from the existing Desktop workspace — that discipline is already correct. They get mirrored here as the repo home.

## Build order for T10 (week 1)

1. **Create the bucket + storage policy** (Supabase dashboard or migration `20260535_civica_analytics_bucket.sql`)
2. **Smoke test DuckDB read.** Local: convert one CSV to Parquet, upload manually, query from `duckdb` CLI. Confirms creds + endpoint + Parquet round-trip.
3. **Scaffold `data-ops/`** workspace + `scripts/sync-to-supabase-storage.ts`.
4. **Migrate one dataset end-to-end.** Recommended starter: §10105 cliff (`civica_state_liability_fy24.csv` from Desktop → Parquet → upload → query). Smallest, already validated, immediately useful for T5.
5. **Scaffold `packages/analytics-engine/`** with the typed surface above. Wire Node runtime first.
6. **Stand up `packages/cfr-273/`** as Tier 2 reference (the 223-row rule index). Add a build script that emits both `packages/cfr-273/dist/rules.json` (Tier 2 code shape) AND `civica-analytics/cfr-273/ecfr=2026-05-08/rule_index.parquet` (Tier 3 mirror for analytical joins).
7. **Add one server-side query call from somewhere** (a Next.js server component in `apps/dashboard/app/`, gated behind a feature flag) that proves end-to-end pipe. Suggested: a `/tools/cliff-preview` page that renders `analytics.section10105.fy29Cliff()` as a table.

By end of week 1 of T10: one dataset queryable through the typed API, rendering in a real surface, with provenance footnotes. The rest of T10 (other datasets, other parsers) is repeating the pattern.

## What this design does NOT include (deferred)

- **Browser-side DuckDB-WASM + signed URLs.** Server-rendered for MVP. Revisit when T5 needs interactive client-side queries.
- **Full automation of parser scheduling.** Cron jobs or GitHub Actions for refresh cadence — not in MVP. Manual `pnpm run sync-data` is fine for the first months.
- **Materialized views / pre-aggregations in Supabase.** All aggregation runs in DuckDB at query time. Add caching only when something measurably slow.
- **Cross-machine analytical sharing.** Single Supabase Storage is the source of truth; if a teammate joins, they get read access to the bucket via Supabase Auth.
- **Backups beyond Supabase's native.** Defer until pilot evidence is regulatorily load-bearing.

## Sign-off

Locked in `/plan-eng-review` coordinator session 2026-05-18. T10 design deliverable complete. Spawned T10 build session consumes this document as authoritative spec.
