---
id: 2026-05-29-cdss-cf18-churn
date: 2026-05-29
scope: [analytics, pitch, retention]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "CDSS CalFresh Churn Monthly Report (CF 18), FY2023-24 / FY2024-25 / FY2025-26"
    note: "https://www.cdss.ca.gov/.../DSSDS/Tables/CF18FY24-25.xlsx (+ FY23-24, FY25-26). Public CA state data. Statewide rows extracted; rates computed from cells 1/2/15/16."
  - kind: file
    ref: tools/cdss-cf18/src/ingest_cf18.py
    note: "Reproducible ingest — parses Data_Internal, filters Statewide, computes late-with-loss / scheduled."
  - kind: file
    ref: data-ops/sample/cdss-cf18/cf18_churn_statewide.json
    note: "Vendored statewide aggregate + monthly series + provenance."
---

## What we found

The first **CA state** dataset in the error/retention stack (everything else so
far is federal). CDSS's CF-18 churn report measures **procedural churn**:
eligible CalFresh households that lose benefits at a reporting moment because the
paperwork (SAR 7 semi-annual report, or RRR recertification) came in late.

Statewide, the benefit-loss rate at each reporting event:

| | RRR (recert) | SAR 7 | household-events with a loss |
| --- | --- | --- | --- |
| FY2023-24 | 3.8% | 7.5% | 240,082 |
| **FY2024-25** | **5.2%** | **8.5%** | **330,331** |
| FY2025-26 (7 mo) | 5.2% | 8.5% | 205,938 |

In FY2024-25, **~5.2% of recertifications and ~8.5% of semi-annual reports** ended
in a benefit loss for an *eligible* household — and the recert rate is **rising**
(3.8% → 5.2% in one year).

**Same rules, very different results.** Across the 36 counties with enough volume
to rate, recert benefit-loss ranges from **1.3%** (Riverside) to **10.6%** (Yuba)
— a roughly **8×** spread under one identical state rulebook. Los Angeles, the
largest caseload (~604K recerts), sits at 5.9%. An 8× gap with the same rules
everywhere is the signature of an *operational* problem, not a policy one — the
same lesson the federal QC/CAPER data teaches on the application side.

## Why it matters

- **It is the retention pillar in hard CA numbers.** [[2026-05-28-retention-pillar-unrath]]
  argued retention/Type-1 reduction is Civica's second pitch pillar; CF-18 sizes
  it: ~330K household-events lost benefits at a reporting moment in one year,
  most of them still eligible. That is the churn Civica's re-entry/PhantomRecert
  work targets.
- **It completes the error map.** Three federal lenses cover the *application*:
  overpayment (QC), denial (CAPER), benefit mechanism (PolicyEngine). CF-18 adds
  the *renewal* moment — the other place eligible people fall out — with CA's own
  numbers. All four point the same way: the loss is operational/procedural, not
  eligibility.
- **It is auditable + recurring.** Monthly, public, per-county, back to FY2020-21
  — a live CA series Civica can track, unlike the FOIA-pending case-level QC.

## What changes

- Vendored `data-ops/sample/cdss-cf18/cf18_churn_statewide.json` (statewide +
  monthly series) **and `cf18_churn_by_county.json`** (per-county, latest complete
  FY), both reproducible via `tools/cdss-cf18/`. The county layer also feeds the
  heatmap/distribution tracks.
- Live surface: **`/findings/retention`** — a readout built like the error-rate
  one-pager (the renewal side), citing this finding.

## Open questions / honest limits

- **Per-event, not per-household-per-year.** A household hits SAR 7 + RRR several
  times a year, so the annual probability of ≥1 interruption is higher than any
  single rate. Computing a household-level annual churn rate needs the caseload
  denominator.
- **Interruption ≠ permanent exit.** "Late with loss" is a lapse; the CF-18
  re-entry cells (not yet extracted) split reinstatement from full churn-off.
- **Rising trend** (RRR 3.8%→5.2%) deserves its own look — policy change, staffing,
  or post-pandemic unwinding?

Related: [[2026-05-28-retention-pillar-unrath]] · [[2026-05-29-caper-denial-side-error]] · [[2026-05-29-usda-qc-ca-grounding]]
