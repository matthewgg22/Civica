import Foundation
import Testing
@testable import Civica

// Issue #423 Phase 1 — Tier A SSN metadata: hasSSN + noSSNReason.
//
// These tests pin the flow's branching contract: the noSSNReason
// screen is asked ONLY when hasSSN == .no, the answer model clears
// stale noSSNReason if the user changes their hasSSN choice, and
// neither field gates `isComplete` (Tier A is optional metadata).
//
// PRIVACY: these tests deliberately do NOT touch any SSN-digit
// surface — there is no such surface. The Phase 1 model is
// metadata-only, by design. See the privacy-firewall block in
// SNAPHouseholdQuestionFlow.swift.

@MainActor
struct SNAPHouseholdSSNIntentTests {

    // MARK: - Flow branching

    @Test("hasSSN == .yes → advance skips noSSNReason and lands on migrantFarmworker")
    func advance_hasSSNYes_skipsNoSSNReason() {
        let vm = SNAPHouseholdQuestionFlowViewModel()
        vm.step = .ssnIntent
        vm.answers.hasSSN = .yes
        vm.advance()
        #expect(vm.step == .migrantFarmworker)
    }

    @Test("hasSSN == .notSure (applied for one) → advance also skips noSSNReason")
    func advance_hasSSNAppliedForOne_skipsNoSSNReason() {
        let vm = SNAPHouseholdQuestionFlowViewModel()
        vm.step = .ssnIntent
        vm.answers.hasSSN = .notSure
        vm.advance()
        #expect(vm.step == .migrantFarmworker)
    }

    @Test("hasSSN == .no → advance lands on noSSNReason")
    func advance_hasSSNNo_landsOnNoSSNReason() {
        let vm = SNAPHouseholdQuestionFlowViewModel()
        vm.step = .ssnIntent
        vm.answers.hasSSN = .no
        vm.advance()
        #expect(vm.step == .noSSNReason)
    }

    @Test("goBack from migrantFarmworker mirrors the forward skip (hasSSN != .no → ssnIntent)")
    func goBack_migrantFarmworker_mirrorsForwardSkip() {
        let vm = SNAPHouseholdQuestionFlowViewModel()
        vm.step = .migrantFarmworker
        vm.answers.hasSSN = .yes
        vm.goBack()
        #expect(vm.step == .ssnIntent)
    }

    @Test("goBack from migrantFarmworker when hasSSN == .no goes through noSSNReason")
    func goBack_migrantFarmworker_passesNoSSNReasonWhenAnswered() {
        let vm = SNAPHouseholdQuestionFlowViewModel()
        vm.step = .migrantFarmworker
        vm.answers.hasSSN = .no
        vm.answers.noSSNReason = .religiousObjection
        vm.goBack()
        #expect(vm.step == .noSSNReason)
    }

    // MARK: - canAdvanceFromCurrentStep

    @Test("canAdvance is false on ssnIntent until hasSSN is set")
    func canAdvance_ssnIntent_requiresHasSSN() {
        let vm = SNAPHouseholdQuestionFlowViewModel()
        vm.step = .ssnIntent
        #expect(vm.canAdvanceFromCurrentStep == false)
        vm.answers.hasSSN = .yes
        #expect(vm.canAdvanceFromCurrentStep == true)
    }

    @Test("canAdvance is false on noSSNReason until noSSNReason is set")
    func canAdvance_noSSNReason_requiresAnswer() {
        let vm = SNAPHouseholdQuestionFlowViewModel()
        vm.step = .noSSNReason
        vm.answers.hasSSN = .no
        #expect(vm.canAdvanceFromCurrentStep == false)
        vm.answers.noSSNReason = .usCitizenNeverApplied
        #expect(vm.canAdvanceFromCurrentStep == true)
    }

    // MARK: - isComplete (Tier A is optional metadata)

    @Test("SSN fields are NOT required for isComplete (Tier A is optional)")
    func isComplete_doesNotRequireSSNFields() {
        var answers = SNAPHouseholdAnswers()
        answers.householdSize = "Just me"
        answers.hasMinorInHousehold = false
        answers.hasElderlyOrDisabled = false
        answers.migrantSeasonalFarmworker = .no
        // hasSSN + noSSNReason left nil
        #expect(answers.isComplete == true)
    }
}
