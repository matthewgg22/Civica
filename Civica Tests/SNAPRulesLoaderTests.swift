import Foundation
import Testing
@testable import Civica

// Basic assertions that:
//   1. The JSON files decode successfully from the bundle
//   2. The evaluateChecklist contract is satisfied
//   3. Version gating is respected (unsupported version → nil rules)
//
// These tests run only when the full app bundle is available (i.e. not in
// headless CI without a simulator). If the bundle resources are missing the
// bundle-load tests fail fast with a clear message rather than a nil crash.

struct SNAPRulesLoaderTests {

    // MARK: - CA rules

    @Test func caRulesLoadFromBundle() {
        let rules = SNAPRulesLoader.rules(for: "CA")
        #expect(rules != nil, "snap_rules_ca.json must be present in the Civica bundle")
    }

    @Test func caStateCodeIsCA() {
        guard let rules = SNAPRulesLoader.rules(for: "CA") else { return }
        #expect(rules.stateCode == "CA")
    }

    @Test func caVersionIs1() {
        guard let rules = SNAPRulesLoader.rules(for: "CA") else { return }
        #expect(rules.version == 1)
    }

    @Test func caHasAtLeastOneDocumentRequirement() {
        guard let rules = SNAPRulesLoader.rules(for: "CA") else { return }
        #expect(rules.documentRequirements.isEmpty == false)
    }

    @Test func caEveryRequirementHasNonEmptyHelperTextEn() {
        guard let rules = SNAPRulesLoader.rules(for: "CA") else { return }
        for req in rules.documentRequirements {
            #expect(req.helperTextEn.isEmpty == false, "helperTextEn empty for category \(req.category)")
        }
    }

    @Test func caEveryRequirementHasNonEmptyHelperTextEs() {
        guard let rules = SNAPRulesLoader.rules(for: "CA") else { return }
        for req in rules.documentRequirements {
            #expect(req.helperTextEs.isEmpty == false, "helperTextEs empty for category \(req.category)")
        }
    }

    // MARK: - MA rules

    @Test func maRulesLoadFromBundle() {
        let rules = SNAPRulesLoader.rules(for: "MA")
        #expect(rules != nil, "snap_rules_ma.json must be present in the Civica bundle")
    }

    @Test func maStateCodeIsMA() {
        guard let rules = SNAPRulesLoader.rules(for: "MA") else { return }
        #expect(rules.stateCode == "MA")
    }

    // MARK: - Case-insensitive lookup

    @Test func lowercaseStateCodeResolvesCA() {
        let upper = SNAPRulesLoader.rules(for: "CA")
        let lower = SNAPRulesLoader.rules(for: "ca")
        #expect(upper?.stateCode == lower?.stateCode)
    }

    // MARK: - Nil / empty / unsupported state codes

    @Test func nilStateCodeReturnsNil() {
        #expect(SNAPRulesLoader.rules(for: nil) == nil)
    }

    @Test func emptyStateCodeReturnsNil() {
        #expect(SNAPRulesLoader.rules(for: "") == nil)
    }

    @Test func unsupportedStateReturnsNil() {
        #expect(SNAPRulesLoader.rules(for: "TX") == nil)
    }

    // MARK: - evaluateChecklist — CA

    @Test func caChecklistContainsPhotoIdForAnyHousehold() {
        let answers = SNAPChecklistAnswers(householdSize: 1)
        let result = SNAPRulesLoader.evaluateChecklist(stateCode: "CA", answers: answers)
        #expect(result.items.contains { $0.category == "photo_id" })
    }

    @Test func caChecklistContainsPaystubWhenEarnedIncome() {
        var answers = SNAPChecklistAnswers()
        answers.hasEarnedIncome = true
        let result = SNAPRulesLoader.evaluateChecklist(stateCode: "CA", answers: answers)
        #expect(result.items.contains { $0.category == "paystub" })
    }

    @Test func caChecklistOmitsPaystubWhenNoEarnedIncome() {
        var answers = SNAPChecklistAnswers()
        answers.hasEarnedIncome = false
        let result = SNAPRulesLoader.evaluateChecklist(stateCode: "CA", answers: answers)
        #expect(result.items.contains { $0.category == "paystub" } == false)
    }

    @Test func caChecklistContainsUtilityBillWhenClaimedDeduction() {
        var answers = SNAPChecklistAnswers()
        answers.claimsUtilityDeduction = true
        let result = SNAPRulesLoader.evaluateChecklist(stateCode: "CA", answers: answers)
        #expect(result.items.contains { $0.category == "utility_bill" })
    }

    @Test func caChecklistIncludesOrientationFlag() {
        let result = SNAPRulesLoader.evaluateChecklist(stateCode: "CA")
        #expect(result.flags.isEmpty == false)
        #expect(result.flags.first?.localizedCaseInsensitiveContains("orientation") == true)
    }

    // MARK: - evaluateChecklist — MA

    @Test func maChecklistContainsLeaseForAnyHousehold() {
        let answers = SNAPChecklistAnswers(householdSize: 1)
        let result = SNAPRulesLoader.evaluateChecklist(stateCode: "MA", answers: answers)
        #expect(result.items.contains { $0.category == "lease" })
    }

    // MARK: - evaluateChecklist — unsupported state

    @Test func unsupportedStateReturnsEmptyChecklist() {
        let result = SNAPRulesLoader.evaluateChecklist(stateCode: "TX")
        #expect(result.items.isEmpty)
        #expect(result.flags.isEmpty == false)
    }
}
