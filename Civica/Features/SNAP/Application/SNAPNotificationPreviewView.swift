import CivicaDesignSystem
import SwiftUI

// Surface inside the privacy screen where users can browse the
// canonical emails + texts Civica will send them. Honest preview:
// "here's what you'll hear from us, in what voice, for which
// moments." Builds trust before the backend ever fires the first
// real message.
//
// Renders each CivicaNotificationTemplate as a card that approximates
// the email-row / SMS-bubble visual from the canvas mocks. Template
// parameters render as {placeholder} so the user understands what
// gets substituted with their actual data.

// MARK: - AccessibilityElement = parent
struct SNAPNotificationPreviewView: View {
    let language: CivicaLanguage

    /// USPS state code used to substitute the `{agency}` / `{agencyFull}`
    /// / `{portal}` tokens in each template's body. Resolves from the
    /// persisted draft at view-construction time; nil falls back to the
    /// launch state via SNAPAgencyDirectory.
    private var previewStateCode: String? {
        SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                previewOnlyNotice
                emailsSection
                smsSection
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
    }

    /// Substitute the preview-only tokens (deadline / recertDate /
    /// monthlyBenefit / etc.) with concrete example values so the
    /// preview reads as a finished message instead of a broken
    /// template. Tokens replaced server-side at production time —
    /// this is purely for the in-app preview.
    private func renderPreview(_ text: CivicaText) -> String {
        let rendered = CivicaNotificationTemplates.render(
            text,
            stateCode: previewStateCode,
            language: language
        )
        return rendered
            .replacingOccurrences(of: "{deadline}", with: "Jun 24, 2026")
            .replacingOccurrences(of: "{recertDate}", with: "Mar 1, 2027")
            .replacingOccurrences(of: "{monthlyBenefit}", with: "232")
            .replacingOccurrences(of: "{annualBenefit}", with: "$2,784")
            .replacingOccurrences(of: "{householdSize}", with: "3")
            .replacingOccurrences(of: "{ebtArrivalWindow}", with: "Jun 6-9")
            .replacingOccurrences(of: "{session}", with: "preview")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPNotificationPreviewStrings.eyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(SNAPNotificationPreviewStrings.title.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(SNAPNotificationPreviewStrings.subtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Preview-only notice

    /// One-line caption instead of the earlier amber-tinted chip. The
    /// chip read as a warning/error; a quiet caption keeps the same
    /// disclosure without flagging the screen as broken.
    private var previewOnlyNotice: some View {
        Text(SNAPNotificationPreviewStrings.previewOnlyNotice.value(in: language))
            .font(CivicaTypography.footnote)
            .foregroundStyle(CivicaColors.graphite)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Email section

    private var emailsSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            channelHeading(
                icon: "envelope.fill",
                accent: CivicaColors.ink,
                title: SNAPNotificationPreviewStrings.emailHeading.value(in: language)
            )
            ForEach(emailKinds) { kind in
                emailCard(CivicaNotificationTemplates.template(for: kind))
            }
        }
    }

    private var emailKinds: [CivicaNotificationKind] {
        CivicaNotificationKind.allCases.filter { $0.channel == .email }
    }

    private func emailCard(_ template: CivicaNotificationTemplate) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Inbox-row preview header
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text("Civica · hello@civica.us")
                    .font(CivicaTypography.caption.monospacedDigit())
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(0.6)
                Text(renderPreview(template.subject))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(renderPreview(template.preheader))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.paper)

            Divider().background(CivicaColors.hairline)

            // Body stanzas. Email previews are read-only transcripts —
            // we no longer render the template's CTA button inline (a
            // pine "See your status" button inside a preview card read
            // as interactive, mixing metaphors). The button label
            // shows up at the end of the body as a small footer line
            // so the user still knows the action exists.
            VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                ForEach(Array(template.body.enumerated()), id: \.offset) { _, stanza in
                    stanzaContent(renderPreview(stanza))
                }
                if let buttonLabel = template.buttonLabel {
                    // Arrow is a decorative SF Symbol, not a string
                    // literal, so the only text here is the already-
                    // localized button label.
                    HStack(spacing: CivicaSpacing.xs) {
                        Image(systemName: "arrow.right")
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.pinePrimary)
                            .accessibilityHidden(true)
                        Text(buttonLabel.value(in: language))
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.pinePrimary)
                    }
                    .padding(.top, CivicaSpacing.xs)
                }
                Text(SNAPNotificationPreviewStrings.emailFooter.value(in: language))
                    .font(CivicaTypography.caption.monospacedDigit())
                    .foregroundStyle(CivicaColors.graphite)
                    .padding(.top, CivicaSpacing.xs)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white)
        }
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    /// Renders one body stanza. If the stanza contains bullet markers
    /// (`\n  • ` or `\n• `), splits the intro from the bullet block
    /// and renders the bullets as a proper VStack of
    /// HStack(bullet, text) rows with hanging indent. Plain stanzas
    /// fall through as a single Text. Closes the "raw markdown
    /// bullets show up flush-left" issue device QA flagged.
    @ViewBuilder
    private func stanzaContent(_ text: String) -> some View {
        let lines = text.components(separatedBy: "\n")
        let bulletIndex = lines.firstIndex(where: { isBulletLine($0) })
        if let bulletIndex {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                let intro = lines[0..<bulletIndex]
                    .joined(separator: "\n")
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if !intro.isEmpty {
                    Text(intro)
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                let bullets = lines[bulletIndex...]
                    .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                    .map { stripBullet($0) }
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    ForEach(Array(bullets.enumerated()), id: \.offset) { _, item in
                        HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                            Text("•")
                                .font(CivicaTypography.body)
                                .foregroundStyle(CivicaColors.pinePrimary)
                                .accessibilityHidden(true)
                            Text(item)
                                .font(CivicaTypography.body)
                                .foregroundStyle(CivicaColors.ink)
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .padding(.leading, CivicaSpacing.xs)
            }
        } else {
            Text(text)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func isBulletLine(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        return trimmed.hasPrefix("•")
    }

    private func stripBullet(_ line: String) -> String {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.hasPrefix("•") {
            return String(trimmed.dropFirst()).trimmingCharacters(in: .whitespaces)
        }
        return trimmed
    }

    // MARK: - SMS section

    private var smsSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            channelHeading(
                icon: "message.fill",
                accent: CivicaColors.amberPrimary,
                title: SNAPNotificationPreviewStrings.smsHeading.value(in: language)
            )
            ForEach(smsKinds) { kind in
                smsCard(CivicaNotificationTemplates.template(for: kind))
            }
        }
    }

    private var smsKinds: [CivicaNotificationKind] {
        CivicaNotificationKind.allCases.filter { $0.channel == .sms }
    }

    private func smsCard(_ template: CivicaNotificationTemplate) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(renderPreview(template.subject))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.0)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(SNAPNotificationPreviewStrings.smsSenderLabel.value(in: language))
                    .font(CivicaTypography.caption.monospacedDigit())
                    .foregroundStyle(CivicaColors.graphite)
                ForEach(Array(template.body.enumerated()), id: \.offset) { _, stanza in
                    smsBubble(renderPreview(stanza))
                }
                if let buttonLabel = template.buttonLabel,
                   let url = template.buttonURLHint {
                    smsBubble("\(buttonLabel.value(in: language)) — \(url)")
                }
            }
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

    /// SMS bubble — pine TINT background (not solid pine fill) + ink
    /// text. Closer to iOS Messages convention (light tinted bubbles)
    /// than the earlier solid pine bricks, which made the SMS section
    /// read as a wall of pine.
    private func smsBubble(_ text: String) -> some View {
        Text(text)
            .font(CivicaTypography.body)
            .foregroundStyle(CivicaColors.ink)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.sm)
            .background(CivicaColors.pinePrimary.opacity(0.10))
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Channel heading

    private func channelHeading(icon: String, accent: Color, title: String) -> some View {
        HStack(spacing: CivicaSpacing.sm) {
            Image(systemName: icon)
                .foregroundStyle(accent)
                .accessibilityHidden(true)
            Text(title)
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
        }
    }

    // The "How Civica writes notifications" footer was removed —
    // it was an internal style guide ("Every message names the
    // next action…") that didn't belong on a user-facing preview.
    // Rules still live in `SNAPNotificationPreviewStrings.rules` for
    // any future internal-only surface.
}

// MARK: - Strings

enum SNAPNotificationPreviewStrings {

    static let eyebrow = CivicaText(
        "Notifications",
        es: "Notificaciones",
        zh: "通知",
        vi: "Thông báo",
        tl: "Mga Notipikasyon"
    )
    static let title = CivicaText(
        "What you'll hear from us.",
        es: "Lo que recibirás de nosotros.",
        zh: "你会收到我们的哪些消息。",
        vi: "Những gì bạn sẽ nhận được từ chúng tôi.",
        tl: "Kung ano ang maririnig mo mula sa amin."
    )
    static let subtitle = CivicaText(
        "Every email and text Civica will send you, in the actual voice we'll use. No marketing, no surprises.",
        es: "Cada correo y mensaje que Civica te enviará, en la voz exacta que usaremos. Sin marketing, sin sorpresas.",
        zh: "Civica 会发给你的每一封邮件和短信,用的就是我们真正会用的语气。没有营销,没有意外。",
        vi: "Mọi email và tin nhắn mà Civica sẽ gửi cho bạn, đúng với giọng điệu chúng tôi thực sự dùng. Không tiếp thị, không bất ngờ.",
        tl: "Bawat email at text na ipapadala sa iyo ng Civica, sa totoong tono na gagamitin namin. Walang marketing, walang sorpresa."
    )

    static let previewOnlyNotice = CivicaText(
        "These are examples only. Notifications will be sent once Civica's messaging system is live.",
        es: "Estos son solo ejemplos. Las notificaciones se enviarán una vez que el sistema de mensajería de Civica esté activo.",
        zh: "这些只是示例。等 Civica 的消息系统上线后,我们才会真正发送通知。",
        vi: "Đây chỉ là ví dụ. Thông báo sẽ được gửi khi hệ thống nhắn tin của Civica hoạt động.",
        tl: "Mga halimbawa lang ito. Ipapadala ang mga notipikasyon kapag live na ang messaging system ng Civica."
    )

    static let emailHeading = CivicaText(
        "Emails — the record",
        es: "Correos — el registro",
        zh: "邮件 — 留底记录",
        vi: "Email — bản lưu",
        tl: "Mga Email — ang talaan"
    )
    static let smsHeading = CivicaText(
        "Texts — the moment",
        es: "Mensajes — el momento",
        zh: "短信 — 即时提醒",
        vi: "Tin nhắn — nhắc đúng lúc",
        tl: "Mga Text — ang sandali"
    )
    static let smsSenderLabel = CivicaText(
        "Civica · short code, US only",
        es: "Civica · código corto, solo EE. UU.",
        zh: "Civica · 短代码,仅限美国",
        vi: "Civica · mã ngắn, chỉ ở Mỹ",
        tl: "Civica · short code, US lang"
    )
    static let emailFooter = CivicaText(
        "Civica · Reply to reach a person · Unsubscribe anywhere",
        es: "Civica · Responde para hablar con una persona · Cancelar la suscripción en cualquier momento",
        zh: "Civica · 回复即可联系到真人 · 随时可退订",
        vi: "Civica · Trả lời để gặp người thật · Hủy đăng ký ở bất cứ đâu",
        tl: "Civica · Mag-reply para makausap ang tao · Mag-unsubscribe kahit saan"
    )

    static let rulesHeading = CivicaText(
        "How Civica writes notifications",
        es: "Cómo escribe Civica las notificaciones",
        zh: "Civica 如何撰写通知",
        vi: "Cách Civica viết thông báo",
        tl: "Paano nagsusulat ng mga notipikasyon ang Civica"
    )

    static func rules(language: CivicaLanguage) -> [String] {
        switch language {
        case .english:
            return [
                "Every message names the next action and the time horizon.",
                "Email subjects are headlines — they render complete in your inbox.",
                "One button per message, or none. Never a CTA forest.",
                "Reply-to reaches a human. We never send from noreply@.",
                "STOP is honored in the first text — never buried.",
                "\"Not now\" is a first-class reply. We back off when you say so.",
            ]
        case .tagalog:
            return [
                "Bawat mensahe ay binabanggit ang susunod na hakbang at ang takdang panahon.",
                "Ang mga subject ng email ay mga headline — kumpletong nababasa sa iyong inbox.",
                "Isang button bawat mensahe, o wala. Hindi kailanman puro CTA.",
                "Ang reply-to ay umaabot sa tunay na tao. Hindi kami nagpapadala mula sa noreply@.",
                "Iginagalang ang STOP sa unang text — hindi kailanman itinatago.",
                "Ang “Hindi muna” ay tanggap na sagot. Umuurong kami kapag sinabi mo iyon.",
            ]
        case .mandarin:
            return [
                "每条消息都会写明下一步要做什么,以及时间期限。",
                "邮件主题就是标题 — 在你的收件箱里能完整显示。",
                "每条消息只放一个按钮,或者一个都不放。绝不堆一堆行动按钮。",
                "回复邮件能联系到真人。我们绝不用 noreply@ 发送。",
                "在第一条短信里就尊重 STOP 退订 — 绝不藏起来。",
                "「现在不行」也是一种正式回复。你这样说,我们就退一步。",
            ]
        case .spanish:
            return [
                "Cada mensaje nombra la próxima acción y el horizonte de tiempo.",
                "Los asuntos de correo son titulares — se ven completos en tu bandeja.",
                "Un botón por mensaje, o ninguno. Nunca una multitud de llamadas a la acción.",
                "Responder llega a una persona. Nunca enviamos desde noreply@.",
                "STOP se respeta en el primer mensaje — nunca escondido.",
                "\"Ahora no\" es una respuesta de primera clase. Retrocedemos cuando lo dices.",
            ]
        case .vietnamese:
            return [
                "Mỗi tin nhắn đều nêu rõ bước tiếp theo và thời hạn.",
                "Tiêu đề email chính là dòng tóm tắt — hiển thị đầy đủ trong hộp thư của bạn.",
                "Mỗi tin nhắn chỉ một nút, hoặc không có nút nào. Không bao giờ là một rừng nút hành động.",
                "Trả lời email sẽ gặp được người thật. Chúng tôi không bao giờ gửi từ noreply@.",
                "STOP được tôn trọng ngay trong tin nhắn đầu tiên — không bao giờ giấu đi.",
                "“Chưa phải lúc” cũng là một câu trả lời đầy đủ. Bạn nói vậy là chúng tôi lùi lại.",
            ]
        }
    }
}

#if DEBUG
struct SNAPNotificationPreviewView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SNAPNotificationPreviewView(language: .english)
        }
    }
}
#endif
