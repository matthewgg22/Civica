---
id: 2026-05-30-data-icpsr-39331-enrollment
date: 2026-05-30
scope: [analytics, regression, pitch, retention]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "ICPSR 39331 (Pukelis), SNAP COVID-19 Policy and Enrollment Data, 1987-2024 (public-use, DS0002 county + DS0001 policy, Delimited)"
    note: "CA slice (STATEFIPS==6). DS0002 county-month 2016-2024, 58 counties; DS0001 state-month policy/waivers."
  - kind: file
    ref: data-ops/sample/icpsr-39331-enrollment/ca_county_month_enrollment.csv
    note: "CA county-month enrollment + application dispositions (incl. needbased vs procedural denial split)."
  - kind: file
    ref: data-ops/sample/icpsr-39331-enrollment/ca_policy_waivers.csv
    note: "CA state-month COVID policy/waiver records (the IVs)."
---

## What we found

The **county-month enrollment OUTCOME panel** the regression was missing.
California, **58 counties, 2016–2024** (5,336 county-months): SNAP households,
individuals, issuance, and application dispositions — including the
need-based-vs-**procedural** denial split — plus the state-month COVID
policy/waiver table (DS0001).

**It independently cross-validates the CF 296 finding.** Pukelis's county data
puts CA's **procedural-denial share at ~60%** (55.5% → 64.1%, 2019–2024); CDSS
**CF 296** put it at **~67%** ([[2026-05-29-data-cdss-cf296-denials]]). Two
unrelated federal/state sources agree: **~2 in 3 California application denials
are procedural, not need-based.** When independent datasets converge on a number,
the claim hardens.

## Why it matters

- **It completes the causal kit.** 39703 (EA-end timing) + DS0001 (waivers) are
  the instruments; *this* is what you regress them on — county-month enrollment +
  denials. The COVID natural experiment ([[2026-05-30-data-icpsr-39703-expansions]])
  is now runnable end-to-end on real public data, no FOIA.
- **It is the cleanest enrollment/churn outcome we have** — monthly, every CA
  county, with the procedural-denial DV built in (no positional cell-mapping
  needed, unlike CF 296).

## Honest limits

- CA **county**-month coverage is 2016–2024 (DS0002's CA availability); the
  state-level DS0003 reaches back to 1987 — not extracted here.
- `POLICY_NAME` is coded; the ICPSR codebook supplies the labels (e.g.
  recertification/interview waivers).

Related: [[2026-05-30-data-icpsr-39703-expansions]] · [[2026-05-29-data-cdss-cf296-denials]] · [[2026-05-29-data-cdss-cf18-churn]] · [[2026-05-29-regression-data-sources]]
