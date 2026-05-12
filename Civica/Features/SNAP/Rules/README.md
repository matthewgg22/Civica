# SNAP State Rules Engine — `Civica/Features/SNAP/Rules/`

Policy-as-code Swift implementation of SNAP eligibility per 7 CFR 273
plus state-specific divergence. Companion to the authoritative Python
engine at `backend/civic_api/snap/rules/` — same method names, same
shapes, same threshold tables. Swift runs the offline directional
verdict and acts as a cross-check oracle once the Python service is
wired in over HTTP.

## Architecture

```
            ┌─────────────────────────────────────┐
            │   SNAPLocalEligibilityEvaluator     │
            │   (single public evaluate(_:today:))│
            └──────────────┬──────────────────────┘
                           │
                           ▼
            ┌─────────────────────────────────────┐
            │   SNAPRulesRegistry.rules(for:)     │
            │   stateCode → SNAPStateRuleEngine   │
            └──────────────┬──────────────────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
     ┌──────────────────┐    ┌──────────────────┐
     │  MAStateRules    │    │ FederalDefault   │
     │  (BBCE 200% FPL  │    │ Rules (130% FPL  │
     │   + MA SUA chart │    │  baseline; 49    │
     │   + DTA student  │    │  states + DC use │
     │   exemptions)    │    │  this fallback)  │
     └──────────────────┘    └──────────────────┘
                           │
                           ▼
            ┌─────────────────────────────────────┐
            │  SNAPBenefitCalculator              │
            │  (7 CFR 273 deduction stack →       │
            │   SNAPBenefitCalculationDetail)     │
            └─────────────────────────────────────┘
```

Each `SNAPStateRuleEngine` conformer exposes:
- Income thresholds (gross 130% FPL or BBCE-expanded, net 100% FPL)
- Deduction tables (standard, shelter cap, earned-income rate)
- Max allotment + minimum benefit (FNS COLA memo, by household size)
- Asset limits
- Student exemption logic (7 CFR 273.5 + state-specific exemptions)
- Expedited service criteria (7 CFR 273.2(i))
- ABAWD age band and waiver lookup (7 CFR 273.24)
- Standard Utility Allowance values per tier
- Categorical eligibility outcome (7 CFR 273.2(j) — TANF/SSI/GA + BBCE)
- A stable `rulesVersion` stamp for audit footers

## How to add a new state

1. **Create `<STATE>StateRules.swift`** in this folder. Conform to
   `SNAPStateRuleEngine`. Compose a `FederalDefaultRules` instance
   for methods the state doesn't override.

   ```swift
   struct CAStateRules: SNAPStateRuleEngine {
       let stateCode = "CA"
       let displayName = "California (CalFresh)"
       private let federal = FederalDefaultRules()
       // Override only what diverges from federal.
   }
   ```

2. **Add the state to `SNAPRulesRegistry`** — one line:
   ```swift
   case "CA": return CAStateRules()
   ```

3. **Encode threshold tables as `PolicySnapshot<T>` arrays** with
   ISO date windows. FY26 today, FY27 lands as an additional
   snapshot — never edit a snapshot whose `effectiveEnd` has
   passed.

4. **Add the test file** at `Civica Tests/<STATE>StateRulesTests.swift`.
   Mirror the structure of `MAStateRulesTests`. Table-driven
   tests for thresholds; explicit tests for state-specific
   overrides (BBCE / student exemptions / SUA chart).

5. **Cite sources** in the file header — state policy handbook
   section numbers, FNS COLA memo URL, effective dates. The audit
   trail matters for compliance review.

## Temporal versioning

Every threshold lookup threads an `asOf: Date` parameter. Each
state's `PolicySnapshot<T>` array contains one entry per fiscal
year:

```swift
static let bbce200Snapshots: [PolicySnapshot<[Decimal]>] = [
    .iso(from: "2025-10-01", to: "2026-09-30",
         versionSuffix: "FY26", value: [...]),
    // FY27 row lands here when FNS publishes August 2026.
]
```

`PolicySnapshot.contains(_:)` picks the active row for the given
date. When `asOf` falls outside any window, the engine falls back
to the most recent snapshot rather than crashing — verdicts keep
rendering with a stale-but-legible version stamp. Tighten this
behavior to fail-loudly before any production determinations
based on future dates.

## Source of truth

The Python rules engine at `backend/civic_api/snap/rules/` is the
authoritative implementation. Swift mirrors:

| Python | Swift |
|---|---|
| `FederalSNAPRules` (federal.py) | `FederalDefaultRules.swift` |
| `MassachusettsSNAPRules` (states/massachusetts.py) | `MAStateRules.swift` |
| `poverty_guidelines.py` constants | private `PolicySnapshot` arrays |
| `_compute_net_income` | `SNAPBenefitCalculator.calculate` |
| `interfaces.py` `SUATier` | `SUATier` enum in `SNAPStateRuleEngine.swift` |
| `interfaces.py` `StudentExemption` | `StudentExemption` + `ExemptionReason` |
| `interfaces.py` `BenefitCalculationDetail` | `SNAPBenefitCalculationDetail` |

When the two diverge, **Python wins**. Swift is the offline mirror,
not the system of record.

## Known data accuracy gaps

These are blockers for production trust; flagged so each next PR
can close one cleanly:

| Gap | Current state | Resolution |
|---|---|---|
| FY26 numbers are FY25 numbers | All `PolicySnapshot` arrays stamp `FY26` but contain values copied from `poverty_guidelines.py` FY25 tables | Load FY26 from the FNS COLA memo (August 2025 publication) |
| FY27 not encoded | No FY27 snapshot rows | Add when FNS publishes (August 2026) |
| ABAWD waiver feed missing | Both conformers return `nil` from `abawdWaiverActive` | Load FNS quarterly waiver list, keyed by FIPS code per month |
| TANF/SSI/GA receipt question missing from flow | `SNAPHouseholdAnswers.receivesTANF/SSI/GA` exist as fields, no screens populate them | Add a screen to `SNAPHouseholdQuestionFlow` |
| Earned vs unearned income split missing from flow | `SNAPIncomeAnswers.monthlyEarnedAmount` field exists, calculator falls back to `anyoneEarning == .no` heuristic | Add a screen asking exact wages amount |
| SUA tier election missing from flow | Calculator defaults to `.heatingCooling` when reported utilities > 0; user can't elect `.nonHeating` or `.phoneOnly` | Add a question with the three options + "use my actual costs" |
| Property taxes + homeowners insurance not collected | Calculator assumes $0 | Add fields to `SNAPExpensesAnswers` |
| Child support paid not collected | Calculator assumes $0 | Add a question |
| Liquid resources not collected | Asset test waived under MA BBCE; not yet relevant federally because the directional verdict doesn't run the asset test | Add when expanding beyond MA |
| Per-member household model | Today: single applicant + household-size bucket | Refactor to `[HouseholdMember]` when adding states with mixed-status / per-member ABAWD logic |

## Testing

Test target: `CivicaTests` (wired in commit `42c3094f`). Test files
under `Civica Tests/`:

- `MAStateRulesTests.swift` — BBCE table values + rules-version stamp
- `FederalDefaultRulesTests.swift` — 130%/100% FPL math, standard
  deduction, shelter cap, ABAWD age band, student gate truth table,
  asset limits, max allotment table, SUA-returns-nil
- `SNAPRulesRegistryTests.swift` — stateCode dispatch
- `SNAPLocalEligibilityEvaluatorTests.swift` — end-to-end verdict
  regression net
- `SNAPBenefitCalculatorTests.swift` — deduction-stack math
  end-to-end with explicit expected values per field

Run via ⌘U in Xcode on the Civica scheme. (CLI `xcodebuild test`
currently hits a Pseudo Terminal Setup Error specific to this
environment's iOS 26.4 SDK / iOS 18.2 simulator pairing; build-for-
testing passes cleanly. See commit `42c3094f` for diagnostic.)

## Roadmap

Tracked in priority order as separate engagements:

1. Question-flow expansion — earned-income split, SUA tier
   election, child support, TANF/SSI receipt. Highest accuracy
   uplift per hour of work.
2. FY26 number verification + FY27 snapshot prep. Gated on FNS
   COLA memo source material.
3. ABAWD waiver feed integration. Gated on FNS waiver list
   ingestion.
4. State conformers for CA, NY, TX, FL, IL (top 5 by SNAP
   population). Each gated on state policy handbook access.
5. Per-member household refactor for mixed-status accuracy.
6. Backend HTTP integration — call Python rules engine as
   authoritative path, Swift becomes offline fallback + oracle.
7. Audit log persistence for procurement diligence.
8. Policy drift agent — scheduled job ingesting USDA/FNS/state
   memos, summarizing diffs with an LLM, filing PRs against this
   folder.

## Compliance checkpoint

Before any state's rules ship to real users in production:

- [ ] Authoritative source documents (state policy handbook
  section numbers, FNS memo URLs) cited in the state conformer's
  file header
- [ ] Numerical thresholds verified against the source by a
  policy reviewer, not the implementer
- [ ] FY-stamped snapshot dates match the source's effective range
- [ ] Test cases derived from worked examples in the source
  document
- [ ] Independent legal review of the state's rules logic
- [ ] User-facing strings (ineligibility reasons, audit footer)
  reviewed for accessibility and accuracy
