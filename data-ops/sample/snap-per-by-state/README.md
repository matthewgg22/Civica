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

---

## `per_by_state_fy24.csv` — the national cross-section (FY2024)

Every state/territory's FY2024 PER **plus FY2024 SNAP issuance** (the cost-share
base) — the inputs for the **OBBBA §10105** exposure model in
`apps/dashboard/lib/analytics/section10105.ts`.

Columns: `state, state_fips, overpay, underpay, per, fy24_issuance_usd`.

- **National avg PER = 10.93%** (FNS QC FY2024). **CA = 10.98%** — at the
  *median* (1.005× national), NOT a relative outlier. This corrects the prior
  demo's 8.6% national assumption.
- Sources: PER from the FNS FY2024 QC Payment Error Rates table (`snap-fy24QC-PER.pdf`);
  issuance from the FNS National/State Monthly Data (`snap-zip-fy69tocurrent`,
  FY24 workbook, Oct 2023–Sep 2024 summed per state).
- Regenerate: `python tools/snap-per-by-state/extract_per_by_state.py <PER.pdf> <fns FY24.xlsx>`.
  Raw PDF/xlsx not committed.
