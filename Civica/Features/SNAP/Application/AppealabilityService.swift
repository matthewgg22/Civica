import Foundation

// IA-5 / CQ-4 of iOS audit 2026-05-29.
//
// Pure (stateless) evaluator that gates the Appeal primary-button
// assignment on the denial view. Not all denials are appealable —
// the 90-day federal fair-hearing window (7 CFR 273.15) closes,
// and certain procedural categories (already-active in another
// jurisdiction, withdrew application, expired without recert) are
// never appealable in the first place.
//
// Data source: packages/snap-rules/rules/appealability/{STATE}.json
// is synced into the iOS bundle by the existing "Sync SNAP Rules
// JSON" build phase (per CQ-4) — resource names appealability_ca.json
// and appealability_ma.json. The TS evaluator is the canonical impl;
// this Swift version mirrors the same rule data so both surfaces stay
// in lock-step.

/// Result returned by `AppealabilityService.evaluate(...)`.
///
/// The `reason` discriminator lets the denial view tailor copy on
/// the demoted Appeal card ("the 90-day window has closed" vs.
/// "this category isn't appealable") without re-deriving state.
struct AppealabilityResult: Equatable {
    enum Reason: String, Equatable {
        /// Within the fair-hearing window AND not in the
        /// non-appealable list. Default "happy path" — Appeal stays
        /// the primary CTA.
        case withinWindow = "within_window"

        /// Past the state's window_days from decision date.
        case windowExpired = "window_expired"

        /// Denial reason matched a non_appealable_categories entry.
        case categoryExcluded = "category_excluded"

        /// No denial reason has been ingested yet. Defaults to
        /// appealable so we don't accidentally block a user with a
        /// real right of appeal — mirrors today's behavior.
        case unknownReason = "unknown_reason"
    }

    let isAppealable: Bool
    let reason: Reason
}

/// Bundled rule shape — mirrors AppealabilityRulesSchema in TS.
struct AppealabilityRules: Codable, Equatable {
    let stateCode: String
    let version: Int
    let asOfDate: String
    let windowDays: Int
    let nonAppealableCategories: [String]
    let source: String?

    enum CodingKeys: String, CodingKey {
        case stateCode = "state_code"
        case version
        case asOfDate = "as_of_date"
        case windowDays = "window_days"
        case nonAppealableCategories = "non_appealable_categories"
        case source
    }
}

enum AppealabilityService {

    enum LoadError: Error, LocalizedError {
        case fileNotFound(stateCode: String)
        case decodingFailed(stateCode: String, underlying: Error)

        var errorDescription: String? {
            switch self {
            case .fileNotFound(let s):
                return "Appealability: no bundle resource named 'appealability_\(s.lowercased()).json' — "
                    + "ensure the 'Sync SNAP Rules JSON' build phase has run."
            case .decodingFailed(let s, let e):
                return "Appealability: failed to decode rules for '\(s)': \(e.localizedDescription)"
            }
        }
    }

    /// Loads the appealability rule bundle for `stateCode`. Lookup
    /// is case-insensitive and resolves to `appealability_{state}.json`.
    static func loadRules(stateCode: String, bundle: Bundle = .main) throws -> AppealabilityRules {
        let resourceName = "appealability_\(stateCode.lowercased())"
        guard let url = bundle.url(forResource: resourceName, withExtension: "json") else {
            throw LoadError.fileNotFound(stateCode: stateCode)
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(AppealabilityRules.self, from: data)
        } catch {
            throw LoadError.decodingFailed(stateCode: stateCode, underlying: error)
        }
    }

    /// Pure evaluator. `reason` is the raw classifier code from the
    /// inbound denial notice (free-form until inbound-notice
    /// ingestion ships). `state` is the two-letter USPS code on the
    /// applicant's draft. `decisionDate` is the milestone timestamp
    /// the status store carries for `.decisionDenied`.
    ///
    /// `now` defaults to `Date()`; tests inject a frozen clock.
    /// `bundle` defaults to `.main`; tests inject a test bundle that
    /// ships the rule JSON as a test resource.
    ///
    /// On any rule-load failure we fall back to `.unknownReason`
    /// (appealable). The denial view never has to handle the throwing
    /// path — silent-fail-to-safe matches the IS-2 / IS-7 posture for
    /// data the user can't act on.
    static func evaluate(
        reason: String?,
        state: String,
        decisionDate: Date,
        now: Date = Date(),
        bundle: Bundle = .main
    ) -> AppealabilityResult {
        let rules: AppealabilityRules
        do {
            rules = try loadRules(stateCode: state, bundle: bundle)
        } catch {
            // Soft-fail: treat as unknown_reason so Appeal stays the
            // primary CTA. The denial UI is not the place to surface
            // a missing-rule-bundle error.
            return AppealabilityResult(isAppealable: true, reason: .unknownReason)
        }

        guard let reason, !reason.isEmpty else {
            return AppealabilityResult(isAppealable: true, reason: .unknownReason)
        }

        if rules.nonAppealableCategories.contains(reason) {
            return AppealabilityResult(isAppealable: false, reason: .categoryExcluded)
        }

        let calendar = Calendar(identifier: .gregorian)
        let components = calendar.dateComponents([.day], from: decisionDate, to: now)
        let daysSince = components.day ?? 0
        if daysSince > rules.windowDays {
            return AppealabilityResult(isAppealable: false, reason: .windowExpired)
        }

        return AppealabilityResult(isAppealable: true, reason: .withinWindow)
    }
}
