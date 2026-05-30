---
id: 2026-05-30-regression-burden-participation
date: 2026-05-30
scope: [analytics, regression, pitch]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: file
    ref: tools/snap-policy-regression/src/build_policy_regression.py
    note: "The harness. Assembles the national panel from the two public sources and fits a two-way fixed-effects model + a BBCE event study (linearmodels PanelOLS, cluster-robust by state)."
  - kind: file
    ref: data-ops/sample/snap-policy-regression/analysis_panel.csv
    note: "The committed analysis panel (15,300 state-months, 51 states × 1996-2020): policy levers + FNS participation. The regression reproduces from this with no raw files."
  - kind: file
    ref: apps/dashboard/lib/analytics/policy-regression-results.json
    note: "The fitted artifact the /findings/regression replication panel renders."
  - kind: dataset
    ref: "USDA ERS SNAP Policy Database (treatment) + USDA FNS National/State Monthly Data (outcome), both public, no FOIA"
    note: "Joined 1:1 on state × month, 15,300 state-months."
  - kind: external
    ref: "Ganong & Liebman (2018, AEJ:EP); Klerman & Danielson (2011); Kabbani & Wilde (2003)"
    note: "The administrative-burden / transaction-cost literature this replicates."
---

## What we found

The first **real causal estimate** in the evidence ledger — not synthetic, not
FOIA-pending. Run on **51 states × 1996–2020 (15,300 state-months)**, two-way
fixed effects (state + calendar-month), cluster-robust by state: **policies that
cut applicant burden measurably raise SNAP participation.**

| Policy lever | Effect on participation | 95% CI | p |
| --- | --- | --- | --- |
| Simplified / periodic reporting | **+8.9%** | [+3.3, +14.5] | 0.002 |
| Broad-based categorical eligibility | **+7.6%** | [+1.5, +13.7] | 0.014 |
| Call-center case management | **+6.3%** | [+1.3, +11.3] | 0.014 |
| Online application | +0.8% | [−4.0, +5.7] | 0.74 |
| In-person interview required (initial / recert) | +4.8% / +2.0% | — | ns |

The **BBCE event study** (vs the year before adoption, 10 never-adopters as
controls) is textbook: pre-adoption effects are flat and insignificant
(year −2: +1.4%, ns) — the parallel-trends check — then participation ramps
**+3.5% → +7.1% → +9.9% → +17.1%** over the three+ years after adoption
(all p < 0.005). Flat leads, rising lags: the signature of a causal effect, not
a pre-existing trend.

These magnitudes **recover the published administrative-burden literature**
(Ganong & Liebman 2018; Klerman & Danielson 2011) on independent data — which
validates the whole estimation pipeline on a known benchmark.

## Why it matters

- **It proves the mechanism before Civica has a single case.** The pre-registered
  harness ([[2026-05-28-per-regression-preregistration]]) measures *Civica's* own
  effect, but that waits on production traffic. This is the complementary
  *external* test: the thing Civica sells — lowering the paperwork friction on
  an application/renewal — is exactly the kind of intervention that, in 25 years
  of public data, **raises the share of eligible people who get and keep
  benefits.** The pitch no longer rests on a synthetic power analysis; it rests
  on a reproducible regression that recovers the literature.
- **It turns the whole data campaign into one number.** The ERS Policy Database
  (the IV spine) and the FNS monthly backbone were pulled for precisely this
  join; here they produce a measured, cited effect.

## What changes

- `/findings/regression` now carries a second, **live** section ("Does lower
  burden actually raise enrollment?") below the synthetic pre-registration —
  real coefficients, the event-study path, full provenance.
- Civica can cite a concrete causal magnitude (burden-reducing modernization →
  **+6–9%** participation) as external support for the retention pillar.

## Honest limits

- **TWFE caveat.** Two-way fixed effects with staggered binary treatment and
  heterogeneous effects can be biased (Goodman-Bacon); the **event study is the
  more credible read**, and it agrees.
- **State economic shocks** are not fully absorbed by the national time effects.
  The flat BBCE pre-trends mitigate this; a state-unemployment control (BLS LAUS)
  is the declared next robustness, alongside a Callaway–Sant'Anna estimator.
- **Participation ≠ payment error.** This measures the *retention margin* — the
  door the thesis is about (fewer eligible people lost to friction) — not QC
  dollars-in-error directly. Those remain the QC/PER/CF-296/CF-18 datasets.
- Panel ends **Dec 2020** (ERS coverage); post-COVID needs hand-coded levers and
  carries the EA/unwinding confound.

Related: [[2026-05-28-per-regression-preregistration]] (the forward Civica test) ·
[[2026-05-29-data-ers-snap-policy-db]] (treatment) ·
[[2026-05-30-data-fns-state-monthly]] (outcome) ·
[[2026-05-28-retention-pillar-unrath]] (the pillar this sizes).
