---
id: 2026-05-31-per-element-error-regression
date: 2026-05-31
scope: [analytics, snap-qc-engine, pitch]
confidence: medium
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: file
    ref: tools/per-element-error-regression/src/build_per_element_regression.py
    note: "The harness. Filters CA (STATE==6) from the USDA QC FY2023 public-use file, builds household-characteristic predictors, fits one unweighted logistic (statsmodels Logit, HC1 robust SEs) PER error element, flags underpowered + quasi-separated models, emits the artifact + provenance."
  - kind: file
    ref: apps/dashboard/lib/analytics/per-element-error-results.json
    note: "The results artifact (source_kind=qc_microdata — REAL federal data, not synthetic). Regenerate: build_per_element_regression.py --data <qc_pub_fy2023.csv>. Companion provenance sidecar records the source, weight, column map, spec version."
  - kind: file
    ref: apps/dashboard/lib/analytics/per-element-error.ts
    note: "Typed loader + isSignificant() + the reliable-model filter (converged ∧ powered ∧ non-separated). vitest locks the real values."
  - kind: external
    ref: "https://snapqcdata.net/datafiles"
    note: "USDA SNAP QC Public-Use File FY2023 (public, free). CA n=867 sampled cases. Element-of-error coding per FY2023 Tech Doc Ch. V."
  - kind: file
    ref: docs/findings/2026-05-29-usda-qc-ca-grounding.md
    note: "The descriptive companion: the same CA QC file's element-attribution SHARES (shelter 41.5%, shelter|wages 60.8%, operational/client 65/35). This finding adds the per-element REGRESSION on top of those shares."
---

## What we found

We ran the **individual per-element error regression** the mission map was
missing: on the real **USDA QC FY2023 California** microdata (n=867 sampled
cases), one logistic model **per error element** — what household
characteristics predict an error in *that specific element* — instead of one
aggregate payment-error number.

Predictors (pre-registered, household characteristics): household size,
has-earned-income, has-elderly (any member ≥60), has-child. Unweighted logistic,
HC1 robust SEs.

**Two clean, powered, significant signals — and they are Civica's two pillars:**

| Model (n events) | Strongest predictor | Odds ratio [95% CI] | p |
| --- | --- | --- | --- |
| **Any error** (379) | has-elderly | **3.27** [2.30, 4.65] | <0.001 |
| **Any error** (379) | has-earned-income | **2.65** [1.76, 3.99] | <0.001 |
| **Shelter deduction** (363; 158) | has-elderly | **3.64** [2.41, 5.49] | <0.001 |

- An **elderly** household is **~3.3× more likely to have a determination error**, and the effect is **concentrated in the shelter deduction (~3.6×)** — consistent with the mechanism (elderly get uncapped shelter + medical deductions = the hardest math). Earned income does **not** predict shelter errors (OR 0.92, ns) — it is a *distinct* error pathway.
- An **earned-income** household is **~2.65× more likely to error** overall (wage volatility) — the other pillar.

So the two most error-prone subsets are **elderly** (shelter/medical complexity) and **earners** (wage volatility) — exactly the two surfaces Civica verifies (SUA/shelter + earned-income). The product thesis now has a *controlled* regression behind it, not just descriptive shares.

## Honest limits (what it does NOT say)

- **Not the PER.** The DV is QC **variance-citation** per element (the engine's element-attribution basis); ~43.7% of CA cases cite *some* variance vs the ~11% dollar-weighted PER. These are not PER rates.
- **Not causal.** Cross-sectional QC sample, no treatment/Civica flag — associations, not effects. (The causal question stays with the pre-registered treatment-effect regression, [[2026-05-28-per-regression-preregistration]].)
- **Unweighted**, n=867. FYWGT is used only for the descriptive weighted prevalence reported alongside each model; design-based SEs would need replicate weights / strata the public-use file lacks.
- **Degenerate per-element models, flagged not hidden:** the **wage** model is quasi-separated (mechanically tied to has-earned-income, OR≈135 — reported with a `quasi_separation` flag, not trusted); **RSDI** and **SSI** did not converge (separation on elderly); **other-unearned / self-employment / SUA** are **underpowered** (n events < 30). The loader's `reliable` set keeps only the converged, powered, non-separated models (any-error + shelter).

## Why it matters

- **Targeting, evidenced.** "Elderly + earners are the error-prone cohorts" was a hypothesis from descriptive shares; this is the first controlled, CI-bearing confirmation on real federal data — and it maps 1:1 to Civica's two verification pillars.
- **It is the per-subset complement** to the aggregate regressions: the pre-reg PER regression (synthetic, treatment effect) and the burden→participation regression (real, participation DV) both treat error/participation as one outcome; this one cuts the error *by element* and *by who*.
- **Reproducible + drift-proof.** One command regenerates the artifact from the public file; the loader test locks the real numbers + the reliable-filter logic.

Related: [[2026-05-29-usda-qc-ca-grounding]] (the element-share descriptive layer this regresses), [[2026-05-28-error-attribution-framework]] (which *proposed* per-slice weighting — this is a first concrete per-element model), [[2026-05-28-per-regression-preregistration]] (the causal, treatment-effect complement).
