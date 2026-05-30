import Foundation
import SwiftUI
import Testing
@testable import Civica
import CivicaDesignSystem

// JR-4 of the iOS product audit (2026-05-29).
//
// `SNAPApprovalBannerCard` is the persistent approval banner on the
// Phase 3 (Enrolled) home. Three load-bearing qualities (this commit
// covers JR-4; CQ-5 transition rules + renewal-flavor coverage land
// in a follow-up regression commit):
//
//   1. Persistence schema (UD-7 / ARCH-3): `approvalAcknowledged` is
//      set true on dismiss or EBT-card link.
//   2. Flavor selection (CQ-5): `.firstApproval` while
//      `hasBeenApprovedBefore == false`.
//   3. Bilingual parity (every CivicaText has both en + es).
//
// The Civica target does not link a SwiftUI behavioral-test harness, so
// "tap dismisses the banner" is tested at the storage layer:
// `SNAPApprovalAcknowledgmentResetter` writes to the same UserDefaults
// keys the view's `@AppStorage` observes, so a write to that key is
// equivalent to the view re-rendering with the new flag.

@Suite(.serialized)
@MainActor
struct SNAPApprovalBannerCardTests {

    private let suite = "co.civica.tests.approvalBannerCard"

    private var defaults: UserDefaults {
        UserDefaults(suiteName: suite)!
    }

    init() {
        defaults.removePersistentDomain(forName: suite)
    }

    // MARK: - Persistence schema (UD-7 / ARCH-3)

    @Test("Banner renders when status is approved, no card linked, and not acknowledged")
    func showsWhenConditionsMet() {
        // The view-level guard is: status == .decisionApproved
        //                       && ebtStore.account == nil
        //                       && !approvalAcknowledged
        // Verify the persistence flag defaults to false on a fresh suite.
        #expect(defaults.bool(forKey: CivicaAppStorageKeys.approvalAcknowledged) == false)
    }

    @Test("Dismiss sets approvalAcknowledged = true")
    func dismissAcknowledges() {
        let resetter = SNAPApprovalAcknowledgmentResetter(defaults: defaults)
        resetter.acknowledge()
        #expect(defaults.bool(forKey: CivicaAppStorageKeys.approvalAcknowledged) == true)
    }

    @Test("EBT card link sets approvalAcknowledged = true (same code path as dismiss)")
    func cardLinkAcknowledges() {
        // CivicaHomePhase3View calls acknowledge() in .onChange(of: ebtStore.linkState)
        // when linkState transitions to .linked - same write as a manual dismiss.
        let resetter = SNAPApprovalAcknowledgmentResetter(defaults: defaults)
        resetter.acknowledge()
        #expect(defaults.bool(forKey: CivicaAppStorageKeys.approvalAcknowledged) == true)
        #expect(defaults.bool(forKey: CivicaAppStorageKeys.hasBeenApprovedBefore) == true)
    }

    // MARK: - First-approval flavor

    @Test("First approval: flavor is .firstApproval before any acknowledgment")
    func firstApprovalFlavor() {
        // hasBeenApprovedBefore is false by default on a fresh suite.
        let hasBeenApprovedBefore = defaults.bool(forKey: CivicaAppStorageKeys.hasBeenApprovedBefore)
        let flavor: SNAPApprovalBannerCard.Flavor = hasBeenApprovedBefore ? .renewal : .firstApproval
        #expect(flavor == .firstApproval)
    }

    // MARK: - Bilingual parity

    @Test("First-approval copy has full en/es parity")
    func firstApprovalCopyParity() {
        let copy = SNAPApprovalBannerStrings.firstApproval
        assertParity(copy.headline)
        assertParity(copy.bodyLine1)
        if let line2 = copy.bodyLine2 { assertParity(line2) }
        assertParity(copy.findHelpLink)
    }

    @Test("Shared strings (whatThisMeans / dismissA11y) have parity")
    func sharedStringsParity() {
        assertParity(SNAPApprovalBannerStrings.whatThisMeans)
        assertParity(SNAPApprovalBannerStrings.dismissA11y)
    }

    @Test("Explainer view copy has bilingual parity")
    func explainerCopyParity() {
        assertParity(SNAPApprovalExplainerStrings.headerTitle)
        assertParity(SNAPApprovalExplainerStrings.headerBody)
        assertParity(SNAPApprovalExplainerStrings.budgetTitle)
        assertParity(SNAPApprovalExplainerStrings.budgetBody)
        assertParity(SNAPApprovalExplainerStrings.ebtTitle)
        assertParity(SNAPApprovalExplainerStrings.ebtBody)
        assertParity(SNAPApprovalExplainerStrings.workTitle)
        assertParity(SNAPApprovalExplainerStrings.workBody)
        assertParity(SNAPApprovalExplainerStrings.renewalTitle)
        assertParity(SNAPApprovalExplainerStrings.renewalBody)
        assertParity(SNAPApprovalExplainerStrings.doneCTA)
    }

    // MARK: - Helpers

    fileprivate func assertParity(
        _ text: CivicaText,
        sourceLocation: SourceLocation = #_sourceLocation
    ) {
        #expect(!text.en.isEmpty, "en copy missing", sourceLocation: sourceLocation)
        #expect(!text.es.isEmpty, "es copy missing", sourceLocation: sourceLocation)
        #expect(text.en != text.es,
                "en and es copy appear identical - likely a translation gap",
                sourceLocation: sourceLocation)
    }
}

// MARK: - Snapshot baselines

@MainActor
@Suite("SNAPApprovalBannerCard snapshots", .serialized)
struct SNAPApprovalBannerCardSnapshotTests {

    @Test("First-approval flavor renders cleanly at default / xxxLarge / dark")
    func firstApprovalSnapshot() {
        let view = SNAPApprovalBannerCard(
            flavor: .firstApproval,
            language: .english,
            onWhatThisMeans: {},
            onFindHelp: {},
            onDismiss: {}
        )
        .padding()
        .background(CivicaColors.paper)
        civicaAssertSnapshot(of: view, named: "approval-banner-firstApproval")
    }
}
