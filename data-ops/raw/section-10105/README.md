# raw/section-10105/

Drop the source CSVs here before running `data-ops/parsers/section_10105_to_parquet.ts`.
Files in this directory are gitignored — they live in Supabase Storage instead.

Expected files (productize from `~/Desktop/Civica USDA data/`):

- `civica_state_liability_fy24.csv` — FY24 baseline (52 rows)
- `state_liability_fy28_adjusted.csv` — FY28 multi-scenario (52 rows)

Copy command (run once per machine):

```sh
cp ~/Desktop/Civica\ USDA\ data/civica_state_liability_fy24.csv \
   data-ops/raw/section-10105/civica_state_liability_fy24.csv
cp ~/Desktop/Civica\ USDA\ data/data/state_liability_fy28_adjusted.csv \
   data-ops/raw/section-10105/state_liability_fy28_adjusted.csv
```
