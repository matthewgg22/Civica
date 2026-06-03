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

    @EnvironmentObject private var enrollmentAuth: CivicaEnrollmentAuth
    /// Resolved on appear; used to wire WorkHoursLogView for §10102 subjects.
    @State private var activePacketId: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                monthlyAwardCard
                recertReminderCard
                if let packetId = activePacketId {
                    workHoursCard(packetId: packetId)
                }
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
        .task { await resolveActivePacket() }
    }

    // MARK: - Work hours card (§10102)

    /// Tappable card navigating to WorkHoursLogView. Only rendered once
    /// the active packetId is resolved. The work-hours view handles its
    /// own not-subject / not-yet-evaluated states gracefully.
    private func workHoursCard(packetId: String) -> some View {
        NavigationLink {
            WorkHoursLogView(
                packetId: packetId,
                apiClient: enrollmentAuth.makeEnrollmentAPIClient()
            )
        } label: {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(workHoursTitle)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(workHoursBody)
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
                    .strokeBorder(CivicaColors.pinePrimary, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(workHoursAccessibilityLabel)
    }

    private var workHoursTitle: String {
        switch language {
        case .english, .vietnamese, .tagalog:
            return "Track Your Work Hours"
        case .spanish:
            return "Registra tus horas laborales"
        case .mandarin:
            return "记录你的工作时长"
        }
    }

    private var workHoursBody: String {
        switch language {
        case .english, .vietnamese, .tagalog:
            return "If you're subject to CalFresh work requirements, log your monthly hours and attach pay stubs here."
        case .spanish:
            return "Si estás sujeto a los requisitos laborales de CalFresh, registra tus horas mensuales y adjunta tus talones de pago aquí."
        case .mandarin:
            return "如果你需要满足 CalFresh 工作时长要求,请在这里记录每月的工作时长并附上工资单。"
        }
    }

    private var workHoursAccessibilityLabel: String {
        switch language {
        case .english, .vietnamese, .tagalog:
            return "Track Your Work Hours. Tap to open work hours log."
        case .spanish:
            return "Registra tus horas laborales. Toca para abrir el registro."
        case .mandarin:
            return "记录你的工作时长。点击打开工作时长记录。"
        }
    }

    private func resolveActivePacket() async {
        guard activePacketId == nil else { return }
        let client = enrollmentAuth.makeEnrollmentAPIClient()
        if let packets = try? await client.fetchMyPackets() {
            activePacketId = packets
                .filter { $0.status != .closed }
                .sorted { $0.createdAt > $1.createdAt }
                .first?.id
        }
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
                Text(restaurantMealsTitle)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(restaurantMealsBody(reasons: reasons, language: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            // Info-only callout — soft sky-blue tint so it reads as
            // "FYI" rather than "tap here." Brick is reserved for
            // action affordances elsewhere on the screen.
            .background(CivicaColors.supportPageBackground.opacity(0.55))
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        }
    }

    private var restaurantMealsTitle: String {
        switch language {
        case .english, .vietnamese, .tagalog:
            return "Restaurant Meals Program"
        case .spanish:
            return "Programa de Comidas en Restaurantes"
        case .mandarin:
            return "餐馆膳食计划"
        }
    }

    private func restaurantMealsBody(
        reasons: [RestaurantMealsEligibility.Reason],
        language: CivicaLanguage
    ) -> String {
        let reasonPhrase = restaurantMealsReasonPhrase(reasons: reasons, language: language)
        switch language {
        case .english, .vietnamese, .tagalog:
            return "Because \(reasonPhrase), your EBT card can also be used at participating restaurants for hot prepared meals. Look for the Restaurant Meals Program decal at the door — the FindHelp map will list participating spots when it's tuned for your county."
        case .spanish:
            return "Porque \(reasonPhrase), tu tarjeta EBT también puede usarse en restaurantes participantes para comidas calientes preparadas. Busca la calcomanía del Programa de Comidas en Restaurantes en la puerta — el mapa de Buscar Ayuda mostrará los lugares participantes cuando esté ajustado para tu condado."
        case .mandarin:
            return "因为\(reasonPhrase),你的 EBT 卡也可以在参与餐馆使用,购买热的现做餐食。请在门口寻找 Restaurant Meals Program 标贴 — 当 FindHelp 地图针对你所在的县调整完成后,会列出参与的餐厅。"
        }
    }

    private func restaurantMealsReasonPhrase(
        reasons: [RestaurantMealsEligibility.Reason],
        language: CivicaLanguage
    ) -> String {
        if reasons.contains(.unhoused) {
            switch language {
            case .english, .vietnamese, .tagalog:
                return "your household reports unhoused status"
            case .spanish:
                return "tu hogar reporta estar sin vivienda"
            case .mandarin:
                return "你的家庭报告无固定住所"
            }
        }
        if reasons.contains(.disabled) {
            switch language {
            case .english, .vietnamese, .tagalog:
                return "someone in your household is elderly or disabled"
            case .spanish:
                return "alguien en tu hogar es de edad avanzada o tiene una discapacidad"
            case .mandarin:
                return "你家中有年长者或残障人士"
            }
        }
        switch language {
        case .english, .vietnamese, .tagalog:
            return "your household qualifies"
        case .spanish:
            return "tu hogar califica"
        case .mandarin:
            return "你的家庭符合资格"
        }
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
            // Sibling info-only callout. Same soft-blue tint as the
            // Restaurant Meals card so the pair reads as a coherent
            // "extras you should know about" group without either one
            // claiming the brand brick / teal.
            .background(CivicaColors.supportPageBackground.opacity(0.55))
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            HStack(spacing: CivicaSpacing.xs) {
                Circle()
                    .fill(CivicaColors.amberPrimary)
                    .frame(width: 8, height: 8)
                Text(SNAPDecisionApprovedStrings.approvedBadge.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.amberPrimary)
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
            Text(SNAPDecisionApprovedStrings.headline(
                stateCode: draft?.whereApplying.stateCode,
                language: language
            ))
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
                    denominator: monthlyDenominator,
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

    private var monthlyDenominator: String {
        switch language {
        case .english, .vietnamese, .tagalog:
            return "mo"
        case .spanish:
            return "mes"
        case .mandarin:
            return "月"
        }
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
                    .foregroundStyle(CivicaColors.amberPrimary)
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
                    .strokeBorder(CivicaColors.amberPrimary, lineWidth: 1)
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
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, CivicaSpacing.md)
                    .background(CivicaColors.surfacePrimary)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.control)
                            .strokeBorder(CivicaColors.pinePrimary, lineWidth: 1)
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
        switch language {
        case .spanish:
            formatter.locale = Locale(identifier: "es")
            formatter.dateFormat = "d 'de' MMM"
        case .mandarin:
            formatter.locale = Locale(identifier: "zh_Hans")
            formatter.dateFormat = "M月d日"
        case .english, .vietnamese, .tagalog:
            formatter.locale = Locale(identifier: "en_US")
            formatter.dateFormat = "MMM d"
        }
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
        switch language {
        case .spanish:
            formatter.locale = Locale(identifier: "es")
            formatter.dateFormat = "d 'de' MMM"
        case .mandarin:
            formatter.locale = Locale(identifier: "zh_Hans")
            formatter.dateFormat = "M月d日"
        case .english, .vietnamese, .tagalog:
            formatter.locale = Locale(identifier: "en_US")
            formatter.dateFormat = "MMM d"
        }

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
        switch language {
        case .spanish:
            formatter.locale = Locale(identifier: "es")
        case .mandarin:
            formatter.locale = Locale(identifier: "zh_Hans")
        case .english, .vietnamese, .tagalog:
            formatter.locale = Locale(identifier: "en_US")
        }
        let template = SNAPDecisionApprovedStrings.recertBodyTemplate.value(in: language)
        return template.replacingOccurrences(of: "{date}", with: formatter.string(from: recertDate))
    }
}

// MARK: - Strings

enum SNAPDecisionApprovedStrings {

    static let approvedBadge = CivicaText(
        "Approved",
        es: "Aprobado",
        zh: "已批准"
    )
    static let decidedOn = CivicaText(
        "Decided",
        es: "Decidido",
        zh: "决定日期"
    )
    // Compliance Q3: registry id "decision_approved_headline" — counsel-prep
    // approved (2026-05-19). State-keyed: CalFresh (CA) vs SNAP (MA).
    // Pre-sign fallback retained for tests / surfaces that don't have a state.
    static let headline = CivicaText(
        SNAPComplianceCopyRegistry.approvedEnglish(for: "decision_approved_headline") ?? "You're approved.",
        es: SNAPComplianceCopyRegistry.approvedSpanish(for: "decision_approved_headline") ?? "Estás aprobada.",
        zh: "你已获批准。"
    )

    /// State-aware headline. Production view should call this so CA users
    /// see "CalFresh" and MA users see "SNAP". Falls back to the static
    /// `headline` CivicaText (the state-agnostic default) when no state.
    static func headline(stateCode: String?, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog:
            return SNAPComplianceCopyRegistry.approvedEnglish(
                for: "decision_approved_headline",
                stateCode: stateCode
            ) ?? headline.value(in: .english)
        case .spanish:
            return SNAPComplianceCopyRegistry.approvedSpanish(
                for: "decision_approved_headline",
                stateCode: stateCode
            ) ?? headline.value(in: .spanish)
        case .mandarin:
            return headline.value(in: .mandarin)
        }
    }

    static let monthlyAwardLabel = CivicaText(
        "Monthly award",
        es: "Beneficio mensual",
        zh: "每月福利金额"
    )
    static func amountFallback(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalEN = portal.isEmpty ? "your state portal" : portal
        let portalES = portal.isEmpty ? "el portal estatal" : portal
        let portalZH = portal.isEmpty ? "你所在州的网站" : portal
        switch language {
        case .english, .vietnamese, .tagalog:
            return "\(agency)'s official letter has your monthly amount. Open \(portalEN) to see it."
        case .spanish:
            return "La carta oficial de \(agency) tiene tu cantidad mensual. Abre \(portalES) para verla."
        case .mandarin:
            return "\(agency) 的官方信件上列有你的每月金额。打开 \(portalZH) 即可查看。"
        }
    }
    /// {mailed} / {earliest} / {latest} substituted with localized date
    /// strings. Window assumes EBT card is mailed the day after the
    /// decision and arrives 3–7 business days later (MA standard).
    static let ebtTimingTemplate = CivicaText(
        "EBT card mailed {mailed} · expect {earliest}–{latest}.",
        es: "Tarjeta EBT enviada el {mailed} · llega entre {earliest}–{latest}.",
        zh: "EBT 卡于 {mailed} 寄出 · 预计 {earliest}–{latest} 送达。"
    )
    static let ebtTimingFallback = CivicaText(
        "Your EBT card is mailed within a few days of approval. Most arrive within a week.",
        es: "Tu tarjeta EBT se envía pocos días después de la aprobación. La mayoría llegan en una semana.",
        zh: "批准后几天内,你的 EBT 卡就会寄出。大多数会在一周内送达。"
    )

    static let recertLabel = CivicaText(
        "Mark your calendar",
        es: "Marca tu calendario",
        zh: "请在日历上做好标记"
    )
    /// {date} substituted with a long-form localized date.
    static let recertBodyTemplate = CivicaText(
        "Recertification due {date}. We'll remind you 60 and 14 days before.",
        es: "Recertificación el {date}. Te recordaremos 60 y 14 días antes.",
        zh: "重新认证截止日期为 {date}。我们会在到期前 60 天和 14 天提醒你。"
    )
    static let recertBodyFallback = CivicaText(
        "Recertification happens once a year. We'll remind you 60 and 14 days before yours is due.",
        es: "La recertificación ocurre una vez al año. Te recordaremos 60 y 14 días antes de la tuya.",
        zh: "重新认证每年进行一次。我们会在你的到期日前 60 天和 14 天提醒你。"
    )

    static let wicTitle = CivicaText(
        "Now check WIC and school meals.",
        es: "Ahora revisa WIC y comidas escolares.",
        zh: "现在看看 WIC 和学校餐食。"
    )
    static let wicBody = CivicaText(
        "Your household likely qualifies for both. Vouchers for kids under 5 plus free breakfast and lunch at school.",
        es: "Tu hogar probablemente califica para ambos. Vales para niños menores de 5 más desayuno y almuerzo gratis en la escuela.",
        zh: "你的家庭很可能两项都符合资格。5 岁以下孩子可获得代用券,学校还提供免费的早餐和午餐。"
    )

    static let openDTAConnect = CivicaText(
        "Open DTA Connect",
        es: "Abrir DTA Connect",
        zh: "打开 DTA Connect"
    )
    static let startOver = CivicaText(
        "Reset Civica and start fresh",
        es: "Reiniciar Civica y empezar de nuevo",
        zh: "重置 Civica,重新开始"
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
