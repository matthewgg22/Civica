# Error-attribution ledger — reviewed design

**Status:** PLANNED — not implemented. Locked via `/plan-eng-review` 2026-05-28, then **amended after an independent second-opinion pass** (see "Post-review amendments" at the foot of this doc). A5 was **resolved 2026-05-28**: the operator confirmed the reviewer's recommendation — **nightly batch recompute (`REFRESH MATERIALIZED VIEW CONCURRENTLY`)**, overriding the original Decision 7 online-trigger choice. One hard prerequisite still gates any build: the missing per-slice denominator (A1). A simpler Wilson/Jeffreys-interval alternative may be the right first step — read the amendments before starting.
**Source finding:** `docs/findings/2026-05-28-error-attribution-framework.md` (facts corrected in the same session).
**Scope:** `snap-qc-engine`, `apps/enrollment-api`, Supabase migrations. iOS unchanged (badge consumes the same signature).

This plan turns the 3-layer error-attribution proposal into a buildable, reviewed
architecture. The review corrected several stale claims in the finding and made
seven design decisions, recorded below.

---

## What already exists (do not rebuild)

The finding under-described the current state. Grounding against
`origin/codex/rebuild-feb18`:

- **`packages/snap-qc-engine/src/scoring/error-risk.ts` (v0.3.0)** — the real scorer.
  NOT the "v0.2.0 scalar with per-cohort constants" the finding claimed. It is a
  weighted element-attribution model: `ERROR_WEIGHT` (USDA CA FY2023 element shares)
  × `DEFENSIBILITY_ERROR_PROB`, renormalized, returning one tier/score per packet.
  Pure function over `ScoringInput[]`, no DB handle.
- **`snap_enrollment.packet_qc_samples`** (migration `20260590`) — the QC **sampling
  frame**: which packets were selected for inspection, with lifecycle
  (`sampled_at`/`submitted_at`/`completed_at`/`closed_reason`), composite queue
  indexes, RLS (navigator reads own-org), and the applicant-restart closure trigger.
- **`qc_outcomes` + `/qc-outcome` endpoint** — ground-truth capture.
- **`v_qc_pillar_coverage` view** (T9) + the shipped **`/qc` dashboard redesign**
  (`docs/plans/qc-error-rate-intelligence-redesign.md`, v0.3.0).
- **`docs/plans/error-rate-engine-falsification.md`** — Lane B sampler infra this builds on.

The proposal is genuinely-new architecture, but it sits **on top of** this, not in
place of a primitive scalar.

---

## The seven decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | error_events vs packet_qc_samples | **Keep both.** `packet_qc_samples` stays first-class (denominator / sampling frame, with its RLS + closure trigger). `error_events` is a SEPARATE append-only error log (numerator). The rollup JOINs them. The finding's "supersede + view" is rejected — a clean sampled packet emits zero events, so the frame is not reconstructable from events, and Beta-Binomial has no denominator without it. |
| 2 | Heterogeneous event meaning | **Explicit `event_class` axis.** `predicted` / `prevented` (pre-submission catch) / `confirmed` (post-submission QC or county kickback) / `reversed` (wrongful denial overturned). Beta-Binomial numerator counts `confirmed` only. `prevented` feeds an "errors avoided" metric; `reversed` feeds the Unrath Type-1 signal. Without this, the weight measures detector loudness, not escaped-error rate. |
| 3 | "Causal DAG" | **Descriptive flow-DAG, named honestly.** Rename: it is a provenance/flow ontology (`field_of_origin → rule_that_caught → stage_surfaced → outcome`), hand-authored from domain knowledge. No do-calculus, no learned structure — do not call it "causal" in the pitch. Cheap, no data dependency. |
| 4 | Where the rollup read happens | **Caller fetches, passes weights in.** Gateway reads the rollup; `scoreErrorRisk(results, { sliceWeights? })` takes weights as an optional data arg and falls back to static `ERROR_WEIGHT` when absent. Engine stays pure and fixture-testable; no Supabase dependency leaks into the math package. |
| 5 | v0.3.0 → v0.4.0 cutover | **Shadow period behind a flag.** Compute heuristic (shown) and calibrated (logged) in parallel; record divergence. Flip per-slice only when posterior variance is low (enough N) AND the calibrated score tracks ground truth. Low-N slices stay on the static weight (the Decision-4 fallback IS the safety net). No silent semantic change to on-screen numbers. |
| 6 | Testing the math pre-volume | **Property tests + PolicyEngine oracle + immutability.** Synthetic events with known true rates assert posterior properties (mean ∈ [prior, empirical]; variance ↓ as N ↑; small-N shrinks to parent; `(α₀,β₀)=(1,1)` → empirical at high N). PolicyEngine US offline fixtures as the eligibility oracle (AGPL: fixtures only, no runtime link). UPDATE/DELETE-rejected test. Shadow-divergence snapshot. |
| 7 | Rollup refresh cadence | **~~Incremental / online~~ → SUPERSEDED by A5 (2026-05-28): nightly batch recompute.** Originally the operator chose an online trigger; the second-opinion pass showed it can't fold `reversed` corrections (A4) or keep EB shrinkage consistent (A3) without recompute. Operator confirmed **nightly `REFRESH MATERIALIZED VIEW CONCURRENTLY`** — correct folding + shrinkage for free, trivially cheap at pilot volume. See the resolved Decision 7 section and A5 below. |

### Decision 7 — resolved to nightly batch recompute (2026-05-28)

The operator initially chose online/incremental, then **confirmed the reviewer's
nightly recommendation** once A4 (reversed-event folding) and A5 (shrinkage coherence)
showed the online trigger to be the *less correct* option, not merely the more complex
one. Final decision: **`error_rollup` is a materialized view**, recomputed by a nightly
`REFRESH MATERIALIZED VIEW CONCURRENTLY` job.

- **Why nightly wins here.** A full recompute is a *fold* over the whole event stream,
  so `reversed` corrections net out by construction (signed deltas, no counter mutation —
  resolves A4) and EB shrinkage sees one consistent parent/child snapshot per pass
  (resolves A3's consistency concern). At pilot volume the refresh is trivially cheap.
- **No pg_ivm, no triggers.** Supabase managed Postgres lacks pg_ivm; the nightly matview
  needs neither it nor an `AFTER INSERT` counter trigger. Schedule via pg_cron (or the
  existing job runner).
- **Staleness is acceptable.** The rollup drives a QC leaderboard humans read daily; up to
  24h lag is irrelevant. Revisit online cadence only post-v0.4 if a real-time need appears.
- Nightly recompute does **not** relax the shadow period (Decision 5) — a calibrated weight
  that drives on-screen numbers stays flag-gated until validated against ground truth.

---

## Reviewed architecture

```
                    ┌─────────────────────────────────────────┐
  emitters ──────►  │ error_events (append-only, immutable)    │
  (snap-rules,      │  packet_id, stage, rule_id, county,      │   numerator
   OCR, retention,  │  cohort, occurred_at, source,            │
   kickbacks,       │  event_class ∈ {predicted, prevented,    │
   reversals)       │    confirmed, reversed}                  │
                    └───────────────┬─────────────────────────┘
                                    │ nightly REFRESH MATERIALIZED VIEW
  ┌──────────────────────────┐     ▼
  │ packet_qc_samples (KEEP)  │   ┌──────────────────────────────┐
  │  sampling frame =         │──►│ error_rollup (nightly matview)│
  │  DENOMINATOR              │   │  per slice: (α, β) conjugate  │
  └──────────────────────────┘   │  posterior mean = weight      │
                                  │  posterior var  = trust       │
                                  │  EB shrink small-N → parent   │
                                  └───────────────┬───────────────┘
                                                  │ gateway reads
                                                  ▼
                                  scoreErrorRisk(results,
                                    { sliceWeights })   // pure
                                                  │
        error-flow.yaml (hand-authored ──────────┘ (narrative only)
        provenance ontology, NOT causal)
```

---

## Build order (sequenced)

1. **Migration `error_events`** — append-only table with the key tuple + `event_class`
   enum. Immutability: revoke UPDATE/DELETE from all app roles; corrections are
   compensating appends (`reversed`), never mutations. RLS mirrors `packet_qc_samples`
   (navigator reads own-org; service_role writes). Co-located `.test.ts`.
2. **Emitter wiring** — snap-rules failures (`predicted`/`prevented`), OCR mismatches,
   retention-scorer churn (`reversed`/Type-1), county kickbacks (`confirmed`) all
   append with identical provenance + correct `event_class`. One thin append helper;
   each emitter call-site sets `event_class`.
3. **`error_rollup` materialized view + nightly refresh** (Decision 7, resolved via A5) —
   `REFRESH MATERIALIZED VIEW CONCURRENTLY` recomputes the fold over `error_events`
   (signed deltas per `event_class`, so `reversed` nets out), JOINed against
   `packet_qc_samples` for the denominator. Empirical-Bayes shrinkage on the **single
   canonical hierarchy** only (county → state → national, packet-level — per A3); cross-cut
   slices stay descriptive (raw rate + interval). Start priors `(α₀,β₀)=(1,1)`. Schedule via
   pg_cron. **Gated on A1** — the per-slice denominator must exist first.
4. **Scorer v0.4.0** — add optional `sliceWeights` param to `scoreErrorRisk`; falls back
   to static `ERROR_WEIGHT`. Gateway fetches the rollup slice and passes it. Shadow:
   compute + log both; on-screen stays heuristic behind the flag.
5. **`packages/snap-qc-engine/error-flow.yaml`** — hand-authored provenance ontology.
   Render in Datasette later. Narrative artifact for caseworker mode + Unrath.

---

## Test plan

- **Math (property-based, no production data):** posterior mean ∈ [prior, empirical];
  variance monotonically ↓ as N ↑; small-N slice shrinks toward parent; `(1,1)` prior
  converges to empirical at high N.
- **Ground truth:** PolicyEngine US offline fixtures as eligibility oracle (fixtures
  only — AGPL prevents runtime linking).
- **Immutability:** UPDATE and DELETE on `error_events` are rejected; a correction is
  an appended `reversed` row; readers fold the stream rather than mutate.
- **Denominator JOIN:** a clean sampled packet (zero events) still appears in the
  frame and contributes to `β`, not `α`.
- **Refresh correctness:** a `reversed` event flips its prior `confirmed` contribution
  after the next nightly refresh (the fold nets signed deltas — no counter drift, no lost
  updates, since there are no incremental counters to race on).
- **Cutover:** shadow-divergence snapshot (heuristic vs calibrated) per slice.
- **Regression:** existing `packet_qc_samples` queries / RLS / `v_qc_pillar_coverage`
  unchanged (Decision 1 means no view supersession, so this surface is small).

---

## NOT in scope

- Real causal inference / do-calculus / structure learning (Decision 3 — descriptive
  ontology only).
- Online / streaming conjugate update — explicitly rejected (A5). The rollup is a
  nightly-refreshed materialized view; no pg_ivm, no per-insert counter trigger, no
  streaming framework.
- Feature store (Feast/Tecton), LightGBM-on-everything, dbt+OpenLineage — rejected in
  the finding; not revisited.
- iOS changes — the badge consumes the same `scoreErrorRisk` signature.
- Flipping the calibrated weight on for any slice in this phase — that is gated on
  shadow validation against real volume (post-build).

---

## Open questions remaining

- **Prior strength.** `(α₀,β₀)=(1,1)` weak prior to start; tune from real volume once
  events accumulate.
- **Shrinkage target hierarchy.** county → state → national assumed; confirm the
  parent chain for `(cohort × stage)` and `(form_field × language)` slices.
- **Validation threshold for flip.** "Variance low enough" + "tracks ground truth"
  need concrete numeric gates before any per-slice cutover.

---

---

## Post-review amendments (independent second opinion, 2026-05-28)

A cold red-team pass (fresh reviewer, no context) found four material defects and
one strong correctness challenge. These **amend the decisions above** — the original
records are kept for lineage; the amendments win where they conflict.

### A1 — The per-slice denominator does not exist in `packet_qc_samples` yet (blocks build step 3)

`packet_qc_samples` (`20260590`) has only `sample_id, packet_id, applicant_id, org_id,
sample_stage, *_at, closed_reason`. There is **no `rule_id`, `county`, `cohort`,
`form_field`, or `language`** — and `org_id ≠ county`, one packet spans many rules. So
the headline slices `(rule_id × county)`, `(cohort × stage)`, `(form_field × language)`
**cannot be JOINed** from the frame as built. Decision 1's "clean packet → β" only
yields a *packet-level* rate, not a per-rule one.
**Fix (added to build step 0, before anything else):** denormalize `county`/`cohort`/
`language` onto the frame (or onto `qc_outcomes`), AND — for any per-*rule* rate — log
evaluated-but-clean rules so each rule has a trial count, not just each packet. Without
this, Layer 2 has no denominator. This is now a hard prerequisite, not an open question.

### A2 — Numerator/denominator population mismatch (amends Decision 2)

The numerator counts `confirmed` events from **all** packets/emitters; the denominator
counts **sampled** packets only (`qc_sampled = true`; unsampled ≠ clean). `α/(α+β)`
then estimates no real rate — different populations top and bottom.
**Fix:** restrict the Beta-Binomial numerator to events on packets **present in the
sampling frame**. Keep a separate, clearly-labelled "detector-volume" count for the
all-packets stream; never mix the two into one weight.

### A3 — EB shrinkage is invalid across overlapping slices (amends build step 3)

A single packet is simultaneously in `(rule×county)`, `(cohort×stage)`, and
`(field×language)`. Empirical-Bayes shrinkage toward a parent assumes a partition;
overlapping slices double-count shared packets in parent and child and **understate
posterior variance** — which is exactly the "trust" quantity the Decision-5 flip gate
relies on.
**Fix:** pick **one** canonical nested hierarchy for the calibrated rate
(county → state → national, packet-level) and apply shrinkage only there. Treat the
cross-cut slices as **descriptive** (raw rate + interval), not as independent
Beta-Binomials with shared shrinkage. This also resolves open-question Q2 — the parent
chain is not a tuning detail; it is coherence-determining.

### A4 — `reversed` events contradict "immutable counters" (amends Decision 7 + build step 1)

You cannot have both (a) immutable append-only counters that do exact `α += 1`/`β += 1`,
and (b) self-correcting counts where a `reversed` event undoes a prior `confirmed`. A
`reversed` event would have to *decrement* α — a mutation driven by an append.
**Fix:** make the rollup a **recomputable fold** over the event stream (signed deltas
per `event_class`), not a set of immutable increment-only counters. Folding is exactly
what a nightly `REFRESH MATERIALIZED VIEW` gives for free — see A5.

### A5 — ✅ Decision 7 correctness challenge (RESOLVED 2026-05-28 — operator chose nightly matview)

The reviewer argued the **online/incremental trigger (original Decision 7) is not just more
complex but less correct** here: (1) it can't fold `reversed` corrections without
counter mutation (A4); (2) per-row triggers can't keep EB shrinkage consistent because
a child's shrunk posterior depends on the parent's *current* posterior, which moves with
every sibling insert; (3) at pilot volume nightly `REFRESH MATERIALIZED VIEW
CONCURRENTLY` is trivially cheap and gives correct folding + shrinkage for free.
**Resolution (2026-05-28):** the operator **confirmed the reviewer's recommendation** and
overrode the original Decision 7. `error_rollup` is now a **nightly-refreshed materialized
view** (see "Decision 7 — resolved to nightly batch recompute" above). This also closes A4
(the fold nets `reversed` signed deltas for free) and A3's consistency concern (one coherent
snapshot per refresh). Build step 3 is unblocked; **A1 (per-slice denominator) is now the
sole hard prerequisite** before any build starts.

### Considered simpler alternative (recorded, not chosen)

Reuse `qc_outcomes` (`error_found`, `error_type`, `error_amount`, `org_id`) + the frame;
add `county`/`cohort` columns; ship **one view**: `COUNT(error_found)/COUNT(*) GROUP BY
slice` with a **Wilson or Jeffreys interval** per slice for the trust band. One migration
+ one view: defensible per-slice rates with honest CIs, correct sampled-only population
(no A2), no trigger (no A4/A5), no overlapping-slice shrinkage (no A3), no v0.4.0 cutover
machinery. The full Beta-Binomial ledger is justified **only once** a single well-defined
nested hierarchy and a real per-rule trial population exist — neither does today. **If the
near-term need is just "per-slice error rates for a county pitch," build this first** and
treat the ledger as the v2 upgrade.

### Sound as-is

Decision 4 (caller passes `sliceWeights`, engine stays pure over `ScoringInput[]`)
matches the current `error-risk.ts` shape and is correct — keep it.

---

Related: `docs/findings/2026-05-28-error-attribution-framework.md` (source),
`docs/plans/error-rate-engine-falsification.md` (Lane B sampler),
`docs/plans/qc-error-rate-intelligence-redesign.md` (shipped /qc consumer),
`docs/findings/2026-05-28-retention-pillar-unrath.md` (the `reversed`/Type-1 consumer).
