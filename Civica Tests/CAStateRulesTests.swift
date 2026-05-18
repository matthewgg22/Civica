import Foundation
import Testing
@testable import Civica

// Locks in CA's BBCE 200% FPL table and the rules-version stamp
// bit-for-bit. If any of these expectations fail, somebody changed
// the CA threshold table or rules-version stamp -- update the
// numbers below intentionally rather than papering over the
// regression.

struct CAStateRulesTests {

    private let rules = CAStateRules()
    private let fy26Date = Self.iso("2026-03-15")
    private let fy27Date = Self.iso("2027-03-15")

    // MARK: - Identity

    @Test func stateCodeAndDisplayName() {
        #expect(rules.stateCode == "CA")
        #expect(rules.displayName == "California")
    }

    // MARK: - Gross income (BBCE 200% FPL)

    @Test func grossIncomeLimitMatchesBBCETable() {
        // CDSS ACIN I-46-25 (FFY 2026) verified values.
        #expect(rules.grossIncomeLimit(householdSize: 1, asOf: fy26Date) == 2_610)
        #expect(rules.grossIncomeLimit(householdSize: 2, asOf: fy26Date) == 3_526)
        #expect(rules.grossIncomeLimit(householdSize: 3, asOf: fy26Date) == 4_442)
        #expect(rules.grossIncomeLimit(householdSize: 4, asOf: fy26Date) == 5_360)
        #expect(rules.grossIncomeLimit(householdSize: 5, asOf: fy26Date) == 6_276)
        #expect(rules.grossIncomeLimit(householdSize: 6, asOf: fy26Date) == 7_192)
        #expect(rules.grossIncomeLimit(householdSize: 7, asOf: fy26Date) == 8_110)
        #expect(rules.grossIncomeLimit(householdSize: 8, asOf: fy26Date) == 9_026)
    }

    @Test func grossIncomeLimitExtendsBeyondEightWithPerAdditional() {
        // Per CDSS ACIN I-46-25: +$918 per HH member beyond 8.
        let eight = rules.grossIncomeLimit(householdSize: 8, asOf: fy26Date)
        #expect(rules.grossIncomeLimit(householdSize: 9, asOf: fy26Date) == eight + 918)
        #expect(rules.grossIncomeLimit(householdSize: 10, asOf: fy26Date) == eight + 1_836)
        #expect(rules.grossIncomeLimit(householdSize: 12, asOf: fy26Date) == eight + 3_672)
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

    // MARK: - CA SUA (CDSS ACL 25-68, FY26 chart)

    @Test func suaValuesMatchCDSSChart() {
        // SUA full = $663, LUA = $170, TUA = $20 per CDSS ACL 25-68.
        // Tier `.none` always returns nil (calculator itemizes actuals).
        #expect(rules.suaValue(tier: .heatingCooling, asOf: fy26Date) == 663)
        #expect(rules.suaValue(tier: .nonHeating, asOf: fy26Date) == 170)
        #expect(rules.suaValue(tier: .phoneOnly, asOf: fy26Date) == 20)
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
        // FY26 federal minimum benefit per FNS COLA memo.
        #expect(rules.minimumBenefit(asOf: fy26Date) == 24)
    }

    @Test func earnedIncomeDeductionRateIsTwentyPercent() {
        #expect(rules.earnedIncomeDeductionRate(asOf: fy26Date) == Decimal(string: "0.20"))
    }

    // MARK: - ABAWD waiver (CA list not loaded yet)

    @Test func caABAWDWaiverLookupReturnsNilUntilDataLoaded() {
        // 06037 = Los Angeles County FIPS.
        #expect(rules.abawdWaiverActive(fipsCode: "06037", asOf: fy26Date) == nil)
    }

    // MARK: - ABAWD age band (delegated to federal, but assert per-state for regression safety)
    //
    // CA delegates abawdStatus to FederalDefaultRules — meaning a
    // future PR that adds CA-specific ABAWD logic shouldn't silently
    // change the OBBBA §10102(a) ceiling. These tests pin the
    // expected age-band behavior at the CA-engine seam.

    @Test func caABAWD18IsSubject() {
        let draft = Self.draftWithAge(18)
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .subjectActive)
    }

    @Test func caABAWD64IsSubject() {
        // OBBBA §10102(a) raised the upper bound from 54 to 64.
        // Regression guard: if CA ever forks abawdStatus to its own
        // logic, ensure it still respects the §10102(a) ceiling.
        let draft = Self.draftWithAge(64)
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .subjectActive)
    }

    @Test func caABAWD65IsNotSubject() {
        let draft = Self.draftWithAge(65)
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .notSubject)
    }

    @Test func caABAWDWithChildUnder14IsNotSubject() {
        var draft = Self.draftWithAge(30)
        draft.household.hasChildUnder14InHousehold = true
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .notSubject)
    }

    @Test func caABAWDWithChild14OrOlderIsSubject() {
        // OBBBA §10102(a) narrowed the dependent-child exception
        // from "under 18" to "under 14". A 30yo with only a 14+
        // child in the household is now ABAWD-subject.
        var draft = Self.draftWithAge(30)
        draft.household.hasMinorInHousehold = true
        draft.household.hasChildUnder14InHousehold = false
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .subjectActive)
    }

    // MARK: - Categorical eligibility (CA adds BBCE as fallback)

    @Test func caTANFRecipientPathInherited() {
        var draft = SNAPApplicationDraft()
        draft.household.receivesTANF = true
        #expect(
            rules.categoricalEligibility(for: draft, asOf: fy26Date)
                == .categoricallyEligible(via: .tanf)
        )
    }

    @Test func caEmptyDraftFallsBackToBBCE() {
        // CA's BBCE applies to every screener session that completes
        // the CalFresh brochure trigger (parallels MA's posture).
        let draft = SNAPApplicationDraft()
        #expect(
            rules.categoricalEligibility(for: draft, asOf: fy26Date)
                == .categoricallyEligible(via: .bbce(stateCode: "CA"))
        )
    }

    @Test func caExplicitFalseCashFlagsStillBBCE() {
        var draft = SNAPApplicationDraft()
        draft.household.receivesTANF = false
        draft.household.receivesSSI = false
        draft.household.receivesGeneralAssistance = false
        #expect(
            rules.categoricalEligibility(for: draft, asOf: fy26Date)
                == .categoricallyEligible(via: .bbce(stateCode: "CA"))
        )
    }

    // MARK: - Restaurant Meals Program (CA operates it)

    @Test func rmpUnhousedQualifies() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.housingStatus = .unhoused
        let outcome = rules.restaurantMealsProgramEligibility(for: draft, asOf: fy26Date)
        guard case .eligible(let reasons) = outcome else {
            Issue.record("Expected .eligible; got \(outcome)")
            return
        }
        #expect(reasons.contains(.unhoused))
    }

    @Test func rmpElderlyOrDisabledQualifies() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.housingStatus = .stableHome
        draft.household.hasElderlyOrDisabled = true
        let outcome = rules.restaurantMealsProgramEligibility(for: draft, asOf: fy26Date)
        guard case .eligible(let reasons) = outcome else {
            Issue.record("Expected .eligible; got \(outcome)")
            return
        }
        #expect(reasons.contains(.disabled))
    }

    @Test func rmpBothCriteriaIncludesBothReasons() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.housingStatus = .unhoused
        draft.household.hasElderlyOrDisabled = true
        let outcome = rules.restaurantMealsProgramEligibility(for: draft, asOf: fy26Date)
        guard case .eligible(let reasons) = outcome else {
            Issue.record("Expected .eligible; got \(outcome)")
            return
        }
        #expect(Set(reasons) == Set([.disabled, .unhoused]))
    }

    @Test func rmpExplicitNegativesReturnsNotEligible() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.housingStatus = .stableHome
        draft.household.hasElderlyOrDisabled = false
        #expect(
            rules.restaurantMealsProgramEligibility(for: draft, asOf: fy26Date)
                == .notEligible
        )
    }

    @Test func rmpUnknownWhenScreenerIncomplete() {
        let draft = SNAPApplicationDraft()
        #expect(
            rules.restaurantMealsProgramEligibility(for: draft, asOf: fy26Date)
                == .unknown
        )
    }

    // MARK: - Rules-version stamp

    @Test func rulesVersionStampForFY26() {
        #expect(rules.rulesVersion(asOf: fy26Date) == "CA-bbce-200pct-FY26")
    }

    @Test func rulesVersionFallsBackToLatestOutsideWindow() {
        // FY27 isn't loaded yet -- the implementation falls back to
        // the latest known snapshot rather than crashing.
        #expect(rules.rulesVersion(asOf: fy27Date) == "CA-bbce-200pct-FY26")
    }

    // MARK: - Snapshot freshness (OBBBA audit Q12)

    @Test func snapshotStatusIsCurrentInsideFY26() {
        let status = rules.snapshotStatus(asOf: fy26Date)
        let fy26End = Self.iso("2026-09-30")
        #expect(status == .current(latestExpiry: fy26End))
    }

    /// CA freshness intersects federal + CA's BBCE window. Past the
    /// earliest expiry (FY26 end-of-window), status flips.
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
    /// Mirrors the helper in FederalDefaultRulesTests so the
    /// cross-state regression assertions read identically.
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
