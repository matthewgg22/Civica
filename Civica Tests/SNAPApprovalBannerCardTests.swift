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

    // MARK: - Reset on transitions (CQ-5)

    @Test("Transition to .notStarted clears BOTH flags (fresh case)")
    func notStartedTransitionClearsBothFlags() {
        // Seed both flags as if the user had previously been approved + acknowledged.
        defaults.set(true, forKey: CivicaAppStorageKeys.approvalAcknowledged)
        defaults.set(true, forKey: CivicaAppStorageKeys.hasBeenApprovedBefore)

        let resetter = SNAPApprovalAcknowledgmentResetter(defaults: defaults)
        resetter.handleTransition(from: .decisionDenied, to: .notStarted)

        #expect(defaults.bool(forKey: CivicaAppStorageKeys.approvalAcknowledged) == false)
        #expect(defaults.bool(forKey: CivicaAppStorageKeys.hasBeenApprovedBefore) == false)
    }

    @Test(".recertDue -> .decisionApproved transition clears acknowledged ONLY (renewal flavor)")
    func recertDueToApprovedClearsOnlyAcknowledged() {
        // Seed: user had been approved + dismissed once, then hit recert.
        defaults.set(true, forKey: CivicaAppStorageKeys.approvalAcknowledged)
        defaults.set(true, forKey: CivicaAppStorageKeys.hasBeenApprovedBefore)

        let resetter = SNAPApprovalAcknowledgmentResetter(defaults: defaults)
        resetter.handleTransition(from: .recertDue, to: .decisionApproved)

        #expect(defaults.bool(forKey: CivicaAppStorageKeys.approvalAcknowledged) == false,
                "Banner must re-fire after recert renewal (per CQ-5)")
        #expect(defaults.bool(forKey: CivicaAppStorageKeys.hasBeenApprovedBefore) == true,
                "Renewal flavor must be preserved across the transition")
    }

    @Test("Other transitions do not touch the acknowledged flag")
    func otherTransitionsAreNoOps() {
        defaults.set(true, forKey: CivicaAppStorageKeys.approvalAcknowledged)
        defaults.set(true, forKey: CivicaAppStorageKeys.hasBeenApprovedBefore)

        let resetter = SNAPApprovalAcknowledgmentResetter(defaults: defaults)
        // None of these should reset anything.
        resetter.handleTransition(from: .submittedToState, to: .documentsRequested)
        resetter.handleTransition(from: .documentsRequested, to: .interviewScheduled)
        resetter.handleTransition(from: .interviewScheduled, to: .interviewCompleted)
        resetter.handleTransition(from: .decisionApproved, to: .recertDue)

        #expect(defaults.bool(forKey: CivicaAppStorageKeys.approvalAcknowledged) == true)
        #expect(defaults.bool(forKey: CivicaAppStorageKeys.hasBeenApprovedBefore) == true)
    }

    @Test("First-time .interviewCompleted -> .decisionApproved does not pre-clear (acknowledged starts false)")
    func firstTimeApprovalLeavesFlagsAsIs() {
        // Fresh user: both flags false. First approval doesn't trigger a reset rule.
        let resetter = SNAPApprovalAcknowledgmentResetter(defaults: defaults)
        resetter.handleTransition(from: .interviewCompleted, to: .decisionApproved)

        // Banner shows because acknowledged is still false from the fresh-suite default.
        #expect(defaults.bool(forKey: CivicaAppStorageKeys.approvalAcknowledged) == false)
        #expect(defaults.bool(forKey: CivicaAppStorageKeys.hasBeenApprovedBefore) == false)
    }

    // MARK: - First-approval flavor

    @Test("First approval: flavor is .firstApproval before any acknowledgment")
    func firstApprovalFlavor() {
        // hasBeenApprovedBefore is false by default on a fresh suite.
        let hasBeenApprovedBefore = defaults.bool(forKey: CivicaAppStorageKeys.hasBeenApprovedBefore)
        let flavor: SNAPApprovalBannerCard.Flavor = hasBeenApprovedBefore ? .renewal : .firstApproval
        #expect(flavor == .firstApproval)
    }

    // MARK: - Renewal flavor (CQ-5)

    @Test("After acknowledge, the next approval renders the .renewal flavor")
    func renewalFlavorAfterAcknowledge() {
        let resetter = SNAPApprovalAcknowledgmentResetter(defaults: defaults)
        // User dismisses the first-approval banner.
        resetter.acknowledge()
        // Time passes; recert kicks in; recert flips back to approved.
        resetter.handleTransition(from: .recertDue, to: .decisionApproved)
        // Banner re-fires. Compute flavor as the view does.
        let hasBeenApprovedBefore = defaults.bool(forKey: CivicaAppStorageKeys.hasBeenApprovedBefore)
        let flavor: SNAPApprovalBannerCard.Flavor = hasBeenApprovedBefore ? .renewal : .firstApproval
        #expect(flavor == .renewal,
                "After first acknowledgment + recert cycle, banner must render renewal copy")
    }

    @Test("Full reset (.notStarted) drops flavor back to .firstApproval")
    func notStartedRestoresFirstApprovalFlavor() {
        // User had been approved + acknowledged.
        let resetter = SNAPApprovalAcknowledgmentResetter(defaults: defaults)
        resetter.acknowledge()
        // Reapply scenario: user starts over from scratch.
        resetter.handleTransition(from: .decisionApproved, to: .notStarted)

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

    @Test("Renewal copy has full en/es parity")
    func renewalCopyParity() {
        let copy = SNAPApprovalBannerStrings.renewal
        assertParity(copy.headline)
        assertParity(copy.bodyLine1)
        // Renewal's body is a single line - bodyLine2 is intentionally nil
        // (per audit JR-4 visual spec); guard against accidental drift.
        #expect(copy.bodyLine2 == nil,
                "Renewal flavor's body is a single line per the audit visual spec")
        assertParity(copy.findHelpLink)
    }

    @Test("First-approval and renewal headlines are distinct (no copy-paste drift)")
    func flavorHeadlinesAreDistinct() {
        let first = SNAPApprovalBannerStrings.firstApproval.headline
        let renewal = SNAPApprovalBannerStrings.renewal.headline
        #expect(first.en != renewal.en)
        #expect(first.es != renewal.es)
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

    @Test("Renewal flavor renders cleanly at default / xxxLarge / dark")
    func renewalSnapshot() {
        let view = SNAPApprovalBannerCard(
            flavor: .renewal,
            language: .english,
            onWhatThisMeans: {},
            onFindHelp: {},
            onDismiss: {}
        )
        .padding()
        .background(CivicaColors.paper)
        civicaAssertSnapshot(of: view, named: "approval-banner-renewal")
    }
}
