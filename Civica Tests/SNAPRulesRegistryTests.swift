import Foundation
import Testing
@testable import Civica

// Locks in the stateCode -> conformer dispatch. Future states get
// one assertion each here as they land.

struct SNAPRulesRegistryTests {

    @Test func uppercaseMARoutesToMAStateRules() {
        let rules = SNAPRulesRegistry.rules(for: "MA")
        #expect(rules.stateCode == "MA")
    }

    @Test func lowercaseMARoutesToMAStateRules() {
        // The dispatch uppercases the input.
        let rules = SNAPRulesRegistry.rules(for: "ma")
        #expect(rules.stateCode == "MA")
    }

    @Test func nilStateCodeFallsBackToFederalDefault() {
        let rules = SNAPRulesRegistry.rules(for: nil)
        #expect(rules.stateCode == "FEDERAL_DEFAULT")
    }

    @Test func emptyStateCodeFallsBackToFederalDefault() {
        let rules = SNAPRulesRegistry.rules(for: "")
        #expect(rules.stateCode == "FEDERAL_DEFAULT")
    }

    @Test func uppercaseCARoutesToCAStateRules() {
        let rules = SNAPRulesRegistry.rules(for: "CA")
        #expect(rules.stateCode == "CA")
    }

    @Test func lowercaseCARoutesToCAStateRules() {
        let rules = SNAPRulesRegistry.rules(for: "ca")
        #expect(rules.stateCode == "CA")
    }

    @Test func nonTunedStateFallsBackToFederalDefault() {
        let rules = SNAPRulesRegistry.rules(for: "NY")
        #expect(rules.stateCode == "FEDERAL_DEFAULT")
    }

    @Test func explicitOTHERFallsBackToFederalDefault() {
        let rules = SNAPRulesRegistry.rules(for: "OTHER")
        #expect(rules.stateCode == "FEDERAL_DEFAULT")
    }
}
