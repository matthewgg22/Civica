# Error Rate Engine — Validation Report v1

**Date:** 2026-05-27
**Branch:** `feat/dashboard-caseworker-readiness` (Lane A worktree: `worktree-agent-ac03acd264d153720`)
**Commit:** `8d269ca5`
**Engine version:** `@civica/snap-qc-engine` v0.3.0 (`packages/snap-qc-engine/src/version.ts`)
**Plan reference:** `docs/plans/qc-error-rate-intelligence-redesign.md` (Lane A — Retrospective Back-test)

## Purpose

Falsification-grade evidence that the shipped population PER projection formula
reproduces (a) the published CA FY2024 payment-error rate at zero engagement
and (b) the thesis-projected ~5.5% PER at full Civica stack engagement —
within the tolerances called out in the Lane A spec.

The engine has **zero measured outcomes** to date; this report covers the
**retrospective back-test** only. Forward-looking falsification (measured PER
from ≥30 QC outcomes) is gated on CDSS FOIA + the CalibrationPanel work
described in plan §3.4 and ENG-D7.

## Methodology

The engine exposes `computeProjectedPER` and `computeEngagementImpliedPER`
over a `PillarCoverage` struct keyed by Civica's five FNS-380-mapped pillars.
Both functions implement the same closed-form reduction:

```
projected_PER = CA_BASELINE_PER
              - Σ pillar_contribution(p, coverage[p])
pillar_contribution(p, e) = CA_BASELINE_PER × share[p] × max_shift[p]
                          × e × THESIS_CALIBRATION_FACTOR
```

The back-test asserts the formula's behavior on four synthetic cohorts
(below) without modifying any engine source. The engine is the system under
test; any failure forces recalibration of `THESIS_CALIBRATION_FACTOR` (or
adjustment of `PILLAR_SHARES_UNNORMALIZED` / `PILLAR_MAX_DEFENSIBILITY_SHIFT`)
before any external claim using these numbers ships.

### Source citations

- **Baseline PER (10.98%):** USDA FNS-380 FY2024 California row, published
  June 2025. PDF source cited inline in
  `packages/snap-qc-engine/src/scoring/error-risk.ts`:
  <https://fns-prod.azureedge.us/sites/default/files/resource-files/SNAPQC-FY2024.pdf>
- **Pillar shares:** USDA FNS QC microdata, CA FY2023 element-attribution
  CSV (`ca_fy2023_element_attribution.csv`), accessed via USDA FNS research
  agreement. Row-by-row mapping documented in `PILLAR_SHARES_UNNORMALIZED`
  in `error-risk.ts`.
- **Projection target (5.50%):** `docs/plans/civica-error-reduction-thesis.md`
  §4 — full-stack engagement projection.
- **CFR mapping:** `packages/snap-qc-engine/src/citations/cfr-273.ts`
  (7 CFR §273.2(f), §273.9, §273.10).

## Synthetic Cohort Definitions

All cohorts are `PillarCoverage` structs with values in `[0, 1]`. Mapping
between the plan's narrative pillar names and the engine's field names:

| Plan name     | Engine field      | Best-achievable tier | Shift |
|---------------|-------------------|----------------------|-------|
| shelter       | `utility_sua`     | strong (API-verified)| 0.75  |
| income        | `gig_income`      | strong (Argyle wire) | 0.75  |
| calc          | `benefit_impact`  | strong (deterministic)| 0.75 |
| sharedLease   | `shared_lease`    | moderate (classifier)| 0.56  |
| assets        | `assets`          | (no integration)     | 0     |

Cohorts (verbatim from `test/backtest/baseline-cohort.test.ts`):

```ts
ZERO_ENGAGEMENT    = { utility_sua: 0, gig_income: 0, shared_lease: 0,
                       assets: 0, benefit_impact: 0 }
FULL_ENGAGEMENT    = { utility_sua: 1, gig_income: 1, shared_lease: 1,
                       assets: 0, benefit_impact: 1 }
PARTIAL_ENGAGEMENT = { utility_sua: 0.5, gig_income: 0.3, shared_lease: 0.4,
                       assets: 0, benefit_impact: 0.6 }
```

Notes:
- `shared_lease = 1.0` means "fully engaged at the moderate-tier achievable
  result" — the moderate-tier ceiling is encoded in
  `PILLAR_MAX_DEFENSIBILITY_SHIFT.shared_lease = 0.56`, not in the coverage
  value.
- `assets = 0` in `FULL_ENGAGEMENT` because the assets shift is 0 (no Civica
  integration); the contribution is invariant to coverage. Pinned to 0 to
  reflect the shipped engineering state.
- The engine has no `obbba` pillar in v0.3.0. OBBBA categorical-eligibility
  tracking is a future pillar — out of scope for v1 falsification (plan §3 +
  ENG-D7).

## Results

| Cohort | Expected PER | Computed PER | Tolerance | Within? |
|--------|--------------|--------------|-----------|---------|
| Zero engagement | 10.98% (CA_BASELINE_PER) | 10.98% | ±0.5pt (passes ±0.0) | Y |
| Full engagement (assets=0) | 5.50% (PROJECTED_PER_AT_FULL_ENGAGEMENT) | 5.50% | ±0.1pt (passes ±0.0) | Y |
| Full engagement (assets=1) | 5.50% (assets shift=0, invariant) | 5.50% | ±0.1pt | Y |
| Partial (additivity) | baseline − Σ contribs | matches joint exactly | float epsilon | Y |

Per-pillar invariants:

| Property | Result |
|----------|--------|
| Per-pillar contribution at full ≤ theoretical cap (CA_BASELINE_PER × share × max_shift) | Pass — all 5 pillars |
| Monotonicity: PER non-increasing as any single coverage rises from 0 → 1 | Pass — all 5 pillars, on-axis + interior cross-check |
| Calibration anchor: PER at zero engagement === CA_BASELINE_PER exactly | Pass |
| Sum of contributions at full engagement === CA_BASELINE_PER − 5.5 | Pass (within 1e-10) |

Test execution: `pnpm -F @civica/snap-qc-engine test` — 14 files, **224 / 224
passed** (20 new assertions in `test/backtest/`).

## Falsification Statement

If any cohort assertion in `test/backtest/baseline-cohort.test.ts` or
`test/backtest/per-pillar.test.ts` fails, the engine projection is broken
and **`THESIS_CALIBRATION_FACTOR` must be recalibrated** before any external
claim using `CA_BASELINE_PER`, `PROJECTED_PER_AT_FULL_ENGAGEMENT`, or the
~5.48pt reduction figure ships. The calibration identity
(`theoretical_max_reduction × THESIS_CALIBRATION_FACTOR ===
CA_BASELINE_PER − PROJECTED_PER_AT_FULL_ENGAGEMENT`) is the load-bearing
invariant — drift there means either the FNS-380 shares are stale or the
defensibility tiers no longer reflect the shipped verification stack.

## Scope Notes

- **v1 = state aggregate.** This report validates the projection against
  the published CA FY2024 PER (state-level). County-level validation lands
  in v2 once CDSS FOIA returns the requested county breakdown (plan §15
  ENG-D7); county validation is explicitly **NOT** in scope here (plan §11).
- **Retrospective only.** Measured-PER falsification (engine projection vs.
  observed QC outcomes for Civica-served households) requires ≥30 QC
  outcomes and is gated on the CalibrationPanel work (plan §3.4). When that
  lands, a v2 report will append measured-vs-projected comparisons.
- **OBBBA pillar not modeled.** The v0.3.0 engine has five pillars; OBBBA
  categorical-eligibility is on the roadmap but does not have a
  `PillarCoverage` field today, so it's neither asserted on nor required.

## Reproduction

```sh
cd packages/snap-qc-engine
pnpm test                       # runs all 224 tests
pnpm vitest run test/backtest   # runs only the back-test harness (20 tests)
```
