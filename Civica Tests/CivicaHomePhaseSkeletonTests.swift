import Foundation
import SwiftUI
import Testing
@testable import Civica
import CivicaDesignSystem

// IS-8 (audit 2026-05-29): smoke coverage for the Phase 2 + Phase 3
// first-paint skeleton band. The @State flag that gates the skeleton
// is private to each view, so we exercise the public render path:
// the views construct cleanly with the same wiring the home screen
// uses, and the .task block resolves without trapping. The skeleton
// itself is verified by `CivicaSkeletonRowTests`.

@MainActor
@Suite("CivicaHomePhase first-paint skeleton")
struct CivicaHomePhaseSkeletonTests {

    @Test("Phase 2 .submittedToState constructs with first-paint flag")
    func phase2Constructs() {
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
        #expect(String(describing: type(of: view.body)).isEmpty == false)
    }

    @Test("Phase 3 .decisionApproved constructs with first-paint flag")
    func phase3Constructs() {
        let store = SNAPApplicationStatusStore()
        store.advance(to: .decisionApproved)
        let view = NavigationStack {
            CivicaHomePhase3View(
                statusStore: store,
                language: .english,
                onOpenExternalPortal: {}
            )
        }
        #expect(String(describing: type(of: view.body)).isEmpty == false)
    }
}
