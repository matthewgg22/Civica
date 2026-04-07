# VoteNow Metrics Data Ingestion

This project includes a reproducible ingestion pipeline for the VoteNow voter participation metrics workbook.

## Source Workbook

- Canonical input (expected by default workflow):
  - `data/source/votenow_voter_participation_metrics_catalog_v3.xlsx`

The ingestion script reads the workbook, validates required sheets/columns, normalizes values, and writes derived artifacts for app/API consumers.

## Prerequisites

- Python 3.10+
- Packages:
  - `pandas`
  - `openpyxl`
  - `pytest` (for tests)

Example:

```bash
pip install pandas openpyxl pytest
```

## Run Ingestion

```bash
python scripts/ingest_votenow_metrics.py \
  --input data/source/votenow_voter_participation_metrics_catalog_v3.xlsx \
  --out data/derived
```

If your environment only has `python3`, use:

```bash
python3 scripts/ingest_votenow_metrics.py --input data/source/votenow_voter_participation_metrics_catalog_v3.xlsx --out data/derived
```

## Generated Artifacts

- `data/derived/metrics.json`
  - `Metric_Catalog` joined with `Metric_Copy_Blocks` on `metric_id`
  - includes provenance fields from catalog plus `copy_*` provenance columns from copy blocks
- `data/derived/geos.json`
  - normalized `Geos` sheet
- `data/derived/geo_metric_long.jsonl`
  - one JSON object per line
  - typed checks enforced:
    - `value_year` integer (or `null` when the row has no numeric `value`)
    - `value` float or null
    - `geo_code` non-empty uppercase string
- `data/derived/state_figures_2024.json`
  - normalized state figures sheet
- `data/derived/manifest.json`
  - input file metadata (`input_filename`, `input_sha256`)
  - creation timestamp
  - sheet and output row counts

## Validation Rules

The script fails fast with clear errors when:

- required sheets are missing
- required columns do not match expected schema (order-insensitive, exact set match)
- `metric_id` is duplicated in `Metric_Catalog` or `Metric_Copy_Blocks`
- `Metric_Catalog` and `Metric_Copy_Blocks` do not match on `metric_id`
- `Geo_Metric_Long` violates basic type constraints

## Testing

Run:

```bash
pytest -q
```

Tests generate a tiny fixture workbook in a temporary directory and verify:

- schema enforcement
- join correctness behavior
- manifest hash generation
- JSONL line formatting + typed values

## Consumer Helpers

Optional convenience loaders are available in `votenow_metrics/data.py`:

- `load_metrics()`
- `load_geos()`
- `load_values(year: int | None = None)`

## Absentee/Mail Ballot Request Data

The absentee/mail request directory is sourced from:

- `data/absentee_ballot_request_links_deadlines.xlsx`

Convert it to normalized JSON with:

```bash
python3 scripts/convert_absentee_xlsx_to_json.py \
  --input data/absentee_ballot_request_links_deadlines.xlsx \
  --out data/absentee_ballot_request_links_deadlines.json \
  --bundle-out "WeVote Information Page/Models/absentee_ballot_request_links_deadlines.json"
```

Or use:

```bash
make ingest-absentee
```

Artifacts:

- `data/absentee_ballot_request_links_deadlines.json`
  - canonical derived JSON for repository data workflows
- `WeVote Information Page/Models/absentee_ballot_request_links_deadlines.json`
  - bundled app resource consumed by the “Request Mail-in Ballot” UI

Notes:

- Replace the XLSX first, then run the conversion command, then commit both JSON files.
- Empty spreadsheet cells are converted to `null`.
- Explicit `N/A` values are preserved as `"N/A"`.

## Open States Legislator Sync (Supabase Serving Layer)

For current state legislators sourced from Open States:

- See [`docs/openstates_legislator_sync.md`](./openstates_legislator_sync.md)
- Ingest script: `scripts/ingest_openstates_legislators.py`
- Upsert script: `scripts/upsert_openstates_legislators.py`
