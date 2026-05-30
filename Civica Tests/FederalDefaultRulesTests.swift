import Foundation
import Testing
@testable import Civica

// Locks in the federal-baseline numbers and the 7 CFR 273 logic that
// every non-tuned state falls back to. The expected values mirror
// the FY26 table currently encoded in FederalDefaultRules.swift.
// When FY26 official numbers replace the FY25-seeded values, these
// tests will fail and the expectations update with the data.

struct FederalDefaultRulesTests {

    private let rules = FederalDefaultRules()
    private let fy26Date = Self.iso("2026-03-15")

    // MARK: - Identity

    @Test func stateCodeAndDisplayName() {
        #expect(rules.stateCode == "FEDERAL_DEFAULT")
        #expect(rules.displayName.contains("Federal"))
    }

    // MARK: - Gross income (130% FPL exact table, FNS FY26 COLA memo)

    @Test func grossIncomeLimitForKnownSizes() {
        // Exact table per FNS FY26 COLA memo, Page 3 (48 states + DC).
        // Do NOT derive from a monthly FPL formula — drift of ±$1 vs.
        // the official memo is the documented hazard.
        #expect(rules.grossIncomeLimit(householdSize: 1, asOf: fy26Date) == 1_696)
        #expect(rules.grossIncomeLimit(householdSize: 2, asOf: fy26Date) == 2_292)
        #expect(rules.grossIncomeLimit(householdSize: 3, asOf: fy26Date) == 2_888)
        #expect(rules.grossIncomeLimit(householdSize: 4, asOf: fy26Date) == 3_483)
        #expect(rules.grossIncomeLimit(householdSize: 5, asOf: fy26Date) == 4_079)
        #expect(rules.grossIncomeLimit(householdSize: 6, asOf: fy26Date) == 4_675)
        #expect(rules.grossIncomeLimit(householdSize: 7, asOf: fy26Date) == 5_271)
        #expect(rules.grossIncomeLimit(householdSize: 8, asOf: fy26Date) == 5_867)
    }

    @Test func grossIncomeLimitExtendsBeyondEightWithPerAdditional() {
        // Per FNS FY26 COLA memo: +$596 per HH member beyond 8.
        let eight = rules.grossIncomeLimit(householdSize: 8, asOf: fy26Date)
        #expect(rules.grossIncomeLimit(householdSize: 9, asOf: fy26Date) == eight + 596)
        #expect(rules.grossIncomeLimit(householdSize: 12, asOf: fy26Date) == eight + 2_384)
    }

    // MARK: - Net income (100% FPL exact table, FNS FY26 COLA memo)

    @Test func netIncomeLimitForKnownSizes() {
        #expect(rules.netIncomeLimit(householdSize: 1, asOf: fy26Date) == 1_305)
        #expect(rules.netIncomeLimit(householdSize: 2, asOf: fy26Date) == 1_763)
        #expect(rules.netIncomeLimit(householdSize: 3, asOf: fy26Date) == 2_221)
        #expect(rules.netIncomeLimit(householdSize: 4, asOf: fy26Date) == 2_680)
        #expect(rules.netIncomeLimit(householdSize: 5, asOf: fy26Date) == 3_138)
        #expect(rules.netIncomeLimit(householdSize: 6, asOf: fy26Date) == 3_596)
        #expect(rules.netIncomeLimit(householdSize: 7, asOf: fy26Date) == 4_055)
        #expect(rules.netIncomeLimit(householdSize: 8, asOf: fy26Date) == 4_513)
    }

    @Test func netIncomeLimitExtendsBeyondEightWithPerAdditional() {
        let eight = rules.netIncomeLimit(householdSize: 8, asOf: fy26Date)
        #expect(rules.netIncomeLimit(householdSize: 9, asOf: fy26Date) == eight + 459)
        #expect(rules.netIncomeLimit(householdSize: 12, asOf: fy26Date) == eight + 1_836)
    }

    // MARK: - Standard deduction (7 CFR 273.9(d)(1))

    @Test func standardDeductionByBucket() {
        // FY26 COLA memo, Page 6.
        // Sizes 1-3 share the same value.
        #expect(rules.standardDeduction(householdSize: 1, asOf: fy26Date) == 209)
        #expect(rules.standardDeduction(householdSize: 2, asOf: fy26Date) == 209)
        #expect(rules.standardDeduction(householdSize: 3, asOf: fy26Date) == 209)
        // 4 and 5 step.
        #expect(rules.standardDeduction(householdSize: 4, asOf: fy26Date) == 223)
        #expect(rules.standardDeduction(householdSize: 5, asOf: fy26Date) == 261)
        // 6+ caps at the size-6 value.
        #expect(rules.standardDeduction(householdSize: 6, asOf: fy26Date) == 299)
        #expect(rules.standardDeduction(householdSize: 12, asOf: fy26Date) == 299)
    }

    // MARK: - Shelter deduction cap

    @Test func shelterCapWithoutElderlyOrDisabled() {
        // FY26 COLA memo, Table 3.
        #expect(rules.shelterDeductionCap(isElderlyOrDisabled: false, asOf: fy26Date) == 744)
    }

    @Test func shelterCapWithElderlyOrDisabledIsNil() {
        // Households with elderly/disabled have NO federal cap.
        #expect(rules.shelterDeductionCap(isElderlyOrDisabled: true, asOf: fy26Date) == nil)
    }

    // MARK: - Expedited service

    @Test func expeditedCriteriaValues() {
        let criteria = rules.expeditedCriteria(asOf: fy26Date)
        #expect(criteria.grossIncomeUnder == 150)
        #expect(criteria.liquidResourcesAtOrUnder == 100)
        #expect(criteria.rentPlusUtilitiesGate == true)
        #expect(criteria.migrantFarmworkerGate == true)
    }

    // MARK: - ABAWD age band

    @Test func abawdUnder18IsNotSubject() {
        let draft = Self.draft(age: 17)
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .notSubject)
    }

    @Test func abawd18IsSubject() {
        let draft = Self.draft(age: 18)
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .subjectActive)
    }

    @Test func abawd54IsSubject() {
        let draft = Self.draft(age: 54)
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .subjectActive)
    }

    // OBBBA §10102(a): 55–64 now subject (prior exemption removed July 4 2025)
    @Test func abawd55IsSubject() {
        let draft = Self.draft(age: 55)
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .subjectActive)
    }

    @Test func abawd64IsSubject() {
        let draft = Self.draft(age: 64)
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .subjectActive)
    }

    @Test func abawdOver64IsNotSubject() {
        let draft = Self.draft(age: 65)
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .notSubject)
    }

    // OBBBA §10102(a): dependent-child exception now requires child under 14.

    @Test func abawdWithChildUnder14IsNotSubject() {
        var draft = Self.draft(age: 30)
        draft.household.hasMinorInHousehold = true
        draft.household.hasChildUnder14InHousehold = true
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .notSubject)
    }

    // Boundary: 13 is under 14 — still exempt.
    @Test func abawdWithChildExactly13IsNotSubject() {
        var draft = Self.draft(age: 30)
        draft.household.hasChildUnder14InHousehold = true
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .notSubject)
    }

    // Boundary: 14 is no longer exempt under OBBBA §10102(a).
    @Test func abawdWithChildExactly14IsSubject() {
        var draft = Self.draft(age: 30)
        draft.household.hasMinorInHousehold = true
        draft.household.hasChildUnder14InHousehold = false
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .subjectActive)
    }

    // Regression: 17-year-old was exempt pre-OBBBA; now subject.
    @Test func abawdWithChild17IsSubject() {
        var draft = Self.draft(age: 30)
        draft.household.hasMinorInHousehold = true
        draft.household.hasChildUnder14InHousehold = false
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .subjectActive)
    }

    // Regression: hasMinorInHousehold alone no longer grants the exemption.
    @Test func abawdWithMinorButNoUnder14IsSubject() {
        var draft = Self.draft(age: 30)
        draft.household.hasMinorInHousehold = true
        // hasChildUnder14InHousehold intentionally nil (not yet answered)
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .subjectActive)
    }

    @Test func abawdWithElderlyOrDisabledIsNotSubject() {
        var draft = Self.draft(age: 30)
        draft.household.hasElderlyOrDisabled = true
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .notSubject)
    }

    @Test func abawdWithoutDOBIsUnknown() {
        var draft = SNAPApplicationDraft()
        draft.household.hasMinorInHousehold = false
        draft.household.hasElderlyOrDisabled = false
        // No dateOfBirth set.
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .unknown)
    }

    // MARK: - Student gate (7 CFR 273.5)

    @Test func studentNotEnrolledReturnsNotSubject() {
        var draft = SNAPApplicationDraft()
        draft.studentStatus.enrolledInHigherEd = false
        #expect(rules.studentExemption(for: draft, asOf: fy26Date) == .notSubject)
    }

    @Test func studentEnrolledHalfTimeWithoutExceptionIsDisqualified() {
        var draft = SNAPApplicationDraft()
        draft.studentStatus.enrolledInHigherEd = true
        draft.studentStatus.enrolledHalfTime = true
        draft.studentStatus.works20PlusHours = false
        draft.studentStatus.inWorkStudy = false
        draft.studentStatus.responsibleForDependentChild = false
        #expect(rules.studentExemption(for: draft, asOf: fy26Date) == .categoricallyDisqualified)
    }

    @Test func studentWith20HourWorkExceptionIsExempted() {
        var draft = SNAPApplicationDraft()
        draft.studentStatus.enrolledInHigherEd = true
        draft.studentStatus.enrolledHalfTime = true
        draft.studentStatus.works20PlusHours = true
        #expect(
            rules.studentExemption(for: draft, asOf: fy26Date)
                == .exempted(reason: .worksTwentyHoursPerWeek)
        )
    }

    @Test func studentWithWorkStudyIsExempted() {
        var draft = SNAPApplicationDraft()
        draft.studentStatus.enrolledInHigherEd = true
        draft.studentStatus.enrolledHalfTime = true
        draft.studentStatus.inWorkStudy = true
        #expect(
            rules.studentExemption(for: draft, asOf: fy26Date)
                == .exempted(reason: .workStudy)
        )
    }

    @Test func studentWithDependentChildIsExempted() {
        var draft = SNAPApplicationDraft()
        draft.studentStatus.enrolledInHigherEd = true
        draft.studentStatus.enrolledHalfTime = true
        draft.studentStatus.responsibleForDependentChild = true
        #expect(
            rules.studentExemption(for: draft, asOf: fy26Date)
                == .exempted(reason: .dependentChildCare)
        )
    }

    // Regression (PARITY-AUDIT.md Gap 1): a half-time student whose ONLY
    // exemption is a job-training / student-support program (SNAP E&T,
    // WIOA, EOPS/CARE, CalWORKs, Cal Grant work component) was wrongly
    // returned `.categoricallyDisqualified` because the intake never
    // collected the program. With `inApprovedJobProgram == true` it must
    // now be `.exempted(reason: .employmentTrainingProgram)`.
    @Test func studentInEmploymentTrainingProgramIsExempted() {
        var draft = SNAPApplicationDraft()
        draft.studentStatus.enrolledInHigherEd = true
        draft.studentStatus.enrolledHalfTime = true
        draft.studentStatus.works20PlusHours = false
        draft.studentStatus.inWorkStudy = false
        draft.studentStatus.responsibleForDependentChild = false
        draft.studentStatus.inApprovedJobProgram = true
        #expect(
            rules.studentExemption(for: draft, asOf: fy26Date)
                == .exempted(reason: .employmentTrainingProgram)
        )
    }

    // Guard the bug's original shape stays fixed: same student WITHOUT the
    // job program (field nil) is still disqualified — the fix must not
    // exempt students who answer "no" / leave it unanswered.
    @Test func studentWithoutJobProgramStillDisqualified() {
        var draft = SNAPApplicationDraft()
        draft.studentStatus.enrolledInHigherEd = true
        draft.studentStatus.enrolledHalfTime = true
        draft.studentStatus.works20PlusHours = false
        draft.studentStatus.inWorkStudy = false
        draft.studentStatus.responsibleForDependentChild = false
        draft.studentStatus.inApprovedJobProgram = false
        #expect(rules.studentExemption(for: draft, asOf: fy26Date) == .categoricallyDisqualified)
    }

    @Test func studentLessThanHalfTimeIsExempted() {
        var draft = SNAPApplicationDraft()
        draft.studentStatus.enrolledInHigherEd = true
        draft.studentStatus.enrolledHalfTime = false
        #expect(
            rules.studentExemption(for: draft, asOf: fy26Date)
                == .exempted(reason: .lessThanHalfTime)
        )
    }

    @Test func studentMissingHalfTimeAnswerIsUnknown() {
        var draft = SNAPApplicationDraft()
        draft.studentStatus.enrolledInHigherEd = true
        // enrolledHalfTime not set.
        #expect(rules.studentExemption(for: draft, asOf: fy26Date) == .unknown)
    }

    @Test func studentMissingEnrollmentAnswerIsUnknown() {
        let draft = SNAPApplicationDraft()
        // enrolledInHigherEd not set.
        #expect(rules.studentExemption(for: draft, asOf: fy26Date) == .unknown)
    }

    // MARK: - Earned-income deduction rate

    @Test func earnedIncomeDeductionRateIsTwentyPercent() {
        #expect(rules.earnedIncomeDeductionRate(asOf: fy26Date) == Decimal(string: "0.20"))
    }

    // MARK: - Max allotment (FNS COLA table)

    @Test func maxAllotmentTableSizesOneThroughEight() {
        // FY26 COLA memo, Table 1 (48 states + DC).
        #expect(rules.maxAllotment(householdSize: 1, asOf: fy26Date) == 298)
        #expect(rules.maxAllotment(householdSize: 2, asOf: fy26Date) == 546)
        #expect(rules.maxAllotment(householdSize: 3, asOf: fy26Date) == 785)
        #expect(rules.maxAllotment(householdSize: 4, asOf: fy26Date) == 994)
        #expect(rules.maxAllotment(householdSize: 5, asOf: fy26Date) == 1_183)
        #expect(rules.maxAllotment(householdSize: 6, asOf: fy26Date) == 1_421)
        #expect(rules.maxAllotment(householdSize: 7, asOf: fy26Date) == 1_571)
        #expect(rules.maxAllotment(householdSize: 8, asOf: fy26Date) == 1_789)
    }

    @Test func maxAllotmentExtrapolatesForLargeHouseholds() {
        // Size 9 = size 8 ($1789) + 1 * $218 = $2007
        #expect(rules.maxAllotment(householdSize: 9, asOf: fy26Date) == 2_007)
        // Size 12 = 1789 + 4 * 218 = 2661
        #expect(rules.maxAllotment(householdSize: 12, asOf: fy26Date) == 2_661)
    }

    // MARK: - Minimum benefit

    @Test func minimumBenefitForFY26() {
        // FY26 COLA memo minimum allotment table.
        #expect(rules.minimumBenefit(asOf: fy26Date) == 24)
    }

    // MARK: - Asset limits

    @Test func assetLimitStandardHousehold() {
        #expect(rules.assetLimit(isElderlyOrDisabled: false, asOf: fy26Date) == 3_000)
    }

    @Test func assetLimitElderlyOrDisabled() {
        #expect(rules.assetLimit(isElderlyOrDisabled: true, asOf: fy26Date) == 4_500)
    }

    // MARK: - SUA (federal has no chart)

    @Test func federalSUAReturnsNilForAllTiers() {
        #expect(rules.suaValue(tier: .heatingCooling, asOf: fy26Date) == nil)
        #expect(rules.suaValue(tier: .nonHeating, asOf: fy26Date) == nil)
        #expect(rules.suaValue(tier: .phoneOnly, asOf: fy26Date) == nil)
        #expect(rules.suaValue(tier: .none, asOf: fy26Date) == nil)
    }

    // MARK: - ABAWD waiver lookup (federal has no list loaded)

    @Test func abawdWaiverLookupReturnsNilUntilDataLoaded() {
        #expect(rules.abawdWaiverActive(fipsCode: "25025", asOf: fy26Date) == nil)
        #expect(rules.abawdWaiverActive(fipsCode: "06037", asOf: fy26Date) == nil)
    }

    // MARK: - Categorical eligibility (7 CFR 273.2(j))

    @Test func categoricalUnknownWhenNoFlagsAnswered() {
        let draft = SNAPApplicationDraft()
        #expect(rules.categoricalEligibility(for: draft, asOf: fy26Date) == .unknown)
    }

    @Test func categoricalTANFRecipientPath() {
        var draft = SNAPApplicationDraft()
        draft.household.receivesTANF = true
        #expect(
            rules.categoricalEligibility(for: draft, asOf: fy26Date)
                == .categoricallyEligible(via: .tanf)
        )
    }

    @Test func categoricalSSIRecipientPath() {
        var draft = SNAPApplicationDraft()
        draft.household.receivesSSI = true
        // No TANF / GA -- but at least one flag answered, so not .unknown
        draft.household.receivesTANF = false
        draft.household.receivesGeneralAssistance = false
        #expect(
            rules.categoricalEligibility(for: draft, asOf: fy26Date)
                == .categoricallyEligible(via: .ssi)
        )
    }

    @Test func categoricalGeneralAssistancePath() {
        var draft = SNAPApplicationDraft()
        draft.household.receivesGeneralAssistance = true
        draft.household.receivesTANF = false
        draft.household.receivesSSI = false
        #expect(
            rules.categoricalEligibility(for: draft, asOf: fy26Date)
                == .categoricallyEligible(via: .generalAssistance)
        )
    }

    @Test func categoricalNotEligibleWhenAllFlagsExplicitlyFalse() {
        var draft = SNAPApplicationDraft()
        draft.household.receivesTANF = false
        draft.household.receivesSSI = false
        draft.household.receivesGeneralAssistance = false
        #expect(
            rules.categoricalEligibility(for: draft, asOf: fy26Date)
                == .notCategoricallyEligible
        )
    }

    // MARK: - Rules-version stamp

    @Test func rulesVersionStampForFY26() {
        #expect(rules.rulesVersion(asOf: fy26Date) == "federal-default-FY26")
    }

    // MARK: - Snapshot freshness (OBBBA audit Q12)

    /// A date squarely inside FY26 must report current with the
    /// earliest snapshot expiry pointing at the end of FY26.
    @Test func snapshotStatusIsCurrentInsideFY26() {
        let status = rules.snapshotStatus(asOf: fy26Date)
        let fy26End = Self.iso("2026-09-30")
        #expect(status == .current(latestExpiry: fy26End))
    }

    /// One second past the FY26 end-of-window flips status to expired.
    /// Once a FY27 snapshot row lands, this test's expectation moves
    /// to one second past the new latest expiry.
    @Test func snapshotStatusIsExpiredJustAfterFY26End() {
        let fy26End = Self.iso("2026-09-30")
        let justAfter = fy26End.addingTimeInterval(1)
        let status = rules.snapshotStatus(asOf: justAfter)
        #expect(status == .expired(latestExpiry: fy26End))
    }

    /// Fail-loud CI tripwire. The repo's "current" date (per the
    /// auto-memory currentDate context) must not be past the latest
    /// snapshot expiry. When this test fails, the engine is silently
    /// using stale data — engineering must add a FY+1 PolicySnapshot
    /// row before the calculator may ship dollar amounts again.
    @Test func snapshotStatusReportsCurrentForToday() {
        let status = rules.snapshotStatus(asOf: Date())
        switch status {
        case .current:
            break
        case .expired(let latestExpiry):
            Issue.record("Rules engine is past its latest snapshot expiry (\(latestExpiry)). Add a new PolicySnapshot row before shipping dollar-amount estimates.")
        }
    }

    // MARK: - Helpers

    private static func iso(_ string: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f.date(from: string)!
    }

    /// Builds a minimal draft with the applicant at the given age
    /// as of fy26Date (2026-03-15) and no minor/elderly flags.
    private static func draft(age: Int) -> SNAPApplicationDraft {
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
