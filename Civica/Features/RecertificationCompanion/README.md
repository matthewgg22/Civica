# Recertification Companion

Module that helps existing SNAP enrollees stay enrolled through recertification.
Composes four features against the existing SNAP module — does not replace anything.

## What's inside

| Feature | Surface | Trigger |
|---|---|---|
| Phantom Recert | `PhantomRecert/PhantomRecertFlowView.swift` | Recert ≤ 60 days out |
| Expiration Calendar | `ExpirationCalendar/ExpirationCalendarView.swift` | Always on the dashboard |
| Just-in-Time Reminders | `Reminders/RecertNotificationService.swift` | Reconciles on every dashboard view |
| Procedural Appeal | `Appeal/AppealEntryView.swift` | `status == .decisionDenied` |

Top-level entry point: `RecertCompanionRoot.swift` (mounted by `CivicaRootView` for `.recertDue` / `.decisionDenied` and by `CivicaEntryView`'s flag-gated tile).

## How the four features compose

```
RecertCompanionRoot
  ├── RecertScheduleStore                ← effective recert date (approval + 12mo, user-editable)
  ├── PhantomRecertEntryView             ← only when within 60 days
  ├── ExpirationCalendarView
  │     └── DocumentExpirationPredictor  ← pure date math, fed by vault + state rules
  ├── RecertNotificationPermissionView   ← soft pre-prompt
  └── AppealEntryView                    ← only when .decisionDenied

PhantomRecertFlowView (pushed)
  ├── SNAPApplicationFlowOrchestratorView (.phantom mode)
  │     ├── seeded with clone of live draft
  │     └── persists to co.civica.applicationDraft.phantom
  └── PhantomRecertSummaryView (pushed on completion)
        ├── SNAPLocalEligibilityEvaluator → fresh estimate
        ├── PhantomChangeDetector → diff vs live draft
        ├── DocumentExpirationPredictor → forecast
        └── PhantomPrepChecklist → combined to-do list

AppealEntryView (pushed)
  ├── DenialLetterParser (iOS 26+ with Apple Intelligence)
  ├── DenialLetterManualEntryView (always available)
  └── AppealReviewView (pushed)
        ├── AppealTemplateLoader → {state}.{lang}.json
        ├── AppealRenderer → deterministic templated body
        └── AppealExportSheetView
              ├── AppealExportService.writePDF
              ├── ShareLink (system share sheet)
              └── statePortals deep-link
```

## Extension points

### Add a state's document expiration rules

1. Open `ExpirationCalendar/Fixtures/document-rules.json`.
2. Add a new entry under `states` keyed by USPS two-letter code:
   ```json
   "NY": {
     "documents": {
       "proof_of_income": { "maxAgeDaysAtRecert": 30, "frequency": "biweekly" },
       "utility_bill":    { "maxAgeDaysAtRecert": 60 },
       ...
     }
   }
   ```
3. Sources: state-published recertification checklists / operations memos. Cite the source in NOTES.md for legal review.
4. No code changes required. `DocumentExpirationRules` loads at app launch.

### Add a state's appeal templates

1. Create `Appeal/Fixtures/AppealTemplates/{STATE}.en.json` and `{STATE}.es.json`.
2. Shape: see `Appeal/AppealTemplateLoader.swift` — `AppealTemplate` struct.
3. Add the state's benefits-portal URL to `Appeal/AppealExportService.statePortals`.
4. **Legal review of both languages is mandatory before launch in the new state.**

### Extend the change detector

`PhantomRecert/PhantomChangeDetector.swift` operates at section granularity. To add a finer-grained diff (e.g., "rent changed by $X"), add a sub-diff helper inside the relevant `case` in `diffSection(_:live:phantom:)`. Keep the result as a `PhantomChange` variant so the summary screen and prep checklist consume it unchanged.

### Extend the denial-reason set

1. Add a new case to `Appeal/DenialReason.swift`.
2. Add a paragraph for that case to every `AppealTemplate.Paragraphs` (every state × language).
3. Add the classification string to `DenialLetterParser.classifyReason` and to the prompt in `denialLetterPrompt`.
4. Update `DenialLetterManualEntryView` to surface the new option (segmented picker uses `DenialReason.allCases`, so this is free).
5. Add a localized label to `RecertCompanionStrings` and wire it through `reasonLabel` in `DenialLetterManualEntryView`.

## Feature flag

`RecertCompanionFeatureFlag.isEnabled` — runtime, backed by `UserDefaults` key `co.civica.recertCompanion.enabled`. Default: `false`.

Flip per device:
```swift
RecertCompanionFeatureFlag.setEnabled(true)
```

Or directly:
```swift
UserDefaults.standard.set(true, forKey: "co.civica.recertCompanion.enabled")
```

When the flag is off:
- `CivicaEntryView` doesn't show the companion tile
- `.recertDue` routes through the legacy `SNAPRecertificationView`
- `.decisionDenied` routes through the legacy `SNAPDecisionDeniedView`
- The companion module's code is still in the binary but dormant

## Privacy boundary

Analytics events go through `RecertCompanionAnalytics`, which enforces an allowlist of four parameter keys: `step_name`, `step_index`, `document_type`, `state_code`. **No PII, no eligibility answers, no recert dates, no appeal contents.** Treat the SNAPAnalytics file as the privacy reference — every change to this module's analytics must clear the same bar.

## Pre-launch review checklist

Before flipping `RecertCompanionFeatureFlag.isEnabled` for end users, complete:

- [ ] Legal review of every appeal template (state × language combo)
- [ ] Native Spanish review of every Spanish string + template
- [ ] OCR accuracy testing of `DenialLetterParser` on ≥20 real denial letters per state
- [ ] Confirm recert-date default (approval + 12mo) is correct for the target population — flag SAR-7 and 24-month simplified-reporting users as out of scope until policy confirms
- [ ] Smoke-test reminder scheduling on a real device (simulator notification delivery is not authoritative)
- [ ] Run the unit test suite once the `CivicaTests` target is wired in Xcode (see top-level NOTES.md)

## What lives outside this module

- `Civica/Features/SNAP/Documents/SNAPDocumentVaultReader.swift` — read-only sibling of `SNAPCapturedDocumentStore`, added so the predictor can pull capture dates without touching the existing vault
- `Civica/Features/SNAP/Application/SNAPApplicationFlowOrchestrator.swift` — extended with `.phantom(section:)` `Mode` case (additive)
- `Civica/Features/SNAP/Application/SNAPApplicationDraftStore.swift` — extended with keyed `init(defaults:, storageKey:)` (additive)
- `Civica/App/CivicaRootView.swift` — routes `.recertDue` and `.decisionDenied` through this module when the flag is on
- `Civica/App/CivicaEntryView.swift` — adds the companion tile under the flag

These are the only invasive points outside `Civica/Features/RecertificationCompanion/`. All other module code is self-contained.
