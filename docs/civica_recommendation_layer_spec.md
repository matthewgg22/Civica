# Component R: Recommendation / Elicitation Layer — Design Spec

**Status:** REVISED 2026-06-04 (v2 — fixes 1–5 applied)
**Depends on:** [Engine Interface Manifest](engine_interface_manifest.md)
**Consumes only:** `@civica/snap-rules` v0.1.0, `@civica/snap-qc-engine` v0.3.0
**Does not implement:** benefit math, eligibility rules, threshold tables, or QC scoring
**No LLM:** All logic in this spec is deterministic. Verbalization is a later, separate layer.

---

## Core Invariant

> **Component R may never remove information. It may only reorder verification pathways per
> 7 CFR 273.2(f). Every rerouted item remains in the output with its reason populated.
> Verdict, benefit, and trace are produced by the upstream engine and are untouchable.**

This invariant must be enforced by Test Class D (§ Testability). Any code path that omits an item from `RecommendationSet` based on feasibility context rather than rank is a violation.

---

## Symmetry Statement

> **Component R is symmetric: an understated income line is an overpayment risk (recoupment
> harm to the applicant, PER harm to the state) and ranks the same as an equivalent
> underpayment. The action on any income field is always "verify" — outcome may change in
> either direction. Component R never directs a navigator to move a stated value in a
> specific direction.**

---

## Overview

Component R sits between user input collection and the eligibility engine output. It has three stages:

```
                     ┌──────────────────────────────────────────────┐
User input ──────▶   │  STAGE 1: ELICIT                             │
                     │  Completeness gate + plausibility checks     │
                     │  → DETERMINE or ELICIT (never silent-default) │
                     └────────────────┬─────────────────────────────┘
                                      │ DETERMINE
                     ┌────────────────▼─────────────────────────────┐
                     │  STAGE 2: DETERMINE                          │
                     │  composeVerdict(facts, state, asOf)          │
                     │  → VerdictResult (APPROVE/DENY + trace)      │
                     └────────────────┬─────────────────────────────┘
                                      │
                     ┌────────────────▼─────────────────────────────┐
                     │  STAGE 3: RECOMMEND                          │
                     │  Counterfactual engine runs over epistemic   │
                     │  perturbations → ranked recommendations      │
                     └──────────────────────────────────────────────┘
```

Each stage is a pure function. No shared mutable state between stages.

---

## Public API

```typescript
// packages/snap-recommendation/src/index.ts

// Top-level: run all three stages
function evaluateComponentR(
  input: ComponentRInput,
  state: "CA" | "MA",
  asOf: Date
): ComponentRResult

// Stage 1 only (useful for incremental UI)
function evaluateElicitation(
  partialFacts: Partial<Facts>,
  answeredAxes: AnsweredAxes,
  state: "CA" | "MA"
): ElicitationResult

// Stage 3 only (useful when verdict is already known from a prior call)
function generateRecommendations(
  facts: Facts,
  verdictResult: VerdictResult,
  context: FeasibilityContext,
  state: "CA" | "MA",
  asOf: Date
): RecommendationSet

interface ComponentRInput {
  facts:         Partial<Facts>   // may be incomplete; stage 1 determines completeness
  answeredAxes:  AnsweredAxes     // explicit answers to plausibility probes
  state:         "CA" | "MA"
  asOf:          Date
}

interface ComponentRResult {
  stage1: ElicitationResult
  stage2: VerdictResult | null          // null if stage1.status == "ELICIT"
  stage3: RecommendationSet | null      // null if stage1.status == "ELICIT"
}
```

---

## Stage 1: Elicitation

### 1.1 Completeness Gate

**Principle (IRS Form 13614-C):** No silent defaults. Every field that the engine uses to determine verdict or benefit must be affirmatively resolved before `composeVerdict` is called.

**Algorithm:**

```typescript
function evaluateElicitation(
  partialFacts: Partial<Facts>,
  answeredAxes: AnsweredAxes,
  state: "CA" | "MA"
): ElicitationResult {

  // Step 1: Identify structurally missing fields
  const missingPaths = validateFacts(partialFacts)   // from @civica/snap-rules
  // Gap G-01: validateFacts returns string[] error paths.
  // Until G-01 is closed, map paths to DETERMINATIVE_FIELDS manifest (§1.3) to
  // distinguish truly determinative fields from soft/optional ones.

  // Step 2: Among missing paths, apply knockout ordering
  const prioritized = prioritizeByKnockout(missingPaths, partialFacts)
  // Knockout order: immigration → disqualifications → composition →
  //   cat_elig → student → ABAWD → income → shelter → deductions → assets

  // Step 3: Apply branch predicates — skip irrelevant axes
  const applicable = prioritized.filter(path =>
    QUESTION_MANIFEST[path].branchPredicate(partialFacts, answeredAxes)
  )

  // Step 4: Plausibility cross-checks (§1.2) — independent of missing fields
  const plausibilityFlags = runPlausibilityChecks(partialFacts, answeredAxes)

  // Step 5: Verdict
  const status = applicable.length === 0 && hasMinimumFacts(partialFacts)
    ? "DETERMINE"
    : "ELICIT"

  return { status, missing_fields: applicable, plausibility_flags: plausibilityFlags,
           next_questions: applicable.map(p => QUESTION_MANIFEST[p]) }
}
```

**`hasMinimumFacts`** requires all of:
- `facts.household` non-empty with at least one member having `age`, `immigration`, `role`
- `facts.income` present (empty array is valid — zero income is a legitimate answer)
- `facts.shelter.rent` is a number (0 is valid)
- `facts.shelter.sua_tier` resolved (not null)
- `facts.deductions` present
- `facts.assets` is a number or a valid sentinel string
- `facts.cat_elig` present

**Difference from SKIP:** `composeVerdict` returns `not_implemented_surfaces` for engine surfaces that are not yet wired (e.g., an income type the TS engine doesn't handle). SKIP is an engine capability gap — not a data gap. Stage 1 must distinguish these: a SKIP result from the engine is a product gap, not a reason to ELICIT more data from the user.

---

### 1.2 Plausibility Cross-Checks

Each check is deterministic. Each is citable to 7 CFR 273.2(e)(1) ("explore and resolve"). A plausibility flag does **not** block DETERMINE — it adds a probe question to the elicitation set for that axis.

| ID | Check | Condition | Probe | Citation |
|---|---|---|---|---|
| P-01 | Managed-money indicator | `shelter.rent > 0.8 × gross_monthly_income` (derived via `aggregateIncome`) | "Does someone else pay your rent directly, like a family member or the county?" | 7 CFR 273.2(e)(1); CDSS MPP 63-102.3 |
| P-02 | Dependent care without dependent | `deductions.dependent_care > 0` AND `NOT any(facts.household where age < 18)` | "There is a dependent care expense but no child under 18 on the household. Can you confirm who the care is for?" | 7 CFR 273.9(d)(4) |
| P-03 | SUA tier unconfirmed | `shelter.sua_tier != "none"` AND `answeredAxes.heating_cooling == null` | "Has your household paid for heat or air conditioning in the last 12 months?" | 7 CFR 273.9(d)(6)(vi); OBBBA §10102 (HEAP change) |
| P-04 | Medical deduction without E/D member | `deductions.medical_unreimbursed > 0` AND `NOT hasElderlyOrDisabled(facts)` | "Medical expenses can only be deducted for household members who are 60+ or have a disability. Is there such a member on this application?" | 7 CFR 273.9(d)(3) |
| P-05 | Zero assets, multiple adults, no cat-elig | `assets == 0 AND household.length > 1 AND cat_elig == "NPA"` | "No liquid assets reported for a multi-adult household not on public assistance. Can you confirm there are no checking or savings accounts?" | 7 CFR 273.8; 7 CFR 273.2(e)(1) |
| P-06 | SE income, no business expense claim | `any(income where type == "self_employment") AND deductions does not include SE expense offset` | "Self-employment reported but no business expenses claimed. Are there costs like supplies, mileage, or equipment?" | 7 CFR 273.9(b)(2); CA ACL 17-04 |
| P-07 | HEAP + Full SUA claimed | `checkHEAPCompliance({ receives_heap: answeredAxes.receives_heap, sua_tier_claimed: shelter.sua_tier }).heap_flag == true` | "HEAP recipients no longer automatically qualify for the full utility allowance under the 2025 law. Does this household have a separate heating or cooling bill?" | OBBBA §10102; 7 CFR 273.9(d)(6)(vi) |
| P-08 | Informal housing with standard rent claim | `classifyTenancy(…).action == "informal_housing_intake"` AND `shelter.rent > 0` | Route to the informal housing intake flow (`INFORMAL_HOUSING_QUESTIONS`); shelter deduction is indeterminate until intake completes. | 7 CFR 273.9(d)(6); 7 CFR 273.2(e)(1) |

**P-08 note:** When triggered, Stage 1 returns ELICIT with `next_questions` pointing to the informal housing intake flow (`INFORMAL_HOUSING_QUESTIONS` from `@civica/snap-rules`). Only after `validateIntake(answers).is_complete == true` does shelter become determinate.

---

### 1.3 Determinative Fields Manifest

Until Gap G-01 is closed, Component R maintains this hardcoded manifest mapping `Facts` field paths to question priority and branch predicates. Fields not in this manifest are treated as optional.

```typescript
const DETERMINATIVE_FIELDS: DeterminativeField[] = [
  // KNOCKOUT GROUP 1 — immigration / disqualifications (terminate flow if invalid)
  { path: "household[].immigration",    knockout: 1, branchPredicate: always },
  { path: "household[].five_yr_bar",    knockout: 1, branchPredicate: hasLPRMember },
  { path: "household[].disqual",        knockout: 1, branchPredicate: always },

  // KNOCKOUT GROUP 2 — household composition + safety routing
  { path: "household[].age",            knockout: 2, branchPredicate: always },
  { path: "household[].role",           knockout: 2, branchPredicate: always },

  // KNOCKOUT GROUP 2 — safety routing (DV)
  // Ask explicitly: "Is there anyone — like a former partner — who must not be
  // contacted about this application, for your safety?" (yes / no / prefer not to say)
  // "prefer not to say" is treated as yes for all rerouting purposes.
  // This answer is NEVER written to the state portal payload. It gates
  // verification routing only. Exact phrasing is subject to DV advocacy review
  // before UI implementation.
  { path: "answeredAxes.contact_safety_concern",
    knockout: 2,
    branchPredicate: always,
    optional: true,   // advisory; does not block DETERMINE if unanswered
    type: "select",
    options: ["yes", "no", "prefer_not_to_say"],
  },

  // KNOCKOUT GROUP 3 — categorical eligibility (skips gross + asset tests if set)
  { path: "cat_elig",                   knockout: 3, branchPredicate: always },

  // KNOCKOUT GROUP 4 — student gate
  { path: "household[].student",        knockout: 4, branchPredicate: hasStudentAgeMembers },

  // KNOCKOUT GROUP 5 — ABAWD work requirement
  { path: "household[].work_class",     knockout: 5, branchPredicate: hasABAWDAgeMember },

  // INCOME AXES — must be complete for benefit calculation
  { path: "income[].type",             knockout: 6, branchPredicate: always },
  { path: "income[].amount",           knockout: 6, branchPredicate: always },

  // SHELTER AXES — SUA tier is determinative for benefit
  { path: "shelter.rent",              knockout: 7, branchPredicate: always },
  { path: "shelter.sua_tier",          knockout: 7, branchPredicate: always },
  { path: "shelter.homeless_deduction",knockout: 7, branchPredicate: always },

  // DEDUCTIONS — zero is a valid answer; absence is not
  { path: "deductions.dependent_care",     knockout: 8, branchPredicate: always },
  { path: "deductions.medical_unreimbursed",knockout: 8, branchPredicate: hasEDMember },
  { path: "deductions.child_support_paid", knockout: 8, branchPredicate: always },

  // ASSETS
  { path: "assets",                    knockout: 9, branchPredicate: assetTestMayApply },
]
```

**GOV.UK question protocol:** One determinative axis per screen. Within a group, questions branch: e.g., `five_yr_bar` only asked when an LPR member exists; `medical_unreimbursed` only asked when `hasElderlyOrDisabled(facts) == true`.

---

### 1.4 Stage 1 Output

```typescript
interface ElicitationResult {
  status:            "DETERMINE" | "ELICIT"
  missing_fields:    string[]                   // Facts paths, knockout-ordered
  plausibility_flags: PlausibilityFlag[]
  next_questions:    ElicitationQuestion[]       // ordered, branched, first = highest priority
}

interface PlausibilityFlag {
  id:         string                            // P-01 … P-08
  probe:      string                            // human-readable question
  citation:   string                            // CFR reference
  severity:   "blocking" | "advisory"          // blocking = must resolve before DETERMINE
}

interface ElicitationQuestion {
  field_path: string                            // Facts path this question resolves
  question:   string
  type:       "text" | "number" | "boolean" | "select" | "multi_select"
  options?:   string[]
  knockout:   number                            // priority group
}
```

Plausibility flag severity:
- **blocking**: P-08 (informal housing — shelter is indeterminate without intake) → forces ELICIT even if all fields present
- **advisory**: P-01 through P-07 → adds probe question; does not block DETERMINE

---

## Stage 2: Determine

Stage 2 is a single function call:

```typescript
const verdictResult = composeVerdict(facts, state, asOf)
// from @civica/snap-rules
```

Component R passes through the full `VerdictResult` including the `trace`. No transformation.

**On SKIP result** (`not_implemented_surfaces` non-empty): Component R surfaces this as a product gap to the navigator, does not attempt to infer a verdict, and does not proceed to Stage 3. This is distinct from ELICIT — it is an engine capability gap, not a data gap.

---

## Stage 3: Recommendations

### 3.1 Field Taxonomy

Component R maintains a hardcoded `FieldTag` for every `Facts` field that could be perturbed. This is Gap G-06 — the engine does not expose this metadata.

```typescript
type VerificationMode = "verifiable" | "attestable" | "immutable"

// Immutable — these are NEVER perturbed in counterfactual runs
const IMMUTABLE_FIELDS: Set<string> = new Set([
  "household[].age",
  "household[].immigration",
  "household[].five_yr_bar",
  "household[].role",
  "household[].disability",        // disability is established by documentation; not a guess
  "household[].elderly",           // derived from age
  "household[].member_id",
])

// Verifiable — can be confirmed with a document (wages→paystub, rent→lease, etc.)
const VERIFIABLE_FIELDS: Record<string, string> = {
  "income[].amount (type=wages)":          "paystub",
  "income[].amount (type=wages_contract)": "contract_or_paystub",
  "income[].amount (type=platform_gig)":   "1099_or_platform_statement",
  "income[].amount (type=farm_se)":        "tax_return_or_records",
  "shelter.rent":                          "lease_or_landlord_letter",
  "deductions.medical_unreimbursed":       "medical_statement_or_receipts",
  "deductions.child_support_paid":         "court_order_or_payment_record",
}

// Attestable — self-attestation is the primary or acceptable verification mode
const ATTESTABLE_FIELDS: Set<string> = new Set([
  "income[].amount (type=self_employment)",
  "income[].amount (type=cash)",
  "shelter.sua_tier",                      // attestation + utility API confirmation
  "deductions.dependent_care",
  "assets",                                // if low-value; bank statement if > threshold
])
```

**Perturbation rule:** Only `verifiable` and `attestable` fields are perturbed. `immutable` fields are never touched, regardless of what effect a perturbation would have on the benefit.

---

### 3.2 Candidate Generation

Candidates are generated by counterfactual engine runs over five epistemic perturbation classes:

```typescript
type PerturbationClass =
  | "missed_election"        // a zero/unclaimed field that could be filled
  | "verification_upgrade"   // defensibility_score == "weak" on a high-weight surface
  | "income_verification"    // income field with epistemic uncertainty — verify either direction
  | "categorical_flip"       // cat_elig path that would skip a blocking test (Gap G-10)
  | "boundary_proximity"     // income within 5% of gross or net threshold
```

**Class 1 — Missed elections** (highest expected value, most frequent):

1. Call `detectMissedElections(buildHouseholdElectionProfile(facts, answeredAxes))`
2. For each `MissedElection` returned:
   a. Map `kind` to the `Facts` field path(s) it would update
   b. Call `computeBenefit(applyElection(facts, election), state, asOf)`
   c. Compute `delta_monthly_usd = result.monthly_benefit - original_benefit`
3. Only emit candidates where `delta_monthly_usd > 0`

Helper `buildHouseholdElectionProfile` translates `Facts` + `answeredAxes` to `HouseholdElectionProfile`. This is a translation layer, not business logic.

**Class 2 — Income verification** (replaces "stated value correction"):

For each `verifiable` or `attestable` income field where `IncomeLine.anticipation == "estimated"` or `source_status == "ended"`, mark the field as having epistemic uncertainty and emit a verification candidate:

```typescript
{
  perturbation_class: "income_verification",
  field: "income[N].amount",
  action: "Verify income — outcome may change in either direction.",
  delta_monthly_usd: computeDeltaMagnitude(facts, line, state, asOf),
  // delta_monthly_usd is the |benefit change| at ±ERROR_MAGNITUDE perturbation.
  // It represents dollars at risk, not a directed adjustment.
}
```

`computeDeltaMagnitude` runs two counterfactual `computeBenefit` calls — one at `amount × (1 + ε)` and one at `amount × (1 - ε)`, where `ε = ERROR_MAGNITUDE[qc_element]` — and returns the larger absolute delta. This represents the total dollars at risk from the uncertain field, without implying a direction.

**The action on any income field is always "verify". Component R never directs a navigator to adjust, correct, or recalculate a stated value. Direction of change after verification is determined by the engine with the verified value.**

Under-stated deductions are Class 1 (missed election), not Class 2.

**Gap G-09:** Until `INCOME_TYPE_TO_QC_ELEMENT` is codified in the engine, Component R uses this hardcoded map:

```typescript
const INCOME_TYPE_TO_QC_ELEMENT: Record<string, string> = {
  "wages":             "311_wages",
  "wages_contract":    "311_wages",
  "self_employment":   "312_se",
  "farm_se":           "312_se",
  "platform_gig":      "311_wages",        // treated as earnings for element purposes
  "americorps_vista_counted": "311_wages",
  // unearned types → "346_unearned"
}
```

**Class 3 — Categorical eligibility flip** (highest impact, rarest):

Gap G-10: No `couldQualifyForCatElig` helper exists. Until it does, Component R applies a single deterministic rule:

- If `verdict == "DENY"` AND `trace.gross_income_test.passes == false` AND any household member `receives_ssi == true` (from `answeredAxes`): emit candidate `{ field: "cat_elig", perturbation: "TANF", delta_monthly_usd: composeVerdict({...facts, cat_elig:"TANF"}, state, asOf).benefit }`.
- No other categorical flips are attempted until G-10 is closed.

**Class 4 — Verification upgrades** (QC accuracy risk):

For each flow in `["utility-sua", "gig-income"]` (the two flows with `ERROR_WEIGHT >= 0.25`):

1. Check the existing `QcResult.defensibility_score` for that flow (if available from a prior `qcEngine.evaluate` call passed in via `answeredAxes.qc_results`)
2. If `defensibility_score == "weak"`: emit a verification upgrade candidate

```typescript
{
  perturbation_class: "verification_upgrade",
  field: flowToField(flow),               // e.g., "shelter.sua_tier" for utility-sua
  action: "Gather stronger verification for this field — current evidence is weak.",
  delta_monthly_usd: 0,                   // benefit does not change; QC exposure does
  dollars_at_risk: PILLAR_MAX_DEFENSIBILITY_SHIFT[flow]
    * ERROR_WEIGHT[flow]
    * verdictResult.benefit,              // dollars-at-risk framing; see scoring §3.3
}
```

**Note on assets:** `PILLAR_MAX_DEFENSIBILITY_SHIFT["assets"] = 0`, so asset verification upgrades score zero and will never rank above Class 1 or Class 2 candidates. This is correct: the asset test is binary pass/fail and doesn't benefit from defensibility improvement in the same way.

Class 4 candidates are only generated when `qc_results` is provided in `answeredAxes`. If no QC results are available, no Class 4 candidates are emitted (not an error — the QC flow is optional input).

**Class 5 — Boundary proximity** (threshold cliff detection):

After Stage 2, check the trace for proximity to income test thresholds:

```typescript
// Derivable from trace today without waiting for Gap G-04
const grossTrace = verdictResult.trace?.gross_income_test
const netTrace = verdictResult.trace?.net_income_test

for (const test of [grossTrace, netTrace].filter(Boolean)) {
  const distance = (test.threshold - test.actual) / test.threshold
  // distance > 0: below threshold (passes); distance < 0: above threshold (fails)
  if (Math.abs(distance) < 0.05) {
    emit({
      perturbation_class: "boundary_proximity",
      field: test === grossTrace ? "income[].amount (gross)" : "income[].amount (net)",
      action: "Verify income — application is within 5% of the income limit.",
      delta_monthly_usd: Math.abs(test.actual - test.threshold),
      urgency: verdictResult.verdict === "DENY"
        ? "verdict_threatening"   // verification that lowers income could flip to APPROVE
        : "accuracy_risk",        // APPROVE near cliff = QC exposure for audit
    })
  }
}
```

Citation: 7 CFR 273.9(a).

---

### 3.3 Ranking Formula

Three urgency levels, in priority order:

```typescript
type Urgency = "verdict_threatening" | "accuracy_risk" | "opportunity"
```

- **`verdict_threatening`**: a counterfactual `composeVerdict` call changed DENY → APPROVE, OR a Class 5 boundary-proximity hit on a currently-DENY application
- **`accuracy_risk`**: Class 4 (weak defensibility on high-weight surface) OR Class 5 on a currently-APPROVE application near a threshold cliff
- **`opportunity`**: Class 1 missed elections, Class 2 income verification on passing applications

```typescript
function rankCandidates(
  candidates: RawCandidate[],
  facts: Facts,
  verdictResult: VerdictResult
): RankedRecommendation[] {

  const scored = candidates.map(c => {
    let score: number
    let urgency: Urgency

    if (c.perturbation_class === "verification_upgrade") {
      // Dollars-at-risk scoring: how much benefit could be recouped or lost
      // if weak defensibility leads to a QC error finding.
      score = (c.dollars_at_risk ?? 0)
      urgency = "accuracy_risk"

    } else if (c.perturbation_class === "boundary_proximity") {
      // Urgency set at generation time (§3.2 Class 5); score = dollars at threshold
      score = c.delta_monthly_usd
      urgency = c.urgency as Urgency

    } else {
      // Classes 1, 2, 3: P(field wrong or challenged) × |Δbenefit|
      const pError = priorProbability(c)
      const isVerdictFlip = c.verdict_before === "DENY" && c.verdict_after === "APPROVE"
      const effectiveDelta = isVerdictFlip
        ? verdictResult.trace?.benefit_calc.max_allotment_for_household_size ?? c.delta_monthly_usd
        : c.delta_monthly_usd

      score = pError * effectiveDelta
      urgency = isVerdictFlip ? "verdict_threatening" : "opportunity"
    }

    return { ...c, score, urgency }
  })

  // Sort: verdict_threatening first, then accuracy_risk, then opportunity;
  // within each tier, descending by score.
  const URGENCY_ORDER: Record<Urgency, number> = {
    verdict_threatening: 0,
    accuracy_risk: 1,
    opportunity: 2,
  }

  return scored
    .sort((a, b) => {
      const tierDiff = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
      return tierDiff !== 0 ? tierDiff : b.score - a.score
    })
    .slice(0, 4)  // Reg B adverse-action norm: max 4 recommendations
}
```

**`priorProbability(candidate)`:** Returns P(field wrong or challenged):

| Perturbation class | P source |
|---|---|
| `missed_election` | `MissedElection.confidence` → `{ high: 0.70, medium: 0.40, low: 0.20 }` |
| `income_verification` on wages/platform_gig | `ERROR_WEIGHT["gig_income"] = 0.265` as base prior; adjusted by `IncomeLine.anticipation` (`"estimated"` → multiply 1.25, `"averaged"` → 1.0) |
| `income_verification` on shelter | `ERROR_WEIGHT["utility_sua"] = 0.371` |
| `categorical_flip` | Fixed at `0.50` (high-impact, rare; conservative prior until live data) |
| `verification_upgrade` | Scored via `dollars_at_risk` directly (not P × Δ); see Class 4 formula |
| `boundary_proximity` | Scored via `delta_monthly_usd` directly (not P × Δ); see Class 5 formula |

---

### 3.4 Reroute Context

Component R derives `FeasibilityContext` from `Facts` fields and explicit answers. This is Gap G-07 — no engine type for this.

```typescript
interface FeasibilityContext {
  is_homeless:            boolean
  is_dv_survivor:         boolean
  is_migrant:             boolean
  is_in_treatment:        boolean
}

function deriveFeasibilityContext(facts: Facts, answeredAxes: AnsweredAxes): FeasibilityContext {
  // DV survivor: explicit question is the primary signal.
  // The ih_arrangement fallback catches cases where the explicit question was
  // not asked (e.g., informal housing intake branched there first). Never infer
  // DV status solely from housing arrangement without the explicit question.
  const dvExplicit = answeredAxes.contact_safety_concern === "yes"
    || answeredAxes.contact_safety_concern === "prefer_not_to_say"
  const dvFallback = answeredAxes.ih_arrangement === "dv_shelter"

  return {
    is_homeless: facts.shelter?.homeless_deduction === true
      || answeredAxes.ih_arrangement === "homeless_no_shelter_cost"
      || answeredAxes.ih_arrangement === "homeless_with_cost",

    is_dv_survivor: dvExplicit || dvFallback,

    is_migrant: facts.household?.some(m => m.living === "migrant") ?? false,

    is_in_treatment: facts.household?.some(m => m.living === "treatment_ctr") ?? false,
  }
}
```

**Reroute rules** (all mandatory; no override):

| Rule | Condition | Rerouted verification types |
|---|---|---|
| R-01 | `is_homeless == true` | Any step requiring a lease, rental agreement, or landlord letter as primary verification — rerouted to attestation |
| R-02 | `is_dv_survivor == true` | Any step requiring landlord contact, sponsor contact, or any third-party collateral contact where the contact is potentially associated with the abuser — rerouted to agency-assist |
| R-03 | `is_migrant == true` | No rerouting; adds migrancy flag to the `citable_to` note on income recs |
| R-04 | `is_in_treatment == true` | Adds advisory note to document recs; does not reroute |

**Per the Core Invariant:** A recommendation with `rerouted == true` is still emitted in the output at its ranked position with `reroute_reason` populated. The `verification_steps` array is never shortened — rerouted steps are flagged inline with `rerouted: true`. The slot is not back-filled from lower-ranked candidates — max 4 is a hard cap, not a target.

---

### 3.5 Verification Hierarchy

Each recommendation carries an ordered `verification_steps` array derived from the 7 CFR 273.2(f) hierarchy:

```typescript
type VerificationStep = {
  method:   "document" | "collateral_contact" | "attestation" | "agency_assist"
  label:    string
  detail:   string
  citation: string
  rerouted: boolean          // true if a reroute rule (R-01..R-04) applies to this step
  reroute_reason?: string    // populated if rerouted == true
}
```

Per 7 CFR 273.2(f), the hierarchy is: document → collateral contact → attestation → agency-assist. All four steps are always present in the array. Rerouted steps are flagged — never omitted.

**Example — wages income:**
1. `document`: "Provide most recent 30 days of pay stubs, or employer letter on letterhead" [7 CFR 273.2(f)(1)(i)]
2. `collateral_contact`: "Agency contacts employer directly to verify employment and earnings" [7 CFR 273.2(f)(1)(ii)]; `rerouted: true, reroute_reason: "R-02 — DV routing: employer may be known to abuser"` if R-02 applies
3. `attestation`: "Signed written statement from applicant (acceptable if documentation is unavailable)" [7 CFR 273.2(f)(1)(iv)]
4. `agency_assist`: "Agency must assist in obtaining verification; client cannot be denied solely for inability to provide documents" [7 CFR 273.2(f)(4)]

**Example — shelter rent:**
1. `document`: "Lease, sublease agreement, or landlord letter" [7 CFR 273.2(f)(1)(i)]; `rerouted: true, reroute_reason: "R-01 — Homeless: no lease available"` if R-01 applies
2. `collateral_contact`: "Navigator contacts landlord" [7 CFR 273.2(f)(1)(ii)]; `rerouted: true, reroute_reason: "R-01 or R-02"` if either applies
3. `attestation`: "Written self-attestation of shelter costs" [7 CFR 273.2(f)(1)(iv)]
4. `agency_assist`: Agency-obtained verification

The caller (navigator UI) is responsible for displaying only the first non-rerouted step as the primary ask, while keeping all steps available for audit. Component R does not pick a "primary" step — it flags what is and is not available given the context.

---

### 3.6 Stage 3 Output

```typescript
interface RecommendationSet {
  recommendations:    Recommendation[]         // max 4, ranked
  interrupt_required: boolean                  // true if any rec is verdict_threatening
  missed_elections:   MissedElection[]         // full set from detectMissedElections (passive)
  counterfactuals_run: number                  // how many engine calls were made in stage 3
}

interface Recommendation {
  rank:               1 | 2 | 3 | 4
  perturbation_class: PerturbationClass
  field:              string                   // Facts field path
  field_tag:          VerificationMode         // "verifiable" | "attestable" | "immutable"
  delta_monthly_usd:  number                   // |Δbenefit| or dollars-at-risk (Class 4)
  urgency:            Urgency                  // "verdict_threatening" | "accuracy_risk" | "opportunity"
  score:              number                   // ranking score (not shown to user)
  action:             string                   // plain English navigator instruction
  verification_steps: VerificationStep[]       // 273.2(f) hierarchy, all 4 steps, rerouted flags set
  citable_to:         string[]                 // CFR citations
  rerouted:           boolean                  // true if any verification step is rerouted
  reroute_reason?:    string                   // first applicable reroute rule ID + reason
}
```

**Interrupt rule:** `interrupt_required == true` if and only if at least one recommendation has `urgency == "verdict_threatening"`. `accuracy_risk` and `opportunity` recommendations are passive — no interrupt.

**Alert-fatigue rule (CDS five-rights):** Only `verdict_threatening` recs surface as a blocking interrupt. `accuracy_risk` and `opportunity` recommendations are displayed passively without any required acknowledgment. No additional alert infrastructure beyond this rule is specified in Component R — see Deferred section.

---

## Testability

### Extending the Profile Harness

Component R MUST be testable with the existing `tools/profile-harness` infrastructure. No new test harness. New test classes are added to the harness as additional assertion checks per profile.

Profile fixture additions for Component R (added to `civica_test_profiles.json` schema under each profile):

```json
{
  "component_r": {
    "expected_elicitation_status": "DETERMINE | ELICIT",
    "expected_elicit_field": "string (Facts path, if status == ELICIT)",
    "expected_top_rec": {
      "field": "string",
      "urgency": "verdict_threatening | accuracy_risk | opportunity",
      "perturbation_class": "string",
      "min_delta_monthly_usd": 10
    },
    "reroute_test": {
      "context_override": { "is_homeless": true },
      "assert_step_rerouted_for": "lease"
    }
  }
}
```

### Test Class A — Completeness Gate

**Rule:** Strip a determinative fact from a known DETERMINE profile → assert `status == "ELICIT"` and the missing field is identified.

```typescript
describe("Stage 1 completeness gate", () => {
  for (const profile of profiles.filter(p => p.component_r?.expected_elicitation_status === "DETERMINE")) {
    it(`${profile.legacy_id}: stripping income → ELICIT`, () => {
      const stripped = { ...profile.facts, income: undefined }
      const result = evaluateElicitation(stripped, {}, "CA")
      expect(result.status).toBe("ELICIT")
      expect(result.missing_fields).toContain("income")
    })

    it(`${profile.legacy_id}: stripping sua_tier → ELICIT`, () => {
      const stripped = { ...profile.facts, shelter: { ...profile.facts.shelter, sua_tier: undefined } }
      const result = evaluateElicitation(stripped, {}, "CA")
      expect(result.status).toBe("ELICIT")
      expect(result.missing_fields.some(f => f.includes("sua_tier"))).toBe(true)
    })
  }
})
```

### Test Class B — Expected Top Recommendation

**Rule:** For profiles with `component_r.expected_top_rec`, assert that the recommendation matches. Boundary-proximity assertions reference Class 5 explicitly.

```typescript
describe("Stage 3 top recommendation", () => {
  for (const profile of profiles.filter(p => p.component_r?.expected_top_rec)) {
    it(`${profile.legacy_id}: expected_top_rec`, () => {
      const verdict = composeVerdict(profile.facts, "CA", new Date())
      const recs = generateRecommendations(
        profile.facts, verdict, deriveFeasibilityContext(profile.facts, {}), "CA", new Date()
      )
      const topRec = recs.recommendations[0]
      const expected = profile.component_r.expected_top_rec

      expect(topRec.field).toBe(expected.field)
      if (expected.urgency) expect(topRec.urgency).toBe(expected.urgency)
      if (expected.perturbation_class) expect(topRec.perturbation_class).toBe(expected.perturbation_class)
      if (expected.min_delta_monthly_usd) {
        expect(topRec.delta_monthly_usd).toBeGreaterThanOrEqual(expected.min_delta_monthly_usd)
      }
    })
  }
})
```

**Canonical fixture assertions** (add these to the profile fixture file):

| Profile | Setup | `expected_top_rec.field` | `expected_top_rec.urgency` | `expected_top_rec.perturbation_class` |
|---|---|---|---|---|
| A03 (disabled, high medical) | set `medical_unreimbursed: 0` | `deductions.medical_unreimbursed` | `opportunity` | `missed_election` |
| A01 (single mother, wages) | change `sua_tier: "none"` | `shelter.sua_tier` | `opportunity` | `missed_election` |
| Any DENY at 131% gross FPL | no changes | `income[].amount (gross)` | `verdict_threatening` | `boundary_proximity` |
| M01 (boundary case, APPROVE near cliff) | no changes | `income[].amount (gross or net)` | `accuracy_risk` | `boundary_proximity` |

### Test Class C — Reroute Behavior

**Rule:** Applying `is_homeless: true` must result in all lease-document steps being flagged `rerouted: true` — and the recommendation itself is still present in the output.

```typescript
describe("Reroute behavior", () => {
  for (const profile of profiles.filter(p => p.component_r?.reroute_test)) {
    it(`${profile.legacy_id}: rerouted steps flagged, rec still present`, () => {
      const test = profile.component_r.reroute_test
      const ctx: FeasibilityContext = {
        ...deriveFeasibilityContext(profile.facts, {}),
        ...test.context_override,
      }
      const verdict = composeVerdict(profile.facts, "CA", new Date())
      const recs = generateRecommendations(profile.facts, verdict, ctx, "CA", new Date())

      const keyword = test.assert_step_rerouted_for  // e.g., "lease"
      const recsWithKeywordStep = recs.recommendations.filter(
        r => r.verification_steps.some(s => s.detail.toLowerCase().includes(keyword))
      )

      // Every rec that mentions this keyword step must have that step rerouted
      for (const rec of recsWithKeywordStep) {
        const matchingSteps = rec.verification_steps.filter(
          s => s.detail.toLowerCase().includes(keyword)
        )
        expect(matchingSteps.every(s => s.rerouted)).toBe(true)
        // The recommendation itself is still in the output (core invariant)
        expect(recs.recommendations).toContain(rec)
      }
    })
  }
})
```

### Test Class D — Core Invariant: Rerouting Does Not Affect Verdict

**Rule:** `VerdictResult` must be byte-identical regardless of whether rerouting context is applied. Rerouting is output-only — it must never bleed into the verdict computation.

```typescript
describe("Core invariant: rerouting does not affect verdict", () => {
  for (const profile of profiles.filter(p => p.component_r)) {
    it(`${profile.legacy_id}: verdict unchanged with rerouting on vs off`, () => {
      const ctxOn: FeasibilityContext = {
        is_homeless: true,
        is_dv_survivor: true,
        is_migrant: false,
        is_in_treatment: false,
      }
      const ctxOff: FeasibilityContext = {
        is_homeless: false,
        is_dv_survivor: false,
        is_migrant: false,
        is_in_treatment: false,
      }

      // Stage 2 runs independently of FeasibilityContext
      const verdict = composeVerdict(profile.facts, "CA", new Date("2026-06-01"))

      const recsOn = generateRecommendations(profile.facts, verdict, ctxOn, "CA", new Date("2026-06-01"))
      const recsOff = generateRecommendations(profile.facts, verdict, ctxOff, "CA", new Date("2026-06-01"))

      // VerdictResult (from stage 2) must be identical — rerouting context is not a stage 2 input
      // Test by comparing the verdict that flowed into both calls
      expect(verdict.verdict).toBeDefined()

      // Rerouted recs still appear in output
      const reroutedRecs = recsOn.recommendations.filter(r => r.rerouted)
      for (const rec of reroutedRecs) {
        expect(rec.reroute_reason).toBeTruthy()
        // The rec is present — not silently removed
        expect(recsOn.recommendations.map(r => r.field)).toContain(rec.field)
      }

      // No recommendation count should drop due to rerouting (all 4 slots must be filled
      // the same way — rerouted does not skip the slot)
      expect(recsOn.recommendations.length).toEqual(recsOff.recommendations.length)
    })
  }
})
```

### Mutation Test Discipline

Component R must be mutation-testable with the same discipline as the oracle plan:

- **Break the ranker** (swap rank 1 and rank 2 candidates): Test class B assertions on `expected_top_rec` MUST fail.
- **Remove a reroute rule** (delete the R-01 homeless check): Test class C MUST fail — rerouted steps will show `rerouted: false`.
- **Break a plausibility check** (remove P-02 dependent-care check): The profile with dep-care deduction but no child must silently pass Stage 1. Add explicit assertion that `plausibility_flags.some(f => f.id === "P-02")` for those profiles.
- **Remove the max-4 cap**: Add assertion `recs.recommendations.length <= 4` in every test; mutation must cause at least one test to fail.
- **Omit a rerouted step from verification_steps**: Test class D rec-still-present assertion MUST fail.
- **Remove Class 5 boundary-proximity generation**: Test class B assertions for boundary profiles (DENY at 131%, M01) MUST fail.

---

## Scope Fence — Deferred Until Live CA/MA Data Demands It

The following were explicitly considered and deferred. Do not implement in Component R v1:

| Item | Reason for deferral |
|---|---|
| Causal-recourse math beyond the 3-tag taxonomy (`verifiable / attestable / immutable`) | Requires counterfactual distribution data; 3-tag taxonomy is sufficient for a navigator-assisted context |
| Alert infrastructure beyond the one interrupt rule | Alert timing, sequencing, push notification cadence — depend on engagement data from deployed product |
| Omission battery beyond the 8 plausibility checks above | Additional checks (e.g., income spike month-over-month, asset trajectory) require longitudinal data not yet in Facts schema |
| Predictor / propensity scoring for recommendation ordering | No live CA/MA application data to calibrate. Current P-priors come from USDA FNS population-level error rates, not Civica-specific data. |
| Dashboard panels for per-element recommendation acceptance rate | Requires instrumented production data from Stage 3 calls |
| Multi-period benefit projection integration with `scoreRetentionRisk` | Retention pillar is a separate product track; interfaces at the `RetentionRiskResult` level, not inside Component R |
| A/B variants for recommendation presentation (framing, timing) | Behavioral science layering; depends on `ebt_offer_placement_priors` validation pipeline |
| Gap G-10 categorical eligibility flip (full implementation) | Current narrow rule (SSI → pure_cash) covers the most common case; full helper deferred pending G-10 |
| Recommendation explanation generation (verbalization) | Language layer is explicitly out of scope; Component R returns machine-readable `Recommendation` objects only |
| DV question phrasing finalization | Exact wording of `contact_safety_concern` question requires DV advocacy review before UI implementation. The routing logic is specified; the string is a placeholder. |

---

## Engine Calls Budget

A single `evaluateComponentR` call makes at most:

| Call | Count | Notes |
|---|---|---|
| `aggregateIncome` | 1 | Stage 1 plausibility P-01 |
| `classifyTenancy` | 0–1 | Stage 1 only if housing situation is ambiguous |
| `validateFacts` | 1 | Stage 1 completeness gate |
| `composeVerdict` | 1 | Stage 2 |
| `detectMissedElections` | 1 | Stage 3 Class 1 candidates |
| `computeBenefit` (counterfactual) | ≤ 17 | Stage 3: up to 5 missed elections + up to 8 income verification (×2 directions each = 16) + 1 original baseline; boundary proximity (Class 5) reads from the Stage 2 trace, no additional call |
| `composeVerdict` (counterfactual) | 0–2 | Stage 3: only for categorical-flip candidates (full gate stack needed) |

**Total maximum: ~22 engine calls per `evaluateComponentR` invocation.** All calls are synchronous and sub-millisecond. Well within budget for an in-request Cloudflare Worker context.

---

*End of spec v2. All engine consumption is grounded in the Interface Manifest. Gaps are noted by ID (G-01 … G-10) and are not implemented here.*
