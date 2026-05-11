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

    // MARK: - Rules-version stamp

    @Test func rulesVersionStampForFY26() {
        #expect(rules.rulesVersion(asOf: fy26Date) == "MA-bbce-200pct-FY26")
    }

    @Test func rulesVersionFallsBackToLatestOutsideWindow() {
        // FY27 isn't loaded yet -- the implementation falls back to
        // the latest known snapshot rather than crashing.
        #expect(rules.rulesVersion(asOf: fy27Date) == "MA-bbce-200pct-FY26")
    }

    // MARK: - Helpers

    private static func iso(_ string: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f.date(from: string)!
    }
}
