import Foundation

// Single dispatch point from a stateCode (as captured by
// SNAPWhereApplyingAnswers) to the active SNAPStateRuleEngine
// conformer. Adding a new state is a one-line change here:
//
//     case "NY": return NYStateRules()
//
// Anything not in the switch falls back to FederalDefaultRules so
// non-tuned states still get a directional federal-baseline
// verdict instead of a dead-end "we cannot help".

enum SNAPRulesRegistry {
    static func rules(for stateCode: String?) -> SNAPStateRuleEngine {
        switch (stateCode ?? "").uppercased() {
        case "CA": return CAStateRules()
        case "MA": return MAStateRules()
        default:   return FederalDefaultRules()
        }
    }
}
