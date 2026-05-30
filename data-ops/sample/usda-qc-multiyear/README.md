# USDA SNAP QC multi-year — CA payment-error panel (FY2016, FY2021–FY2023)

`qc_ca_panel.json` — California's error structure by fiscal year, computed from
the USDA SNAP QC public-use microdata (snapqcdata.net; FY2016 via the
Homonoff–Somerville openICPSR replication package) with the same method as the
FY2023 grounding (`tools/usda-qc-ingest/src/ca_aggregates.py` — CA=STATE 6,
weight FYWGT, dollar-weighted AGENCY split).

| FY | CA cases | operational % | client % | shelter\|wages % |
|----|---|---|---|---|
| 2016 | 829 | 65.0 | 35.0 | 59.4 |
| 2021\* | 194 | 62.4 | 37.6 | 57.8 |
| 2022 | 809 | 54.5 | 45.5 | 57.4 |
| 2023 | 867 | 64.6 | 35.4 | 60.8 |

\*FY2021 is a **PARTIAL** year (~3 months) — the COVID QC suspension; small n,
not comparable. FY2020 is absent (QC waived).

Operational-dominant **every** year; the agency-vs-client split ranges
**54.5–65.0%** — the FY2016 (pre-COVID) and FY2023 endpoints both land ~65/35,
with a FY2022 dip to 54.5%. Shelter|wages holds steady ~57–61%.

**Regression role:** the payment-error DV as a multi-year state×year panel —
built **without** the CDSS FOIA.

## Reproduce
Download `qcfy{YEAR}_csv.zip` from https://snapqcdata.net/datafiles (browser UA),
unzip, then `python tools/usda-qc-ingest/src/ca_aggregates.py --data
qc_pub_fy{YEAR}.csv --fiscal-year YEAR --out-dir <dir>`. The raw ~60MB CSVs are
not committed.
