import Foundation
import SwiftUI
import Testing
@testable import Civica
import CivicaDesignSystem

// Baseline snapshots for Phase 3 (Enrolled) home. Captures the
// unlinked-card placeholder path — the audit's JR-4 (approval banner)
// and JR-5 (recert continuity copy) work both live on this surface.
// Once the audit's T7 (dark mode) lands, the .dark baseline becomes
// the regression gate for the dark-token contrast audit.
//
// COVERAGE GAP (logged 2026-05-29):
//
// The conditional recert banner in CivicaHomePhase3View.swift:181-228
// is NOT exercised by this test. The unlinked-approved fixture sets
// `status = .decisionApproved` with no `.recertDue` milestone, so the
// banner's guard `if let dueDate = statusStore.timestamp(for: .recertDue)`
// short-circuits to EmptyView.
//
// PR-2 / DS-1 (PR #331) swapped the banner's foreground+background
// tokens from amberPrimary → warningAmber and amberSurface →
// statusWarningSurface. That change is NOT visible in any current
// baseline; it was verified manually at PR-2 review.
//
// Adding a banner-on snapshot is blocked on a deterministic-now seam:
// the banner renders `"Due MMM d · N days"` via
// `CivicaPhase3Strings.recertDueIn(date:days:language:)`, both of
// which derive from `Date().timeIntervalSinceNow`. A naive
// fixed-future-date fixture would drift its day count by 1 every
// 24h and fail at 0.99 image precision.
//
// Deferred to T6 (Dynamic Type / typography rollout) or T7 (dark
// mode / contrast audit), whichever first introduces a
// `Clock`/`DateProvider` test seam.

@MainActor
@Suite("CivicaHomePhase3View snapshots", .serialized)
struct CivicaHomePhase3ViewSnapshotTests {

    @Test("Phase 3 .decisionApproved (unlinked EBT card) renders cleanly at default / xxxLarge / dark")
    func phase3DecisionApprovedUnlinked() {
        let store = SNAPApplicationStatusStore()
        store.advance(to: .decisionApproved)
        let view = NavigationStack {
            CivicaHomePhase3View(
                statusStore: store,
                language: .english,
                onOpenExternalPortal: {}
            )
        }
        civicaAssertSnapshot(of: view, named: "phase3-approved-unlinked")
    }
}
