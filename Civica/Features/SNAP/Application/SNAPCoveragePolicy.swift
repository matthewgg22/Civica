import Foundation

// Single source of truth for which states Civica's SNAP screener
// supports today. Every entry point that runs eligibility math or
// shows a benefit estimate must consult this policy and route
// out-of-scope users to the unsupported-state view instead.
//
// Per OBBBA audit Q7 (Revision 2): "Implement a central
// SNAPCoveragePolicy or equivalent and call it at every SNAP entry
// point. For out-of-scope users, show an unsupported-state view
// with official resources rather than running the estimator." The
// orchestrator gate already exists; this policy is what the gate
// (and the standalone estimator entry, and the launch-time
// invalidation routine in CivicaUserData) all consult together so
// the scope rule lives in one place.
//
// 2026-05-13: California is the launch state. MA is retained as a
// peer because the original screener was authored for MA and
// existing draft users may still resolve to it.

enum SNAPCoveragePolicy {

    /// USPS two-letter codes Civica's SNAP screener is tuned for.
    /// Expanding scope is one PR that adds a state to this set, adds
    /// a SNAPStateRuleEngine conformer, and signs the relevant rows
    /// of docs/SNAP-source-citation-signoff.md.
    static let supportedStateCodes: Set<String> = ["CA", "MA"]

    /// Whether the user's selected state is one the screener can
    /// serve today. Returns false for nil — callers that want
    /// "not yet answered" semantics should test for nil explicitly
    /// rather than relying on this method.
    static func isStateInScope(_ stateCode: String?) -> Bool {
        guard let stateCode else { return false }
        return supportedStateCodes.contains(canonical(stateCode))
    }

    /// Whether the orchestrator/estimator should route the user to
    /// the unsupported-state view. Matches the established
    /// SNAPApplicationFlowOrchestrator.shouldShowUnsupportedStateGate
    /// pattern: nil state codes are pre-question, not out-of-scope,
    /// so the gate stays out of the way until the user has picked
    /// a state.
    static func shouldShowUnsupportedStateGate(for stateCode: String?) -> Bool {
        guard let stateCode else { return false }
        return !isStateInScope(stateCode)
    }

    /// Canonicalizes a state code for set membership: uppercased,
    /// trimmed. "ma", " ma ", "MA" all canonicalize to "MA".
    static func canonical(_ stateCode: String) -> String {
        stateCode.trimmingCharacters(in: .whitespaces).uppercased()
    }
}
