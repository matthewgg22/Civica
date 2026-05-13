import Foundation

// On-device SNAP monthly-benefit estimator. Fills a gap left by
// SNAPLocalEligibilityEvaluator, which intentionally returns
// `benefitCalculation: nil` and only does threshold gating — the
// authoritative dollar-amount math is meant to come from the
// backend rules engine that isn't wired in yet.
//
// Formula (federal SNAP 7 CFR 273 deduction stack, applied with
// whichever PolicySnapshot the rules engine selects for asOf):
//   netBefore     = gross − earnedIncomeDeduction − standardDeduction
//   shelterCost   = rent + (paysUtilitiesSeparately ? SUA : 0)
//   excessShelter = max(0, shelterCost − netBefore / 2), capped at the
//                   federal shelter-cap unless elderlyOrDisabled (no cap).
//   netIncome     = max(0, netBefore − excessShelter)
//   benefit       = round(maxAllotment − netIncome × 0.30), floored at 0
//   Min benefit   = federal minimum for 1–2 person households if the
//                   formula gives less.
//   Gross test    = skipped if elderlyOrDisabled; otherwise gross >
//                   federal gross-income limit → ineligible.
//   Net test      = netIncome > federal net-income limit → ineligible.
//
// Per OBBBA audit Worktree B: this calculator no longer carries
// independent federal constants. Every threshold (max allotment,
// FPL limits, standard deduction, shelter cap, SUA, minimum
// benefit, earned-income deduction rate) comes from
// SNAPBenefitEstimatorCalculator.rules. Number corrections happen
// in one place (FederalDefaultRules / MAStateRules) and propagate
// here automatically.
//
// Today the rules engine is FederalDefaultRules — SUA returns nil
// from the federal default, so paysUtilitiesSeparately collapses
// to zero deduction. Threading MA-specific rules in (so MA users
// get the MA SUA chart and BBCE gross test) is a follow-up that
// also requires expanding the 5-question form.
//
// All money math runs in Decimal (matches CivicaMoney + the existing
// SNAPBenefitCalculationDetail model).

struct SNAPBenefitEstimatorInputs: Equatable {
    var householdSize: Int
    var elderlyOrDisabled: Bool
    var grossMonthlyIncome: Decimal
    /// Whether any income in the household comes from wages or self-employment.
    /// When false, the earned-income deduction (20%) is not applied.
    var hasEmploymentIncome: Bool
    var monthlyRent: Decimal
    var suaTier: SUATier

    static let `default` = SNAPBenefitEstimatorInputs(
        householdSize: 2,
        elderlyOrDisabled: false,
        grossMonthlyIncome: 1_800,
        hasEmploymentIncome: true,
        monthlyRent: 1_400,
        suaTier: .heatingCooling
    )
}

enum SNAPBenefitEstimatorIneligibilityReason: Equatable {
    case grossIncomeOverLimit
    case netIncomeOverLimit
    case benefitBelowMinThreshold
}

enum SNAPBenefitEstimatorOutcome: Equatable {
    case eligible(monthlyBenefit: Decimal, annualEquivalent: Decimal, detail: SNAPBenefitCalculationDetail)
    case ineligible(reason: SNAPBenefitEstimatorIneligibilityReason, detail: SNAPBenefitCalculationDetail)

    var detail: SNAPBenefitCalculationDetail {
        switch self {
        case .eligible(_, _, let detail), .ineligible(_, let detail): return detail
        }
    }
}

enum SNAPBenefitEstimatorCalculator {

    static let effectiveDate = "2025-10-01"

    static let householdSizeRange: ClosedRange<Int> = 1...8
    static let incomeSliderRange: ClosedRange<Decimal> = 0...5_000
    static let rentSliderRange: ClosedRange<Decimal> = 0...3_000

    // OBBBA audit Worktree B: the estimator no longer carries its
    // own federal constants. Every threshold (max allotment, FPL
    // limits, standard deduction, shelter cap, minimum benefit,
    // earned-income deduction rate) comes from the rules engine
    // selected below. This is the "single source of truth" the
    // audit requires; today the engine is federal-default, and the
    // SNAPCoveragePolicy MA-only gate routes non-MA users away
    // from this entry. A future commit can thread MA-specific
    // rules in for in-scope users to pick up the MA SUA chart.
    static let rules: SNAPStateRuleEngine = MAStateRules()

    /// Stamped on the estimator outcome's audit footer. Threads the
    /// active rules-engine version so the estimator's provenance
    /// chain reaches back to the same PolicySnapshot rows used by
    /// the application flow.
    static var rulesVersion: String {
        "local-estimator-via-" + rules.rulesVersion(asOf: Date())
    }

    private static let netIncomeShareForBenefit: Decimal = 0.30
    private static let halfNetMultiplier: Decimal = 0.5

    static func calculate(_ inputs: SNAPBenefitEstimatorInputs) -> SNAPBenefitEstimatorOutcome {
        let today = Date()
        let hh = max(householdSizeRange.lowerBound, min(inputs.householdSize, householdSizeRange.upperBound))
        let gross = max(0, inputs.grossMonthlyIncome)
        let rent = max(0, inputs.monthlyRent)
        let eld = inputs.elderlyOrDisabled

        let earnedIncomeRate = rules.earnedIncomeDeductionRate(asOf: today)
        let earnedForDeduction: Decimal = (!eld && inputs.hasEmploymentIncome) ? gross : 0
        let earnedIncomeDeduction = (earnedForDeduction * earnedIncomeRate).roundedWhole(.bankers)
        let standardDeduction = rules.standardDeduction(householdSize: hh, asOf: today)
        let netBefore = max(0, gross - earnedIncomeDeduction - standardDeduction)

        let sua: Decimal = inputs.suaTier == .none
            ? 0
            : (rules.suaValue(tier: inputs.suaTier, asOf: today) ?? 0)
        let shelterCost = rent + sua
        let halfNetBefore = (netBefore * halfNetMultiplier).roundedWhole(.bankers)
        let rawExcessShelter = max(0, shelterCost - halfNetBefore)
        let shelterCap = rules.shelterDeductionCap(isElderlyOrDisabled: eld, asOf: today)
        let excessShelter = shelterCap.map { min(rawExcessShelter, $0) } ?? rawExcessShelter

        let netIncome = max(0, netBefore - excessShelter)
        let thirtyPercentOfNet = (netIncome * netIncomeShareForBenefit).roundedWhole(.bankers)
        let maxAllotment = rules.maxAllotment(householdSize: hh, asOf: today)
        var monthlyBenefit = max(0, maxAllotment - thirtyPercentOfNet).roundedWhole(.bankers)

        let minBenefit = rules.minimumBenefit(asOf: today)
        if hh <= 2 && monthlyBenefit > 0 && monthlyBenefit < minBenefit {
            monthlyBenefit = minBenefit
        }

        let detail = SNAPBenefitCalculationDetail(
            grossMonthlyIncome: gross,
            earnedIncomeDeduction: earnedIncomeDeduction,
            standardDeduction: standardDeduction,
            dependentCareDeduction: 0,
            medicalDeduction: 0,
            childSupportDeduction: 0,
            excessShelterDeduction: excessShelter,
            netMonthlyIncome: netIncome,
            thirtyPercentOfNet: thirtyPercentOfNet,
            maxAllotmentForHouseholdSize: maxAllotment,
            monthlyBenefit: monthlyBenefit
        )

        if !eld && gross > rules.grossIncomeLimit(householdSize: hh, asOf: today) {
            return .ineligible(reason: .grossIncomeOverLimit, detail: detail)
        }
        if netIncome > rules.netIncomeLimit(householdSize: hh, asOf: today) {
            return .ineligible(reason: .netIncomeOverLimit, detail: detail)
        }
        if monthlyBenefit <= 0 {
            return .ineligible(reason: .benefitBelowMinThreshold, detail: detail)
        }

        return .eligible(
            monthlyBenefit: monthlyBenefit,
            annualEquivalent: monthlyBenefit * 12,
            detail: detail
        )
    }
}

private extension Decimal {
    func roundedWhole(_ mode: NSDecimalNumber.RoundingMode) -> Decimal {
        var value = self
        var result = Decimal()
        NSDecimalRound(&result, &value, 0, mode)
        return result
    }
}
