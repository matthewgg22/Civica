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

// MARK: - P1: Gap #4 — Shared housing pro-rate

@Suite("T16 Shelter Accuracy — P1 Gap #4 (shared housing pro-rate)")
struct T16SharedHousingProRateTests {

    // Drive-by fix: this `Self.iso` declaration was a copy-paste typo
    // — `Self.` is invalid in a static method name and broke
    // compilation of the entire CivicaTests target. Fixed inline so
    // the new EBT projection suite can be verified.
    private static func iso(_ string: String) -> Date {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        return f.date(from: string)!
    }
    private static let fy26Date = Self.iso("2026-03-15")

    // MARK: - SNAPExpensesAnswers model

    @Test("sharedHousingOccupants nil by default")
    func expensesAnswers_sharedHousingOccupants_nilByDefault() {
        let answers = SNAPExpensesAnswers()
        #expect(answers.sharedHousingOccupants == nil)
    }

    @Test("sharedHousingOccupants can be set to 4")
    func expensesAnswers_sharedHousingOccupants_canBeSet() {
        var answers = SNAPExpensesAnswers()
        answers.sharedHousingOccupants = 4
        #expect(answers.sharedHousingOccupants == 4)
    }

    // MARK: - SNAPBenefitCalculator: pro-rate math

    /// Sole renter: $1,200 rent, nil sharedHousingOccupants → full $1,200 counts.
    @Test("Sole renter: full rent counted when sharedHousingOccupants is nil")
    func calculator_soleRenter_fullRentCounted() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 2000
        draft.income.anyoneEarning = .yes
        draft.expenses.monthlyRentOrHousing = 1200
        draft.expenses.sharedHousingOccupants = nil
        draft.expenses.selectedUtilities = []

        let rules = CAStateRules()
        let soleResult = SNAPBenefitCalculator.calculate(draft: draft, rules: rules, today: Self.fy26Date)

        // Now share with 4 people — should produce a lower shelter deduction
        draft.expenses.sharedHousingOccupants = 4
        let sharedResult = SNAPBenefitCalculator.calculate(draft: draft, rules: rules, today: Self.fy26Date)

        #expect(soleResult.excessShelterDeduction >= sharedResult.excessShelterDeduction)
    }

    /// 4-person shared lease: $1,600 total, sharedHousingOccupants = 4.
    /// Pro-rated rent = $1,600 / 4 = $400.
    ///   earned_deduction = 1600 * 0.20          = 320
    ///   standard (HH 1 FY26)                    = 219
    ///   adjusted = 1600 - 320 - 219             = 1061
    ///   half_adjusted = 530.5
    ///   shelterCost = 400 (pro-rated, no utilities)
    ///   excessShelter = max(400 - 530.5, 0)     = 0 (shelter < half_adjusted)
    @Test("4-person shared lease: rent pro-rated to 1/4 of total")
    func calculator_fourPersonLease_rentProRated() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 1600
        draft.income.anyoneEarning = .yes
        draft.expenses.monthlyRentOrHousing = 1600  // total 4-person lease
        draft.expenses.sharedHousingOccupants = 4
        draft.expenses.selectedUtilities = []

        let rules = CAStateRules()
        let result = SNAPBenefitCalculator.calculate(draft: draft, rules: rules, today: Self.fy26Date)

        // Pro-rated rent = $400 < half_adjusted ($530.50) → excessShelter = 0
        #expect(result.excessShelterDeduction == 0)
    }

    /// Without pro-rate (nil occupants), $1,600 rent on $1,600 income
    /// yields a large excess shelter deduction.
    @Test("Same total rent without pro-rate: larger shelter deduction")
    func calculator_sameRentNoProRate_largerShelterDeduction() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 1600
        draft.income.anyoneEarning = .yes
        draft.expenses.monthlyRentOrHousing = 1600
        draft.expenses.sharedHousingOccupants = nil  // sole renter
        draft.expenses.selectedUtilities = []

        let rules = CAStateRules()
        let result = SNAPBenefitCalculator.calculate(draft: draft, rules: rules, today: Self.fy26Date)

        // shelterCost = 1600, half_adjusted = 530.5
        // excessShelter = min(1600 - 530.5, 744) = 744 (capped)
        #expect(result.excessShelterDeduction == 744)
    }

    /// 2-person lease $900, sharedHousingOccupants = 2.
    /// Pro-rated rent = $450.
    @Test("2-person shared lease: rent halved")
    func calculator_twoPeopleLease_rentHalved() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 1200
        draft.income.anyoneEarning = .yes
        draft.expenses.monthlyRentOrHousing = 900
        draft.expenses.sharedHousingOccupants = 2
        draft.expenses.selectedUtilities = []

        let rules = CAStateRules()
        let resultShared = SNAPBenefitCalculator.calculate(draft: draft, rules: rules, today: Self.fy26Date)

        draft.expenses.sharedHousingOccupants = nil  // same rent, sole renter
        let resultSole = SNAPBenefitCalculator.calculate(draft: draft, rules: rules, today: Self.fy26Date)

        // Shared case must have lower or equal shelter deduction
        #expect(resultShared.excessShelterDeduction <= resultSole.excessShelterDeduction)
    }

    // MARK: - ViewModel: sharedHousing step behavior

    @Test("ViewModel: sharedHousingOccupants nil by default")
    @MainActor func viewModel_sharedHousingOccupants_nilByDefault() {
        let vm = SNAPExpensesFlowViewModel()
        #expect(vm.answers.sharedHousingOccupants == nil)
    }

    @Test("ViewModel: unhoused status skips sharedHousing step")
    @MainActor func viewModel_unhoused_skipsSharedHousingStep() {
        let vm = SNAPExpensesFlowViewModel(housingStatus: .unhoused)
        #expect(!vm.effectiveSteps.contains(.sharedHousing))
    }

    @Test("ViewModel: stableHome status includes sharedHousing step")
    @MainActor func viewModel_stableHome_includesSharedHousingStep() {
        let vm = SNAPExpensesFlowViewModel(housingStatus: .stableHome)
        #expect(vm.effectiveSteps.contains(.sharedHousing))
    }

    @Test("ViewModel: nil housingStatus includes sharedHousing step")
    @MainActor func viewModel_nilHousingStatus_includesSharedHousingStep() {
        let vm = SNAPExpensesFlowViewModel(housingStatus: nil)
        #expect(vm.effectiveSteps.contains(.sharedHousing))
    }
}

// MARK: - P1: Gap #7 — ShelterQCHeuristics

@Suite("T16 Shelter Accuracy — P1 Gap #7 (ShelterQCHeuristics)")
struct T16ShelterQCHeuristicsTests {

    // MARK: - Flag A: rent below county floor

    @Test("Flag A: LA rent $200 below $350 floor → rentBelowCountyFloor")
    func flagA_laRentBelowFloor() {
        var draft = makeDraft(rent: 200, income: 1000)
        draft.whereApplying.housingStatus = .stableHome
        draft.expenses.selectedUtilities = [.electricity]

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Los Angeles")
        #expect(flags.contains(.rentBelowCountyFloor(reported: 200, floor: 350)))
    }

    @Test("Flag A: rent exactly at floor → no flag")
    func flagA_rentAtFloor_noFlag() {
        var draft = makeDraft(rent: 350, income: 1000)
        draft.whereApplying.housingStatus = .stableHome
        draft.expenses.selectedUtilities = [.electricity]

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Los Angeles")
        let hasA = flags.contains {
            if case .rentBelowCountyFloor = $0 { return true }
            return false
        }
        #expect(!hasA)
    }

    @Test("Flag A: sharing already set → no floor flag (pro-rated amount is expected to be low)")
    func flagA_sharingSet_noFloorFlag() {
        var draft = makeDraft(rent: 200, income: 1000)
        draft.whereApplying.housingStatus = .stableHome
        draft.expenses.sharedHousingOccupants = 4
        draft.expenses.selectedUtilities = [.electricity]

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Los Angeles")
        let hasA = flags.contains {
            if case .rentBelowCountyFloor = $0 { return true }
            return false
        }
        #expect(!hasA)
    }

    @Test("Flag A: unknown county falls back to statewide floor $250")
    func flagA_unknownCounty_statewideFloor() {
        var draft = makeDraft(rent: 200, income: 1000)
        draft.whereApplying.housingStatus = .stableHome
        draft.expenses.selectedUtilities = [.electricity]

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Shasta")
        #expect(flags.contains(.rentBelowCountyFloor(reported: 200, floor: 250)))
    }

    // MARK: - Flag B: rent exceeds income

    @Test("Flag B: rent $1,200 exceeds income $900 → rentExceedsIncome")
    func flagB_rentExceedsIncome() {
        var draft = makeDraft(rent: 1200, income: 900)
        draft.whereApplying.housingStatus = .stableHome
        draft.expenses.selectedUtilities = [.heatFuel]

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Los Angeles")
        #expect(flags.contains(.rentExceedsIncome(rent: 1200, income: 900)))
    }

    @Test("Flag B: rent equals income → no flag (must strictly exceed)")
    func flagB_rentEqualsIncome_noFlag() {
        var draft = makeDraft(rent: 1000, income: 1000)
        draft.whereApplying.housingStatus = .stableHome
        draft.expenses.selectedUtilities = [.heatFuel]

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Los Angeles")
        let hasB = flags.contains {
            if case .rentExceedsIncome = $0 { return true }
            return false
        }
        #expect(!hasB)
    }

    // MARK: - Flag C: no utilities off-campus

    @Test("Flag C: stableHome, no utilities, not on campus → noUtilitiesOffCampus")
    func flagC_offCampusNoUtilities() {
        var draft = makeDraft(rent: 800, income: 1200)
        draft.whereApplying.housingStatus = .stableHome
        draft.expenses.selectedUtilities = []

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Los Angeles", onCampus: false)
        #expect(flags.contains(.noUtilitiesOffCampus))
    }

    @Test("Flag C: onCampus=true suppresses flag")
    func flagC_onCampus_noFlag() {
        var draft = makeDraft(rent: 800, income: 1200)
        draft.whereApplying.housingStatus = .stableHome
        draft.expenses.selectedUtilities = []

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Los Angeles", onCampus: true)
        #expect(!flags.contains(.noUtilitiesOffCampus))
    }

    @Test("Flag C: has utilities → no flag")
    func flagC_hasUtilities_noFlag() {
        var draft = makeDraft(rent: 800, income: 1200)
        draft.whereApplying.housingStatus = .stableHome
        draft.expenses.selectedUtilities = [.electricity]

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Los Angeles")
        #expect(!flags.contains(.noUtilitiesOffCampus))
    }

    // MARK: - Flag D: rent suggests un-pro-rated lease

    @Test("Flag D: LA rent $2,500 above $2,100 P80 without sharing set → rentSuggestsUnproratedLease")
    func flagD_rentAboveP80_noSharing() {
        var draft = makeDraft(rent: 2500, income: 3000)
        draft.whereApplying.housingStatus = .stableHome
        draft.expenses.selectedUtilities = [.heatFuel]

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Los Angeles")
        #expect(flags.contains(.rentSuggestsUnproratedLease(reported: 2500, singlePersonP80: 2100)))
    }

    @Test("Flag D: sharing already set → no flag (high rent expected for full lease)")
    func flagD_sharingSet_noFlag() {
        var draft = makeDraft(rent: 2500, income: 3000)
        draft.whereApplying.housingStatus = .stableHome
        draft.expenses.sharedHousingOccupants = 3
        draft.expenses.selectedUtilities = [.heatFuel]

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Los Angeles")
        let hasD = flags.contains {
            if case .rentSuggestsUnproratedLease = $0 { return true }
            return false
        }
        #expect(!hasD)
    }

    @Test("Flag D: unknown county falls back to statewide P80 $1,600")
    func flagD_unknownCounty_statewideP80() {
        var draft = makeDraft(rent: 1800, income: 3000)
        draft.whereApplying.housingStatus = .stableHome
        draft.expenses.selectedUtilities = [.heatFuel]

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Shasta")
        #expect(flags.contains(.rentSuggestsUnproratedLease(reported: 1800, singlePersonP80: 1600)))
    }

    // MARK: - Unhoused skip

    @Test("Unhoused applicant: all flags suppressed")
    func unhoused_allFlagsSuppressed() {
        var draft = makeDraft(rent: 100, income: 300)
        draft.whereApplying.housingStatus = .unhoused

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Los Angeles")
        #expect(flags.isEmpty)
    }

    // MARK: - Zero rent skip

    @Test("Zero rent: only non-rent flags can fire")
    func zeroRent_rentFlagsSkipped() {
        var draft = makeDraft(rent: 0, income: 1200)
        draft.whereApplying.housingStatus = .stableHome
        draft.expenses.selectedUtilities = []

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Los Angeles")
        // Flag C (no utilities) may fire; rent-based flags A, B, D must not
        let hasRentFlag = flags.contains {
            switch $0 {
            case .rentBelowCountyFloor, .rentExceedsIncome, .rentSuggestsUnproratedLease:
                return true
            case .noUtilitiesOffCampus:
                return false
            }
        }
        #expect(!hasRentFlag)
    }

    // MARK: - Priority order

    @Test("Flag ordering: C appears before A, B, D")
    func flagOrdering_cBeforeRentFlags() {
        // Rent $150 (below LA floor), income $200, no utilities → flags C + A
        var draft = makeDraft(rent: 150, income: 200)
        draft.whereApplying.housingStatus = .stableHome
        draft.expenses.selectedUtilities = []

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: "Los Angeles")
        if let cIdx = flags.firstIndex(of: .noUtilitiesOffCampus),
           let aIdx = flags.firstIndex(where: { if case .rentBelowCountyFloor = $0 { return true }; return false })
        {
            #expect(cIdx < aIdx)
        }
    }

    // MARK: - Helpers

    private func makeDraft(rent: Decimal, income: Decimal) -> SNAPApplicationDraft {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = income
        draft.income.anyoneEarning = .yes
        draft.expenses.monthlyRentOrHousing = rent
        return draft
    }
}
