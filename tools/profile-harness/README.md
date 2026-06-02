# @civica/profile-harness

Regression harness that runs the Civica SNAP test-profile fixture through
the rules engine and reports **engine-vs-oracle agreement**.

> **NOT** a payment-error-rate calculator. The output is grading on a
> synthetic, policy-sourced fixture. Do not confuse with PER.

## What it does

1. Loads + schema-validates `data-ops/sample/civica-test-profiles/v0.6.json`
   (110 profiles × 5 states, policy-sourced oracle).
2. Runs every profile through a pluggable engine adapter.
3. Classifies each result `PASS` / `FAIL` / `SKIP`:
   - `PASS` — engine agrees with oracle (verdict + benefit if params match)
   - `FAIL` — engine disagrees with oracle (the regression we want to catch)
   - `SKIP` — engine doesn't implement a required surface (build roadmap)
4. Writes a markdown report grouped by USDA QC element (per
   `error_surface.element` on each profile) — so a regression in shelter
   math shows up as a `363_shelter` row, not buried in an aggregate.

Safety-critical rows get their own sections:

- `must_reject` profiles where the engine MUST return DENY
- `negative_control` profiles where the engine MUST NOT count excluded inputs

## What it deliberately doesn't do

- **Doesn't re-derive expected values from the engine.** The oracle is
  policy-sourced (per `civica_test_profiles_generator.py`) and independent.
- **Doesn't name any output an "error rate"** — engine-vs-oracle agreement
  is not PER.
- **Doesn't grade profiles whose engine surface isn't built.** They SKIP,
  with the missing surface listed — that's your roadmap.

## Usage

```sh
pnpm --filter @civica/profile-harness run
pnpm --filter @civica/profile-harness run -- --state MA
pnpm --filter @civica/profile-harness run -- --verdict-only --out /tmp/report.md
pnpm --filter @civica/profile-harness run -- --engine sentinel    # scaffold smoke test
```

Or via the slash command:

```
/profile-harness
/profile-harness state=MA verdict-only
```

## Architecture

```
loader.ts        ──> reads + Ajv-validates the v0.6 fixture
facts-patch.ts   ──> applies A/B variant facts_patch dotted-path mutations
adapter.ts       ──> EngineAdapter interface (ts / sentinel today; swift planned)
runner.ts        ──> iterates profiles, classifies PASS/FAIL/SKIP, aggregates
report.ts        ──> markdown report (per-element headline + safety sections)
capability-      ──> single source of truth: which engine surfaces are wired
  manifest.ts        up today. Updated in lockstep with the composer.
```

## Phases

- **Wave A**: scaffold runs; engine adapter is a sentinel; every profile
  SKIPs; report surfaces the roadmap.
- **Wave B**: TS verdict composer in `@civica/snap-rules`; first real
  PASS/FAIL grades on ~20-40 profiles (income test + asset test + simple
  student gate + benefit calc).
- **Wave 1 (rest)**: ABAWD, categorical, full student exemptions.
- **Wave 2**: immigration / disqual / proration / sponsor (new modules).
- **Wave 3**: Swift adapter; TS-vs-Swift divergence report. The audit's
  "two engines, no agreed verdict" gets a number.

## Adding a new engine

Implement `EngineAdapter` (in `src/types.ts`), register in
`src/adapters/`, branch on it in `src/cli.ts`. The adapter must:

- Return `not_implemented_surfaces: [...]` (not throw) when a rule
  surface isn't implemented — the runner SKIPs gracefully.
- Surface its params via `getEngineParams()` so PARAMS_MISMATCH detection
  works.
