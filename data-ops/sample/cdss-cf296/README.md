# CDSS CF 296 — CA CalFresh application denials & discontinuances

`cf296_ca.json` — California statewide annual sums from the CDSS **CF 296**
CalFresh Statistical Report (county-month workbooks, FY2020-21 → FY2024-25).

**Headline: ~67% of CA CalFresh application denials are for PROCEDURAL reasons**
(item 2B.2 ÷ 2B) — *not* ineligibility — stable **66.1–71.3%** across five years.
The denial-side analog of the CF-18 renewal churn.

CDSS items extracted (each the "C. Total" column):
- `denied` = 2B (applications denied)
- `denied_procedural` = 2B.2 (denied for **procedural** reasons — the DV)
- `withdrawn` = 2C
- `discontinued` = 7 (cases discontinued)
- `disc_failure_to_complete` = 7A (households discontinued for **failure to complete** — recert procedural churn)

**Regression role:** county-month procedural-denial / churn DV (pairs with CF-18
+ a DFA-256 caseload denominator).

**Reproduce:** read each workbook's `Data_External` sheet; auto-detect the header
row (the one containing `County Name`); cell N = base-column (header value `1`) +
(N−1); filter `Statewide`; sum across months. Workbooks from
`cdss.ca.gov/.../DSSDS/Tables/`. Header position drifts across years — the
auto-detect handles it; the partial FY2025-26 file is skipped.
