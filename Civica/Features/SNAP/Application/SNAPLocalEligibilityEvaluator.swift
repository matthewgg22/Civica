import Foundation

// Local Swift-side eligibility evaluator. Computes a directional
// SNAP verdict from the SNAPApplicationDraft captured by the
// orchestrator, without an HTTP round-trip to the backend rules
// engine.
//
// Behavior is delegated to a SNAPStateRuleEngine selected from
// the applicant's chosen state. The orchestrator stays as a thin
// composer:
//
//   1. Map the draft's localized household-size bucket back to an
//      integer (1, 2, 3, 4) for FPL math.
//   2. Pick the state's rules engine via SNAPRulesRegistry.
//   3. Run the student gate, elderly/disabled BBCE exception,
//      gross-income gate, and expedited screen using values that
//      conformer supplies for the requested `today`.
//   4. Stamp the conformer's policy version into the verdict so
//      SNAPDecisionMathView can render an audit footer.
//
// Trade-off: this is the threshold gate, not the full federal +
// state deduction stack. We don't compute monthly benefit amount;
// we don't apply earned-income / standard / shelter deductions.
// SNAPDecisionMathView renders the verdict header without the
// math section when benefitCalculation is nil. The backend rules
// engine in backend/civic_api/snap/rules/ remains the authoritative
// source when it's wired in.

enum SNAPLocalEligibilityEvaluator {

    static func evaluate(_ draft: SNAPApplicationDraft, today: Date = Date()) -> SNAPEligibilityResult {
        let rules = SNAPRulesRegistry.rules(for: draft.whereApplying.stateCode)
        let householdSize = parseHouseholdSize(draft.household.householdSize)
        let gross = draft.income.grossMonthlyIncome ?? 0
        let hasElderlyOrDisabled = draft.household.hasElderlyOrDisabled == true
        let expedited = evaluateExpedited(draft: draft, rules: rules, today: today)

        var contributingFactors: [String] = [initialFactor(for: rules)]
        if expedited {
            contributingFactors.append("expedited_candidate")
        }

        // Student gate first — categorical disqualifier when
        // half-time enrolled with no qualifying exception.
        switch rules.studentExemption(for: draft, asOf: today) {
        case .categoricallyDisqualified:
            contributingFactors.append("student_no_exception")
            return result(
                status: .ineligible,
                expeditedEligible: expedited,
                contributingFactors: contributingFactors,
                ineligibilityReason: ineligibilityReasonStudent,
                rules: rules,
                today: today
            )
        case .exempted(let reason):
            // Match the pre-refactor factor only for the federal
            // exception reasons. Less-than-half-time / state-specific
            // reasons fall through silently to preserve today's
            // contributingFactors output for MA.
            switch reason {
            case .worksTwentyHoursPerWeek,
                 .workStudy,
                 .dependentChildCare,
                 .under18OrOver50,
                 .stateSpecific:
                contributingFactors.append("student_exception_met")
            case .lessThanHalfTime:
                break
            }
        case .notSubject, .unknown:
            break
        }

        // Elderly/disabled households are categorically eligible
        // under MA BBCE regardless of gross income. Federally,
        // elderly/disabled are exempt from the gross-income test
        // but still need to pass net-income — since this thin
        // gate doesn't compute net income, the permissive verdict
        // is honest for both jurisdictions: directional eligible,
        // backend confirms benefit amount.
        if hasElderlyOrDisabled {
            contributingFactors.append("elderly_or_disabled_in_household")
            return result(
                status: .eligible,
                expeditedEligible: expedited,
                contributingFactors: contributingFactors,
                ineligibilityReason: nil,
                rules: rules,
                today: today
            )
        }

        let threshold = rules.grossIncomeLimit(householdSize: householdSize, asOf: today)
        if gross <= threshold {
            contributingFactors.append(grossUnderFactor(for: rules))
            return result(
                status: .eligible,
                expeditedEligible: expedited,
                contributingFactors: contributingFactors,
                ineligibilityReason: nil,
                rules: rules,
                today: today
            )
        } else {
            contributingFactors.append(grossOverFactor(for: rules))
            return result(
                status: .ineligible,
                expeditedEligible: expedited,
                contributingFactors: contributingFactors,
                ineligibilityReason: ineligibilityReasonIncome(
                    gross: gross,
                    threshold: threshold,
                    rules: rules,
                    householdSize: householdSize
                ),
                rules: rules,
                today: today
            )
        }
    }

    // MARK: - Expedited service detection (7 CFR 273.2(i))

    /// Three federal gates parametrized by the active rules
    /// engine's `expeditedCriteria(asOf:)`. The app does not
    /// collect liquid resources today, so the gate-1 floor
    /// conservatively assumes resources = $0 — under-detecting
    /// expedited eligibility silently costs a family weeks of
    /// benefits, over-detecting just prompts DTA verification.
    private static func evaluateExpedited(
        draft: SNAPApplicationDraft,
        rules: SNAPStateRuleEngine,
        today: Date
    ) -> Bool {
        let gross = draft.income.grossMonthlyIncome ?? 0
        let rent = draft.expenses.monthlyRentOrHousing ?? 0
        let utilities = draft.expenses.monthlyUtilities ?? 0
        let criteria = rules.expeditedCriteria(asOf: today)

        if gross < criteria.grossIncomeUnder { return true }
        if criteria.rentPlusUtilitiesGate && (rent + utilities) > gross { return true }
        return false
    }

    // MARK: - Helpers

    /// Maps the bucket label from the household flow back to an
    /// integer 1-4. Matches both English and Spanish labels so the
    /// evaluator works in both languages without coupling to the
    /// active locale at evaluation time.
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

    /// MA preserves the pre-refactor "ma_bbce_200pct_applied" tag
    /// bit-for-bit so existing audit trails stay consistent.
    /// Other states emit a parallel federal-default tag.
    private static func initialFactor(for rules: SNAPStateRuleEngine) -> String {
        rules.stateCode == "MA" ? "ma_bbce_200pct_applied" : "federal_default_applied"
    }

    private static func grossUnderFactor(for rules: SNAPStateRuleEngine) -> String {
        rules.stateCode == "MA" ? "gross_under_200_fpl" : "gross_under_federal_limit"
    }

    private static func grossOverFactor(for rules: SNAPStateRuleEngine) -> String {
        rules.stateCode == "MA" ? "gross_over_200_fpl" : "gross_over_federal_limit"
    }

    private static func result(
        status: SNAPEligibilityStatus,
        expeditedEligible: Bool,
        contributingFactors: [String],
        ineligibilityReason: String?,
        rules: SNAPStateRuleEngine,
        today: Date
    ) -> SNAPEligibilityResult {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return SNAPEligibilityResult(
            status: status,
            monthlyBenefit: nil,
            expeditedEligible: expeditedEligible,
            contributingFactors: contributingFactors,
            requiredVerifications: defaultRequiredVerifications,
            benefitCalculation: nil,
            ineligibilityReason: ineligibilityReason,
            effectiveDate: formatter.string(from: today),
            rulesVersion: rules.rulesVersion(asOf: today)
        )
    }

    // MARK: - Stock messages

    private static let ineligibilityReasonStudent = """
        Most college students don't qualify for SNAP unless they meet a specific exception — \
        working at least 20 hours a week, federal or state work-study, or caring for a child.
        """

    /// MA-specific wording is preserved for "Massachusetts's $X
    /// limit"; non-MA states get the parallel federal phrasing.
    private static func ineligibilityReasonIncome(
        gross: Decimal,
        threshold: Decimal,
        rules: SNAPStateRuleEngine,
        householdSize: Int
    ) -> String {
        let grossStr = NSDecimalNumber(decimal: gross).stringValue
        let thresholdStr = NSDecimalNumber(decimal: threshold).stringValue
        let scope = rules.stateCode == "MA" ? "Massachusetts's" : "the federal"
        return """
            Based on your monthly income of $\(grossStr) and a household of \(householdSize), \
            you appear to be over \(scope) $\(thresholdStr)/month limit. \
            If your income drops or your household grows, reapply right away.
            """
    }

    /// Stock list of verifications a SNAP applicant typically
    /// needs at the time of submission. Sourced from MA DTA's
    /// application checklist; close enough to a federal floor
    /// for non-MA states until per-state lists are wired in.
    /// The backend rules engine returns a more precise list per
    /// household.
    private static let defaultRequiredVerifications: [SNAPRequiredVerification] = [
        .init(
            code: "photo_id",
            labelEn: "Photo ID",
            labelEs: "Identificación con foto",
            explanationEn: "Driver's license, state ID, or passport.",
            explanationEs: "Licencia de conducir, identificación estatal o pasaporte.",
            isRequiredForInitialApplication: true,
            canBePostponedForExpedited: false
        ),
        .init(
            code: "proof_of_income",
            labelEn: "Recent paystubs or proof of income",
            labelEs: "Talones de pago recientes o prueba de ingresos",
            explanationEn: "Last 4 weeks of paystubs, or a signed letter from your employer.",
            explanationEs: "Talones de pago de las últimas 4 semanas, o una carta firmada de tu empleador.",
            isRequiredForInitialApplication: true,
            canBePostponedForExpedited: true
        ),
        .init(
            code: "proof_of_residency",
            labelEn: "Proof of where you live",
            labelEs: "Prueba de donde vives",
            explanationEn: "Lease, mail, or a recent utility bill with your name and address.",
            explanationEs: "Contrato de renta, correo o un recibo reciente con tu nombre y dirección.",
            isRequiredForInitialApplication: true,
            canBePostponedForExpedited: true
        )
    ]
}
