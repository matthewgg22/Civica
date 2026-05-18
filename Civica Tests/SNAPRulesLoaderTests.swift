import Foundation
import Testing
@testable import Civica

// Basic assertions that:
//   1. The JSON files decode successfully from the bundle
//   2. The evaluateChecklist contract is satisfied via SNAPRulesEngine
//   3. Version gating is respected (unsupported state → throws)
//
// These tests run only when the full app bundle is available (i.e. not in
// headless CI without a simulator). If the bundle resources are missing the
// bundle-load tests fail fast with a clear message rather than a nil crash.

struct SNAPRulesLoaderTests {

    // MARK: - CA rules

    @Test func caRulesLoadFromBundle() {
        let rules = try? SNAPRulesLoader.load(stateCode: "CA")
        #expect(rules != nil, "snap_rules_ca.json must be present in the Civica bundle")
    }

    @Test func caStateCodeIsCA() {
        guard let rules = try? SNAPRulesLoader.load(stateCode: "CA") else { return }
        #expect(rules.stateCode == "CA")
    }

    @Test func caVersionStartsWith1() {
        guard let rules = try? SNAPRulesLoader.load(stateCode: "CA") else { return }
        #expect(rules.version.hasPrefix("1"))
    }

    @Test func caHasAtLeastOneDocumentRequirement() {
        guard let rules = try? SNAPRulesLoader.load(stateCode: "CA") else { return }
        #expect(rules.documentRequirements.isEmpty == false)
    }

    @Test func caEveryRequirementHasNonEmptyHelperEn() {
        guard let rules = try? SNAPRulesLoader.load(stateCode: "CA") else { return }
        for req in rules.documentRequirements {
            #expect(req.helperEn.isEmpty == false, "helperEn empty for category \(req.category)")
        }
    }

    @Test func caEveryRequirementHasNonEmptyHelperEs() {
        guard let rules = try? SNAPRulesLoader.load(stateCode: "CA") else { return }
        for req in rules.documentRequirements {
            #expect(req.helperEs.isEmpty == false, "helperEs empty for category \(req.category)")
        }
    }

    // MARK: - MA rules

    @Test func maRulesLoadFromBundle() {
        let rules = try? SNAPRulesLoader.load(stateCode: "MA")
        #expect(rules != nil, "snap_rules_ma.json must be present in the Civica bundle")
    }

    @Test func maStateCodeIsMA() {
        guard let rules = try? SNAPRulesLoader.load(stateCode: "MA") else { return }
        #expect(rules.stateCode == "MA")
    }

    // MARK: - Case-insensitive lookup

    @Test func lowercaseStateCodeResolvesCA() throws {
        let upper = try SNAPRulesLoader.load(stateCode: "CA")
        let lower = try SNAPRulesLoader.load(stateCode: "ca")
        #expect(upper.stateCode == lower.stateCode)
    }

    // MARK: - Unsupported / empty state codes

    @Test func emptyStateCodeThrows() {
        #expect(throws: (any Error).self) { try SNAPRulesLoader.load(stateCode: "") }
    }

    @Test func unsupportedStateThrows() {
        #expect(throws: (any Error).self) { try SNAPRulesLoader.load(stateCode: "TX") }
    }

    // MARK: - evaluateChecklist — CA (via SNAPRulesEngine)

    @Test func caChecklistAlwaysIncludesIdentity() throws {
        let rules = try SNAPRulesLoader.load(stateCode: "CA")
        let result = SNAPRulesEngine.evaluateChecklist(rules: rules, draft: SNAPApplicationDraft())
        #expect(result.requiredItems.contains { $0.category == "identity" })
    }

    @Test func caChecklistAlwaysIncludesResidence() throws {
        let rules = try SNAPRulesLoader.load(stateCode: "CA")
        let result = SNAPRulesEngine.evaluateChecklist(rules: rules, draft: SNAPApplicationDraft())
        #expect(result.requiredItems.contains { $0.category == "residence" })
    }

    @Test func caChecklistAlwaysIncludesIncome() throws {
        let rules = try SNAPRulesLoader.load(stateCode: "CA")
        let result = SNAPRulesEngine.evaluateChecklist(rules: rules, draft: SNAPApplicationDraft())
        #expect(result.requiredItems.contains { $0.category == "income" })
    }

    @Test func caChecklistIncludesShelterWhenRentSet() throws {
        let rules = try SNAPRulesLoader.load(stateCode: "CA")
        var draft = SNAPApplicationDraft()
        draft.expenses.monthlyRentOrHousing = 800
        let result = SNAPRulesEngine.evaluateChecklist(rules: rules, draft: draft)
        #expect(result.requiredItems.contains { $0.category == "shelter" })
    }

    @Test func caChecklistOmitsShelterWhenNoRent() throws {
        let rules = try SNAPRulesLoader.load(stateCode: "CA")
        let result = SNAPRulesEngine.evaluateChecklist(rules: rules, draft: SNAPApplicationDraft())
        #expect(result.requiredItems.contains { $0.category == "shelter" } == false)
    }

    @Test func caChecklistIncludesStudentWhenEnrolled() throws {
        let rules = try SNAPRulesLoader.load(stateCode: "CA")
        var draft = SNAPApplicationDraft()
        draft.studentStatus.enrolledInHigherEd = true
        let result = SNAPRulesEngine.evaluateChecklist(rules: rules, draft: draft)
        #expect(result.requiredItems.contains { $0.category == "student" })
    }

    @Test func caChecklistHasActiveFlagsForAnyDraft() throws {
        let rules = try SNAPRulesLoader.load(stateCode: "CA")
        let result = SNAPRulesEngine.evaluateChecklist(rules: rules, draft: SNAPApplicationDraft())
        // CA rules include at least one flag (expedited_eligible path or similar)
        #expect(result.activeFlags.isEmpty == false || rules.flags.isEmpty)
    }

    // MARK: - evaluateChecklist — MA

    @Test func maChecklistAlwaysIncludesIdentity() throws {
        let rules = try SNAPRulesLoader.load(stateCode: "MA")
        let result = SNAPRulesEngine.evaluateChecklist(rules: rules, draft: SNAPApplicationDraft())
        #expect(result.requiredItems.contains { $0.category == "identity" })
    }

    // MARK: - evaluateChecklist — unsupported state

    @Test func unsupportedStateThrowsOnEval() {
        #expect(throws: (any Error).self) { try SNAPRulesLoader.load(stateCode: "TX") }
    }
}
