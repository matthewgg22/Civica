---
description: Run the Civica SNAP profile simulation; grades the rules engine against the v0.6 test-profile oracle.
---

Run the SNAP profile simulation against the v0.6 fixture and surface the
markdown report. This grades **engine-vs-oracle agreement** — it is NOT a
payment-error-rate calculator. Per-element pass rate is the headline.

The report now also includes a **verification-context preflight** at the
top, showing the Layer 3 registry lint (constants hygiene) and Layer 1a
metamorphic relations (engine self-consistency) status alongside the
harness totals. Each layer proves something distinct; the preflight
surfaces all three without conflating them. See
`docs/findings/2026-06-03-verification-hyperdrive-v0.md`.

Preflight adds ~1.3s latency (vitest spawn). Pass `--skip-metamorphic`
to keep lint but skip the vitest run (faster, lint is <100ms). Pass
`--no-preflight` to skip the whole thing.

> **Naming note:** the slash command surface is `/profile-simulation`. The
> underlying tool keeps its package name `@civica/profile-harness` at
> `tools/profile-harness/` (renaming the package would churn imports +
> the mutation-score driver). Both names refer to the same thing.

## Behavior

1. Parse `$ARGUMENTS` for flags (any of: `state=CA|MA|TX|KS|AK`,
   `verdict-only`, `engine=ts|sentinel`, `out=path.md`). Default state CA,
   default engine ts, default writes to stdout.
2. Invoke:
   ```sh
   pnpm --filter @civica/profile-harness run -- --state <state> [--verdict-only] [--engine <engine>] [--out <path>]
   ```
3. If the run produces a markdown report on stdout, show the first ~120
   lines (headline tables) inline. If `--out` was passed, just report
   "Wrote N lines to <path>" and tail the totals.
4. Always print these three things explicitly at the end:
   - **Total PASS / FAIL / SKIP** counts
   - **Top 5 engine completion blockers** (from the SKIP roadmap section)
   - **PARAMS_MISMATCH** banner if any
5. If `--verdict-only` was NOT passed and the report's PARAMS_MISMATCH
   triggered, tell the user benefits were skipped this run and suggest
   they either fix the engine constants or pass `--verdict-only`
   explicitly.

## Discipline

- Don't summarize away the per-element headline — that table IS the
  signal. An aggregate % hides which rule area regressed.
- Don't promise PASS rates will improve "soon" — surface what the
  roadmap says, no spin.
- If FAIL count is nonzero, surface the citation column from the
  failures table — every failure links to a 7 CFR cite by design.

## Useful follow-ups (only mention if relevant)

- If 100% SKIP: the composer isn't built yet. Point at `Wave B` in
  `tools/profile-harness/README.md`.
- If FAIL > 0: dump the failing rows with citation; ask whether to dive
  into the first one.
- If PARAMS_MISMATCH: list the top 5 diffs.

`$ARGUMENTS`
