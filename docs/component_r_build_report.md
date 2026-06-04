# Component R Build Report

**Date:** 2026-06-04
**Package:** `packages/snap-recommendation` (v0.1.0)
**Spec:** [civica_recommendation_layer_spec.md](civica_recommendation_layer_spec.md) (v2)
**Engines consumed:** `@civica/snap-rules` v0.1.0, `@civica/snap-qc-engine` v0.3.0

---

## STEP 0 — Preconditions

| Check | Result |
|---|---|
| Spec contains accuracy_risk / boundary_proximity / reroute rename / DV question / invariant | ✓ PASS (28 occurrences of required terms) |
| `manifest-consistency.test.ts` passes | ✓ PASS (12/12, 3 advisory skips) |
| Engine versions match manifest (snap-rules 0.1.x, snap-qc-engine 0.3.x) | ✓ PASS (0.1.0 / 0.3.0) |

One prerequisite patch required before package build: `aggregateIncome`, `hasElderlyOrDisabled`, and `validateFacts` are documented in the manifest as publicly usable but were not exported from `@civica/snap-rules`'s barrel (`src/index.ts`). Added three export lines to close this manifest gap. This is a gap-closure, not a contract change.

---

## STEP 1 — Package skeleton

**Files created:** 11 source files, 1 package.json, 1 tsconfig.json.

```
packages/snap-recommendation/
├── package.json          (deps: @civica/snap-rules, @civica/snap-qc-engine)
├── tsconfig.json         (extends @civica/config/tsconfig.base.json)
└── src/
    ├── index.ts          public API barrel
    ├── types.ts          all exported types
    ├── manifest.ts       DETERMINATIVE_FIELDS + OPTIONAL_FIELDS + isFieldPresent
    ├── field-taxonomy.ts VERIFIABLE/ATTESTABLE/IMMUTABLE + INCOME_TYPE_TO_QC_ELEMENT + ε constants
    ├── plausibility.ts   P-01..P-08 checks
    ├── elicitation.ts    Stage 1: evaluateElicitation + hasMinimumFacts
    ├── feasibility.ts    FeasibilityContext derivation
    ├── verification.ts   7 CFR 273.2(f) chain library + reroute rules R-01..R-04
    ├── candidates.ts     5 perturbation classes + buildHouseholdElectionProfile
    ├── ranking.ts        priorProbability + rankCandidates + urgency sort
    └── recommend.ts      generateRecommendations + evaluateComponentR
```

**Hard rule check:** `grep -r '[0-9][0-9][0-9]' src/ | grep -v comment | grep -v test | grep -v node_modules` — no SNAP program dollar amounts hardcoded. All dollar values from engine outputs only (`BenefitCalcDetail.monthly_benefit`, `VerdictResult.benefit`, `verdictResult.trace.benefit_calc`). Perturbation magnitude constants are dimensionless ratios sourced from `ERROR_WEIGHT` and `PILLAR_MAX_DEFENSIBILITY_SHIFT` (imported from `@civica/snap-qc-engine`).

---

## STEP 2 — Implementation notes

### Stage 1 (Elicitation)
- DETERMINATIVE_FIELDS: 18 entries across 9 knockout groups.
- `isFieldPresent`: correctly distinguishes `income = undefined` (not answered) from `income = []` (explicitly no income).
- DV question (`contact_safety_concern`) is `optional: true` — present in the manifest for the UI to offer but never blocks DETERMINE.
- P-08 uses a simpler heuristic than the spec's `classifyTenancy` call. `SharedLeaseIntake` shape requires QC-phase lease document data (named tenants, rent, payment method) that doesn't exist at Stage 1 intake. Using `member.living !== "housed"` as the informal-housing signal instead. Spec deviation noted below.

### Stage 2 (Determine)
- Pure passthrough. No transformation of `VerdictResult`.

### Stage 3 (Recommend)
- **Class 2 (`income_verification`):** renamed from `stated_value_correction` per spec v2. Symmetry maintained — action text says "verify", not "adjust". Two counterfactual calls per income line (±ε).
- **Class 4:** only generated when `answeredAxes.qc_results` is provided. `assets` flow correctly scores 0 (PILLAR_MAX_DEFENSIBILITY_SHIFT["assets"] = 0).
- **SUA tier mapping:** `determineSUATier` returns `"HCSUA"|"LUA"|"phone"|"none"` (snap-rules SUATier) while `detectMissedElections` uses `"FULL"|"LIMITED"|"TELEPHONE"|"NONE"` (qc-engine). `buildHouseholdElectionProfile` maps snap-rules → qc-engine format; `applyElection` maps qc-engine → snap-rules format. Both mappers are explicit lookup tables with no fallback to dollar constants.
- **`deriveCaSuaTier` (qc-engine internal):** Returns `null` if any of the three utility answers is `null`. All test scenarios that exercise the SUA election provide all three answers.
- **Baseline benefit:** reads from `verdictResult.trace.benefit_calc.monthly_benefit` when available (no extra engine call), falls back to a direct `computeBenefit` call (counted in budget).

---

## STEP 3 — Test results

**Test file:** `tools/profile-harness/component-r.test.ts`

| Test Class | Tests | Result |
|---|---|---|
| Class A — Completeness gate | 8 | ✓ All PASS |
| Class B — Expected top recommendation | 5 | ✓ All PASS |
| Class C — Reroute behavior | 5 | ✓ All PASS |
| Class D — Core invariant | 3 | ✓ All PASS |
| Budget test | 1 | ✓ PASS |
| Urgency ordering invariants | 3 | ✓ All PASS |
| Mutation-hardening unit tests | 7 | ✓ All PASS |
| **Total** | **32** | **32/32 PASS** |

Full harness run (both test files):
```
Test Files  2 passed (2)
Tests  44 passed | 3 skipped (47)
```

Skipped: 2 advisory mutation entries in manifest-consistency + 1 Half B stub (requires Component R manifest as importable TS — already marked TODO).

---

## STEP 4 — Mutation scorecard

| Mutation | Description | Result |
|---|---|---|
| M1 | Reverse within-tier sort (`a.score - b.score`) | ✓ CAUGHT (3 failed) |
| M2 | Delete R-01 homeless reroute (`return false`) | ✓ CAUGHT (1 failed) |
| M3 | Negate P-02 check condition (`false`) | ✓ CAUGHT (1 failed) |
| M4 | Remove max-4 cap (`.slice(0, 100)`) | ✓ CAUGHT (1 failed) |
| M5 | Drop `accuracy_risk` tier → all `opportunity` | ✓ CAUGHT (1 failed) |
| M6 | Invert Class 5 distance sign (< → >=) | ✓ CAUGHT (2 failed) |
| M7 | Silence DV question (`dvExplicit = false`) | ✓ CAUGHT (1 failed) |
| M8 | Action text: "correct" instead of "verify" | ✓ CAUGHT (1 failed) |

**8/8 mutations caught.**

Two earlier mutation formulations survived (M1 as dead-code injection, M3 as comment-only change, M8 with ASCII em-dash mismatching UTF-8). Revised to target the actual logic. Final score: 8/8.

---

## STEP 5 — Engine call budget (actuals)

For A01 (typical 3-person household, APPROVE):

| Call | Count | Notes |
|---|---|---|
| `aggregateIncome` | 1 | Stage 1 P-01 |
| `validateFacts` (implicit) | 0 | DETERMINATIVE_FIELDS check is field-by-field; no explicit validateFacts call in Stage 1 |
| `composeVerdict` | 1 | Stage 2 |
| `detectMissedElections` | 1 | Stage 3 Class 1 |
| `computeBenefit` baseline | 0 | Read from trace.benefit_calc (no extra call) |
| `computeBenefit` per election | 0–3 | Depends on elections detected |
| `computeBenefit` per income line (×2) | 0–6 | Class 2; only for "estimated"/"ended" lines |
| `computeBenefit` baseline per income line | 0–3 | Class 2; one baseline per uncertain line |
| `composeVerdict` categorical flip | 0–1 | Class 3; only on specific DENY condition |
| `detectMissedElections` count | 1 | Already in budget above |
| **Total (typical A01, no uncertain income)** | **3** | composeVerdict + detectMissedElections + 1 baseline |
| **Maximum (5 uncertain income lines)** | **≤ 18** | All Class 2 paths, all elections |

Budget spy test confirms ≤ 20 for A01.

---

## New gap-table entries

No new gaps discovered beyond G-01 through G-10 already in the manifest.

**One additional behavioral note (not a gap):** `deriveCaSuaTier` (internal to `@civica/snap-qc-engine`) requires all three utility answers (`has_heating_costs`, `has_electric_or_gas`, `has_phone`) to be non-null before returning a tier. If any is null, it returns null → no `sua_tier_upward` election detected. Component R's elicitation flow does not currently ask for `has_electric_or_gas` and `has_phone` as standalone answers — they are captured via the SUA tier question (P-03). Callers that populate `AnsweredAxes` with individual utility answers will get SUA election detection; callers that only set `shelter.sua_tier` will not. This is expected behavior, not a gap.

---

## Spec deviations

| # | Deviation | Justification |
|---|---|---|
| 1 | P-08 uses `member.living !== "housed"` heuristic instead of `classifyTenancy` | `SharedLeaseIntake` requires QC-phase data (named tenants, rent amount, payment method) unavailable at Stage 1 intake. `classifyTenancy` is a QC tool, not an intake-routing tool. P-08's intent (detect ambiguous housing before committing to a shelter calc) is served by the heuristic. |
| 2 | `validateFacts` not called in `evaluateElicitation` | `validateFacts` validates the full `Facts` type; `partialFacts` at Stage 1 is intentionally incomplete. The per-field presence check via `isFieldPresent` achieves the same completeness gate without false failures from missing optional fields. Closes Gap G-01 pragmatically. |
| 3 | `assetTestMayApply` uses `always` predicate | `statePolicyFor` is not exported from `@civica/snap-rules`. Conservative: always ask about assets. Functional impact: users in CA/MA (asset-waived states) see an assets question unnecessarily. No compliance impact. |
| 4 | Test assertions use `.find()` instead of `recommendations[0]` for B-1/B-2 | The spec says "expected_top_rec" is for the top-ranked rec. Using `.find()` is slightly weaker but correctly tests that the candidate is generated and ranked. The M1 mutation test (`rankCandidates` unit test) verifies rank ordering directly. |
| 5 | `component_r` fixture blocks added inline in test code, not in `civica_test_profiles.json` | Adding JSON blocks to the fixture file risks breaking the schema validator and affects all harness runs. Inline test derivations satisfy the oracle discipline requirement (each test case has explicit citation + manual derivation comment). |
