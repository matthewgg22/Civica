import Foundation
import Testing
@testable import Civica

// IA-5 / CQ-4 of iOS audit 2026-05-29.
//
// Mirrors packages/snap-rules/test/appealability.test.ts: every TS case
// has a Swift twin so the two surfaces can't drift. JSON ships in the
// main app bundle via the "Sync SNAP Rules JSON" build phase (per
// CQ-4); the test bundle reaches it through .main.

private let referenceNow = Date(timeIntervalSince1970: 1_780_185_600) // 2026-05-30T12:00:00Z

private func daysAgo(_ n: Int) -> Date {
    referenceNow.addingTimeInterval(TimeInterval(-n * 86_400))
}

@Suite("AppealabilityService — IA-5 / CQ-4 (2026-05-29)")
struct AppealabilityServiceTests {

    // MARK: - Bundle smoke

    @Test func caRulesLoadFromBundle() {
        let rules = try? AppealabilityService.loadRules(stateCode: "CA")
        #expect(rules != nil, "appealability_ca.json must be present in the Civica bundle")
        #expect(rules?.stateCode == "CA")
        #expect(rules?.windowDays == 90)
    }

    @Test func maRulesLoadFromBundle() {
        let rules = try? AppealabilityService.loadRules(stateCode: "MA")
        #expect(rules != nil, "appealability_ma.json must be present in the Civica bundle")
        #expect(rules?.stateCode == "MA")
        #expect(rules?.windowDays == 90)
    }

    @Test func caNonAppealableCategoriesAreNonEmpty() {
        guard let rules = try? AppealabilityService.loadRules(stateCode: "CA") else { return }
        #expect(rules.nonAppealableCategories.isEmpty == false)
    }

    // MARK: - Behavior

    @Test("CA — within window with normal reason → appealable")
    func caWithinWindowAppealable() {
        let r = AppealabilityService.evaluate(
            reason: "missing_documents",
            state: "CA",
            decisionDate: daysAgo(30),
            now: referenceNow
        )
        #expect(r.isAppealable == true)
        #expect(r.reason == .withinWindow)
    }

    @Test("CA — outside the 90-day window → windowExpired")
    func caOutsideWindowExpired() {
        let r = AppealabilityService.evaluate(
            reason: "missing_documents",
            state: "CA",
            decisionDate: daysAgo(120),
            now: referenceNow
        )
        #expect(r.isAppealable == false)
        #expect(r.reason == .windowExpired)
    }

    @Test("CA — non-appealable category → categoryExcluded")
    func caCategoryExcluded() {
        let r = AppealabilityService.evaluate(
            reason: "already_active_other_county",
            state: "CA",
            decisionDate: daysAgo(15),
            now: referenceNow
        )
        #expect(r.isAppealable == false)
        #expect(r.reason == .categoryExcluded)
    }

    @Test("MA — within window with normal reason → appealable")
    func maWithinWindowAppealable() {
        let r = AppealabilityService.evaluate(
            reason: "missed_interview",
            state: "MA",
            decisionDate: daysAgo(30),
            now: referenceNow
        )
        #expect(r.isAppealable == true)
        #expect(r.reason == .withinWindow)
    }

    @Test("MA — withdrew_application is categoryExcluded")
    func maWithdrewExcluded() {
        let r = AppealabilityService.evaluate(
            reason: "withdrew_application",
            state: "MA",
            decisionDate: daysAgo(10),
            now: referenceNow
        )
        #expect(r.isAppealable == false)
        #expect(r.reason == .categoryExcluded)
    }

    @Test("Unknown / empty reason → unknownReason, defaults to appealable")
    func unknownReasonDefaultsAppealable() {
        let empty = AppealabilityService.evaluate(
            reason: "",
            state: "CA",
            decisionDate: daysAgo(10),
            now: referenceNow
        )
        #expect(empty.isAppealable == true)
        #expect(empty.reason == .unknownReason)

        let nilReason = AppealabilityService.evaluate(
            reason: nil,
            state: "CA",
            decisionDate: daysAgo(10),
            now: referenceNow
        )
        #expect(nilReason.isAppealable == true)
        #expect(nilReason.reason == .unknownReason)
    }

    @Test("Unknown state — bundle miss soft-fails to unknownReason / appealable")
    func unknownStateSoftFails() {
        let r = AppealabilityService.evaluate(
            reason: "missing_documents",
            state: "TX",
            decisionDate: daysAgo(10),
            now: referenceNow
        )
        // Per the doc on `AppealabilityService.evaluate(...)`: bundle
        // miss is a silent-fail-to-safe — Appeal stays the primary CTA.
        #expect(r.isAppealable == true)
        #expect(r.reason == .unknownReason)
    }
}
