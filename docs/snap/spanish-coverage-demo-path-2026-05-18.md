# Spanish coverage audit — SNAP demo critical path (2026-05-18)

Read-only audit of `Civica/Localizable.xcstrings` (111 keys, 17 with `es`
translations) scoped to the demo critical path:

1. **SNAP sign-in flow** — `Civica/Features/SNAP/Enrollment/SNAPPhoneSignInView.swift`
2. **Benefit estimator** — `Civica/Features/SNAP/Estimator/*` (most copy lives in
   `SNAPBenefitEstimatorStrings.swift` via `CivicaText(en:es:)`, not xcstrings,
   so very few estimator keys surface here)
3. **Application flow first 3 steps** — `Civica/Features/SNAP/Application/*`,
   driven by `SNAPApplicationFlowOrchestrator.swift`
4. **Interview Coach** — `Civica/Features/SNAP/InterviewCoach/*`
5. **Document upload flow** — `Civica/Features/SNAP/Documents/*` and
   `SNAPDocumentUploadView.swift`

**No xcstrings changes were made by this audit** — the Spanish reviewer packet
on `claude/spanish-reviewer-packet` (parked) is the authoritative path for any
translation edits.

## Method

For each xcstrings key without an `es` translation, grep the demo-path Swift
files for the key as a string literal (`"<key>"`). Filter out:

- Punctuation- / format-only keys (`%@ — %@`, `·`, `+`, `$`, etc.)
- Admin / operator surfaces (`AdminInterviewExportView.swift`)
- Post-decision surfaces (`SNAPDecisionApprovedView.swift`,
  `SNAPRecertificationView.swift`) — past the demo arc
- The brand mark `"Civica"` (proper noun, no translation needed)
- Compound brand labels like `"Civica · v1"`, `"Civica · Admin"`,
  `"Civica · hello@civica.us"` (brand / footer / contact)
- Keys whose source string is already Spanish (e.g.
  `"Programa de Comidas en Restaurantes"`)

## Demo-path keys missing Spanish

For each row: the English source string, the recommended Spanish
translation, the source file, and a confidence note. Anything flagged
**(needs native-speaker review)** should land in the Spanish reviewer
packet before shipping rather than being committed straight in.

| English (xcstrings key) | Recommended Spanish | Source file | Notes |
|---|---|---|---|
| `Back` | `Atrás` | `Civica/Features/SNAP/Application/CivicaQuestionStrings.swift` | Standard nav button; matches `common.back` already used in `web/messages/es.json`. |
| `Close` | `Cerrar` | `Civica/Features/SNAP/Estimator/SNAPBenefitEstimatorStrings.swift` and `Civica/Features/SNAP/Application/CivicaQuestionStrings.swift` | Estimator already has `closeLabel = CivicaText("Close", es: "Cerrar")` — the xcstrings entry is the duplicate that auto-extracts from `Text("Close")` call sites. Confirm same `es` value. |
| `Edit` | `Editar` | `Civica/Features/SNAP/Application/SNAPReviewDraftFlow.swift` | Review-draft row affordance. |
| `Looks right` | `Se ve bien` | `Civica/Features/SNAP/Documents/SNAPDocumentConfirmationView.swift` | Document confirmation primary CTA. **(needs native-speaker review)** — `Se ve correcto` is also acceptable; pick whichever the reviewer prefers for tone. |
| `Try again` | `Intentar de nuevo` | `Civica/Features/SNAP/InterviewCoach/InterviewCoachStrings.swift`, `Civica/Features/SNAP/InterviewCoach/PracticeSessionViewModel.swift`, `Civica/Features/SNAP/Application/SNAPApplicationPacketView.swift`, `Civica/Features/SNAP/Application/SNAPAppealLetterView.swift` | Matches `common.tryAgain` in `web/messages/es.json`. High-frequency retry button across the demo path. |
| `Putting your packet together…` | `Preparando tu paquete…` | `Civica/Features/SNAP/Application/SNAPApplicationPacketView.swift` | Loading-state copy on the packet-build screen. |
| `Your packet is ready.` | `Tu paquete está listo.` | `Civica/Features/SNAP/Application/SNAPApplicationPacketView.swift` | Success-state copy after packet build; appears right before the document-upload handoff on the demo arc. |

## Out of scope but worth noting

- The **benefit estimator** copy is overwhelmingly in
  `SNAPBenefitEstimatorStrings.swift` via `CivicaText(en:es:)` — Spanish
  coverage there is already 100% by construction (the type forces an `es`
  argument). The only xcstrings drip-through is `"Close"`.
- The **sign-in flow** (`SNAPPhoneSignInView.swift`) and **interview coach
  Strings/Disclaimer** modules use `CivicaText(en:es:)` exclusively for
  user-facing copy and produce no xcstrings demo-path gaps.
- The `Civica/Localizable.xcstrings` `es`-missing list still contains ~80
  punctuation / format / admin / brand strings that do not need
  translation. They are excluded from the table above by the filters
  described in **Method**.

## Suggested follow-up

1. Land the 7 strings above through the Spanish reviewer packet
   (`claude/spanish-reviewer-packet`) — the parity gate, not this audit
   doc, is the path for actual xcstrings changes.
2. After review, batch-edit `Civica/Localizable.xcstrings` to add the
   `es` `stringUnit` entries with `state: "translated"`.
3. Re-run this audit (same script, new date in filename) before the next
   demo to catch any new xcstrings auto-extractions on the demo path.
