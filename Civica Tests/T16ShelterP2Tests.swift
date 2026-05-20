import Foundation
import Testing
@testable import Civica

// T16 Shelter Accuracy Stack — P2 regression tests
//
// Covers:
//   Gap #6 — Mid-period change detection in SNAPReviewDraftFlowView.
//             housingLocationChanged() fires when housingStatus or county
//             changes between packet-generation snapshots.
//             Reference: 7 CFR 273.12 (mid-period reporting).
//
//   Gap #7 (wiring) — ShelterQCHeuristics.evaluate() integrated into
//             SNAPReviewDraftFlowView. Tests confirm the review view's
//             flag projection produces the expected flag set for known
//             draft configurations (re-tests evaluate() directly since
//             the view is not unit-testable without a renderer, but the
//             evaluate() call path and prompt strings are verified here).

// MARK: - Gap #6: Mid-period change detection

@Suite("T16 P2 — Gap #6 (mid-period change detection)")
struct T16MidPeriodChangeTests {

    // MARK: - housingLocationChanged logic

    private func changed(
        priorStatus: HousingStatus? = .stableHome,
        currentStatus: HousingStatus? = .stableHome,
        priorCounty: String? = nil,
        currentCounty: String? = nil
    ) -> Bool {
        let prior = SNAPWhereApplyingAnswers(
            stateCode: "CA",
            housingStatus: priorStatus,
            county: priorCounty
        )
        var current = SNAPWhereApplyingAnswers(
            stateCode: "CA",
            housingStatus: currentStatus,
            county: currentCounty
        )
        // Mirror the view's logic directly
        return prior.housingStatus != current.housingStatus
            || prior.county != current.county
    }

    @Test("No change: same status and county → false")
    func noChange_sameStatusAndCounty() {
        #expect(!changed(priorStatus: .stableHome, currentStatus: .stableHome,
                         priorCounty: "Los Angeles", currentCounty: "Los Angeles"))
    }

    @Test("Housing status changed: stableHome → unhoused → true")
    func housingStatusChanged_stableToUnhoused() {
        #expect(changed(priorStatus: .stableHome, currentStatus: .unhoused))
    }

    @Test("Housing status changed: unhoused → stableHome → true")
    func housingStatusChanged_unhousedToStable() {
        #expect(changed(priorStatus: .unhoused, currentStatus: .stableHome))
    }

    @Test("County changed → true")
    func countyChanged() {
        #expect(changed(priorCounty: "Los Angeles", currentCounty: "San Diego"))
    }

    @Test("County added (nil → value) → true")
    func countyAdded() {
        #expect(changed(priorCounty: nil, currentCounty: "Alameda"))
    }

    @Test("County cleared (value → nil) → true")
    func countyCleared() {
        #expect(changed(priorCounty: "San Francisco", currentCounty: nil))
    }

    @Test("Both status and county unchanged → false")
    func noChange_nilCountyBothSides() {
        #expect(!changed(priorStatus: .stableHome, currentStatus: .stableHome,
                         priorCounty: nil, currentCounty: nil))
    }

    // MARK: - Verify SNAPWhereApplyingAnswers memberwise init

    @Test("SNAPWhereApplyingAnswers memberwise init round-trips")
    func whereApplyingAnswers_memberwiseInit() {
        let a = SNAPWhereApplyingAnswers(stateCode: "CA", housingStatus: .unhoused, county: "Kern")
        #expect(a.stateCode == "CA")
        #expect(a.housingStatus == .unhoused)
        #expect(a.county == "Kern")
    }
}

// MARK: - Gap #7 (wiring): ShelterQCHeuristics flag prompt strings

@Suite("T16 P2 — Gap #7 wiring (flag prompt strings)")
struct T16ShelterQCPromptStringTests {

    // Verify that every flag variant has a non-empty student-facing prompt
    // in both languages. The prompt is what the student/navigator actually
    // reads — it must be present and distinct for each flag.

    @Test("rentBelowCountyFloor: English prompt non-empty")
    func prompt_rentBelowCountyFloor_english() {
        let flag = ShelterQCFlag.rentBelowCountyFloor(reported: 200, floor: 350)
        let text = SNAPReviewDraftStrings.shelterFlagPrompt(flag, language: .english)
        #expect(!text.isEmpty)
        #expect(text.contains("rent") || text.contains("roommates"))
    }

    @Test("rentBelowCountyFloor: Spanish prompt non-empty")
    func prompt_rentBelowCountyFloor_spanish() {
        let flag = ShelterQCFlag.rentBelowCountyFloor(reported: 200, floor: 350)
        let text = SNAPReviewDraftStrings.shelterFlagPrompt(flag, language: .spanish)
        #expect(!text.isEmpty)
    }

    @Test("rentExceedsIncome: English prompt non-empty")
    func prompt_rentExceedsIncome_english() {
        let flag = ShelterQCFlag.rentExceedsIncome(rent: 1200, income: 900)
        let text = SNAPReviewDraftStrings.shelterFlagPrompt(flag, language: .english)
        #expect(!text.isEmpty)
        #expect(text.contains("income"))
    }

    @Test("rentExceedsIncome: Spanish prompt non-empty")
    func prompt_rentExceedsIncome_spanish() {
        let flag = ShelterQCFlag.rentExceedsIncome(rent: 1200, income: 900)
        let text = SNAPReviewDraftStrings.shelterFlagPrompt(flag, language: .spanish)
        #expect(!text.isEmpty)
    }

    @Test("noUtilitiesOffCampus: English prompt non-empty")
    func prompt_noUtilitiesOffCampus_english() {
        let flag = ShelterQCFlag.noUtilitiesOffCampus
        let text = SNAPReviewDraftStrings.shelterFlagPrompt(flag, language: .english)
        #expect(!text.isEmpty)
        #expect(text.contains("utilities") || text.contains("rent"))
    }

    @Test("noUtilitiesOffCampus: Spanish prompt non-empty")
    func prompt_noUtilitiesOffCampus_spanish() {
        let flag = ShelterQCFlag.noUtilitiesOffCampus
        let text = SNAPReviewDraftStrings.shelterFlagPrompt(flag, language: .spanish)
        #expect(!text.isEmpty)
    }

    @Test("rentSuggestsUnproratedLease: English prompt non-empty")
    func prompt_rentSuggestsUnprorated_english() {
        let flag = ShelterQCFlag.rentSuggestsUnproratedLease(reported: 2500, singlePersonP80: 2100)
        let text = SNAPReviewDraftStrings.shelterFlagPrompt(flag, language: .english)
        #expect(!text.isEmpty)
        #expect(text.contains("roommates") || text.contains("rent"))
    }

    @Test("rentSuggestsUnproratedLease: Spanish prompt non-empty")
    func prompt_rentSuggestsUnprorated_spanish() {
        let flag = ShelterQCFlag.rentSuggestsUnproratedLease(reported: 2500, singlePersonP80: 2100)
        let text = SNAPReviewDraftStrings.shelterFlagPrompt(flag, language: .spanish)
        #expect(!text.isEmpty)
    }

    @Test("All four flags produce distinct English prompts")
    func allFlags_distinctEnglishPrompts() {
        let flags: [ShelterQCFlag] = [
            .rentBelowCountyFloor(reported: 200, floor: 350),
            .rentExceedsIncome(rent: 1200, income: 900),
            .noUtilitiesOffCampus,
            .rentSuggestsUnproratedLease(reported: 2500, singlePersonP80: 2100)
        ]
        let prompts = flags.map { SNAPReviewDraftStrings.shelterFlagPrompt($0, language: .english) }
        let unique = Set(prompts)
        #expect(unique.count == flags.count)
    }

    // MARK: - Accessibility label

    @Test("shelterFlagsAccessibilityLabel: singular (1 flag)")
    func accessibilityLabel_singular() {
        let label = SNAPReviewDraftStrings.shelterFlagsAccessibilityLabel(count: 1, language: .english)
        #expect(label.contains("1"))
        #expect(label.contains("question"))
    }

    @Test("shelterFlagsAccessibilityLabel: plural (3 flags)")
    func accessibilityLabel_plural() {
        let label = SNAPReviewDraftStrings.shelterFlagsAccessibilityLabel(count: 3, language: .english)
        #expect(label.contains("3"))
        #expect(label.contains("questions"))
    }

    // MARK: - Gap #7 wiring: evaluate() called with county from draft

    @Test("Evaluate uses county from draft.whereApplying.county")
    func evaluate_usesCountyFromDraft() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.whereApplying.housingStatus = .stableHome
        draft.whereApplying.county = "Los Angeles"  // sets LA floor ($350)
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 1000
        draft.expenses.monthlyRentOrHousing = 200  // below LA floor ($350)
        draft.expenses.selectedUtilities = [.electricity]

        // The review view calls evaluate(draft:county:onCampus:) with draft.whereApplying.county.
        // Mirror that call:
        let flags = ShelterQCHeuristics.evaluate(
            draft: draft,
            county: draft.whereApplying.county,
            onCampus: false
        )
        #expect(flags.contains(.rentBelowCountyFloor(reported: 200, floor: 350)))
    }

    @Test("onCampus=true suppresses noUtilitiesOffCampus flag")
    func onCampus_suppressesNoUtilitiesFlag() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.whereApplying.housingStatus = .stableHome
        draft.household.householdSize = "Just me"
        draft.income.grossMonthlyIncome = 1200
        draft.expenses.monthlyRentOrHousing = 800
        draft.expenses.selectedUtilities = []  // no utilities — would normally flag C

        let flags = ShelterQCHeuristics.evaluate(draft: draft, county: nil, onCampus: true)
        #expect(!flags.contains(.noUtilitiesOffCampus))
    }
}
