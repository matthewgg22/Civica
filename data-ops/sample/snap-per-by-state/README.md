# USDA FNS SNAP Payment Error Rates — CA panel (FY2003–FY2024)

`per_ca_panel.json` — California's payment error rate by fiscal year
(overpayment + underpayment = total %), extracted from the annual FNS PER PDFs
(https://www.fns.usda.gov/snap/qc/per).

CA total PER: **3.63% (FY2013 — a record low) → 13.40% (FY2023 — post-pandemic
peak) → 10.98% (FY2024)**. The FY2024 figure is exactly the baseline cited on
`/findings/error-rate`; this is the full historical trajectory behind it.

**Gaps (honest):** FY2011–12 are chart-only PDFs; FY2015/2019 use a chart format
this parser didn't read; FY2016/2018/2020/2021 are unpublished or COVID-QC-waived.
~14 years extracted.

**Regression role:** the long payment-error **DV** panel (state × fiscal year),
public — no FOIA. **Reproduce:** `pdftotext -layout` each annual PDF, parse the
`CALIFORNIA` and `NATIONAL`/`UNITED STATES` rows (`overpay underpay total`).
