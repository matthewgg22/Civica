import Foundation
import Testing
@testable import Civica

// Issue #425: every sub-flow VM that owns a SNAPApplicationDraft slice
// must fire its `onAnswersChange` closure on EACH mutation of
// `answers`, not only on section-complete. The orchestrator's
// existing `.onChange(of: viewModel.draft)` + scenePhase backstop
// then persist mid-flow edits to UserDefaults, so a kill mid-screen
// resumes with the latest typed value instead of jumping back to
// the section start.
//
// These tests pin the contract on each of the 8 sub-flow VMs.
// They DELIBERATELY use a stub closure that captures the most
// recent emitted value — that's the orchestrator-facing surface
// the production code now relies on.

@MainActor
struct SNAPSubFlowWriteThroughTests {

    // MARK: - household

    @Test("Household VM fires onAnswersChange when answers mutate")
    func householdVM_writesThroughOnMutation() {
        var last: SNAPHouseholdAnswers?
        let vm = SNAPHouseholdQuestionFlowViewModel(
            answers: .init(),
            onAnswersChange: { last = $0 }
        )
        // Initial seed must NOT fire (dropFirst).
        #expect(last == nil)
        vm.answers.householdSize = "Just me"
        #expect(last?.householdSize == "Just me")
        vm.answers.hasMinorInHousehold = false
        #expect(last?.hasMinorInHousehold == false)
    }

    // MARK: - whereApplying

    @Test("WhereApplying VM writes through state-code edits")
    func whereApplyingVM_writesThroughOnMutation() {
        var last: SNAPWhereApplyingAnswers?
        let vm = SNAPWhereApplyingFlowViewModel(
            answers: .init(),
            onAnswersChange: { last = $0 }
        )
        #expect(last == nil)
        vm.answers.stateCode = "CA"
        #expect(last?.stateCode == "CA")
    }

    // MARK: - applicantAge

    @Test("ApplicantAge VM writes through DOB edits")
    func applicantAgeVM_writesThroughOnMutation() {
        var last: SNAPApplicantAgeAnswers?
        let vm = SNAPApplicantAgeFlowViewModel(
            answers: .init(),
            onAnswersChange: { last = $0 }
        )
        #expect(last == nil)
        let dob = Date(timeIntervalSince1970: 0)
        vm.answers.dateOfBirth = dob
        #expect(last?.dateOfBirth == dob)
    }

    // MARK: - contact

    @Test("Contact VM writes through email + phone edits")
    func contactVM_writesThroughOnMutation() {
        var last: SNAPContactAnswers?
        let vm = SNAPContactFlowViewModel(
            answers: .init(),
            onAnswersChange: { last = $0 }
        )
        #expect(last == nil)
        vm.answers.email = "user@example.com"
        #expect(last?.email == "user@example.com")
        vm.answers.phone = "5551234567"
        #expect(last?.phone == "5551234567")
    }

    // MARK: - income

    @Test("Income VM writes through gross + earning-presence edits")
    func incomeVM_writesThroughOnMutation() {
        var last: SNAPIncomeAnswers?
        let vm = SNAPIncomeFlowViewModel(
            answers: .init(),
            paystubPrefill: nil,
            onAnswersChange: { last = $0 }
        )
        #expect(last == nil)
        vm.answers.grossMonthlyIncome = 1500
        #expect(last?.grossMonthlyIncome == 1500)
        vm.answers.anyoneEarning = .yes
        #expect(last?.anyoneEarning == .yes)
    }

    // MARK: - studentStatus

    @Test("StudentStatus VM writes through enrollment edits")
    func studentStatusVM_writesThroughOnMutation() {
        var last: SNAPStudentStatusAnswers?
        let vm = SNAPStudentStatusFlowViewModel(
            answers: .init(),
            onAnswersChange: { last = $0 }
        )
        #expect(last == nil)
        vm.answers.enrolledInHigherEd = true
        #expect(last?.enrolledInHigherEd == true)
    }

    // MARK: - expenses

    @Test("Expenses VM writes through rent + selectedUtilities edits")
    func expensesVM_writesThroughOnMutation() {
        var last: SNAPExpensesAnswers?
        let vm = SNAPExpensesFlowViewModel(
            answers: .init(),
            hasMinorInHousehold: false,
            hasElderlyOrDisabled: false,
            housingStatus: nil,
            onAnswersChange: { last = $0 }
        )
        #expect(last == nil)
        vm.answers.monthlyRentOrHousing = 800
        #expect(last?.monthlyRentOrHousing == 800)
        vm.answers.selectedUtilities = [.heatFuel]
        #expect(last?.selectedUtilities == [.heatFuel])
    }

    // MARK: - documentsChecklist

    @Test("DocumentsChecklist VM writes through documentsAvailable edits")
    func documentsChecklistVM_writesThroughOnMutation() {
        var last: SNAPDocumentsChecklistAnswers?
        let vm = SNAPDocumentsChecklistFlowViewModel(
            answers: .init(),
            draft: .init(),
            onAnswersChange: { last = $0 }
        )
        #expect(last == nil)
        vm.answers.documentsAvailable.insert(.photoID)
        #expect(last?.documentsAvailable.contains(.photoID) == true)
    }

    // MARK: - nil-closure path (legacy callers still work)

    @Test("Sub-flow VMs accept a nil onAnswersChange (legacy callers + previews)")
    func nilCallback_doesNotCrash() {
        // Construct each VM with no callback. None should crash on
        // mutation; the publisher just no-ops the optional closure.
        let h = SNAPHouseholdQuestionFlowViewModel()
        h.answers.householdSize = "Just me"

        let w = SNAPWhereApplyingFlowViewModel()
        w.answers.stateCode = "CA"

        let a = SNAPApplicantAgeFlowViewModel()
        a.answers.dateOfBirth = Date(timeIntervalSince1970: 0)

        let c = SNAPContactFlowViewModel()
        c.answers.email = "x@y.com"

        let i = SNAPIncomeFlowViewModel(paystubPrefill: nil)
        i.answers.grossMonthlyIncome = 1
    }
}
