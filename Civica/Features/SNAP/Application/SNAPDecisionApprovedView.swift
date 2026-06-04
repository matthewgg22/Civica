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
                Text(workHoursCardTitle(language: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(workHoursCardBody(language: language))
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
        .accessibilityLabel(workHoursCardAccessibilityLabel(language: language))
    }

    private func workHoursCardTitle(language: CivicaLanguage) -> String {
        if language == .vietnamese {
            return "Theo dõi giờ làm việc của bạn"
        }
        return language == .english
            ? "Track Your Work Hours"
            : "Registra tus horas laborales"
    }

    private func workHoursCardBody(language: CivicaLanguage) -> String {
        if language == .vietnamese {
            return "Nếu bạn thuộc diện phải đáp ứng yêu cầu làm việc của CalFresh, hãy ghi lại số giờ hàng tháng và đính kèm phiếu lương tại đây."
        }
        return language == .english
            ? "If you're subject to CalFresh work requirements, log your monthly hours and attach pay stubs here."
            : "Si estás sujeto a los requisitos laborales de CalFresh, registra tus horas mensuales y adjunta tus talones de pago aquí."
    }

    private func workHoursCardAccessibilityLabel(language: CivicaLanguage) -> String {
        if language == .vietnamese {
            return "Theo dõi giờ làm việc của bạn. Nhấn để mở nhật ký giờ làm việc."
        }
        return language == .english
            ? "Track Your Work Hours. Tap to open work hours log."
            : "Registra tus horas laborales. Toca para abrir el registro."
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
                Text(restaurantMealsTitle(language: language))
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

    private func restaurantMealsTitle(language: CivicaLanguage) -> String {
        if language == .vietnamese {
            return "Chương trình Bữa ăn tại Nhà hàng"
        }
        return language == .english
            ? "Restaurant Meals Program"
            : "Programa de Comidas en Restaurantes"
    }

    private func restaurantMealsBody(
        reasons: [RestaurantMealsEligibility.Reason],
        language: CivicaLanguage
    ) -> String {
        let reasonPhrase = restaurantMealsReasonPhrase(reasons: reasons, language: language)
        switch language {
        case .english, .mandarin, .tagalog:
            return "Because \(reasonPhrase), your EBT card can also be used at participating restaurants for hot prepared meals. Look for the Restaurant Meals Program decal at the door — the FindHelp map will list participating spots when it's tuned for your county."
        case .spanish:
            return "Porque \(reasonPhrase), tu tarjeta EBT también puede usarse en restaurantes participantes para comidas calientes preparadas. Busca la calcomanía del Programa de Comidas en Restaurantes en la puerta — el mapa de Buscar Ayuda mostrará los lugares participantes cuando esté ajustado para tu condado."
        case .vietnamese:
            return "Vì \(reasonPhrase), thẻ EBT của bạn cũng có thể được dùng tại các nhà hàng tham gia để mua bữa ăn nóng chế biến sẵn. Hãy tìm nhãn dán Chương trình Bữa ăn tại Nhà hàng ở cửa — bản đồ FindHelp sẽ liệt kê các địa điểm tham gia khi được điều chỉnh cho quận của bạn."
        }
    }

    private func restaurantMealsReasonPhrase(
        reasons: [RestaurantMealsEligibility.Reason],
        language: CivicaLanguage
    ) -> String {
        if reasons.contains(.unhoused) {
            if language == .vietnamese {
                return "hộ gia đình của bạn cho biết đang không có nhà ở"
            }
            return language == .english
                ? "your household reports unhoused status"
                : "tu hogar reporta estar sin vivienda"
        }
        if reasons.contains(.disabled) {
            if language == .vietnamese {
                return "một người trong hộ gia đình của bạn là người cao tuổi hoặc khuyết tật"
            }
            return language == .english
                ? "someone in your household is elderly or disabled"
                : "alguien en tu hogar es de edad avanzada o tiene una discapacidad"
        }
        if language == .vietnamese {
            return "hộ gia đình của bạn đủ điều kiện"
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

    private func monthlyDenominator(language: CivicaLanguage) -> String {
        switch language {
        case .spanish:
            return "mes"
        case .vietnamese:
            return "tháng"
        case .english, .mandarin, .tagalog:
            return "mo"
        }
    }

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
                    denominator: monthlyDenominator(language: language),
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
        es: "Aprobado",
        vi: "Đã được duyệt"
    )
    static let decidedOn = CivicaText(
        "Decided",
        es: "Decidido",
        vi: "Đã quyết định"
    )
    // Compliance Q3: registry id "decision_approved_headline" — counsel-prep
    // approved (2026-05-19). State-keyed: CalFresh (CA) vs SNAP (MA).
    // Pre-sign fallback retained for tests / surfaces that don't have a state.
    static let headline = CivicaText(
        SNAPComplianceCopyRegistry.approvedEnglish(for: "decision_approved_headline") ?? "You're approved.",
        es: SNAPComplianceCopyRegistry.approvedSpanish(for: "decision_approved_headline") ?? "Estás aprobada.",
        vi: "Bạn đã được duyệt."
    )

    /// State-aware headline. Production view should call this so CA users
    /// see "CalFresh" and MA users see "SNAP". Falls back to the static
    /// `headline` CivicaText (the state-agnostic default) when no state.
    static func headline(stateCode: String?, language: CivicaLanguage) -> String {
        switch language {
        case .english, .mandarin, .tagalog:
            return SNAPComplianceCopyRegistry.approvedEnglish(
                for: "decision_approved_headline",
                stateCode: stateCode
            ) ?? headline.value(in: .english)
        case .spanish:
            return SNAPComplianceCopyRegistry.approvedSpanish(
                for: "decision_approved_headline",
                stateCode: stateCode
            ) ?? headline.value(in: .spanish)
        case .vietnamese:
            return headline.value(in: .vietnamese)
        }
    }

    static let monthlyAwardLabel = CivicaText(
        "Monthly award",
        es: "Beneficio mensual",
        vi: "Trợ cấp hàng tháng"
    )
    static func amountFallback(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalEN = portal.isEmpty ? "your state portal" : portal
        let portalES = portal.isEmpty ? "el portal estatal" : portal
        let portalVI = portal.isEmpty ? "cổng thông tin tiểu bang của bạn" : portal
        switch language {
        case .english, .mandarin, .tagalog:
            return "\(agency)'s official letter has your monthly amount. Open \(portalEN) to see it."
        case .spanish:
            return "La carta oficial de \(agency) tiene tu cantidad mensual. Abre \(portalES) para verla."
        case .vietnamese:
            return "Thư chính thức của \(agency) ghi số tiền hàng tháng của bạn. Mở \(portalVI) để xem."
        }
    }
    /// {mailed} / {earliest} / {latest} substituted with localized date
    /// strings. Window assumes EBT card is mailed the day after the
    /// decision and arrives 3–7 business days later (MA standard).
    static let ebtTimingTemplate = CivicaText(
        "EBT card mailed {mailed} · expect {earliest}–{latest}.",
        es: "Tarjeta EBT enviada el {mailed} · llega entre {earliest}–{latest}.",
        vi: "Thẻ EBT gửi qua bưu điện ngày {mailed} · dự kiến đến {earliest}–{latest}."
    )
    static let ebtTimingFallback = CivicaText(
        "Your EBT card is mailed within a few days of approval. Most arrive within a week.",
        es: "Tu tarjeta EBT se envía pocos días después de la aprobación. La mayoría llegan en una semana.",
        vi: "Thẻ EBT của bạn được gửi qua bưu điện trong vài ngày sau khi được duyệt. Hầu hết đến trong vòng một tuần."
    )

    static let recertLabel = CivicaText(
        "Mark your calendar",
        es: "Marca tu calendario",
        vi: "Ghi vào lịch của bạn"
    )
    /// {date} substituted with a long-form localized date.
    static let recertBodyTemplate = CivicaText(
        "Recertification due {date}. We'll remind you 60 and 14 days before.",
        es: "Recertificación el {date}. Te recordaremos 60 y 14 días antes.",
        vi: "Tái chứng nhận đến hạn ngày {date}. Chúng tôi sẽ nhắc bạn trước 60 và 14 ngày."
    )
    static let recertBodyFallback = CivicaText(
        "Recertification happens once a year. We'll remind you 60 and 14 days before yours is due.",
        es: "La recertificación ocurre una vez al año. Te recordaremos 60 y 14 días antes de la tuya.",
        vi: "Tái chứng nhận diễn ra mỗi năm một lần. Chúng tôi sẽ nhắc bạn trước 60 và 14 ngày trước khi đến hạn."
    )

    static let wicTitle = CivicaText(
        "Now check WIC and school meals.",
        es: "Ahora revisa WIC y comidas escolares.",
        vi: "Bây giờ hãy kiểm tra WIC và bữa ăn ở trường."
    )
    static let wicBody = CivicaText(
        "Your household likely qualifies for both. Vouchers for kids under 5 plus free breakfast and lunch at school.",
        es: "Tu hogar probablemente califica para ambos. Vales para niños menores de 5 más desayuno y almuerzo gratis en la escuela.",
        vi: "Hộ gia đình của bạn có thể đủ điều kiện cho cả hai. Phiếu trợ cấp cho trẻ dưới 5 tuổi cùng bữa sáng và bữa trưa miễn phí ở trường."
    )

    static let openDTAConnect = CivicaText(
        "Open DTA Connect",
        es: "Abrir DTA Connect",
        vi: "Mở DTA Connect"
    )
    static let startOver = CivicaText(
        "Reset Civica and start fresh",
        es: "Reiniciar Civica y empezar de nuevo",
        vi: "Đặt lại Civica và bắt đầu mới"
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
