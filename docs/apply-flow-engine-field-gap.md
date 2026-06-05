# Apply-flow → engine field gap

**Purpose:** the exact fields the apply flow must collect to unlock each engine result on the CBO surfaces. Written for the income/expense/form-tree work. Surfaced by `/plan-devex-review` (engine integration) + the #504 finding.

**The one-line problem:** the engines all work; the apply flow under-collects. Real packets store only 6 coarse answers, which is enough for a benefit **estimate** but not a **verdict** or **recommendations**. Each row below names a field, its engine target, and which result it unlocks.

## What's collected today (`packet_answers.question_key`)
`household_size` · `employment_status` · `monthly_income` · `monthly_rent` · `has_children` · `has_disability` · (rare) `housing_situation`, `monthly_utilities`

The adapter (`apps/dashboard/lib/engines/facts-adapter.ts`) maps these → a partial `Facts`, fills the rest with documented assumptions, and runs `computeBenefit` for the estimate. Everything below is what removes an assumption and turns it into real output.

## What each result needs

### Result A — Estimated amount ✅ (works today)
Needs only `household_size` + `monthly_income` + `monthly_rent` (+ `monthly_utilities` for SUA accuracy). Already collected. No new fields required.

### Result B — Eligibility verdict (APPROVE/DENY) ⬜
`composeVerdict` runs ten gates; these are the inputs not collected today. Tier-1 = blocks the verdict entirely; Tier-2 = sharpens an otherwise-defaulted gate.

| Priority | New field (proposed key) | Type | Engine target (`Facts`) | Gate it unlocks |
|---|---|---|---|---|
| **T1** | household **roster** (per-member, not just a count) | array | `household[]` | composition, and every per-member gate below |
| **T1** | `member_{i}_age` | int | `household[i].age` | student, ABAWD, elderly/medical |
| **T1** | `member_{i}_citizenship` | enum (citizen/lpr/refugee/other) | `household[i].immigration` | immigration gate (today assumed "citizen") |
| **T1** | `liquid_assets_usd` | number | `assets` | asset test (today assumed 0) |
| **T1** | `receives_cash_aid` | enum (none/TANF/SSI/Medicaid) | `cat_elig` | categorical eligibility (skips gross + asset tests — high impact) |
| **T2** | `member_{i}_lpr_years` | int | `household[i].five_yr_bar` | immigration 5-year-bar (LPR members only) |
| **T2** | `member_{i}_student` | enum (not/half/full) | `household[i].student` | student gate (members 18–49) |
| **T2** | `member_{i}_work_status` | enum | `household[i].work_class` | ABAWD work requirement (have coarse `employment_status` only) |
| **T2** | `has_heating_cooling` / `has_electric_gas` / `has_phone` | bool×3 | `shelter.sua_tier` (via `determineSUATier`) | correct SUA tier (today inferred from rare `monthly_utilities`) |
| **T2** | `child_support_paid_usd` | number | `deductions.child_support_paid` | net-income deduction |
| **T3** | `member_{i}_disqualifications` | multi (ipv/drug_felony/fleeing_felon/lottery) | `household[i].disqual` | disqualification gate (rare) |

Minimum to flip the verdict from "pending" to real for the common case: **the household roster (age + citizenship per member) + `liquid_assets_usd` + `receives_cash_aid`.** Those four close the immigration, composition, asset, and categorical gates that today run on assumptions.

### Result C — Recommendations (Component R) ⬜
These map to `evaluateComponentR`'s `answeredAxes`. None are collected, so the "Ways to raise it" block is wired but dormant (renders nothing). Each field lights up a specific recommendation class.

| Priority | New field (proposed key) | Type | `answeredAxes` field | Recommendation it unlocks |
|---|---|---|---|---|
| **T1** | `has_heating_cooling` / `has_electric_gas` / `has_phone` | bool×3 | `heating_cooling` / `has_electric_or_gas` / `has_phone` | **SUA-tier upgrade** (claim a higher utility allowance) |
| **T1** | `monthly_medical_oop_usd` | number | `monthly_medical_out_of_pocket_usd` | **medical deduction** (elderly/disabled — pairs with `has_disability` + age) |
| **T1** | `monthly_dependent_care_usd` | number | `monthly_dependent_care_paid_usd` | **dependent-care deduction** (pairs with a child under 13 + a working adult) |
| **T2** | `documented_utility_usd` | number | `documented_monthly_utility_usd` | **actual-utility election** (when real costs exceed the SUA) |
| **T2** | `receives_ssi` | bool | `receives_ssi` | **categorical-eligibility flip** (SSI → skips income test) |
| **T3** | `contact_safety_concern` | enum (yes/no/prefer-not) | `contact_safety_concern` | **DV-safe verification routing** (suppresses landlord/employer contact) |

Note: the SUA utility booleans appear in **both** B and C — collecting them once unlocks both a more accurate verdict and the SUA-upgrade recommendation. Best single ROI.

## Sequencing recommendation
1. **Household roster** (count → per-member age + citizenship). Biggest unlock — gates the whole verdict.
2. **`liquid_assets_usd` + `receives_cash_aid`** — two scalar questions, close the asset + categorical gates.
3. **Three SUA utility booleans** — one screen, unlocks SUA accuracy (verdict) *and* the SUA-upgrade rec.
4. **`monthly_medical_oop_usd` + `monthly_dependent_care_usd`** — light up the two highest-value deduction recommendations.

After (1)–(2), `composeVerdict` produces a real verdict and the packet-detail card flips from estimate-only to estimate + verdict. After (3)–(4), the "Ways to raise it" recommendations populate.

## Where to wire each, once collected
- **Adapter:** `apps/dashboard/lib/engines/facts-adapter.ts` — `packetAnswersToFacts` (new `Facts` fields) and `assessPacket` (build the `answeredAxes` object from the new keys). Remove the corresponding `assumptions` / `confirmForVerdict` entries as each field starts arriving.
- **No engine changes** — `snap-rules` and `snap-recommendation` already accept all of this. This is purely an apply-flow collection + adapter-mapping task.

## References
- Adapter + finding: #504. Surfaces: #505 (eligibility panel), #506 (recommendations).
- `Facts` shape: `packages/snap-rules/src/facts.ts`. `answeredAxes`: `packages/snap-recommendation/src/types.ts`.
