---
id: 2026-05-29-data-usda-qc-multiyear
date: 2026-05-29
scope: [analytics, regression, pitch]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "USDA SNAP QC Public-Use Files FY2021–FY2023 (snapqcdata.net/datafiles)"
    note: "Pulled qcfy2021_csv.zip (partial, ~3mo COVID) + qcfy2022_csv.zip; FY2023 already vendored. CA=STATE 6, weighted FYWGT."
  - kind: file
    ref: data-ops/sample/usda-qc-multiyear/qc_ca_panel.json
    note: "CA error structure by FY (operational/client split, shelter|wages share, n)."
  - kind: file
    ref: tools/usda-qc-ingest/src/ca_aggregates.py
    note: "Reused verbatim across years — same codebook/method as the FY2023 grounding."
---

## What we found

Extended the QC grounding ([[2026-05-29-usda-qc-ca-grounding]]) from one year to a
**multi-year CA payment-error panel** — built entirely from public microdata, no
FOIA:

| FY | CA cases | operational % | client % | shelter\|wages % |
|----|---|---|---|---|
| 2021\* | 194 | 62.4 | 37.6 | 57.8 |
| 2022 | 809 | 54.5 | 45.5 | 57.4 |
| 2023 | 867 | 64.6 | 35.4 | 60.8 |

\*FY2021 = ~3 months only (COVID QC suspension); small n, not comparable. FY2020 absent.

This **answers the grounding finding's open question** ("is the 65/35 split
stable?"): directionally **yes** — error is agency/operational-dominant in *every*
year — but the split **ranges 54.5–64.6%**, so the headline "65/35" is the FY2023
point, not a fixed constant. Shelter|wages stays ~57–61% throughout.

## Why it matters

- It is the **payment-error DV as a real multi-year panel** for the pre-registered
  regression ([[2026-05-28-per-regression-preregistration]]) — the FOIA-pending
  CDSS case-level QC is no longer the only path to a real error series.
- It hardens honesty: the page cites FY2023's 65/35, and now we can say
  operational dominance holds every year (~55–65%) rather than implying a fixed ratio.

## What changes / open questions

- Vendored `data-ops/sample/usda-qc-multiyear/` + repro. Did **not** rewrite the
  /findings/error-rate page (FY2023 65/35 stands as the cited point; this is the
  multi-year context behind it).
- Add FY2018/FY2019 for a longer pre-COVID baseline (deferred).
- The FY2022 dip to 54.5% operational deserves a look (post-pandemic unwinding?).

Related: [[2026-05-29-usda-qc-ca-grounding]] · [[2026-05-28-per-regression-preregistration]] · [[2026-05-29-regression-data-sources]]
