---
id: 2026-05-28-error-attribution-framework
date: 2026-05-28
scope: [snap-qc-engine, architecture, snap-rules]
confidence: medium
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: pr
    ref: "https://github.com/matthewgg22/Civica/pull/199"
    note: "PR #199 shipped `scoreErrorRisk()` v0.2.0. Since bumped to v0.3.0 via the /qc redesign (weighted element-attribution model). Still emits one tier/score per packet: no per-slice attribution, no calibration to ground truth."
  - kind: file
    ref: packages/snap-qc-engine/src/scoring/error-risk.ts
    note: "Actual scorer (v0.3.0). A weighted element-attribution model — `ERROR_WEIGHT` (USDA CA FY2023) × `DEFENSIBILITY_ERROR_PROB`, renormalized. NOT per-cohort constants. To be extended with per-slice Bayesian weights read from the rollup."
  - kind: memory
    ref: project_error_rate_engine
    note: "PR #199 status. Open items: staging migration apply, RLS verify, iOS badge UI, CDSS FOIA."
  - kind: external
    ref: "https://policyengine.org/us"
    note: "Federal SNAP + CA CDSS params; AGPL-3.0; usable as offline-generated ground-truth fixtures (cannot link into runtime)."
  - kind: dataset
    ref: "data-ops/sample/ca-snap-gap/"
    note: "281-row PUMA CSV, CV AUC 0.80, ~4.66M eligible non-enrollees. Provides the intake-stage prior."
---

## What we found

`scoreErrorRisk()` (v0.3.0, a weighted element-attribution model) collapses to **one tier/score per packet** — useful as a leaderboard sort key, but **structurally unable** to answer "where do errors emerge?", "which rule is overfiring in Fresno?", or "is the spike at intake or at verification?" Those are exactly the questions the caseworker-mode pitch and the Unrath retention pillar both need to answer.

Proposed architecture is a 3-layer composition (none of these layers individually is the answer):

1. **Event-sourced error ledger** — immutable `error_events` keyed by `(packet_id, stage, rule_id, county, cohort, occurred_at, source)`. Generalizes `packet_qc_samples`. All error-emitting surfaces (snap-rules failures, OCR mismatches, retention churn, county kickbacks, denial-reversals) write here with identical provenance.
2. **Dimensional rollup w/ Bayesian weight per slice** — Beta-Binomial conjugate updates per `(rule_id × county)`, `(cohort × stage)`, `(form_field × language)`. Posterior mean = the weight; posterior variance = how much to trust it. Shrink small-N slices toward the parent (county → state → national).
3. **Causal DAG over slices** — declarative graph `field_of_origin → rule_that_caught_it → stage_where_it_surfaced → outcome`. Lets us distinguish where errors *emerge* from where they get *detected* — load-bearing for both caseworker mode and the retention pillar.

PolicyEngine US (offline fixtures only — AGPL-3.0 prevents runtime linking) is the eligibility-node oracle. CA SNAP-Gap is the intake-node prior.

## Why it matters

- **Extends the scorer without breaking it.** `scoreErrorRisk()` keeps its signature; internals swap the static `ERROR_WEIGHT` element constants for a Beta-Binomial read against the rollup table. iOS badge UI doesn't need to change.
- **One schema covers all three pillars.** County / intake-QC (primary pitch), retention / Type-1 reduction (Unrath), and the demo / heatmap track all write to and read from the same `error_events` table. No parallel pipelines.
- **Auditable.** Every weight traces back to the events that produced it; every event traces back to a source + occurred_at. That trail is what makes the B2G pitch defensible under the USDA Advanced Automation guidance.

## What changes

Sequenced — **not yet implemented**, this finding is the proposal:

1. Migration: `error_events` table superseding `packet_qc_samples` (keep `packet_qc_samples` as a view for back-compat).
2. Wire snap-rules failures, OCR-mismatch events, retention-scorer outputs, and county-kickback events to write into `error_events`.
3. Materialized view for `(rule_id × county)` rollup with Beta-Binomial posterior columns.
4. Replace `scoreErrorRisk()` static `ERROR_WEIGHT` constants with a rollup read; bump v0.3.0 → v0.4.0.
5. Stub causal DAG as a YAML in `packages/snap-qc-engine/dag.yaml`; render in Datasette later.

Not chosen alternatives + why:
- **Feature store (Feast / Tecton)** — solves serving/offline parity, not attribution. Doesn't tell us *where* errors emerge.
- **LightGBM on everything** (à la the Erdős SNAP-Gap classifier) — gives one number with no slice attribution. Fine for a heatmap; fatal for a county pitch.
- **dbt + OpenLineage** — gives lineage but no calibrated weights. Could layer on top later, not the foundation.

## Open questions

- **Update cadence.** Online conjugate update on every event vs. nightly batch? Probably nightly to start; online is a later-version question (post-v0.4).
- **Hierarchical priors.** Empirical-Bayes shrinkage to parent slice is standard, but pinning the prior strength `(α₀, β₀)` is a judgment call. Start with weak priors `(1, 1)` and tune from real volume.
- **Causal DAG schema.** Use an existing format (DOT, mermaid, networkx JSON) or coin our own YAML? Coining is faster; existing format pays off once we want to render the graph in Datasette + Quarto.

**Reviewed design:** `docs/plans/error-attribution-ledger.md` — locked via `/plan-eng-review` 2026-05-28 (seven design decisions; corrects this finding's scope). Build tracked as TODO-41.

Related: [[2026-05-28-evidence-ledger-architecture]] — same evidence-grounded pattern applied to analysis rather than errors. [[2026-05-28-test-prefix-empty]] — illustrates why we need an audit trail at all.
