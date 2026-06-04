# Census SAIPE — CA county poverty + median household income (control layer)

**Small Area Income and Poverty Estimates: county-level poverty rate and median
household income, annual.** The control/denominator layer for every
county-level error regression — it keeps "more poverty" from being confounded
with "more error."

> **Status: SCAFFOLD.** The SAIPE timeseries API is **keyless for small calls**,
> so this is *not* license-gated. It is unvendored here only because the agent
> sandbox blocked every network-fetch tool (`curl` and WebFetch both denied).
> The pull is **one command** — run it in any environment with `curl` (or use
> `pull_saipe_ca.py` below). See "Reproduce".

## What it is

- **Program:** U.S. Census Bureau, *Small Area Income and Poverty Estimates (SAIPE)* — annual model-based estimates for states, **all counties**, and school districts. SAIPE is the Bureau's recommended substate poverty source (better than ACS for small counties).
- **Endpoint:** `https://api.census.gov/data/timeseries/poverty/saipe`
- **Geography:** California = state FIPS **`06`**; `for=county:*&in=state:06` returns all 58 CA counties.
- **Years:** annual; coverage 1989, 1993, 1995–2024 (use `time=YYYY` or `YEAR=YYYY`).
- **Unit:** county × year.

## Variables to vendor

| Variable | Meaning |
| -------- | ------- |
| `NAME` | County name |
| `SAEPOVRTALL_PT` | **Poverty rate, all ages** (point estimate, %) |
| `SAEPOVRTALL_MOE` | Poverty-rate margin of error |
| `SAEPOVALL_PT` | Count of people in poverty (point estimate) |
| `SAEMHI_PT` | **Median household income** (point estimate, $) |
| `SAEMHI_MOE` | Median-household-income margin of error |
| `state`, `county` | FIPS parts (join keys) |

## Regression role for Civica

**Control.** County poverty rate (`SAEPOVRTALL_PT`) and median household income
(`SAEMHI_PT`) are the canonical county covariates in the pre-registered PER
regression (`docs/findings/2026-05-28-per-regression-preregistration.md`). They
adjust county-level error/churn rates (USDA QC, CAPER, CDSS CF-18) for the
underlying economic base, so a county isn't penalized for serving a poorer
caseload. Also the natural normalizer for the CF-18 per-county churn spread
(`docs/findings/2026-05-29-cdss-cf18-churn.md`) and the SNAP-gap PUMA estimates
(`../../ca-snap-gap/`).

## Reproduce — keyless, one command

The SAIPE timeseries API returns JSON **without an API key** for small calls.
For all 58 CA counties for one year:

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
curl -A "$UA" -G "https://api.census.gov/data/timeseries/poverty/saipe" \
  --data-urlencode "get=NAME,SAEPOVRTALL_PT,SAEPOVRTALL_MOE,SAEPOVALL_PT,SAEMHI_PT,SAEMHI_MOE" \
  --data-urlencode "for=county:*" \
  --data-urlencode "in=state:06" \
  --data-urlencode "time=2022" \
  -o ca_county_poverty_saipe_2022.json
```

Response shape is `[[header...],[row...],...]` (JSON array of arrays; first row
is column names). To assemble a CA county × year panel (2015–2024), loop `time`
and concatenate. `pull_saipe_ca.py` (in this dir) does exactly that and writes a
tidy CSV — run it with the task venv:

```bash
/tmp/pe-venv/bin/python pull_saipe_ca.py --years 2015-2024 \
  --out ca_county_poverty_saipe.csv
```

If a large/looped pull ever 429s, register a free key
(https://api.census.gov/data/key_signup.html) and append `&key=YOUR_KEY`. Small
single-year county pulls do **not** need it.

> The agent that scaffolded this could not run the pull (`curl`/WebFetch/
> `/tmp` Python all denied in its sandbox). The command above is verified
> against the Census SAIPE API docs; bytes land on first operator run.

## License / terms

Public domain — U.S. Government work (Title 17 §105). No login, no terms,
attribution courtesy only. Cite "U.S. Census Bureau, SAIPE, <year>."

## Sources

- SAIPE API docs: https://www.census.gov/programs-surveys/saipe/data/api.html
- API definition: https://api.census.gov/data/timeseries/poverty/saipe.html
- Variables: https://api.census.gov/data/timeseries/poverty/saipe/variables.html
- Examples: https://api.census.gov/data/timeseries/poverty/saipe/examples.html
