# Recertification Companion — Engineering Notes

These are the recon findings and architectural decisions captured before the
module was built. Read this before extending or modifying anything inside
`Civica/Features/RecertificationCompanion/`.

The companion module composes four features:

1. **Phantom Recert** — 60-day shadow run of the recert flow (no submission)
2. **Expiration Prediction Calendar** — forecast of which documents go stale before next recert
3. **Just-in-Time Reminders** — push notifications + in-app prompts on optimal upload dates
4. **AI-Drafted Procedural Appeal** — pre-filled fair-hearing request for procedural denials

It targets a 25–35% relative reduction in recert failure rate at pilot.

---

## Stack snapshot

| Concern | What this project uses |
|---|---|
| UI | SwiftUI on iOS 17+ (some surfaces opt into iOS 26 APIs via availability gates) |
| State | `ObservableObject` + `@Published`, `@MainActor` on view models. No `@Observable`, no SwiftData, no Core Data. |
| Persistence | UserDefaults for state (JSON-encoded), FileManager for blobs. |
| Navigation | `NavigationStack` + `NavigationLink` + state-driven `navigationDestination(isPresented:)`. No coordinator pattern. |
| Design system | `CivicaDesignSystem` Swift Package — `CivicaColors`, `CivicaSpacing`, `CivicaTypography`, `CivicaRadius`, `CivicaPrimaryButton`/`CivicaSecondaryButton` (56pt tall, 3pt radius). |
| Localization | `CivicaText(en:, es:)` struct in per-feature `…Strings.swift` enums. EN + ES at parity. **Not** `.xcstrings`. |
| Analytics | Per-feature `…Analytics` enum mirroring `SNAPAnalytics`. Firebase under `#if canImport(FirebaseAnalytics)`. Allowlisted param keys only. |
| OCR | Vision `VNRecognizeTextRequest` → Foundation Models `LanguageModelSession` with `@Generable` structs (iOS 26+ with Apple Intelligence). Falls back to nothing — caller must check `SNAPOnDeviceExtractor.isAvailable`. |
| Notifications | Nothing existed before this module. Interview Coach has a static timeline; there was no `UNUserNotificationCenter` use anywhere in the codebase. We built `RecertNotificationService` from scratch. |
| Tests | None for the Civica target before this module. Only VoteNow had XCTest tests at `WeVote Information PageTests/`. This module ships test source files under `CivicaTests/` (see "Test target wiring" below). |
| Feature flags | Compile-time `#if SNAP_DEV` (the only existing pattern). For this module we added a runtime `AppStorage`-backed flag to support progressive rollout — see "Feature flag" below. |

---

## Existing components reused (do not duplicate)

| Component | Where | How we reuse it |
|---|---|---|
| `SNAPBenefitEstimatorView` / `SNAPBenefitEstimatorCalculator` | `Civica/Features/SNAP/Estimator/` | Phantom Recert Summary calls `SNAPBenefitEstimatorCalculator.calculate(...)` on the phantom draft inputs to show "your fresh estimate." No fork. |
| `SNAPCapturedDocumentStore` | `Civica/Features/SNAP/Documents/` | Read-only access via new `SNAPDocumentVaultReader` sibling. No edits to the store itself. |
| `SNAPDocumentType` enum | `Civica/Features/SNAP/SNAPModels.swift` | Direct reuse — keys document-rules.json + reminder identifiers. |
| `SNAPOnDeviceExtractor` | `Civica/Features/SNAP/Documents/` | Denial-letter parser composes its OCR pipeline + a new `OnDeviceDenialLetterFields` `@Generable` struct. |
| `SNAPApplicationFlowOrchestratorViewModel` | `Civica/Features/SNAP/Application/` | Extended with a `.phantom(section:)` `Mode` case (additive). |
| `SNAPApplicationDraftStore` | `Civica/Features/SNAP/Application/` | Extended with `load(key:)` / `save(_:key:)` / `clear(key:)` accepting a storage key. Default behavior unchanged. |
| `SNAPApplicationStatusStore` | `Civica/Features/SNAP/Application/` | Read-only consumer for `.recertDue` status + approval milestone timestamp. |
| `CivicaText` / language toggle | `Civica/Resources/CivicaLanguage.swift` | All new strings are `CivicaText` instances in `RecertCompanionStrings.swift`. |

---

## Architectural decisions

### Confirmed with product owner before coding
1. **Recert date source**: Computed as `approval-milestone timestamp + 12 months` (federal/MA/CA standard 12-month cycle) and **user-editable** via an "Edit date" sheet. Persisted under `co.civica.recert.nextDate` in UserDefaults.
2. **Phantom Recert composition**: Extended the existing `SNAPApplicationFlowOrchestratorViewModel` with a new `.phantom(section:)` `Mode` case. Draft storage is dual-keyed:
   - `co.civica.applicationDraft.live` — the real, submission-bound draft (unchanged behavior)
   - `co.civica.applicationDraft.phantom` — the shadow draft for the dry run
3. **Test target**: A new `CivicaTests` test target was added. The source files live under `CivicaTests/RecertificationCompanion/`. **The Xcode project file (`Civica.xcodeproj/project.pbxproj`) needs the new target added via the Xcode UI** — see "Test target wiring" below.

### Decided unilaterally
4. **Module location**: `Civica/Features/RecertificationCompanion/`. Matches sibling features (`Civica/Features/SNAP/`).
5. **Feature flag**: Runtime `@AppStorage("co.civica.recertCompanion.enabled")` bool wrapped in `RecertCompanionFeatureFlag.isEnabled`, default `false`. Why runtime rather than the existing `#if SNAP_DEV` pattern: the user explicitly asked for "ship dark and enable progressively" — compile-time gating means cutting a new build to flip the flag, which kills progressive rollout. The runtime flag still defaults off in production until explicitly toggled (no UI for users to toggle; engineering-only via debug menu or direct UserDefaults write during the pilot).
6. **Persistence**: UserDefaults (JSON-encoded) for state, FileManager for any blobs. Matches SNAP exactly.
7. **Vault read access**: New `SNAPDocumentVaultReader` static enum exposes `hasDocument(_:)`, `loadImage(_:)`, `captureDate(_:)`, and `allCaptured() -> [(SNAPDocumentType, Date)]`. The reader is a sibling of `SNAPCapturedDocumentStore`, not a replacement. It reads the same FileManager files; no caching, no shared mutable state.
8. **Notification service**: `RecertNotificationService` uses `UNUserNotificationCenter` + `UNCalendarNotificationTrigger`. Permission is requested behind a soft pre-prompt (explain, then ask). Notification identifiers follow `co.civica.recert.{documentType}.{actionType}` so reconciliation can find + replace them deterministically.
9. **Localization**: `RecertCompanionStrings.swift` containing `CivicaText` instances. EN + ES at full parity.
10. **Analytics**: `RecertCompanionAnalytics` enum mirroring `SNAPAnalytics`. Allowlisted param keys: `["step_name", "step_index", "document_type", "state_code"]`. **No PII or eligibility answers in events** — same privacy boundary as SNAP.
11. **OCR fallback for denial letters**: On iOS 26+ with Apple Intelligence available, `SNAPOnDeviceExtractor` is extended with a new `@Generable` struct for denial-letter fields. On older devices: `DenialLetterManualEntryView` lets the user enter denial code, denial date, and the state-issued reason by hand. The appeal generator must (and does) work end-to-end without OCR.
12. **Appeal templates**: Templated function with conditional sections — **not** a free LLM call. The failure-to-cooperate vs refusal-to-cooperate distinction per 7 CFR 273.2 is a conditional in the template, not a code branch. This avoids invented claims and keeps appeals consistent.
13. **Multi-draft draft store**: `SNAPApplicationDraftStore` now has keyed methods. The previous single-draft API still works (it just routes through the default key).

---

## Where things live

```
Civica/Features/RecertificationCompanion/
  RecertCompanionRoot.swift                  // home/dashboard screen
  RecertCompanionFlowView.swift              // NavigationStack wrapper
  RecertCompanionFeatureFlag.swift           // AppStorage flag
  RecertCompanionAnalytics.swift             // Firebase shim
  RecertCompanionStrings.swift               // CivicaText bundle

  RecertSchedule/
    RecertScheduleStore.swift                // recert-date persistence + edit
    RecertScheduleEditView.swift             // edit sheet

  ExpirationCalendar/
    DocumentExpirationRules.swift            // Decodable rules loader
    DocumentExpirationPredictor.swift        // pure date math, tested
    DocumentExpirationForecast.swift         // output struct
    ExpirationCalendarView.swift             // timeline UI
    ExpirationCalendarViewModel.swift        // @Published forecast
    Fixtures/document-rules.json             // MA + CA only

  Reminders/
    RecertNotificationService.swift          // schedule / cancel / pending
    RecertNotificationPermissionView.swift   // soft pre-prompt
    DocumentReminderScheduler.swift          // forecast → notifications
    InAppReminderPromptView.swift            // in-app prompt card

  PhantomRecert/
    PhantomRecertEntryView.swift             // entry CTA
    PhantomRecertFlowView.swift              // orchestrator host (.phantom)
    PhantomRecertSummaryView.swift           // estimate + diff + checklist
    PhantomChangeDetector.swift              // live vs phantom diff
    PhantomPrepChecklist.swift               // checklist builder

  Appeal/
    DenialReason.swift                       // enum
    DenialLetterParser.swift                 // OCR pipeline (iOS 26+)
    DenialLetterManualEntryView.swift        // fallback for older devices
    AppealTemplateLoader.swift               // JSON fixture loader
    AppealRenderer.swift                     // pure template renderer
    AppealReviewView.swift                   // review / edit screen
    AppealExportService.swift                // PDF / mail / state portal
    Fixtures/AppealTemplates/
      MA.en.json, MA.es.json, CA.en.json, CA.es.json
```

Shared additions outside the module:

- `Civica/Features/SNAP/Documents/SNAPDocumentVaultReader.swift` (new — read-only)
- `Civica/Features/SNAP/Application/SNAPApplicationFlowOrchestrator.swift` (modified — added `.phantom` `Mode`)
- `Civica/Features/SNAP/Application/SNAPApplicationDraftStore.swift` (modified — added keyed API)
- `Civica/App/CivicaSNAPFlowView.swift` (modified — added `phantomMode: Bool = false` init param)
- `Civica/App/CivicaEntryView.swift` (modified — added Recert Companion tile under the feature flag)
- `Civica/App/CivicaRootView.swift` (modified — routes `.recertDue` to companion when flag is on)
- `CivicaTests/RecertificationCompanion/...` (new test files)

---

## Test target wiring (one-time Xcode-side step)

The plan called for a `CivicaTests` test target. The test **source** files
ship in this commit at `CivicaTests/RecertificationCompanion/`. Hand-editing
`Civica.xcodeproj/project.pbxproj` to add a new target is brittle (it
corrupts the project file in subtle ways that don't surface until a future
Xcode version refuses to open it). Instead, the one-time wiring step is:

1. Open `Civica.xcodeproj` in Xcode.
2. **File → New → Target… → iOS → Unit Testing Bundle**.
3. Name: `CivicaTests`. Target to be tested: `Civica`. Language: Swift.
4. Drag the existing `CivicaTests/` folder into the new target (uncheck
   "Copy items if needed" — the files are already in place).
5. Verify by running `⌘U` on the `Civica` scheme.

This is a sub-five-minute click-through and the source files were authored
to compile under the standard XCTest defaults. Until that step is taken,
the test files exist on disk but don't run as part of CI.

---

## Open TODOs (deferred to next iterations)

### State coverage (must do before launching in any new state)
- [ ] **Document expiration rules** — `Civica/Features/RecertificationCompanion/ExpirationCalendar/Fixtures/document-rules.json` covers only MA and CA. Other states require their rules added before the calendar can show meaningful actions for users in those states.
- [ ] **Appeal templates** — `Civica/Features/RecertificationCompanion/Appeal/Fixtures/AppealTemplates/` ships `MA.{en,es}.json` and `CA.{en,es}.json` only. Adding a new state requires both languages.

### Production-readiness gates (must pass before flipping the feature flag)
- [ ] **Legal review of appeal templates** — every state × language combination. Templates cite 7 CFR 273.2 verbatim and use the failure-vs-refusal-to-cooperate distinction as the procedural argument; a state regulator could still consider any pre-filled fair-hearing request "legal work." Pre-launch review is mandatory.
- [ ] **Spanish translation review** — strings and appeal templates. Native review, not internal back-translation.
- [ ] **OCR accuracy testing** — run `DenialLetterParser` against real MA DTA and CA CalFresh denial letters across at least 20 samples per state. Confirm `denialReason` extraction has ≥90% precision on the procedural-denial subset.
- [ ] **Recert date default correctness** — `approval-milestone + 12 months` is correct for MA / CA standard households but **wrong for CA semi-annual reporting (SAR-7) and elderly/disabled simplified reporting (24-month) populations**. The "Edit date" affordance is the safety valve, but legal/policy should confirm the default before pilot enrollment.

### Module polish
- [ ] **Debug menu entry** to flip `RecertCompanionFeatureFlag.isEnabled` on a per-device basis for QA without a new build. Add to whatever debug surface SNAP/Civica already exposes (or create one in this module).
- [ ] **Reminder snooze** — first version of `InAppReminderPromptView` is upload-or-dismiss. A "remind me in 3 days" affordance is worth considering for the second iteration once we see actual prompt-dismissal data.
- [ ] **Phantom Recert resumability** — currently the phantom draft persists, so a user can resume mid-phantom. We have not yet decided how long to retain an abandoned phantom draft. Suggested: clear on real recert submission, and clear on app launch if `phantomLastTouched > 30 days ago`.

---

## Privacy boundary (carry this forward)

Every analytics event in `RecertCompanionAnalytics` is allowlisted to the
four param keys above. **Never log:**
- The user's denial reason text
- The contents of the user's appeal
- Document image bytes or OCR text
- Recert date
- Application answers

Coarse counts (events without identifying params) are fine. State code is
fine. Document type (e.g. `pay_stub`) is fine. Anything beyond that needs
explicit review against the SNAP privacy bar set by `SNAPAnalytics`.

---

## How this module activates

1. `RecertCompanionFeatureFlag.isEnabled` is `false` by default. The module is dark.
2. When a developer or QA flips the flag on, the Civica home screen surfaces a new "Recert Companion" tile.
3. When `SNAPApplicationStatusStore.status == .recertDue` and the flag is on, `CivicaRootView` routes to `RecertCompanionFlowView` instead of the legacy `SNAPRecertificationView`. The legacy view stays in the codebase as the flag-off path until the companion is confirmed launch-ready.
4. The companion home shows: the computed/edited recert date, a Phantom Recert CTA (60+ days out), the Expiration Calendar, and an Appeal CTA (only when `status == .decisionDenied` with a procedural reason).

Flipping the flag off at any point cleanly reverts to the pre-companion behavior. No data migration is required either direction.
