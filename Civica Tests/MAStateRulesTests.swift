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
        // DTA 106 CMR 364.976 verified values (effective 2026-02-01).
        #expect(rules.grossIncomeLimit(householdSize: 1, asOf: fy26Date) == 2_660)
        #expect(rules.grossIncomeLimit(householdSize: 2, asOf: fy26Date) == 3_607)
        #expect(rules.grossIncomeLimit(householdSize: 3, asOf: fy26Date) == 4_553)
        #expect(rules.grossIncomeLimit(householdSize: 4, asOf: fy26Date) == 5_500)
        #expect(rules.grossIncomeLimit(householdSize: 5, asOf: fy26Date) == 6_447)
        #expect(rules.grossIncomeLimit(householdSize: 6, asOf: fy26Date) == 7_393)
        #expect(rules.grossIncomeLimit(householdSize: 7, asOf: fy26Date) == 8_340)
        #expect(rules.grossIncomeLimit(householdSize: 8, asOf: fy26Date) == 9_287)
    }

    @Test func grossIncomeLimitExtendsBeyondEightWithPerAdditional() {
        // Per DTA 106 CMR 364.976: +$947 per HH member beyond 8.
        let eight = rules.grossIncomeLimit(householdSize: 8, asOf: fy26Date)
        #expect(rules.grossIncomeLimit(householdSize: 9, asOf: fy26Date) == eight + 947)
        #expect(rules.grossIncomeLimit(householdSize: 10, asOf: fy26Date) == eight + 1_894)
        #expect(rules.grossIncomeLimit(householdSize: 12, asOf: fy26Date) == eight + 3_788)
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

    // MARK: - MA SUA chart (DTA 106 CMR 364.945, FY26)

    @Test func suaHeatingCoolingTier() {
        // FY26 H/C SUA = $914. Bay State CAP recipients use this tier.
        #expect(rules.suaValue(tier: .heatingCooling, asOf: fy26Date) == 914)
    }

    @Test func suaNonHeatingTier() {
        #expect(rules.suaValue(tier: .nonHeating, asOf: fy26Date) == 556)
    }

    @Test func suaPhoneOnlyTier() {
        #expect(rules.suaValue(tier: .phoneOnly, asOf: fy26Date) == 64)
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

    // MARK: - ABAWD age band (delegated to federal, but assert per-state for regression safety)
    //
    // MA delegates abawdStatus to FederalDefaultRules — meaning a
    // future PR that adds MA-specific ABAWD logic shouldn't silently
    // change the OBBBA §10102(a) ceiling. These tests pin the
    // expected age-band behavior at the MA-engine seam.

    @Test func maABAWD18IsSubject() {
        let draft = Self.draftWithAge(18)
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .subjectActive)
    }

    @Test func maABAWD64IsSubject() {
        // OBBBA §10102(a) raised the upper bound from 54 to 64.
        let draft = Self.draftWithAge(64)
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .subjectActive)
    }

    @Test func maABAWD65IsNotSubject() {
        let draft = Self.draftWithAge(65)
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .notSubject)
    }

    @Test func maABAWDWithChildUnder14IsNotSubject() {
        var draft = Self.draftWithAge(30)
        draft.household.hasChildUnder14InHousehold = true
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .notSubject)
    }

    @Test func maABAWDWithChild14OrOlderIsSubject() {
        // OBBBA §10102(a) narrowed the dependent-child exception
        // from "under 18" to "under 14". A 30yo with only a 14+
        // child in the household is now ABAWD-subject.
        var draft = Self.draftWithAge(30)
        draft.household.hasMinorInHousehold = true
        draft.household.hasChildUnder14InHousehold = false
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .subjectActive)
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

    // MARK: - Restaurant Meals Program (MA does not operate)

    @Test func maRMPAlwaysNotOperated() {
        // Even with qualifying household status, MA does not run
        // RMP — the EBT card can't be used for hot prepared meals.
        var draft = SNAPApplicationDraft()
        draft.whereApplying.housingStatus = .unhoused
        draft.household.hasElderlyOrDisabled = true
        #expect(
            rules.restaurantMealsProgramEligibility(for: draft, asOf: fy26Date)
                == .notOperated
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

    /// Builds a minimal draft with the applicant at the given age
    /// as of fy26Date (2026-03-15) and no minor/elderly flags.
    /// Mirrors the helper in FederalDefaultRulesTests + CAStateRulesTests
    /// so the cross-state regression assertions read identically.
    private static func draftWithAge(_ age: Int) -> SNAPApplicationDraft {
        var draft = SNAPApplicationDraft()
        let calendar = Calendar(identifier: .gregorian)
        let referenceDate = iso("2026-03-15")
        if let dob = calendar.date(byAdding: .year, value: -age, to: referenceDate) {
            draft.applicantAge.dateOfBirth = dob
        }
        draft.household.hasMinorInHousehold = false
        draft.household.hasElderlyOrDisabled = false
        return draft
    }
}
