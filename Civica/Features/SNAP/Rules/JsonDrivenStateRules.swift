import Foundation

// JSON-driven default implementation of SNAPStateRuleEngine — backed
// by a StateRuleProfile loaded from snap_eligibility_<state>.json.
// Methods that the protocol covers via data (BBCE income limits, SUA,
// ABAWD waiver lookup, RMP, categorical, rules version, snapshot
// freshness) read from the profile; methods that the federal default
// covers (net income, standard deduction, shelter cap, student gate,
// expedited criteria, ABAWD status, earned-income deduction, max
// allotment, minimum benefit, asset limit) delegate to FederalDefaultRules.
//
// New states with no state-specific *logic* (only different $ tables)
// need only a JSON profile + a one-line SNAPRulesRegistry entry:
//
//     case "TX": return JsonDrivenStateRules(stateCode: "TX")
//
// States with state-specific logic (e.g. CA's LPIE student exemption)
// implement SNAPStateRuleEngine directly, compose a private
// JsonDrivenStateRules for the data half, and override only the
// methods that need state-specific behavior. See CAStateRules.

struct JsonDrivenStateRules: SNAPStateRuleEngine {

    let profile: StateRuleProfile
    private let federal: FederalDefaultRules

    /// Convenience init: loads the profile by state code from `.main`.
    /// Crashes with a clear LoadError message if the JSON is missing or
    /// malformed — eligibility data is load-bearing for any state we
    /// route through this engine, so a missing profile is a deployment
    /// error worth failing loudly on.
    init(stateCode: String, bundle: Bundle = .main) {
        do {
            self.profile = try StateRuleProfileLoader.load(stateCode: stateCode, bundle: bundle)
        } catch {
            fatalError("JsonDrivenStateRules: \(error.localizedDescription)")
        }
        self.federal = FederalDefaultRules()
    }

    /// DI init for tests: pass a profile directly without touching the bundle.
    init(profile: StateRuleProfile, federal: FederalDefaultRules = FederalDefaultRules()) {
        self.profile = profile
        self.federal = federal
    }

    // MARK: - Identity

    var stateCode: String { profile.stateCode }
    var displayName: String { profile.displayName }

    // MARK: - Income limits

    func grossIncomeLimit(householdSize: Int, asOf: Date) -> Decimal {
        guard let bbce = profile.bbce, bbce.enabled,
              let snap = activeBBCESnapshot(asOf: asOf) else {
            return federal.grossIncomeLimit(householdSize: householdSize, asOf: asOf)
        }
        let size = max(1, householdSize)
        if size < snap.perSize.count {
            return snap.perSize[size]
        }
        let lastIndex = snap.perSize.count - 1
        return snap.perSize[lastIndex] + Decimal(size - lastIndex) * snap.perAdditional
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

    func earnedIncomeDeductionRate(asOf: Date) -> Decimal {
        federal.earnedIncomeDeductionRate(asOf: asOf)
    }

    func maxAllotment(householdSize: Int, asOf: Date) -> Decimal {
        federal.maxAllotment(householdSize: householdSize, asOf: asOf)
    }

    func minimumBenefit(asOf: Date) -> Decimal {
        federal.minimumBenefit(asOf: asOf)
    }

    /// BBCE waives the asset test in practice — backend logic treats this
    /// as "always passes" when bbce.enabled. The federal asset-limit dollar
    /// values are still returned here so audit math has the federal threshold
    /// available for context.
    func assetLimit(isElderlyOrDisabled: Bool, asOf: Date) -> Decimal {
        federal.assetLimit(isElderlyOrDisabled: isElderlyOrDisabled, asOf: asOf)
    }

    // MARK: - SUA

    func suaValue(tier: SUATier, asOf: Date) -> Decimal? {
        guard profile.sua != nil, let snap = activeSUASnapshot(asOf: asOf) else {
            return nil
        }
        switch tier {
        case .none: return nil
        case .heatingCooling: return snap.heatingCooling
        case .nonHeating: return snap.nonHeating
        case .phoneOnly: return snap.phoneOnly
        }
    }

    // MARK: - ABAWD waivers

    /// Returns nil when the state's FNS waiver list has not been loaded
    /// (`abawd.waivers_loaded: false` in JSON). Callers distinguish this
    /// "unknown" state from "no waiver in effect" so a stale-rules notice
    /// can be surfaced instead of asserting work requirements that may not
    /// apply. When `waivers_loaded: true` and no waiver matches, returns
    /// false (the asserted "no waiver" answer).
    func abawdWaiverActive(fipsCode: String, asOf: Date) -> Bool? {
        guard profile.abawd.waiversLoaded else { return nil }
        return profile.abawd.waivers.contains { $0.covers(fipsCode: fipsCode, asOf: asOf) }
    }

    // MARK: - Categorical eligibility

    /// Federal cash-recipient path inherited from FederalDefaultRules;
    /// when the cash path does not match AND profile enables BBCE,
    /// surfaces the BBCE outcome.
    func categoricalEligibility(
        for draft: SNAPApplicationDraft,
        asOf: Date
    ) -> CategoricalEligibility {
        let cashOutcome = federal.categoricalEligibility(for: draft, asOf: asOf)
        switch cashOutcome {
        case .categoricallyEligible:
            return cashOutcome
        case .notCategoricallyEligible, .unknown:
            let bbcePathEnabled = profile.categoricalEligibility?.bbcePathEnabled
                ?? (profile.bbce?.enabled ?? false)
            if bbcePathEnabled {
                return .categoricallyEligible(via: .bbce(stateCode: profile.stateCode))
            }
            return cashOutcome
        }
    }

    // MARK: - Restaurant Meals Program

    /// Default implementation: returns `.notOperated` when the profile
    /// declares the state does not operate RMP. When the profile declares
    /// the state DOES operate RMP, evaluates the federal elderly/disabled/
    /// unhoused criteria against the draft. States like CA where RMP is
    /// county-scoped should override this method on the per-state struct
    /// once the FindHelp RMP-retailer surface gates by county.
    func restaurantMealsProgramEligibility(
        for draft: SNAPApplicationDraft,
        asOf _: Date
    ) -> RestaurantMealsEligibility {
        guard profile.rmp.operated else { return .notOperated }

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
        if let bbce = profile.bbce, bbce.enabled, let snap = activeBBCESnapshot(asOf: asOf) {
            return "\(profile.stateCode)-bbce-\(bbce.thresholdFplPct)pct-\(snap.versionSuffix)"
        }
        return "\(profile.stateCode)-federal-default"
    }

    // MARK: - Snapshot freshness

    /// Composes federal freshness with the state's own BBCE + SUA
    /// snapshot windows. The earliest expiry wins.
    func snapshotStatus(asOf: Date) -> RuleSnapshotStatus {
        let federalStatus = federal.snapshotStatus(asOf: asOf)
        let federalExpiry: Date
        switch federalStatus {
        case .current(let exp), .expired(let exp): federalExpiry = exp
        }

        var expiries: [Date] = [federalExpiry]
        if let bbceExpiry = profile.bbce?.snapshots.last?.expiresOnDate {
            expiries.append(bbceExpiry)
        }
        if let suaExpiry = profile.sua?.snapshots.last?.expiresOnDate {
            expiries.append(suaExpiry)
        }
        let earliestExpiry = expiries.min() ?? .distantPast
        return asOf <= earliestExpiry
            ? .current(latestExpiry: earliestExpiry)
            : .expired(latestExpiry: earliestExpiry)
    }

    // MARK: - Snapshot selection

    func activeBBCESnapshot(asOf: Date) -> StateRuleProfile.BBCEConfig.Snapshot? {
        guard let bbce = profile.bbce, !bbce.snapshots.isEmpty else { return nil }
        return bbce.snapshots.first(where: { $0.contains(asOf) }) ?? bbce.snapshots.last
    }

    func activeSUASnapshot(asOf: Date) -> StateRuleProfile.SUAConfig.Snapshot? {
        guard let sua = profile.sua, !sua.snapshots.isEmpty else { return nil }
        return sua.snapshots.first(where: { $0.contains(asOf) }) ?? sua.snapshots.last
    }
}
