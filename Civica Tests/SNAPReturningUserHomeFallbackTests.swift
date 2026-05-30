import Testing
@testable import Civica

// Regression guard for IA-6 from the iOS product audit 2026-05-29:
// `SNAPReturningUserHomeView` previously gated the verdict card on
// `statusStore.eligibilityResult != nil` and silently rendered nothing
// when the keychain payload was lost (crash, version upgrade, storage
// migration). Returning users saw no verdict card AND no recovery
// affordance — silent omission.
//
// The fix adds a quiet fallback card that renders when
// `eligibilityResult == nil` AND `status.isActiveCase`. This suite
// pins the load-bearing predicate and the EN/ES string parity so a
// future refactor can't quietly reintroduce the bug.
//
// Coverage note: no ViewInspector in this project (only pointfree
// SnapshotTesting), so button taps can't be invoked from a unit test.
// Pinning the predicate + string existence is the best available
// unit-level guard; snapshot baselines are a follow-on.

@Suite("SNAPReturningUserHome fallback card rendering (IA-6)")
struct SNAPReturningUserHomeFallbackTests {

    // MARK: - shouldShowFallbackCard predicate

    @Test("Fallback renders for every active-case status when eligibilityResult is nil")
    func fallbackRendersForActiveStatusWithoutResult() {
        let activeCaseStatuses = SNAPApplicationStatus.allCases.filter { $0.isActiveCase }
        #expect(!activeCaseStatuses.isEmpty)

        for status in activeCaseStatuses {
            #expect(
                SNAPReturningUserHomeView.shouldShowFallbackCard(
                    status: status,
                    eligibilityResult: nil
                ),
                "Fallback must render for active-case status '\(status.rawValue)' when eligibilityResult is nil"
            )
        }
    }

    @Test("Fallback hidden when eligibilityResult is present (verdict card takes over)")
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
                "Fallback must NOT render when eligibilityResult is non-nil (status: '\(status.rawValue)')"
            )
        }
    }

    @Test("Fallback hidden for inactive statuses even when eligibilityResult is nil")
    func fallbackHiddenForInactiveStatuses() {
        // Inactive statuses route away from this view in CivicaRootView.
        // Pinning guards against a future caller (preview, test, or
        // refactored router) landing here with an inactive status.
        let inactiveStatuses = SNAPApplicationStatus.allCases.filter { !$0.isActiveCase }
        #expect(!inactiveStatuses.isEmpty)

        for status in inactiveStatuses {
            #expect(
                !SNAPReturningUserHomeView.shouldShowFallbackCard(
                    status: status,
                    eligibilityResult: nil
                ),
                "Fallback must NOT render for inactive status '\(status.rawValue)'"
            )
        }
    }

    // MARK: - String parity

    @Test("Fallback strings have non-empty EN and ES (no silent empty-label ship)")
    func fallbackStringsHaveBothLanguages() {
        let entries: [(label: String, text: CivicaText)] = [
            ("fallbackHeadline",    SNAPReturningHomeStrings.fallbackHeadline),
            ("fallbackReRunAction", SNAPReturningHomeStrings.fallbackReRunAction),
            ("fallbackSkipAction",  SNAPReturningHomeStrings.fallbackSkipAction),
        ]
        for (label, entry) in entries {
            #expect(!entry.en.isEmpty, "EN missing in \(label)")
            #expect(!entry.es.isEmpty, "ES missing in \(label)")
            #expect(
                entry.en != entry.es,
                "Suspicious: \(label) has identical EN and ES — was Spanish accidentally copied from English?"
            )
        }
    }
}
