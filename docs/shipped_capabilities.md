# Shipped Capabilities

What exists in code but is not captured in analysis docs or plans. One paragraph per capability: what it does, where it lives, test coverage status. Last updated 2026-06-04.

For the full technical interface (exact signatures, output shapes, gap table), see [engine_interface_manifest.md](engine_interface_manifest.md).

---

## Document Checklist (`evaluateChecklist`)

Determines which documents a household must provide for a SNAP application, given state, household size, and answers to intake questions. Returns `RequiredDocumentItem[]` (each with `label_en`, `label_es`, `helper_en`, `helper_es`, `document_kind`, `alt_kinds`) and `ActiveFlag[]`. The bilingual label/helper fields are first-class outputs — Spanish parity is built in, not bolted on. Rules are authored as JSON (`rules/checklist/{CA,MA}.json`) with a simple condition DSL (`always`, `answer_key`, `household_size_gte`); adding a new state requires a new JSON file only.

**Lives in:** `packages/snap-rules/src/schema.ts` + `rules/checklist/`  
**Tests:** Unit tests in `packages/snap-rules/src/__tests__/schema.test.ts`. No integration test that runs the full CA/MA rules file end-to-end against a real application scenario.

---

## Five QC Flows + Defensibility Scoring (`qcEngine.evaluate`)

The QC engine (`@civica/snap-qc-engine`) evaluates five document/income flows that map to the five highest-weight USDA error elements: `utility-sua`, `shared-lease`, `gig-income`, `assets`, `benefit-impact-projection`. Each flow accepts typed evidence (bank transactions, lease documents, utility accounts, income sources) and returns a `QcResult` with `defensibility_score` (`strong | moderate | weak`), `defensibility_factors[]` (per-factor attribution with `positive | negative | neutral` weight), an `evidence_package` (JSON, flow-specific), `citations[]` (7 CFR + state references), and `warnings[]`. The engine is adapter-free — it never fetches data; callers normalize external API responses into typed inputs.

**Lives in:** `packages/snap-qc-engine/src/flows/` (one directory per flow) + `src/index.ts`  
**Tests:** `packages/snap-qc-engine/src/__tests__/` — unit tests for each flow. Test coverage status: utility-sua and shared-lease have unit + integration tests; gig-income and assets have unit tests only; benefit-impact-projection test coverage is light.

---

## Failure-to-Elect Detector (`detectMissedElections`)

Identifies deductions or elections that a household qualifies for but has not claimed: `homeless_deduction`, `sua_tier_upward`, `actual_utility_election`, `dependent_care_deduction`, `medical_deduction_elderly_disabled`. For each detected election, returns `estimated_monthly_value_usd`, `confidence` (`high | medium | low`), `citation`, and `action_required`. This is the primary input to Component R's Class 1 (missed-election) recommendation candidates and is the most direct dollar-value attribution tool currently in the stack.

**Lives in:** `packages/snap-qc-engine/src/scoring/failure-to-elect.ts`  
**Tests:** Unit tests in `packages/snap-qc-engine/src/__tests__/failure-to-elect.test.ts`. Coverage: all five `MissedElectionKind` values have at least one positive and one negative test case.

---

## Informal Housing Intake Flow

Guides a navigator through 11 branched questions to classify a household's living arrangement into one of eight `InformalArrangementKind` values (`family_rent`, `doubled_up_friends`, `room_rental_no_lease`, `motel_weekly`, `homeless_no_shelter_cost`, `homeless_with_cost`, `utilities_only`, `dv_shelter`). Returns `IntakeValidationResult` (`is_complete`, `arrangement`, `missing_required`, `missing_recommended`). Two lookup tables drive downstream decisions: `DEFENSIBILITY_LOOKUP` (arrangement × evidence → `moderate | weak | discretionary`) and `SHELTER_EFFECT` (arrangement → `homeless_deduction_eligible`, `has_shelter_cost`, `sua_eligible`, navigator note). The flow is used by Stage 1 plausibility check P-08 to gate shelter deduction computation.

**Lives in:** `packages/snap-rules/src/questions.ts` (question bank + `nextUnansweredQuestion`) + `src/types.ts` (lookup tables + validation)  
**Tests:** Unit tests cover `nextUnansweredQuestion` branching and `validateIntake` completeness logic. No test exercises the full 11-question flow for each of the 8 arrangements end-to-end.

---

## Appealability Engine (`evaluateAppealability`)

Given a denial reason code, state, and decision date, determines whether the denial is appealable and why. Four outcomes: `within_window` (appealable; decision is recent), `window_expired` (too late), `category_excluded` (the denial reason is in the state's non-appealable list), `unknown_reason` (nil/missing reason → treated as appealable for applicant protection). State-specific appeal windows and non-appealable categories are authored as JSON (`rules/appealability/{CA,MA}.json`); the schema is validated at load time.

**Lives in:** `packages/snap-rules/src/appealability.ts`  
**Tests:** Unit tests in `packages/snap-rules/src/__tests__/appealability.test.ts`. Coverage: all four `AppealabilityReason` values, both states, boundary cases (day of deadline, day after).

---

## Work Requirements Engine (`evaluateWorkRequirement`)

Evaluates ABAWD work requirements per OBBBA §10102 (age 18–64, effective 2025-07-04) for each household member and returns `isSubject`, `subjectMemberIds`, `exemptionType` (first highest-priority exemption if the household is exempt), `exemptionReason`, `timeLimitApplicable`, and per-gate `citations[]`. Ten exemption categories in priority order: age → CA LPIE (gated by feature flag) → caretaker_under_6 → dependent_6–13 → SSI/SSDA → tribal → disability → pregnancy → qualifying_program → waiver_county. CA waiver counties and MA waiver counties are exported as constant arrays (`CA_WAIVER_COUNTY_FIPS`, `MA_WAIVER_COUNTY_FIPS`).

**Lives in:** `packages/snap-rules/src/work-requirements/evaluate.ts`  
**Tests:** Unit tests in `packages/snap-rules/src/__tests__/work-requirements.test.ts`. Coverage: all 10 exemption types have positive tests; boundary cases for the OBBBA age-band change (age 18 / age 64 / age 65) are tested. The CA LPIE feature-flag path (`lpie_auto_exempt_enabled`) has its own test suite.

---

## Error Risk Scorer (`scoreErrorRisk`) + PER Projection Functions

The error risk scorer takes thin slices of QC results (`flow` + `defensibility_score`) and produces a portfolio-level risk score (0–100), tier (`high | medium | low | incomplete`), and top-3 QC risk factor labels. The same module exports PER projection math: `pillarContribution`, `computeProjectedPER`, `computeEngagementImpliedPER` (and state-parameterized variants), calibrated to USDA FNS FY2024 published error rates for CA (10.98% baseline) and MA (14.10% baseline). `PILLAR_SHARES_UNNORMALIZED` and `PILLAR_MAX_DEFENSIBILITY_SHIFT` are the pre-calibrated USDA priors used by Component R's Class 4 ranking formula.

**Lives in:** `packages/snap-qc-engine/src/scoring/error-risk.ts`  
**Tests:** Unit tests cover scoring formula, tier thresholds, the state-parameterized functions, and the `perPacketGapContribution` helper. The PER projection functions have snapshot tests against the published USDA baseline values.

---

## Retention Risk Scorer (`scoreRetentionRisk`)

Scores a household's risk of churning off SNAP before their next recertification using five weighted signals: earned income level, benefit amount, children in household, prior recertification outcomes (churn/missed), and earnings trajectory. Returns `tier` (`high | medium | low | no-reporting-window`), `score` (0–100), `would_be_type_1_error_if_exits` (still-eligible household at medium+ risk of exiting), and `top_signals[]`. Scores at or above `MEDIUM_TIER_THRESHOLD = 15` with `currently_eligible_per_rules = true` flag the Type 1 error condition.

**Lives in:** `packages/snap-qc-engine/src/scoring/retention-risk.ts`  
**Tests:** Unit tests cover all tier thresholds, the Type 1 error flag, and each signal's directional contribution. Edge cases (null `days_to_next_reporting` → `no-reporting-window`) are tested.
