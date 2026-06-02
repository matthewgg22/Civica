# SNAP QC engine — fixture harness CLI

Internal-test deliverable for exercising the probability/error-rate engine
without spinning up the gateway, dashboard, or iOS app.

## Quick start

```sh
# From repo root:
pnpm --filter @civica/snap-qc-engine cli demo
```

That runs every engine entry point against built-in fixtures and prints
structured output. No network, no DB, no API.

## Subcommands

| Command | What it exercises |
|---|---|
| `cli demo` | All entry points with built-in fixtures (start here) |
| `cli score [packet.json]` | `scoreErrorRisk` — per-packet error-risk score (0–100, tiered) |
| `cli population <CA\|MA> [coverage.json]` | `computeProjectedPERForState` + `pillarContributionForState` — population PER projected from engagement coverage |
| `cli snapshot <CA\|MA> [counts.json]` | `buildErrorRateSnapshot` — canonical truth-point rows for `error_rate_snapshot` table |

## Fixture formats

`packet.json` — what one packet's QC results look like:

```json
[
  { "flow": "utility-sua", "defensibility_score": "moderate" },
  { "flow": "gig-income", "defensibility_score": "weak" },
  { "flow": "shared-lease", "defensibility_score": "strong" }
]
```

Valid `flow` values: `utility-sua`, `gig-income`, `shared-lease`, `assets`, `benefit-impact-projection`.
Valid `defensibility_score` values: `strong`, `moderate`, `weak`.

`coverage.json` — population engagement coverage (0.0–1.0 per QC pillar):

```json
{
  "utility_sua": 0.5,
  "gig_income": 0.5,
  "shared_lease": 0.5,
  "assets": 0.5,
  "benefit_impact": 0.5
}
```

The 5 pillars match the engine's flow kinds — see [PillarCoverage](../src/scoring/error-risk.ts) for the schema.

`counts.json` — measured QC outcomes (numerator/denominator) for the
measured-row gate test:

```json
{ "numerator": 4, "denominator": 50 }
```

Note: `buildErrorRateSnapshot` returns `null`/skip for the measured row
when `denominator < 30` (the engine's n-gate). This is intentional —
exercises the gate behavior.

## Bundled fixtures

- `fixtures/strong-packet.json` — all flows strong (expect tier: low, score ~5)
- `fixtures/weak-packet.json` — three flows weak (expect tier: high)
- `fixtures/mixed-packet.json` — realistic split (expect tier: medium)
- `fixtures/full-engagement-coverage.json` — 100% engagement (expect projected PER ≈ 5.5% for CA, 7.06% for MA)

## What this does NOT exercise

- iOS eligibility engine (`Civica/Features/SNAP/Rules/`) — separate test plan.
- County-outcome webhook → `measured_per` gating (no inputs yet; TODO-44).
- Dashboard surfaces or any cross-system wiring.

For the closed-loop "measured impact" story, you need the operator chain
(migrations + wrangler deploy + county webhook). The CLI proves the
engine produces correct outputs given correct inputs — that's the
contract internal testers can pin today.
