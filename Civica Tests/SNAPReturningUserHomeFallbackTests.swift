import Testing
@testable import Civica

// Regression guard for IA-6 from the iOS product audit 2026-05-29:
// `SNAPReturningUserHomeView` previously gated the verdict card on
// `statusStore.eligibilityResult != nil` and silently rendered nothing
// when the keychain payload was lost across a crash, version upgrade,
// or storage migration. Returning users landed on the home with no
// verdict card AND no recovery affordance — a silent omission.
//
// The fix introduces a quiet fallback card that renders when
// `eligibilityResult == nil` AND status is a `.isActiveCase` sub-state
// (the same routing condition that reaches this view at all). This
// suite pins that predicate so a future refactor can't quietly
// re-introduce the silent-omission bug.
//
// Coverage note: per SNAPReturningUserResumeTests, the project links
// only pointfree SnapshotTesting (no ViewInspector), so a SwiftUI
// view's tap targets cannot be invoked from a unit test. Pinning the
// load-bearing predicate is the best available unit-level guard.

@Suite("SNAPReturningUserHome fallback card rendering (IA-6)")
struct SNAPReturningUserHomeFallbackTests {

    /// The fallback fires whenever the view is reached AND the verdict
    /// payload is nil. Reaching this view at all already requires
    /// `isActiveCase` (CivicaRootView.rootSurface routes elsewhere for
    /// the inactive states), so the predicate folds that in to defend
    /// against test-time wiring that constructs the view directly with
    /// a non-active status.
    @Test("Fallback renders when eligibilityResult is nil and status is active")
    func fallbackRendersForActiveStatusWithoutResult() {
        let activeStates: [SNAPApplicationStatus] = [
            .screenerComplete,
            .packetGenerated,
            .submittedToState,
            .documentsRequested,
            .interviewScheduled,
            .interviewCompleted,
            .recertDue,
        ]
        for status in activeStates {
            #expect(
                SNAPReturningUserHomeView.shouldShowFallbackCard(
                    status: status,
                    eligibilityResult: nil
                ),
                "Fallback must render for active-case status \(status.rawValue) when eligibilityResult is nil"
            )
        }
    }

    /// Hard guard against the original bug: if `eligibilityResult` is
    /// non-nil the verdict card carries the burden, so the fallback
    /// must stay out of the way. The double-render would either ship
    /// duplicate UI or silently hide the verdict — both regressions.
    @Test("Fallback does NOT render when eligibilityResult is present")
    func fallbackHiddenWhenResultPresent() {
        let result = SNAPEligibilityResult(
            status: .eligible,
            monthlyBenefit: 250,
            expeditedEligible: false,
            contributingFactors: [],
            requiredVerifications: [],
            benefitCalculation: nil,
            ineligibilityReason: nil,
            effectiveDate: "2026-05-30",
            rulesVersion: "test"
        )
        for status in SNAPApplicationStatus.allCases {
            #expect(
                !SNAPReturningUserHomeView.shouldShowFallbackCard(
                    status: status,
                    eligibilityResult: result
                ),
                "Fallback must NOT render when eligibilityResult is non-nil (status: \(status.rawValue))"
            )
        }
    }

    /// Inactive statuses are routed away from this view by
    /// CivicaRootView. Pinning the predicate against them defends
    /// against a future caller (preview, test, or refactored router)
    /// landing on the surface with an inactive status. The fallback
    /// would be the wrong copy for "I'm not even in an application
    /// yet" — that path is CivicaEntryView.
    @Test("Fallback does NOT render for inactive statuses even when result is nil")
    func fallbackHiddenForInactiveStatuses() {
        let inactiveStates: [SNAPApplicationStatus] = [
            .notStarted,
            .screenerInProgress,
            .decisionApproved,
            .decisionDenied,
        ]
        for status in inactiveStates {
            #expect(
                !SNAPReturningUserHomeView.shouldShowFallbackCard(
                    status: status,
                    eligibilityResult: nil
                ),
                "Fallback must NOT render for inactive status \(status.rawValue)"
            )
        }
    }

    /// EN/ES parity on every new fallback string. Matches the
    /// `EBTStringParityTests` discipline: missing Spanish ships as an
    /// empty label, not a crash.
    @Test("Fallback strings have non-empty EN and ES")
    func fallbackStringsHaveBothLanguages() {
        let entries: [CivicaText] = [
            SNAPReturningHomeStrings.fallbackHeadline,
            SNAPReturningHomeStrings.fallbackReRunAction,
            SNAPReturningHomeStrings.fallbackSkipAction,
        ]
        for (index, entry) in entries.enumerated() {
            #expect(!entry.en.isEmpty, "EN missing in fallback string index \(index)")
            #expect(!entry.es.isEmpty, "ES missing in fallback string index \(index)")
            #expect(
                entry.en != entry.es,
                "Suspicious: fallback string index \(index) has identical EN and ES — was Spanish accidentally copied from English?"
            )
        }
    }
}
