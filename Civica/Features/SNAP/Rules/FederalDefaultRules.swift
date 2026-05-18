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
        // OBBBA §10102(a) (FNS memo Oct 3 2025): dependent-child exception narrowed
        // from child under 18 to child under 14. hasMinorInHousehold continues to
        // gate childcare deductions and other non-ABAWD logic; do not use it here.
        let hasChildUnder14 = draft.household.hasChildUnder14InHousehold == true
        let elderlyOrDisabled = draft.household.hasElderlyOrDisabled == true

        if elderlyOrDisabled || hasChildUnder14 { return .notSubject }

        guard let age else { return .unknown }
        // OBBBA §10102(a) (eff. July 4 2025): raised ABAWD ceiling from 54 to 64.
        // Individuals 18–64 are now subject; the prior 55–64 exemption was removed.
        if age < 18 || age > 64 { return .notSubject }

        return .subjectActive
    }

    // MARK: - Deduction-stack data

    /// 20% earned-income deduction (7 CFR 273.9(d)(2)).
    /// Statutory; does not vary by state or year.
    func earnedIncomeDeductionRate(asOf _: Date) -> Decimal {
        Self.earnedIncomeDeductionRate
    }

    /// Federal FY26 max allotment table seeded from backend
    /// poverty_guidelines.py (FY25 values stamped as FY26 per the
    /// existing rules-version convention). Sizes 1-8 are explicit;
    /// 9+ extrapolates with the per-additional-person increment.
    func maxAllotment(householdSize: Int, asOf: Date) -> Decimal {
        let snapshot = activeMaxAllotmentSnapshot(asOf: asOf)
        let size = max(1, householdSize)
        if let exact = snapshot.value.bySize[size] {
            return exact
        }
        let largest = snapshot.value.bySize.keys.max() ?? 1
        if size > largest, let base = snapshot.value.bySize[largest] {
            return base + snapshot.value.eachAdditional * Decimal(size - largest)
        }
        return snapshot.value.bySize[1] ?? 0
    }

    /// Federal minimum benefit for 1-2 person households (8% of
    /// 1-person max allotment, rounded). FY25 value = $23.
    func minimumBenefit(asOf: Date) -> Decimal {
        activeMinimumBenefitSnapshot(asOf: asOf).value
    }

    /// Federal asset/resource limits (FY25): $3000 baseline,
    /// $4500 for households with an elderly or disabled member.
    func assetLimit(isElderlyOrDisabled: Bool, asOf: Date) -> Decimal {
        let snapshot = activeAssetLimitSnapshot(asOf: asOf)
        return isElderlyOrDisabled
            ? snapshot.value.elderlyOrDisabled
            : snapshot.value.standardHousehold
    }

    /// Federal default has no SUA table — every state with an
    /// SUA publishes its own and overrides this method. Returns
    /// nil so the calculator falls back to actual utility costs.
    func suaValue(tier _: SUATier, asOf _: Date) -> Decimal? {
        nil
    }

    /// Federal default returns nil for waiver lookups — every
    /// state that has FNS-approved ABAWD waivers ships its own
    /// table. Nil means "this engine doesn't know," which the
    /// caller distinguishes from a confirmed "no waiver in
    /// effect" (false).
    func abawdWaiverActive(fipsCode _: String, asOf _: Date) -> Bool? {
        nil
    }

    /// Pure-cash categorical eligibility path per 7 CFR 273.2(j):
    /// if every household member receives TANF, SSI, or General
    /// Assistance, the household is categorically eligible and
    /// bypasses income/asset tests. Returns .unknown when the
    /// draft hasn't been asked the question yet (current state
    /// of every draft until the question flow ships the screen).
    func categoricalEligibility(
        for draft: SNAPApplicationDraft,
        asOf _: Date
    ) -> CategoricalEligibility {
        let tanf = draft.household.receivesTANF
        let ssi = draft.household.receivesSSI
        let ga = draft.household.receivesGeneralAssistance

        // All three answers missing = not asked yet.
        if tanf == nil && ssi == nil && ga == nil {
            return .unknown
        }
        if tanf == true { return .categoricallyEligible(via: .tanf) }
        if ssi == true { return .categoricallyEligible(via: .ssi) }
        if ga == true { return .categoricallyEligible(via: .generalAssistance) }
        return .notCategoricallyEligible
    }

    // MARK: - Version stamp

    func rulesVersion(asOf _: Date) -> String {
        "federal-default-FY26"
    }

    // MARK: - Snapshot freshness (OBBBA audit Q12)

    /// The earliest expiry across the tables this engine consults
    /// is the date the rules data next becomes stale. When asOf
    /// passes that point we silently fall back to the most-recent
    /// snapshot inside each selector below — but report .expired
    /// here so callers can refuse to render precise dollar amounts.
    func snapshotStatus(asOf: Date) -> RuleSnapshotStatus {
        let expiries: [Date] = [
            Self.monthlyFplSnapshots.last!.expiresOn,
            Self.standardDeductionSnapshots.last!.expiresOn,
            Self.shelterCapSnapshots.last!.expiresOn,
            Self.maxAllotmentSnapshots.last!.expiresOn,
            Self.minimumBenefitSnapshots.last!.expiresOn,
            Self.assetLimitSnapshots.last!.expiresOn
        ]
        let earliestExpiry = expiries.min() ?? .distantPast
        return asOf <= earliestExpiry
            ? .current(latestExpiry: earliestExpiry)
            : .expired(latestExpiry: earliestExpiry)
    }

    /// Federal default: RMP is a state option; without a state-
    /// specific override the program is treated as not operated.
    /// State conformers that participate (CA, AZ, RI, IL, …)
    /// override this to evaluate the federal household criteria.
    func restaurantMealsProgramEligibility(
        for _: SNAPApplicationDraft,
        asOf _: Date
    ) -> RestaurantMealsEligibility {
        .notOperated
    }
}

// MARK: - Private threshold tables

private extension FederalDefaultRules {

    static let grossIncomeRatio: Decimal = Decimal(string: "1.30") ?? 1
    static let netIncomeRatio: Decimal = 1
    static let earnedIncomeDeductionRate: Decimal = Decimal(string: "0.20") ?? 0.20

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

    struct MaxAllotmentTable {
        let bySize: [Int: Decimal]
        let eachAdditional: Decimal
    }

    struct AssetLimits {
        let standardHousehold: Decimal
        let elderlyOrDisabled: Decimal
    }

    /// FY26 SNAP max allotments seeded from backend
    /// poverty_guidelines.py FY25 table (FNS COLA memo).
    static let maxAllotmentSnapshots: [PolicySnapshot<MaxAllotmentTable>] = [
        .iso(
            from: "2025-10-01",
            to: "2026-09-30",
            versionSuffix: "FY26",
            value: MaxAllotmentTable(
                bySize: [
                    1: 292,
                    2: 536,
                    3: 768,
                    4: 975,
                    5: 1_158,
                    6: 1_390,
                    7: 1_536,
                    8: 1_756
                ],
                eachAdditional: 220
            )
        )
    ]

    /// FY26 federal minimum benefit (1-2 person eligible households).
    static let minimumBenefitSnapshots: [PolicySnapshot<Decimal>] = [
        .iso(
            from: "2025-10-01",
            to: "2026-09-30",
            versionSuffix: "FY26",
            value: 23
        )
    ]

    /// FY26 federal asset/resource limits.
    static let assetLimitSnapshots: [PolicySnapshot<AssetLimits>] = [
        .iso(
            from: "2025-10-01",
            to: "2026-09-30",
            versionSuffix: "FY26",
            value: AssetLimits(
                standardHousehold: 3_000,
                elderlyOrDisabled: 4_500
            )
        )
    ]

    func activeMaxAllotmentSnapshot(asOf: Date) -> PolicySnapshot<MaxAllotmentTable> {
        Self.maxAllotmentSnapshots.first(where: { $0.contains(asOf) })
            ?? Self.maxAllotmentSnapshots.last!
    }

    func activeMinimumBenefitSnapshot(asOf: Date) -> PolicySnapshot<Decimal> {
        Self.minimumBenefitSnapshots.first(where: { $0.contains(asOf) })
            ?? Self.minimumBenefitSnapshots.last!
    }

    func activeAssetLimitSnapshot(asOf: Date) -> PolicySnapshot<AssetLimits> {
        Self.assetLimitSnapshots.first(where: { $0.contains(asOf) })
            ?? Self.assetLimitSnapshots.last!
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
