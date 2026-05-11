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
        let size = max(1, min(householdSize, snapshot.value.count - 1))
        return snapshot.value[size]
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

    // MARK: - Version stamp

    func rulesVersion(asOf: Date) -> String {
        let snapshot = activeBBCESnapshot(asOf: asOf)
        return "MA-bbce-200pct-\(snapshot.versionSuffix)"
    }
}

// MARK: - MA BBCE 200% FPL snapshots

private extension MAStateRules {

    /// 200% of FY26 federal poverty guideline monthly income, the
    /// Massachusetts BBCE gross income gate. Index 0 unused; index
    /// 1-4 = household size. For 5+ households the size-4 floor is
    /// returned (conservative under-estimate of eligibility since
    /// real size-5+ thresholds are higher; can never over-estimate).
    ///
    /// Identical to the pre-refactor SNAPLocalEligibilityEvaluator
    /// ma200FplMonthly array, preserved bit-for-bit so MA users see
    /// the same verdict after the cutover.
    static let bbce200Snapshots: [PolicySnapshot<[Decimal]>] = [
        .iso(
            from: "2025-10-01",
            to: "2026-09-30",
            versionSuffix: "FY26",
            value: [
                0,        // unused
                2_510,    // 1 person: $1,255 x 200%
                3_408,    // 2 person: $1,704 x 200%
                4_304,    // 3 person: $2,152 x 200%
                5_200     // 4 person: $2,600 x 200%
            ]
        )
    ]

    func activeBBCESnapshot(asOf: Date) -> PolicySnapshot<[Decimal]> {
        Self.bbce200Snapshots.first(where: { $0.contains(asOf) })
            ?? Self.bbce200Snapshots.last!
    }
}
