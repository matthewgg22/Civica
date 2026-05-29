---
id: 2026-05-29-error-rate-truth-point
date: 2026-05-29
scope: [analytics, process, snap-qc-engine]
confidence: medium
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: file
    ref: docs/findings/README.md
    note: "The findings ledger is the truth-point substrate — append-only, cited, team-visible. This finding records the method for feeding it without AI drift."
  - kind: file
    ref: apps/dashboard/lib/analytics/per-regression.ts
    note: "The deterministic-artifact exemplar: a re-runnable harness emits a versioned, provenanced artifact; the dashboard renders it; AI never computes the number. Generalize this pattern to live error-rate stats."
  - kind: file
    ref: supabase/migrations/20260596_qc_error_rate_by_slice.sql
    line: 26
    note: "The pattern in one line: 'the VIEW returns raw counts (n, errors); the ENGINE owns the formula so it is tested once.' SQL holds the data; the engine owns the math."
  - kind: file
    ref: packages/snap-qc-engine/src/scoring/error-risk.ts
    note: "Single math source: CA_BASELINE_PER (10.98), PROJECTED_PER_AT_FULL_ENGAGEMENT (5.5), computeEngagementImpliedPER(coverage). The truth point must compute via these, never re-derive in SQL or in a chat."
  - kind: file
    ref: apps/enrollment-api/src/lib/scoring.ts
    note: "emitQcEvaluation writes the QC event lake (S3, date-partitioned) but nothing folds it back. The truth point closes that loop by materializing into Postgres."
  - kind: memory
    ref: project_error_rate_engine
    note: "scoreErrorRisk v0.3.0 + /error-risk + /qc-outcome endpoints live; CDSS FOIA + n>=30 measured outcomes are the listed pending inputs."
---

## What we found

The failure mode we are designing against: error-rate insights produced ad hoc in
an AI chat (Cowork) live in one person's session, are not reproducible, **drift**
between runs, and the team never sees a canonical version. We want a single
**truth point** — one reproducible, cited, team-visible record of the error rate
and its stats — with AI as the *insight drafter*, not the source of the numbers.

**The rule that prevents drift:** *AI explains the number; a deterministic job
computes it.* A statistic is canonical only when (a) it comes from a re-runnable
computation, (b) it is recorded as a cited finding with provenance, and (c) it is
published to a shared surface. AI drafts and interprets; it never recalls or
re-derives the figure from memory. This is the same discipline as the
pre-registered regression — the engine/harness owns the math, the artifact is the
record, the model only narrates.

**The loop:**

```
data  →  deterministic artifact (+ provenance)  →  AI-drafted insight
      →  cited finding (supersede, never overwrite)  →  published surface
         (/findings + Datasette + gbrain)
```

We already have most of the substrate:

- the **findings ledger** (this) — append-only, cited, public at `/findings`;
- the **per-regression harness** — engine-owns-math → versioned artifact → render;
- the **per-slice Postgres view** (`v_qc_error_rate_by_slice`) — raw counts in
  SQL, Wilson interval in the engine.

The two missing pieces: **(1)** a canonical error-rate **snapshot** in the
*omnipresent* store (Postgres), refreshed on a schedule; and **(2)** an ergonomic
**insight → cited finding** step so AI output lands in the ledger by construction.

## Why it matters

- **Anti-drift guarantees:** grounding (AI reads the artifact, not its memory),
  provenance (every claim cites artifact + git sha + data version + date),
  determinism (re-runnable), **lineage over overwrite** (supersede a finding so
  you can see *how the truth moved*), and a single surface.
- **Omnipresence:** of all our stores, only Postgres is reachable by every
  runtime (Workers gateway, dashboard server, FastAPI backend, iOS via the
  gateway). The parquet/DuckDB analytical lane is dashboard-Node-only and
  ephemeral (`:memory:`), so derived error-rate facts must be **materialized into
  Postgres** for the whole team and the AI to reference one identical source.
- It turns "what is our error rate?" from N divergent chat answers into **one
  row everyone reads**.

## What changes

Build order (this finding kicks off step 1):

1. **Canonical error-rate snapshot** — a Postgres table `error_rate_snapshot`
   plus a `v_error_rate_current` view, written by a job that runs the engine and
   composes:
   - **baseline** — published CA FY2024 total PER, 10.98% (USDA FNS);
   - **projected** — engine projection at full engagement, ~5.5%;
   - **engagement-implied** — live, from `v_qc_pillar_coverage` via
     `computeEngagementImpliedPER`;
   - **measured** — observed PER from `qc_outcomes` (sampled, n-gated ≥ 30).

   Each row carries `source` + provenance (`computed_at`, `engine_version`).
2. **The `/insight` loop** — data → AI-drafted, cited finding, reusable for any
   metric (extends the existing `/finding` skill).

AI is wired in only at the draft step; the numbers always come from the snapshot.

## Open questions

- **Refresh runtime.** Cloudflare Worker crons are at the free-tier cap (5/5;
  a USDA-sync cron was already dropped to fit). Options: piggyback the refresh on
  an existing scheduled handler, upgrade the plan, or use `pg_cron` for the
  SQL-computable parts. (The engine-derived `engagement_implied` needs a TS
  runtime — `snap-qc-engine` is pure TS, so a Worker can run it; `pg_cron` alone
  cannot.)
- **Public exposure of per-slice measured rates** needs min-N suppression to
  avoid re-identification — deferred to v2, mirroring the decision recorded in
  `v_qc_error_rate_by_slice`.
- **Ergonomics of step 2:** extend the existing `/finding` skill vs a new
  `/insight` command.

Related: [[2026-05-28-per-regression-preregistration]] — the deterministic-artifact
exemplar this generalizes. [[2026-05-28-evidence-ledger-architecture]] — the
ledger as the method of record that makes insight durable instead of drifting.
