import Foundation
import Testing
@testable import Civica

// Locks in the JSON-driven engine's behaviour for the two profiles
// shipped today (CA + MA) plus the slot-in path for a future
// hypothetical state that uses only the profile (no logic overrides).
//
// Asserts:
//   1. The bundled profile JSON loads cleanly via the default init.
//   2. A handcrafted profile with no BBCE / no SUA / RMP=false falls
//      back to federal defaults cleanly — the "drop in a JSON, no
//      Swift" path for future states.
//   3. The RMP default implementation (which CA piggy-backs on) runs
//      the federal elderly/disabled/unhoused check correctly.

struct JsonDrivenStateRulesTests {

    private let fy26Date = Self.iso("2026-03-15")

    // MARK: - Profile loading

    @Test func caProfileLoadsFromBundle() {
        let rules = JsonDrivenStateRules(stateCode: "CA")
        #expect(rules.stateCode == "CA")
        #expect(rules.displayName == "California")
        #expect(rules.profile.bbce?.enabled == true)
        #expect(rules.profile.bbce?.thresholdFplPct == 200)
        #expect(rules.profile.rmp.operated == true)
        #expect(rules.profile.abawd.waiversLoaded == false)
    }

    @Test func maProfileLoadsFromBundle() {
        let rules = JsonDrivenStateRules(stateCode: "MA")
        #expect(rules.stateCode == "MA")
        #expect(rules.displayName == "Massachusetts")
        #expect(rules.profile.bbce?.enabled == true)
        #expect(rules.profile.bbce?.thresholdFplPct == 200)
        #expect(rules.profile.rmp.operated == false)
        #expect(rules.profile.abawd.waiversLoaded == false)
    }

    // MARK: - JSON-driven values match the hand-built reference

    @Test func caBBCEMatchesHardcodedReference() {
        // Pins JSON values against the CDSS ACIN I-46-25 numbers the
        // SwiftUI tests have always verified. If snap_eligibility_ca.json
        // ever drifts from these, this catches it before the surface tests do.
        let rules = JsonDrivenStateRules(stateCode: "CA")
        #expect(rules.grossIncomeLimit(householdSize: 1, asOf: fy26Date) == 2_610)
        #expect(rules.grossIncomeLimit(householdSize: 4, asOf: fy26Date) == 5_360)
        #expect(rules.grossIncomeLimit(householdSize: 8, asOf: fy26Date) == 9_026)
        #expect(rules.suaValue(tier: .heatingCooling, asOf: fy26Date) == 663)
        #expect(rules.suaValue(tier: .nonHeating, asOf: fy26Date) == 170)
        #expect(rules.suaValue(tier: .phoneOnly, asOf: fy26Date) == 20)
    }

    @Test func maBBCEMatchesHardcodedReference() {
        let rules = JsonDrivenStateRules(stateCode: "MA")
        #expect(rules.grossIncomeLimit(householdSize: 1, asOf: fy26Date) == 2_660)
        #expect(rules.grossIncomeLimit(householdSize: 4, asOf: fy26Date) == 5_500)
        #expect(rules.grossIncomeLimit(householdSize: 8, asOf: fy26Date) == 9_287)
        #expect(rules.suaValue(tier: .heatingCooling, asOf: fy26Date) == 914)
        #expect(rules.suaValue(tier: .nonHeating, asOf: fy26Date) == 556)
        #expect(rules.suaValue(tier: .phoneOnly, asOf: fy26Date) == 64)
    }

    // MARK: - "Drop in a JSON" path — federal-baseline state with no BBCE

    /// The lowest-effort new-state path: profile declares no BBCE, no
    /// SUA, no waivers, no RMP. Engine falls through to federal default
    /// for income limits and stamps a federal-default version string.
    @Test func federalBaselineStateProfileFallsBackToFederal() {
        let federalBaselineProfile = StateRuleProfile(
            stateCode: "ZZ",
            displayName: "Federal Baseline (test only)",
            version: "test-1.0",
            asOfDate: "2026-06-01",
            sourceCitations: nil,
            bbce: nil,
            sua: nil,
            abawd: StateRuleProfile.ABAWDConfig(waiversLoaded: false, waivers: []),
            rmp: StateRuleProfile.RMPConfig(operated: false, participatingCountiesFips: []),
            categoricalEligibility: nil
        )
        let rules = JsonDrivenStateRules(profile: federalBaselineProfile)
        let federal = FederalDefaultRules()

        // Gross income falls back to federal 130% FPL.
        #expect(
            rules.grossIncomeLimit(householdSize: 4, asOf: fy26Date)
                == federal.grossIncomeLimit(householdSize: 4, asOf: fy26Date)
        )
        // No SUA when profile.sua is nil.
        #expect(rules.suaValue(tier: .heatingCooling, asOf: fy26Date) == nil)
        // No ABAWD waiver list loaded → nil.
        #expect(rules.abawdWaiverActive(fipsCode: "12345", asOf: fy26Date) == nil)
        // No RMP.
        var draft = SNAPApplicationDraft()
        draft.household.hasElderlyOrDisabled = true
        #expect(
            rules.restaurantMealsProgramEligibility(for: draft, asOf: fy26Date)
                == .notOperated
        )
        // Version stamp falls through to federal-default.
        #expect(rules.rulesVersion(asOf: fy26Date) == "ZZ-federal-default")
    }

    /// Future states that operate RMP statewide get the federal
    /// elderly/disabled/unhoused evaluation for free from the default
    /// implementation. CA piggy-backs on the same code path via the
    /// CAStateRules wrapper — these tests pin the default behaviour so
    /// any change to the shared eligibility logic shows up here first.
    @Test func defaultRMPEvaluatesElderlyOrDisabled() {
        let profile = StateRuleProfile(
            stateCode: "ZZ",
            displayName: "Test",
            version: "1.0",
            asOfDate: "2026-06-01",
            sourceCitations: nil,
            bbce: nil,
            sua: nil,
            abawd: StateRuleProfile.ABAWDConfig(waiversLoaded: false, waivers: []),
            rmp: StateRuleProfile.RMPConfig(operated: true, participatingCountiesFips: []),
            categoricalEligibility: nil
        )
        let rules = JsonDrivenStateRules(profile: profile)

        var draft = SNAPApplicationDraft()
        draft.household.hasElderlyOrDisabled = true
        draft.whereApplying.housingStatus = .stableHome
        guard case .eligible(let reasons) = rules.restaurantMealsProgramEligibility(
            for: draft, asOf: fy26Date
        ) else {
            Issue.record("Expected .eligible for elderly/disabled household")
            return
        }
        #expect(reasons.contains(.disabled))
    }

    @Test func defaultRMPEvaluatesUnhoused() {
        let profile = StateRuleProfile(
            stateCode: "ZZ",
            displayName: "Test",
            version: "1.0",
            asOfDate: "2026-06-01",
            sourceCitations: nil,
            bbce: nil,
            sua: nil,
            abawd: StateRuleProfile.ABAWDConfig(waiversLoaded: false, waivers: []),
            rmp: StateRuleProfile.RMPConfig(operated: true, participatingCountiesFips: []),
            categoricalEligibility: nil
        )
        let rules = JsonDrivenStateRules(profile: profile)

        var draft = SNAPApplicationDraft()
        draft.whereApplying.housingStatus = .unhoused
        guard case .eligible(let reasons) = rules.restaurantMealsProgramEligibility(
            for: draft, asOf: fy26Date
        ) else {
            Issue.record("Expected .eligible for unhoused household")
            return
        }
        #expect(reasons.contains(.unhoused))
    }

    // MARK: - ABAWD waiver activation path

    /// When a profile flips `waivers_loaded: true` and supplies a
    /// matching FIPS waiver, the lookup returns true. Pins the
    /// "waivers-loaded happy path" so MA's pre-pilot operator action
    /// (load FY26 waivers) has a regression test waiting.
    @Test func loadedWaiversReturnTrueForCoveredCounty() {
        let waiver = StateRuleProfile.ABAWDConfig.Waiver(
            fipsCode: "25025", // Suffolk MA
            effectiveFrom: "2026-01-01",
            expiresOn: "2026-12-31",
            source: "test"
        )
        let profile = StateRuleProfile(
            stateCode: "MA",
            displayName: "Massachusetts (test)",
            version: "test-1.0",
            asOfDate: "2026-06-01",
            sourceCitations: nil,
            bbce: nil,
            sua: nil,
            abawd: StateRuleProfile.ABAWDConfig(waiversLoaded: true, waivers: [waiver]),
            rmp: StateRuleProfile.RMPConfig(operated: false, participatingCountiesFips: []),
            categoricalEligibility: nil
        )
        let rules = JsonDrivenStateRules(profile: profile)
        #expect(rules.abawdWaiverActive(fipsCode: "25025", asOf: fy26Date) == true)
        // Uncovered county returns false (not nil) when waivers_loaded.
        #expect(rules.abawdWaiverActive(fipsCode: "25027", asOf: fy26Date) == false)
    }

    // MARK: - Helper

    private static func iso(_ string: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f.date(from: string)!
    }
}
