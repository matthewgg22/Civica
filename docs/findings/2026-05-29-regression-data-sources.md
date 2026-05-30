---
id: 2026-05-29-regression-data-sources
date: 2026-05-29
scope: [analytics, pitch, regression]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: url
    ref: "https://www.icpsr.umich.edu/web/sbeccc/studies/39331"
    note: "ICPSR 39331 (Pukelis), public-use, deposited 2025-05-29. DS2 county-month enrollment 1993–2024 (all states); DS1 COVID policy state-month (recert waivers, EA, simplified app) = natural-experiment IVs. Build code: github.com/kpukelis/snap_data."
  - kind: url
    ref: "https://www.ers.usda.gov/data-products/snap-policy-data-sets"
    note: "ERS SNAP Policy Database — state×month policy levers (BBCE, simplified/periodic reporting, recert length, online app, call center, fingerprinting), Jan 1996–Dec 2020. Public domain. The canonical exogenous-IV spine."
  - kind: url
    ref: "https://www.openicpsr.org/openicpsr/project/124381/version/V1/view"
    note: "Homonoff & Somerville, SF CalFresh case-level recertification microdata 2014–2016 with quasi-random interview-date instrument. openICPSR (free account; AEA research-use terms). CA-specific causal churn design."
  - kind: url
    ref: "https://www.hamiltonproject.org/data/snap-payment-error-rates-by-state-fy-2003-24/"
    note: "SNAP payment error rate by state-year FY2003–FY2024 (over/underpayment split), sourced from FNS QC. Long error-DV panel. Cross-check fns.usda.gov/snap/qc/per."
  - kind: file
    ref: docs/findings/2026-05-28-per-regression-preregistration.md
    note: "The pre-registered regression these sources feed; currently synthetic, FOIA-pending."
---

## What we found

Two parallel agentic audits (the 2026-05-27 source list re-read through a
regression lens + a fresh search for new sources) reached the same conclusion:
**the pre-registered PER/churn regression does not have to wait for the CDSS FOIA.**
There is abundant public panel data to run it *now* on at least two of the five
DVs (payment error, recert/churn). Access landing pages were verified by web
search; byte-downloads were not confirmed (agent WebFetch was blocked), so treat
"access" as the official source, not a tested pull.

### The do-now tier (P0)

| Dataset | Unit | Serves | Years | Access |
| --- | --- | --- | --- | --- |
| **ICPSR 39331 (Pukelis)** | county-month + state-month policy | **churn DV** (national county-month caseload) + **COVID-waiver IVs** | enrollment 1993–2024; policy 2020–23 | public-use, free |
| **ERS SNAP Policy Database** | state-month | **the IV spine** (BBCE, simplified reporting, recert length, online app…) | 1996–2020 | public domain |
| **openICPSR 124381 (Homonoff & Somerville)** | case × recert (SF) | **causal CA churn DV** w/ quasi-random interview-date instrument | 2014–2016 | openICPSR (free acct) |
| **Hamilton Project / FNS** payment error by state | state-year | **long payment-error DV panel** | FY2003–FY2024 | public |
| **USDA QC public-use multi-year** | SNAP case | **payment-error DV microdata** (stack FY2018–FY2024) | FY18–FY24 (FY21=3mo) | public-use |

### Next tier (P1–P2)

- **openICPSR 194727** (Giannella/Homonoff/Rino/Somerville) — LA RCT on
  administrative burden → procedural denials (~65K applicants). Experimental CA
  causal design.
- **CDSS CF 296** (county-month applications/approvals/denials/**discontinuances
  for failure to complete**) + **DFA 256** (caseload denominator) — CA county-month
  churn DV that pairs natively with CF-18.
- **PolicyEngine US** (already offline) — expected-benefit instrument: error =
  f(reported − simulated).
- **Census ACS PUMS (FOODSTMP)** + **SAIPE** — take-up denominators + need-side
  controls (county-year poverty).
- **ERS Food Environment Atlas** — county store-access controls (ties to the
  heatmap/food-desert track).

### Gated / skip

- **Unrath, "Targeting, Screening, and Retention"** — the canonical CalFresh
  retention paper, but the panel is confidential CDSS/MEDS, request-only via CA
  Policy Lab. Aspirational data-request, not an acquisition. Working paper public.
- **Erdős classifier** — borrow feature recipes only; we already have the CA
  SNAP-gap equivalent. **Franklin Tan** — no dataset. **Finkelstein/Notowidigdo**
  — public but elderly take-up (no error/churn DV).

## Why it matters

- **It unblocks the regression.** Join **ERS Policy Database (IV)** × **ICPSR
  39331 / openICPSR SF recert (churn DV)** × **Hamilton error panel (error DV)**
  and Civica can run a *real causal estimate* on payment error and recert/churn
  before the FOIA lands. The FOIA'd CDSS case-level QC stays the gold standard for
  the per-case error DV — but it is no longer a hard blocker for credibility.
- **The COVID waivers are a natural experiment.** Staggered, state-varying
  recert-waiver/EA policy (ICPSR 39331 DS1 + ERS Policy DB) is a textbook
  instrument for "what does relaxing recertification do to retention" — exactly
  the mechanism Civica's recert-completion and throughput DVs target.
- **Two CA case-level academic panels already operationalize churn** (SF + LA),
  with identification built in. Closest thing to a ready-made causal harness.

## What changes

- The pre-registration ([[2026-05-28-per-regression-preregistration]]) should
  record these as the **real-data path** that runs before the FOIA. Recommend
  pulling the P0 four first.
- Candidate vendor targets: `data-ops/sample/{snap-enrollment-panel (ICPSR 39331),
  ers-snap-policy-db, snap-per-by-state, openicpsr-sf-recert}/`.

## Open questions / honest limits

- **Byte-downloads unverified** (agent fetch was blocked) — confirm each pull in a
  browser; openICPSR needs a free account + AEA research-use terms (derive
  features, do not redistribute raw rows).
- **ERS Policy DB ends Dec 2020** — hand-code post-2020 CA policy changes or hold
  the panel to ≤2020.
- **QC schema drifts year-to-year** + replicate weights needed for correct SEs.
- This is a *catalog*, not yet a vendored dataset — nothing here is in `data-ops/`
  until pulled.

Related: [[2026-05-28-per-regression-preregistration]] · [[2026-05-29-cdss-cf18-churn]] · [[2026-05-29-usda-qc-ca-grounding]] · [[2026-05-29-error-rate-truth-point]]
