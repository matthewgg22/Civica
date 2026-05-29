---
name: insight
description: >-
  Produce a drift-proof, cited finding from the canonical error-rate truth
  point. Reads the live snapshot (v_error_rate_current), drafts the key
  insights from ONLY those numbers, shows the finding for approval, and writes
  it to the ledger on confirmation. Use when asked to "draw an insight",
  "what does the error-rate data say", "write up the latest error rate", or
  "/insight".
---

# /insight — canonical insight from the error-rate truth point

The capability this exists for: *give the data, get an insight* — but grounded
in the canonical truth point and landing as a **cited finding**, not as drifting
chat text. The discipline (from `docs/findings/2026-05-29-error-rate-truth-point.md`):

> **A deterministic job computes the number; you only explain it.**
> Never recall or re-derive a PER from memory. Every figure in the finding
> must come from the fetched snapshot. Compute deltas from fetched values only.

This command is **draft-for-approval**: it never writes to the ledger without an
explicit OK. The human gate is what keeps AI-drafted prose trustworthy in the
canonical record.

## Step 1 — Fetch the truth point (never fabricate)

Get the latest snapshot run from `snap_enrollment.v_error_rate_current`.

- **Preferred (auto):** if `SUPABASE_SERVICE_ROLE_KEY` and
  `NEXT_PUBLIC_SUPABASE_URL` are in the environment, run:
  ```bash
  node tools/insight/fetch-truth-point.mjs
  ```
  It prints a JSON object `{ available, computed_at, engine_version, metrics: [...] }`.

- **Fallback (no creds):** ask the user to run this in the Supabase SQL Editor
  and paste the result:
  ```sql
  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  from snap_enrollment.v_error_rate_current t;
  ```

**If the result is empty** (`available:false` or `[]`): STOP. Tell the user the
snapshot has not been populated yet and how to populate it (deploy the gateway so
the 04:00 cron runs, trigger the cron from the Cloudflare dashboard, or call the
refresh endpoint). Do **not** invent numbers or draft a finding from constants.

## Step 2 — Draft the insight (from fetched numbers only)

Read the metric rows. The canonical four:

- `baseline_ca` — published CA total PER (USDA FNS-380), the anchor.
- `projected_full_engagement` — engine projection at full stack engagement.
- `engagement_implied` — what today's coverage implies via the engine formula.
- `measured_overall` — observed PER from QC sampling; `per_pct` is null and
  `meta.status = "insufficient_sample"` until n ≥ 30.

Plus SLICED breakdowns (rows where `slice_dim` is set) for depth:

- `pillar_contribution` (`slice_dim: pillar`) — pp of the reduction each pillar
  earns at today's coverage (utility_sua, gig_income, shared_lease, assets,
  benefit_impact). `meta.unit = reduction_pp`. Names the bottleneck pillar.
- `income_group_per` (`slice_dim: income_group`) — PER by income cohort
  (wage_only, no_earned, civica_tam = the earned-income TAM). National FY23.
- `element_attribution` (`slice_dim: element`) — share of CA errors by USDA
  element (363 Shelter, 311 Wages, 331 RSDI…). `meta.unit =
  share_of_errored_cases_pct` (a SHARE, not a PER — say so).

Write the key findings using ONLY these values. Useful framings:

- engagement-implied vs baseline: the reduction at *current* coverage
  (`baseline_ca.per_pct − engagement_implied.per_pct`, in pp).
- distance still to go: `engagement_implied.per_pct − projected_full_engagement.per_pct`.
- measured: if n ≥ 30, report `per_pct` with the 95% CI `[ci_low, ci_high]`;
  otherwise say "measured PER pending — n = {n} of 30".
- always state provenance inline: "as of {computed_at}, engine {engine_version}".
- depth: name the top pillar contributor (largest `pillar_contribution.per_pct`)
  and the top error element (largest `element_attribution` share); contrast the
  earned-income cohort (`income_group` civica_tam) vs no_earned to frame the TAM.

Pick a confidence level honestly: `high` only once measured n ≥ 30 corroborates
the projection; otherwise `medium` (engagement-implied is a model output) or
`low` for sparse data.

## Step 3 — Compose the finding (do not write yet)

Draft a finding file body in memory following `docs/findings/_template.md`:

- **id:** `<YYYY-MM-DD>-<slug>` (today's date; slug like `error-rate-snapshot-<month>`)
- **scope:** `[analytics, snap-qc-engine, pitch]` (adjust to the insight)
- **confidence:** per Step 2
- **status:** `active`
- **evidence:** cite the snapshot — kind `dataset`/`file`,
  ref `snap_enrollment.v_error_rate_current @ {computed_at}` with a note naming
  `engine_version` — plus `file: supabase/migrations/20260597_error_rate_snapshot.sql`
  and the method finding `2026-05-29-error-rate-truth-point`.
- **body:** *What we found* (the numbers + framings) / *Why it matters* /
  *What changes* / *Open questions*. End with a `[[2026-05-29-error-rate-truth-point]]`
  wikilink.

## Step 4 — Show for approval

Present the complete drafted finding (frontmatter + body) to the user. Then ask
plainly: **approve / edit / cancel.** Do not create any file until approval.

## Step 5 — On approval, write + publish

1. Write `docs/findings/<id>.md`.
2. Append the one-line entry to `docs/findings/INDEX.md` under the current month.
3. Rebuild the queryable DB: `make findings` (regenerates the gitignored
   `findings.db`; never commit that file).
4. Refresh semantic search: run `/sync-gbrain` (or `gbrain sync`) so the finding
   is recallable.
5. Confirm: print the file path and the INDEX line. Remind that the finding is a
   commit candidate (it is the shared, canonical artifact — the skill is local).

## Rules

- Never invent or recall a statistic — only what Step 1 returned.
- One finding per insight. To revise a prior insight, **supersede** it
  (set the old one's `superseded_by`), never silently overwrite.
- If the data is stale (old `computed_at`) or empty, say so rather than papering
  over it.
