# SNAP QC engine — internal test plan (MA pilot, 2026-06)

**Scope:** the probability/error-rate engine in `packages/snap-qc-engine/`,
state-keyed for CA + MA as of branch `claude/snap-engine-ma-pilot-2026-06-02`
(commits `3f6a7b54` + `464a2e1c`).

**Goal:** verify the engine produces correct outputs for both CA and MA given
correct inputs — without spinning up the gateway, dashboard, or iOS.

## Status going in

- 316/316 unit + golden + parity tests pass on the branch.
- 19 new `state-constants.test.ts` tests pin MA baselines, income-group PER,
  element attribution, and CA-vs-MA parity for the `*ForState` variants.
- Fixture-harness CLI shipped at `packages/snap-qc-engine/cli/`.

## What this plan tests

The engine surfaces that an internal tester can exercise today:

1. `scoreErrorRisk` — per-packet error risk (0–100, tiered low/medium/high)
2. `computeProjectedPERForState` — population PER projection given engagement
3. `pillarContributionForState` — per-pillar PER reduction breakdown
4. `perPacketGapContributionForState` — per-packet → population gap conversion
5. `buildErrorRateSnapshot` — canonical truth-point row construction
6. `buildKpiSnapshot` — KPI rollup composition with n-gating

## What this plan does NOT test

- End-to-end closed loop with measured outcomes (no county webhook feeding QC outcomes yet — TODO-44).
- Engine integration in the iOS app (separate test plan).
- Engine integration in the dashboard (no `/cbo-preview` surface for this yet).
- Live API routes (`apps/enrollment-api/`) — engine is consumed via direct import.

## Setup

```sh
git switch claude/snap-engine-ma-pilot-2026-06-02
pnpm install
pnpm --filter @civica/snap-qc-engine test          # expect 316/316 green
pnpm --filter @civica/snap-qc-engine cli demo      # expect rich output, no errors
```

## Primary entry point: batch runner

The 7 scenarios below are also encoded declaratively in
`data-ops/test-scenarios/snap-engines-2026-06.json` (top-level `probability`
section). Run them all as assertions in one shot:

```sh
pnpm --filter @civica/snap-qc-engine cli batch \
  "$PWD/data-ops/test-scenarios/snap-engines-2026-06.json"
```

Expected output: every scenario marked `✓`, exit code 0. To pin a new
invariant, add a scenario to the file — no code change required.

The hand-walk scenarios below remain useful for understanding what each
assertion means and for ad-hoc exploration via `cli score` / `cli population`.

## Test scenarios

### Scenario 1 — score floor invariant

```sh
cd packages/snap-qc-engine
pnpm cli score cli/fixtures/strong-packet.json
```

**Expected:**
- `tier: "low"`
- `score: 5` (floor — the engine's calibrated minimum for an all-strong packet)
- `factors: []`

### Scenario 2 — score ceiling invariant

```sh
pnpm cli score cli/fixtures/weak-packet.json
```

**Expected:**
- `tier: "high"`
- `score: 80` (ceiling — the engine's calibrated maximum for an all-weak packet)
- `factors:` 3 risk labels ordered by USDA error weight: `shelter_utility_unverified`, `earned_income_unverified`, `shelter_cost_unverifiable`

### Scenario 3 — CA full engagement reaches thesis target

```sh
pnpm cli population CA cli/fixtures/full-engagement-coverage.json
```

**Expected:**
- baseline PER: `10.98%` (FY24 published)
- projected PER: **`5.50%`** ← thesis target per `docs/plans/civica-error-reduction-thesis.md` §4
- baseline → projected delta: `-5.48pp`

### Scenario 4 — MA full engagement scales proportionally

```sh
pnpm cli population MA cli/fixtures/full-engagement-coverage.json
```

**Expected:**
- baseline PER: `14.10%` (FY24 published)
- projected PER: **`7.06%`** ← matches `MA_BASELINE × (5.5/10.98) = 14.10 × 0.5009 ≈ 7.06`
- baseline → projected delta: `-7.04pp`
- This invariant is the load-bearing claim of the MA-pilot pitch: "Civica's pillar coverage scales the same percentage reduction to MA's higher baseline."

### Scenario 5 — partial engagement realism check

```sh
pnpm cli population MA   # uses built-in mid-engagement profile
```

**Expected (built-in fixture: util=50%, gig=60%, lease=40%, assets=30%, benefit=50%):**
- projected MA PER ≈ `10.38%` (delta `-3.72pp`)
- `utility_sua` is the largest pillar contributor (-1.79pp); `assets` is near-zero (USDA element 211/221 represents <0.01% of errors).
- Same fixture against CA gives `8.08%` projected — same coverage profile, different state baseline, same proportional reduction structure.

### Scenario 6 — per-packet → population gap conversion

After running scenario 2 (weak packet, score 80):
```
Gap contribution if every packet had this score:
  CA: +5.48 pp reduction at full engagement
  MA: +7.04 pp reduction at full engagement
```

**Expected:** the gap contribution at score ceiling (80) equals the baseline →
full-engagement delta for each state. This is the linear interpolation
invariant: per-packet score 80 ↔ population full engagement.

### Scenario 7 — measured-PER n-gate (when implemented)

```sh
echo '{"numerator": 4, "denominator": 25}' > /tmp/n-below-gate.json
pnpm cli snapshot CA /tmp/n-below-gate.json
echo '{"numerator": 4, "denominator": 50}' > /tmp/n-above-gate.json
pnpm cli snapshot CA /tmp/n-above-gate.json
```

**Expected:**
- n=25 (below MEASURED_MIN_N=30): measured row skipped or marked gated
- n=50: measured row included with Wilson 95% band

(Note: `cmdSnapshot` may need a counts schema fix — see CLI source.
Pin via `kpi-snapshot.test.ts` instead if the CLI shim has rough edges.)

## Known gaps and expected behaviors

| Gap | Expected during test | Tracking |
|---|---|---|
| No live county outcomes | `measured_per` rows omitted/null until denom ≥ 30 | TODO-44 county webhook |
| `cdss-mapping.ts` carries TODO-4 | Engine works; mapping not yet authoritative for sales pitch numbers | External counsel review |
| Pillar shares are CA-derived for MA | MA projection uses CA's per-pillar reduction structure, scaled by MA baseline. Per-state pillar shares are a known follow-up. | See finding `2026-06-01-ma-state-baseline.md` "What changes" §2 |
| ABAWD area-waiver list not loaded | Not exercised in this plan (eligibility engine concern) | Pending FNS publication |

## Pass criteria

- All 316 unit tests pass.
- All 7 scenarios above produce the expected outputs.
- No NaN, Infinity, or unexplained zeros in CLI output.
- Engine version printed matches `packages/snap-qc-engine/src/version.ts` (`0.3.0`).

## After test

If all 7 scenarios pass, the engine is **green for internal use** as a
pure-compute library. The next gating step for "live" use is operator
action (apply migrations [#429](https://github.com/matthewgg22/Civica/issues/429),
deploy gateway, activate county webhook) — none of which requires further
engine changes.
