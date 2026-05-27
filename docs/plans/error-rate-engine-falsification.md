# Error Rate Engine — Falsification Phase

**Branch:** `feat/dashboard-caseworker-readiness`
**Draft date:** 2026-05-27
**Status:** DRAFT — awaiting /plan-ceo-review
**Predecessors:** [`qc-error-rate-intelligence-redesign.md`](./qc-error-rate-intelligence-redesign.md) (engine + /qc page), [`civica-error-reduction-thesis.md`](./civica-error-reduction-thesis.md) (methodology)

---

## 1. Problem

`snap-qc-engine` v0.3.0 projects **5.50% PER at full engagement** vs CA's 10.98% FY2024 baseline. The math is documented, FNS-380 citations are row-by-row, the dashboard surfaces the formula honestly. But the engine has **zero measured outcomes**. `BaselinePanel` sits empty (gated at n≥30 `qc_outcomes`). Today the engine is *plausible*, not *falsifiable*.

Plausible thesis ≠ defensible product. Counties and CDSS will not accept "trust our math"; they accept "here is the historical case-mix we can explain, and here is the live sample we are measuring." Without that evidence, the engine is marketing — a good projection with no error bars, no validation, no falsification surface.

## 2. Goal

Move the engine from projection-mode to measurement-mode by establishing **two independent evidence streams**:

1. **Retrospective back-test** — Ingest CDSS published QC data (FY2023, FY2024) → run the engine against a synthetic "no-Civica" baseline cohort → validate it reproduces the 10.98% statewide PER within ±0.5pt. If it can't reproduce the past, the projection is broken.
2. **Prospective measurement** — Wire QC sampling cadence into navigator workflow so every Nth packet gets QC-reviewed by Civica staff; outcomes flow into `qc_outcomes`; BaselinePanel populates at n≥30. This is the falsification engine: when the live measured PER diverges from engagement-implied PER, we know the formula is wrong (or engagement isn't enough).

Either stream alone is insufficient. Back-test validates the *shape* of the formula. Live sampling validates the *predictive power* against actual cases Civica touched.

## 3. Non-goals

- Do **not** wait for first enrolled student. Back-test runs against CDSS public data immediately.
- Do **not** finalize OBBBA contract (Track 1.3 / Q5 / counsel-pending). That's a separate track, blocked on counsel, unblockable by us.
- Do **not** rebuild the engine. v0.3.0 is the SUT (system under test) — falsification means testing it, not changing it.
- Do **not** ship "measured 5.5%" claims until n≥30 + back-test passes. Until then, BaselinePanel says "sampling — X/30 outcomes."

## 4. Approach — two streams in parallel

### Stream A — Retrospective back-test

**Inputs:**
- CDSS published QC error breakdowns (FY2023, FY2024) at state aggregate. County-level if FOIA returns granular data; otherwise state-only.
- USDA national breakdown by error category from FNS-380 (already in `packages/snap-qc-engine/src/citations/cfr-273.ts`).

**Method:**
- Construct a synthetic cohort whose engagement vector represents **no-Civica baseline** (shelter 0%, income 0%, calc 0%, OBBBA 0%).
- Run `computeEngagementImpliedPER(cohort)` → assert result is within ±0.5pt of CA FY2024 baseline (10.98%).
- Construct a second synthetic cohort at **full Civica engagement** (shelter 100%, income 100%, calc 100% at strong tier; assets 0%; shared-lease at moderate per classifier cap).
- Run `computeEngagementImpliedPER(cohort)` → assert result is 5.50% ± 0.1pt.
- Construct partial-engagement cohorts (e.g. income only, shelter+income only) and validate `pillarContribution` is additive within bounds.

**Output:** A Vitest suite (`packages/snap-qc-engine/test/backtest/`) + a one-page "engine validation report" written to `docs/plans/error-rate-engine-validation-report.md`. The report is the artifact we hand to counties.

### Stream B — Prospective measurement

**Sampling design:**
- **Cadence:** Every 10th submitted packet flagged for QC review. Stratified later when n grows; for now uniform sampling beats stratification with small n.
- **Reviewer:** Civica navigator (initial phase). Later: outside reviewer for blinding.
- **Form:** 5-7 questions matching CDSS QC categories — income verification correct? shelter calc correct? household composition correct? deduction stack correct? net allotment within $25 tolerance? Submit via existing `POST /navigator/packets/:id/qc-outcome` (already shipped).

**Surface:**
- Dashboard task queue: navigator sees "X packets pending QC review" with a CTA to the review form.
- iOS notification (low priority) when a navigator has pending QC reviews.

**Data integrity:**
- Label-contamination guard already shipped (`qc_sampled=false + error_found≠null → 400`).
- Add: sampling-bias guard — packets flagged for QC review must be **flagged before submission**, not after. Otherwise we'd selectively QC packets that look risky, biasing the measured PER upward.

**Populate the dumbbell:**
- BaselinePanel reads `v_qc_pillar_coverage` (already shipped) — extend it to expose `n_outcomes` + `measured_per_per_pillar` once n≥30.
- Empty state: "Sampling — 14 of 30 outcomes collected. Falsification test fires at 30."

### Stream C — Shadow-mode logging (supports both A and B)

- Every enrollment event logs `{engagement_vector, projected_per_at_engagement, scoreErrorRisk per packet, engine_version}` to `civica-emit/qc-evaluations/` Supabase Storage.
- Backfill: once Stream B has n≥30, replay shadow-mode logs alongside qc_outcomes to compute the residual gap between projected and measured PER per pillar.
- This is the analytical layer that turns the dumbbell from a single number into a per-pillar residual map.

---

## 5. Deliverables (T1-T9)

| # | Task | Stream | Effort (human / CC) | P |
|---|---|---|---|---|
| T1 | File CDSS FOIA — CA county-level QC error breakdowns CY2023 + CY2024 by category (parallel track per D7; not gating) | A | 2h / n-a (Matthew) | P2 |
| T2 | Back-test harness — synthetic cohorts + assertion suite in `packages/snap-qc-engine/test/backtest/` (baseline-cohort + per-pillar) | A | 1d / ~2h | P1 |
| T3 | Engine validation report — one-page artifact under `docs/plans/error-rate-engine-validation-report.md` | A | 4h / ~30min | P1 |
| T4 | QC sampling — migration `20260584_packet_qc_samples.sql` (single table per ENG-D1, partial constraint, 3 indexes per ENG-D7) + `internal-qc-sampler.ts` cron (modular hash per ENG-D2) | B | 1d / ~3h | P1 |
| T4b | Applicant-restart closure trigger (per D6) — DB trigger on `snap_packets` insert that marks prior open sample rows as `closed_applicant_restart` | B | 3h / ~30min | P1 |
| T5 | Dashboard task queue panel — `/dashboard/qc-review` listing pending QC samples for the navigator | B | 1d / ~2h | P2 |
| T6 | iOS push notification — low-priority "you have N QC reviews pending" via existing APNs path | B | 4h / ~1h | P3 |
| T7 | (absorbed into T4 via ENG-D1 partial constraint — no separate task) | B | — | — |
| T8 | BaselinePanel live integration — wire `v_qc_pillar_coverage.n_outcomes` + "X/30" empty state + residual delta render | B | 4h / ~1h | P2 |
| T9 | Shadow-mode export — `packages/snap-qc-engine/src/shadow-emit/emit.ts` + `ctx.waitUntil` wiring on milestone events (per ENG-D3 + D5) + backfill harness | C | 1d / ~3h | P2 |
| T10 | Test trio per ENG-D6 — `internal-qc-sampler.test.ts` (determinism + idempotency + no-op) | B | 2h / ~20min | P1 |
| T11 | RLS regression matrix per ENG-D5 — `test/rls/packet_qc_samples.test.ts` (4-way matrix) | B | 1h / ~10min | P1 |
| T12 | Validation-gate E2E per ENG-D4 — `apps/dashboard/__tests__/qc-validation-gate.e2e.ts` (Playwright; seed 30 packets + outcomes; assert measured PER + residual render) | B | 3h / ~30min | P1 |

**P1 = ship before any "measured" claim externally.** P2 = ship before first paying county sale. P3 = nice-to-have for navigator UX.

---

## 6. Tests

- **Engine back-test (T2)** — synthetic-cohort assertions: baseline 10.98% ±0.5, full engagement 5.50% ±0.1, partial engagement additivity. ~8 tests.
- **Sampler determinism (T4)** — same input packet set → same sample selection (seeded RNG or modular index).
- **Sampling-bias guard (T7)** — three migration-shape tests: blocked post-submission flag, blocked qc_outcome insert without sample row, blocked retroactive `qc_sampled` flip.
- **Task queue scoping (T5)** — navigator A cannot see navigator B's queue (RLS sanity).
- **iOS notification (T6)** — UNUserNotification mock fires only when `pending_count > 0` and not on every refresh.
- **Dumbbell populated state (T8)** — new fixture w/ n=30 outcomes; assert measured PER renders, residual delta vs projected renders.
- **Shadow-mode schema (T9)** — golden-file test on emitted JSON shape; assert engine_version, engagement_vector, projected_per all present.

Cross-cutting:
- Hostile-QA test: a navigator marks every sampled packet as "no error found" — does the dumbbell warn about implausible 0% PER? Yes, alert if measured PER < 1% with n≥30.
- Chaos test: FOIA returns null (no county data, state-only) → back-test still passes against state aggregate; validation report degrades gracefully.

## 7. Observability

- **Metric:** `qc_sample_coverage = sampled_packets / submitted_packets` — should hover near 0.10.
- **Metric:** `qc_outcome_completion = completed_reviews / sampled_packets` — alert if <0.5 after 7d.
- **Metric:** `engine_residual = measured_per - engagement_implied_per` — surface in /qc once n≥30.
- **Log:** every shadow-mode write, every QC outcome submission, every sampler tick.
- **Dashboard panel:** "Falsification status — N/30 outcomes — engine residual: ±X.Xpt." Hides until n≥10 (avoid noise at small n).
- **Runbook:** "What to do when engine_residual exceeds ±1pt for 14 days" — investigate per-pillar contribution drift, re-run back-test, document deviation in validation report.

## 8. Security & RLS

- `packet_qc_samples` table — RLS: navigator can read samples for org's packets only; only service role can write (via cron); navigator can flip `completed=true` via existing `/qc-outcome` route which already has `is_navigator_in_org` gate.
- Sampling-bias guard (T7) — DB check constraint (cheap, enforced everywhere).
- Shadow-mode export — Storage bucket private; signed URLs only for CDSS/county on request; PII redacted (`applicant_id` only, no name/SSN).
- FOIA data ingestion — public data, no PII; commit to repo as CSV under `packages/snap-qc-engine/data/cdss-qc/`.

## 9. Deployment

1. Apply migration `20260584_packet_qc_samples.sql` (T4 schema + T7 constraint) to staging.
2. Deploy enrollment-api with `/internal/qc-sample-selector` cron (T4) — 1/hour.
3. Smoke test: submit 10 packets → exactly 1 flagged for QC.
4. Backfill block test: try to insert qc_outcomes without a sample row → 400.
5. Deploy dashboard with `/dashboard/qc-review` panel (T5) gated behind `qcReviewQueue` flag.
6. Once 5 navigators have completed a QC review with no support tickets, flip flag on for all navigators.
7. Ship shadow-mode export (T9) behind `shadowModeQc` flag; verify writes for 48h; flip on globally.
8. Ship BaselinePanel populated state (T8) gated on `qc_outcomes.count >= 30`.

Rollback: each stream has a feature flag; revert by flipping flag, no data migration rollback needed (qc_samples table is append-only).

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| FOIA returns 90-day delay or no county-granularity | High | Medium | Back-test against state aggregate is sufficient for v1; county-level is nice-to-have |
| Back-test reveals engine doesn't reproduce baseline | Medium | High | This is the *point*. If it fails, the engine projection is wrong and we need to recalibrate `THESIS_CALIBRATION_FACTOR`. Better to know now. |
| Sampling-bias creep — navigators QC the easy packets first | Medium | High | T7 constraint enforces pre-submission flag; ordered queue by `sampled_at` not `risk_score` |
| Navigator QC fatigue — completion rate drops below 50% | Medium | Medium | iOS notification + dashboard prompt; consider per-review honorarium at pilot scale |
| n stays below 30 for months at pilot scale | High | Medium | Acceptable. BaselinePanel "X/30" framing is honest; CDSS back-test is independent evidence |
| Measured PER ≪ projected (e.g. 3%) → engine is too conservative | Low | Medium | Document, recalibrate, ship new engine version. Honest residual surface is the feature. |
| Measured PER ≫ projected (e.g. 9%) → engine is wrong | Low | High | Engine pause; investigate which pillar's contribution is over-stated; do not ship "halves baseline" claim until residual narrows |

## 11. NOT in scope

- OBBBA Track 1.3 / Q5 / counsel finalization — separate track, blocked externally.
- TODO-4 historical-baseline mapping for sales — depends on back-test results; sales plan is *output* of falsification, not input.
- TODO-6 county-resolver + agency-lookup — submission routing, not measurement.
- Recalibration of `THESIS_CALIBRATION_FACTOR` — only triggered if back-test fails; not pre-scoped.
- External "blinded reviewer" QC sampling — pilot uses internal navigators; outside review is Phase 3.

## 12. Resolved decisions (from /plan-ceo-review 2026-05-27)

**D3 — Validation stopping rule:** Engine is externally pitchable only when (a) back-test reproduces 10.98% baseline ±0.5pt + 5.50% full-engagement ±0.1pt AND (b) prospective n ≥ 30 qc_outcomes AND (c) `|measured_per - engagement_implied_per| ≤ 1.0pt`. All three required. Until then, BaselinePanel + external materials use "projected" framing only.

**D4 — Sampling timing: DUAL (creation + submission)** — superseded by ENG-D1 below to use a single table with a `sample_stage` enum. Funnel signal vs completed-case signal are still distinct queries, just collapsed into one schema.
- Single table `packet_qc_samples` with `sample_stage enum('creation','submission')`
- Validation gate (D3) reads `WHERE sample_stage='submission' AND completed_at IS NOT NULL`
- Funnel/abandonment view reads `WHERE sample_stage='creation'`
- Sample-bias guard (ENG-D1 partial constraint) applies only to submission-stage rows.

**D5 — Shadow-mode log volume:** Milestones only — packet creation, recert event, submission, significant contact event. ~3-5 writes per applicant lifecycle. Bucket: `civica-emit/qc-evaluations/{date}/{packet_id}-{milestone}.json`.

**D6 — Abandoned-sample cleanup:** Sample row closes when the same applicant creates a new packet (`closed_reason = "applicant_restart"`). Does not auto-close on TTL. Open-row count surfaced as an observability metric.

**D7 — FOIA fallback:** Back-test ships v1 against CA state-aggregate FY2024 PER (10.98%, public) + USDA FNS-380 national category breakdown (already in `cfr-273.ts`). T3 validation report does **not** block on FOIA. When FOIA returns, ship T3.1 with county-level granularity as a versioned upgrade.

## 13. Open questions deferred to TODOs

- **TODO-QC-DENSITY:** Is 1-in-10 cadence right at small n? Revisit when n=10 (early bias check) and n=30 (validation gate fired). Stratification math (by tier? by FNS-380 category?) deferred until n≥30 lands.
- **TODO-QC-REVIEWER-ROLE:** Separate "QC reviewer" role vs layered-on-navigator. Defer until 3+ navigators report fatigue or sampling-bias signal appears.

## 14. Scope deltas from CEO review

- D4 expanded T4/T5/T7/T8 from single-table to dual-table. Re-estimate T4 effort: 1d → 1.5d human; CC ~4h. T5: dashboard panel renders both queues. T8: BaselinePanel reads submission-stage table only (creation-stage feeds a separate funnel panel not in this phase).
- D6 adds a small cron + closure-trigger logic to T4. Bundled.
- D7 trims T1 from "P1 critical-path FOIA" to "P2 parallel-track upgrade." T1 priority demoted.

## 15. Resolved engineering decisions (from /plan-eng-review 2026-05-27)

**ENG-D1 — Schema shape: single table with `sample_stage` enum.** One `packet_qc_samples` table; supersedes D4's dual-table draft. Schema:

```sql
CREATE TABLE packet_qc_samples (
  sample_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id        uuid NOT NULL REFERENCES snap_packets(packet_id) ON DELETE CASCADE,
  applicant_id     uuid NOT NULL,
  org_id           uuid NOT NULL,
  sample_stage     text NOT NULL CHECK (sample_stage IN ('creation','submission')),
  sampled_at       timestamptz NOT NULL DEFAULT now(),
  submitted_at     timestamptz,  -- snapshot from snap_packets for bias-guard
  completed_at     timestamptz,
  closed_reason    text,  -- 'applicant_restart' | NULL
  CONSTRAINT submission_sample_pre_submit
    CHECK (sample_stage <> 'submission' OR sampled_at < submitted_at OR submitted_at IS NULL)
);
```

Partial constraint replaces the dual-table sample-bias guard (T7 absorbs into the schema). One RLS policy (`is_navigator_in_org(org_id)`) covers reads; service-role-only writes.

**ENG-D2 — Sampler logic: modular hash over packet_id.** `internal-qc-sampler.ts` selects via `sha256(packet_id) % 10 == 0`. Stateless — duplicate cron ticks never double-insert (idempotent INSERT … ON CONFLICT DO NOTHING). No counter row, no contention. Tests trivially deterministic.

**ENG-D3 — Shadow-mode write path: async via Workers `ctx.waitUntil`.** scoreErrorRisk returns immediately; `emitShadowLog()` writes to `civica-emit/qc-evaluations/` in background. Failures swallowed with Sentry breadcrumb. Zero latency cost on read paths. Milestone filter (D5) caps invocation frequency.

**ENG-D4 — Validation-gate E2E test:** Playwright test seeds 30 packets + 30 qc-outcomes via direct DB inserts (bypassing UI for speed), navigates `/qc`, asserts BaselinePanel renders measured PER + residual delta. Lives at `apps/dashboard/__tests__/qc-validation-gate.e2e.ts`. Effort: human ~3h / CC ~30min.

**ENG-D5 — RLS regression tests: full four-way matrix** on `packet_qc_samples`. Mirrors the qc_outcomes RLS verification pattern (migration 20260557001):
- navigator A reads org A sample → allow
- navigator A reads org B sample → deny
- applicant reads samples table → deny
- service role inserts → allow

Tests live in `apps/enrollment-api/test/rls/packet_qc_samples.test.ts`. ~1h human / ~10min CC.

**ENG-D6 — Sampler test trio:** determinism + idempotency + no-op. Three tests in `apps/enrollment-api/src/routes/internal-qc-sampler.test.ts`:
- determinism: same packet_id set → same selection across calls
- idempotency: duplicate cron tick → no double-inserts (ON CONFLICT exercises)
- no-op: empty submission window → zero writes

**ENG-D7 — Composite indexes upfront** in migration 20260584:
- `idx_packet_qc_samples_queue ON packet_qc_samples(org_id, sample_stage, completed_at)` — T5 dashboard queue query
- `idx_packet_qc_samples_applicant ON packet_qc_samples(applicant_id, closed_reason)` — D6 applicant-restart closure lookup
- Verify `qc_outcomes(packet_id, created_at)` exists (likely already from migration 20260555); add if missing.

## 16. Scope deltas from eng review

- ENG-D1 collapses T4 + T5 + T7 + T8 from dual-table to single-table. Net effort drop: ~4h human / ~30min CC.
- ENG-D4 adds 1 new test file (Playwright E2E) — effort additive but mandatory for D3 validation gate.
- ENG-D5 + ENG-D6 add 7 new test cases total (~3-4h human / ~30min CC).
- ENG-D7 adds 2-3 lines per index to migration 20260584 — negligible effort, large performance payoff.

## 17. Failure modes registry

| Codepath | Failure mode | Test? | Error handled? | User sees |
|---|---|---|---|---|
| `internal-qc-sampler.ts` cron | Cron tick duplicates → double-flag | YES (ENG-D6 idempotency) | INSERT ON CONFLICT DO NOTHING | nothing (silent dedup) |
| `internal-qc-sampler.ts` cron | All submissions hash to non-zero (no samples for hours) | YES (ENG-D6 no-op) | counter-by-design | observability metric alerts if `qc_sample_coverage < 0.05` over 24h |
| `me-packets.ts` shadow emit | Storage write fails | YES (T9 unit) | Sentry breadcrumb + swallow (ENG-D3 `waitUntil`) | nothing — read path unaffected |
| `qc-outcome.ts` | Outcome insert without matching sample row | YES (ENG-D6) | 400 reject | navigator sees error message |
| Validation gate | Back-test fails to reproduce baseline within ±0.5pt | YES (T2 back-test) | hard test failure | engine pause + recalibrate `THESIS_CALIBRATION_FACTOR` |
| BaselinePanel (T8) | n<30 renders measured PER by mistake | YES (T12 E2E) | n-check at view layer | "Sampling — X/30 outcomes" instead |
| BaselinePanel (T8) | n≥30 but `v_qc_pillar_coverage` returns null | NO ← **critical gap** | NOT HANDLED | Silent — panel renders empty even with n=50 |
| `packet_qc_samples` RLS | Cross-org read leak | YES (ENG-D5) | RLS policy denies | applicant data leaks (silent if RLS broken) |
| iOS push (T6) | APNs unavailable | YES (T6 mock) | silent fail | no notification (acceptable) |
| Applicant-restart closure (T4b) | Trigger doesn't fire (transaction rolled back) | partial — needs test | unhandled | Sample row stays open; metric eventually surfaces |

**Critical gap flagged:** BaselinePanel null-data case. Fix: add view-layer assertion that `n_outcomes >= 30 AND measured_per IS NOT NULL` before rendering measured state. Falls back to "Sampling — X/30" empty state on null. Add to T8 implementation.

## 18. Worktree parallelization strategy

Three lanes can run in parallel:

| Lane | Steps | Modules touched | Depends on |
|---|---|---|---|
| **A — back-test** | T2, T3 | `packages/snap-qc-engine/test/backtest/`, `docs/plans/` | nothing |
| **B — sampler infra** | T4, T4b, T7-absorbed, T10, T11 | `supabase/migrations/`, `apps/enrollment-api/src/routes/`, `apps/enrollment-api/test/` | nothing |
| **C — shadow emit** | T9 | `packages/snap-qc-engine/src/shadow-emit/`, `apps/enrollment-api/src/routes/me-packets.ts` (small edit) | nothing |

Then sequentially:

| Step | Depends on |
|---|---|
| T5 (dashboard queue panel) | B (needs `packet_qc_samples` deployed) |
| T8 (BaselinePanel live integration) | B + (eventually) Stream B outcomes |
| T12 (E2E validation gate) | B + T8 (needs full chain) |
| T6 (iOS push) | T5 (uses dashboard pending_count endpoint) |
| T1 (FOIA filing) | nothing — independent administrative task; Matthew runs in parallel |

**Conflict flag:** Lane B and Lane C both touch `apps/enrollment-api/src/routes/me-packets.ts` (B reads, C edits to add `ctx.waitUntil(emitShadowLog(...))`). Coordinate: land Lane B's submission-path edits first, then Lane C's shadow-emit hook. Or merge in one batch under one branch.

**Execution order:**
```
Launch in parallel worktrees: Lane A, Lane B, Lane C, T1
Merge all (resolve me-packets.ts in B+C overlap)
Then: T5 → T8 → T6 → T12
```

## 19. Implementation Tasks

Synthesized from this review. Each task derives from a specific finding.

- [ ] **T2 (P1, human: ~1d / CC: ~2h)** — snap-qc-engine — Back-test harness w/ baseline + full-engagement + additivity assertions
  - Surfaced by: §4 Stream A; ENG-D6 reuses determinism pattern
  - Files: `packages/snap-qc-engine/test/backtest/baseline-cohort.test.ts`, `packages/snap-qc-engine/test/backtest/per-pillar.test.ts`
  - Verify: `pnpm -F snap-qc-engine test backtest`
- [ ] **T3 (P1, human: ~4h / CC: ~30min)** — docs — Engine validation report v1 (state aggregate + USDA national)
  - Surfaced by: D7 FOIA fallback + Stream A output
  - Files: `docs/plans/error-rate-engine-validation-report.md`
- [ ] **T4 (P1, human: ~1d / CC: ~3h)** — supabase + enrollment-api — Migration 20260584 (single table per ENG-D1, partial constraint, 3 indexes) + `internal-qc-sampler.ts` cron (modular hash per ENG-D2)
  - Surfaced by: §4 Stream B; ENG-D1; ENG-D2; ENG-D7
  - Files: `supabase/migrations/20260584_packet_qc_samples.sql`, `apps/enrollment-api/src/routes/internal-qc-sampler.ts`, `apps/enrollment-api/wrangler.toml` (cron trigger)
  - Verify: smoke 10 submissions → ~1 flagged
- [ ] **T4b (P1, human: ~3h / CC: ~30min)** — supabase — Applicant-restart closure trigger
  - Surfaced by: D6
  - Files: included in migration 20260584
- [ ] **T10 (P1, human: ~2h / CC: ~20min)** — enrollment-api — Sampler test trio
  - Surfaced by: ENG-D6
  - Files: `apps/enrollment-api/src/routes/internal-qc-sampler.test.ts`
  - Verify: `pnpm -F enrollment-api test internal-qc-sampler`
- [ ] **T11 (P1, human: ~1h / CC: ~10min)** — enrollment-api — RLS 4-way matrix
  - Surfaced by: ENG-D5
  - Files: `apps/enrollment-api/test/rls/packet_qc_samples.test.ts`
  - Verify: `pnpm -F enrollment-api test rls`
- [ ] **T9 (P2, human: ~1d / CC: ~3h)** — snap-qc-engine + enrollment-api — Shadow-mode emitter w/ `ctx.waitUntil`
  - Surfaced by: §4 Stream C; D5 milestone filter; ENG-D3 async write
  - Files: `packages/snap-qc-engine/src/shadow-emit/emit.ts`, `apps/enrollment-api/src/routes/me-packets.ts` (waitUntil hook), `apps/enrollment-api/src/routes/recert.ts` (similar hook)
- [ ] **T5 (P2, human: ~1d / CC: ~2h)** — dashboard — `/dashboard/qc-review` queue panel
  - Surfaced by: §4 Stream B surface
  - Files: `apps/dashboard/app/(staff)/qc-review/page.tsx`, `apps/dashboard/components/qc/QcReviewQueuePanel.tsx`
- [ ] **T8 (P2, human: ~4h / CC: ~1h)** — dashboard — BaselinePanel live integration + null-data guard (critical gap from §17)
  - Surfaced by: §4 Stream B; §17 critical gap on null-data render
  - Files: `apps/dashboard/components/qc/BaselinePanel.tsx`, `apps/dashboard/lib/qc-pillar-coverage.ts`
- [ ] **T12 (P1, human: ~3h / CC: ~30min)** — dashboard — Validation-gate E2E
  - Surfaced by: ENG-D4
  - Files: `apps/dashboard/__tests__/qc-validation-gate.e2e.ts`, `apps/dashboard/test/seeds/qc-validation-seed.ts`
- [ ] **T6 (P3, human: ~4h / CC: ~1h)** — iOS — APNs push for pending QC reviews
  - Surfaced by: §4 Stream B; D5 navigator UX
  - Files: `Civica/Features/SNAP/QcReview/SNAPQcReviewNotification.swift`, backend push topic registration
- [ ] **T1 (P2, human: ~2h / CC: n/a)** — admin — File CDSS FOIA for CY2023+CY2024 county-level QC breakdowns
  - Surfaced by: D7 (parallel-track upgrade); Matthew runs independently

## 20. Resolved design decisions (from /plan-design-review 2026-05-27)

Calibrated against [`apps/dashboard/DESIGN.md`](../../apps/dashboard/DESIGN.md). Mockup generation skipped (designer needs `OPENAI_API_KEY`); text-based specs below.

**DES-D1 — T5 Queue IA + FIFO sort**

```
/dashboard/qc-review

HEADER:
  H1 "QC Review Queue" (24px ink, font-medium)
  Sub "Random sample of submitted packets flagged for QC review" (14px graphite)

AGGREGATE STRIP (one row, 4 tiles, surface-secondary bg):
  Pending in my org          [count, 24px ink]
  Completed this week        [count, 24px ink]
  My org sample coverage     [%, 24px ink, "of target 10%" eyebrow]
  Validation gate progress   [N/30, 24px ink, pine pill at 30/30]

PRIMARY TABLE (semantic <table>, white surface, hairline rows):
  columns: Sampled (rel time) │ Packet (initials + short id) │ Household │ County │ Stage badge │ →
  sort: FIFO — oldest sampled_at first (sample-bias mitigation; navigators cannot cherry-pick)
  row height: 56px; full-row clickable navigates to /packets/[id]?qc=1
  hover state: bg-paper
  chevron ›: pine, right-aligned

EMPTY STATE (left-aligned, no centered hero):
  "No packets pending QC review."
  "New samples flow in as packets are submitted — roughly 1 in 10."
  [Link → View completed reviews] (pine)
```

**DES-D2 — Interaction state coverage**

| Surface | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| T5 queue | Skeleton 3 rows (Suspense fallback per project pattern) | DES-D1 empty state | "Couldn't load queue" + retry button | row fade-out 200ms on outcome submit, count decrements | n/a |
| T8 BaselinePanel n<30 | "Loading samples…" 11px graphite eyebrow | "Sampling — X/30 outcomes" + thin progress bar | Falls back to "Sampling — —/30" + Sentry breadcrumb | crosses-fades to populated state @ n=30 (400ms) | n/a |
| T8 BaselinePanel n≥30 + null data | n/a | **Falls back to empty state** (per §17 critical gap fix) | n/a | populated state | n/a |
| T6 push | n/a | no push fires | silent fail w/ Sentry breadcrumb | one push at 9am if queue ≥ 1 | n/a |
| Falsification status panel (§7) | "Computing residual…" | hides at n<10 | "Residual unavailable" | "Engine residual: +0.3pt" sign-tinted | "Residual stable for 14d ✓" |

**DES-D3 — Residual viz (T8 populated state): inline pill below measured PER number**

```
┌────────────────────────────────┐
│ MEASURED PER       (eyebrow)   │
│ 5.82%              (24px ink)  │
│ ┌──────────────────────────┐   │
│ │ +0.32pt vs projected     │   │  pill: 12px, 6px padding, 3px radius
│ └──────────────────────────┘   │
└────────────────────────────────┘
```

Pill color logic:
- `|residual| ≤ 0.5pt` → graphite text on `surface-secondary` (neutral)
- `0.5 < |residual| ≤ 1.0pt` → warning text (#B5511E) on `bg-warning/10`
- `|residual| > 1.0pt` → brick text (#9C3A24) on `bg-brick/10` — thesis at risk

**DES-D4 — n=30 transition: calm 400ms cross-fade.** No toast, no confetti. BaselinePanel cross-fades from sampling state to populated state on next page load. Reflects gov-grade register + DESIGN.md's calm hierarchy. The number being real IS the celebration. No once-per-user ribbon.

**DES-D5 — Responsive (T5): hide low-value columns < 1024px.** Below 1024px, hide `county` + `household` columns; keep `sampled-at` + `packet` + `stage badge` + chevron. Row stays 56px clickable. No mobile-stack layout. No mobile-block notice — graceful column collapse only.

**DES-D6 — Row CTA: full-row click + chevron.** Entire row clickable; hover `bg-paper`; pine chevron `›` at row-end. Matches Linear/Stripe Dashboard conventions. Larger touch target than discrete button.

**DES-D7 — T6 push cadence: once per day at 9am.** Single push per morning if queue ≥ 1. Copy: "You have N QC reviews pending today." Quiet hours 6pm–9am. Skip weekends. APNs collapse-id on `qc-review-daily` so subsequent same-day fires replace not stack.

**Design tokens used (calibrated against `apps/dashboard/DESIGN.md`):**

- T5 stage badge: `bg-surface-secondary text-graphite border-hairline` (11px eyebrow, no semantic color load)
- Aggregate strip tiles: `bg-surface-secondary` background, 11px eyebrow labels, 24px ink numerals
- T5 row hover: `bg-paper` (subtle table-pattern convention)
- T5 chevron: `text-pine` (sanctioned per DESIGN.md pine-as-CTA rule)
- T8 measured-PER number: 24px ink-on-surface, font-medium
- T8 residual pill: see DES-D3 color logic — graphite/warning/brick scaled by |residual|

**AI slop defenses (explicit AVOID list):**

- T5: dense semantic `<table>`, NOT card grid. NO icons-in-colored-circles. NO centered hero in empty state. NO emoji.
- Aggregate strip: 4 tiles in `bg-surface-secondary`, NOT 4 cards with icon-circles.
- Empty state: left-aligned, subtle pine link, NO illustration unless it's a flat civic-graphic from existing dashboard inventory.

## 21. Scope deltas from design review

- T5 implementation effort revised: ~1d / ~2h CC unchanged; spec is now load-bearing.
- T8 critical-gap fix from §17 absorbed into DES-D2 (n≥30 + null → empty state, NOT half-rendered card).
- T6 cadence (9am daily) simplifies backend: cron at 0 14 * * 1-5 UTC → push collapse-id `qc-review-daily`, not per-event APNs trigger. Reduces APNs traffic ~10×.
- New mini-tasks folded into existing T-list (no new top-level T-IDs needed):
  - T5 acceptance: must render at 1024px breakpoint per DES-D5
  - T6 acceptance: must use APNs collapse-id + respect quiet hours
  - T8 acceptance: must include the DES-D3 pill + DES-D2 null-data fallback

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR (HOLD SCOPE) | 5 decisions resolved (D3-D7); 2 deferred to TODOs |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (FULL_REVIEW) | 7 decisions resolved (ENG-D1 through ENG-D7); 1 critical gap (BaselinePanel null-data) folded into T8 |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 3/10 → 9/10; 7 decisions resolved (DES-D1 through DES-D7); §17 critical gap absorbed into DES-D2 |
| Outside Voice | `/codex review` | Independent 2nd opinion | 0 | — | skipped (user can run `/codex review` if desired) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not applicable (internal validation work) |

**UNRESOLVED:** 0
**CRITICAL GAPS:** 0 (the §17 BaselinePanel null-data gap is now folded into DES-D2 empty-state fallback)
**VERDICT:** CEO + ENG + DESIGN CLEARED — ready to implement. Plan moves from 3/10 design completeness to 9/10 across all reviews. T2/T4/T4b/T10/T11/T12 are P1 (block ship); T3/T5/T8/T9 are P2 (same-branch); T6 is P3.
