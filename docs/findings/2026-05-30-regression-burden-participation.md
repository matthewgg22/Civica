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
    note: "The harness (schema 2.x). Assembles the national panel and fits an R² ladder by policy family across 3 outcomes, a parsimonious interpretable-coefficient spec, a state-trend robustness pass, + a BBCE event study (linearmodels PanelOLS, cluster-robust by state)."
  - kind: file
    ref: data-ops/sample/snap-policy-regression/analysis_panel.csv
    note: "The committed analysis panel (15,300 state-months, 51 states × 1996-2020): 13 policy levers (3 families) + FNS participation/caseload/issuance + state unemployment (the cycle control). Reproduces from this with no raw files."
  - kind: dataset
    ref: "FRED state monthly Unemployment Rate ({ST}UR, SA) → data-ops/sample/snap-policy-regression/state_unemployment.csv"
    note: "The Model-S1 business-cycle control, 51 states 1996-2020. Ingested by tools/snap-policy-regression/src/ingest_unemployment.py."
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
fixed effects (state + calendar-month), cluster-robust by state, **with state
unemployment as an explicit business-cycle control**: **burden-reducing policy
raises SNAP participation even after netting out the economy.**

| Lever (participation, cycle-controlled) | Effect | p |
| --- | --- | --- |
| *Unemployment (control, per pp)* | *+5.98* | *<0.001* |
| Simplified / periodic reporting | **+9.4%** | 0.002 |
| Call-center case management | **+5.7%** | 0.015 |
| Broad-based categorical eligibility | +4.8% | 0.10 (ns) |
| Online application · interview rules | ns | — |

The headline shift from the cycle control: the **burden-reducers (simplified
reporting, call centers) hold**, while **BBCE — an eligibility expansion —
attenuates to non-significance** for participation (it was partly confounded
with the recession it was adopted during; it stays marginal for caseload). What
survives an explicit cycle control is *friction-reduction*, not
*eligibility-expansion* — precisely Civica's lever.

The **BBCE event study** (vs the year before adoption, 10 never-adopters as
controls) is textbook: pre-adoption effects are flat and insignificant
(year −2: +1.4%, ns) — the parallel-trends check — then participation ramps
**+3.5% → +7.1% → +9.9% → +17.1%** over the three+ years after adoption
(all p < 0.005). Flat leads, rising lags: the signature of a causal effect, not
a pre-existing trend.

These magnitudes **recover the published administrative-burden literature**
(Ganong & Liebman 2018; Klerman & Danielson 2011) on independent data — which
validates the whole estimation pipeline on a known benchmark.

## What each variable family captures (the R² ladder)

The analysis decomposes *what explains SNAP participation* — starting with the
**business cycle** (state unemployment, the Model-S1 control), then each policy
family. Each cell is the cumulative within-R² (share of within-state,
within-month variation explained):

| Outcome | Business cycle | + Eligibility | + Transaction-cost | + Procedural |
| --- | --- | --- | --- | --- |
| Participation (persons) | **0.26** | 0.34 | 0.49 | 0.55 |
| Caseload (households) | 0.24 | 0.32 | 0.46 | 0.52 |
| Avg benefit / person | 0.06 | ≈0 | ≈0 | ≈0 |

Three reads. (1) **The business cycle is the single biggest factor** — state
unemployment alone explains ~0.26 of the within-variation (each +1pp of
unemployment → ~6% more participation; counter-cyclical, as expected). (2) On
top of it, **transaction-cost modernization** adds the largest *policy* jump
(+0.16) — more than eligibility breadth or procedural rules. (3) **No family
explains average benefit per person** (≈0): the benefit *level* is federally
set, so state policy moves *who is enrolled*, not how much they get.

**Robustness — two controls, not one.** Beyond the unemployment control, adding
a state-specific linear trend: **simplified reporting survives both** (+6.2%,
p=0.015); call centers survive the cycle control but fade under state trends;
BBCE is non-significant under either. The lever that clears every hurdle is the
burden-reducer.

**A note on method.** The *saturated* all-13-lever model is multicollinear (BBCE
and its asset/income sub-variants move together — BBCE's coefficient even flips
to −40%, an artifact). So block-level R² answers "what's captured" and a
*parsimonious* one-lever-per-family spec gives the interpretable coefficients
in the headline table.

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
- **The business cycle — the main confounder — is now an explicit control**
  (state unemployment, FRED state UR, seasonally adjusted), not merely absorbed
  by the time FE; it is the single biggest factor, and the burden-reducers
  survive it. State-specific linear trends are a second control. The remaining
  refinement is a Callaway–Sant'Anna estimator for the staggered timing.
- **Participation ≠ payment error.** This measures the *retention margin* — the
  door the thesis is about (fewer eligible people lost to friction) — not QC
  dollars-in-error directly. Those remain the QC/PER/CF-296/CF-18 datasets.
- Panel ends **Dec 2020** (ERS coverage); post-COVID needs hand-coded levers and
  carries the EA/unwinding confound.

Related: [[2026-05-28-per-regression-preregistration]] (the forward Civica test) ·
[[2026-05-29-data-ers-snap-policy-db]] (treatment) ·
[[2026-05-30-data-fns-state-monthly]] (outcome) ·
[[2026-05-28-retention-pillar-unrath]] (the pillar this sizes).
