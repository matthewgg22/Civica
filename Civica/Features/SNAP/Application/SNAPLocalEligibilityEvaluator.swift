import Foundation

// Local Swift-side eligibility evaluator. Computes a directional
// SNAP verdict from the SNAPApplicationDraft captured by the
// orchestrator, without an HTTP round-trip to the backend rules
// engine. Three jobs:
//
//   1. Map the draft's localized household-size bucket back to an
//      integer (1, 2, 3, 4) for FPL math.
//   2. Apply Massachusetts BBCE — most households qualify
//      categorically up to 200% of FY26 federal poverty guidelines,
//      with no asset test.
//   3. Check the SNAP student gate (7 CFR 273.5) — enrolled in
//      higher-ed at least half-time AND no exception (20+ hr/wk
//      work, work-study, dependent child) is a categorical
//      disqualifier even when income passes.
//
// Trade-off: this is the threshold gate, not the full federal +
// state deduction stack. We don't compute monthly benefit amount;
// we don't apply earned-income / standard / shelter deductions.
// SNAPDecisionMathView renders the verdict header without the math
// section when benefitCalculation is nil. The backend rules engine
// in backend/civic_api/snap/rules/ remains the authoritative source
// when it's wired in.
//
// Effective dates: FY26 federal poverty guidelines apply 10/01/2025
// through 09/30/2026. Rules version stamp lets the math view show
// the user which guideline cycle drove the verdict.

enum SNAPLocalEligibilityEvaluator {

    /// 200% of FY26 federal poverty guideline monthly income, the
    /// Massachusetts BBCE gross income gate. Index 0 unused;
    /// index 1-4 = household size. For 4+ households we use the
    /// size-4 threshold as a conservative floor (the real threshold
    /// for size 5+ is higher, so this can only under-estimate
    /// eligibility, not over-estimate it).
    private static let ma200FplMonthly: [Decimal] = [
        0,        // unused
        2_510,    // 1 person: $1,255 × 200%
        3_408,    // 2 person: $1,704 × 200%
        4_304,    // 3 person: $2,152 × 200%
        5_200     // 4 person: $2,600 × 200%
    ]

    private static let rulesVersionStamp = "local-eval-FY26/MA-bbce-200pct"

    static func evaluate(_ draft: SNAPApplicationDraft, today: Date = Date()) -> SNAPEligibilityResult {
        let householdSize = parseHouseholdSize(draft.household.householdSize)
        let gross = draft.income.grossMonthlyIncome ?? 0
        let hasElderlyOrDisabled = draft.household.hasElderlyOrDisabled == true

        var contributingFactors: [String] = ["ma_bbce_200pct_applied"]

        // Student gate first — categorical disqualifier when no
        // exception. Yes / no on enrolled-in-higher-ed gates this
        // entire branch; not-answered defers (insufficient info).
        if draft.studentStatus.enrolledInHigherEd == true {
            let halfTime = draft.studentStatus.enrolledHalfTime == true
            if halfTime {
                let hasException =
                    draft.studentStatus.works20PlusHours == true
                    || draft.studentStatus.inWorkStudy == true
                    || draft.studentStatus.responsibleForDependentChild == true
                if !hasException {
                    contributingFactors.append("student_no_exception")
                    return result(
                        status: .ineligible,
                        contributingFactors: contributingFactors,
                        ineligibilityReason: ineligibilityReasonStudent,
                        today: today
                    )
                } else {
                    contributingFactors.append("student_exception_met")
                }
            }
        }

        // Income gate — MA BBCE at 200% FPL. Elderly/disabled
        // households are categorically eligible under BBCE even
        // above this gate, so we flag them as eligible regardless
        // of gross income for the verdict surface. The full federal
        // rules engine computes their net-income test for benefit
        // amount; the threshold gate is permissive on purpose.
        if hasElderlyOrDisabled {
            contributingFactors.append("elderly_or_disabled_in_household")
            return result(
                status: .eligible,
                contributingFactors: contributingFactors,
                ineligibilityReason: nil,
                today: today
            )
        }

        let threshold = ma200FplMonthly[householdSize]
        if gross <= threshold {
            contributingFactors.append("gross_under_200_fpl")
            return result(
                status: .eligible,
                contributingFactors: contributingFactors,
                ineligibilityReason: nil,
                today: today
            )
        } else {
            contributingFactors.append("gross_over_200_fpl")
            return result(
                status: .ineligible,
                contributingFactors: contributingFactors,
                ineligibilityReason: ineligibilityReasonIncome(
                    gross: gross,
                    threshold: threshold,
                    householdSize: householdSize
                ),
                today: today
            )
        }
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

    private static func result(
        status: SNAPEligibilityStatus,
        contributingFactors: [String],
        ineligibilityReason: String?,
        today: Date
    ) -> SNAPEligibilityResult {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return SNAPEligibilityResult(
            status: status,
            monthlyBenefit: nil,
            expeditedEligible: false,
            contributingFactors: contributingFactors,
            requiredVerifications: defaultRequiredVerifications,
            benefitCalculation: nil,
            ineligibilityReason: ineligibilityReason,
            effectiveDate: formatter.string(from: today),
            rulesVersion: rulesVersionStamp
        )
    }

    // MARK: - Stock messages

    private static let ineligibilityReasonStudent = """
        Most college students don't qualify for SNAP unless they meet a specific exception — \
        working at least 20 hours a week, federal or state work-study, or caring for a child.
        """

    private static func ineligibilityReasonIncome(
        gross: Decimal,
        threshold: Decimal,
        householdSize: Int
    ) -> String {
        let grossStr = NSDecimalNumber(decimal: gross).stringValue
        let thresholdStr = NSDecimalNumber(decimal: threshold).stringValue
        return """
            Based on your monthly income of $\(grossStr) and a household of \(householdSize), \
            you appear to be over Massachusetts's $\(thresholdStr)/month limit. \
            If your income drops or your household grows, reapply right away.
            """
    }

    /// Stock list of verifications a Massachusetts SNAP applicant
    /// typically needs at the time of submission. Sourced from the
    /// MA DTA application checklist; the backend rules engine
    /// returns a more precise list per household — this is the
    /// "what you'll need" floor.
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
