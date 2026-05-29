import Foundation
import SwiftUI
import Testing
@testable import Civica
import CivicaDesignSystem

// Regression snapshot covering the universal help marker added by
// feat(civica-question-screen): help marker via onHelpRequested closure.
// One file edit covers all 17+ SNAP application pages because every
// question routes through CivicaQuestionScreen — this suite locks the
// marker's visible promise into the .default / .xxxLarge / .dark
// baseline matrix so a future refactor that drops the questionmark.circle
// (or reverts to the opt-in model the design doc deliberately rejected)
// fails CI with a diff in the committed PNG.
//
// Two affordance variants per the test plan (T10 of
// matthewgreer-gentis-claude-dashboard-state-coverage-design-20260529-135546.md):
//   1. CivicaQuestionChoices — represents the "household composition,
//      income source, ABAWD work-hours" majority of intake questions
//   2. CivicaQuestionFreeText — represents the "explain in your own
//      words" minority surface (asset clarifications, distress prompt)
// The marker must render visibly on both.
//
// `.serialized` for consistency with CivicaEntryViewSnapshotTests where
// the underlying SwiftUI font registration + render path shares state
// across the test process. Snapshot baselines are deterministic; the
// trade-off (slightly slower run) is irrelevant against the regression
// cost of a non-determinism flake taking down the demo-critical marker.
@MainActor
@Suite("CivicaQuestionScreen marker snapshots", .serialized)
struct CivicaQuestionScreenSnapshotTests {

    @Test("Choices affordance renders the help marker next to the question title")
    func choicesAffordanceShowsMarker() {
        let view = CivicaQuestionScreen(
            progress: .init(current: 1, total: 3),
            title: "How many people live in your household?",
            helper: "Include anyone who shares groceries with you — partners, kids, roommates who eat together.",
            primaryActionTitle: "Continue",
            primaryActionEnabled: true,
            onPrimary: {},
            secondaryActionTitle: "I'm not sure",
            onSecondary: {},
            language: .english,
            onHelpRequested: { _, _ in }
        ) {
            CivicaQuestionChoices(
                options: ["Just me", "2 people", "3 people", "4 or more"],
                selection: .constant(nil)
            )
        }
        civicaAssertSnapshot(of: view, named: "marker-choices")
    }

    @Test("Free-text affordance renders the help marker next to the question title")
    func freeTextAffordanceShowsMarker() {
        let view = CivicaQuestionScreen(
            progress: .init(current: 2, total: 3),
            title: "Anything else you want the county to know?",
            helper: "Optional — most applicants leave this blank.",
            primaryActionTitle: "Continue",
            primaryActionEnabled: true,
            onPrimary: {},
            language: .english,
            onHelpRequested: { _, _ in }
        ) {
            CivicaQuestionFreeText(
                text: .constant(""),
                placeholder: "Type here…"
            )
        }
        civicaAssertSnapshot(of: view, named: "marker-free-text")
    }
}
