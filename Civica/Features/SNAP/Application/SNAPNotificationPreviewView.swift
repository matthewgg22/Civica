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

struct SNAPNotificationPreviewView: View {
    let language: CivicaLanguage

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                previewOnlyBanner
                emailsSection
                smsSection
                rulesFooter
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
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

    // MARK: - Preview-only banner

    private var previewOnlyBanner: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: "clock.fill")
                .foregroundStyle(CivicaColors.warningAmber)
                .accessibilityHidden(true)
            Text(SNAPNotificationPreviewStrings.previewOnlyNotice.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.statusWarningSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
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
                Text(template.subject.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(template.preheader.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.paper)

            Divider().background(CivicaColors.hairline)

            // Body stanzas
            VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                ForEach(Array(template.body.enumerated()), id: \.offset) { _, stanza in
                    Text(stanza.value(in: language))
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if let buttonLabel = template.buttonLabel {
                    Text(buttonLabel.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.onPrimaryText)
                        .padding(.horizontal, CivicaSpacing.lg)
                        .padding(.vertical, CivicaSpacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: CivicaRadius.control)
                                .fill(CivicaColors.brickPrimary)
                        )
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

    // MARK: - SMS section

    private var smsSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            channelHeading(
                icon: "message.fill",
                accent: CivicaColors.accentTeal,
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
            Text(template.subject.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.0)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(SNAPNotificationPreviewStrings.smsSenderLabel.value(in: language))
                    .font(CivicaTypography.caption.monospacedDigit())
                    .foregroundStyle(CivicaColors.graphite)
                ForEach(Array(template.body.enumerated()), id: \.offset) { _, stanza in
                    smsBubble(stanza.value(in: language))
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

    private func smsBubble(_ text: String) -> some View {
        Text(text)
            .font(CivicaTypography.body)
            .foregroundStyle(CivicaColors.onPrimaryText)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.sm)
            .background(CivicaColors.accentTeal)
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

    // MARK: - Rules footer

    /// Civica's notification rules — the ones from HANDOFF that
    /// shape every template. Showing them on the same screen the
    /// user reads the templates makes the "we promise X" / "the
    /// templates do X" pair verifiable.
    private var rulesFooter: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPNotificationPreviewStrings.rulesHeading.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.0)
            ForEach(SNAPNotificationPreviewStrings.rules(language: language), id: \.self) { rule in
                HStack(alignment: .top, spacing: CivicaSpacing.sm) {
                    Text("·")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.accentTeal)
                        .accessibilityHidden(true)
                    Text(rule)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
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
}

// MARK: - Strings

enum SNAPNotificationPreviewStrings {

    static let eyebrow = CivicaText(
        "Notifications",
        es: "Notificaciones"
    )
    static let title = CivicaText(
        "What you'll hear from us.",
        es: "Lo que recibirás de nosotros."
    )
    static let subtitle = CivicaText(
        "Every email and text Civica will send you, in the actual voice we'll use. No marketing, no surprises.",
        es: "Cada correo y mensaje que Civica te enviará, en la voz exacta que usaremos. Sin marketing, sin sorpresas."
    )

    static let previewOnlyNotice = CivicaText(
        "These are examples only. Notifications will be sent once Civica's messaging system is live.",
        es: "Estos son solo ejemplos. Las notificaciones se enviarán una vez que el sistema de mensajería de Civica esté activo."
    )

    static let emailHeading = CivicaText(
        "Emails — the record",
        es: "Correos — el registro"
    )
    static let smsHeading = CivicaText(
        "Texts — the moment",
        es: "Mensajes — el momento"
    )
    static let smsSenderLabel = CivicaText(
        "Civica · short code, US only",
        es: "Civica · código corto, solo EE. UU."
    )
    static let emailFooter = CivicaText(
        "Civica · Reply to reach a person · Unsubscribe anywhere",
        es: "Civica · Responde para hablar con una persona · Cancelar la suscripción en cualquier momento"
    )

    static let rulesHeading = CivicaText(
        "How Civica writes notifications",
        es: "Cómo escribe Civica las notificaciones"
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
        case .spanish:
            return [
                "Cada mensaje nombra la próxima acción y el horizonte de tiempo.",
                "Los asuntos de correo son titulares — se ven completos en tu bandeja.",
                "Un botón por mensaje, o ninguno. Nunca una multitud de llamadas a la acción.",
                "Responder llega a una persona. Nunca enviamos desde noreply@.",
                "STOP se respeta en el primer mensaje — nunca escondido.",
                "\"Ahora no\" es una respuesta de primera clase. Retrocedemos cuando lo dices.",
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
