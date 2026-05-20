import CivicaDesignSystem
import SwiftUI

// HANDOFF DecisionPartialBoard — "Three things that could change
// this." Surfaces personalized levers below the math section of the
// decision view when the user's benefit could realistically grow
// (eligible with missing deductions, eligible-with-conditions, or
// insufficient-information).
//
// Brand-voice rule from the canvas board: "The category default is
// to celebrate any approval. Civica's job is to make sure you got
// the right amount." So the levers are framed as opportunities,
// not corrections — "add a receipt to recalculate," not "you
// underreported."
//
// Levers are personalized off the SNAPApplicationDraft:
//   • Childcare costs        — when household has minors but no childcare reported
//   • Medical costs          — when household has 60+/disabled but no medical reported
//   • Rent increases         — universal; always shown
//   • Income changes         — universal; always shown
//
// When the draft isn't available (e.g., the decision view is
// reached from the returning-user-home and the orchestrator's
// in-memory draft is gone), the personalized levers fall back to
// generic copy.

struct SNAPDecisionLeversView: View {
    let result: SNAPEligibilityResult
    let draft: SNAPApplicationDraft?
    let language: CivicaLanguage

    /// Whether this view has any levers worth surfacing for the
    /// given result. Caller can short-circuit when there are none.
    static func shouldRender(for result: SNAPEligibilityResult) -> Bool {
        switch result.status {
        case .eligible, .eligibleWithConditions, .insufficientInformation:
            return true
        case .ineligible:
            // Even denied applicants benefit from knowing what could
            // flip the verdict — show levers in case income drops or
            // household changes mean they should reapply.
            return true
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(SNAPDecisionLeversStrings.heading.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            VStack(spacing: CivicaSpacing.md) {
                ForEach(Array(visibleLevers.enumerated()), id: \.offset) { _, lever in
                    leverCard(lever)
                }
            }
            if let amount = result.monthlyBenefit, amount > 0 {
                thriftyPlanFooter(amount: amount)
            }
        }
    }

    // MARK: - Lever modeling

    private struct Lever: Identifiable {
        let id: String
        let title: String
        let body: String
        let estimate: String?
        /// True when the lever is the highest-priority recommendation
        /// for this user (personalized to the draft). Renders with
        /// the brick accent border; others render in graphite.
        let isPrioritized: Bool
    }

    private var visibleLevers: [Lever] {
        var levers: [Lever] = []

        // Personalized levers — leading position when draft surfaces
        // a clear deduction the user hasn't reported.
        if let childcare = childcareLever() { levers.append(childcare) }
        if let medical = medicalLever() { levers.append(medical) }

        // Universal levers — always surface so the user knows what
        // can change the verdict over time. Capped at three total
        // visible levers to keep the screen scannable.
        levers.append(rentLever())
        if levers.count < 3 {
            levers.append(incomeLever())
        }

        return Array(levers.prefix(3))
    }

    private func childcareLever() -> Lever? {
        guard let draft else { return nil }
        let hasMinors = draft.household.hasMinorInHousehold == true
        let reportedChildcare = draft.expenses.monthlyChildcare ?? 0
        guard hasMinors && reportedChildcare == 0 else { return nil }
        return Lever(
            id: "childcare",
            title: SNAPDecisionLeversStrings.childcareTitle.value(in: language),
            body: SNAPDecisionLeversStrings.childcareBody.value(in: language),
            estimate: SNAPDecisionLeversStrings.childcareEstimate.value(in: language),
            isPrioritized: true
        )
    }

    private func medicalLever() -> Lever? {
        guard let draft else { return nil }
        let elderlyOrDisabled = draft.household.hasElderlyOrDisabled == true
        let reportedMedical = draft.expenses.monthlyMedical ?? 0
        guard elderlyOrDisabled && reportedMedical == 0 else { return nil }
        return Lever(
            id: "medical",
            title: SNAPDecisionLeversStrings.medicalTitle.value(in: language),
            body: SNAPDecisionLeversStrings.medicalBody.value(in: language),
            estimate: SNAPDecisionLeversStrings.medicalEstimate.value(in: language),
            isPrioritized: true
        )
    }

    private func rentLever() -> Lever {
        Lever(
            id: "rent",
            title: SNAPDecisionLeversStrings.rentTitle.value(in: language),
            body: SNAPDecisionLeversStrings.rentBody.value(in: language),
            estimate: nil,
            isPrioritized: false
        )
    }

    private func incomeLever() -> Lever {
        Lever(
            id: "income",
            title: SNAPDecisionLeversStrings.incomeTitle.value(in: language),
            body: SNAPDecisionLeversStrings.incomeBody.value(in: language),
            estimate: nil,
            isPrioritized: false
        )
    }

    // MARK: - Lever card

    private func leverCard(_ lever: Lever) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            HStack(alignment: .firstTextBaseline) {
                Text(lever.title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(lever.isPrioritized ? CivicaColors.pinePrimary : CivicaColors.ink)
                Spacer(minLength: CivicaSpacing.sm)
                if let estimate = lever.estimate {
                    Text(estimate)
                        .font(CivicaTypography.footnoteStrong.monospacedDigit())
                        .foregroundStyle(lever.isPrioritized ? CivicaColors.pinePrimary : CivicaColors.graphite)
                }
            }
            Text(lever.body)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(
                    lever.isPrioritized ? CivicaColors.pinePrimary : CivicaColors.hairline,
                    lineWidth: lever.isPrioritized ? 2 : 1
                )
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(lever.title). \(lever.body)")
    }

    // MARK: - Thrifty Food Plan footer
    //
    // The canvas board footer ties the benefit amount to a real-world
    // food cost number ("covers about 70% of monthly groceries").
    // Civica doesn't compute the per-meal cost (which depends on
    // USDA Thrifty Food Plan tables that vary by household size +
    // age composition), so this is generic + honest at v1.

    private func thriftyPlanFooter(amount: Decimal) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: "basket.fill")
                .foregroundStyle(CivicaColors.accentTeal)
                .accessibilityHidden(true)
            Text(SNAPDecisionLeversStrings.thriftyFootnote.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.md)
        .background(CivicaColors.accentTeal.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }
}

// MARK: - Strings

enum SNAPDecisionLeversStrings {

    static let heading = CivicaText(
        "Three things that could change this",
        es: "Tres cosas que podrían cambiar esto"
    )

    // Personalized levers — childcare
    static let childcareTitle = CivicaText(
        "Childcare costs",
        es: "Costos de cuidado infantil"
    )
    static let childcareBody = CivicaText(
        "You have a child in the household but didn't report childcare costs. Daycare, after-school programs, or anything you pay out of pocket for child care is deductible — add a receipt next time and your benefit goes up.",
        es: "Tienes un menor en el hogar pero no reportaste costos de cuidado infantil. La guardería, programas extraescolares, o cualquier cosa que pagues de tu bolsillo por cuidado infantil es deducible — añade un recibo la próxima vez y tu beneficio aumenta."
    )
    static let childcareEstimate = CivicaText(
        "+ up to $44/mo",
        es: "+ hasta $44/mes"
    )

    // Personalized levers — medical (for elderly / disabled)
    static let medicalTitle = CivicaText(
        "Out-of-pocket medical costs",
        es: "Gastos médicos de tu bolsillo"
    )
    static let medicalBody = CivicaText(
        "Someone in your household is 60+ or has a disability. Co-pays, prescriptions, dental, and insurance premiums over $35/mo are deductible. Many people miss this — keep receipts and add them next time.",
        es: "Alguien en tu hogar tiene 60 años o más o vive con una discapacidad. Los copagos, recetas, dentista y primas de seguro mayores a $35/mes son deducibles. Muchas personas omiten esto — guarda los recibos y añádelos la próxima vez."
    )
    static let medicalEstimate = CivicaText(
        "+ variable",
        es: "+ variable"
    )

    // Universal levers — rent
    static let rentTitle = CivicaText(
        "Higher rent or utilities",
        es: "Renta o servicios más altos"
    )
    static let rentBody = CivicaText(
        "If your rent or utility bill goes up, report it to DTA within 10 days. Your monthly award is recalculated.",
        es: "Si tu renta o factura de servicios aumenta, repórtalo al DTA en 10 días. Tu beneficio mensual se recalcula."
    )

    // Universal levers — income
    static let incomeTitle = CivicaText(
        "Income drops",
        es: "Tus ingresos bajan"
    )
    static let incomeBody = CivicaText(
        "Hours got cut, lost a job, or moved to a lower-paying role? Report it. Your award is recalculated within 30 days.",
        es: "¿Te redujeron las horas, perdiste un trabajo o tomaste un trabajo de menor sueldo? Repórtalo. Tu beneficio se recalcula en 30 días."
    )

    static let thriftyFootnote = CivicaText(
        "SNAP benefit amounts are calibrated to the USDA Thrifty Food Plan — they're sized to cover a household's grocery costs for a low-cost, nutritionally adequate diet.",
        es: "Los montos de SNAP están calibrados al Plan de Alimentos Económicos del USDA — están dimensionados para cubrir los costos de comestibles de un hogar para una dieta de bajo costo y nutricionalmente adecuada."
    )
}
