import Foundation

// On-device SNAP monthly-benefit estimator. Fills a gap left by
// SNAPLocalEligibilityEvaluator, which intentionally returns
// `benefitCalculation: nil` and only does threshold gating — the
// authoritative dollar-amount math is meant to come from the
// backend rules engine that isn't wired in yet.
//
// Formula (FY2026 federal SNAP, effective Oct 1, 2025 – Sep 30, 2026):
//   netBefore     = gross − earnedIncomeDeduction − standardDeduction
//   shelterCost   = rent + (paysUtilitiesSeparately ? SUA : 0)
//   excessShelter = max(0, shelterCost − netBefore / 2), capped at $744
//                   unless elderlyOrDisabled (then uncapped)
//   netIncome     = max(0, netBefore − excessShelter)
//   benefit       = round(maxAllotment − netIncome × 0.30), floored at 0
//   Min benefit   = $24 for 1–2 person households if the formula gives less.
//   Gross test    = skipped if elderlyOrDisabled; otherwise gross > 130%
//                   FPL → ineligible.
//   Net test      = netIncome > 100% FPL → ineligible.
//
// All money math runs in Decimal (matches CivicaMoney + the existing
// SNAPBenefitCalculationDetail model). This calculator is pure: no
// Date, no Locale, no I/O. Effective date + rules version are stamped
// by the caller when synthesizing a SNAPEligibilityResult.
//
// TODO(SNAP-est-1): State-specific SUA lookup. $500 is the federal
//   placeholder; real values vary $200–$1000+ by state (MA Heating
//   SUA FY26 = $924). Plumb a per-state value in from
//   SNAPStateResources.swift before shipping outside MA.
// TODO(SNAP-est-2): BBCE gross-income test bypass. Most states use
//   Broad-Based Categorical Eligibility to lift the gross-income limit
//   to 165–200% FPL (MA = 200%). For BBCE states the gross test should
//   skip; reuse SNAPLocalEligibilityEvaluator's 200% FPL table.
// TODO(SNAP-est-3): Medical & dependent-care deduction inputs.
//   Elderly/disabled medical >$35/mo and dependent-care costs both
//   materially change the estimate. Surface behind a "More questions"
//   disclosure once usage shows demand.
//
// Numbers verified May 2026 against the USDA FY26 COLA memo
// (effective Oct 1, 2025) and the 2025 HHS poverty guidelines that
// SNAP FY26 uses for its income tests. Re-verify each October when
// the next COLA memo lands.

struct SNAPBenefitEstimatorInputs: Equatable {
    var householdSize: Int
    var elderlyOrDisabled: Bool
    var grossMonthlyIncome: Decimal
    var monthlyRent: Decimal
    var paysUtilitiesSeparately: Bool

    static let `default` = SNAPBenefitEstimatorInputs(
        householdSize: 2,
        elderlyOrDisabled: false,
        grossMonthlyIncome: 1_800,
        monthlyRent: 1_400,
        paysUtilitiesSeparately: true
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

    static let rulesVersion = "local-estimator-FY26"
    static let effectiveDate = "2025-10-01"

    static let householdSizeRange: ClosedRange<Int> = 1...8
    static let incomeSliderRange: ClosedRange<Decimal> = 0...5_000
    static let rentSliderRange: ClosedRange<Decimal> = 0...3_000

    // FY2026 federal max monthly allotment, 48 contiguous + DC. Index 0 unused.
    private static let maxAllotmentByHouseholdSize: [Decimal] = [
        0, 298, 546, 785, 994, 1_183, 1_421, 1_571, 1_789
    ]

    // Additional $ per person beyond size 8 (USDA FY26 COLA memo).
    private static let perAdditionalPersonAboveEight: Decimal = 218

    // Standard deduction by HH size: 1–3 share, 4 unique, 5 unique, 6+ share.
    // Values from USDA FY26 COLA memo (effective Oct 1, 2025).
    private static let standardDeductionByHouseholdSize: [Decimal] = [
        0, 209, 209, 209, 223, 261, 299, 299, 299
    ]

    // 130% FPL gross-income test (skipped if elderly/disabled in HH).
    private static let grossIncomeLimit130Fpl: [Decimal] = [
        0, 1_696, 2_292, 2_888, 3_484, 4_080, 4_677, 5_273, 5_869
    ]

    // 100% FPL net-income test.
    private static let netIncomeLimit100Fpl: [Decimal] = [
        0, 1_305, 1_763, 2_222, 2_680, 3_138, 3_597, 4_055, 4_514
    ]

    private static let earnedIncomeDeductionRate: Decimal = 0.20
    private static let netIncomeShareForBenefit: Decimal = 0.30
    private static let halfNetMultiplier: Decimal = 0.5
    private static let excessShelterCap: Decimal = 744
    private static let standardUtilityAllowance: Decimal = 500
    private static let minBenefitForSmallHouseholds: Decimal = 24
    private static let minBenefitHouseholdSizeCutoff: Int = 2

    static func calculate(_ inputs: SNAPBenefitEstimatorInputs) -> SNAPBenefitEstimatorOutcome {
        let hh = max(householdSizeRange.lowerBound, min(inputs.householdSize, householdSizeRange.upperBound))
        let gross = max(0, inputs.grossMonthlyIncome)
        let rent = max(0, inputs.monthlyRent)
        let eld = inputs.elderlyOrDisabled

        let earnedIncomeDeduction = eld ? 0 : (gross * earnedIncomeDeductionRate).roundedWhole(.bankers)
        let standardDeduction = standardDeductionByHouseholdSize[hh]
        let netBefore = max(0, gross - earnedIncomeDeduction - standardDeduction)

        let shelterCost = rent + (inputs.paysUtilitiesSeparately ? standardUtilityAllowance : 0)
        let halfNetBefore = (netBefore * halfNetMultiplier).roundedWhole(.bankers)
        let rawExcessShelter = max(0, shelterCost - halfNetBefore)
        let excessShelter = eld ? rawExcessShelter : min(rawExcessShelter, excessShelterCap)

        let netIncome = max(0, netBefore - excessShelter)
        let thirtyPercentOfNet = (netIncome * netIncomeShareForBenefit).roundedWhole(.bankers)
        let maxAllotment = maxAllotmentFor(householdSize: hh)
        var monthlyBenefit = max(0, maxAllotment - thirtyPercentOfNet).roundedWhole(.bankers)

        if hh <= minBenefitHouseholdSizeCutoff && monthlyBenefit > 0 && monthlyBenefit < minBenefitForSmallHouseholds {
            monthlyBenefit = minBenefitForSmallHouseholds
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

        if !eld && gross > grossIncomeLimit130Fpl[hh] {
            return .ineligible(reason: .grossIncomeOverLimit, detail: detail)
        }
        if netIncome > netIncomeLimit100Fpl[hh] {
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

    private static func maxAllotmentFor(householdSize hh: Int) -> Decimal {
        if hh <= 8 { return maxAllotmentByHouseholdSize[hh] }
        return maxAllotmentByHouseholdSize[8] + (Decimal(hh - 8) * perAdditionalPersonAboveEight)
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
