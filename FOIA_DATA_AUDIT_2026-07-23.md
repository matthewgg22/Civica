# FOIA / PRA Data Audit — CDSS · LA County · Texas HHSC productions

> **Deep audit, 2026-07-23.** Second-pass, quantitative audit of the Step-4 FOIA/PRA
> productions that arrived 2026-07-23 (companion to [`DATA_INVENTORY.md`](DATA_INVENTORY.md) §9
> and [`HKS_RESEARCH_PRA_TRACKER.md`](HKS_RESEARCH_PRA_TRACKER.md) § "Productions received").
> Built by fanning out 5 parallel extraction agents over the raw PDFs; every figure below is
> transcribed from a source PDF (text layer + visual verification), not re-derived from repo data.
> Files remain staged in operator `~/Downloads/` — **not yet vendored into `data-ops/`**.

**⚠️ Two red flags up front** (details in §9):
1. **The "$709M Texas sanction" is NOT in the produced record.** It appears nowhere in Texas's three official Corrective Action Plans. The tracker anchors Texas item 8 to this figure — it must be sourced elsewhere or retired.
2. **CA's FFY2024 Federal PER (9.69%) is a policy-restated number**, cut from a preliminary 10.21% via QC PM 25-03 §751/§752 re-review of 7 cases. Not a clean measurement; compromised for FFY2024 cross-state comparison.

---

## 0. Corpus map (what was audited)

| Corpus | Source | Location | Volume | Nature |
|---|---|---|---|---|
| **A. QC&I Scorecards** | CDSS `R012681` | `~/Downloads/R012681-..._3_/` | ~28 PDFs FFY2021–2025 + FNS-310 Handbook | County×FFY **PER/CAPER** panel |
| **B. County ME Reports** | CDSS `R012681` | `~/Downloads/R012681-..._1_/` | 38 reports (17 FFY24 + 21 FFY25), 36 counties | Per-county stats + **case-level denial narratives** |
| **C. ME Scorecards** | CDSS `R012681` | `~/Downloads/R012681-..._2_/` | 32 statewide rollups FFY24–25 | **Process-compliance** error rate (≠ QC PER) |
| **D. ABAWD policy** | CDSS `R012680` | `~/Downloads/R012680-.../` | 3 PDFs | OBBBA §10102 / ABAWD spec |
| **E. Texas production** | TX HHSC ORR `A05292026.0450037` | scratchpad zip | 12 items | Comparator: QC counts + CAPs + policy |
| **F. LA DPSS mega-doc** | LA County `HOA.106012224.1` | `~/Downloads/Supporting Documents...pdf` | 1,221 pp | Policy/training/outreach + **timeliness** |
| **G. FY26 CA QC Sample Plan** | CDSS `R012681` | `~/Downloads/R012681-..._1_/3_FY26...pdf` | 12 pp | §275 methodology + **frame variable dictionary** |

**Still pending** (not in this drop): LA Reqs 4/5/6 (aggregate denial-code distributions, dashboards, correspondence — est. 2026-07-31); CDSS #2 items 3 & 6; USDA FNS, USDA OIG, CalSAWS, Tulare, Fresno-County-PRA, LA Homeless.

---

## 1. California county PER panel — Combined Active Payment Error Rate (QC&I Scorecards)

`N/A` state cell = **Federal-data-only row** (LA, "39 Counties", National always). FFY2021 = **Q4-only (Jul–Sep 2021)**, different template, small-sample-volatile — **not comparable**.

| County | 2021(Q4) | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|
| **CALIFORNIA (Combined)** | 8.12 | **6.44** | **7.05** | **7.98** | **7.86** |
| Alameda | 10.08 | 4.42 | 5.23 | 4.39 | 8.63 |
| Contra Costa | 9.27 | 4.05 | 3.58 | 7.10 | 6.73 |
| Fresno | 5.72 | 3.87 | 7.11 | **14.62** | 4.05 |
| Kern | 0.90 | 4.03 | 3.74 | 5.34 | 4.52 |
| Los Angeles* | 11.97 | 12.88 | **15.05** | 9.61 | 10.24 |
| Merced | 5.03 | 6.13 | 6.99 | 7.18 | 4.80 |
| Monterey | 8.74 | 3.96 | 4.40 | 9.95 | 8.39 |
| Orange | 13.90 | 10.32 | 10.39 | 9.46 | 11.37 |
| Riverside | 8.31 | 6.64 | 4.00 | 6.75 | 8.79 |
| Sacramento | 4.96 | 8.52 | 6.52 | 10.43 | 10.56 |
| San Bernardino | 7.73 | 4.16 | 6.03 | 10.74 | 10.79 |
| San Diego | 16.93 | 8.44 | 7.65 | 8.80 | 9.65 |
| San Francisco | 6.96 | 9.81 | 9.08 | 8.39 | 12.08 |
| San Joaquin | 8.92 | 4.98 | 3.15 | **1.39** | **2.53** |
| Santa Clara | 10.99 | 5.72 | 6.20 | 6.65 | 9.41 |
| Solano | 13.86 | 8.82 | 4.53 | 3.11 | **1.87** |
| Stanislaus | 4.90 | 3.20 | 6.13 | 6.30 | 7.51 |
| Tulare | 12.41 | 7.63 | 9.82 | 12.13 | 7.81 |
| Ventura | 9.70 | 5.36 | 8.05 | 8.84 | 8.06 |
| **39 Counties*** | 1.27 | 8.03 | 12.73 | **14.43** | 10.30 |
| **NATIONAL (Fed)** | — | 10.59 | 11.09 | 10.41 | 10.19 |

\* Federal-only row (State PER N/A). LA/39-Counties/National "Combined" = the Federal number.

**CA statewide, all three PER bases** (Federal is the sanction-relevant one; CDSS "does not utilize State/Combined unless in a sanction year"):

| basis | 2021(Q4) | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|
| State | 7.06 | 5.61 | 5.53 | 7.56 | 7.11 |
| **Federal** | 11.17 | 10.50 | **12.47** | **9.69**‡ | 11.01 |
| Combined | 8.12 | 6.44 | 7.05 | 7.98 | 7.86 |

‡ **FFY2024 restated** 10.21 → 9.69 (QC PM 25-03 §751/§752 re-review; 7 CA cases recalled). See §9.

### 1a. CAPER (Case & Procedural / negative-action error rate) — CA county panel
CAPER **completion = 100% every county-year**. County CAPERs are tiny-sample (0.00% and 100.00% both appear).

| | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|
| **CALIFORNIA** | 42.90 | 40.27 | 40.02 | 40.02 | **37.36** |
| Los Angeles | 45.30 | 45.87 | 32.66 | 34.15 | 26.84 |
| Orange | 54.50 | 41.66 | 50.98 | 46.51 | **62.22** |
| San Diego | 33.30 | 45.00 | 50.81 | 50.00 | 53.23 |
| **NATIONAL** | — | 40.01 | 39.96 | 42.73 | 38.34 |

(Full 20-county CAPER + Completion-Rate tables retained in the QC&I agent extract; the county spread is noise-dominated below the state level.)

### 1b. CA agency-vs-client dollar-weighted responsibility (QC-sampled error $)
**Agency-caused share fell every year; clients became the majority in FFY2025.**

| FFY | Agency $ | Agency % | Client $ | Client % |
|---|---|---|---|---|
| 2022 | 14,998 | **63.8** | 8,526 | 36.2 |
| 2023 | 25,876 | **73.95** | 9,117 | 26.05 |
| 2024 | 16,621 | 56.74 | 12,671 | 43.26 |
| 2025 | 14,779 | 47.5 | 16,304 | **52.5** |

### 1c. Top-3 error ELEMENTS by year (Active/payment | CAPER/negative)
Element **311 Wages** tops the active list and **540 Notices** tops the CAPER list in **all 5 years**. CAPER top-3 (**540 Notices · 413 Application · 416 Action Type**) is identical, same order, every year.

| FFY | Active top elements | CAPER |
|---|---|---|
| 2022 | 560 Reporting · **363 Shelter** · 311 Wages · 346 Other-Unearned | 540 · 413 · 416 |
| 2023 | 560 Reporting · **311 Wages** · 334 UI · 363 Shelter · 346 | 540 · 413 · 416 |
| 2024 | **311 Wages** · 334 UI · 331 RSDI · 335 Workers-Comp | 540 · 413 · 416 |
| 2025 | **311 Wages** · 331 RSDI · **111 Student Status** · 363 Shelter · 312 Self-Emp | 540 · 413 · 416 |

**Mix shift:** active-side anchored by wages (311) + shelter (363) throughout; "third slot" migrates from welfare/UI unearned (344/334/346, 2021–23) → retirement/disability/self-employment + non-financial (331/335/312/111, 2024–25). These are the **exact element codes the repo already speaks** (`data-ops/derived/qc_category_mapping.yaml`, `packages/snap-qc-engine` ERROR_WEIGHT) — plus the negative-action codes 540/413/416 the repo lacked.

---

## 2. California county ME Reports — per-county stats + denial taxonomy (38 reports, 36 counties)

**Case-review aggregate (37 reports w/ case tables):** 1,025 cases reviewed → **634 errored ≈ 61.9%**. FFY24 = 58.2%, FFY25 = 64.7%. **Denials are the highest-error action type** (5/8, 7/7, 8/8 typical). **179 Program Access findings** total.

### 2a. Per-county statistics (selected columns; `N/A` = too few cases; periods differ — see §9)

| County | FFY | County PER | CAPER | 3-day ES | 30-day appr | period |
|---|---|---|---|---|---|---|
| **Glenn** | 25 | **74.93** | N/A | 87.04 | 98.59 | Oct23–Sep24 |
| **Monterey** | 24 | **53.28** | 33.33 | 91.35 | 100.00 | Oct–Dec23 |
| **San Bernardino** | 25 | **22.05** | 50.00 | 83.93 | 99.36 | Oct–Dec24 |
| **Sonoma** | 24 | **21.00** | 0.00 | 52.62 | 97.49 | Oct23–Feb24 |
| **Tulare** | 24 | **20.35** | 50.00 | 81.60 | 84.16 | Oct23–Apr24 |
| **Ventura** | 24 | **20.00** | 0.00 | 87.20 | 91.78 | Oct23–Mar24 |
| **Fresno** | 25 | **19.37** | 16.66 | 95.52 | 99.93 | Oct23–Jul24 |
| San Diego | 24 | 13.76 | 57.14 | 94.55 | 96.89 | Oct23–Apr24 |
| Orange | 24 | 13.47 | 42.85 | 96.84 | 99.63 | Oct23–Mar24 |
| Stanislaus | 25 | 11.66 | 28.57 | 55.95 | 99.15 | Oct23–May24 |
| LA (Aug&Sep) | 24 | 11.41 | 30.40 | 98.50 | 99.19 | Oct23–May24 |
| Contra Costa | 25 | 9.72 | 58.33 | 97.85 | 99.84 | Oct23–May24 |
| Kern (AMENDED) | 25 | 8.94 | **70.58** | 80.78 | 99.23 | Oct23–Jul24 |
| Yuba | 25 | 8.47 | N/A | 90.28 | 100.00 | Oct23–Aug24 |
| Riverside | 24 | 7.54 | 36.36 | 94.87 | 97.17 | Oct–Dec23 |
| San Joaquin | 25 | 7.44 | **54.54** | 95.03 | 97.70 | Oct23–Jul24 |
| Alameda | 25 | 6.60 | 52.00 | 94.26 | 99.40 | Oct23–Sep24 |
| San Francisco | 24 | 6.35 | 25.00 | 92.97 | 84.38 | Oct23–May24 |
| Sacramento | 24 | **1.71** | 50.00 | **64.24** | **77.46** | Oct23–Feb24 |

Zero-error (in-sample) counties: Humboldt, Tuolumne (24); Butte, Madera, Marin, Merced, Riverside, SLO, Santa Barbara, Santa Clara, Solano, Yolo (25). **Timeliness laggards** (independent of PER): Sacramento (ES 64/68, 30-day 77 — also worst case-errors 22/30 + 17 PA findings), Merced (30-day 67.34), Sonoma/Stanislaus (ES ~53–64).

### 2b. Denial / termination error TAXONOMY (across all 38 reports)
The dominant CA administrative failure mode is **procedural over-verification + notice/interview mishandling — not benefit math.**

| # | Error theme | # counties | Representative |
|---|---|---|---|
| 1 | **CW 2200 over-verification** (requesting docs already on file / not questionable) | **37/38** | Humboldt |
| 2 | **NOMI mishandled** (Notice of Missed Interview sent after interview completed) | **33** | Alameda |
| 3 | Questionable-verification not documented (verification requested w/o basis) | 32 | Humboldt (ACL 21-58) |
| 4 | Negative action incorrectly taken (reason ≠ record) | 30 | Fresno |
| 5 | **ES entitlement missed in CalSAWS** (ES-eligible HH not flagged/interviewed ≤3 days) | 26 | Fresno Denial #1 |
| 6 | Income miscalculation / income omitted from budget | 25 | Fresno |
| 7 | Denied after day 30 / not processed timely | 20 | Humboldt |
| 8 | The Work Number (TWN) not used before requesting income verification | 20 | Monterey |
| 9 | Denied "failure to provide" though already provided | 19 | Fresno Denial #4 |
| 10 | NOA incorrect/confusing/duplicate (multiple denial NOAs, different reasons, same day) | 16 | Fresno Denial #8 |
| 11 | ICT not initiated timely on address change | 14 | Orange/Fresno |
| 12 | Termination reason code in CalSAWS ≠ action taken / NOA | 9 | Fresno Term #13 |
| 13 | **Student eligibility exemptions not explored** | **9** | Fresno Denial #5 |
| 14 | Interview not conducted / determined w/o completed interview | 5 | Riverside 24 |

> **Repo cross-refs:** theme #13 (student-exemption gaps in 9 counties) is real-world corroboration of the **student-exemption fix [PR #373]**. Themes #1/#2/#5/#7/#9/#10 are the procedural-denial mechanics behind finding **#420** (CA app-door procedural denial, ~1-in-4). Element 363 shelter dominance (§1c) corroborates finding **#417** (elderly 3.6× shelter).

---

## 3. California statewide ME Scorecards — process-compliance (≠ QC payment error)

**Do not conflate with QC PER.** These measure whether counties followed correct *process* on ME-selected cases; the "ME Case Error Rate" runs **58–65%** by design (different universe/denominator than the dollar-weighted QC PER).

- **FFY2024 final** (Oct23–Sep24): 36 ME reviews; **ME Case Error Rate 62%**; 965 cases; 601 case findings; 208 program-access findings. By type: Denial 70% · Termination 44% · Recert 66% · Initial-Approval 68%.
- **FFY2025 (thru Jun25):** 30 reviews; **65%**; 805 cases. Denial **75%** · Term 41% · Recert 66% · Initial 76%. Adds a **timeliness panel**: 3-day ES 63% · 7-day ES 74% · 30-day app 87% · recert 93% timely.
- **"19 PMCs Only" variant:** a fixed 19-county subset (PMC = undefined in the docs; likely Performance-Monitored Counties) that consistently posts a **lower error rate** (58% vs 62%; 61% vs 65%). Published a few days ahead of the all-county file.
- Cumulative-YTD; several files are byte-identical FOIA duplicates (bare vs date-stamped names).

---

## 4. Texas comparator (HHSC ORR A05292026.0450037)

### 4a. TX statewide QC case counts (Item 1 — raw Correct/Error dispositions, NOT weighted PER)

| FFY | Correct | Error | Total | Case-error rate |
|---|---|---|---|---|
| 2021 | 643 | 92 | 735 | 12.52 |
| 2022 | 765 | 116 | 881 | 13.17 |
| 2023 | 737 | 118 | 855 | 13.80 |
| 2024 | 808 | 163 | 971 | **16.79** |
| 2025 | 875 | 179 | 1,054 | **16.98** |
| **Total** | **3,828** | **668** | **4,496** | **14.86** |

Case-error rate rose +4.5 pt 2021→2025. Top counties (5-yr grand-total rate): Jefferson 28.1%, Fort Bend 23.7%, Bell 20.4%, El Paso 18.5%, Harris 16.6% (131/787; 19.6% of all state errors), Tarrant 16.0%, Bexar 13.7%, Dallas 12.7%, Hidalgo 11.9%, Travis 9.5%, Webb 5.1%. **>5× county spread under a single state-administered system** — a clean natural-experiment contrast to CA's county-administered dispersion.

### 4b. TX PER / CAPER (Item 8 — three official CAPs submitted to FNS)
- **PER (dollar-weighted):** FFY2023 = **6.81%**; **full-year FFY2024 = 8.32%** (115 of 163 errors at certification); FFY2025 half-yr active = 8.18% vs national 10.42% (**TX below national on PER**).
- **CAPER:** FFY2023 = **48.50%** → FFY2024 = **58.86%** → FFY2025 half = **64.62%**, vs national ~40–42% → **~50% above national** (79.5% of CAPER errors from applications).
- **QC completion:** 84.86% (FY24) → 86.84% (FY25) — **still below FNS minimum** (data-integrity caveat).
- Top FFY2025 PER elements: 311 Wages 23.0% · 150 Household-Composition 18.5% · 363 Shelter 10.3% · 211 Bank/Cash · 111 Student · 161 Time-Limited.
- Root cause (all CAPs): *"insufficient employee training + increased work volume"* (post-COVID staffing erosion).
- **The ~$709M sanction appears NOWHERE.** Only large $ is a **$3.25M SNAP EVG support grant FROM FNS** (not a penalty). See §9.

### 4c. TX takeaway
TX gets the **dollars roughly right (PER 8.32%, below national)** but makes **procedural/case errors on a huge share (CAPER ~59–65%, ~50% above national)** — the mirror image of the CA pattern to test against.

---

## 5. ABAWD / OBBBA §10102 policy layer (CA + TX) — the rules-engine spec

Statute: **OBBBA / H.R.1 (P.L. 119-21), signed 2025-07-04.** Age band **18–54 → 18–64**; dependent-child exemption **under-18 → under-14**; new **Indian/Urban/California Indian** exemption; **removed**: homeless, veteran, former-foster-youth (≤24/25). Time limit **3 countable months / 36 months**; work rule **80 hrs/month (20/wk)**.

| Dimension | California | Texas |
|---|---|---|
| Admin | County-administered (58 counties) | State-administered (HHSC/TIERS) |
| Age-band cutover | **June 1, 2026** screenings begin (gated on statewide waiver expiring **2026-01-31** + forthcoming CDSS ACL) | **Nov 1, 2025** hard cutover (Bulletin 25-16 / TIERS R121) |
| Statewide waiver | Yes — expired **2025-11-02** (fixed clock; current 36-mo period Jan 2023–Dec 2025) | None known |
| 60–64 nuance | subject to time limit, exempt from work registration | subject to time limit, exempt from E&T (Code F) |
| Applicant notice | **CF 886** (rev 8/25, 4pp; still has blank age fill-ins pending FNS guidance) | **Form H1805** (rev 11/25; "18 to 64" language live) |
| Screening form | **CF 377.11E** | verbal informing script + TF0001 |

**CA CalSAWS fact-sheet population estimates (July 2025 data):** ~950K newly subject; **66% of the 2.7M working-age CalFresh adults likely exempt** on admin data (878K child<14, 554K work-reg exempt, 305K disability). **Disproportionate on age 55–64 (+21.7pp) and men (+10.5pp).** **94–96%** of those who lost the homeless/veteran/foster exemptions are **not** covered by the new tribal exemption. Several CA exemptions marked **"pending FNS guidance"** (tribal, child-under-14 verification) → **not yet safe to hard-code**.

> **Repo cross-ref:** directly feeds the uncommitted `age_bands.py` / `AGE_BANDS.md` work on the `qc-engine-fy2023-snapshot` branch and the OBBBA audit (`project_obbba_audit`). Note the CA effective date (6/1/2026) and "pending FNS guidance" gates — the engine should treat the 18–64 expansion as **CA-effective 2026-06-01, not 2025-07-04.**

---

## 6. QC methodology & CA sampling-frame variable dictionary (FY26 Sample Plan + FNS handbooks)

- Governing rulebooks: **FNS Handbook 310** (QC Review, Oct 2025 ed., 306pp — defines PER/CAPER/completion + the FNS-380 element taxonomy + §751/§752 re-review) and **FNS Handbook 311** (QC Sampling, **March 1990** — 35-yr-old, pre-"SNAP" vintage, still operative for both CA & TX).
- **CA FFY2026 target sample: 1,020 active / 680 negative** — **reduced** from the standard 2,400/800; **CA waives its right to challenge the resulting error-rate precision.** (Data-quality note for any FY26 CA QC analysis.)
- **Frame variable dictionary (what the raw CA QC universe contains):**
  - **Active frame (36 vars):** `ALLOTAMT`, `FAM_SIZE`, `AC`/`BENECODE`, `PA_STAT`, `FBU`, `EFF_YM`, county/district/EW identifiers, names/address. Sample-review # encodes Primary(2)/Secondary(3) + month + sequence.
  - **Negative frame (27 vars):** `ACT` (E/S/T/W/X), `ACTION` (1/2/3), **`REASON` (reason code for the negative action)**, `REDETERMINATION` date, `NEGACT` flag.
- **Load-bearing findings:**
  1. **The denial reason-code data EXISTS in CA's QC negative frame (`REASON`)** — the aggregate distribution just wasn't produced as a table (still pending, LA Req 4 / CDSS #2 item 3). It is not a "does not exist" gap; it's a "not-yet-released aggregate" gap.
  2. **Neither frame carries age/ABAWD/demographic flags** → the **elderly equity cut ([`DATA_INVENTORY.md`](DATA_INVENTORY.md) Gap #2) cannot come from the sampling frame** — it must come from the QC *review* record (FNS-380) or gated ACS PUMS. This sharpens the gap: it's a review-record/DUA problem, not a frame problem.

---

## 7. LA County DPSS mega-production (1,221 pp) — structure + what's absent

Bates stamps **COLA000001 → COLA001221** (one per page). It is a **policy/training/outreach dossier, not a data dossier** — ~950 pp (≈pp.250–1210) are the same small asset set repeated across ~10 languages.

| Pages | Content |
|---|---|
| 1–9 | ABAWD Newsletters (March 2026, Sept 2025) |
| ~10–50 | CalFresh Nutrition Planner (Dec 2025) + policy-desk content |
| ~55–250 | ABAWD 101/202 staff training decks (+ CF 377.11E form image, PA 811, "Module 2: What Changed Under H.R.1") |
| ~250–1210 | Multilingual outreach: webinar flyers, GovDelivery blasts, "What Participants Need to Know" sheets, SUA FAQ, "Work Requirements Are Here!" (June 1 2026) |
| **1216–1221** | **Request 7 — application-processing TIMELINESS data** |

**Extracted timeliness (COLA001216–001221):**
- **30-day standard processing:** CY2024 **99.2% ≤30 days** (avg 36,511 approved/mo), CY2025 **99.4%**, CY2026 Jan–Mar **99.3%**.
- **Expedited Service (3-day):** CY2024 1–3-day **98.3–98.7%**; CY2025 **97.7–99.2%**; CY2026 Jan–Mar **~98.9%**. (2022 shows sharp intra-year improvement 82.4%→97.9%.)

**Confirmed absence (as expected — Reqs 4/5/6 not produced):** across ~70 sampled pages, **no denial reason-code tables (Req 4), no performance dashboards/scorecards (Req 5), no correspondence logs (Req 6)**. The only aggregate quantitative data in all 1,221 pages is the Req-7 timeliness tables.

**LA ABAWD specifics:** age 18→64; **CA implementation June 1, 2026**; waiver expired 2025-11-02; must use **CF 377.11E** + verbal inform + **CF 886**; workfare hours = allotment ÷ county min wage (**$17.81/hr → $18.47 eff. July 2026**); policy ref AR 5750 Supp. I, 63-410.3 (2024-03-28).

---

## 8. Cross-cutting findings

1. **CA's honest statewide PER is the Federal series (~10.5–12.5%), not the Combined (~6.4–8%).** CDSS explicitly sidelines State/Combined except in a sanction year. Anything citing a single CA PER should use the Federal number and label the vintage. (Note: reconcile against the repo's canonical "CA = 10.98%" baseline — the QC&I Federal series is 10.50/12.47/9.69‡/11.01 for FFY22–25; the 10.98% figure needs a vintage/source check.)
2. **CA & TX are mirror images.** CA: higher headline PER, agency-share falling, procedural (CAPER) ~40%. TX: lower PER (8.32%, below national) but CAPER ~59–65% (≈50% above national). Both trending worse; both blame post-COVID staffing.
3. **The dominant CA error is procedural over-verification, not benefit math** — CW 2200 over-verification (37/38 counties) + NOMI mishandling (33) + ES-entitlement misses (26) dwarf income miscalculation (25). This is the empirical spine for a "reduce procedural denials" product thesis (finding #420) and validates the student-exemption fix (#373).
4. **Element taxonomy matches the repo 1:1** (311/363/346/334/560 active) and **adds the negative-action codes (540/413/416)** the repo's error-risk model didn't weight — a concrete enhancement path for `packages/snap-qc-engine`.
5. **County PER dispersion is real and large** in both states — CA San Joaquin 1.4% vs LA 15%; TX Webb 5% vs Jefferson 28% — the substrate for county-level targeting/benchmarking.

---

## 9. Red flags & data-quality caveats

- **🚩 $709M TX sanction unsourced.** Not in any of the three produced CAPs (only a $3.25M FNS support grant). `HKS_RESEARCH_PRA_TRACKER.md` §10 anchors Texas item 8 to "$709M by Oct 2027" — **source it externally or retire it before any publication.**
- **🚩 FFY2024 CA Federal PER = 9.69% is policy-restated** (from 10.21%, QC PM 25-03 §751/§752, 7 cases recalled; all 50 states got the look-back → National FFY2024 left unestimated). FFY2024 cross-state PER comparison is compromised.
- **Combined ≠ blended for Federal-only rows.** LA / "39 Counties" / National print State=N/A → their "Combined" is literally the Federal number.
- **County-level rates are small-sample.** ME reviews are 20–30 cases; QC&I county CAPERs hit 0.00%/100.00%. Treat extremes (Glenn 74.93% PER, Monterey 53.28%, the four 100% CAPERs, all 0.00% PERs) as artifacts, not estimates.
- **Periods differ across ME reports** (2-month to full-FY windows); ES/30-day metrics use a *later* quarter than PER/CAPER within the same report. Always compare a county to the CA/Natl figure printed in its own row.
- **FFY2021 QC&I = Q4-only**, different template, no agency/client %.
- **TX Item 1 = case counts, not weighted PER** (14.86% overall ≈ 2× the 8.32% dollar PER). TX QC completion <95% means Item 1 ≈ completed reviews-with-findings, below the 2,400/yr plan minimum.
- **TX ABAWD notice artifact:** "S1 – TF001 60-64" print still shows the OLD 18–54 band; the R121 TF0001 sample is authoritative (renders both thresholds w/ dates).
- **CA FY26 QC sample reduced** to 1,020/680 with precision-challenge waived.
- **ME "error rate" (58–65%) ≠ QC PER** — different universe; do not conflate.
- **PMC undefined** in the source docs (19-county subset; likely Performance-Monitored Counties).

---

## 10. Updated gap map (vs [`DATA_INVENTORY.md`](DATA_INVENTORY.md) §14)

| Gap | Prior state | After this audit |
|---|---|---|
| #4 QC coverage (3 state-FY cells) | thin | **CLOSED** — CA county×FFY PER/CAPER 2021–25 (20 counties) + TX county 2021–25 + 38 county ME reports |
| #6 zero FOIA denial DATA | empty | **substantially filled** — county ME case-narratives + CAPER; frame `REASON` code confirmed to exist. *Aggregate coded distribution still pending (LA Req 4, est. 7/31).* |
| #10 §275 QC methodology | not indexed | **CLOSED** — FNS 310/311 + FY26 CA sample plan (frame dictionaries) |
| #2 elderly/age equity cut | open (needs microdata/PUMS) | **still open + sharpened** — QC sampling frames carry NO age flag; must come from the QC *review* record (FNS-380) or gated ACS PUMS, not the frame |

**Next-step options (unchanged, now evidence-backed):** (1) vendor + ingest the CA county PER panel, TX county panel, and ME denial taxonomy into `data-ops/` with provenance; (2) write `docs/findings/` entries (CA county PER dispersion FFY2023; procedural over-verification as the dominant CA error mode; CA↔TX PER/CAPER mirror); (3) resolve the two red flags before any external use.
