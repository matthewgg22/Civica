import CivicaDesignSystem
import SwiftUI
import UIKit

// HANDOFF-cadence wrapper around SNAPAppealLetterPDFRenderer. Same
// pattern as SNAPApplicationPacketView: render on appear, surface a
// share sheet, walkthrough block explaining what to do with the file.
//
// Reached from the denial surface's "Start an appeal" primary CTA.
// Federal SNAP guarantees a fair-hearing right within 90 days of a
// denial notice (7 CFR 273.15). The official MA path is DTA Connect
// or in-person at a DTA office — this view generates the printable
// request the user signs and submits.

struct SNAPAppealLetterView: View {
    let language: CivicaLanguage
    /// USPS state code for the user's active application. Drives
    /// the recipient block, salutation, and external fair-hearing
    /// link. Nil falls back to the launch state.
    let stateCode: String?
    /// Optional hook for callers that want to react before the appeal
    /// letter view pops itself off the navigation stack — e.g.
    /// recording telemetry that the user finished the letter flow.
    /// Pop behavior itself is owned by the view via @Environment(\.dismiss)
    /// so an empty-closure caller still gets a working "Done for now."
    let onClose: () -> Void

    init(language: CivicaLanguage, stateCode: String? = nil, onClose: @escaping () -> Void) {
        self.language = language
        self.stateCode = stateCode
        self.onClose = onClose
    }

    @Environment(\.dismiss) private var dismiss

    @State private var phase: Phase = .idle
    @State private var isShareSheetPresented = false
    @State private var openingFairHearingPage: Bool = false

    enum Phase {
        case idle
        case generating
        case ready(URL)
        case error(String)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    eyebrow
                    title
                    body_
                    statusCard
                    nextStepsBlock
                }
                .padding(CivicaSpacing.xl)
            }
            actionFooter
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if case .idle = phase {
                await generate()
            }
        }
        .sheet(isPresented: $isShareSheetPresented) {
            if case .ready(let url) = phase {
                ShareSheet(items: [url])
            }
        }
        .sheet(isPresented: $openingFairHearingPage) {
            CivicaSafariSheet(url: CivicaExternalLinks.fairHearingPage(for: stateCode))
        }
    }

    // MARK: - Header

    private var eyebrow: some View {
        Text(SNAPAppealLetterScreenStrings.eyebrow.value(in: language))
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.graphite)
            .textCase(.uppercase)
            .kerning(1.2)
    }

    private var title: some View {
        Text(SNAPAppealLetterScreenStrings.title.value(in: language))
            .font(CivicaTypography.pageTitle)
            .foregroundStyle(CivicaColors.ink)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }

    private var body_: some View {
        Text(SNAPAppealLetterScreenStrings.bodyText(language: language, stateCode: stateCode))
            .font(CivicaTypography.body)
            .foregroundStyle(CivicaColors.graphite)
            .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Status card

    @ViewBuilder
    private var statusCard: some View {
        switch phase {
        case .idle, .generating:
            HStack(spacing: CivicaSpacing.sm) {
                ProgressView()
                Text(SNAPAppealLetterScreenStrings.generating.value(in: language))
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.graphite)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        case .ready:
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "doc.text.fill")
                    .foregroundStyle(CivicaColors.amberPrimary)
                    .accessibilityHidden(true)
                Text(SNAPAppealLetterScreenStrings.ready.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.amberPrimary.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        case .error(let message):
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                HStack(spacing: CivicaSpacing.sm) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(CivicaColors.warningAmber)
                        .accessibilityHidden(true)
                    Text(message)
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Button(SNAPAppealLetterScreenStrings.retry.value(in: language)) {
                    Task { await generate() }
                }
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.pinePrimary)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.warningAmber.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        }
    }

    // MARK: - Next steps

    private var nextStepsBlock: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPAppealLetterScreenStrings.nextStepsHeading.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            Text(SNAPAppealLetterScreenStrings.nextStepsBodyText(language: language, stateCode: stateCode))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(CivicaSpacing.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card)
                        .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                )

            Button {
                openingFairHearingPage = true
            } label: {
                HStack(spacing: CivicaSpacing.sm) {
                    Image(systemName: "safari")
                        .foregroundStyle(CivicaColors.pinePrimary)
                        .accessibilityHidden(true)
                    Text(SNAPAppealLetterScreenStrings.openOnlinePortalText(language: language, stateCode: stateCode))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.pinePrimary)
                        .underline()
                    Spacer(minLength: 0)
                }
                .padding(.vertical, CivicaSpacing.xs)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(SNAPAppealLetterScreenStrings.openOnlinePortalText(language: language, stateCode: stateCode))
        }
    }

    // MARK: - Action footer

    private var actionFooter: some View {
        VStack(spacing: CivicaSpacing.sm) {
            CivicaPrimaryButton(
                SNAPAppealLetterScreenStrings.share.value(in: language),
                isEnabled: { if case .ready = phase { return true }; return false }(),
                action: { isShareSheetPresented = true }
            )
            CivicaSecondaryButton(
                title: SNAPAppealLetterScreenStrings.done.value(in: language),
                action: {
                    onClose()
                    dismiss()
                }
            )
        }
        .padding(.horizontal, CivicaSpacing.xl)
        .padding(.top, CivicaSpacing.md)
        .padding(.bottom, CivicaSpacing.lg)
        .background(CivicaColors.paper)
        .overlay(alignment: .top) {
            Rectangle().fill(CivicaColors.hairline).frame(height: 1)
        }
    }

    // MARK: - Rendering

    private func generate() async {
        phase = .generating
        do {
            let url = try SNAPAppealLetterPDFRenderer.render(language: language, stateCode: stateCode)
            phase = .ready(url)
        } catch {
            phase = .error(SNAPAppealLetterScreenStrings.errorGeneric.value(in: language))
        }
    }
}

// MARK: - Share sheet wrap

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Strings

enum SNAPAppealLetterScreenStrings {

    static let eyebrow = CivicaText(
        "Appeal a SNAP denial",
        es: "Apela una denegación de SNAP",
        zh: "申诉 SNAP 拒绝决定",
        vi: "Khiếu nại quyết định từ chối SNAP",
        tl: "Mag-appeal sa pagtanggi sa SNAP"
    )
    static let title = CivicaText(
        "Your fair-hearing request is ready to print",
        es: "Tu solicitud de audiencia justa está lista para imprimir",
        zh: "你的公平听证申请已准备好打印",
        vi: "Đơn xin điều trần công bằng của bạn đã sẵn sàng để in",
        tl: "Handa nang i-print ang iyong request para sa fair hearing"
    )
    static func bodyText(language: CivicaLanguage, stateCode: String?) -> String {
        let office: String
        switch (stateCode ?? SNAPAgencyDirectory.launchStateCode).uppercased() {
        case "CA":
            switch language {
            case .english:
                office = "the State Hearings Division"
            case .spanish:
                office = "la División de Audiencias del Estado"
            case .mandarin:
                office = "州听证部门"
            case .vietnamese:
                office = "Phòng Điều trần Tiểu bang"
            case .tagalog:
                office = "ang State Hearings Division"
            }
        case "MA":
            switch language {
            case .english:
                office = "the DTA Hearing Office"
            case .spanish:
                office = "la Oficina de Audiencias del DTA"
            case .mandarin:
                office = "DTA 听证办公室"
            case .vietnamese:
                office = "Văn phòng Điều trần DTA"
            case .tagalog:
                office = "ang DTA Hearing Office"
            }
        default:
            switch language {
            case .english:
                office = "your state SNAP hearing office"
            case .spanish:
                office = "tu oficina estatal de audiencias de SNAP"
            case .mandarin:
                office = "你所在州的 SNAP 听证办公室"
            case .vietnamese:
                office = "văn phòng điều trần SNAP của tiểu bang bạn"
            case .tagalog:
                office = "ang SNAP hearing office ng iyong estado"
            }
        }
        switch language {
        case .english:
            return "We prepared a letter requesting a fair hearing under federal SNAP rules (7 CFR 273.15). Sign and date it, fill in your information, and mail or hand-deliver it to \(office)."
        case .spanish:
            return "Preparamos una carta que solicita una audiencia justa bajo las reglas federales de SNAP (7 CFR 273.15). Fírmala y féchala, completa tu información, y envíala por correo o entrégala en persona a \(office)."
        case .mandarin:
            return "我们根据联邦 SNAP 规定(7 CFR 273.15)为你准备了一封申请公平听证的信。请签名并填写日期,补充你的信息,然后邮寄或亲自送交至\(office)。"
        case .vietnamese:
            return "Chúng tôi đã chuẩn bị một lá thư yêu cầu điều trần công bằng theo quy định SNAP liên bang (7 CFR 273.15). Hãy ký tên và ghi ngày, điền thông tin của bạn, rồi gửi qua bưu điện hoặc trực tiếp đến \(office)."
        case .tagalog:
            return "Naghanda kami ng liham na humihiling ng fair hearing sa ilalim ng pederal na patakaran ng SNAP (7 CFR 273.15). Pirmahan at lagyan ng petsa, sulatan ng iyong impormasyon, at i-mail o personal na ihatid sa \(office)."
        }
    }

    static let generating = CivicaText(
        "Drafting your letter…",
        es: "Preparando tu carta…",
        zh: "正在为你起草信件……",
        vi: "Đang soạn thư của bạn…",
        tl: "Binubuo ang iyong liham…"
    )
    static let ready = CivicaText(
        "Your letter is ready.",
        es: "Tu carta está lista.",
        zh: "你的信件已准备好。",
        vi: "Thư của bạn đã sẵn sàng.",
        tl: "Handa na ang iyong liham."
    )
    static let errorGeneric = CivicaText(
        "We couldn't generate the letter. Try again in a moment.",
        es: "No pudimos generar la carta. Inténtalo de nuevo en un momento.",
        zh: "我们无法生成这封信。请稍后再试。",
        vi: "Chúng tôi không thể tạo thư. Hãy thử lại sau giây lát.",
        tl: "Hindi namin nagawa ang liham. Subukan ulit sa ilang sandali."
    )
    static let retry = CivicaText(
        "Try again",
        es: "Inténtalo de nuevo",
        zh: "再试一次",
        vi: "Thử lại",
        tl: "Subukan ulit"
    )

    static let nextStepsHeading = CivicaText(
        "What to do next",
        es: "Qué hacer ahora",
        zh: "接下来怎么做",
        vi: "Bước tiếp theo cần làm",
        tl: "Ano ang susunod na gagawin"
    )
    static func nextStepsBodyText(language: CivicaLanguage, stateCode: String?) -> String {
        let address = SNAPAgencyDirectory.hearingOfficeInlineAddress(for: stateCode, language: language)
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalSentence: String
        if !portal.isEmpty {
            switch language {
            case .english:
                portalSentence = " You can also submit a hearing request through \(portal)."
            case .spanish:
                portalSentence = " También puedes solicitar una audiencia a través de \(portal)."
            case .mandarin:
                portalSentence = "你也可以通过 \(portal) 提交听证申请。"
            case .vietnamese:
                portalSentence = " Bạn cũng có thể gửi yêu cầu điều trần qua \(portal)."
            case .tagalog:
                portalSentence = " Puwede mo ring isumite ang request para sa hearing sa pamamagitan ng \(portal)."
            }
        } else {
            portalSentence = ""
        }
        switch language {
        case .english:
            return "Save the PDF, print it, sign it, fill in your name and address by hand, then mail or hand-deliver to \(address).\(portalSentence)"
        case .spanish:
            return "Guarda el PDF, imprímelo, fírmalo, completa tu nombre y dirección a mano, y luego envíalo por correo o entrégalo en persona en \(address).\(portalSentence)"
        case .mandarin:
            return "保存 PDF、打印出来、签名,手写填上你的姓名和地址,然后邮寄或亲自送交至\(address)。\(portalSentence)"
        case .vietnamese:
            return "Lưu tệp PDF, in ra, ký tên, viết tay tên và địa chỉ của bạn, rồi gửi qua bưu điện hoặc trực tiếp đến \(address).\(portalSentence)"
        case .tagalog:
            return "I-save ang PDF, i-print, pirmahan, sulatan ng iyong pangalan at address, pagkatapos ay i-mail o personal na ihatid sa \(address).\(portalSentence)"
        }
    }

    static func openOnlinePortalText(language: CivicaLanguage, stateCode: String?) -> String {
        let stateLabel: String
        switch (stateCode ?? SNAPAgencyDirectory.launchStateCode).uppercased() {
        case "CA":
            switch language {
            case .english:
                stateLabel = "CDSS"
            case .spanish:
                stateLabel = "del CDSS"
            case .mandarin:
                stateLabel = "CDSS"
            case .vietnamese:
                stateLabel = "CDSS"
            case .tagalog:
                stateLabel = "CDSS"
            }
        case "MA":
            switch language {
            case .english:
                stateLabel = "DTA"
            case .spanish:
                stateLabel = "del DTA"
            case .mandarin:
                stateLabel = "DTA"
            case .vietnamese:
                stateLabel = "DTA"
            case .tagalog:
                stateLabel = "DTA"
            }
        default:
            switch language {
            case .english:
                stateLabel = "state SNAP"
            case .spanish:
                stateLabel = "estatal de SNAP"
            case .mandarin:
                stateLabel = "州 SNAP"
            case .vietnamese:
                stateLabel = "SNAP tiểu bang"
            case .tagalog:
                stateLabel = "SNAP ng estado"
            }
        }
        switch language {
        case .english:
            return "Open the \(stateLabel) fair-hearing page online"
        case .spanish:
            return "Abrir la página de audiencia justa \(stateLabel) en línea"
        case .mandarin:
            return "在线打开 \(stateLabel) 公平听证页面"
        case .vietnamese:
            return "Mở trang điều trần công bằng \(stateLabel) trực tuyến"
        case .tagalog:
            return "Buksan ang online na fair-hearing page ng \(stateLabel)"
        }
    }

    static let share = CivicaText(
        "Save or share my letter",
        es: "Guardar o compartir mi carta",
        zh: "保存或分享我的信件",
        vi: "Lưu hoặc chia sẻ thư của tôi",
        tl: "I-save o i-share ang aking liham"
    )
    static let done = CivicaText(
        "Done for now",
        es: "Listo por ahora",
        zh: "暂时完成",
        vi: "Tạm xong",
        tl: "Tapos na muna"
    )
}
