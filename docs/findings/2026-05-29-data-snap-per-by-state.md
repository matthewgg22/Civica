---
id: 2026-05-29-data-snap-per-by-state
date: 2026-05-29
scope: [analytics, regression, pitch]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "USDA FNS SNAP Payment Error Rates, annual PDFs (fns.usda.gov/snap/qc/per)"
    note: "FY2003–FY2024; CALIFORNIA + NATIONAL rows (overpay/underpay/total) extracted via pdftotext."
  - kind: file
    ref: data-ops/sample/snap-per-by-state/per_ca_panel.json
    note: "CA payment-error panel by fiscal year."
---

## What we found

The **long payment-error DV panel** — California's SNAP payment error rate by
fiscal year, FY2003–FY2024 (~14 years extracted from the annual FNS PER PDFs):

- **Record low 3.63% (FY2013)**, then a climb to a **post-pandemic peak of 13.40%
  (FY2023)**, easing to **10.98% (FY2024)**.
- The FY2024 10.98% is exactly the baseline on `/findings/error-rate` — this is
  the full trajectory behind that single number.

## Why it matters

- It is the **payment-error dependent variable as a 14-year state×year series**,
  fully public — the pre-registered regression
  ([[2026-05-28-per-regression-preregistration]]) no longer needs the CDSS FOIA
  for an error-rate time series.
- It is also a pitch asset: CA error is **volatile and currently elevated** (3.6%
  → 13.4% in a decade) — a tool that holds it down has a real, moving target.

## What changes / open questions

- Vendored `data-ops/sample/snap-per-by-state/per_ca_panel.json` + repro.
- Gaps: FY2011–12 (charts), FY2015/2019 (chart format), FY2016/2018/2020/2021
  (unpublished / COVID waiver) — a format-specific parser could recover FY2015/2019.
- Extend to **all 50 states** (the PDFs carry every state) for a national panel —
  deferred; CA + national extracted now.

Related: [[2026-05-28-per-regression-preregistration]] · [[2026-05-29-data-usda-qc-multiyear]] · [[2026-05-29-regression-data-sources]]
