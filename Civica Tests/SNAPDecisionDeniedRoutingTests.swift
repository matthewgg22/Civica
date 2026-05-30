import Foundation
import Testing
@testable import Civica

// IA-5 of iOS audit 2026-05-29.
//
// SNAPDecisionDeniedView used to render four cards in a shared visual
// rhythm but only one — Food Help — was a real NavigationLink. Krug's
// "obviously clickable" rule was broken at the highest-stakes
// emotional moment in the app.
//
// These tests pin two regressions:
//   1. All four next-step cards remain tappable destinations.
//   2. The primary CTA swaps from Appeal → Speak with a navigator
//      the moment AppealabilityService says `isAppealable == false`.
//
// The view layer doesn't link a behavioral-tap inspection library
// (matching CivicaHomePhase2InterviewCTAroutingTests' pattern), so
// the predicates live as static helpers on SNAPDecisionDeniedView
// and the regression bites at compile time the moment they drift.

@Suite("SNAPDecisionDeniedView — IA-5 routing")
struct SNAPDecisionDeniedRoutingTests {

    // MARK: - Tappability contract

    /// IA-5 §1 — four cards, all tappable. The enum is CaseIterable
    /// so this test catches any future addition (or removal).
    @Test("All four next-step cards are real destinations")
    func everyNextStepCardIsTappable() {
        let cards = Set(SNAPDecisionDeniedView.NextStepCardKind.allCases)
        #expect(cards == [.appeal, .review, .foodHelp, .reapply])
    }

    // MARK: - Appealability gate

    @Test("Within-window → Appeal is the primary action")
    func withinWindowKeepsAppealPrimary() {
        let result = AppealabilityResult(isAppealable: true, reason: .withinWindow)
        #expect(SNAPDecisionDeniedView.primaryAction(for: result) == .appeal)
    }

    @Test("Unknown reason → Appeal is the primary action (today's default)")
    func unknownReasonKeepsAppealPrimary() {
        // unknown_reason is the no-ingested-classification path that
        // ships first; Appeal stays the primary CTA so we don't ever
        // accidentally block a user with a real right of appeal.
        let result = AppealabilityResult(isAppealable: true, reason: .unknownReason)
        #expect(SNAPDecisionDeniedView.primaryAction(for: result) == .appeal)
    }

    @Test("Window expired → primary action demotes to navigator portal")
    func windowExpiredPromotesNavigator() {
        let result = AppealabilityResult(isAppealable: false, reason: .windowExpired)
        #expect(SNAPDecisionDeniedView.primaryAction(for: result) == .navigator)
    }

    @Test("Category excluded → primary action demotes to navigator portal")
    func categoryExcludedPromotesNavigator() {
        let result = AppealabilityResult(isAppealable: false, reason: .categoryExcluded)
        #expect(SNAPDecisionDeniedView.primaryAction(for: result) == .navigator)
    }

    /// Defence in depth: a future contributor could flip the
    /// AppealabilityResult.isAppealable bit without updating the
    /// reason enum (or vice versa). Pin the cross-product so neither
    /// half can drift unnoticed.
    @Test("Primary-action mapping is fully driven by isAppealable")
    func primaryActionIsFullyDeterminedByIsAppealable() {
        let allReasons: [AppealabilityResult.Reason] = [
            .withinWindow,
            .windowExpired,
            .categoryExcluded,
            .unknownReason,
        ]
        for reason in allReasons {
            let appealable = AppealabilityResult(isAppealable: true, reason: reason)
            let blocked = AppealabilityResult(isAppealable: false, reason: reason)
            #expect(SNAPDecisionDeniedView.primaryAction(for: appealable) == .appeal)
            #expect(SNAPDecisionDeniedView.primaryAction(for: blocked) == .navigator)
        }
    }
}
