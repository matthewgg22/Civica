import Foundation

// California CalFresh rules. The data half (BBCE 200% FPL table, SUA
// chart, RMP operates=true, ABAWD waiver list, categorical eligibility
// path) lives in Civica/Features/SNAP/SNAPRules/snap_eligibility_ca.json
// and is consumed via a composed JsonDrivenStateRules; the only
// CA-specific *logic* override is the LPIE student-exemption check,
// which depends on a runtime feature flag and the applicant draft.
//
// To update a CA $ table (BBCE thresholds, SUA tiers, ABAWD waivers,
// etc.) edit the JSON, not this file.
//
// Mirrors backend/civic_api/snap/rules/states/california.py — both
// conformers verified present 2026-06-01. Keep behaviour aligned on
// each significant change; the Python service is the authoritative
// engine once HTTP-wired, this Swift conformer is the offline mirror
// and cross-check oracle.

struct CAStateRules: SNAPStateRuleEngine {

    private let base: JsonDrivenStateRules

    init(bundle: Bundle = .main) {
        self.base = JsonDrivenStateRules(stateCode: "CA", bundle: bundle)
    }

    /// DI init for tests.
    init(profile: StateRuleProfile) {
        self.base = JsonDrivenStateRules(profile: profile)
    }

    // MARK: - Delegated (data-driven via profile)

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

    // MARK: - CA-specific overrides

    /// Session A — CA LPIE override.
    ///
    /// When the server-side `lpie_auto_exempt_enabled` flag is on AND the
    /// applicant is enrolled at least half-time AND in a degree or
    /// certificate program, return `.exempted(reason: .lpie)` immediately,
    /// bypassing the federal 5-path checklist. Otherwise delegate to
    /// `FederalDefaultRules.studentExemption` so the existing behavior is
    /// preserved on every other CA case.
    ///
    /// Flag flow: `LPIEFeatureFlag.refresh(...)` is called by the app at
    /// scene-active transitions and writes into a UserDefaults cache;
    /// `LPIEFeatureFlag.isEnabled` here is a pure read. Flipping the DB
    /// row instantly reverts this surface to pre-LPIE behavior on the
    /// applicant's next active session.
    ///
    /// TODO: replace with actual CA CDSS ACL number for LPIE expansion (Matthew to provide)
    func studentExemption(for draft: SNAPApplicationDraft, asOf: Date) -> StudentExemption {
        if LPIEFeatureFlag.isEnabled
            && draft.studentStatus.enrolledHalfTime == true
            && draft.studentStatus.degreeOrCertificateProgram == true {
            return .exempted(reason: .lpie)
        }
        return base.studentExemption(for: draft, asOf: asOf)
    }
}
