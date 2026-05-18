import Foundation

// Massachusetts SNAP rules. Composes a FederalDefaultRules for
// the methods MA doesn't override, and overrides:
//
//   * grossIncomeLimit — Broad-Based Categorical Eligibility (BBCE)
//     at 200% FPL. MA waives the asset test; most households qualify
//     categorically up to 2x the federal poverty guideline.
//   * netIncomeLimit — under BBCE, MA waives the federal net-income
//     test for non-elderly/disabled households. We still return the
//     federal value so the backend deduction math can reference it
//     when computing benefit amount.
//   * rulesVersion — stamps "MA-bbce-200pct-FY26" to match the
//     audit-footer convention the pre-refactor evaluator established.
//
// Student gate, expedited criteria, deductions, and ABAWD all
// inherit federal behavior for now. MA has DTA-approved
// self-sufficiency programs as an additional student exception
// in 106 CMR 362.410, but the application flow does not yet
// collect a yes/no on participation in such programs — until it
// does, layering on a fake check would over-disqualify. Add the
// override when the question lands.
//
// Mirrors backend/civic_api/snap/rules/states/massachusetts.py.

struct MAStateRules: SNAPStateRuleEngine {
    let stateCode: String = "MA"
    let displayName: String = "Massachusetts"

    private let federal = FederalDefaultRules()

    // MARK: - Income limits (BBCE override)

    func grossIncomeLimit(householdSize: Int, asOf: Date) -> Decimal {
        let snapshot = activeBBCESnapshot(asOf: asOf)
        let table = snapshot.value
        let size = max(1, householdSize)
        if size < table.perSize.count {
            return table.perSize[size]
        }
        let lastIndex = table.perSize.count - 1
        return table.perSize[lastIndex] + Decimal(size - lastIndex) * table.perAdditional
    }

    func netIncomeLimit(householdSize: Int, asOf: Date) -> Decimal {
        federal.netIncomeLimit(householdSize: householdSize, asOf: asOf)
    }

    // MARK: - Federal-delegated methods

    func standardDeduction(householdSize: Int, asOf: Date) -> Decimal {
        federal.standardDeduction(householdSize: householdSize, asOf: asOf)
    }

    func shelterDeductionCap(isElderlyOrDisabled: Bool, asOf: Date) -> Decimal? {
        federal.shelterDeductionCap(isElderlyOrDisabled: isElderlyOrDisabled, asOf: asOf)
    }

    func studentExemption(for draft: SNAPApplicationDraft, asOf: Date) -> StudentExemption {
        federal.studentExemption(for: draft, asOf: asOf)
    }

    func expeditedCriteria(asOf: Date) -> ExpeditedCriteria {
        federal.expeditedCriteria(asOf: asOf)
    }

    func abawdStatus(for draft: SNAPApplicationDraft, asOf: Date) -> ABAWDStatus {
        federal.abawdStatus(for: draft, asOf: asOf)
    }

    // MARK: - Deduction-stack data

    func earnedIncomeDeductionRate(asOf: Date) -> Decimal {
        federal.earnedIncomeDeductionRate(asOf: asOf)
    }

    func maxAllotment(householdSize: Int, asOf: Date) -> Decimal {
        federal.maxAllotment(householdSize: householdSize, asOf: asOf)
    }

    func minimumBenefit(asOf: Date) -> Decimal {
        federal.minimumBenefit(asOf: asOf)
    }

    /// MA BBCE waives the asset test in practice — backend logic
    /// treats this as "always passes". The federal asset-limit
    /// dollar values are still returned here so audit math has
    /// the federal threshold available for context.
    func assetLimit(isElderlyOrDisabled: Bool, asOf: Date) -> Decimal {
        federal.assetLimit(isElderlyOrDisabled: isElderlyOrDisabled, asOf: asOf)
    }

    /// MA SUA chart (FY26 from DTA 106 CMR 364.945). Tiers:
    /// heating_cooling = $914, non_heating = $556, phone_only = $64.
    /// Bay State CAP recipients use the heating/cooling tier per
    /// DTA note (Bay State CAP SUA = $914, identical to H/C).
    /// Tier `.none` returns nil so the calculator falls back to
    /// actual utility costs.
    func suaValue(tier: SUATier, asOf: Date) -> Decimal? {
        let snapshot = activeSUASnapshot(asOf: asOf)
        switch tier {
        case .none:           return nil
        case .heatingCooling: return snapshot.value.heatingCooling
        case .nonHeating:     return snapshot.value.nonHeating
        case .phoneOnly:      return snapshot.value.phoneOnly
        }
    }

    /// MA hasn't yet loaded its FNS-approved ABAWD waiver list.
    /// Returns nil to signal "data not loaded" rather than "no
    /// waiver in effect". Civica must load the current MA waiver
    /// list before any ABAWD-affected verdicts ship to users.
    func abawdWaiverActive(fipsCode _: String, asOf _: Date) -> Bool? {
        nil
    }

    /// MA categorical eligibility: pure-cash path inherited from
    /// federal, plus BBCE (the DTA SNAP brochure trigger is met
    /// for every screener session per existing product design).
    /// Returns the BBCE path when none of the cash flags are set
    /// but the applicant is in MA -- this is the policy reality
    /// the existing grossIncomeLimit override already encodes.
    func categoricalEligibility(
        for draft: SNAPApplicationDraft,
        asOf: Date
    ) -> CategoricalEligibility {
        let cashOutcome = federal.categoricalEligibility(
            for: draft, asOf: asOf
        )
        switch cashOutcome {
        case .categoricallyEligible:
            return cashOutcome
        case .notCategoricallyEligible, .unknown:
            // MA BBCE applies to every applicant who completes the
            // screener; surface that as the categorical path so the
            // evaluator audit log shows MA-bbce as the rationale.
            return .categoricallyEligible(via: .bbce(stateCode: "MA"))
        }
    }

    // MARK: - Version stamp

    func rulesVersion(asOf: Date) -> String {
        let snapshot = activeBBCESnapshot(asOf: asOf)
        return "MA-bbce-200pct-\(snapshot.versionSuffix)"
    }

    // MARK: - Snapshot freshness (OBBBA audit Q12)

    /// Massachusetts does not operate a Restaurant Meals Program;
    /// the EBT card cannot be used for hot prepared meals in MA
    /// regardless of household status.
    func restaurantMealsProgramEligibility(
        for _: SNAPApplicationDraft,
        asOf _: Date
    ) -> RestaurantMealsEligibility {
        .notOperated
    }

    /// MA freshness = federal freshness ∩ MA's own BBCE + SUA
    /// snapshot windows. The earliest expiry wins.
    func snapshotStatus(asOf: Date) -> RuleSnapshotStatus {
        let federalStatus = federal.snapshotStatus(asOf: asOf)
        let federalExpiry: Date
        switch federalStatus {
        case .current(let exp), .expired(let exp): federalExpiry = exp
        }

        let maExpiries: [Date] = [
            Self.bbce200Snapshots.last!.expiresOn,
            Self.suaSnapshots.last!.expiresOn,
            federalExpiry
        ]
        let earliestExpiry = maExpiries.min() ?? .distantPast
        return asOf <= earliestExpiry
            ? .current(latestExpiry: earliestExpiry)
            : .expired(latestExpiry: earliestExpiry)
    }
}

// MARK: - MA BBCE 200% FPL snapshots

private extension MAStateRules {

    struct MABBCETable {
        /// Index 0 unused; indices 1-8 = HH size monthly thresholds.
        let perSize: [Decimal]
        /// Added to the size-8 value for each member beyond 8.
        let perAdditional: Decimal
    }

    /// Massachusetts BBCE gross income gate at 200% FPL, monthly.
    /// Verified against DTA 106 CMR 364.976 (effective 2026-02-01).
    /// MA uses the 2026 HHS FPL basis (Feb 2026 update); CA uses
    /// the FFY2026 FPL basis (Oct 2025). The dollar tables differ
    /// even though both anchor at 200% FPL — do not reuse CA's
    /// table here.
    static let bbce200Snapshots: [PolicySnapshot<MABBCETable>] = [
        .iso(
            from: "2025-10-01",
            to: "2026-09-30",
            versionSuffix: "FY26",
            value: MABBCETable(
                perSize: [
                    0,        // unused
                    2_660,    // HH 1
                    3_607,    // HH 2
                    4_553,    // HH 3
                    5_500,    // HH 4
                    6_447,    // HH 5
                    7_393,    // HH 6
                    8_340,    // HH 7
                    9_287     // HH 8
                ],
                perAdditional: 947
            )
        )
    ]

    func activeBBCESnapshot(asOf: Date) -> PolicySnapshot<MABBCETable> {
        Self.bbce200Snapshots.first(where: { $0.contains(asOf) })
            ?? Self.bbce200Snapshots.last!
    }

    struct MASUATable {
        let heatingCooling: Decimal
        let nonHeating: Decimal
        let phoneOnly: Decimal
    }

    /// MA SUA tiers from DTA 106 CMR 364.945 (effective 2025-10-01).
    /// Bay State CAP recipients use the heating/cooling value
    /// ($914 = same as H/C tier) per DTA note. When MA publishes
    /// FY27 values, add a new snapshot — don't edit the FY26 row
    /// in place.
    static let suaSnapshots: [PolicySnapshot<MASUATable>] = [
        .iso(
            from: "2025-10-01",
            to: "2026-09-30",
            versionSuffix: "FY26",
            value: MASUATable(
                heatingCooling: 914,
                nonHeating: 556,
                phoneOnly: 64
            )
        )
    ]

    func activeSUASnapshot(asOf: Date) -> PolicySnapshot<MASUATable> {
        Self.suaSnapshots.first(where: { $0.contains(asOf) })
            ?? Self.suaSnapshots.last!
    }
}
