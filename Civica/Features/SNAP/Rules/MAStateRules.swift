import Foundation

// Massachusetts SNAP rules. The data half (BBCE 200% FPL table,
// DTA SUA chart, ABAWD waiver list, RMP operated=false, categorical
// eligibility BBCE path) lives in
// Civica/Features/SNAP/SNAPRules/snap_eligibility_ma.json and is
// consumed via a composed JsonDrivenStateRules. There are currently
// no MA-specific logic overrides; the struct exists so callers can
// reference `MAStateRules()` directly and so that adding a future
// override (e.g. DTA-approved E&T student exemption once the intake
// flow collects that question) has a clear home.
//
// To update an MA $ table edit the JSON, not this file.
//
// Mirrors backend/civic_api/snap/rules/states/massachusetts.py —
// both conformers verified present 2026-06-01. Keep behaviour aligned
// on each significant change; the Python service is the authoritative
// engine once HTTP-wired, this Swift conformer is the offline mirror
// and cross-check oracle.

struct MAStateRules: SNAPStateRuleEngine {

    private let base: JsonDrivenStateRules

    init(bundle: Bundle = .main) {
        self.base = JsonDrivenStateRules(stateCode: "MA", bundle: bundle)
    }

    /// DI init for tests.
    init(profile: StateRuleProfile) {
        self.base = JsonDrivenStateRules(profile: profile)
    }

    // MARK: - Delegated (data-driven via profile, no MA-specific overrides)

    var stateCode: String { base.stateCode }
    var displayName: String { base.displayName }

    func grossIncomeLimit(householdSize: Int, asOf: Date) -> Decimal {
        base.grossIncomeLimit(householdSize: householdSize, asOf: asOf)
    }

    func netIncomeLimit(householdSize: Int, asOf: Date) -> Decimal {
        base.netIncomeLimit(householdSize: householdSize, asOf: asOf)
    }

    func standardDeduction(householdSize: Int, asOf: Date) -> Decimal {
        base.standardDeduction(householdSize: householdSize, asOf: asOf)
    }

    func shelterDeductionCap(isElderlyOrDisabled: Bool, asOf: Date) -> Decimal? {
        base.shelterDeductionCap(isElderlyOrDisabled: isElderlyOrDisabled, asOf: asOf)
    }

    func studentExemption(for draft: SNAPApplicationDraft, asOf: Date) -> StudentExemption {
        base.studentExemption(for: draft, asOf: asOf)
    }

    func expeditedCriteria(asOf: Date) -> ExpeditedCriteria {
        base.expeditedCriteria(asOf: asOf)
    }

    func abawdStatus(for draft: SNAPApplicationDraft, asOf: Date) -> ABAWDStatus {
        base.abawdStatus(for: draft, asOf: asOf)
    }

    func abawdWaiverActive(fipsCode: String, asOf: Date) -> Bool? {
        base.abawdWaiverActive(fipsCode: fipsCode, asOf: asOf)
    }

    func earnedIncomeDeductionRate(asOf: Date) -> Decimal {
        base.earnedIncomeDeductionRate(asOf: asOf)
    }

    func maxAllotment(householdSize: Int, asOf: Date) -> Decimal {
        base.maxAllotment(householdSize: householdSize, asOf: asOf)
    }

    func minimumBenefit(asOf: Date) -> Decimal {
        base.minimumBenefit(asOf: asOf)
    }

    func assetLimit(isElderlyOrDisabled: Bool, asOf: Date) -> Decimal {
        base.assetLimit(isElderlyOrDisabled: isElderlyOrDisabled, asOf: asOf)
    }

    func suaValue(tier: SUATier, asOf: Date) -> Decimal? {
        base.suaValue(tier: tier, asOf: asOf)
    }

    func categoricalEligibility(
        for draft: SNAPApplicationDraft,
        asOf: Date
    ) -> CategoricalEligibility {
        base.categoricalEligibility(for: draft, asOf: asOf)
    }

    func restaurantMealsProgramEligibility(
        for draft: SNAPApplicationDraft,
        asOf: Date
    ) -> RestaurantMealsEligibility {
        base.restaurantMealsProgramEligibility(for: draft, asOf: asOf)
    }

    func rulesVersion(asOf: Date) -> String {
        base.rulesVersion(asOf: asOf)
    }

    func snapshotStatus(asOf: Date) -> RuleSnapshotStatus {
        base.snapshotStatus(asOf: asOf)
    }
}
