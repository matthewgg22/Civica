import Foundation
import Testing
@testable import Civica

// Tests for SNAPCoveragePolicy + the launch-time invalidation
// routine that depends on it. Per OBBBA audit Q7 (Revision 2): one
// policy decides which states the screener can serve, and every
// entry point consults it.

struct SNAPCoveragePolicyTests {

    // MARK: - Membership

    @Test func massachusettsIsInScope() {
        #expect(SNAPCoveragePolicy.isStateInScope("MA"))
    }

    @Test func lowercaseMAIsInScope() {
        #expect(SNAPCoveragePolicy.isStateInScope("ma"))
    }

    @Test func whitespacePaddedMAIsInScope() {
        #expect(SNAPCoveragePolicy.isStateInScope("  MA  "))
    }

    @Test func californiaIsInScope() {
        // 2026-05-13: CA is the launch state; both CA and MA are
        // supported peers in SNAPCoveragePolicy.supportedStateCodes.
        #expect(SNAPCoveragePolicy.isStateInScope("CA"))
    }

    @Test func lowercaseCAIsInScope() {
        #expect(SNAPCoveragePolicy.isStateInScope("ca"))
    }

    @Test func newYorkIsOutOfScope() {
        #expect(!SNAPCoveragePolicy.isStateInScope("NY"))
    }

    @Test func otherBucketIsOutOfScope() {
        #expect(!SNAPCoveragePolicy.isStateInScope("OTHER"))
    }

    @Test func nilIsOutOfScope() {
        #expect(!SNAPCoveragePolicy.isStateInScope(nil))
    }

    // MARK: - Gate predicate (nil-is-pre-question)

    /// The gate predicate intentionally returns false for nil so a
    /// user who hasn't picked a state yet reaches the state picker
    /// rather than the unsupported-state view. Matches the
    /// orchestrator's nil-state-is-pre-question pattern.
    @Test func gateStaysOutOfWayForNilState() {
        #expect(!SNAPCoveragePolicy.shouldShowUnsupportedStateGate(for: nil))
    }

    @Test func gateStaysOutOfWayForInScopeState() {
        #expect(!SNAPCoveragePolicy.shouldShowUnsupportedStateGate(for: "MA"))
        #expect(!SNAPCoveragePolicy.shouldShowUnsupportedStateGate(for: "ma"))
        #expect(!SNAPCoveragePolicy.shouldShowUnsupportedStateGate(for: "CA"))
        #expect(!SNAPCoveragePolicy.shouldShowUnsupportedStateGate(for: "ca"))
    }

    @Test func gateFiresForOutOfScopeState() {
        #expect(SNAPCoveragePolicy.shouldShowUnsupportedStateGate(for: "NY"))
        #expect(SNAPCoveragePolicy.shouldShowUnsupportedStateGate(for: "TX"))
        #expect(SNAPCoveragePolicy.shouldShowUnsupportedStateGate(for: "OTHER"))
    }

    // MARK: - Launch-time invalidation

    @MainActor
    @Test(.enabled(if: keychainAvailableForTests))
    func launchTimePurgeRemovesVerdictWhenStateIsOutOfScope() {
        // Arrange: persisted NY (out-of-scope) draft + Keychain
        // verdict from a prior session (simulates the user who
        // picked an unsupported state, ran the screener via an
        // older build, then upgraded to a version with the
        // current supported-state gate).
        let draftStore = SNAPApplicationDraftStore()
        var state = SNAPApplicationDraftStore.PersistedState(
            draft: SNAPApplicationDraft(),
            mode: .sequential,
            sequentialSection: .whereApplying
        )
        state.draft.whereApplying.stateCode = "NY"
        draftStore.save(state)

        SNAPEligibilityResultKeychainStore.save(Self.makeSampleResult())
        #expect(SNAPEligibilityResultKeychainStore.load() != nil)

        defer {
            draftStore.clear()
            SNAPEligibilityResultKeychainStore.delete()
        }

        // Act
        CivicaUserData.purgeOutOfScopeEligibilityData()

        // Assert: verdict gone; draft preserved (user can still
        // change state via the unsupported-state view's CTA).
        #expect(SNAPEligibilityResultKeychainStore.load() == nil)
        #expect(draftStore.load()?.draft.whereApplying.stateCode == "NY")
    }

    @MainActor
    @Test(.enabled(if: keychainAvailableForTests))
    func launchTimePurgePreservesVerdictWhenStateIsInScope() {
        let draftStore = SNAPApplicationDraftStore()
        var state = SNAPApplicationDraftStore.PersistedState(
            draft: SNAPApplicationDraft(),
            mode: .sequential,
            sequentialSection: .whereApplying
        )
        state.draft.whereApplying.stateCode = "MA"
        draftStore.save(state)

        let sample = Self.makeSampleResult()
        SNAPEligibilityResultKeychainStore.save(sample)

        defer {
            draftStore.clear()
            SNAPEligibilityResultKeychainStore.delete()
        }

        CivicaUserData.purgeOutOfScopeEligibilityData()

        // MA verdict survives.
        #expect(SNAPEligibilityResultKeychainStore.load()?.monthlyBenefit == sample.monthlyBenefit)
    }

    @MainActor
    @Test(.enabled(if: keychainAvailableForTests))
    func launchTimePurgePreservesVerdictWhenStateIsNil() {
        // Pre-question users — no recorded state yet — must not lose
        // a verdict on app launch. (In practice this branch is rare
        // since a verdict only persists after the screener completes,
        // which requires a state pick. Guard anyway.)
        let draftStore = SNAPApplicationDraftStore()
        draftStore.clear()

        let sample = Self.makeSampleResult()
        SNAPEligibilityResultKeychainStore.save(sample)

        defer {
            SNAPEligibilityResultKeychainStore.delete()
        }

        CivicaUserData.purgeOutOfScopeEligibilityData()

        #expect(SNAPEligibilityResultKeychainStore.load()?.monthlyBenefit == sample.monthlyBenefit)
    }

    // MARK: - Helpers

    private static func makeSampleResult() -> SNAPEligibilityResult {
        SNAPEligibilityResult(
            status: .eligible,
            monthlyBenefit: 285,
            expeditedEligible: false,
            contributingFactors: ["ma_bbce_200pct_applied"],
            requiredVerifications: [],
            benefitCalculation: nil,
            ineligibilityReason: nil,
            effectiveDate: "2026-05-12",
            rulesVersion: "MA-bbce-200pct-FY26"
        )
    }
}
