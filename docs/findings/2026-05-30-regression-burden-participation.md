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
    note: "The committed analysis panel (15,300 state-months, 51 states × 1996-2020): 13 policy levers (3 families) + FNS participation/caseload/issuance. The regression reproduces from this with no raw files."
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

## What each variable family captures (the R² ladder)

Beyond a single coefficient, the analysis decomposes *what explains SNAP
participation*. Levers are added in families under the same state + month fixed
effects; each cell is the cumulative within-R² — the share of within-state,
within-month variation the levers explain:

| Outcome | Eligibility | + Transaction-cost | + Procedural (full) |
| --- | --- | --- | --- |
| Participation (persons) | 0.17 | **0.36** | 0.45 |
| Caseload (households) | 0.17 | 0.34 | 0.43 |
| Avg benefit / person | ≈0 | ≈0 | ≈0 |

Two reads jump out. **Transaction-cost modernization** (call centers, online
apps, simplified reporting) captures the **largest jump** — +0.19 for
participation, more than eligibility breadth or procedural rules. And **no
policy family explains average benefit per person** (≈0): the benefit *level* is
federally set, so state policy moves *who is enrolled*, not how much they get —
precisely the retention margin Civica targets. **Caseload tracks participation**
(BBCE +8.8%, simplified reporting +7.9%, call centers +6.4%, all significant) —
the effect is households entering and staying, not a per-household artifact.

**Robustness.** Adding a state-specific linear trend (the smooth part of
state-economic divergence the national time effects miss): **BBCE (+6.7%) and
simplified reporting (+5.8%) stay significant**; call centers attenuate to
non-significant. The two strongest levers survive the toughest control
available without external data.

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
- **State economic shocks** are the main confounder. National shocks are
  absorbed by the calendar-month fixed effects; the **state-trend robustness**
  (above) absorbs smooth state divergence, and the two strongest levers survive
  it. A state-unemployment control would be tighter still — but FRED and BLS were
  unreachable from the build environment, so it is the declared next refinement,
  alongside a Callaway–Sant'Anna estimator for the staggered timing.
- **Participation ≠ payment error.** This measures the *retention margin* — the
  door the thesis is about (fewer eligible people lost to friction) — not QC
  dollars-in-error directly. Those remain the QC/PER/CF-296/CF-18 datasets.
- Panel ends **Dec 2020** (ERS coverage); post-COVID needs hand-coded levers and
  carries the EA/unwinding confound.

Related: [[2026-05-28-per-regression-preregistration]] (the forward Civica test) ·
[[2026-05-29-data-ers-snap-policy-db]] (treatment) ·
[[2026-05-30-data-fns-state-monthly]] (outcome) ·
[[2026-05-28-retention-pillar-unrath]] (the pillar this sizes).
