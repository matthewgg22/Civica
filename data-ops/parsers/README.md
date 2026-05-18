# Parsers

Convert raw artifacts in `../raw/` to Parquet under `../parquet/` (mirrors
the `civica-analytics` bucket layout). Every parser emits a sibling
`.parquet.provenance.json` sidecar per `docs/data-architecture.md`.

## Conventions

- Idempotent. Skip if the output exists and the source `sha256` hasn't changed.
- TS parsers: run with `pnpm tsx data-ops/parsers/<name>.ts`.
- Python parsers (PDFs, OCR): create a venv under `data-ops/.venv/` and
  document required pip packages at the top of the script.
- Always write the sidecar (`source_kind`, `publication_date`, `pulled_at`,
  `sha256_of_source`, `parser_path`, `parser_version`, `row_count`).

## Implemented

- `section_10105_to_parquet.ts` — Civica §10105 cliff (FY24 baseline + FY28 multi-scenario)

## Stubbed (T10 phase 2)

- `per_pdf_to_parquet.py` — USDA PER PDF tables
- `qc_microdata_to_parquet.py` — USDA QC microdata
- `state_options_to_parquet.py` — State Options Report
- `obbba_scenarios_to_parquet.ts` — OBBBA scenario rollup JSON
- `foia_pdf_extract.py` — FOIA response OCR + extract
