---
id: 2026-05-30-data-fns-state-monthly
date: 2026-05-30
scope: [analytics, regression, pitch, retention]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "USDA FNS SNAP Data Tables — National and/or State Level Monthly Data (snap-zip-fy69tocurrent), public, no login"
    note: "One workbook per fiscal year FY1989-FY2025; CA = WRO sheet. Raw zip not committed."
  - kind: file
    ref: data-ops/sample/fns-snap-state-monthly/ca_monthly_participation.csv
    note: "444 CA months Oct 1988-Sep 2025, zero gaps: households, persons, issuance, footnote."
  - kind: file
    ref: tools/fns-snap-state-monthly/extract_ca.py
    note: "Reproducible extractor (WRO sheet, issuance picked by magnitude across vintages, footnotes preserved)."
---

## What we found

The **long state-level outcome backbone** the causal kit was missing. ICPSR
39331's California panel stops at 2016; this runs **Oct 1988 → Sep 2025 — 444
consecutive months, zero gaps** — households, persons, and issuance, straight from
the FNS monthly data tables (public, no FOIA).

It captures the **entire modern policy history of CalFresh** in one series
(annual-avg persons): 1.8M (1989) → **3.1M (1996)** → **1.8M (2000, a −42% drop
through the PRWORA welfare-reform era)** → 2.3M (2008) → **4.2M (2013, the Great
Recession / ARRA peak)** → 4.4M (COVID) → an all-time peak **5.50M in Dec 2024**.

## Why it matters

- **It is the outcome variable with the longest reach.** The ERS Policy Database
  IV spine runs 1996–2020; this enrollment series *brackets* it on both ends, so
  every policy lever has years of pre- and post-period for an event study — the
  30+ years of pre-trends DS0003's 2016–2024 window could not give.
- **A built-in benefit-timing experiment.** Jan/Feb 2019 carry FNS's `/2`
  footnote: during the Jan-2019 federal shutdown, February benefits were issued
  early in January (Jan ≈ 2× issuance; Feb counts depressed). Kept faithful to
  source as its own column — a natural shock on the *timing* margin Civica targets.

## Honest limits

- **State-level, not county.** County granularity is the 39331 panel (2016–2024);
  this trades geography for 37 years of history.
- **Participation/issuance only** — no error or denial DV here (those are the QC /
  PER / CF-296 / CF-18 datasets). This is the enrollment denominator + the trend.
- FY2025 tail is preliminary and may revise.

Related: [[2026-05-30-data-icpsr-39331-enrollment]] · [[2026-05-29-data-ers-snap-policy-db]] · [[2026-05-29-data-snap-per-by-state]] · [[2026-05-29-regression-data-sources]]
