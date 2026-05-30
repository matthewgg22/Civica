---
id: 2026-05-29-data-ers-food-atlas
date: 2026-05-29
scope: [analytics, regression, pitch]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "USDA ERS Food Environment Atlas (ers.usda.gov/media/5569/food-environment-atlas-data-download.xlsx)"
    note: "County indicators; STORES / ACCESS / ASSISTANCE sheets. CA = 58 counties extracted."
  - kind: file
    ref: data-ops/sample/ers-food-atlas/ca_food_access.csv
    note: "CA county store density, low-access pop, SNAP participation."
---

## What we found

Pulled the **ERS Food Environment Atlas** and extracted California's 58 counties:
store density per 1,000 pop (grocery, supercenter, convenience, **SNAP-authorized
stores**), low-food-access population, and SNAP participation — each with two
vintages for change-over-time.

## Why it matters

- **County control variables / secondary IVs** for the SNAP error & churn
  regression (food-access and store-density confounders that vary across
  California's counties).
- **It hands the retention heatmap its missing layer.** The `/findings/retention`
  choropleth ([[2026-05-29-cdss-cf18-churn]]) currently shows raw SNAP-*retailer
  counts* (which track population, not access). `SNAPSPTH` — SNAP-authorized stores
  **per 1,000 people** — is a true per-capita **food-access** metric, so the map
  can finally test the food-desert × churn story honestly.

## What changes / open questions

- Vendored `data-ops/sample/ers-food-atlas/ca_food_access.csv` + repro.
- Next: wire `SNAPSPTH` into the retention heatmap as a per-capita food-access
  overlay (replacing the raw retailer count) — a dashboard follow-up.
- The full Atlas has 280+ indicators; only the food-access subset was extracted.

Related: [[2026-05-29-cdss-cf18-churn]] · [[2026-05-29-regression-data-sources]]
