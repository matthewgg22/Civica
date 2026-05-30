# ICPSR 39703 — State SNAP COVID Expansions, 2020–2023 (post-2020 policy IVs)

`snap_expansions_2020_2023.csv` — Zhang, Ma & Mowbray, *State-Level SNAP
Expansions During and After the COVID-19 Pandemic* (ICPSR 39703, public-use):
**51 states/DC × 50 policy variables**, 2020–2023.

Variable groups (state-level):
- **Emergency Allotments (`EA_*`)** — approval / effective / **end** dates + amount
  (e.g. CA: approved 2020-03-30, **ended 2023-02-28**).
- **Pandemic school-meal (`SCH*`) + childcare (`CC*`) expansions** by program year
  (2019-20 → 2022-23), with `_YN` adoption flags.
- Other COVID flexibilities (`APR*`, `PRRH*`, …).

**Regression role:** the **post-2020 state policy IVs**. The staggered,
state-varying **EA-end timing** (the "hunger cliff" — when ~$95+/mo of emergency
benefits stopped) is a clean **natural experiment** for "what happens to churn /
error when emergency benefits end." Fills the gap where the **ERS SNAP Policy
Database stops (Dec 2020)** and complements **ICPSR 39331**'s COVID-waiver table.

Source: ICPSR 39703 (public-use), DS0001, **Delimited (.tsv)**. License: ICPSR
public-use (no member affiliation required). Raw download not committed — the
vendored CSV is the 51-row table verbatim.
