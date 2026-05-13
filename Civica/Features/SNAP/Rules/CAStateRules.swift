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
//   * suaValue — CA SUA chart is published by CDSS annually. Until
//     a verified FY26 snapshot lands, return nil (calculator falls
//     back to actuals) rather than guessing. See TODO below.
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

    /// TODO(launch/CDSS-data): Load the FY26 CDSS-published CalFresh
    /// SUA chart and add a `suaSnapshots` table mirroring
    /// MAStateRules. Until then, return nil so the calculator falls
    /// back to actual utility costs rather than guessing at SUA
    /// values that haven't been verified by CDSS.
    func suaValue(tier _: SUATier, asOf _: Date) -> Decimal? {
        nil
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

    /// CA freshness = federal freshness ∩ CA's BBCE snapshot window.
    /// No SUA snapshot yet (see suaValue TODO); when it lands, add
    /// its expiry to the intersection.
    func snapshotStatus(asOf: Date) -> RuleSnapshotStatus {
        let federalStatus = federal.snapshotStatus(asOf: asOf)
        let federalExpiry: Date
        switch federalStatus {
        case .current(let exp), .expired(let exp): federalExpiry = exp
        }

        let caExpiries: [Date] = [
            Self.bbce200Snapshots.last!.expiresOn,
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

    /// 200% of FY26 federal poverty guideline monthly income, the
    /// CalFresh BBCE gross income gate. Identical thresholds to MA
    /// (200% FPL is a federal derivation, not state-specific); kept
    /// as a separate table so future per-state divergence (e.g. CA
    /// elderly/disabled at a different multiplier) lands cleanly
    /// without coupling MA and CA.
    ///
    /// Index 0 unused; index 1-4 = household size. For 5+ households
    /// the size-4 floor is returned (conservative under-estimate of
    /// eligibility since real size-5+ thresholds are higher; can
    /// never over-estimate).
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
