# SNAP eligibility engine (iOS) — internal test plan (MA pilot, 2026-06)

**Scope:** the JSON-driven state eligibility engine in
`Civica/Features/SNAP/Rules/`, with CA + MA profiles, as of branch
`claude/snap-engine-ma-pilot-2026-06-02` (commit `91bf7c97`).

**Goal:** verify the iOS app correctly produces eligibility verdicts for CA
and MA applicants using the new JSON-driven rule layer, and that the
launch-state flag correctly flips behavior between states.

## Status going in

- iOS test target `CivicaTests` reports **84/84 passed** for the four
  targeted suites: `JsonDrivenStateRulesTests`, `LaunchStateConfigTests`,
  `MAStateRulesTests`, `SNAPAgencyDirectoryTests`.
- Full iOS test suite NOT run in this verification — known 6 SUA/shelter
  failures from [#375](https://github.com/matthewgg22/Civica/issues/375)
  are pre-existing and tracked separately; out of scope here.
- iOS simulator: iPhone 16 Pro, iOS 26.5 (matches CI baseline).

## What this plan tests

1. CA launch (default behavior) — verdicts match CA rules profile.
2. MA pilot toggle — `LaunchStateConfig` flip changes verdicts + agency copy.
3. RMP (Restaurant Meals Program) — operates in CA, NOT in MA.
4. BBCE gross-income test — CA uses FFY threshold; MA uses calendar-year.
5. SUA tiers — CA: $663/$170/$20; MA: $914/$556/$64.
6. ABAWD verdict graceful-nil — both states return nil until waivers load.
7. Agency directory copy — phone area codes + agency name flip with state.

## What this plan does NOT test

- Full SNAP application happy path (separate end-to-end QA).
- Federal-default behavior for hypothetical 3rd state (covered by unit tests).
- The SUA/shelter deduction math (issue [#375](https://github.com/matthewgg22/Civica/issues/375) — pre-existing).
- Backend submission to BenefitsCal or DTA.

## Setup

```sh
git switch claude/snap-engine-ma-pilot-2026-06-02
xcodebuild -project Civica.xcodeproj -scheme Civica \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=26.5' \
  CODE_SIGNING_ALLOWED=NO ENABLE_USER_SCRIPT_SANDBOXING=NO \
  build
# Open the simulator and launch the Civica build manually,
# OR run the targeted test suites only:
xcodebuild test -project Civica.xcodeproj -scheme Civica \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=26.5' \
  -only-testing:CivicaTests/JsonDrivenStateRulesTests \
  -only-testing:CivicaTests/LaunchStateConfigTests \
  -only-testing:CivicaTests/MAStateRulesTests \
  -only-testing:CivicaTests/SNAPAgencyDirectoryTests \
  CODE_SIGNING_ALLOWED=NO ENABLE_USER_SCRIPT_SANDBOXING=NO
```

Expect: `Test run with 84 tests in 4 suites passed`.

## Test scenarios

### Scenario 1 — default CA launch

**Pre-condition:** clear UserDefaults / fresh install. No `LaunchStateConfig` override.

**Action:** launch app, complete onboarding, reach SNAP eligibility check.

**Expected:**
- Agency copy reads "CalFresh" / "CDSS" branding.
- BBCE threshold applied: 200% FPL on **federal fiscal year** basis.
- SUA tiers: heating $663, non-heating $170, phone $20.
- RMP (Restaurant Meals Program) returns `.eligible` for unhoused or elderly/disabled applicants.
- ABAWD verdict returns `nil` (not yet loaded; safe).

### Scenario 2 — flip to MA via launch-state config

**Pre-condition:** scenario 1 baseline confirmed.

**Action (one of):**
- Run unit test `LaunchStateConfigTests.flipsToMA` to set the cache, then relaunch app.
- Or: developer menu → set `launchStateCode` UserDefault to `"MA"` → kill and relaunch.

**Expected:**
- Agency copy reads "DTA" / "SNAP" branding (Massachusetts DTA).
- BBCE threshold applied: 200% FPL on **calendar year** basis (per DTA 106 CMR 364.976).
- SUA tiers: heating $914, non-heating $556, phone $64.
- **RMP returns `.notOperated` for ALL applicants** — MA does not operate the program. Verified by 4 unit tests in `MAStateRulesTests.swift`.
- ABAWD verdict returns `nil`.
- Phone area codes: `(617)`, `(413)`, `(508)`, `(781)`, `(978)` (Greater Boston + Western MA).

### Scenario 3 — RMP CA vs MA divergence (the load-bearing state difference)

**Pre-condition:** CA + MA each set up.

**Action:** evaluate `restaurantMealsProgramEligibility(for: draft, asOf:)` with these drafts:

| Draft | CA expected | MA expected |
|---|---|---|
| `unhoused, alone` | `.eligible` | `.notOperated` |
| `stableHome, elderlyOrDisabled` | `.eligible` | `.notOperated` |
| `stableHome, no flags` | `.notEligible` | `.notOperated` |
| empty draft | `.unknown` (incomplete) | `.notOperated` (deterministic) |

**Expected:** Every "yes" in CA collapses to `.notOperated` in MA. This pins
the JSON-profile `rmp.operated: false` flag — a future PR that flips it would
fail these tests.

### Scenario 4 — BBCE date-window edge cases

**Pre-condition:** MA pilot active.

**Action:** evaluate gross-income test at calendar-year boundary dates:

- 2025-12-31, 2026-01-01, 2026-01-15: each should use the calendar-year FPL
  threshold appropriate for that date.

**Expected:** MA uses calendar-year FPL (`bbce.fpl_basis: "calendar_year"`),
CA uses federal-fiscal-year FPL (`bbce.fpl_basis: "federal_fiscal_year"`).
Verified by edge-case unit tests added in `MAStateRulesTests.swift`.

### Scenario 5 — graceful ABAWD handling

**Pre-condition:** either CA or MA active. JSON profile has `abawd.waivers_loaded: false`.

**Action:** evaluate ABAWD verdict for any applicant.

**Expected:**
- Engine returns `nil` (no verdict).
- App should surface "rules may be stale" notice rather than guess.
- Verified by `JsonDrivenStateRulesTests` — bundle loads cleanly, profile's
  `waivers_loaded: false` cascades to nil verdict.

### Scenario 6 — agency directory copy

**Action:** in the app, navigate to any screen using `SNAPAgencyDirectory`
(approval banner, denial card, find-help, etc.).

**Expected:**
- Copy correctly attributes to CalFresh/CDSS for CA, SNAP/DTA for MA.
- `SNAPAgencyDirectory.launchStateCode` is now a computed property reading
  `LaunchStateConfig.current`, NOT a hardcoded string — re-read on every access.
- Flipping the launch state via UserDefaults updates copy without code change.

### Scenario 7 — federal-default fallback (hypothetical 3rd state)

**Action:** set `LaunchStateConfig` to an unsupported state code (e.g. `"NY"`).

**Expected:**
- `LaunchStateConfig.current` falls back to `"CA"` (verified by
  `LaunchStateConfigTests.unsupportedStateFallsBackToCA`).
- App does NOT crash.
- Bundle load of a missing JSON profile would `fatalError` — this is
  intentional ("fail loudly at app start, not silently mid-session"). Only
  triggers if a state code lacks both a JSON profile and CA fallback —
  not reachable through normal config paths.

## Known gaps and expected behaviors

| Gap | Expected during test | Tracking |
|---|---|---|
| ABAWD waivers not loaded | All ABAWD verdicts nil | Pending FNS area-waiver list publication |
| Post-OBBBA ABAWD criteria (post-July 2025) | Engine uses pre-OBBBA logic conservatively | Pending FNS guidance |
| 6 SUA/shelter deduction tests failing | Out of scope here | [#375](https://github.com/matthewgg22/Civica/issues/375) |
| Python FastAPI eligibility engine | Not consumed; client-side iOS is authoritative for now | Future server-of-record decision |

## Pass criteria

- All 84 tests in the 4 targeted suites pass.
- Scenarios 1–7 above produce the expected behaviors when exercised by hand
  in the simulator.
- No crash on launch-state flip or on edge-case drafts.
- The new JSON-driven layer is observable in the UI (agency copy, RMP
  behavior, BBCE threshold differences).

## After test

If all scenarios pass, the eligibility engine is **green for internal use**
under both CA (default) and MA (pilot toggle). The next gating step for
shipping MA to real users is partnership wiring (Project Bread named ED
commitment per memory) and the operator chain
([#428](https://github.com/matthewgg22/Civica/issues/428),
[#429](https://github.com/matthewgg22/Civica/issues/429),
wrangler deploy) — none of which requires further engine changes.
