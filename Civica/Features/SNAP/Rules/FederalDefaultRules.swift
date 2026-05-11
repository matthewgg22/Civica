import Foundation

// Federal-baseline SNAP rules (7 CFR 273), used as the fallback
// when no state-specific conformer is registered for the
// applicant's chosen state.
//
// Returns a directional verdict — the gates here are the federal
// floor that every state must meet. States with BBCE expand the
// gross-income limit; states with stricter standard deductions or
// student rules layer on top. Until a state-specific conformer
// lands, the federal default is honest about what we can compute
// without state-specific data.
//
// Source notes for the threshold tables:
//   * Monthly FPL base ($1,255 for 1 person, +$448.33/mo per
//     additional) tracks the Swift FY26 table established in the
//     pre-refactor SNAPLocalEligibilityEvaluator. The backend
//     poverty_guidelines.py file holds the FY25 table (same base
//     for FY25 fiscal year). When FY27 numbers publish, add a new
//     PolicySnapshot below — do not edit the FY26 row in place.
//   * Standard deduction and excess-shelter cap mirror the
//     federal FY25 values (7 CFR 273.9(d)(1)) since the FNS COLA
//     memo for FY26 has not been merged into the Swift side yet.
//   * Stamp is "federal-default-FY26" to match the
//     existing rules-version convention used by MA today.

struct FederalDefaultRules: SNAPStateRuleEngine {
    let stateCode: String = "FEDERAL_DEFAULT"
    let displayName: String = "Federal baseline (state-specific rules not yet wired)"

    // MARK: - Income limits

    func grossIncomeLimit(householdSize: Int, asOf: Date) -> Decimal {
        let monthlyFpl = monthlyFPL(householdSize: householdSize, asOf: asOf)
        return roundedDown(monthlyFpl * Self.grossIncomeRatio)
    }

    func netIncomeLimit(householdSize: Int, asOf: Date) -> Decimal {
        let monthlyFpl = monthlyFPL(householdSize: householdSize, asOf: asOf)
        return roundedDown(monthlyFpl * Self.netIncomeRatio)
    }

    // MARK: - Deductions

    func standardDeduction(householdSize: Int, asOf: Date) -> Decimal {
        let snapshot = activeStandardDeductionSnapshot(asOf: asOf)
        return snapshot.value[clampedDeductionBucket(householdSize)]
            ?? snapshot.value[6]
            ?? 0
    }

    /// Federal cap on the excess-shelter deduction. Households
    /// with an elderly or disabled member have NO cap federally,
    /// so we return nil for them.
    func shelterDeductionCap(isElderlyOrDisabled: Bool, asOf: Date) -> Decimal? {
        if isElderlyOrDisabled { return nil }
        return activeShelterCapSnapshot(asOf: asOf).value
    }

    // MARK: - Student gate (7 CFR 273.5)

    func studentExemption(for draft: SNAPApplicationDraft, asOf: Date) -> StudentExemption {
        let s = draft.studentStatus
        guard let enrolled = s.enrolledInHigherEd else { return .unknown }
        if enrolled == false { return .notSubject }

        if s.enrolledHalfTime == false { return .exempted(reason: .lessThanHalfTime) }
        if s.enrolledHalfTime == nil { return .unknown }

        if s.works20PlusHours == true { return .exempted(reason: .worksTwentyHoursPerWeek) }
        if s.inWorkStudy == true { return .exempted(reason: .workStudy) }
        if s.responsibleForDependentChild == true { return .exempted(reason: .dependentChildCare) }

        return .categoricallyDisqualified
    }

    // MARK: - Expedited service (7 CFR 273.2(i))

    func expeditedCriteria(asOf _: Date) -> ExpeditedCriteria {
        ExpeditedCriteria(
            grossIncomeUnder: 150,
            liquidResourcesAtOrUnder: 100,
            rentPlusUtilitiesGate: true,
            migrantFarmworkerGate: true
        )
    }

    // MARK: - ABAWD (7 CFR 273.24)

    /// Age band, dependents, and pregnancy bar federal ABAWD
    /// subject status. Waiver detection (state-wide or area
    /// waivers in effect on `asOf`) requires state-specific data
    /// the federal default doesn't ship with — we return
    /// `.unknown` for waiver checks rather than guess.
    func abawdStatus(for draft: SNAPApplicationDraft, asOf: Date) -> ABAWDStatus {
        let age = applicantAge(draft.applicantAge, asOf: asOf)
        let hasMinor = draft.household.hasMinorInHousehold == true
        let elderlyOrDisabled = draft.household.hasElderlyOrDisabled == true

        if elderlyOrDisabled || hasMinor { return .notSubject }

        guard let age else { return .unknown }
        // FY26 ABAWD age band per FY2024 Farm Bill expansion: 18-54
        // before phase-down; tightened to 18-52 in subsequent rule.
        // Using the conservative current floor.
        if age < 18 || age > 54 { return .notSubject }

        return .subjectActive
    }

    // MARK: - Version stamp

    func rulesVersion(asOf _: Date) -> String {
        "federal-default-FY26"
    }
}

// MARK: - Private threshold tables

private extension FederalDefaultRules {

    static let grossIncomeRatio: Decimal = Decimal(string: "1.30") ?? 1
    static let netIncomeRatio: Decimal = 1

    /// FY26 monthly FPL base — 1-person $1,255/mo, +$448.33/mo
    /// per additional person. Matches the values already used by
    /// the pre-refactor MA evaluator (MA's 200% line equals this
    /// base × 2).
    static let monthlyFplSnapshots: [PolicySnapshot<MonthlyFPLBase>] = [
        .iso(
            from: "2025-10-01",
            to: "2026-09-30",
            versionSuffix: "FY26",
            value: MonthlyFPLBase(
                firstPerson: Decimal(string: "1255")!,
                eachAdditionalPerson: Decimal(string: "448.33")!
            )
        )
    ]

    /// FY25-seeded federal standard deduction table by household
    /// size. 1-3 share the same value; 4 and 5 step; 6+ caps at
    /// the size-6 entry.
    static let standardDeductionSnapshots: [PolicySnapshot<[Int: Decimal]>] = [
        .iso(
            from: "2025-10-01",
            to: "2026-09-30",
            versionSuffix: "FY26",
            value: [
                1: 204,
                2: 204,
                3: 204,
                4: 217,
                5: 254,
                6: 291
            ]
        )
    ]

    /// FY25-seeded federal max excess-shelter deduction cap for
    /// households without an elderly or disabled member.
    static let shelterCapSnapshots: [PolicySnapshot<Decimal>] = [
        .iso(
            from: "2025-10-01",
            to: "2026-09-30",
            versionSuffix: "FY26",
            value: 712
        )
    ]

    struct MonthlyFPLBase {
        let firstPerson: Decimal
        let eachAdditionalPerson: Decimal
    }

    func monthlyFPL(householdSize: Int, asOf: Date) -> Decimal {
        let snapshot = activeFPLSnapshot(asOf: asOf)
        let size = max(1, householdSize)
        return snapshot.value.firstPerson
            + snapshot.value.eachAdditionalPerson * Decimal(size - 1)
    }

    /// Picks the policy snapshot active on `asOf`; falls back to
    /// the most recent snapshot when `asOf` is outside any window
    /// (verdict still renders, version stamp signals staleness).
    func activeFPLSnapshot(asOf: Date) -> PolicySnapshot<MonthlyFPLBase> {
        Self.monthlyFplSnapshots.first(where: { $0.contains(asOf) })
            ?? Self.monthlyFplSnapshots.last!
    }

    func activeStandardDeductionSnapshot(asOf: Date) -> PolicySnapshot<[Int: Decimal]> {
        Self.standardDeductionSnapshots.first(where: { $0.contains(asOf) })
            ?? Self.standardDeductionSnapshots.last!
    }

    func activeShelterCapSnapshot(asOf: Date) -> PolicySnapshot<Decimal> {
        Self.shelterCapSnapshots.first(where: { $0.contains(asOf) })
            ?? Self.shelterCapSnapshots.last!
    }

    func clampedDeductionBucket(_ size: Int) -> Int {
        if size <= 3 { return 1 }
        if size == 4 { return 4 }
        if size == 5 { return 5 }
        return 6
    }

    func roundedDown(_ value: Decimal) -> Decimal {
        var input = value
        var output = Decimal()
        NSDecimalRound(&output, &input, 0, .down)
        return output
    }

    func applicantAge(_ answers: SNAPApplicantAgeAnswers, asOf: Date) -> Int? {
        guard let dob = answers.dateOfBirth else { return nil }
        let calendar = Calendar(identifier: .gregorian)
        return calendar.dateComponents([.year], from: dob, to: asOf).year
    }
}
