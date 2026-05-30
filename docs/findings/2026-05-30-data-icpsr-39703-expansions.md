---
id: 2026-05-30-data-icpsr-39703-expansions
date: 2026-05-30
scope: [analytics, regression, pitch]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "ICPSR 39703 — Zhang, Ma & Mowbray, State-Level SNAP Expansions During and After COVID-19, 2020-2023 (public-use, DS0001 Delimited)"
    note: "51 states/DC × 50 policy variables: Emergency Allotment timing, pandemic school-meal + childcare expansions, by program year."
  - kind: file
    ref: data-ops/sample/icpsr-39703-snap-expansions/snap_expansions_2020_2023.csv
    note: "The 51-row state policy table, verbatim."
---

## What we found

Pulled **ICPSR 39703** — a state-level panel of the COVID-era SNAP expansions,
2020–2023: Emergency Allotment (EA) approval/end dates + amounts, and pandemic
school-meal / childcare program expansions, for all 51 states + DC. California's
EA ran **2020-03-30 → 2023-02-28**.

## Why it matters

- **It closes the post-2020 hole in the IV spine.** The ERS SNAP Policy Database
  ([[2026-05-29-data-ers-snap-policy-db]]) ends **Dec 2020**; this carries the
  state policy variation through **2023**.
- **The EA-end dates are a natural experiment.** Emergency Allotments added
  ~$95+/household/month; when they ended ("the hunger cliff"), benefits dropped
  sharply — and the **end date varied by state**. That staggered shock is a clean
  instrument for "what happens to churn, hardship, and error when emergency
  benefits stop" — directly relevant to Civica's retention pillar.
- Together with **ICPSR 39331**'s COVID *waiver* table (interview/recert waivers),
  this gives the full COVID-policy IV set for a difference-in-differences /
  event-study on SNAP churn and error.

## What changes / open questions

- Vendored `data-ops/sample/icpsr-39703-snap-expansions/` (the 51-row table) + repro.
- Pair the EA-end dates with CDSS CF-18 churn ([[2026-05-29-data-cdss-cf18-churn]])
  — does CA churn jump after Feb 2023? An event study, deferred.
- ICPSR 39331 DS0002 (county enrollment) is the matching outcome panel — still to
  pull (Delimited).

Related: [[2026-05-29-data-ers-snap-policy-db]] · [[2026-05-29-regression-data-sources]] · [[2026-05-28-retention-pillar-unrath]]
