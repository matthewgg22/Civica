// Wave 4 — Facts → SNAPApplicationDraft adapter.
//
// Converts a v0.6 fixture profile's `Facts` (Codable struct in
// CivicaTestProfile.swift) into the iOS production engine's input shape,
// `SNAPApplicationDraft`. Only the draft fields the iOS composer
// actually reads are populated; the rest stay at the safe defaults the
// production code is built to tolerate.
//
// This adapter is a TEST FIXTURE — it must not be imported by the app
// target. It lives in `Civica Tests/` per the project's `PBXFileSystem-
// SynchronizedRootGroup` convention.

import Foundation
@testable import Civica

enum Wave4FactsAdapter {

    /// Build a SNAPApplicationDraft from a v0.6 profile's facts +
    /// the run state. Used by the iOS production engine to grade
    /// each profile end-to-end.
    static func draft(from facts: Facts, state: String) -> SNAPApplicationDraft {
        var draft = SNAPApplicationDraft()

        // ── Where applying ───────────────────────────────────────────
        draft.whereApplying.stateCode = state
        if facts.shelter.homelessDeduction == true {
            draft.whereApplying.housingStatus = .unhoused
        } else {
            draft.whereApplying.housingStatus = .stableHome
        }

        // ── Applicant age ────────────────────────────────────────────
        // Use the head member's age. Project today minus age years for
        // dateOfBirth so OBBBA ABAWD age bands evaluate correctly.
        if let head = facts.household.first {
            let cal = Calendar(identifier: .gregorian)
            let now = Date()
            if let dob = cal.date(byAdding: .year, value: -head.age, to: now) {
                draft.applicantAge.dateOfBirth = dob
            }
        }

        // ── Household ────────────────────────────────────────────────
        // Send the iOS UI's bucket labels. SNAPBenefitCalculator's
        // parser only recognizes these specific strings; sending
        // raw integers causes it to fall back to HH=1, producing the
        // $298 max-allotment cap that masked real iOS behavior in
        // an earlier Wave 4 run. The labels are case-sensitive — must
        // match the strings the question screen ships.
        switch facts.household.count {
        case 1: draft.household.householdSize = "Just me"
        case 2: draft.household.householdSize = "2 people"
        case 3: draft.household.householdSize = "3 people"
        default: draft.household.householdSize = "4 or more"
        }
        let hasED = facts.household.contains { m in
            m.disability == true || m.elderly == true || m.age >= 60
        }
        draft.household.hasElderlyOrDisabled = hasED
        let hasMinor = facts.household.contains { m in m.age < 18 && m.role != "head" }
        draft.household.hasMinorInHousehold = hasMinor
        let hasChildUnder14 = facts.household.contains { m in m.age < 14 && m.role != "head" }
        draft.household.hasChildUnder14InHousehold = hasChildUnder14

        // ── Income ───────────────────────────────────────────────────
        let earned = facts.income
            .filter { !isExcludedIncomeType($0.type) && Self.earnedTypes.contains($0.type) }
            .reduce(0.0) { $0 + $1.amount }
        let unearned = facts.income
            .filter { !isExcludedIncomeType($0.type) && !Self.earnedTypes.contains($0.type) }
            .reduce(0.0) { $0 + $1.amount }
        let gross = max(0.0, earned + unearned)
        draft.income.grossMonthlyIncome = Decimal(gross)
        draft.income.monthlyEarnedAmount = Decimal(earned)
        draft.income.anyoneEarning = earned > 0 ? .yes : .no
        draft.income.hasUnearnedIncome = unearned > 0 ? .yes : .no
        // Liquid resources for expedited screen.
        if case .amount(let a) = facts.assets {
            draft.income.liquidResources = Decimal(a)
        }

        // ── Student status (head member only) ────────────────────────
        if let head = facts.household.first, let student = head.student, student != "not" {
            draft.studentStatus.enrolledInHigherEd = true
            // he_halftime_subject + all he_exempt:* are "enrolled half-time+".
            draft.studentStatus.enrolledHalfTime = true
            // Map exemptions to the boolean inputs the iOS gate reads.
            switch student {
            case "he_exempt:work20":
                draft.studentStatus.works20PlusHours = true
            case "he_exempt:work_study":
                draft.studentStatus.inWorkStudy = true
            case "he_exempt:single_parent_child_under12",
                 "he_exempt:dependent_under6":
                draft.studentStatus.responsibleForDependentChild = true
            case "he_exempt:et_placement":
                draft.studentStatus.inApprovedJobProgram = true
            case "he_exempt:tanf",
                 "he_exempt:age50plus":
                // No direct boolean input; gate treats these by other paths.
                break
            default:
                break
            }
        } else {
            draft.studentStatus.enrolledInHigherEd = false
        }

        // ── Expenses ─────────────────────────────────────────────────
        draft.expenses.monthlyRentOrHousing = Decimal(facts.shelter.rent)
        // Map v0.6 SUA tier to iOS UtilityType set so suaTier resolves
        // back to the same Swift tier the calculator expects.
        switch facts.shelter.suaTier {
        case .hcsua:
            draft.expenses.selectedUtilities = [.heatFuel]
        case .lua:
            draft.expenses.selectedUtilities = [.electricity]
        case .phone:
            draft.expenses.selectedUtilities = [.phone]
        case .none:
            draft.expenses.selectedUtilities = []
        }
        // Actual utilities — v0.6 doesn't track separately; use 0 so the
        // calculator falls back to the SUA tier value.
        draft.expenses.monthlyUtilities = 0
        draft.expenses.monthlyChildcare = Decimal(facts.deductions.dependentCare ?? 0)
        draft.expenses.monthlyMedical = Decimal(facts.deductions.medicalUnreimbursed ?? 0)

        return draft
    }

    // ─── Helpers ────────────────────────────────────────────────────

    private static let earnedTypes: Set<String> = [
        "wages", "self_employment", "farm_se", "wages_contract",
    ]

    private static func isExcludedIncomeType(_ type: String) -> Bool {
        if type.hasPrefix("excluded") { return true }
        if type.hasPrefix("americorps_sn_excluded") { return true }
        if type.hasPrefix("americorps_vista_excluded") { return true }
        if type.contains("vendor") { return true }
        return false
    }
}
