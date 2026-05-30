import Foundation
import Testing
@testable import Civica

// SNAPStudentStatusFlow — LPIE fast-path + navigation tests
//
// CA LPIE (Low-Income Student Pathway to Improved Enrollment):
// Half-time students at CA Community Colleges, CSU, or UC campuses
// automatically satisfy the CalFresh student exemption when the
// server-side `lpie_auto_exempt_enabled` flag is on (defaulting true).
//
// This test suite verifies:
//   1. Normal (non-LPIE) student flow navigation is unaffected
//   2. halfTime=no skips degreeProgram straight to twentyHours
//   3. LPIE fires correctly (lpieWouldFire, lpieExemptionFired)
//   4. LPIE fast-path calls onComplete immediately (isComplete)
//   5. Non-CCC/CSU/UC students fall through to federal screens
//   6. goBack() routes correctly from twentyHours based on path taken
//   7. visibleTotal reflects the 7-step total (incl. jobProgram, PARITY-AUDIT.md Gap 1)

@Suite("SNAPStudentStatusFlow — LPIE fast-path")
@MainActor
struct SNAPStudentStatusFlowTests {

    // Isolated UserDefaults to avoid bleed between tests
    private static let testSuiteName = "SNAPStudentStatusFlowTests"
    private static var testDefaults: UserDefaults {
        UserDefaults(suiteName: testSuiteName)!
    }

    init() {
        LPIEFeatureFlag.setStore(Self.testDefaults)
        LPIEFeatureFlag.setCachedValue(true)  // default: flag on
    }

    // MARK: - Non-student fast-exit

    @Test("Non-student: advance from enrollment sets isComplete immediately")
    func nonStudent_advanceFromEnrollment_completesImmediately() {
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledInHigherEd = false
        vm.advance()
        #expect(vm.isComplete == true)
        #expect(vm.lpieExemptionFired == false)
    }

    // MARK: - Normal student flow (halfTime=no → skip degreeProgram)

    @Test("halfTime=no: advance goes to twentyHours, not degreeProgram")
    func halfTimeNo_advanceGoesToTwentyHours() {
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledInHigherEd = true
        vm.advance()  // enrollment → halfTime
        #expect(vm.step == .halfTime)
        vm.answers.enrolledHalfTime = false
        vm.advance()  // halfTime=no → skip degreeProgram
        #expect(vm.step == .twentyHours)
    }

    @Test("halfTime=no: degreeOrCertificateProgram cleared when skipping")
    func halfTimeNo_degreeProgramCleared() {
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledInHigherEd = true
        vm.answers.enrolledHalfTime = false
        vm.answers.degreeOrCertificateProgram = true  // stale value
        vm.step = .halfTime
        vm.advance()
        #expect(vm.answers.degreeOrCertificateProgram == nil)
        #expect(vm.step == .twentyHours)
    }

    @Test("halfTime=yes: advance goes to degreeProgram")
    func halfTimeYes_advanceGoesToDegreeProgram() {
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledInHigherEd = true
        vm.advance()  // enrollment → halfTime
        vm.answers.enrolledHalfTime = true
        vm.advance()  // halfTime=yes → degreeProgram
        #expect(vm.step == .degreeProgram)
    }

    // MARK: - LPIE fast-path (halfTime=yes + CCC/CSU/UC + flag on)

    @Test("LPIE: lpieWouldFire true when halfTime=yes, degreeProgram=yes, flag on")
    func lpieWouldFire_allConditionsMet() {
        LPIEFeatureFlag.setCachedValue(true)
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledHalfTime = true
        vm.answers.degreeOrCertificateProgram = true
        #expect(vm.lpieWouldFire == true)
    }

    @Test("LPIE: lpieWouldFire false when flag is off")
    func lpieWouldFire_flagOff_isFalse() {
        LPIEFeatureFlag.setCachedValue(false)
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledHalfTime = true
        vm.answers.degreeOrCertificateProgram = true
        #expect(vm.lpieWouldFire == false)
    }

    @Test("LPIE: lpieWouldFire false when degreeProgram=false")
    func lpieWouldFire_degreeProgramFalse_isFalse() {
        LPIEFeatureFlag.setCachedValue(true)
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledHalfTime = true
        vm.answers.degreeOrCertificateProgram = false
        #expect(vm.lpieWouldFire == false)
    }

    @Test("LPIE: advance from degreeProgram with conditions met sets isComplete + lpieExemptionFired")
    func lpie_advance_setsCompletionFlags() {
        LPIEFeatureFlag.setCachedValue(true)
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledInHigherEd = true
        vm.answers.enrolledHalfTime = true
        vm.answers.degreeOrCertificateProgram = true
        vm.step = .degreeProgram
        vm.advance()
        #expect(vm.isComplete == true)
        #expect(vm.lpieExemptionFired == true)
    }

    @Test("LPIE: advance does NOT complete when flag is off — falls through to federal screens")
    func lpie_flagOff_fallsThroughToFederalScreens() {
        LPIEFeatureFlag.setCachedValue(false)
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledInHigherEd = true
        vm.answers.enrolledHalfTime = true
        vm.answers.degreeOrCertificateProgram = true
        vm.step = .degreeProgram
        vm.advance()
        #expect(vm.isComplete == false)
        #expect(vm.lpieExemptionFired == false)
        #expect(vm.step == .twentyHours)
    }

    // MARK: - Non-CCC/CSU/UC fall-through (degreeProgram=no → federal screens)

    @Test("Non-CCC student: degreeProgram=no advances to twentyHours")
    func nonCCC_degreeProgramNo_advancesToTwentyHours() {
        LPIEFeatureFlag.setCachedValue(true)
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledInHigherEd = true
        vm.answers.enrolledHalfTime = true
        vm.answers.degreeOrCertificateProgram = false  // not at CCC/CSU/UC
        vm.step = .degreeProgram
        vm.advance()
        #expect(vm.isComplete == false)
        #expect(vm.step == .twentyHours)
    }

    // MARK: - goBack() routing

    @Test("goBack from twentyHours (via degreeProgram path) goes to degreeProgram")
    func goBack_fromTwentyHours_viaDegreeProgram_goesToDegreeProgram() {
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledHalfTime = true  // came via degreeProgram
        vm.step = .twentyHours
        vm.goBack()
        #expect(vm.step == .degreeProgram)
    }

    @Test("goBack from twentyHours (halfTime=no path) goes to halfTime")
    func goBack_fromTwentyHours_halfTimeNoPath_goesToHalfTime() {
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledHalfTime = false  // skipped degreeProgram
        vm.step = .twentyHours
        vm.goBack()
        #expect(vm.step == .halfTime)
    }

    @Test("goBack from degreeProgram goes to halfTime")
    func goBack_fromDegreeProgram_goesToHalfTime() {
        let vm = SNAPStudentStatusFlowViewModel()
        vm.step = .degreeProgram
        vm.goBack()
        #expect(vm.step == .halfTime)
    }

    // MARK: - canAdvanceFromCurrentStep

    @Test("canAdvance false when degreeOrCertificateProgram is nil")
    func canAdvance_degreeProgramNil_isFalse() {
        let vm = SNAPStudentStatusFlowViewModel()
        vm.step = .degreeProgram
        vm.answers.degreeOrCertificateProgram = nil
        #expect(vm.canAdvanceFromCurrentStep == false)
    }

    @Test("canAdvance true when degreeOrCertificateProgram is set (true or false)")
    func canAdvance_degreeProgramSet_isTrue() {
        let vm = SNAPStudentStatusFlowViewModel()
        vm.step = .degreeProgram
        vm.answers.degreeOrCertificateProgram = true
        #expect(vm.canAdvanceFromCurrentStep == true)
        vm.answers.degreeOrCertificateProgram = false
        #expect(vm.canAdvanceFromCurrentStep == true)
    }

    // MARK: - visibleTotal

    @Test("visibleTotal is 7 for enrolled students (Step.total: enrollment, halfTime, degreeProgram, twentyHours, workStudy, dependentChild, jobProgram)")
    func visibleTotal_enrolledStudent_isSeven() {
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledInHigherEd = true
        #expect(vm.visibleTotal == SNAPStudentStatusFlowViewModel.Step.total)
        #expect(SNAPStudentStatusFlowViewModel.Step.total == 7)
    }

    // PARITY-AUDIT.md Gap 1: jobProgram is the new last federal screen
    // and the flow's functional last step for a non-LPIE enrolled student.
    @Test("canAdvance gated on inApprovedJobProgram; jobProgram is the functional last step")
    func jobProgram_canAdvanceAndIsLastStep() {
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledInHigherEd = true
        vm.step = .jobProgram
        #expect(vm.canAdvanceFromCurrentStep == false)
        vm.answers.inApprovedJobProgram = true
        #expect(vm.canAdvanceFromCurrentStep == true)
        #expect(vm.isAtFunctionalLastStep == true)
    }

    @Test("visibleTotal is 1 for non-students")
    func visibleTotal_nonStudent_isOne() {
        let vm = SNAPStudentStatusFlowViewModel()
        vm.answers.enrolledInHigherEd = false
        #expect(vm.visibleTotal == 1)
    }

    // MARK: - String content

    @Test("degreeProgramTitle is non-empty in both languages")
    func degreeProgramTitle_nonEmpty() {
        #expect(!SNAPStudentStatusStrings.degreeProgramTitle.value(in: .english).isEmpty)
        #expect(!SNAPStudentStatusStrings.degreeProgramTitle.value(in: .spanish).isEmpty)
    }

    @Test("lpieCalloutTitle mentions automatic qualification in English")
    func lpieCalloutTitle_mentionsAutomatic() {
        let title = SNAPStudentStatusStrings.lpieCalloutTitle.value(in: .english)
        #expect(title.lowercased().contains("automatically") || title.lowercased().contains("qualify"))
    }

    @Test("lpieCalloutBody mentions CCC in English")
    func lpieCalloutBody_mentionsCCC() {
        let body = SNAPStudentStatusStrings.lpieCalloutBody.value(in: .english)
        #expect(body.contains("CCC") || body.contains("Community College"))
    }
}
