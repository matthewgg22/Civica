---
id: 2026-05-28-per-regression-preregistration
date: 2026-05-28
scope: [snap-qc-engine, analytics, pitch]
confidence: medium
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: file
    ref: tools/per-regression/src/build_per_regression.py
    note: "The harness. Defines the pre-registered SPEC, synthesizes a FOIA-shaped case-level population with planted effects + realistic confounding, fits OLS / Logit / Poisson via statsmodels, and emits the coefficient-table artifact. Self-tests that each 95% CI covers its planted effect."
  - kind: file
    ref: apps/dashboard/lib/analytics/per-regression.ts
    note: "TypeScript mirror of the spec + the loader that joins plan to results by dvKey. A vitest parity test fails the build if the harness drifts from the reviewed plan."
  - kind: file
    ref: apps/dashboard/lib/analytics/per-regression-results.json
    note: "Build-time artifact the /findings/regression panel renders. Today source_kind=synthetic, watermarked. Rerun the harness with --data <foia.csv> to flip it to source_kind=foia — no dashboard change."
  - kind: file
    ref: apps/dashboard/lib/analytics/per-history.ts
    note: "CA FY2024 total PER (10.98%) — the federal QC figure liability is assessed on. Anchors the synthetic payment-error baseline."
  - kind: external
    ref: "https://www.statsmodels.org/"
    note: "Estimation: OLS with HC1 robust SEs; Logit + GLM-Poisson with MLE SEs. p-values, 95% CIs, and pseudo-R² come straight from the fit."
  - kind: memory
    ref: project_error_rate_engine
    note: "The FOIA to CDSS for case-level QC findings is the listed open item that turns this from a synthetic power analysis into a live causal estimate."
---

## What we found

Civica's pitch promises a *causal* reduction in the SNAP payment error rate
(plus faster decisions, higher handoff + recertification completion, more
navigator throughput). A promise like that is only credible if the way we
will measure it is **locked before the outcome data arrives** — otherwise it
is unfalsifiable p-hacking. So we pre-registered the analysis and built the
machinery now, on synthetic data, with the FOIA'd numbers still pending.

The plan (frozen 2026-05-28, mirrored in code by the Python `SPEC` and the
TypeScript `PREREGISTERED_SPEC`):

| Dependent variable | Model | Hypothesis |
| --- | --- | --- |
| Payment error rate per case (pp) | OLS (HC1) | Civica **lowers** it |
| Time to eligibility decision (days) | OLS (HC1) | Civica **lowers** it |
| Intake → handoff completion (0/1) | Logistic | Civica **raises** it |
| Recertification success (0/1) | Logistic | Civica **raises** it |
| Apps per navigator-month (count) | Poisson | Civica adoption **raises** it |

- **Treatment:** `civica_assisted` (enrolled via Civica's bridge vs. comparison).
- **Controls, held constant in every case-level model:** household size,
  earned-income share, primary language, county, intake channel, expedited
  flag. (These are also the confounders — Civica serves harder cases, so the
  *raw* gap understates the effect and the regression has real work to do.)
- **Reported per outcome:** treatment coefficient, robust standard error,
  test statistic, p-value, 95% CI, n, and R² / McFadden pseudo-R².

Until the FOIA'd CDSS case-level QC data lands, the harness runs the exact
same plan on a **synthetic** population with *planted* effects (e.g. −3.0 pp
on payment error). The artifact is watermarked synthetic and carries each
planted value next to its estimate, so a reviewer can confirm the estimator
recovers what was planted — the 95% CI covers the truth on all five outcomes.

Live panel: [/findings/regression](/findings/regression).

## Why it matters

- **It defangs the obvious critique.** "You just kept slicing until you found
  a significant effect" is the first thing a skeptical funder, county, or
  CDSS reviewer says. A timestamped, append-only pre-registration — committed
  in the same repo, reviewed in a PR, before the data — is the answer.
- **The machinery is the deliverable, not the synthetic numbers.** When FOIA
  data arrives it is one command (`--data foia.csv`) to overwrite the
  artifact; `source_kind` flips to `foia`, the watermark drops, and the panel
  shows real estimates with zero code change. We are de-risking the analysis
  now so the result is fast and credible later.
- **It is the causal-evidence complement to the scorer.** The internal
  attribution model (see Related) answers *where* errors emerge; this answers
  *whether Civica moves the outcome*, with a confidence interval.

## What changes

- `/findings/regression` is live with the synthetic coefficient table + the
  pre-registered plan + the harness self-test.
- The weak `EFFECT_ISOLATION` placeholder on `/compliance` (hand-typed
  "scenario range" + a `significance` string the card never rendered) is now
  superseded by a real fitted model — fold or retire it in a follow-up.
- **When FOIA lands:** run the harness with `--data`, commit the new artifact
  + provenance sidecar, and supersede this finding with the live-data result.

## Open questions

- **Comparison group.** Synthetic uses a clean `civica_assisted` indicator.
  Real CDSS QC data has no Civica flag — we will need a defensible comparison
  (matched county/cohort, or pre/post Civica adoption). This is the single
  biggest threat to the causal read and must be settled before claiming a
  treatment effect on real data.
- **Clustering.** Effects may cluster by navigator/county; the synthetic fit
  uses HC1 (OLS) / MLE (Logit, Poisson) SEs. Real data may warrant
  cluster-robust SEs — a spec amendment to document, not a quiet change.
- **Multiple comparisons.** Five DVs invite a family-wise correction
  (Holm/BH). Pre-registering five hypotheses (not fishing across dozens)
  keeps this tractable, but the correction should be declared before reading
  real p-values.

Related: [[2026-05-28-error-attribution-framework]] — the internal scorer
that attributes *where* errors emerge; this finding is the external causal
test of *whether Civica reduces them*. [[2026-05-28-evidence-ledger-architecture]]
— same evidence-grounded pattern (lock the method, cite the source) applied
to analysis rather than errors.
