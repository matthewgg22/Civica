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
//   * Standard Utility Allowance tier defaults to .heatingCooling
//     for MA when the household reports nonzero utilities;
//     effective utility cost is max(actual_utilities, SUA_value)
//     so SUA-eligible households can't lose deduction by reporting
//     low actuals. A household that reports $0 utilities gets no
//     SUA deduction (SUA is a substitution, not an additive
//     phantom).
//   * Medical expenses count only when the household has an elderly
//     or disabled member, and only the portion above $35 (7 CFR
//     273.9(d)(3)).
//
// Rounding: federal rules round to whole dollars at specific math
// steps using "round half away from zero" (Python's ROUND_HALF_UP);
// Swift's NSDecimalRound .plain mode matches that on positive
// values.

enum SNAPBenefitCalculator {

    /// Default SUA tier when the flow doesn't yet ask the user.
    /// Heating/cooling is the most permissive row for MA.
    static let defaultSUATier: SUATier = .heatingCooling

    /// Computes a full itemized benefit calculation for the
    /// draft against the active rules engine. Returns nil only
    /// when household size cannot be parsed (degenerate input);
    /// otherwise always returns a detail -- a zero benefit is a
    /// valid result, not an error.
    static func calculate(
        draft: SNAPApplicationDraft,
        rules: SNAPStateRuleEngine,
        today: Date
    ) -> SNAPBenefitCalculationDetail {
        let inputs = Inputs(draft: draft, suaTier: defaultSUATier)
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

        // Effective utility cost: SUA is a *substitution* for
        // itemized utility costs, not an additive phantom. A
        // household with zero reported utilities does not get an
        // SUA deduction (they declared they have no utility cost).
        // When the user reported nonzero utilities, the SUA tier
        // substitutes the larger of actuals and the state SUA value.
        let effectiveUtility: Decimal
        if inputs.actualUtilities <= 0 {
            effectiveUtility = 0
        } else if let sua = rules.suaValue(tier: inputs.suaTier, asOf: today) {
            effectiveUtility = max(inputs.actualUtilities, sua)
        } else {
            effectiveUtility = inputs.actualUtilities
        }

        let shelterCosts = inputs.rentOrMortgage
            + inputs.propertyTaxes
            + inputs.homeownersInsurance
            + effectiveUtility

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
        let suaTier: SUATier
        let dependentCare: Decimal
        let medical: Decimal
        /// TODO: not collected by the flow yet; assumed $0.
        let childSupportPaid: Decimal

        init(draft: SNAPApplicationDraft, suaTier: SUATier) {
            self.householdSize = Self.parseHouseholdSize(draft.household.householdSize)
            let gross = draft.income.grossMonthlyIncome ?? 0
            self.gross = gross
            self.earnedIncome = Self.resolveEarnedIncome(income: draft.income, gross: gross)
            self.hasElderlyOrDisabled = draft.household.hasElderlyOrDisabled == true
            self.rentOrMortgage = draft.expenses.monthlyRentOrHousing ?? 0
            self.propertyTaxes = 0
            self.homeownersInsurance = 0
            self.actualUtilities = draft.expenses.monthlyUtilities ?? 0
            self.suaTier = suaTier
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
