import CivicaDesignSystem
import SwiftUI

// HANDOFF MobilePendingBoard panel 3 + DecisionApprovedBoard:
// "You're approved." A calm landing, not a celebration screen.
//
// The board's brief: "Approval does not end the relationship --
// recert reminder is set the same day." So this surface does four
// things, in order:
//
//   1. Name the decision plainly ("You're approved.").
//   2. Show the monthly benefit amount (or, if Civica only has the
//      local estimate, say so and point at DTA Connect for the
//      official letter).
//   3. Set the recertification reminder forward 12 months -- the
//      relationship continues.
//   4. Surface the cross-program teaser (WIC for kids under 5) so
//      the user knows there's more available.
//
// Routed from CivicaRootView when status == .decisionApproved.
// Replaces the previous routing to SNAPWaitingRoomView, which
// rendered an "agency reviewing" timeline for users whose case
// was already decided.

struct SNAPDecisionApprovedView: View {
    @ObservedObject var statusStore: SNAPApplicationStatusStore
    let language: CivicaLanguage
    /// Pre-loaded draft for the cross-program teaser gate. Nil means
    /// the teaser doesn't render -- the user signed in without going
    /// through the orchestrator (unusual, but defensible fallback).
    let draft: SNAPApplicationDraft?
    let onOpenDTAConnect: () -> Void
    let onOpenWICTeaser: () -> Void
    let onStartOver: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                monthlyAwardCard
                recertReminderCard
                if let restaurantMealsCallout {
                    restaurantMealsCallout
                }
                if let produceMatchCallout {
                    produceMatchCallout
                }
                if showsWICTeaser {
                    wicCard
                }
                startOverFooter
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Restaurant Meals Program callout (CA only today)

    /// Renders an informational card when the active state operates
    /// the Restaurant Meals Program and the household qualifies
    /// (elderly, disabled, or unhoused). Suppressed entirely
    /// otherwise — no card for non-RMP states, no card when the
    /// screener hasn't collected enough info, no card when the
    /// household doesn't qualify.
    @ViewBuilder
    private var restaurantMealsCallout: (some View)? {
        if let draft,
           case .eligible(let reasons) = SNAPRulesRegistry
            .rules(for: draft.whereApplying.stateCode)
            .restaurantMealsProgramEligibility(for: draft, asOf: Date()) {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(language == .english ? "Restaurant Meals Program" : "Programa de Comidas en Restaurantes")
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(restaurantMealsBody(reasons: reasons, language: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.brickPrimary.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        }
    }

    private func restaurantMealsBody(
        reasons: [RestaurantMealsEligibility.Reason],
        language: CivicaLanguage
    ) -> String {
        let reasonPhrase = restaurantMealsReasonPhrase(reasons: reasons, language: language)
        switch language {
        case .english:
            return "Because \(reasonPhrase), your EBT card can also be used at participating restaurants for hot prepared meals. Look for the Restaurant Meals Program decal at the door — the FindHelp map will list participating spots when it's tuned for your county."
        case .spanish:
            return "Porque \(reasonPhrase), tu tarjeta EBT también puede usarse en restaurantes participantes para comidas calientes preparadas. Busca la calcomanía del Programa de Comidas en Restaurantes en la puerta — el mapa de Buscar Ayuda mostrará los lugares participantes cuando esté ajustado para tu condado."
        }
    }

    private func restaurantMealsReasonPhrase(
        reasons: [RestaurantMealsEligibility.Reason],
        language: CivicaLanguage
    ) -> String {
        if reasons.contains(.unhoused) {
            return language == .english
                ? "your household reports unhoused status"
                : "tu hogar reporta estar sin vivienda"
        }
        if reasons.contains(.disabled) {
            return language == .english
                ? "someone in your household is elderly or disabled"
                : "alguien en tu hogar es de edad avanzada o tiene una discapacidad"
        }
        return language == .english
            ? "your household qualifies"
            : "tu hogar califica"
    }

    // MARK: - Produce-match callout (CA: Market Match; MA: HIP)

    /// Renders a calm informational card when the active state
    /// operates a SNAP-EBT produce-doubling program — CalFresh's
    /// Market Match, DTA's HIP, etc. Suppressed entirely when the
    /// state has none Civica is tuned for, so non-tuned states
    /// don't see a stub.
    @ViewBuilder
    private var produceMatchCallout: (some View)? {
        if let description = SNAPAgencyDirectory.produceMatchDescription(
            for: draft?.whereApplying.stateCode,
            language: language
        ),
           let program = SNAPAgencyDirectory.produceMatchProgram(
            for: draft?.whereApplying.stateCode
           ) {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(program.name)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(description)
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.accentTeal.opacity(0.10))
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            HStack(spacing: CivicaSpacing.xs) {
                Circle()
                    .fill(CivicaColors.accentTeal)
                    .frame(width: 8, height: 8)
                Text(SNAPDecisionApprovedStrings.approvedBadge.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.accentTeal)
                    .textCase(.uppercase)
                    .kerning(1.2)
            }
            if let decided = decidedOnLine {
                Text(decided)
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)
                    .padding(.top, CivicaSpacing.xs)
            }
            Text(SNAPDecisionApprovedStrings.headline.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .accessibilityAddTraits(.isHeader)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Cards

    private var monthlyAwardCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPDecisionApprovedStrings.monthlyAwardLabel.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            if let amount = statusStore.eligibilityResult?.monthlyBenefit {
                CivicaMoney(
                    amount: amount,
                    denominator: language == .spanish ? "mes" : "mo",
                    font: CivicaTypography.cardHero
                )
                .foregroundStyle(CivicaColors.ink)
            } else {
                Text(SNAPDecisionApprovedStrings.amountFallback(
                    stateCode: draft?.whereApplying.stateCode,
                    language: language
                ))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text(ebtTimingBody)
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, CivicaSpacing.xs)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private var recertReminderCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPDecisionApprovedStrings.recertLabel.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(recertBody)
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
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private var wicCard: some View {
        Button(action: onOpenWICTeaser) {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(SNAPDecisionApprovedStrings.wicTitle.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.accentTeal)
                    .fixedSize(horizontal: false, vertical: true)
                Text(SNAPDecisionApprovedStrings.wicBody.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.accentTeal, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(SNAPDecisionApprovedStrings.wicTitle.value(in: language)). \(SNAPDecisionApprovedStrings.wicBody.value(in: language))")
    }

    private var startOverFooter: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Button(action: onOpenDTAConnect) {
                Text(SNAPDecisionApprovedStrings.openDTAConnect.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.brickPrimary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, CivicaSpacing.md)
                    .background(CivicaColors.surfacePrimary)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.control)
                            .strokeBorder(CivicaColors.brickPrimary, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)

            Button(action: onStartOver) {
                Text(SNAPDecisionApprovedStrings.startOver.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, CivicaSpacing.xs)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Derived

    private var showsWICTeaser: Bool {
        draft?.household.hasMinorInHousehold == true
    }

    private var decidedOnLine: String? {
        guard let decidedAt = statusStore.timestamp(for: .decisionApproved) else {
            return nil
        }
        let formatter = DateFormatter()
        formatter.locale = language == .spanish ? Locale(identifier: "es") : Locale(identifier: "en_US")
        formatter.dateFormat = language == .spanish ? "d 'de' MMM" : "MMM d"
        let prefix = SNAPDecisionApprovedStrings.decidedOn.value(in: language)
        return "\(prefix) · \(formatter.string(from: decidedAt))"
    }

    private var ebtTimingBody: String {
        guard let decidedAt = statusStore.timestamp(for: .decisionApproved) else {
            return SNAPDecisionApprovedStrings.ebtTimingFallback.value(in: language)
        }
        let calendar = Calendar.current
        let mailedDate = calendar.date(byAdding: .day, value: 1, to: decidedAt) ?? decidedAt
        let earliestArrival = calendar.date(byAdding: .day, value: 4, to: decidedAt) ?? decidedAt
        let latestArrival = calendar.date(byAdding: .day, value: 8, to: decidedAt) ?? decidedAt

        let formatter = DateFormatter()
        formatter.locale = language == .spanish ? Locale(identifier: "es") : Locale(identifier: "en_US")
        formatter.dateFormat = language == .spanish ? "d 'de' MMM" : "MMM d"

        let template = SNAPDecisionApprovedStrings.ebtTimingTemplate.value(in: language)
        return template
            .replacingOccurrences(of: "{mailed}", with: formatter.string(from: mailedDate))
            .replacingOccurrences(of: "{earliest}", with: formatter.string(from: earliestArrival))
            .replacingOccurrences(of: "{latest}", with: formatter.string(from: latestArrival))
    }

    private var recertBody: String {
        guard let decidedAt = statusStore.timestamp(for: .decisionApproved) else {
            return SNAPDecisionApprovedStrings.recertBodyFallback.value(in: language)
        }
        let calendar = Calendar.current
        let recertDate = calendar.date(byAdding: .month, value: 12, to: decidedAt) ?? decidedAt
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .none
        formatter.locale = language == .spanish ? Locale(identifier: "es") : Locale(identifier: "en_US")
        let template = SNAPDecisionApprovedStrings.recertBodyTemplate.value(in: language)
        return template.replacingOccurrences(of: "{date}", with: formatter.string(from: recertDate))
    }
}

// MARK: - Strings

enum SNAPDecisionApprovedStrings {

    static let approvedBadge = CivicaText(
        "Approved",
        es: "Aprobado"
    )
    static let decidedOn = CivicaText(
        "Decided",
        es: "Decidido"
    )
    static let headline = CivicaText(
        "You're approved.",
        es: "Estás aprobada."
    )

    static let monthlyAwardLabel = CivicaText(
        "Monthly award",
        es: "Beneficio mensual"
    )
    static func amountFallback(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalEN = portal.isEmpty ? "your state portal" : portal
        let portalES = portal.isEmpty ? "el portal estatal" : portal
        switch language {
        case .english:
            return "\(agency)'s official letter has your monthly amount. Open \(portalEN) to see it."
        case .spanish:
            return "La carta oficial de \(agency) tiene tu cantidad mensual. Abre \(portalES) para verla."
        }
    }
    /// {mailed} / {earliest} / {latest} substituted with localized date
    /// strings. Window assumes EBT card is mailed the day after the
    /// decision and arrives 3–7 business days later (MA standard).
    static let ebtTimingTemplate = CivicaText(
        "EBT card mailed {mailed} · expect {earliest}–{latest}.",
        es: "Tarjeta EBT enviada el {mailed} · llega entre {earliest}–{latest}."
    )
    static let ebtTimingFallback = CivicaText(
        "Your EBT card is mailed within a few days of approval. Most arrive within a week.",
        es: "Tu tarjeta EBT se envía pocos días después de la aprobación. La mayoría llegan en una semana."
    )

    static let recertLabel = CivicaText(
        "Mark your calendar",
        es: "Marca tu calendario"
    )
    /// {date} substituted with a long-form localized date.
    static let recertBodyTemplate = CivicaText(
        "Recertification due {date}. We'll remind you 60 and 14 days before.",
        es: "Recertificación el {date}. Te recordaremos 60 y 14 días antes."
    )
    static let recertBodyFallback = CivicaText(
        "Recertification happens once a year. We'll remind you 60 and 14 days before yours is due.",
        es: "La recertificación ocurre una vez al año. Te recordaremos 60 y 14 días antes de la tuya."
    )

    static let wicTitle = CivicaText(
        "Now check WIC and school meals.",
        es: "Ahora revisa WIC y comidas escolares."
    )
    static let wicBody = CivicaText(
        "Your household likely qualifies for both. Vouchers for kids under 5 plus free breakfast and lunch at school.",
        es: "Tu hogar probablemente califica para ambos. Vales para niños menores de 5 más desayuno y almuerzo gratis en la escuela."
    )

    static let openDTAConnect = CivicaText(
        "Open DTA Connect",
        es: "Abrir DTA Connect"
    )
    static let startOver = CivicaText(
        "Reset Civica and start fresh",
        es: "Reiniciar Civica y empezar de nuevo"
    )
}

#if DEBUG
struct SNAPDecisionApprovedView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        let store = SNAPApplicationStatusStore()
        store.advance(to: .decisionApproved)
        return NavigationStack {
            SNAPDecisionApprovedView(
                statusStore: store,
                language: .english,
                draft: nil,
                onOpenDTAConnect: {},
                onOpenWICTeaser: {},
                onStartOver: {}
            )
        }
    }
}
#endif
