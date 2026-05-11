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

    // MARK: - Gross income (130% FPL)

    @Test func grossIncomeLimitForKnownSizes() {
        // monthly FPL base (1 person) = 1255, +448.33 per additional;
        // gross limit = monthly FPL * 1.30, rounded down.
        #expect(rules.grossIncomeLimit(householdSize: 1, asOf: fy26Date) == 1_631)
        #expect(rules.grossIncomeLimit(householdSize: 2, asOf: fy26Date) == 2_214)
        #expect(rules.grossIncomeLimit(householdSize: 3, asOf: fy26Date) == 2_797)
        #expect(rules.grossIncomeLimit(householdSize: 4, asOf: fy26Date) == 3_379)
        #expect(rules.grossIncomeLimit(householdSize: 5, asOf: fy26Date) == 3_962)
        #expect(rules.grossIncomeLimit(householdSize: 6, asOf: fy26Date) == 4_545)
    }

    // MARK: - Net income (100% FPL)

    @Test func netIncomeLimitForKnownSizes() {
        #expect(rules.netIncomeLimit(householdSize: 1, asOf: fy26Date) == 1_255)
        #expect(rules.netIncomeLimit(householdSize: 2, asOf: fy26Date) == 1_703)
        #expect(rules.netIncomeLimit(householdSize: 3, asOf: fy26Date) == 2_151)
        #expect(rules.netIncomeLimit(householdSize: 4, asOf: fy26Date) == 2_599)
    }

    // MARK: - Standard deduction (7 CFR 273.9(d)(1))

    @Test func standardDeductionByBucket() {
        // Sizes 1-3 share the same value.
        #expect(rules.standardDeduction(householdSize: 1, asOf: fy26Date) == 204)
        #expect(rules.standardDeduction(householdSize: 2, asOf: fy26Date) == 204)
        #expect(rules.standardDeduction(householdSize: 3, asOf: fy26Date) == 204)
        // 4 and 5 step.
        #expect(rules.standardDeduction(householdSize: 4, asOf: fy26Date) == 217)
        #expect(rules.standardDeduction(householdSize: 5, asOf: fy26Date) == 254)
        // 6+ caps at the size-6 value.
        #expect(rules.standardDeduction(householdSize: 6, asOf: fy26Date) == 291)
        #expect(rules.standardDeduction(householdSize: 12, asOf: fy26Date) == 291)
    }

    // MARK: - Shelter deduction cap

    @Test func shelterCapWithoutElderlyOrDisabled() {
        #expect(rules.shelterDeductionCap(isElderlyOrDisabled: false, asOf: fy26Date) == 712)
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

    @Test func abawdOver54IsNotSubject() {
        let draft = Self.draft(age: 55)
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .notSubject)
    }

    @Test func abawdWithMinorInHouseholdIsNotSubject() {
        var draft = Self.draft(age: 30)
        draft.household.hasMinorInHousehold = true
        #expect(rules.abawdStatus(for: draft, asOf: fy26Date) == .notSubject)
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
        #expect(rules.maxAllotment(householdSize: 1, asOf: fy26Date) == 292)
        #expect(rules.maxAllotment(householdSize: 2, asOf: fy26Date) == 536)
        #expect(rules.maxAllotment(householdSize: 3, asOf: fy26Date) == 768)
        #expect(rules.maxAllotment(householdSize: 4, asOf: fy26Date) == 975)
        #expect(rules.maxAllotment(householdSize: 5, asOf: fy26Date) == 1_158)
        #expect(rules.maxAllotment(householdSize: 6, asOf: fy26Date) == 1_390)
        #expect(rules.maxAllotment(householdSize: 7, asOf: fy26Date) == 1_536)
        #expect(rules.maxAllotment(householdSize: 8, asOf: fy26Date) == 1_756)
    }

    @Test func maxAllotmentExtrapolatesForLargeHouseholds() {
        // Size 9 = size 8 ($1756) + 1 * $220 = $1976
        #expect(rules.maxAllotment(householdSize: 9, asOf: fy26Date) == 1_976)
        // Size 12 = 1756 + 4 * 220 = 2636
        #expect(rules.maxAllotment(householdSize: 12, asOf: fy26Date) == 2_636)
    }

    // MARK: - Minimum benefit

    @Test func minimumBenefitForFY26() {
        #expect(rules.minimumBenefit(asOf: fy26Date) == 23)
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

    // MARK: - Rules-version stamp

    @Test func rulesVersionStampForFY26() {
        #expect(rules.rulesVersion(asOf: fy26Date) == "federal-default-FY26")
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
