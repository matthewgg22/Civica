# raw/per/

Drop USDA SNAP Payment Error Rate annual CSVs here before running
`data-ops/parsers/per_to_parquet.ts`. Files in this directory are gitignored
— they live in Supabase Storage instead.

## Expected files

One CSV per fiscal year, with a leading 4-digit FY in the filename:

- `2023_payment_error_rates.csv`
- `2024_payment_error_rates.csv`
- `2025_payment_error_rates.csv` (when published)

## Expected schema

CSV header (case-insensitive; the parser normalizes to `snake_case`):

| column | type | notes |
|--------|------|-------|
| `state_code` | string(2) | USPS two-letter code; "DC" allowed |
| `state_name` | string | full state name |
| `fiscal_year` | int | redundant with the filename FY, used as a sanity check |
| `per_total` | float | combined payment error rate (percent, e.g. `10.98`) |
| `per_overpayment` | float | overpayment component (optional) |
| `per_underpayment` | float | underpayment component (optional) |

Extra columns are preserved by `read_csv_auto` but only the validated columns
above are surfaced through `@civica/analytics-engine`.

## Copy from Desktop

```sh
cp ~/Desktop/Civica\ USDA\ data/per/2024_payment_error_rates.csv \
   data-ops/raw/per/2024_payment_error_rates.csv
cp ~/Desktop/Civica\ USDA\ data/per/2023_payment_error_rates.csv \
   data-ops/raw/per/2023_payment_error_rates.csv
```

If the Desktop file lives under a different name (e.g. an XLSX you exported to
CSV), rename to match the `{FY}_payment_error_rates.csv` pattern so the parser
picks it up.

## Source

- USDA FNS Quality Control program — annual SNAP Payment Error Rate publication.
- Public release; typical cadence: June (FY-1 results published).
- Provenance line: `usda_fns_per`.
