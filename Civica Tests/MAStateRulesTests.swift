import Foundation
import Testing
@testable import Civica

// Locks in MA's BBCE 200% FPL table and the rules-version stamp
// bit-for-bit. If any of these expectations fail, somebody changed
// the MA threshold table or rules-version stamp -- update the
// numbers below intentionally rather than papering over the
// regression.

struct MAStateRulesTests {

    private let rules = MAStateRules()
    private let fy26Date = Self.iso("2026-03-15")
    private let fy27Date = Self.iso("2027-03-15")

    // MARK: - Identity

    @Test func stateCodeAndDisplayName() {
        #expect(rules.stateCode == "MA")
        #expect(rules.displayName == "Massachusetts")
    }

    // MARK: - Gross income (BBCE 200% FPL)

    @Test func grossIncomeLimitMatchesBBCETable() {
        #expect(rules.grossIncomeLimit(householdSize: 1, asOf: fy26Date) == 2_510)
        #expect(rules.grossIncomeLimit(householdSize: 2, asOf: fy26Date) == 3_408)
        #expect(rules.grossIncomeLimit(householdSize: 3, asOf: fy26Date) == 4_304)
        #expect(rules.grossIncomeLimit(householdSize: 4, asOf: fy26Date) == 5_200)
    }

    @Test func grossIncomeLimitClampsLargeHouseholdsToSizeFour() {
        let four = rules.grossIncomeLimit(householdSize: 4, asOf: fy26Date)
        #expect(rules.grossIncomeLimit(householdSize: 5, asOf: fy26Date) == four)
        #expect(rules.grossIncomeLimit(householdSize: 99, asOf: fy26Date) == four)
    }

    @Test func grossIncomeLimitClampsZeroAndNegativeToSizeOne() {
        let one = rules.grossIncomeLimit(householdSize: 1, asOf: fy26Date)
        #expect(rules.grossIncomeLimit(householdSize: 0, asOf: fy26Date) == one)
        #expect(rules.grossIncomeLimit(householdSize: -3, asOf: fy26Date) == one)
    }

    // MARK: - Net income (delegated to federal)

    @Test func netIncomeLimitDelegatesToFederal() {
        let federal = FederalDefaultRules()
        #expect(
            rules.netIncomeLimit(householdSize: 3, asOf: fy26Date)
                == federal.netIncomeLimit(householdSize: 3, asOf: fy26Date)
        )
    }

    // MARK: - MA SUA chart

    @Test func suaHeatingCoolingTier() {
        #expect(rules.suaValue(tier: .heatingCooling, asOf: fy26Date) == 799)
    }

    @Test func suaNonHeatingTier() {
        #expect(rules.suaValue(tier: .nonHeating, asOf: fy26Date) == 507)
    }

    @Test func suaPhoneOnlyTier() {
        #expect(rules.suaValue(tier: .phoneOnly, asOf: fy26Date) == 63)
    }

    @Test func suaNoneTierReturnsNil() {
        #expect(rules.suaValue(tier: .none, asOf: fy26Date) == nil)
    }

    // MARK: - Delegated methods match federal

    @Test func maxAllotmentDelegatesToFederal() {
        let federal = FederalDefaultRules()
        #expect(
            rules.maxAllotment(householdSize: 3, asOf: fy26Date)
                == federal.maxAllotment(householdSize: 3, asOf: fy26Date)
        )
    }

    @Test func minimumBenefitDelegatesToFederal() {
        #expect(rules.minimumBenefit(asOf: fy26Date) == 23)
    }

    @Test func earnedIncomeDeductionRateIsTwentyPercent() {
        #expect(rules.earnedIncomeDeductionRate(asOf: fy26Date) == Decimal(string: "0.20"))
    }

    // MARK: - ABAWD waiver (MA list not loaded yet)

    @Test func maABAWDWaiverLookupReturnsNilUntilDataLoaded() {
        #expect(rules.abawdWaiverActive(fipsCode: "25025", asOf: fy26Date) == nil)
    }

    // MARK: - Categorical eligibility (MA adds BBCE as fallback)

    @Test func maTANFRecipientPathInherited() {
        var draft = SNAPApplicationDraft()
        draft.household.receivesTANF = true
        #expect(
            rules.categoricalEligibility(for: draft, asOf: fy26Date)
                == .categoricallyEligible(via: .tanf)
        )
    }

    @Test func maEmptyDraftFallsBackToBBCE() {
        // MA's BBCE applies to every screener session that completes
        // the DTA SNAP brochure trigger (per existing product design).
        let draft = SNAPApplicationDraft()
        #expect(
            rules.categoricalEligibility(for: draft, asOf: fy26Date)
                == .categoricallyEligible(via: .bbce(stateCode: "MA"))
        )
    }

    @Test func maExplicitFalseCashFlagsStillBBCE() {
        var draft = SNAPApplicationDraft()
        draft.household.receivesTANF = false
        draft.household.receivesSSI = false
        draft.household.receivesGeneralAssistance = false
        #expect(
            rules.categoricalEligibility(for: draft, asOf: fy26Date)
                == .categoricallyEligible(via: .bbce(stateCode: "MA"))
        )
    }

    // MARK: - Rules-version stamp

    @Test func rulesVersionStampForFY26() {
        #expect(rules.rulesVersion(asOf: fy26Date) == "MA-bbce-200pct-FY26")
    }

    @Test func rulesVersionFallsBackToLatestOutsideWindow() {
        // FY27 isn't loaded yet -- the implementation falls back to
        // the latest known snapshot rather than crashing.
        #expect(rules.rulesVersion(asOf: fy27Date) == "MA-bbce-200pct-FY26")
    }

    // MARK: - Snapshot freshness (OBBBA audit Q12)

    @Test func snapshotStatusIsCurrentInsideFY26() {
        let status = rules.snapshotStatus(asOf: fy26Date)
        let fy26End = Self.iso("2026-09-30")
        #expect(status == .current(latestExpiry: fy26End))
    }

    /// MA freshness intersects federal + MA's BBCE + SUA windows.
    /// Past the earliest expiry (FY26 end-of-window), status flips.
    @Test func snapshotStatusIsExpiredAfterFY26End() {
        let fy26End = Self.iso("2026-09-30")
        let justAfter = fy26End.addingTimeInterval(1)
        let status = rules.snapshotStatus(asOf: justAfter)
        #expect(status == .expired(latestExpiry: fy26End))
    }

    // MARK: - Helpers

    private static func iso(_ string: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f.date(from: string)!
    }
}
