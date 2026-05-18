import Foundation
import Testing
@testable import Civica

// Locks in the deduction-stack math (port of 7 CFR 273 / Python
// _compute_net_income). Each test case lists the expected value
// of every field on SNAPBenefitCalculationDetail so a regression
// in any single step (earned-income deduction, shelter cap,
// 30%-of-net rounding, minimum benefit kick-in) is visible.

struct SNAPBenefitCalculatorTests {

    private let fy26Date = Self.iso("2026-03-15")

    // MARK: - Simple MA eligible (no expenses)

    /// MA, size 2, gross $1500, no expenses, no elderly/disabled.
    ///   earned_deduction = 1500 * 0.20            = 300
    ///   standard         (size 2)                  = 209
    ///   adjusted         = 1500 - 300 - 209        = 991
    ///   half_adjusted    = 495.5
    ///   shelter          = 0 (no rent/utilities)   = 0
    ///   excess_shelter   = 0
    ///   net              = 1500 - 300 - 209 - 0    = 991
    ///   30% of net       = round(991 * 0.30)       = 297 (round half up)
    ///   max_allotment    (size 2)                  = 546
    ///   monthly_benefit  = 546 - 297               = 249
    @Test func maSimpleEligibleNoExpenses() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 1_500
        draft.household.hasElderlyOrDisabled = false

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: MAStateRules(),
            today: fy26Date
        )

        #expect(calc.grossMonthlyIncome == 1_500)
        #expect(calc.earnedIncomeDeduction == 300)
        #expect(calc.standardDeduction == 209)
        #expect(calc.dependentCareDeduction == 0)
        #expect(calc.medicalDeduction == 0)
        #expect(calc.childSupportDeduction == 0)
        #expect(calc.excessShelterDeduction == 0)
        #expect(calc.netMonthlyIncome == 991)
        #expect(calc.thirtyPercentOfNet == 297)
        #expect(calc.maxAllotmentForHouseholdSize == 546)
        #expect(calc.monthlyBenefit == 249)
    }

    // MARK: - MA with rent only (no utilities → no SUA)

    /// Rent $800, utilities $0. SUA does NOT apply because the
    /// household declared no utility cost. Shelter = rent only.
    ///   adjusted   = 991 (same as above)
    ///   half_adj   = 495.5
    ///   shelter    = 800 + 0                       = 800
    ///   raw excess = 800 - 495.5                   = 304.5
    ///   excess     = min(304.5, 744 federal cap)   = 304.5 → round 305
    ///   net        = 991 - 304.5                   = 686.5 → round 687
    ///   30% of net = round(686.5 * 0.30)           = round(205.95) = 206
    ///   benefit    = 546 - 206                     = 340
    @Test func maRentOnlyNoUtilitiesGetsNoSUA() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 1_500
        draft.expenses.monthlyRentOrHousing = 800
        draft.expenses.monthlyUtilities = 0

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: MAStateRules(),
            today: fy26Date
        )

        #expect(calc.excessShelterDeduction == 305)
        #expect(calc.netMonthlyIncome == 687)
        #expect(calc.thirtyPercentOfNet == 206)
        #expect(calc.monthlyBenefit == 340)
    }

    // MARK: - MA with rent + utilities (SUA kicks in)

    /// Rent $800, utilities $100 → SUA heatingCooling ($799) applies
    /// because it's larger than $100.
    ///   shelter      = 800 + max(100, 799)         = 1599
    ///   half_adj     = 495.5
    ///   raw excess   = 1599 - 495.5                = 1103.5
    ///   excess (cap) = min(1103.5, 744)            = 744
    ///   net          = 991 - 744                   = 247
    ///   30% of net   = round(247 * 0.30)           = round(74.1) = 74
    ///   benefit      = 546 - 74                    = 472
    @Test func maWithRentAndUtilitiesSubstitutesSUA() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 1_500
        draft.expenses.monthlyRentOrHousing = 800
        draft.expenses.monthlyUtilities = 100

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: MAStateRules(),
            today: fy26Date
        )

        #expect(calc.excessShelterDeduction == 744)
        #expect(calc.netMonthlyIncome == 247)
        #expect(calc.monthlyBenefit == 472)
    }

    // MARK: - Elderly/disabled removes the shelter cap

    /// Same shelter math as above but no cap — full excess shelter
    /// deducts.
    ///   shelter    = 800 + max(100, 799)           = 1599
    ///   raw excess = 1599 - 495.5                  = 1103.5
    ///   excess     = 1103.5 (no cap for elderly/disabled) → round 1104
    ///   net        = 991 - 1103.5                  = -112.5 → 0
    ///   30% of net = 0
    ///   benefit    = 546 - 0                       = 546
    @Test func elderlyDisabledHasNoShelterCap() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 1_500
        draft.household.hasElderlyOrDisabled = true
        draft.expenses.monthlyRentOrHousing = 800
        draft.expenses.monthlyUtilities = 100

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: MAStateRules(),
            today: fy26Date
        )

        #expect(calc.excessShelterDeduction == 1_104)
        #expect(calc.netMonthlyIncome == 0)
        #expect(calc.thirtyPercentOfNet == 0)
        #expect(calc.monthlyBenefit == 546)
    }

    // MARK: - Federal default has no SUA

    /// Same inputs as maWithRentAndUtilities but stateCode "CA"
    /// (federal default rules). FederalDefaultRules.suaValue
    /// always returns nil, so effective utility = actual = $100.
    ///   shelter    = 800 + 100                     = 900
    ///   half_adj   = 495.5
    ///   raw excess = 900 - 495.5                   = 404.5
    ///   excess     = min(404.5, 744)               = 404.5 → round 405
    ///   net        = 991 - 404.5                   = 586.5 → round 587
    ///   30% of net = round(586.5 * 0.30)           = round(175.95) = 176
    ///   benefit    = 546 - 176                     = 370
    @Test func federalDefaultUsesActualUtilitiesNotSUA() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 1_500
        draft.expenses.monthlyRentOrHousing = 800
        draft.expenses.monthlyUtilities = 100

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: FederalDefaultRules(),
            today: fy26Date
        )

        #expect(calc.excessShelterDeduction == 405)
        #expect(calc.netMonthlyIncome == 587)
        #expect(calc.thirtyPercentOfNet == 176)
        #expect(calc.monthlyBenefit == 370)
    }

    // MARK: - Minimum benefit kicks in for size 1-2

    /// Size 1, gross $1440 → benefit math produces $15, which is
    /// below the $24 federal minimum. Eligible 1- and 2-person
    /// households get bumped to the minimum.
    ///   earned_deduction = 1440 * 0.20             = 288
    ///   standard         (size 1)                  = 209
    ///   adjusted         = 1440 - 288 - 209        = 943
    ///   shelter          = 0
    ///   net              = 943
    ///   30% of net       = round(943 * 0.30)       = round(282.9) = 283
    ///   max_allotment    (size 1)                  = 298
    ///   raw benefit      = 298 - 283               = 15
    ///   final benefit    (min applies)             = 24
    @Test func minimumBenefitKicksInForSmallHouseholds() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 1_440

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: MAStateRules(),
            today: fy26Date
        )

        #expect(calc.monthlyBenefit == 24)
    }

    // MARK: - Zero benefit for high-income eligible household

    /// MA size 2, gross $2600 — eligible under BBCE ($3408 limit)
    /// but the math produces a negative raw benefit that floors
    /// at $0. Size 3+ would stay $0; size 1-2 would normally bump
    /// to the minimum, but the min only applies when computed
    /// benefit > 0. A zero floor stays zero.
    ///   earned_deduction = 520
    ///   adjusted         = 2600 - 520 - 209        = 1871
    ///   net              = 1871 (no shelter expenses)
    ///   30% of net       = round(1871 * 0.30)      = round(561.3) = 561
    ///   raw benefit      = 546 - 561               = -15 → 0
    @Test func zeroBenefitWhenIncomeTooHighRelativeToAllotment() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 2_600

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: MAStateRules(),
            today: fy26Date
        )

        #expect(calc.monthlyBenefit == 0)
    }

    // MARK: - Medical deduction for elderly/disabled

    /// $100 monthly medical, household has elderly/disabled.
    /// Federal $35 floor applies → deductible = $100 - $35 = $65.
    @Test func medicalDeductionAppliesAbove35FloorWhenElderlyOrDisabled() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 1_500
        draft.household.hasElderlyOrDisabled = true
        draft.expenses.monthlyMedical = 100

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: MAStateRules(),
            today: fy26Date
        )

        #expect(calc.medicalDeduction == 65)
    }

    /// Same expenses but no elderly/disabled flag — medical
    /// deduction does not apply at all.
    @Test func medicalDeductionDoesNotApplyWithoutElderlyOrDisabled() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 1_500
        draft.household.hasElderlyOrDisabled = false
        draft.expenses.monthlyMedical = 100

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: MAStateRules(),
            today: fy26Date
        )

        #expect(calc.medicalDeduction == 0)
    }

    /// Medical at or below the $35 floor is not deductible.
    @Test func medicalAtOrBelow35IsNotDeductible() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 1_500
        draft.household.hasElderlyOrDisabled = true
        draft.expenses.monthlyMedical = 35

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: MAStateRules(),
            today: fy26Date
        )

        #expect(calc.medicalDeduction == 0)
    }

    // MARK: - Earned-income split

    /// anyoneEarning == .no → earned = $0 → no 20% deduction.
    ///   earned_deduction = 0
    ///   standard         (size 2)                  = 209
    ///   adjusted         = 1500 - 0 - 209          = 1291
    ///   net              = 1291
    ///   30% of net       = round(1291 * 0.30)      = round(387.3) = 387
    ///   benefit          = 546 - 387               = 159
    @Test func anyoneEarningNoMeansZeroEarnedDeduction() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 1_500
        draft.income.anyoneEarning = .no // explicit no earners

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: MAStateRules(),
            today: fy26Date
        )

        #expect(calc.earnedIncomeDeduction == 0)
        #expect(calc.monthlyBenefit == 159)
    }

    /// Explicit split: gross $1500, but only $800 is earned.
    ///   earned_deduction = 800 * 0.20             = 160
    ///   standard         (size 2)                  = 209
    ///   adjusted         = 1500 - 160 - 209        = 1131
    ///   net              = 1131
    ///   30% of net       = round(1131 * 0.30)     = round(339.3) = 339
    ///   benefit          = 546 - 339               = 207
    @Test func explicitEarnedAmountUsedWhenSet() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 1_500
        draft.income.monthlyEarnedAmount = 800

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: MAStateRules(),
            today: fy26Date
        )

        #expect(calc.earnedIncomeDeduction == 160)
        #expect(calc.monthlyBenefit == 207)
    }

    /// Explicit earned > gross: clamped to gross.
    @Test func explicitEarnedAmountAboveGrossIsClampedToGross() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 1_500
        draft.income.monthlyEarnedAmount = 5_000 // > gross

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: MAStateRules(),
            today: fy26Date
        )

        // Clamped to gross = 1500 → 20% = 300
        #expect(calc.earnedIncomeDeduction == 300)
    }

    /// Default fallback (no flags set) treats all gross as earned.
    /// Equivalent to the original "permissive default" behavior.
    @Test func unspecifiedEarningDefaultsToFullyEarned() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 1_500
        // No anyoneEarning, no monthlyEarnedAmount.

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: MAStateRules(),
            today: fy26Date
        )

        // 1500 * 0.20 = 300
        #expect(calc.earnedIncomeDeduction == 300)
    }

    // MARK: - Dependent care flows through

    @Test func dependentCareDeductsFromGross() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "3 people"
        draft.income.grossMonthlyIncome = 2_000
        draft.expenses.monthlyChildcare = 250

        let calc = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: MAStateRules(),
            today: fy26Date
        )

        #expect(calc.dependentCareDeduction == 250)
    }

    // MARK: - Helpers

    private static func iso(_ string: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f.date(from: string)!
    }
}
