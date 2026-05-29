import Foundation
import SwiftUI
import Testing
@testable import Civica
import CivicaDesignSystem

// Baseline snapshots for Phase 2 (Pending) home. Three baselines per
// status sub-state we exercise — submitted-fresh and interview-scheduled
// — because the audit's IA-1 (appointment block) and JR-3 (interview
// coach) work depends on those two snapshots not regressing.

@MainActor
@Suite("CivicaHomePhase2View snapshots", .serialized)
struct CivicaHomePhase2ViewSnapshotTests {

    @Test("Phase 2 .submittedToState renders cleanly at default / xxxLarge / dark")
    func phase2SubmittedToState() {
        let store = SNAPApplicationStatusStore()
        store.advance(to: .submittedToState)
        let view = NavigationStack {
            CivicaHomePhase2View(
                statusStore: store,
                language: .english,
                onOpenExternalPortal: {}
            )
            .environmentObject(CivicaEnrollmentAuth())
        }
        civicaAssertSnapshot(of: view, named: "phase2-submitted")
    }

    @Test("Phase 2 .interviewScheduled renders cleanly at default / xxxLarge / dark")
    func phase2InterviewScheduled() {
        let store = SNAPApplicationStatusStore()
        store.advance(to: .submittedToState)
        store.advance(to: .interviewScheduled)
        let view = NavigationStack {
            CivicaHomePhase2View(
                statusStore: store,
                language: .english,
                onOpenExternalPortal: {}
            )
            .environmentObject(CivicaEnrollmentAuth())
        }
        civicaAssertSnapshot(of: view, named: "phase2-interview-scheduled")
    }
}
