import Foundation
import Testing
@testable import Civica

// End-to-end regression net for SNAPLocalEligibilityEvaluator.evaluate(...).
// This is the contract SNAPEligibilityIntroView and SNAPDecisionMathView
// depend on; treat any assertion change here as intentional behavior
// change, not a test-maintenance chore.

struct SNAPLocalEligibilityEvaluatorTests {

    private let fy26Date = Self.iso("2026-03-15")

    // MARK: - MA eligible path (the most common verdict)

    @Test func maHouseholdUnderBBCEThresholdIsEligible() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 1_500
        draft.studentStatus.enrolledInHigherEd = false

        let result = SNAPLocalEligibilityEvaluator.evaluate(draft, today: fy26Date)

        #expect(result.status == .eligible)
        #expect(result.rulesVersion == "MA-bbce-200pct-FY26")
        #expect(result.ineligibilityReason == nil)
        #expect(result.contributingFactors.contains("ma_bbce_200pct_applied"))
        #expect(result.contributingFactors.contains("gross_under_200_fpl"))
    }

    @Test func maHouseholdAtThresholdIsEligible() {
        // Boundary: income exactly equal to the threshold is eligible
        // (the gate is gross <= threshold).
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 3_408 // MA size-2 BBCE limit
        draft.studentStatus.enrolledInHigherEd = false

        let result = SNAPLocalEligibilityEvaluator.evaluate(draft, today: fy26Date)
        #expect(result.status == .eligible)
    }

    @Test func maHouseholdOneOverThresholdIsIneligible() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 3_409
        draft.studentStatus.enrolledInHigherEd = false

        let result = SNAPLocalEligibilityEvaluator.evaluate(draft, today: fy26Date)

        #expect(result.status == .ineligible)
        #expect(result.contributingFactors.contains("gross_over_200_fpl"))
        #expect(result.ineligibilityReason?.contains("Massachusetts") == true)
    }

    // MARK: - MA elderly/disabled bypass

    @Test func maHouseholdWithElderlyOrDisabledIsEligibleEvenAboveThreshold() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.household.hasElderlyOrDisabled = true
        draft.income.grossMonthlyIncome = 10_000 // well above any threshold
        draft.studentStatus.enrolledInHigherEd = false

        let result = SNAPLocalEligibilityEvaluator.evaluate(draft, today: fy26Date)

        #expect(result.status == .eligible)
        #expect(result.contributingFactors.contains("elderly_or_disabled_in_household"))
    }

    // MARK: - Student gate

    @Test func maStudentWithoutExceptionIsIneligible() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 500
        draft.studentStatus.enrolledInHigherEd = true
        draft.studentStatus.enrolledHalfTime = true
        draft.studentStatus.works20PlusHours = false
        draft.studentStatus.inWorkStudy = false
        draft.studentStatus.responsibleForDependentChild = false

        let result = SNAPLocalEligibilityEvaluator.evaluate(draft, today: fy26Date)

        #expect(result.status == .ineligible)
        #expect(result.contributingFactors.contains("student_no_exception"))
        #expect(result.ineligibilityReason?.contains("college students") == true)
    }

    @Test func maStudentWith20HourWorkContinuesToIncomeGate() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 500
        draft.studentStatus.enrolledInHigherEd = true
        draft.studentStatus.enrolledHalfTime = true
        draft.studentStatus.works20PlusHours = true

        let result = SNAPLocalEligibilityEvaluator.evaluate(draft, today: fy26Date)

        #expect(result.status == .eligible)
        #expect(result.contributingFactors.contains("student_exception_met"))
    }

    // MARK: - Expedited service

    @Test func veryLowIncomeFlagsExpedited() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 100 // < $150 federal expedited gate
        draft.studentStatus.enrolledInHigherEd = false

        let result = SNAPLocalEligibilityEvaluator.evaluate(draft, today: fy26Date)
        #expect(result.expeditedEligible == true)
        #expect(result.contributingFactors.contains("expedited_candidate"))
    }

    @Test func rentPlusUtilitiesOverIncomeFlagsExpedited() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 800
        draft.expenses.monthlyRentOrHousing = 700
        draft.expenses.monthlyUtilities = 200 // rent + utilities > income
        draft.studentStatus.enrolledInHigherEd = false

        let result = SNAPLocalEligibilityEvaluator.evaluate(draft, today: fy26Date)
        #expect(result.expeditedEligible == true)
    }

    @Test func adequateIncomeAndExpensesDoNotFlagExpedited() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 1_200
        draft.expenses.monthlyRentOrHousing = 500
        draft.expenses.monthlyUtilities = 100
        draft.studentStatus.enrolledInHigherEd = false

        let result = SNAPLocalEligibilityEvaluator.evaluate(draft, today: fy26Date)
        #expect(result.expeditedEligible == false)
    }

    // MARK: - Federal-default dispatch for non-MA states

    @Test func californiaUsesFederalBaselineThresholds() {
        // CA at $1700/mo size-2: MA gate (3408) would pass, but
        // federal 130% FPL size-2 gate (2214) also passes -- so this
        // is eligible. Pick a value that distinguishes the two gates.
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 2_500 // over federal 2214, under MA 3408
        draft.studentStatus.enrolledInHigherEd = false

        let result = SNAPLocalEligibilityEvaluator.evaluate(draft, today: fy26Date)

        #expect(result.status == .ineligible)
        #expect(result.rulesVersion == "federal-default-FY26")
        #expect(result.contributingFactors.contains("federal_default_applied"))
        #expect(result.ineligibilityReason?.contains("federal") == true)
    }

    @Test func nilStateCodeUsesFederalBaseline() {
        var draft = SNAPApplicationDraft()
        // No stateCode set.
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 800
        draft.studentStatus.enrolledInHigherEd = false

        let result = SNAPLocalEligibilityEvaluator.evaluate(draft, today: fy26Date)
        #expect(result.rulesVersion == "federal-default-FY26")
    }

    // MARK: - Helpers

    private static func iso(_ string: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f.date(from: string)!
    }
}
