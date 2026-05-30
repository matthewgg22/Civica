---
id: 2026-05-29-data-ers-snap-policy-db
date: 2026-05-29
scope: [analytics, regression, pitch]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "USDA ERS SNAP Policy Database (ers.usda.gov/media/6472/snap-policy-database.xlsx)"
    note: "Public domain. 15,300 state-months × 49 policy columns, Jan 1996–Dec 2020. Sheet 'SNAP Policy Database'."
  - kind: file
    ref: data-ops/sample/ers-snap-policy-db/ca_policy_levers.csv
    note: "CA subset, 300 state-months, all 49 columns."
  - kind: file
    ref: data-ops/sample/ers-snap-policy-db/lever_adoption_national.json
    note: "National adoption of key levers by year."
---

## What we found

Pulled the **ERS SNAP Policy Database** — the canonical state×month panel of SNAP
policy levers (BBCE + asset/vehicle variants, simplified & periodic reporting,
certification length, call centers, vehicle exclusion, transitional benefits,
online application, …): **15,300 state-months × 49 columns, Jan 1996 – Dec 2020.**

The diffusion is exactly the variation a causal design needs — e.g. **BBCE
(broad-based categorical eligibility) went from 0% of states in 1996 to ~80% by
2020**, state by state at different times.

## Why it matters

This is **the exogenous-IV spine** the regression-data audit
([[2026-05-29-regression-data-sources]]) flagged as P0. It supplies the
within-state, over-time policy variation that turns Civica's error/churn panels
(QC, CF-18) into a **causal** design — fixed-effects, difference-in-differences,
event-study on the staggered adoption of each lever. Everything else (the QC error
DV, the CF-18 churn DV, ICPSR enrollment) joins onto this by state + month.

## What changes / open questions

- Vendored `data-ops/sample/ers-snap-policy-db/` (CA subset + national adoption +
  repro). The full national DB regenerates from the one xlsx URL.
- **Coverage ends Dec 2020** — post-2020 CA levers need hand-coding, or hold the
  panel to ≤2020.
- Pair with the ERS **SNAP Policy Index** (a pre-built composite stringency score)
  for a one-number IV when ~30 collinear dummies are unwieldy — deferred.

Related: [[2026-05-29-regression-data-sources]] · [[2026-05-28-per-regression-preregistration]] · [[2026-05-29-cdss-cf18-churn]]
