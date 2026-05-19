# raw/obbba-scenarios/

Drop the OBBBA scenario rollup JSON here before running
`data-ops/parsers/obbba_scenarios_to_parquet.ts`. Files in this directory are
gitignored — they live in Supabase Storage instead.

## Expected files

A single JSON file describing the conservative / mid / aggressive macro scenarios.

- `obbba_rollup.json`

## Expected schema (JSON)

```json
{
  "model_version": "1.0",
  "publication_date": "2026-05-12",
  "scenarios": [
    {
      "scenario": "baseline",
      "metric": "fy28_total_state_liability_billions",
      "value": 0.0,
      "narrative": "FY24 PER carried forward; no OBBBA participation drop."
    },
    {
      "scenario": "mid",
      "metric": "fy28_total_state_liability_billions",
      "value": 4.85,
      "narrative": "Baseline PER × OBBBA §10101/§10102 participation reduction."
    }
  ]
}
```

Fields:

| field | type | notes |
|-------|------|-------|
| `scenario` | enum: `baseline` \| `mid` \| `aggressive` | scenario label |
| `metric` | string | metric key (e.g. `fy28_total_state_liability_billions`) |
| `value` | float | metric value (units encoded in the metric name) |
| `narrative` | string (optional) | human-readable justification for the value |

Multiple rows per (scenario, metric) pair are allowed — the parser preserves all rows.

## Copy from Desktop

```sh
cp ~/Desktop/Civica\ USDA\ data/obbba_rollup.json \
   data-ops/raw/obbba-scenarios/obbba_rollup.json
```

## Source

- Civica-derived from CBO §10105 distributional model + USDA FNS PER FY24.
- Provenance line: `cbo_distributional` (model inputs); `section_10105_cliff` (Civica reuses §10105 methodology constants).
- Refresh: on CBO score revision.
