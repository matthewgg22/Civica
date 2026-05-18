# Data Provenance

> **Repo-canonical copy** as of 2026-05-18 (T10). Productized from
> `~/Desktop/Civica USDA data/PROVENANCE.md`. Future entries go here, not
> on Desktop. Pair with [`manifests/source-inventory.yaml`](./manifests/source-inventory.yaml)
> for the machine-readable form.

Every external data point used in Civica's analysis, with source, URL, date pulled, version, and any known gaps. Append-only — entries are added but never silently edited.

---

## Primary data sources

### USDA FNS · SNAP Payment Error Rates by State, FY2024

- **What it is:** State-by-state FY24 over-payment, under-payment, and total payment error rates for SNAP. Includes 50 states, DC, Guam, USVI, and a national rollup.
- **Authoritative source URL:** https://www.fns.usda.gov/snap/qc/per
- **Publication date:** June 30, 2025 (per the PDF cover)
- **Local copies in this workspace:**
  - `_source/SNAP paymenr error rates by state and year/snap-fy24QC-PER.pdf` (also at top level)
- **Used for:** every PER number in `data/state_liability_fy24.csv`, `deliverables/civica_10105_fy29_cliff.*`, and the interactive HTML.
- **Refresh cadence:** annual, typically published June. Next expected refresh: FY25 PER in June 2026.

### USDA FNS · SNAP State Benefit Totals, FY2024

- **What it is:** Federal SNAP benefit dollars issued by state in FY2024.
- **Authoritative source URL:** https://www.fns.usda.gov/pd/supplemental-nutrition-assistance-program-snap (the SNAP Data Tables page; "State Level Participation & Benefits" → "Benefits" download)
- **Compiled secondary source used in this analysis:** National Grocers Association, "SNAP Cost-Share by State Post-Senate Bill FY2024" (July 2025) — https://www.nationalgrocers.org/wp-content/uploads/2025/07/SNAP-Cost-Share-by-State-Post-Senate-Bill-FY2024-1.pdf
- **DC benefit figure** ($320M) was back-derived from Savor Snap's published $48M H.R. 1 cost-share at the 15% tier → $48M / 0.15. Source: https://www.savorsnap.org/snap-payment-error-rates-by-state-map (Feb 2026).
- **Date pulled:** 2026-05-12
- **Known gap:** Guam and U.S. Virgin Islands benefit totals not included in the NGA compilation; not material since both are out of §10105 scope.
- **Refresh cadence:** monthly state-level participation/benefits; FY-annual aggregates compiled by FNS.

### CBO · Distributional Effects of P.L. 119-21 and SNAP Supplemental (August 11, 2025)

- **What it is:** CBO's per-provision spending/participation impact analysis of OBBBA, including the SNAP supplemental that breaks out §§10101–10108 individually.
- **Authoritative sources:**
  - CBO publication: https://www.cbo.gov/publication/61367
  - SNAP supplemental PDF: https://www.cbo.gov/system/files/2025-08/61367-SNAP.pdf
  - Earlier Klobuchar-Craig letter (per-provision participation): https://www.cbo.gov/publication/61426 (May 22, 2025)
- **Status as of 2026-05-12:** CBO PDFs returned empty body via web_fetch — likely server-side compatibility issue. Worked around by using AEI's August 7, 2025 cross-reference table (see next entry).
- **Key figures used:** $186.7B 10-year SNAP reduction; ~$165B benefit-side reduction; 3M participation reduction from §10102; 1.3M from §10105 BBCE elimination spillover; 120–250K from §10108; 65% of households affected by §10104 internet expense change at $10/mo.
- **Used for:** `analysis/obbba_adjusted_10105.md`, `data/state_liability_fy28_adjusted.csv`, `data/obbba_rollup.json`.

### AEI/COSM · "Perspective on the OBBBA's SNAP Cuts" (Aug 7, 2025)

- **What it is:** Summary article by Angela Rachidi (AEI Senior Fellow) with a clean per-provision summary table of OBBBA SNAP changes and CBO 10-year cost estimates. Used as the working source for CBO figures because the CBO PDFs returned empty content.
- **URL:** https://www.aei.org/articles/perspective-on-the-obbba-snap-cuts/
- **Date pulled:** 2026-05-12 (article dated August 7, 2025)
- **Used for:** CBO figure cross-reference in `analysis/obbba_adjusted_10105.md`. Authoritative numbers are CBO; AEI is the conduit.

### Statute · P.L. 119-21 (OBBBA), §10105

- **What it is:** "MATCHING FUNDS REQUIREMENTS" section of OBBBA, amending Section 4(a) of the Food and Nutrition Act of 2008 (7 USC §2013(a)). Establishes the FY2028+ federal/state cost-share tier structure based on payment error rate.
- **Authoritative source:** Public Law 119-21, July 4, 2025 (139 STAT. 83–84). Available at https://www.congress.gov/bill/119th-congress/house-bill/1
- **Working text used in this analysis:** Statutory text provided directly in Cowork conversation by Matthew on 2026-05-12 (paste of §10105 verbatim from the enrolled bill). Cross-validated against Savor Snap's published tier description.
- **Companion file:** `_source/61570-pl119-21-2025Recon-CLB.xlsx` (CBO score table for the reconciliation bill). **OS-locked as of 2026-05-12** — not yet inspected.

### 7 CFR Part 273 · SNAP Regulations

- **What it is:** Federal SNAP eligibility, income, and benefit regulations. The legal substrate Civica's evidence packets cite.
- **Authoritative source URL:** https://www.ecfr.gov/current/title-7/subtitle-B/chapter-II/subchapter-C/part-273
- **Sections indexed for this project (as of 2026-05-12):**
  - §273.9 (Income and deductions) — https://www.ecfr.gov/current/title-7/subtitle-B/chapter-II/subchapter-C/part-273/subpart-D/section-273.9
  - §273.10 (Determining household eligibility and benefit levels) — https://www.ecfr.gov/current/title-7/subtitle-B/chapter-II/subchapter-C/part-273/subpart-D/section-273.10
- **Local copy in workspace:** `_source/7 CFR Part 273 (... 5-08-2026).pdf` — **OS-locked as of 2026-05-12**, not used as input. The eCFR live text was used instead (more current anyway).
- **Date of regulations indexed:** eCFR as of 2026-05-08.
- **Output of indexing:** `rules/cfr_273_rule_index.csv` (223 rows) and `rules/cfr_273_index_notes.md`.
- **Sections NOT yet indexed (queued for future):** §271–272, §273.1–273.8, §273.11 (special circumstances — pairs with §273.9 for self-employment), §273.12 (reporting requirements), §275 (Quality Control methodology), §277 (federal cost reimbursement and state systems).

### USDA FNS · SNAP Quality Control Public Use Microdata, FY2020–2023

- **What it is:** Case-level (anonymized) SNAP Quality Control records. Household composition, income source breakdown, error indicators, error amounts, error cause codes. Going back to FY1989; FY20–23 obtained for this project.
- **Authoritative source URL:** https://www.fns.usda.gov/snap/qc/datafiles
- **Local copies:** `_source/qc_microdata/qcfy2020_csv.zip`, `qcfy2020_per1_csv.zip`, `qcfy2021_csv.zip`, `qcfy2022_csv.zip`, `qcfy2023_csv.zip` (and same files at the top-level subfolder).
- **Status:** **OS-locked as of 2026-05-12.** Have not yet been opened. See "Known data access blockers" below.
- **Refresh cadence:** annual.

### USDA FNS · SNAP State Options Report, 17th edition

- **What it is:** State-by-state inventory of policy choices on PER-relevant levers (certification periods, simplified reporting, self-employment income calculation, SUA methodology, ABAWD waivers).
- **Authoritative source URL:** https://www.fns.usda.gov/snap/state-options-report-17 (search via fns.usda.gov if direct URL has changed)
- **Local copy:** `_source/snap-stateOptionsReport-17edition-120925.pdf` — **OS-locked as of 2026-05-12**, not yet parsed.
- **Date of report:** December 2025 (per the filename).
- **Companion to the rule index:** 17 specific state-option clauses in §273.9 and §273.10 defer to state discretion — see `rules/cfr_273_index_notes.md` for the full list of join keys.

### Other source files in the workspace (catalogued, not yet used as input)

- `_source/Data sets.docx` — Matthew's ranked inventory of data sources and their value to Civica.
- `_source/BLS LAUS.docx` — BLS Local Area Unemployment Statistics framework doc. **OS-locked.**
- `_source/SD3767.pdf` — state bill, unconfirmed. **OS-locked.**
- `_source/ACSPUMS5Y2024_*.csv` — ACS PUMS 5-year 2024 sample. **OS-locked.**
- `_source/civica_snap_public_model_report.pdf` — Civica's public-facing concept doc.

---

## Secondary / context sources

### Savor Snap · SNAP Payment Error Rates by State (FY 2024) — H.R. 1 Cost-Share Map

- **What it is:** Public interactive analysis by an adjacent player (savorsnap.org) covering the same §10105 cost-share modeling Civica is doing.
- **URL:** https://www.savorsnap.org/snap-payment-error-rates-by-state-map
- **Date pulled:** 2026-05-12 ("Last updated: February 2026" per the page)
- **Used as:** secondary cross-check on tier structure; source for the DC benefit total back-derivation; competitive intelligence noted in `_source/Data sets.docx` follow-ups.

### National Grocers Association · SNAP Cost-Share by State Post Senate Bill FY2024

- **What it is:** State-by-state cost-share table using FY24 PER and federal benefit totals (industry trade association compilation of FNS data).
- **URL:** https://www.nationalgrocers.org/wp-content/uploads/2025/07/SNAP-Cost-Share-by-State-Post-Senate-Bill-FY2024-1.pdf
- **Date pulled:** 2026-05-12 (publication July 2025)
- **Used as:** primary source for state-level FY24 federal benefit dollars used in the §10105 liability calculator.

---

## Known data access blockers (as of 2026-05-12)

The following source files in `_source/` are OS-locked on Matthew's Mac (errno 35, EDEADLOCK). Symptom: any process attempting to read returns "Resource deadlock avoided." Likely cause: macOS Spotlight initial indexing combined with the `com.apple.quarantine` extended attribute on recently-downloaded files. Remedies tried by user: TBD. Workarounds: (a) open any one of them in Finder once to trigger Gatekeeper review, (b) run `xattr -dr com.apple.quarantine ~/Desktop/Civica\ USDA\ data/` in Terminal, (c) wait for Spotlight to finish initial indexing.

- `_source/7 CFR Part 273 (... 5-08-2026).pdf` — locked. Worked around by using eCFR live text from ecfr.gov for the rule index.
- `_source/snap-stateOptionsReport-17edition-120925.pdf` — locked. **Not worked around. Blocking the State Options Report parse.**
- `_source/qc_microdata/*.zip` (5 files) — locked. **Not worked around. Blocking the QC microdata profile.**
- `_source/BLS LAUS.docx` — locked. Not in current critical path.
- `_source/ACSPUMS5Y2024_*.csv` — locked. Not in current critical path.
- `_source/SD3767.pdf` — locked. Not in current critical path.
- `_source/61570-pl119-21-2025Recon-CLB.xlsx` — locked. Worked around by direct paste of §10105 statutory text in conversation.
