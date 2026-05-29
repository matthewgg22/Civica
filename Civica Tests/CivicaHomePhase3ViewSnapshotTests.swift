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
