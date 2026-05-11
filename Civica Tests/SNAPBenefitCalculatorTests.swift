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
    ///   standard         (size 2)                  = 204
    ///   adjusted         = 1500 - 300 - 204        = 996
    ///   half_adjusted    = 498
    ///   shelter          = 0 (no rent/utilities)   = 0
    ///   excess_shelter   = 0
    ///   net              = 1500 - 300 - 204 - 0    = 996
    ///   30% of net       = round(996 * 0.30)       = 299 (round half up)
    ///   max_allotment    (size 2)                  = 536
    ///   monthly_benefit  = 536 - 299               = 237
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
        #expect(calc.standardDeduction == 204)
        #expect(calc.dependentCareDeduction == 0)
        #expect(calc.medicalDeduction == 0)
        #expect(calc.childSupportDeduction == 0)
        #expect(calc.excessShelterDeduction == 0)
        #expect(calc.netMonthlyIncome == 996)
        #expect(calc.thirtyPercentOfNet == 299)
        #expect(calc.maxAllotmentForHouseholdSize == 536)
        #expect(calc.monthlyBenefit == 237)
    }

    // MARK: - MA with rent only (no utilities → no SUA)

    /// Rent $800, utilities $0. SUA does NOT apply because the
    /// household declared no utility cost. Shelter = rent only.
    ///   adjusted   = 996 (same as above)
    ///   half_adj   = 498
    ///   shelter    = 800 + 0                       = 800
    ///   raw excess = 800 - 498                     = 302
    ///   excess     = min(302, 712 federal cap)     = 302
    ///   net        = 996 - 302                     = 694
    ///   30% of net = round(694 * 0.30)             = 208
    ///   benefit    = 536 - 208                     = 328
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

        #expect(calc.excessShelterDeduction == 302)
        #expect(calc.netMonthlyIncome == 694)
        #expect(calc.thirtyPercentOfNet == 208)
        #expect(calc.monthlyBenefit == 328)
    }

    // MARK: - MA with rent + utilities (SUA kicks in)

    /// Rent $800, utilities $100 → SUA heatingCooling ($799) applies
    /// because it's larger than $100.
    ///   shelter      = 800 + max(100, 799)         = 1599
    ///   half_adj     = 498
    ///   raw excess   = 1599 - 498                  = 1101
    ///   excess (cap) = min(1101, 712)              = 712
    ///   net          = 996 - 712                   = 284
    ///   30% of net   = round(284 * 0.30)           = 85
    ///   benefit      = 536 - 85                    = 451
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

        #expect(calc.excessShelterDeduction == 712)
        #expect(calc.netMonthlyIncome == 284)
        #expect(calc.monthlyBenefit == 451)
    }

    // MARK: - Elderly/disabled removes the shelter cap

    /// Same shelter math as above but no cap — full excess shelter
    /// deducts.
    ///   shelter    = 800 + max(100, 799)           = 1599
    ///   raw excess = 1599 - 498                    = 1101
    ///   excess     = 1101 (no cap for elderly/disabled)
    ///   net        = 996 - 1101                    = -105 → 0
    ///   30% of net = 0
    ///   benefit    = 536 - 0                       = 536
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

        #expect(calc.excessShelterDeduction == 1_101)
        #expect(calc.netMonthlyIncome == 0)
        #expect(calc.thirtyPercentOfNet == 0)
        #expect(calc.monthlyBenefit == 536)
    }

    // MARK: - Federal default has no SUA

    /// Same inputs as maWithRentAndUtilities but stateCode "CA"
    /// (federal default rules). FederalDefaultRules.suaValue
    /// always returns nil, so effective utility = actual = $100.
    ///   shelter    = 800 + 100                     = 900
    ///   half_adj   = 498
    ///   raw excess = 900 - 498                     = 402
    ///   excess     = min(402, 712)                 = 402
    ///   net        = 996 - 402                     = 594
    ///   30% of net = round(594 * 0.30)             = 178
    ///   benefit    = 536 - 178                     = 358
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

        #expect(calc.excessShelterDeduction == 402)
        #expect(calc.netMonthlyIncome == 594)
        #expect(calc.thirtyPercentOfNet == 178)
        #expect(calc.monthlyBenefit == 358)
    }

    // MARK: - Minimum benefit kicks in for size 1-2

    /// Size 1, gross $1440 → benefit math produces $8, which is
    /// below the $23 federal minimum. Eligible 1- and 2-person
    /// households get bumped to the minimum.
    ///   earned_deduction = 1440 * 0.20             = 288
    ///   standard         (size 1)                  = 204
    ///   adjusted         = 1440 - 288 - 204        = 948
    ///   shelter          = 0
    ///   net              = 948
    ///   30% of net       = round(948 * 0.30)       = 284
    ///   max_allotment    (size 1)                  = 292
    ///   raw benefit      = 292 - 284               = 8
    ///   final benefit    (min applies)             = 23
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

        #expect(calc.monthlyBenefit == 23)
    }

    // MARK: - Zero benefit for high-income eligible household

    /// MA size 2, gross $2500 — eligible under BBCE ($3408 limit)
    /// but the math produces a negative raw benefit that floors
    /// at $0. Size 3+ would stay $0; size 1-2 would normally bump
    /// to the minimum, but the min only applies when computed
    /// benefit > 0. A zero floor stays zero.
    ///   earned_deduction = 500
    ///   adjusted         = 2500 - 500 - 204        = 1796
    ///   net              = 1796 (no shelter expenses)
    ///   30% of net       = round(1796 * 0.30)      = 539
    ///   raw benefit      = 536 - 539               = -3 → 0
    @Test func zeroBenefitWhenIncomeTooHighRelativeToAllotment() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.household.householdSize = "2 people"
        draft.income.grossMonthlyIncome = 2_500

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
    ///   standard         (size 2)                  = 204
    ///   adjusted         = 1500 - 0 - 204          = 1296
    ///   net              = 1296
    ///   30% of net       = round(388.8)            = 389
    ///   benefit          = 536 - 389               = 147
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
        #expect(calc.monthlyBenefit == 147)
    }

    /// Explicit split: gross $1500, but only $800 is earned.
    ///   earned_deduction = 800 * 0.20             = 160
    ///   standard         (size 2)                  = 204
    ///   adjusted         = 1500 - 160 - 204        = 1136
    ///   net              = 1136
    ///   30% of net       = round(340.8)            = 341
    ///   benefit          = 536 - 341               = 195
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
        #expect(calc.monthlyBenefit == 195)
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
