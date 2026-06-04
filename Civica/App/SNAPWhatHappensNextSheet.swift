import CivicaDesignSystem
import SwiftUI

// "What happens next" sheet — Variant B (card-per-phase, current
// expanded) from the May 2026 design pack. Opens from the primary
// CTA on CivicaHomePhase2View. Replaces the v1.0 bridge to
// SNAPWaitingRoomView with the dedicated design.
//
// Variant B carries the most narrative weight of the three explored
// variants: the user lands directly on "what the county is doing
// right now" plus "what you can do" inside one expanded card. The
// timeline graphic is implicit in the stacked-card structure —
// past phases collapse to a checkmark row, the current phase opens
// fully, future phases stay quiet outlines.

struct SNAPWhatHappensNextSheet: View {
    @ObservedObject var statusStore: SNAPApplicationStatusStore
    let language: CivicaLanguage
    let onMessageNavigator: () -> Void

    @Environment(\.dismiss) private var dismiss

    private var county: String {
        let draftCounty = SNAPApplicationDraftStore().load()?.draft.whereApplying.county
        return draftCounty?.trimmingCharacters(in: .whitespaces).isEmpty == false
            ? draftCounty!
            : SNAPWhatHappensNextStrings.fallbackCounty.value(in: language)
    }

    private var headline: String {
        switch statusStore.status {
        case .submittedToState:
            return SNAPWhatHappensNextStrings.headlineSubmitted(county: county, language: language)
        case .documentsRequested:
            return SNAPWhatHappensNextStrings.headlineDocumentsRequested(county: county, language: language)
        case .interviewScheduled:
            return SNAPWhatHappensNextStrings.headlineInterviewScheduled(county: county, language: language)
        case .interviewCompleted:
            return SNAPWhatHappensNextStrings.headlineInterviewCompleted.value(in: language)
        default:
            return SNAPWhatHappensNextStrings.headlineSubmitted(county: county, language: language)
        }
    }

    /// Status-aware eyebrow that sits above the headline.
    private var eyebrow: String {
        switch statusStore.status {
        case .submittedToState:    return SNAPWhatHappensNextStrings.eyebrowSubmitted.value(in: language)
        case .documentsRequested:  return SNAPWhatHappensNextStrings.eyebrowDocumentsRequested.value(in: language)
        case .interviewScheduled:  return SNAPWhatHappensNextStrings.eyebrowInterviewScheduled.value(in: language)
        case .interviewCompleted:  return SNAPWhatHappensNextStrings.eyebrowInterviewCompleted.value(in: language)
        default:                   return SNAPWhatHappensNextStrings.eyebrowSubmitted.value(in: language)
        }
    }

    private var currentMilestone: Milestone {
        switch statusStore.status {
        case .submittedToState, .documentsRequested: return .countyReview
        case .interviewScheduled: return .interview
        case .interviewCompleted: return .decision
        default: return .countyReview
        }
    }

    enum Milestone: Int, CaseIterable {
        case submitted, countyReview, interview, decision
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                    header
                    milestoneCards
                    Spacer(minLength: CivicaSpacing.xl)
                    navigatorFooter
                }
                .padding(CivicaSpacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationTitle(SNAPWhatHappensNextStrings.sheetTitle.value(in: language))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(SNAPWhatHappensNextStrings.doneButton.value(in: language)) {
                        dismiss()
                    }
                }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(eyebrow)
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.pinePrimary)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(headline)
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
        }
    }

    // MARK: - Milestone cards

    private var milestoneCards: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            ForEach(Milestone.allCases, id: \.self) { milestone in
                milestoneCard(milestone)
            }
        }
    }

    @ViewBuilder
    private func milestoneCard(_ milestone: Milestone) -> some View {
        let state = phaseState(milestone)
        switch state {
        case .past:      pastRow(milestone)
        case .current:   currentCard(milestone)
        case .future:    futureRow(milestone)
        }
    }

    private enum PhaseState { case past, current, future }
    private func phaseState(_ milestone: Milestone) -> PhaseState {
        if milestone.rawValue < currentMilestone.rawValue { return .past }
        if milestone.rawValue == currentMilestone.rawValue { return .current }
        return .future
    }

    /// Past-phase collapsed row: checkmark + label + date.
    private func pastRow(_ milestone: Milestone) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            Circle()
                .fill(CivicaColors.pinePrimary)
                .frame(width: 18, height: 18)
                .overlay {
                    Image(systemName: "checkmark")
                        .imageScale(.large)
                        .font(.body)
                        .foregroundStyle(CivicaColors.onPrimaryText)
                }
            Text(label(for: milestone))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
            Spacer(minLength: 0)
            if let date = timestamp(for: milestone) {
                Text(formattedDate(date))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
        }
        .padding(.vertical, CivicaSpacing.sm)
        .padding(.horizontal, CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
    }

    /// Current-phase expanded card with full prose + "what the county
    /// is doing" + "what you can do" sub-sections.
    private func currentCard(_ milestone: Milestone) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.sm) {
                Circle()
                    .fill(CivicaColors.pinePrimary)
                    .frame(width: 18, height: 18)
                    .overlay(
                        Circle()
                            .stroke(CivicaColors.pinePrimary.opacity(0.20), lineWidth: 5)
                    )
                Text(currentPhaseEyebrow(milestone))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .textCase(.uppercase)
                    .kerning(1.0)
            }
            Text(label(for: milestone))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
                .padding(.top, 2)
            Text(currentPhaseBody(milestone))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)

            Rectangle()
                .fill(CivicaColors.hairline)
                .frame(height: 1)
                .padding(.vertical, CivicaSpacing.xs)

            Text(SNAPWhatHappensNextStrings.whatCountyDoing.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.ink)
            Text(countyDoingBody(milestone))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            Text(SNAPWhatHappensNextStrings.whatYouCanDo.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.ink)
                .padding(.top, CivicaSpacing.sm)
            VStack(alignment: .leading, spacing: 4) {
                ForEach(youCanDoBullets(milestone), id: \.self) { bullet in
                    HStack(alignment: .top, spacing: 6) {
                        Text("·")
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.graphite)
                        Text(bullet)
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.graphite)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.pineSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    /// Future-phase row: empty circle + dim label.
    private func futureRow(_ milestone: Milestone) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            Circle()
                .stroke(CivicaColors.ink.opacity(0.22), lineWidth: 1.5)
                .background(Circle().fill(CivicaColors.paper))
                .frame(width: 14, height: 14)
                .padding(2)
            Text(label(for: milestone))
                .font(CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.muted)
            Spacer(minLength: 0)
            Text(futureEstimate(milestone))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.muted)
        }
        .padding(.vertical, CivicaSpacing.sm)
        .padding(.horizontal, CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Navigator footer

    private var navigatorFooter: some View {
        Button(action: {
            dismiss()
            onMessageNavigator()
        }) {
            HStack(spacing: CivicaSpacing.md) {
                Image(systemName: "bubble.left")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.ink)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text(SNAPWhatHappensNextStrings.messageNavigatorTitle.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    Text(SNAPWhatHappensNextStrings.messageNavigatorBody.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                }
                Spacer(minLength: CivicaSpacing.sm)
                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Per-milestone content

    private func label(for milestone: Milestone) -> String {
        switch milestone {
        case .submitted:    return SNAPWhatHappensNextStrings.milestoneSubmitted.value(in: language)
        case .countyReview: return SNAPWhatHappensNextStrings.milestoneCountyReview.value(in: language)
        case .interview:    return SNAPWhatHappensNextStrings.milestoneInterview.value(in: language)
        case .decision:     return SNAPWhatHappensNextStrings.milestoneDecision.value(in: language)
        }
    }

    private func currentPhaseEyebrow(_ milestone: Milestone) -> String {
        switch milestone {
        case .submitted, .countyReview:
            return SNAPWhatHappensNextStrings.currentEyebrowInReview.value(in: language)
        case .interview:
            return SNAPWhatHappensNextStrings.currentEyebrowInterview.value(in: language)
        case .decision:
            return SNAPWhatHappensNextStrings.currentEyebrowDecision.value(in: language)
        }
    }

    private func currentPhaseBody(_ milestone: Milestone) -> String {
        switch milestone {
        case .submitted, .countyReview:
            return SNAPWhatHappensNextStrings.currentBodyInReview(county: county, language: language)
        case .interview:
            return SNAPWhatHappensNextStrings.currentBodyInterview.value(in: language)
        case .decision:
            return SNAPWhatHappensNextStrings.currentBodyDecision.value(in: language)
        }
    }

    private func countyDoingBody(_ milestone: Milestone) -> String {
        switch milestone {
        case .submitted, .countyReview:
            return SNAPWhatHappensNextStrings.countyDoingReview(county: county, language: language)
        case .interview:
            return SNAPWhatHappensNextStrings.countyDoingInterview.value(in: language)
        case .decision:
            return SNAPWhatHappensNextStrings.countyDoingDecision.value(in: language)
        }
    }

    private func youCanDoBullets(_ milestone: Milestone) -> [String] {
        switch milestone {
        case .submitted, .countyReview:
            return [
                SNAPWhatHappensNextStrings.youCanDoReview1.value(in: language),
                SNAPWhatHappensNextStrings.youCanDoReview2.value(in: language),
                SNAPWhatHappensNextStrings.youCanDoReview3.value(in: language),
            ]
        case .interview:
            return [
                SNAPWhatHappensNextStrings.youCanDoInterview1.value(in: language),
                SNAPWhatHappensNextStrings.youCanDoInterview2.value(in: language),
                SNAPWhatHappensNextStrings.youCanDoInterview3.value(in: language),
            ]
        case .decision:
            return [
                SNAPWhatHappensNextStrings.youCanDoDecision1.value(in: language),
                SNAPWhatHappensNextStrings.youCanDoDecision2.value(in: language),
            ]
        }
    }

    private func futureEstimate(_ milestone: Milestone) -> String {
        switch milestone {
        case .submitted, .countyReview:
            return SNAPWhatHappensNextStrings.futureCountyReview.value(in: language)
        case .interview:
            return SNAPWhatHappensNextStrings.futureInterview.value(in: language)
        case .decision:
            return SNAPWhatHappensNextStrings.futureDecision.value(in: language)
        }
    }

    private func timestamp(for milestone: Milestone) -> Date? {
        switch milestone {
        case .submitted:    return statusStore.timestamp(for: .submittedToState)
        case .countyReview: return statusStore.timestamp(for: .documentsRequested)
                                ?? statusStore.timestamp(for: .submittedToState)
        case .interview:    return statusStore.timestamp(for: .interviewScheduled)
        case .decision:     return statusStore.timestamp(for: .decisionApproved)
                                ?? statusStore.timestamp(for: .decisionDenied)
        }
    }

    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}

// MARK: - Strings

enum SNAPWhatHappensNextStrings {
    static let sheetTitle = CivicaText("What happens next", es: "Lo que sigue", vi: "Tiếp theo sẽ thế nào")
    static let doneButton = CivicaText("Done", es: "Listo", vi: "Xong")
    static let fallbackCounty = CivicaText("your county", es: "tu condado", vi: "quận của bạn")

    // Status-aware eyebrows
    static let eyebrowSubmitted = CivicaText(
        "SNAP application · Submitted",
        es: "Solicitud SNAP · Enviada",
        vi: "Đơn SNAP · Đã gửi"
    )
    static let eyebrowDocumentsRequested = CivicaText(
        "SNAP application · Documents requested",
        es: "Solicitud SNAP · Documentos solicitados",
        vi: "Đơn SNAP · Cần thêm giấy tờ"
    )
    static let eyebrowInterviewScheduled = CivicaText(
        "SNAP application · Interview scheduled",
        es: "Solicitud SNAP · Entrevista programada",
        vi: "Đơn SNAP · Đã hẹn phỏng vấn"
    )
    static let eyebrowInterviewCompleted = CivicaText(
        "SNAP application · Interview complete",
        es: "Solicitud SNAP · Entrevista completa",
        vi: "Đơn SNAP · Đã phỏng vấn xong"
    )

    // Status-aware headlines
    static func headlineSubmitted(county: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .tagalog: return "We sent your application to \(county)."
        case .spanish: return "Enviamos tu solicitud a \(county)."
        case .mandarin: return "We sent your application to \(county)."
        case .vietnamese: return "Chúng tôi đã gửi đơn của bạn đến \(county)."
        }
    }
    static func headlineDocumentsRequested(county: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .tagalog: return "\(county) needs a few more documents."
        case .spanish: return "\(county) necesita algunos documentos más."
        case .mandarin: return "\(county) needs a few more documents."
        case .vietnamese: return "\(county) cần thêm một vài giấy tờ."
        }
    }
    static func headlineInterviewScheduled(county: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .tagalog: return "\(county) scheduled your interview."
        case .spanish: return "\(county) programó tu entrevista."
        case .mandarin: return "\(county) scheduled your interview."
        case .vietnamese: return "\(county) đã sắp xếp buổi phỏng vấn cho bạn."
        }
    }
    static let headlineInterviewCompleted = CivicaText(
        "The interview is complete.",
        es: "La entrevista está completa.",
        vi: "Buổi phỏng vấn đã hoàn tất."
    )

    // Milestone labels
    static let milestoneSubmitted    = CivicaText("Submitted",    es: "Enviada", vi: "Đã gửi")
    static let milestoneCountyReview = CivicaText("County review", es: "Revisión del condado", vi: "Quận xem xét")
    static let milestoneInterview    = CivicaText("Interview call", es: "Llamada de entrevista", vi: "Cuộc gọi phỏng vấn")
    static let milestoneDecision     = CivicaText("Decision",     es: "Decisión", vi: "Quyết định")

    // Current-phase expanded card content
    static let currentEyebrowInReview = CivicaText(
        "In progress · typical 7-10 days",
        es: "En progreso · típicamente 7-10 días",
        vi: "Đang xử lý · thường 7-10 ngày"
    )
    static let currentEyebrowInterview = CivicaText(
        "Scheduled by the county",
        es: "Programada por el condado",
        vi: "Do quận sắp xếp"
    )
    static let currentEyebrowDecision = CivicaText(
        "Within 30 days by law",
        es: "Dentro de 30 días por ley",
        vi: "Trong vòng 30 ngày theo luật"
    )

    static func currentBodyInReview(county: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .tagalog:
            return "A caseworker at \(county) is reading your packet. If anything is unclear, they'll send a message here — you don't need to call."
        case .spanish:
            return "Un trabajador social en \(county) está leyendo tu paquete. Si algo no está claro, te enviarán un mensaje aquí — no tienes que llamar."
        case .mandarin:
            return "A caseworker at \(county) is reading your packet. If anything is unclear, they'll send a message here — you don't need to call."
        case .vietnamese:
            return "Một nhân viên xét hồ sơ tại \(county) đang đọc hồ sơ của bạn. Nếu có điều gì chưa rõ, họ sẽ gửi tin nhắn ở đây — bạn không cần phải gọi."
        }
    }
    static let currentBodyInterview = CivicaText(
        "Most interviews are a 15-minute phone call. The caseworker will confirm what you wrote — no surprise questions.",
        es: "La mayoría de las entrevistas son una llamada de 15 minutos. El trabajador social confirmará lo que escribiste — sin preguntas sorpresa.",
        vi: "Hầu hết các buổi phỏng vấn là một cuộc gọi 15 phút. Nhân viên xét hồ sơ sẽ xác nhận lại những gì bạn đã viết — không có câu hỏi bất ngờ."
    )
    static let currentBodyDecision = CivicaText(
        "You'll get a written notice. If approved, your EBT card arrives 5-7 days after.",
        es: "Recibirás una notificación escrita. Si te aprueban, tu tarjeta EBT llega 5-7 días después.",
        vi: "Bạn sẽ nhận được thông báo bằng văn bản. Nếu được chấp thuận, thẻ EBT sẽ đến trong 5-7 ngày sau đó."
    )

    static let whatCountyDoing = CivicaText(
        "What the county is doing right now",
        es: "Lo que el condado está haciendo ahora",
        vi: "Quận đang làm gì lúc này"
    )
    static let whatYouCanDo = CivicaText(
        "What you can do",
        es: "Lo que puedes hacer",
        vi: "Bạn có thể làm gì"
    )

    static func countyDoingReview(county: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .tagalog:
            return "Verifying your ID, address, and income against state records. Flagging anything they can't match for a quick follow-up."
        case .spanish:
            return "Verificando tu identificación, dirección e ingresos con los registros del estado. Marcando cualquier cosa que no coincida para un seguimiento rápido."
        case .mandarin:
            return "Verifying your ID, address, and income against state records. Flagging anything they can't match for a quick follow-up."
        case .vietnamese:
            return "Đang xác minh giấy tờ tùy thân, địa chỉ và thu nhập của bạn dựa trên hồ sơ của tiểu bang. Đánh dấu mọi thứ không khớp để liên hệ lại nhanh chóng."
        }
    }
    static let countyDoingInterview = CivicaText(
        "Preparing the interview script. The caseworker has already reviewed your packet — the call is to confirm details, not re-ask from scratch.",
        es: "Preparando el guión de la entrevista. El trabajador social ya revisó tu paquete — la llamada es para confirmar detalles, no para volver a preguntar desde cero.",
        vi: "Đang chuẩn bị nội dung phỏng vấn. Nhân viên xét hồ sơ đã xem hồ sơ của bạn — cuộc gọi chỉ để xác nhận chi tiết, không phải hỏi lại từ đầu."
    )
    static let countyDoingDecision = CivicaText(
        "Issuing the final decision and the written notice. If approved, your case is being set up in the state EBT system.",
        es: "Emitiendo la decisión final y la notificación escrita. Si te aprueban, tu caso se está configurando en el sistema EBT del estado.",
        vi: "Đang ra quyết định cuối cùng và thông báo bằng văn bản. Nếu được chấp thuận, hồ sơ của bạn đang được thiết lập trong hệ thống EBT của tiểu bang."
    )

    static let youCanDoReview1 = CivicaText(
        "Keep your phone on — the interview call may come from a 510 or unknown number.",
        es: "Mantén tu teléfono encendido — la llamada de entrevista puede venir de un número 510 o desconocido.",
        vi: "Hãy để điện thoại luôn bật — cuộc gọi phỏng vấn có thể đến từ số 510 hoặc số lạ."
    )
    static let youCanDoReview2 = CivicaText(
        "Have last month's pay stubs and a photo ID nearby.",
        es: "Ten cerca los recibos de pago del mes pasado y una identificación con foto.",
        vi: "Để sẵn cuống lương tháng trước và một giấy tờ tùy thân có ảnh trong tầm tay."
    )
    static let youCanDoReview3 = CivicaText(
        "Check this app every couple of days for messages from the county.",
        es: "Revisa esta app cada par de días por mensajes del condado.",
        vi: "Kiểm tra ứng dụng này vài ngày một lần để xem tin nhắn từ quận."
    )
    static let youCanDoInterview1 = CivicaText(
        "Be in a quiet place at the scheduled time.",
        es: "Estar en un lugar tranquilo a la hora programada.",
        vi: "Ở nơi yên tĩnh vào giờ đã hẹn."
    )
    static let youCanDoInterview2 = CivicaText(
        "Have your application open so you can answer consistently.",
        es: "Ten tu solicitud abierta para que puedas responder de manera consistente.",
        vi: "Mở sẵn đơn của bạn để có thể trả lời nhất quán."
    )
    static let youCanDoInterview3 = CivicaText(
        "Bring questions — the caseworker can clarify anything you weren't sure about.",
        es: "Trae preguntas — el trabajador social puede aclarar cualquier cosa que no tenías clara.",
        vi: "Mang theo câu hỏi — nhân viên xét hồ sơ có thể làm rõ bất cứ điều gì bạn chưa chắc chắn."
    )
    static let youCanDoDecision1 = CivicaText(
        "Watch the app and your mail for the written decision.",
        es: "Estar atento a la app y al correo para la decisión escrita.",
        vi: "Theo dõi ứng dụng và thư của bạn để nhận quyết định bằng văn bản."
    )
    static let youCanDoDecision2 = CivicaText(
        "If approved, the EBT card arrives 5-7 days after the decision.",
        es: "Si te aprueban, la tarjeta EBT llega 5-7 días después de la decisión.",
        vi: "Nếu được chấp thuận, thẻ EBT sẽ đến trong 5-7 ngày sau khi có quyết định."
    )

    static let futureCountyReview = CivicaText("Typical 7-10 days", es: "Típicamente 7-10 días", vi: "Thường 7-10 ngày")
    static let futureInterview    = CivicaText("Scheduled by county", es: "Programada por condado", vi: "Do quận sắp xếp")
    static let futureDecision     = CivicaText("Within 30 days",     es: "Dentro de 30 días", vi: "Trong vòng 30 ngày")

    static let messageNavigatorTitle = CivicaText(
        "Message a navigator",
        es: "Mensajea un asesor",
        vi: "Nhắn tin cho người hướng dẫn"
    )
    static let messageNavigatorBody = CivicaText(
        "A real person, M-F · usually replies in a few hours",
        es: "Una persona real, L-V · usualmente responde en pocas horas",
        vi: "Một người thật, Thứ Hai-Thứ Sáu · thường trả lời trong vài giờ"
    )
}

#if DEBUG
struct SNAPWhatHappensNextSheet_Previews: PreviewProvider {
    static var previews: some View {
        SNAPWhatHappensNextSheet(
            statusStore: SNAPApplicationStatusStore(),
            language: .english,
            onMessageNavigator: {}
        )
    }
}
#endif
