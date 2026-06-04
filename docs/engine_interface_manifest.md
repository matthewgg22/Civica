# Engine Interface Manifest

**Purpose:** Factual audit of `@civica/snap-rules` (v0.1.0) and `@civica/snap-qc-engine` (v0.3.0) as consumed by Component R.
**Audited:** 2026-06-04. Re-audit if either package increments major version.
**Scope:** Public API only. Internal helpers not re-exported are excluded.

---

## 1. `@civica/snap-rules` — Public Entry Points

Source root: `packages/snap-rules/src/index.ts`

### 1.1 `composeVerdict`

```typescript
// verdict.ts:63
function composeVerdict(facts: Facts, state: string, asOf: Date): VerdictResult
```

The harness-facing entry point. Validates input, walks 10 regulatory gates in the order specified by Python `FederalSNAPRules.determine_eligibility`, returns a structured result. Never throws — malformed input returns a SKIP result with `not_implemented_surfaces`.

**Input — `Facts`** (`facts.ts:10`)

```typescript
interface Facts {
  household: Member[]
  income:    IncomeLine[]
  shelter:   Shelter
  deductions: Deductions
  assets:    number | string          // number = countable dollars;
                                      // "n/a:categorical_no_asset_test" | "n/a:not_authored"
  cat_elig:  string                   // "NPA" | "TANF" | "pure_cash" | "Medicaid" | ...
  expedited?: boolean
  sponsor_income?: number | null
  as_of_date?: string                 // YYYY-MM-DD; overrides asOf param if present
}

interface Member {
  member_id: string
  age: number
  role: string                        // "head" | "child" | "spouse" | ...
  disability?: boolean
  elderly?: boolean
  student?: string                    // "not" | "half_time" | "full_time" | ...
  immigration?: string                // "citizen" | "lpr" | "refugee" | "undocumented" | ...
  five_yr_bar?: string                // "n/a" | "exempt:*" | numeric days string
  sponsored?: boolean
  work_class?: string
  abawd_months_used?: number
  disqual?: string[]                  // ["ipv", "fleeing_felon", "drug_felony", "lottery"]
  living?: string                     // "housed" | "migrant" | "treatment_ctr" (free string)
}

interface IncomeLine {
  member: string                      // member_id
  type: string                        // "wages" | "self_employment" | "farm_se" |
                                      // "wages_contract" | "americorps_vista_counted" |
                                      // "excluded_*" | "vendor_*" | ...
  amount: number
  freq?: string                       // "monthly" | "weekly" | "biweekly" | ...
  anticipation?: string               // "averaged" | "estimated" | "actual"
  source_status?: string              // "ongoing" | "ended" | ...
}

interface Shelter {
  rent: number
  sua_tier: "HCSUA" | "LUA" | "phone" | "none"
  sua_amount?: number                 // Optional SUA override; engine uses state constant if absent
  internet?: number                   // Excluded from shelter calc eff. FY26 (OBBBA §10104)
  homeless_deduction?: boolean        // If true, uses fixed homeless deduction ($198.99 FY26)
}

interface Deductions {
  dependent_care?: number
  medical_unreimbursed?: number
  child_support_paid?: number
}
```

**Output — `VerdictResult`** (`verdict.ts:43`)

```typescript
interface VerdictResult {
  verdict?:                  "APPROVE" | "DENY"      // absent on SKIP
  benefit?:                  number | null            // monthly SNAP benefit ($); null if denied
  reason?:                   string | undefined       // human-readable denial/approval note
  not_implemented_surfaces?: string[]                 // non-empty on SKIP
  trace?:                    VerdictTrace             // non-null on APPROVE/DENY
}

interface VerdictTrace {
  immigration: {
    passes: boolean
    reason?: string
    // eligible members, ineligible member ids — shape varies per gate
    [k: string]: unknown
  }
  disqualifications: {
    passes: boolean
    reason?: string
    [k: string]: unknown
  }
  composition: {
    passes: boolean
    reason?: string
    [k: string]: unknown
  }
  categorical: {
    skip_gross_test: boolean
    skip_asset_test: boolean
    path: string                 // the cat_elig value used
    [k: string]: unknown
  }
  student: {
    passes: boolean
    reason?: string
    [k: string]: unknown
  }
  abawd: {
    passes: boolean
    reason?: string
    [k: string]: unknown
  }
  gross_income_test: {            // ONLY present when gross test was applied (skipped for E/D, cat-elig)
    passes: boolean
    threshold: number             // dollar amount (130%/200% FPL for eligible HH size)
    actual: number                // computed gross_monthly_income
    reason?: string
  }
  asset_test: {
    passes: boolean
    reason?: string
    [k: string]: unknown          // actual asset value NOT currently exposed
  }
  benefit_calc: BenefitCalcDetail  // always present; see §1.2
  net_income_test: {
    passes: boolean
    threshold: number             // 100% FPL for eligible HH size
    actual: number                // net_monthly_income after deduction stack
    reason?: string
  }
}
```

**Gate execution order** (verdict.ts:107–202):
1. Input validation (`validateFacts`) → SKIP on schema error
2. State policy load (`statePolicyFor`) → SKIP on unknown state
3. Immigration eligibility gate
4. Household-level disqualifications (IPV, fleeing felon, drug felony, lottery)
5. Household composition check
6. Categorical eligibility determination (sets `skip_gross_test`, `skip_asset_test`)
7. Student gate (7 CFR 273.5)
8. ABAWD work requirement (7 CFR 273.24)
9. Gross income test (skipped for E/D and cat-elig; 7 CFR 273.9(a)(1))
10. Asset test (waived for BBCE / asset_waiver / cat-elig; 7 CFR 273.8)
11. Benefit calculation (7 CFR 273.10) → `BenefitCalcDetail`
12. Net income test (7 CFR 273.9(a)(2))

---

### 1.2 `computeBenefit`

```typescript
// benefit-calc.ts (called internally by composeVerdict; also re-exported)
function computeBenefit(facts: Facts, state: string, asOf: Date): BenefitCalcDetail
```

Runs ONLY the deduction stack + benefit formula. Does not check eligibility gates. Safe to call with perturbed Facts for counterfactual Δbenefit computation — this is the primary hook for Component R's candidate generation.

**Output — `BenefitCalcDetail`** (benefit-calc.ts, fully populated):

```typescript
interface BenefitCalcDetail {
  gross_monthly_income:              number   // sum of all countable income
  earned_income_deduction:           number   // 20% × earned (7 CFR 273.9(d)(2))
  standard_deduction:                number   // size-banded federal table (FY26: $209–$299)
  dependent_care_deduction:          number   // as provided
  medical_deduction:                 number   // max(0, unreimbursed − $35) for E/D only
  child_support_deduction:           number   // as provided
  excess_shelter_deduction:          number   // max(0, shelter − 0.5 × adj_income); capped if non-E/D
  net_monthly_income:                number   // adj_income − excess_shelter_deduction
  thirty_percent_of_net:             number   // 0.30 × net_monthly_income
  max_allotment_for_household_size:  number   // federal table for eligible HH size
  monthly_benefit:                   number   // round(max_allotment − 30%_net); floor at min_benefit
  trace: {
    homeless_deduction_applied: boolean        // true if shelter.homeless_deduction was used
    shelter_capped:             boolean        // true if excess_shelter hit the cap (non-E/D)
    state_sua_value:            number         // dollar value of SUA tier applied
  }
}
```

**Benefit formula** (7 CFR 273.10):
```
adj_income  = max(0, gross − EID − SD − dep_care − medical − child_support)
shelter_amt = rent + SUA + internet (FY25 only; excluded FY26)
excess_shelter = max(0, shelter_amt − 0.5 × adj_income)
if not E/D: excess_shelter = min(excess_shelter, shelter_cap)
net         = max(0, adj_income − excess_shelter)
benefit     = round(max_allot − 0.30 × net)
if HH ≤ 2 AND 0 < benefit < min_benefit: benefit = min_benefit
```

---

### 1.3 `evaluateChecklist`

```typescript
// schema.ts:208
function evaluateChecklist(input: EvaluateInput): EvaluateOutput
```

**Input:**
```typescript
interface EvaluateInput {
  state_code:     "CA" | "MA"
  household_size: number
  answers:        Record<string, unknown>
}
```

**Output:**
```typescript
interface EvaluateOutput {
  state_code:     "CA" | "MA"
  required_items: RequiredDocumentItem[]  // filtered by condition evaluation
  active_flags:   ActiveFlag[]
}

interface RequiredDocumentItem {
  category:      string
  document_kind: "paystub" | "photo_id" | "lease" | "utility_bill" |
                 "bank_statement" | "tax_return" | "benefit_letter" | "other"
  label_en:      string
  label_es:      string
  helper_en:     string
  helper_es:     string
  is_required:   boolean
  alt_kinds?:    string[]
}
```

The condition DSL (`required_when`) supports: `always`, `answer_key` equality/contains/one_of, `household_size_gte`. No probabilistic weighting — output is a binary required/not-required per item.

---

### 1.4 `evaluateWorkRequirement`

```typescript
// work-requirements/evaluate.ts
function evaluateWorkRequirement(
  input: WorkRequirementInput,
  featureFlags?: { lpie_auto_exempt_enabled?: boolean }
): WorkRequirementResult
```

**Output — `WorkRequirementResult`:**
```typescript
interface WorkRequirementResult {
  isSubject:          boolean
  subjectMemberIds:   string[]
  exemptionType:      ExemptionType | null    // highest-priority exemption if !isSubject
  exemptionReason:    string | null
  timeLimitApplicable: boolean               // equals isSubject
  citations: Array<{ section: string; title: string; url?: string }>
}
```

Exemption priority order: age → CA LPIE → caretaker_under_6 → dependent_6–13 → SSI/SSDA → tribal → disability → pregnancy → qualifying_program → waiver_county.

---

### 1.5 `determineSUATier`

```typescript
// sua.ts:14
function determineSUATier(answers: {
  has_heating_costs:   "yes" | "no" | null | undefined
  has_electric_or_gas: "yes" | "no" | null | undefined
  has_phone:           "yes" | "no" | null | undefined
}): SUATier | null     // null if any answer is missing
```

Returns the highest-qualifying tier: `HCSUA` (heating) → `LUA` (electric/gas) → `phone` → `none`. Returns `null` if any required answer is absent — callers must handle null as "ELICIT".

---

### 1.6 `detectMissedElections` (re-exported from `@civica/snap-qc-engine`)

See §2.6. Re-exported for convenience; source is the QC engine package.

---

### 1.7 `validateFacts`

```typescript
// facts-schema.ts
function validateFacts(facts: unknown): string[] | null
```

Returns `null` on success; returns `["path: message", ...]` on failure. Used by `composeVerdict` internally. Component R can call this to identify which fields are missing/malformed before deciding to ELICIT.

---

### 1.8 `aggregateIncome`

```typescript
// facts.ts:149
function aggregateIncome(facts: Facts): { earned_total: number; unearned_total: number; gross_total: number }
```

Pure helper. Excludes `excluded_*`/`vendor_*` income types. SE income can be negative and offsets unearned. Sponsor income treated as unearned. Component R can call this to compute the pre-deduction gross for plausibility checks without running the full gate stack.

---

### 1.9 Other exported helpers

| Function | Signature summary | Use in Component R |
|---|---|---|
| `getEngineParams` | `(state, asOf) → EngineParams` | Snapshot of federal+state constants; use to display dollar thresholds |
| `evaluateAppealability` | `(reason, state, date, now?) → AppealabilityResult` | Post-denial only; out of Component R scope |
| `checkHEAPCompliance` | `(answers) → { heap_flag, flag_reason }` | Plausibility check for SUA tier |
| `statePolicyFor` | `(state) → StatePolicy` | Exposes BBCE threshold, SUA values, allotment tier |
| `hasElderlyOrDisabled` | `(facts) → boolean` | Gate for medical deduction eligibility check |
| `householdSize` / `eligibleHouseholdSize` | `(facts) → number` | Structural vs. immigration-filtered size |

---

## 2. `@civica/snap-qc-engine` — Public Entry Points

Source root: `packages/snap-qc-engine/src/index.ts`

### 2.1 `qcEngine.evaluate`

```typescript
// index.ts:213
const qcEngine: {
  evaluate: <F extends FlowKind>(
    request: EvaluateRequest<F>,
    options?: { now?: () => string }
  ) => Promise<QcResult>
  version: string
}
```

`FlowKind` = `"utility-sua" | "shared-lease" | "gig-income" | "assets" | "benefit-impact-projection"`

The `async` wrapper is structural — no I/O. Each flow's `build*Package` function is synchronous pure logic.

**Output — `QcResult`** (schemas.ts:319):

```typescript
interface QcResult {
  flow:                  FlowKind
  state:                 "CA" | "MA"
  defensibility_score:   "strong" | "moderate" | "weak"
  defensibility_factors: DefensibilityFactor[]          // attribution detail
  evidence_package:      EvidencePackage                // flow-specific, discriminated by flow
  citations:             Citation[]
  warnings:              Warning[]
  computed_at:           string                         // ISO 8601
  engine_version:        string                         // "0.3.0"
}

interface DefensibilityFactor {
  name:   string
  weight: "positive" | "negative" | "neutral"
  detail: string
}

interface Citation {
  authority:  string
  reference:  string
  url?:       string
}

interface Warning {
  code:     string
  message:  string
  severity: "info" | "warning" | "critical"
}
```

---

### 2.2 `scoreErrorRisk`

```typescript
// scoring/error-risk.ts:69
function scoreErrorRisk(
  results: Array<Pick<QcResult, "flow" | "defensibility_score">>
): ErrorRiskResult
```

**Input:** Thin slices of `QcResult` — only `flow` and `defensibility_score` per evaluated flow.

**Output — `ErrorRiskResult`:**
```typescript
interface ErrorRiskResult {
  tier:            "high" | "medium" | "low" | "incomplete"
  score:           number | null          // 0–100; null if results.length === 0
  factors:         string[]               // top-3 QC risk labels, sorted by USDA error weight desc
  engine_version:  string
}
```

**Mechanics:** Weighted sum of `DEFENSIBILITY_ERROR_PROB[defensibility_score]` × `ERROR_WEIGHT[flow]` across all evaluated flows. Tier thresholds: `high ≥ 60`, `medium ≥ 25`, `low < 25`.

**Constants available to Component R:**
```typescript
ERROR_WEIGHT: Record<FlowKind, number>              // USDA FY2024 error-type shares (sum ≈ 1.0)
//   utility_sua: 0.371, gig_income: 0.265, shared_lease: 0.073,
//   assets: 0.002, benefit_impact: 0.039

PILLAR_SHARES_UNNORMALIZED: Record<CivicaPillar, number>   // alias of ERROR_WEIGHT
PILLAR_MAX_DEFENSIBILITY_SHIFT: Record<CivicaPillar, number>
//   utility_sua: 0.75, gig_income: 0.75, shared_lease: 0.56, assets: 0, benefit_impact: 0.75
```

These are calibrated P-priors for Component R's expected-dollars ranker (§ Gap table entry G-06 explains the missing per-field calibration).

---

### 2.3 `detectMissedElections`

```typescript
// scoring/failure-to-elect.ts:123
function detectMissedElections(profile: HouseholdElectionProfile): MissedElection[]
```

**Input — `HouseholdElectionProfile`** (failure-to-elect.ts:70):

```typescript
interface HouseholdElectionProfile {
  state_code:                     "CA" | "MA"
  housing_situation:              "renting" | "owning" | "homeless" | "shelter" |
                                  "motel" | "couch_surfing" | "transitional_housing" |
                                  "subletting" | "other" | null
  claimed_homeless_deduction:     boolean
  claimed_sua_tier:               "FULL" | "LIMITED" | "TELEPHONE" | "NONE" | null
  claimed_actual_utility_cost_usd: number | null
  claimed_dependent_care_usd:     number | null
  claimed_medical_deduction_usd:  number | null
  has_heating_costs:              boolean | null
  has_electric_or_gas:            boolean | null
  has_phone:                      boolean | null
  documented_monthly_utility_usd: number | null
  household_members: Array<{
    age: number
    is_disabled: boolean
    is_working: boolean
    receives_ssi: boolean
  }>
  monthly_dependent_care_paid_usd: number | null
  monthly_medical_out_of_pocket_usd: number | null
}
```

**Output — `MissedElection[]`** (sorted by confidence desc, then estimated_monthly_value_usd desc):

```typescript
interface MissedElection {
  kind:                      MissedElectionKind
  label:                     string
  reason:                    string
  estimated_monthly_value_usd: number
  confidence:                "high" | "medium" | "low"
  citation:                  string
  action_required:           string
}

type MissedElectionKind =
  | "homeless_deduction"
  | "sua_tier_upward"
  | "actual_utility_election"
  | "dependent_care_deduction"
  | "medical_deduction_elderly_disabled"
```

Detection logic summary:
- **homeless_deduction**: `housing_situation` is "homeless"/"shelter"/"couch_surfing" AND `claimed_homeless_deduction == false`
- **sua_tier_upward**: derived SUA tier (from heating/electric/phone answers) > `claimed_sua_tier`
- **actual_utility_election**: `documented_monthly_utility_usd > CA_HCSUA_FFY26_FULL ($663)` → actual may exceed SUA
- **dependent_care_deduction**: working adult + child under 13 + `monthly_dependent_care_paid_usd > 0` AND `claimed_dependent_care_usd == 0`
- **medical_deduction_elderly_disabled**: E/D member + `monthly_medical_out_of_pocket_usd > $35` AND `claimed_medical_deduction_usd == 0`

This function is Component R's primary source for opportunity recommendations (missed elections → direct benefit increase via `computeBenefit`).

---

### 2.4 `scoreRetentionRisk`

```typescript
// scoring/retention-risk.ts:191
function scoreRetentionRisk(input: RetentionRiskInput): RetentionRiskResult
```

Out of Component R's scope (recertification pillar). Documented for completeness.

---

### 2.5 `classifyTenancy`

```typescript
// flows/shared-lease/classifier.ts:79
function classifyTenancy(input: LeaseClassifierInput): LeaseClassification
```

**Output:**
```typescript
interface LeaseClassification {
  tenancy:            TenancyKind    // primary_tenancy | sublease | shared_tenancy | informal | indeterminate
  confidence:         number         // 0.0–1.0
  action:             ClassifierAction  // auto_flow | navigator_review | informal_housing_intake
  signals:            string[]       // reasons for classification, ordered by contribution
  classifier_version: string
}
```

Relevant to Component R's plausibility checks for shelter: if `action == "informal_housing_intake"`, the shelter deduction is not computable and ELICIT is the correct response.

---

### 2.6 `wilsonInterval`

```typescript
// scoring/wilson.ts:47
function wilsonInterval(errors: number, n: number, z?: number): WilsonInterval
// z defaults to 1.96 (95% CI)
```

Not consumed by Component R directly. Used internally by `buildKpiSnapshot` / `buildErrorRateSnapshot`.

---

## 3. Full Shape of Result Objects

### 3.1 `BenefitCalcDetail` — all fields exposed

All 11 named fields plus trace are always populated (never null/undefined for a APPROVE/DENY result):

| Field | Type | Derivation |
|---|---|---|
| `gross_monthly_income` | number | sum of countable income lines |
| `earned_income_deduction` | number | 20% × earned (7 CFR 273.9(d)(2)) |
| `standard_deduction` | number | size-banded federal table |
| `dependent_care_deduction` | number | as provided in Deductions |
| `medical_deduction` | number | max(0, unreimbursed − $35) for E/D only |
| `child_support_deduction` | number | as provided |
| `excess_shelter_deduction` | number | after 50% rule; capped if non-E/D |
| `net_monthly_income` | number | adj_income − excess_shelter |
| `thirty_percent_of_net` | number | 0.30 × net |
| `max_allotment_for_household_size` | number | eligible HH size table lookup |
| `monthly_benefit` | number | round(max_allot − 30%_net); floored at min_benefit |
| `trace.homeless_deduction_applied` | boolean | |
| `trace.shelter_capped` | boolean | |
| `trace.state_sua_value` | number | SUA contribution used |

**No intermediate values are hidden.** Every dollar used in the benefit formula is in `BenefitCalcDetail`.

### 3.2 Income test gate traces

Both `gross_income_test` and `net_income_test` expose `{ passes, threshold, actual }`:
- `threshold − actual` is the **signed distance-to-threshold** (positive = headroom, negative = over).
- This arithmetic is not pre-computed — callers derive it. See Gap G-04.

### 3.3 What the trace does NOT expose

- Per-gate CFR citation strings (only inline `reason` text; see Gap G-02)
- Which `Facts` fields each gate read (see Gap G-03)
- Asset test actual dollar value (Gate passes/fails but `actual` is not in the trace; see Gap G-04)
- Distance-to-threshold as a pre-computed field (see Gap G-04)

---

## 4. QC Engine: What Risk Scoring Consumes and Emits

### `scoreErrorRisk` feature consumption

| Feature | Source field | Effect |
|---|---|---|
| `flow` | `QcResult.flow` | `ERROR_WEIGHT[flow]` determines USDA error-share weight |
| `defensibility_score` | `QcResult.defensibility_score` | `DEFENSIBILITY_ERROR_PROB[score]` determines P(error) at that tier |

Only these two fields. The full `evidence_package` and `defensibility_factors` are NOT consumed by the risk scorer — they are available to Component R for display.

### `detectMissedElections` feature consumption

All fields of `HouseholdElectionProfile` (§2.3). Key signals that drive the highest-value detections:
- `housing_situation` → homeless deduction (high confidence if "homeless"/"shelter")
- `claimed_sua_tier` vs. derived tier from heating/electric/phone → upward SUA
- `documented_monthly_utility_usd > $663` → actual utility election opportunity
- `household_members[].age < 13` + working adult + `monthly_dependent_care_paid_usd > 0` → dep care
- Any member `age ≥ 60 || is_disabled` + `monthly_medical_out_of_pocket_usd > $35` → medical

### `scoreErrorRisk` emission

See §2.2. The `factors` field names the top-3 QC risk labels from weak flows (e.g., `"shelter_utility_unverified"`, `"earned_income_unverified"`). These map directly to USDA QC error elements and are the closest existing proxy for "which USDA element is the highest-risk field on this packet."

---

## 5. Performance

### `composeVerdict` / `computeBenefit`

Pure synchronous TypeScript. No I/O, no network, no filesystem (after initial state-policy load which is cached). All math is integer/fixed-point arithmetic via the `Decimal` wrapper class (no external big-num library).

Benchmark estimate: each `composeVerdict` call runs ~10 gate checks + a benefit calc, all operating on in-memory objects. Sub-millisecond on any modern JS runtime.

**50 counterfactual `computeBenefit` re-runs per application session: well under 10ms total.** `computeBenefit` alone (no gate checks) will be even faster — micro- to tens-of-microseconds.

50 × `composeVerdict` (full gate stack): ~1–5ms total. Safe in-request for a Cloudflare Worker.

### `qcEngine.evaluate`

`async` wrapper around synchronous flow builders. The `await` yields once per call but does no I/O today. Per-flow evaluation is also sub-millisecond.

### `detectMissedElections`

Synchronous, O(n_household_members) comparisons. Negligible.

---

## 6. Existing Attribution / What-If Capabilities

The following existing capabilities look like sensitivity/attribution hooks that Component R can reuse:

| Capability | Location | What it does |
|---|---|---|
| `computeBenefit` called with perturbed `Facts` | snap-rules | Counterfactual Δbenefit in one call; all intermediate values in result |
| `BenefitCalcDetail` deduction line items | snap-rules | Full deduction attribution — Component R can display exactly which deduction drove the benefit |
| `VerdictTrace.gross_income_test.{threshold,actual}` | snap-rules | Income test headroom/shortfall derivable as `threshold − actual` |
| `VerdictTrace.net_income_test.{threshold,actual}` | snap-rules | Same for net test |
| `detectMissedElections` | snap-qc-engine | Already identifies unclaimed deductions with dollar estimates and confidence |
| `ERROR_WEIGHT` + `PILLAR_MAX_DEFENSIBILITY_SHIFT` | snap-qc-engine | Pre-calibrated USDA priors for ranking perturbations by expected error reduction |
| `PILLAR_SHARES_UNNORMALIZED` | snap-qc-engine | Maps each QC pillar to its share of CA error volume — P-prior for counterfactual ranking |
| `determineSUATier` | snap-rules | Re-run with different heating/utility answers to compute SUA tier delta |
| `checkHEAPCompliance` | snap-rules | Detects HEAP + HCSUA inconsistency (OBBBA §10102 plausibility check) |
| `WorkRequirementResult.citations` | snap-rules | Per-gate CFR citations (exemption reasoning) |
| `QcResult.defensibility_factors` | snap-qc-engine | Per-factor attribution on each flow's defensibility score |
| `MissedElection.estimated_monthly_value_usd` | snap-qc-engine | Dollar impact of missed election already estimated; Component R uses as Δ in ranking |

**The most powerful combination:** `detectMissedElections` → produces candidate + dollar estimate → `computeBenefit(facts_with_election_filled)` → produces exact Δbenefit → rank. No custom math needed for the most common recommendation class.

---

## 7. Gap Table

Outputs Component R needs that the engines **do not currently expose**. Listed in dependency order. Do not implement — reference this table in the spec.

| ID | Gap | Where it is needed | Implementation cost estimate |
|---|---|---|---|
| **G-01** | **ELICIT verdict** — `composeVerdict` returns APPROVE/DENY/SKIP-not-implemented. It has no mode that says "this input is valid but incomplete; here are the missing fields as structured targets." `validateFacts` returns error paths as strings but no structured elicitation schema. | Completeness gate — Component R needs to know which specific `Facts` fields must be affirmatively answered before calling the engine. | Low: add `evaluateCompleteness(partialFacts): { status: "COMPLETE" \| "ELICIT"; missing_paths: string[] }` in snap-rules |
| **G-02** | **Per-gate CFR citation in trace** — `VerdictTrace` has human-readable `reason` strings (e.g., `"gross_income_over_200pct_fpl [7 CFR 273.9(a)(1)]"`), but no machine-readable `citation_id` keyed to the registry. The L4 trace design (snap-rules-matrix.md) has `citation_id` per trace row but it is not in the current TS output. | Component R must cite the CFR basis for every recommendation. Currently must parse reason strings or hardcode citations per gate. | Medium: wire L0 registry IDs into each gate's return value |
| **G-03** | **Predicate inputs per gate** — `VerdictTrace` shows `passes: boolean` and `reason: string` per gate, but does not expose which `Facts` field paths the gate consumed. Component R cannot determine from the trace alone that, e.g., `gross_income_test` consumed `income[0].amount`. | Counterfactual candidate generation — Component R needs to know which field to perturb to affect which gate. | Medium: each gate emits `consumed_fields: string[]` alongside `passes` |
| **G-04** | **Distance-to-threshold as a pre-computed field; asset test `actual` value** — Income tests expose `{ threshold, actual }` but not the signed delta. Asset test exposes `passes` but not the dollar amount tested against the limit. | Ranking by `\|Δbenefit\|` and boundary-proximity flagging for cases near the gross/net income cliff. | Low: add `distance: number` to `IncomeTestResult`; add `actual_assets: number` to asset gate output |
| **G-05** | **Counterfactual delta helper** — No `whatIf(facts, fieldPath, newValue, state, asOf): { benefit_delta, verdict_before, verdict_after }` function. Callers must construct perturbed `Facts` manually (deep clone + dotted-path write) and call `computeBenefit` or `composeVerdict` twice. | Every recommendation in Component R requires two engine calls (original + perturbed). The manual perturb-and-rerun pattern works but is boilerplate-heavy. | Low: thin wrapper; Component R can implement this itself using `computeBenefit` |
| **G-06** | **Per-field epistemic tag** — `Facts` fields carry no `verifiable \| attestable \| immutable` metadata. The distinction is policy knowledge (wages→paystub is verifiable; household age is immutable) not derivable from the type schema alone. | Component R must tag fields to determine what verification steps to recommend and whether perturbation is permissible. | Low: hardcoded manifest in Component R (not engine work) |
| **G-07** | **Structured feasibility context** — `Member.living` is a free string (`"housed"`, `"migrant"`, `"treatment_ctr"`). There is no `FeasibilityContext` type (is_homeless, is_dv_survivor, is_migrant) that Component R can query to suppress infeasible document recommendations. Must be derived heuristically from `shelter.homeless_deduction`, `Member.living`, and informal-housing intake answers. | Feasibility suppression — homeless → no lease doc; DV survivor → no landlord contact. | Low: Component R derives `FeasibilityContext` from existing fields; no engine change needed |
| **G-08** | **USDA error-surface element per gate** — `VerdictTrace` does not emit the USDA QC element code (e.g., `"311_wages"`, `"363_shelter"`) for each fired gate. The profile fixture metadata has `error_surface.element` but that is test harness metadata, not engine output. Component R's P-prior uses `ERROR_WEIGHT[flow]` as a pillar-level proxy but cannot resolve to the per-element priors in `CA_ELEMENT_ATTRIBUTION_FY23`. | Fine-grained P-prior calibration for the ranker — especially relevant when multiple income lines of different types are present. | Medium: gate outputs emit `qc_element: string`; requires mapping work |
| **G-09** | **Income line–to–element mapping** — Given `IncomeLine.type == "wages"`, Component R knows to map to USDA element `311_wages`. But this mapping is not published by the engine; it is embedded as test fixture metadata (`error_surface.element`). | P-prior assignment for income-line perturbations. | Low: hardcode a `INCOME_TYPE_TO_QC_ELEMENT` map in Component R using the 110-profile fixture as the source of truth |
| **G-10** | **Categorical eligibility test helper** — There is no `couldQualifyForCatElig(facts): { cat_elig_path: string, requires: string[] }` function. Determining that a household receiving SSI should have `cat_elig = "pure_cash"` (which skips gross test + asset test) requires policy knowledge not exposed as a query. | Verdict-flip candidate generation — the highest-impact perturbation class (cat-elig flip can change DENY→APPROVE). | Medium: add to snap-rules as a policy query function |

---

*End of manifest. Both packages must be re-audited at next major version bump or any change to `VerdictResult`, `BenefitCalcDetail`, or `QcResult` shapes.*
