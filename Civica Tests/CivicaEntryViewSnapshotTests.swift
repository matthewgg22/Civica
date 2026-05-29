import Foundation
import SwiftUI
import Testing
@testable import Civica
import CivicaDesignSystem

// Baseline snapshots for Phase 1 cold-start home (CivicaEntryView).
// Three baselines per screen: .default, .xxxLarge, .dark — see
// CivicaSnapshotConfig.swift for the trait definitions and the
// record-vs-verify flow.
//
// Failing this suite after a PR means either (a) you changed the view
// intentionally and the baseline needs re-recording, or (b) you broke
// the visual register (regression). The diff in the failing baseline
// PNG is the receipt either way.

// `.serialized` because `CivicaEnrollmentAuth.init` fires a background
// `Task { await restoreSession() }` that races across Swift Testing's
// default parallel workers (per memory note feedback_swift_testing_concurrent).
// Snapshot baselines are deterministic; serializing the suite removes
// flake without changing what we measure.
@MainActor
@Suite("CivicaEntryView snapshots", .serialized)
struct CivicaEntryViewSnapshotTests {

    @Test("Phase 1 cold-start home renders cleanly at default / xxxLarge / dark")
    func phase1ColdStart() {
        let view = NavigationStack {
            CivicaEntryView()
                .environmentObject(SNAPApplicationStatusStore())
                .environmentObject(CivicaEnrollmentAuth())
        }
        civicaAssertSnapshot(of: view, named: "phase1-coldstart")
    }
}
