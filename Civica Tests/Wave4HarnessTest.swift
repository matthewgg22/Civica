// Wave 4 — iOS production engine cross-engine grader.
//
// Loads the v0.6 fixture, iterates every profile (and every A/B
// variant), runs the iOS production composer
// `SNAPLocalEligibilityEvaluator.evaluate(draft, today:)`, and writes
// the results to a JSON file the TS profile-harness reads via its
// `--engine swift-ios` adapter.
//
// This is THE third axis in the cross-engine grading: TS port, Swift
// port, and now iOS production code. Any divergence from TS/Swift port
// localizes to iOS production gate logic (specifically, what the
// iOS evaluator chooses NOT to compose — it deliberately skips the
// full deduction stack + asset test + ABAWD time limit per its header
// comment, calling itself a "thin gate").

import Foundation
import Testing
@testable import Civica

/// Runs as a unit test that writes a JSON results file. Invoked via
/// the standard CivicaTests target; the profile-harness wraps the
/// invocation with `xcodebuild test -only-testing:...`.
struct Wave4HarnessTest {

    private static func suiteURL() throws -> URL {
        let here = URL(fileURLWithPath: #filePath)
        let repoRoot = here.deletingLastPathComponent().deletingLastPathComponent()
        return repoRoot
            .appendingPathComponent("data-ops")
            .appendingPathComponent("sample")
            .appendingPathComponent("civica-test-profiles")
            .appendingPathComponent("v0.6.json")
    }

    private static let outputPath = "/tmp/civica-ios-prod-results.json"

    /// Single-shot test: load fixture, iterate, write JSON. The harness
    /// reads the file; failure here means the iOS engine threw or the
    /// adapter broke on a specific profile.
    @Test func dumpIosProductionVerdicts() throws {
        let suite = try CivicaTestProfileSuite.load(from: try Self.suiteURL())

        struct EnvelopeJson: Codable {
            let engine: String
            let generated_at_iso: String
            let results: [ResultRowJson]
        }

        var results: [ResultRowJson] = []

        // Cross-state sweep: run every profile for both CA + MA the
        // way the TS harness does (so the cross-engine join keys match).
        for state in ["CA", "MA"] {
            for profile in suite.profiles {
                if let expectedByState = profile.expectedByState, expectedByState[state] != nil {
                    let asOf = Self.parseAsOf(profile.asOfDate) ?? Self.defaultAsOf
                    let r = Self.runOne(profile: profile, variantKey: nil as String?, factsOverride: nil as Facts?, state: state, asOf: asOf)
                    results.append(r)
                } else if let expected = profile.expected {
                    for (variantKey, variant) in expected.variants {
                        // Run base facts for every variant in Wave 4 first cut.
                        // (Swift facts_patch port is Wave 4.1.)
                        _ = variant
                        let asOf = Self.parseAsOf(profile.asOfDate) ?? Self.defaultAsOf
                        let r = Self.runOne(profile: profile, variantKey: variantKey, factsOverride: nil as Facts?, state: state, asOf: asOf)
                        results.append(r)
                    }
                }
            }
        }

        let envelope = EnvelopeJson(
            engine: "swift-ios:prod-evaluator@1",
            generated_at_iso: ISO8601DateFormatter().string(from: Date()),
            results: results
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(envelope)
        try data.write(to: URL(fileURLWithPath: Self.outputPath))

        #expect(results.isEmpty == false, "no results produced — adapter or fixture broken")
        // Surface the path so the test log shows where the harness reads from.
        print("[Wave4HarnessTest] Wrote \(results.count) results to \(Self.outputPath)")
    }

    // ─── Per-profile execution ──────────────────────────────────────

    private static let defaultAsOf: Date = {
        var c = DateComponents()
        c.year = 2026; c.month = 6; c.day = 1
        c.timeZone = TimeZone(identifier: "UTC")
        return Calendar(identifier: .gregorian).date(from: c)!
    }()

    private static func parseAsOf(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        return f.date(from: iso)
    }

    private static func runOne(
        profile: Profile,
        variantKey: String?,
        factsOverride: Facts?,
        state: String,
        asOf: Date
    ) -> Wave4HarnessTest.ResultRowJson {
        let facts = factsOverride ?? profile.facts
        let draft = Wave4FactsAdapter.draft(from: facts, state: state)
        let result = SNAPLocalEligibilityEvaluator.evaluate(draft, today: asOf)

        let verdictStr: String
        switch result.status {
        case .eligible, .eligibleWithConditions: verdictStr = "APPROVE"
        case .ineligible: verdictStr = "DENY"
        case .insufficientInformation: verdictStr = "DENY"
        }
        let benefit: Double? = result.benefitCalculation.map { Double(truncating: $0.monthlyBenefit as NSDecimalNumber) }

        let suffix = variantKey.map { "[\($0)]" } ?? ""
        return ResultRowJson(
            profile_id: profile.id + suffix,
            legacy_id: profile.legacyID + suffix,
            state: state,
            verdict: verdictStr,
            benefit: benefit,
            reason: result.ineligibilityReason ?? result.contributingFactors.joined(separator: ","),
            expedited_eligible: result.expeditedEligible
        )
    }

    /// Wire-shape struct for the JSON dump (mirrors EngineResultJson
    /// declared inside the test method for scope reasons).
    struct ResultRowJson: Codable {
        let profile_id: String
        let legacy_id: String
        let state: String
        let verdict: String?
        let benefit: Double?
        let reason: String?
        let expedited_eligible: Bool?
    }
}
