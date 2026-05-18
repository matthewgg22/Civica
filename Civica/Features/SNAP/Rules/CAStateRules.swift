import Foundation

// California CalFresh rules. Composes a FederalDefaultRules for
// the methods CA doesn't override, and overrides:
//
//   * grossIncomeLimit — Broad-Based Categorical Eligibility (BBCE)
//     at 200% FPL. CA waives the asset test for most households;
//     categorical eligibility extends up to 2x the federal poverty
//     guideline.
//   * netIncomeLimit — under BBCE, CA waives the federal net-income
//     test for non-elderly/disabled households. We still return the
//     federal value so the backend deduction math can reference it
//     when computing benefit amount.
//   * suaValue — CA SUA chart published by CDSS annually. FY26
//     values seeded from ACL 25-68 (SUA=$663, LUA=$170, TUA=$20).
//   * rulesVersion — stamps "CA-bbce-200pct-FY26" to match the
//     audit-footer convention.
//
// Student gate, expedited criteria, deductions, and ABAWD all
// inherit federal behavior for now. CA's EOPS / EOP&S programs are
// a state-specific student exception (referenced in the protocol's
// ExemptionReason.stateSpecific), but the application flow does not
// yet collect a yes/no on EOPS participation — adding the override
// before that question lands would over-disqualify.
//
// Mirrors backend/civic_api/snap/rules/states/california.py (TODO:
// confirm Python conformer exists before production release).

struct CAStateRules: SNAPStateRuleEngine {
    let stateCode: String = "CA"
    let displayName: String = "California"

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

    /// CA BBCE waives the asset test in practice — backend logic
    /// treats this as "always passes". The federal asset-limit
    /// dollar values are still returned here so audit math has
    /// the federal threshold available for context.
    func assetLimit(isElderlyOrDisabled: Bool, asOf: Date) -> Decimal {
        federal.assetLimit(isElderlyOrDisabled: isElderlyOrDisabled, asOf: asOf)
    }

    /// CA SUA chart (FY26-seeded from CDSS ACL 25-68 / ACIN I-46-25).
    /// CDSS uses three tiers: SUA ($663, full heating/cooling
    /// equivalent), LUA ($170, limited utility allowance), TUA
    /// ($20, telephone-only). Tier `.none` returns nil so the
    /// calculator falls back to actual utility costs.
    ///
    /// Note: OBBBA §10104 removed internet from the excess shelter
    /// deduction effective 2025-07-04; ACL 25-68 confirms CDSS
    /// updated its SUA methodology accordingly. The dollar values
    /// below already reflect the post-§10104 methodology.
    func suaValue(tier: SUATier, asOf: Date) -> Decimal? {
        let snapshot = activeSUASnapshot(asOf: asOf)
        switch tier {
        case .none:           return nil
        case .heatingCooling: return snapshot.value.sua
        case .nonHeating:     return snapshot.value.lua
        case .phoneOnly:      return snapshot.value.tua
        }
    }

    /// CA hasn't yet loaded its FNS-approved ABAWD waiver list.
    /// CalFresh historically has broad area-level waivers in many
    /// counties; returning nil signals "data not loaded" rather
    /// than "no waiver in effect" so callers can render a
    /// stale-rules notice instead of asserting work requirements
    /// that may not apply.
    func abawdWaiverActive(fipsCode _: String, asOf _: Date) -> Bool? {
        nil
    }

    /// CA categorical eligibility: pure-cash path inherited from
    /// federal, plus BBCE. CalFresh's BBCE applies broadly to any
    /// household earning under 200% FPL; the cash-recipient path
    /// short-circuits to that outcome when it matches.
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
            return .categoricallyEligible(via: .bbce(stateCode: "CA"))
        }
    }

    /// CalFresh operates the Restaurant Meals Program in a growing
    /// number of counties (LA, San Diego, Riverside, San Mateo,
    /// Santa Clara, San Francisco, Orange, Sacramento, …). The
    /// household-level qualifying criteria are federal: elderly
    /// (60+), disabled, or unhoused. This conformer evaluates the
    /// federal criteria; whether the user's specific county
    /// participates is a separate lookup that ships with the
    /// FindHelp RMP-retailer surface, not here.
    ///
    /// The screener captures `hasElderlyOrDisabled` as a combined
    /// flag and does not yet distinguish elderly from disabled — a
    /// positive combined flag routes through the .disabled reason
    /// for now; a future screener question can split these.
    func restaurantMealsProgramEligibility(
        for draft: SNAPApplicationDraft,
        asOf _: Date
    ) -> RestaurantMealsEligibility {
        var reasons: [RestaurantMealsEligibility.Reason] = []
        let elderlyOrDisabled = draft.household.hasElderlyOrDisabled
        let housing = draft.whereApplying.housingStatus

        if elderlyOrDisabled == true {
            reasons.append(.disabled)
        }
        if housing == .unhoused {
            reasons.append(.unhoused)
        }

        if !reasons.isEmpty {
            return .eligible(reasons: reasons)
        }
        // Both criteria explicitly negative → not eligible.
        if elderlyOrDisabled == false && housing != nil {
            return .notEligible
        }
        // Otherwise the screener hasn't collected enough to evaluate.
        return .unknown
    }

    // MARK: - Version stamp

    func rulesVersion(asOf: Date) -> String {
        let snapshot = activeBBCESnapshot(asOf: asOf)
        return "CA-bbce-200pct-\(snapshot.versionSuffix)"
    }

    // MARK: - Snapshot freshness (OBBBA audit Q12)

    /// CA freshness = federal freshness ∩ CA's own BBCE + SUA
    /// snapshot windows. The earliest expiry wins.
    func snapshotStatus(asOf: Date) -> RuleSnapshotStatus {
        let federalStatus = federal.snapshotStatus(asOf: asOf)
        let federalExpiry: Date
        switch federalStatus {
        case .current(let exp), .expired(let exp): federalExpiry = exp
        }

        let caExpiries: [Date] = [
            Self.bbce200Snapshots.last!.expiresOn,
            Self.suaSnapshots.last!.expiresOn,
            federalExpiry
        ]
        let earliestExpiry = caExpiries.min() ?? .distantPast
        return asOf <= earliestExpiry
            ? .current(latestExpiry: earliestExpiry)
            : .expired(latestExpiry: earliestExpiry)
    }
}

// MARK: - CA BBCE 200% FPL snapshots

private extension CAStateRules {

    struct CABBCETable {
        /// Index 0 unused; indices 1-8 = HH size monthly thresholds.
        let perSize: [Decimal]
        /// Added to the size-8 value for each member beyond 8.
        let perAdditional: Decimal
    }

    /// CalFresh MCE (BBCE) gross income gate at 200% FPL, monthly.
    /// Verified against CDSS ACIN I-46-25 (FFY 2026 COLA) via the
    /// Santa Clara County DEBS chart book. CA uses the FFY2026 FPL
    /// basis (effective 2025-10-01); MA uses the calendar-2026 HHS
    /// FPL (effective 2026-02-01) — the dollar tables differ even
    /// though both anchor at 200% FPL. Do not reuse MA's table here.
    static let bbce200Snapshots: [PolicySnapshot<CABBCETable>] = [
        .iso(
            from: "2025-10-01",
            to: "2026-09-30",
            versionSuffix: "FY26",
            value: CABBCETable(
                perSize: [
                    0,        // unused
                    2_610,    // HH 1
                    3_526,    // HH 2
                    4_442,    // HH 3
                    5_360,    // HH 4
                    6_276,    // HH 5
                    7_192,    // HH 6
                    8_110,    // HH 7
                    9_026     // HH 8
                ],
                perAdditional: 918
            )
        )
    ]

    func activeBBCESnapshot(asOf: Date) -> PolicySnapshot<CABBCETable> {
        Self.bbce200Snapshots.first(where: { $0.contains(asOf) })
            ?? Self.bbce200Snapshots.last!
    }

    struct CASUATable {
        /// Full SUA (heating/cooling equivalent); CDSS label "SUA".
        let sua: Decimal
        /// Limited Utility Allowance; CDSS label "LUA".
        let lua: Decimal
        /// Telephone-only Utility Allowance; CDSS label "TUA".
        let tua: Decimal
    }

    /// CA SUA tiers seeded from CDSS ACL 25-68 (FY26 SUA chart) and
    /// confirmed against the Santa Clara County DEBS chart book.
    /// When CDSS publishes FY27 values, add a new snapshot — don't
    /// edit the FY26 row in place.
    static let suaSnapshots: [PolicySnapshot<CASUATable>] = [
        .iso(
            from: "2025-10-01",
            to: "2026-09-30",
            versionSuffix: "FY26",
            value: CASUATable(
                sua: 663,
                lua: 170,
                tua: 20
            )
        )
    ]

    func activeSUASnapshot(asOf: Date) -> PolicySnapshot<CASUATable> {
        Self.suaSnapshots.first(where: { $0.contains(asOf) })
            ?? Self.suaSnapshots.last!
    }
}
