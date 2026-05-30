---
id: 2026-05-29-data-cdss-cf296-denials
date: 2026-05-29
scope: [analytics, regression, pitch, retention]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "CDSS CF 296 CalFresh Statistical Report, FY2020-21 to FY2024-25 (county-month xlsx)"
    note: "Data_External sheet; CA Statewide annual sums of items 2B / 2B.2 / 2C / 7 / 7A (C.Total). Header auto-detected (format drifts across years)."
  - kind: file
    ref: data-ops/sample/cdss-cf296/cf296_ca.json
    note: "CA statewide annual denial/discontinuance counts + procedural-denial share."
---

## What we found

CDSS's CF 296 report splits every CalFresh application denial into **ineligible**
(item 2B.1) vs **procedural** (2B.2). For California, five years running:

| FY | denied | procedural | procedural share |
| --- | --- | --- | --- |
| 2020-21 | 749K | 506K | 67.5% |
| 2021-22 | 1.10M | 783K | 71.3% |
| 2022-23 | 1.18M | 791K | 67.3% |
| 2023-24 | 1.17M | 776K | 66.1% |
| 2024-25 | 1.10M | 745K | 67.8% |

**~2 in 3 California CalFresh application denials are *procedural*** — the
applicant didn't complete the process (missing verification, a missed interview),
**not** a finding of ineligibility. Plus **~15–28K households/year** discontinued
for "failure to complete."

## Why it matters

- **It completes the operational-error map on the application-denial door.** QC =
  overpayment (~65% agency); CAPER = federal denial-error (~40%); CF-18 = renewal
  churn; and now **CF 296 = application denials, two-thirds procedural**. Every
  door of the program is operational/process, not eligibility.
- **A load-bearing pitch number.** Most denied Californians aren't ineligible —
  they were tripped by paperwork. That is exactly what a perfect application
  removes.
- **Regression:** a county-month procedural-denial DV (+ the failure-to-complete
  churn), pairing with CF-18 and a DFA-256 caseload denominator.

## Honest limits

- "Procedural" is CDSS's own 2B.2 category (failed to complete the process); it
  does **not** prove each applicant was eligible — only that the denial was not an
  eligibility determination.
- Annual statewide sums here; the workbooks carry county-month detail.
- **DFA-256 caseload** (downloaded) gives the denominator to turn these counts
  into rates — not yet extracted (its sheet uses different labels).

Related: [[2026-05-29-cdss-cf18-churn]] · [[2026-05-29-caper-denial-side-error]] · [[2026-05-29-usda-qc-ca-grounding]]
