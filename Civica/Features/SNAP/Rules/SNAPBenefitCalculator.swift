import Foundation

// Ports the 7 CFR 273 deduction-stack math from
// backend/civic_api/snap/rules/federal.py (_compute_net_income)
// into Swift. Given a draft, the active rules engine, and a date,
// returns the full itemized SNAPBenefitCalculationDetail that
// SNAPDecisionMathView renders -- earned-income deduction, standard
// deduction, dependent-care, medical (elderly/disabled only),
// excess shelter (capped or uncapped), net monthly income, 30% of
// net, max allotment, and the final monthly benefit.
//
// Input gaps in today's question flow get permissive defaults
// (called out in the issue/feature log as TODOs):
//
//   * The flow asks `grossMonthlyIncome` as one number; this
//     calculator treats it as 100% earned -- maximizing the 20%
//     earned-income deduction. Add an unearned-income question
//     to refine.
//   * Property taxes and homeowners insurance are not collected;
//     treated as $0.
//   * Child support paid is not collected; treated as $0.
//   * Standard Utility Allowance tier is derived from
//     draft.expenses.suaTier (computed from selectedUtilities —
//     the per-utility-type checklist). When no utility types are
//     selected, tier is .none and utility deduction is $0. When a
//     tier IS selected, effective utility = max(actual, suaValue)
//     so a household that qualifies for SUA can't lose deduction
//     by reporting low actuals. (T16 Gap #1/#2)
//   * When housingStatus == .unhoused, the federal homeless shelter
//     standard deduction ($179/mo) is applied automatically in place
//     of rent + utilities. (T16 Gap #8)
//   * Medical expenses count only when the household has an elderly
//     or disabled member, and only the portion above $35 (7 CFR
//     273.9(d)(3)).
//
// Rounding: federal rules round to whole dollars at specific math
// steps using "round half away from zero" (Python's ROUND_HALF_UP);
// Swift's NSDecimalRound .plain mode matches that on positive
// values.

enum SNAPBenefitCalculator {

    /// Computes a full itemized benefit calculation for the
    /// draft against the active rules engine. Returns nil only
    /// when household size cannot be parsed (degenerate input);
    /// otherwise always returns a detail -- a zero benefit is a
    /// valid result, not an error.
    ///
    /// T16 Gap #2: SUA tier is now derived from
    /// `draft.expenses.suaTier` (computed from selectedUtilities)
    /// rather than a hardcoded default. The rules engine already
    /// had correct CA SUA values ($663/$170/$20); the missing piece
    /// was passing the right tier in.
    ///
    /// T16 Gap #8: When `draft.whereApplying.housingStatus == .unhoused`
    /// the federal homeless shelter standard deduction ($179/mo, 7 CFR
    /// 273.9(d)(6)) is applied automatically in place of rent + utilities.
    static func calculate(
        draft: SNAPApplicationDraft,
        rules: SNAPStateRuleEngine,
        today: Date
    ) -> SNAPBenefitCalculationDetail {
        let inputs = Inputs(draft: draft)
        let householdSize = inputs.householdSize

        let earnedDeduction = roundDollar(
            inputs.earnedIncome * rules.earnedIncomeDeductionRate(asOf: today)
        )
        let standardDeduction = rules.standardDeduction(
            householdSize: householdSize,
            asOf: today
        )

        // Medical: only applies when household has elderly/disabled,
        // and only the portion above the federal $35 floor.
        var medical: Decimal = 0
        if inputs.hasElderlyOrDisabled, inputs.medical > 35 {
            medical = inputs.medical - 35
        }

        let depCare = inputs.dependentCare
        let childSupport = inputs.childSupportPaid

        // Adjusted income drives the 50%-shelter calculation.
        var adjustedIncome = inputs.gross
            - earnedDeduction
            - standardDeduction
            - depCare
            - medical
            - childSupport
        if adjustedIncome < 0 { adjustedIncome = 0 }
        let halfAdjusted = adjustedIncome / 2

        // T16 Gap #2: Effective utility cost.
        // SUA is a *substitution* for itemized costs, not additive.
        //
        // Old logic: checked if actualUtilities <= 0 — this penalised
        // households who selected utility types but hadn't entered a
        // dollar amount yet, collapsing their deduction to zero.
        //
        // New logic: check suaTier == .none (household selected no utility
        // types → utilities included in rent → no SUA deduction). When a
        // tier IS selected, take max(actuals, suaValue) so a low reported
        // amount doesn't penalise a household that qualifies for SUA.
        let effectiveUtility: Decimal
        if inputs.suaTier == .none {
            effectiveUtility = 0
        } else if let sua = rules.suaValue(tier: inputs.suaTier, asOf: today) {
            effectiveUtility = max(inputs.actualUtilities, sua)
        } else {
            // Rules engine has no SUA chart (federal default) — fall back
            // to actual reported utilities.
            effectiveUtility = inputs.actualUtilities
        }

        // T16 Gap #8: Homeless shelter standard deduction.
        // 7 CFR 273.9(d)(6): unhoused households receive a federal
        // standard deduction ($179/mo FY2026) in place of documented
        // rent + utilities. When the applicant is unhoused, skip rent
        // and utilities and apply the standard deduction directly.
        let shelterCosts: Decimal
        if inputs.isUnhoused {
            shelterCosts = SNAPHomelessShelterDeduction.monthlyFY2026
        } else {
            shelterCosts = inputs.rentOrMortgage
                + inputs.propertyTaxes
                + inputs.homeownersInsurance
                + effectiveUtility
        }

        let excessShelterRaw = shelterCosts - halfAdjusted
        let excessShelter: Decimal
        if excessShelterRaw < 0 {
            excessShelter = 0
        } else if inputs.hasElderlyOrDisabled {
            // Elderly/disabled households have NO federal cap.
            excessShelter = excessShelterRaw
        } else {
            let cap = rules.shelterDeductionCap(
                isElderlyOrDisabled: false,
                asOf: today
            ) ?? excessShelterRaw
            excessShelter = min(excessShelterRaw, cap)
        }

        var net = inputs.gross
            - earnedDeduction
            - standardDeduction
            - depCare
            - medical
            - childSupport
            - excessShelter
        if net < 0 { net = 0 }

        let thirtyPctNet = roundDollar(net * Self.thirtyPercent)
        let maxAllot = rules.maxAllotment(
            householdSize: householdSize,
            asOf: today
        )
        var monthlyBenefit = maxAllot - thirtyPctNet

        // Federal minimum benefit for 1-2 person households (8%
        // of 1-person max allotment, rounded). 3+ person households
        // can be approved with $0 -- no minimum.
        let minBenefit = rules.minimumBenefit(asOf: today)
        if householdSize <= 2, monthlyBenefit > 0, monthlyBenefit < minBenefit {
            monthlyBenefit = minBenefit
        }
        if monthlyBenefit < 0 { monthlyBenefit = 0 }

        return SNAPBenefitCalculationDetail(
            grossMonthlyIncome: roundDollar(inputs.gross),
            earnedIncomeDeduction: earnedDeduction,
            standardDeduction: standardDeduction,
            dependentCareDeduction: roundDollar(depCare),
            medicalDeduction: roundDollar(medical),
            childSupportDeduction: roundDollar(childSupport),
            excessShelterDeduction: roundDollar(excessShelter),
            netMonthlyIncome: roundDollar(net),
            thirtyPercentOfNet: thirtyPctNet,
            maxAllotmentForHouseholdSize: maxAllot,
            monthlyBenefit: roundDollar(monthlyBenefit)
        )
    }

    // MARK: - Private

    private static let thirtyPercent: Decimal = Decimal(string: "0.30") ?? 0.30

    /// Matches Python's `_round_dollar` (ROUND_HALF_UP). For the
    /// positive values this calculator produces, `.plain` mode of
    /// NSDecimalRound is equivalent.
    private static func roundDollar(_ value: Decimal) -> Decimal {
        var input = value
        var output = Decimal()
        NSDecimalRound(&output, &input, 0, .plain)
        return output
    }

    /// Maps draft fields into the shape the calculator needs. All
    /// permissive defaults live here so the math body stays
    /// algorithm-only.
    private struct Inputs {
        let householdSize: Int
        let gross: Decimal
        /// Earned income (wages + self-employment net). Resolved
        /// in order: explicit `monthlyEarnedAmount` field, then
        /// the `anyoneEarning` / `hasUnearnedIncome` signals, then
        /// a permissive fallback to 100% earned. Future flow work
        /// adds a dedicated screen to capture the exact split.
        let earnedIncome: Decimal
        let hasElderlyOrDisabled: Bool
        let rentOrMortgage: Decimal
        /// TODO: not collected by the flow yet; assumed $0.
        let propertyTaxes: Decimal
        /// TODO: not collected by the flow yet; assumed $0.
        let homeownersInsurance: Decimal
        let actualUtilities: Decimal
        /// T16 Gap #2: derived from draft.expenses.suaTier (computed
        /// from selectedUtilities) instead of a hardcoded default.
        let suaTier: SUATier
        /// T16 Gap #8: true when housingStatus == .unhoused.
        /// Triggers the federal homeless shelter standard deduction.
        let isUnhoused: Bool
        let dependentCare: Decimal
        let medical: Decimal
        /// TODO: not collected by the flow yet; assumed $0.
        let childSupportPaid: Decimal

        init(draft: SNAPApplicationDraft) {
            self.householdSize = Self.parseHouseholdSize(draft.household.householdSize)
            // FWS earnings are excluded from SNAP gross income before any deduction math
            // runs, per 7 CFR 273.9(c)(3). Subtract them from gross first so the EID,
            // shelter, and 30%-of-net calculations all operate on the correct base.
            let rawGross = draft.income.grossMonthlyIncome ?? 0
            let fwsExcluded = draft.income.fwsMonthlyAmount ?? 0
            let gross = max(0, rawGross - fwsExcluded)
            self.gross = gross
            self.earnedIncome = Self.resolveEarnedIncome(income: draft.income, gross: gross)
            self.hasElderlyOrDisabled = draft.household.hasElderlyOrDisabled == true
            self.rentOrMortgage = draft.expenses.monthlyRentOrHousing ?? 0
            self.propertyTaxes = 0
            self.homeownersInsurance = 0
            self.actualUtilities = draft.expenses.monthlyUtilities ?? 0
            // T16 Gap #2: read tier from the draft's computed suaTier property
            self.suaTier = draft.expenses.suaTier
            // T16 Gap #8
            self.isUnhoused = draft.whereApplying.housingStatus == .unhoused
            self.dependentCare = draft.expenses.monthlyChildcare ?? 0
            self.medical = draft.expenses.monthlyMedical ?? 0
            self.childSupportPaid = 0
        }

        /// Resolves the earned-income portion of gross from the
        /// draft. Order of precedence:
        ///   1. Explicit dollar amount in `monthlyEarnedAmount`
        ///      (clamped to [0, gross]).
        ///   2. anyoneEarning == .no → $0 earned (all unearned).
        ///   3. anyoneEarning == .yes AND hasUnearnedIncome == .no
        ///      → 100% earned.
        ///   4. Mixed earned + unearned with no split → 100% earned
        ///      (permissive, maximizes the 20% deduction).
        ///   5. Everything else (nil answers) → 100% earned.
        private static func resolveEarnedIncome(
            income: SNAPIncomeAnswers,
            gross: Decimal
        ) -> Decimal {
            if let explicit = income.monthlyEarnedAmount {
                return min(max(0, explicit), gross)
            }
            if income.anyoneEarning == .no {
                return 0
            }
            return gross
        }

        private static func parseHouseholdSize(_ raw: String?) -> Int {
            guard let raw else { return 1 }
            switch raw {
            case "Just me", "Solo yo":          return 1
            case "2 people", "2 personas":       return 2
            case "3 people", "3 personas":       return 3
            case "4 or more", "4 o más":         return 4
            default:                             return 1
            }
        }
    }
}
