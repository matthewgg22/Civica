---
id: 2026-05-29-data-academic-recert-microdata
date: 2026-05-29
scope: [analytics, regression, pitch]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: file
    ref: "openICPSR 124381 — Homonoff & Somerville, 'Program Recertification Costs: Evidence from SNAP' replication package"
    note: "README + DataInfo.csv: all SF-HSA case-level files marked 'Publicly Available? = N' (restricted; apply to SF-HSA / Peri Weisberg). Only a public FY2016 QC .dta is bundled."
  - kind: file
    ref: "openICPSR 194727 — Giannella, Homonoff, Rino & Somerville, 'Administrative Burden and Procedural Denials' (AEJ:Pol) replication package"
    note: "LA County RCT, Oct 2020–Jul 2022. Ships code + variable-definition spreadsheets; no case-level .dta/.csv data."
  - kind: file
    ref: data-ops/sample/usda-qc-multiyear/qc_ca_panel.json
    note: "The FY2016 QC anchor came from the SF package's bundled public file."
---

## What we found

The two California case-level recertification studies the audit
([[2026-05-29-regression-data-sources]]) flagged as P0/P1 were obtained — but
**their case-level microdata is restricted, not public**:

- **SF (openICPSR 124381, Homonoff & Somerville):** every SF-HSA file is marked
  *"Publicly Available? = N"* in the package's `DataInfo.csv`. What ships is the
  code + variable definitions + only the *public* FY2016 SNAP QC file. The case
  data requires a formal application to SF-HSA (data provider Peri Weisberg).
- **LA RCT (openICPSR 194727, Giannella et al):** the package ships code +
  variable-definition spreadsheets with **no case-level data files** at all.

**This corrects the audit's optimism** that a free openICPSR account yields these
panels — it yields the *code and documentation*, not the restricted microdata.

## What we still got (two real wins)

1. **FY2016 public QC** (bundled in the SF package) → extended the multi-year QC
   error panel ([[2026-05-29-data-usda-qc-multiyear]]) back to a pre-COVID anchor:
   CA operational/client = **65.0 / 35.0** (n=829), matching FY2023 — strengthening
   "operational-dominant, ~65/35 at the endpoints."
2. **The study designs / instruments** (from the variable definitions) — useful if
   access is ever granted:
   - **SF:** interview-day-of-month as a quasi-random instrument — cases assigned
     later in the month are **>20% less likely to recertify** (procedural churn).
   - **LA:** an RCT of flexible, applicant-initiated interviews vs standard — the
     causal administrative-burden → procedural-denial channel.

## Why it matters

Both designs corroborate the thesis (procedural friction drives churn/denials),
and the SF instrument is the cleanest causal "recert timing → churn" evidence in
California — but the **data is gated**, so it stays an aspirational access request,
not a vendored panel. Honest status: these two are **request-only, like Unrath** —
not the easy openICPSR pulls the audit implied.

## Open questions

- Apply to SF-HSA (124381); check whether the LA RCT analysis data (194727) is
  obtainable separately — both are formal data requests, not downloads.
- Pull the remaining public QC years (FY2017–FY2019) to fill 2016→2021.

Related: [[2026-05-29-regression-data-sources]] · [[2026-05-29-data-usda-qc-multiyear]] · [[2026-05-28-retention-pillar-unrath]]
