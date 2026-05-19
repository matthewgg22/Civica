import Foundation
import Testing
@testable import Civica

// Session A — CAStateRules LPIE override.
//
// Layout note: the plan specified `Civica Tests/SNAP/Rules/…` but the
// actual project layout under `Civica Tests/` is flat (see CAStateRulesTests,
// FederalDefaultRulesTests, etc.). We follow the existing convention so
// the file is picked up by the same Xcode test target as its peers.
//
// The override returns `.exempted(reason: .lpie)` only when ALL of:
//   1. `LPIEFeatureFlag.isEnabled` is true.
//   2. `draft.studentStatus.enrolledHalfTime == true`.
//   3. `draft.studentStatus.degreeOrCertificateProgram == true`.
// Otherwise we delegate to FederalDefaultRules — so the existing
// 5-path behavior is preserved.
//
// We isolate the flag store into a per-suite UserDefaults suite so
// tests don't bleed into one another (and don't touch the user's
// real defaults).

@Suite(.serialized)
struct CAStateRulesLPIETests {

    private let rules = CAStateRules()
    private let fy26Date = ISO8601DateFormatter().date(from: "2026-03-15T00:00:00Z")!

    // Per-suite isolated UserDefaults so we can flip the flag without
    // touching the user's real defaults. setUp/tearDown via init/deinit.
    private let suiteName = "civica.tests.lpie.\(UUID().uuidString)"
    private let defaults: UserDefaults

    init() {
        defaults = UserDefaults(suiteName: suiteName)!
        LPIEFeatureFlag.setStore(defaults)
    }

    // Pre-built minimal drafts. The federal student gate keys on
    // `studentStatus.enrolledInHigherEd`; we set it to true on the LPIE
    // paths to ensure the federal fall-through is exercised on the
    // "flag off" / partial-match scenarios.
    private func draft(half: Bool?, degree: Bool?, enrolled: Bool = true) -> SNAPApplicationDraft {
        var d = SNAPApplicationDraft()
        d.studentStatus.enrolledInHigherEd = enrolled
        d.studentStatus.enrolledHalfTime = half
        d.studentStatus.degreeOrCertificateProgram = degree
        return d
    }

    @Test func flagOnHalfTimeDegree_returnsLPIE() {
        LPIEFeatureFlag.setCachedValue(true)
        let out = rules.studentExemption(for: draft(half: true, degree: true), asOf: fy26Date)
        #expect(out == .exempted(reason: .lpie))
    }

    @Test func flagOff_fallsThroughToFederal() {
        LPIEFeatureFlag.setCachedValue(false)
        let out = rules.studentExemption(for: draft(half: true, degree: true), asOf: fy26Date)
        // Federal path: enrolled + half-time + no other exemption inputs
        // → categoricallyDisqualified.
        #expect(out == .categoricallyDisqualified)
    }

    @Test func flagOnButNotHalfTime_fallsThroughToFederal() {
        LPIEFeatureFlag.setCachedValue(true)
        let out = rules.studentExemption(for: draft(half: false, degree: true), asOf: fy26Date)
        #expect(out == .exempted(reason: .lessThanHalfTime))
    }

    @Test func flagOnButNotDegreeProgram_fallsThroughToFederal() {
        LPIEFeatureFlag.setCachedValue(true)
        let out = rules.studentExemption(for: draft(half: true, degree: false), asOf: fy26Date)
        #expect(out == .categoricallyDisqualified)
    }

    @Test func flagOnButDegreeNil_fallsThroughToFederal() {
        // degreeOrCertificateProgram unset (legacy drafts before the
        // field was added) must NOT trigger LPIE — that would be a
        // silent eligibility flip on existing user data.
        LPIEFeatureFlag.setCachedValue(true)
        let out = rules.studentExemption(for: draft(half: true, degree: nil), asOf: fy26Date)
        #expect(out == .categoricallyDisqualified)
    }

    @Test func defaultCacheValueIsTrue_so_LPIE_FiresOnColdLaunch() {
        // Don't touch the cache — fresh suite is empty. isEnabled should
        // report `true` (matches the seeded server-side default).
        let out = rules.studentExemption(for: draft(half: true, degree: true), asOf: fy26Date)
        #expect(out == .exempted(reason: .lpie))
    }
}
