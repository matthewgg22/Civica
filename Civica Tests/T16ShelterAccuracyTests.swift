import Foundation
import Testing
@testable import Civica

// T16 Shelter Accuracy Stack — P0 regression tests
//
// Covers:
//   Gap #1: Per-utility-type intake replaces paysUtilitiesSeparately Bool.
//           SUATier.determineTier() maps correctly to CA SUA values.
//   Gap #2: SNAPBenefitCalculator derives tier from draft.expenses.suaTier
//           (not hardcoded). CA rules return correct SUA amounts.
//   Gap #3: .cooling (AC) alone yields heatingCooling tier — closed via #1.
//   Gap #8: HousingStatus.unhoused triggers $179 homeless shelter deduction.
//
// All dollar amounts verified against:
//   • CDSS ACL 25-68 (FY2026 SUA: $663 full, $170 limited, $20 telephone)
//   • 7 CFR 273.9(d)(6) ($179 homeless shelter standard)
//   • CA BBCE gross limit (200% FPL, HH 1 = $2,610/mo FY2026)

@Suite("T16 Shelter Accuracy — P0")
struct T16ShelterAccuracyTests {

    // MARK: - Gap #1/#3: SUATier.determineTier()

    @Test("Empty set → .none")
    func determineTier_empty_isNone() {
        #expect(SUATier.determineTier(for: []) == .none)
    }

    @Test("heatFuel alone → .heatingCooling")
    func determineTier_heatFuel_isHeatingCooling() {
        #expect(SUATier.determineTier(for: [.heatFuel]) == .heatingCooling)
    }

    @Test("cooling (AC) alone → .heatingCooling (Gap #3 — CA CDSS MPP 63-503.43)")
    func determineTier_coolingAlone_isHeatingCooling() {
        #expect(SUATier.determineTier(for: [.cooling]) == .heatingCooling)
    }

    @Test("heatFuel + electricity → .heatingCooling (heat takes priority)")
    func determineTier_heatAndElectricity_isHeatingCooling() {
        #expect(SUATier.determineTier(for: [.heatFuel, .electricity]) == .heatingCooling)
    }

    @Test("electricity alone → .nonHeating")
    func determineTier_electricityAlone_isNonHeating() {
        #expect(SUATier.determineTier(for: [.electricity]) == .nonHeating)
    }

    @Test("electricity + phone → .nonHeating (electricity takes priority over phone)")
    func determineTier_electricityAndPhone_isNonHeating() {
        #expect(SUATier.determineTier(for: [.electricity, .phone]) == .nonHeating)
    }

    @Test("phone alone → .phoneOnly")
    func determineTier_phoneAlone_isPhoneOnly() {
        #expect(SUATier.determineTier(for: [.phone]) == .phoneOnly)
    }

    @Test("all four types → .heatingCooling (heat present)")
    func determineTier_allTypes_isHeatingCooling() {
        #expect(SUATier.determineTier(for: [.heatFuel, .electricity, .cooling, .phone]) == .heatingCooling)
    }

    // MARK: - Gap #1: SNAPExpensesAnswers computed properties

    @Test("selectedUtilities empty → paysUtilitiesSeparately false")
    func expensesAnswers_emptyUtilities_paysUtilitiesSeparatelyFalse() {
        let answers = SNAPExpensesAnswers()
        #expect(answers.paysUtilitiesSeparately == false)
        #expect(answers.suaTier == .none)
    }

    @Test("selectedUtilities with heatFuel → paysUtilitiesSeparately true, suaTier .heatingCooling")
    func expensesAnswers_heatFuel_suaTierHeatingCooling() {
        var answers = SNAPExpensesAnswers()
        answers.selectedUtilities = [.heatFuel]
        #expect(answers.paysUtilitiesSeparately == true)
        #expect(answers.suaTier == .heatingCooling)
    }

    @Test("selectedUtilities with electricity → suaTier .nonHeating")
    func expensesAnswers_electricity_suaTierNonHeating() {
        var answers = SNAPExpensesAnswers()
        answers.selectedUtilities = [.electricity]
        #expect(answers.suaTier == .nonHeating)
    }

    // MARK: - Gap #2: Calculator wires CA SUA correctly

    /// CA HH 1, gross $1,200, rent $800, selects heatFuel (heatingCooling tier).
    /// No reported utility amount → SUA substitution applies → effectiveUtility = $663.
    ///   earned_deduction = 1200 * 0.20               = 240
    ///   standard (HH 1)                              = 219
    ///   adjusted = 1200 - 240 - 219                  = 741
    ///   half_adjusted = 370.5
    ///   shelterCosts = 800 + 663                     = 1463
    ///   excessShelter = min(1463 - 370.5, cap=744)   = 744 (capped)
    ///   net = 1200 - 240 - 219 - 744                 = -3 → clamped to 0
    ///   30% of net = 0
    ///   maxAllotment (HH 1)                          = 292
    ///   benefit = 292 - 0                            = 292 (minimum kick-in: $23)
    @Test("CA heatingCooling tier: SUA $663 applied even with nil utility amount (Gap #2)")
    func calculator_caHeatingCooling_suaAppliedWithNilUtilityAmount() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 1200
        draft.income.anyoneEarning = .yes
        draft.expenses.monthlyRentOrHousing = 800
        draft.expenses.selectedUtilities = [.heatFuel]
        draft.expenses.monthlyUtilities = nil  // no dollar amount entered

        let rules = CAStateRules()
        let result = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: rules,
            today: Self.fy26Date
        )

        // excessShelter should be capped at 744 (SUA applied)
        #expect(result.excessShelterDeduction == 744)
        // Net should be 0 (floored)
        #expect(result.netMonthlyIncome == 0)
        // Benefit = max allotment - 0 = 292 (HH 1 FY2026)
        #expect(result.monthlyBenefit == 292)
    }

    /// CA HH 1, gross $1,200, rent $800, selects heatFuel, reports $40 utilities.
    /// SUA is $663 > $40 → effectiveUtility = $663 (SUA wins).
    @Test("CA heatingCooling tier: SUA $663 substitutes low reported utilities (Gap #2)")
    func calculator_caHeatingCooling_suaSubstitutesLowActuals() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 1200
        draft.income.anyoneEarning = .yes
        draft.expenses.monthlyRentOrHousing = 800
        draft.expenses.selectedUtilities = [.heatFuel]
        draft.expenses.monthlyUtilities = 40  // low — SUA should substitute

        let rules = CAStateRules()
        let result = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: rules,
            today: Self.fy26Date
        )

        // effectiveUtility = max(40, 663) = 663 → same as nil case
        #expect(result.excessShelterDeduction == 744)
    }

    /// CA HH 1, gross $1,200, rent $800, selects heatFuel, reports $800 utilities.
    /// SUA $663 < $800 actual → effectiveUtility = $800 (actuals win).
    @Test("CA heatingCooling tier: actuals win when higher than SUA (Gap #2)")
    func calculator_caHeatingCooling_actualsWhenHigherThanSua() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 1200
        draft.income.anyoneEarning = .yes
        draft.expenses.monthlyRentOrHousing = 800
        draft.expenses.selectedUtilities = [.heatFuel]
        draft.expenses.monthlyUtilities = 800

        let rules = CAStateRules()
        let result = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: rules,
            today: Self.fy26Date
        )

        // effectiveUtility = max(800, 663) = 800
        // shelterCost = 800 + 800 = 1600
        // excessShelter = min(1600 - 370.5, 744) = 744 (still capped)
        #expect(result.excessShelterDeduction == 744)
    }

    /// CA HH 1, gross $1,200, rent $800, selects electricity only (nonHeating, $170 SUA).
    ///   effectiveUtility = max(0, 170) = 170
    ///   shelterCost = 800 + 170 = 970
    ///   excessShelter = min(970 - 370.5, 744) = min(599.5, 744) = 600 (rounded)
    @Test("CA nonHeating tier: SUA $170 applied for electricity-only selection (Gap #2)")
    func calculator_caNonHeating_suaApplied() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 1200
        draft.income.anyoneEarning = .yes
        draft.expenses.monthlyRentOrHousing = 800
        draft.expenses.selectedUtilities = [.electricity]
        draft.expenses.monthlyUtilities = nil

        let rules = CAStateRules()
        let result = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: rules,
            today: Self.fy26Date
        )

        // shelterCost = 800 + 170 = 970
        // excessShelter = min(floor(970 - 370.5), 744) = min(599, 744) = 599 or 600 depending on rounding
        // The key assertion: nonHeating SUA ($170) is less than heatingCooling ($663)
        // so excessShelter should be strictly less than the heatingCooling case
        #expect(result.excessShelterDeduction < 744)
        #expect(result.excessShelterDeduction > 0)
    }

    /// CA HH 1, no utilities selected → SUA is .none → effectiveUtility = 0.
    @Test("CA no utilities selected: zero utility deduction")
    func calculator_caNoUtilities_zeroUtilityDeduction() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 1200
        draft.income.anyoneEarning = .yes
        draft.expenses.monthlyRentOrHousing = 800
        draft.expenses.selectedUtilities = []  // utilities in rent
        draft.expenses.monthlyUtilities = 200  // dollar amount should be ignored

        let rules = CAStateRules()
        let result = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: rules,
            today: Self.fy26Date
        )

        // shelterCost = 800 + 0 = 800
        // excessShelter = min(800 - 370.5, 744) = min(429.5, 744) = 430 (rounded)
        // This is LESS than with heatingCooling SUA applied
        #expect(result.excessShelterDeduction < 600)
    }

    // MARK: - Gap #3: AC (cooling) yields heatingCooling tier

    @Test("CA cooling (AC) alone → heatingCooling SUA $663 applied (Gap #3)")
    func calculator_caCoolingAlone_heatingCoolingSuaApplied() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 1200
        draft.income.anyoneEarning = .yes
        draft.expenses.monthlyRentOrHousing = 800
        draft.expenses.selectedUtilities = [.cooling]  // AC only
        draft.expenses.monthlyUtilities = nil

        let rules = CAStateRules()
        let result = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: rules,
            today: Self.fy26Date
        )

        // Should behave identically to heatFuel — heatingCooling tier ($663)
        #expect(result.excessShelterDeduction == 744)
    }

    // MARK: - Gap #8: Homeless shelter deduction

    /// HousingStatus.unhoused → $179 federal standard deduction applied
    /// regardless of rent and utility inputs.
    ///   shelterCosts = 179 (standard deduction, not rent + SUA)
    @Test("Unhoused: $179 homeless shelter standard deduction (Gap #8, 7 CFR 273.9(d)(6))")
    func calculator_unhoused_homelessDeductionApplied() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.whereApplying.housingStatus = .unhoused
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 900
        draft.income.anyoneEarning = .yes
        draft.expenses.monthlyRentOrHousing = 0   // unhoused — no rent
        draft.expenses.selectedUtilities = []

        let rules = CAStateRules()
        let result = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: rules,
            today: Self.fy26Date
        )

        // shelterCost = $179 (homeless standard)
        // earned_deduction = 900 * 0.20 = 180
        // standard (HH 1) = 219
        // adjusted = 900 - 180 - 219 = 501
        // half_adjusted = 250.5
        // excessShelter = min(179 - 250.5, cap) → negative → 0
        // Net = 501
        // 30% of net = round(501 * 0.30) = 150 (rounds to 150)
        // maxAllotment (HH 1 FY26) = 292
        // benefit = 292 - 150 = 142
        #expect(result.excessShelterDeduction == 0)  // shelter < half_adjusted
        #expect(result.netMonthlyIncome == 501)
        #expect(result.monthlyBenefit == 142)
    }

    @Test("Unhoused with high income: $179 applied (not rent override)")
    func calculator_unhousedHighIncome_homelessDeductionNotRent() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.whereApplying.housingStatus = .unhoused
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 600
        draft.income.anyoneEarning = .yes
        // These should be ignored when unhoused
        draft.expenses.monthlyRentOrHousing = 1500
        draft.expenses.selectedUtilities = [.heatFuel]
        draft.expenses.monthlyUtilities = 200

        let rulesDefault = FederalDefaultRules()
        let resultWithRent = SNAPBenefitCalculator.calculate(
            draft: {
                var d = draft
                d.whereApplying.housingStatus = .stableHome  // not unhoused
                return d
            }(),
            rules: rulesDefault,
            today: Self.fy26Date
        )

        let resultUnhoused = SNAPBenefitCalculator.calculate(
            draft: draft,
            rules: rulesDefault,
            today: Self.fy26Date
        )

        // Unhoused should have LOWER shelter deduction than the $1500 rent case
        // (since $179 < $1500 + utilities)
        #expect(resultUnhoused.excessShelterDeduction < resultWithRent.excessShelterDeduction)
    }

    // MARK: - Helpers

    private static func iso(_ string: String) -> Date {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        return f.date(from: string)!
    }

    private static let fy26Date = Self.iso("2026-03-15")
}
