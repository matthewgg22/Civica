import CivicaDesignSystem
import SwiftUI
import UIKit

// HANDOFF-cadence wrapper around SNAPApplicationDraftPDFRenderer.
// Renders the PDF on appear, surfaces "Save or share" via the system
// share sheet (UIActivityViewController), advances the status store
// to .packetGenerated on first successful render.
//
// Reached from SNAPDecisionMathView's "Continue to packet" CTA after
// the orchestrator's verdict step. The official MA DTA SNAP-1 form
// fill remains a backend job — this view ships the v1 "personal
// reference document" path until the backend HTTP layer wires up.

struct SNAPApplicationPacketView: View {
    let draft: SNAPApplicationDraft
    let language: CivicaLanguage
    let onClose: () -> Void

    @EnvironmentObject private var statusStore: SNAPApplicationStatusStore
    @State private var phase: Phase = .idle
    @State private var isShareSheetPresented = false

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
                    walkthrough
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
    }

    // MARK: - Header

    private var eyebrow: some View {
        Text(SNAPApplicationPacketStrings.eyebrow.value(in: language))
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.graphite)
            .textCase(.uppercase)
            .kerning(1.2)
    }

    private var title: some View {
        Text(SNAPApplicationPacketStrings.title.value(in: language))
            .font(CivicaTypography.pageTitle)
            .foregroundStyle(CivicaColors.ink)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }

    private var body_: some View {
        Text(SNAPApplicationPacketStrings.body.value(in: language))
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
                Text(SNAPApplicationPacketStrings.generating.value(in: language))
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
                Text(SNAPApplicationPacketStrings.ready.value(in: language))
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
                Button(SNAPApplicationPacketStrings.retry.value(in: language)) {
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

    // MARK: - Walkthrough

    /// Brief reminder that this is a personal reference, not a real
    /// submission. The official path is DTA Connect.
    private var walkthrough: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPApplicationPacketStrings.walkthroughHeading.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            Text(SNAPApplicationPacketStrings.walkthroughBody.value(in: language))
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
        }
    }

    // MARK: - Action footer

    private var actionFooter: some View {
        VStack(spacing: CivicaSpacing.sm) {
            CivicaPrimaryButton(
                SNAPApplicationPacketStrings.share.value(in: language),
                isEnabled: { if case .ready = phase { return true }; return false }(),
                action: { isShareSheetPresented = true }
            )
            CivicaSecondaryButton(
                title: SNAPApplicationPacketStrings.done.value(in: language),
                action: onClose
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

    // MARK: - PDF generation

    private func generate() async {
        phase = .generating
        do {
            let url = try SNAPApplicationDraftPDFRenderer.render(draft, language: language)
            phase = .ready(url)
            // Advance status only once per session. Subsequent
            // regenerations don't re-advance — status moves forward
            // through real state transitions (submit, decision, etc.),
            // not by re-rendering the same PDF.
            if statusStore.status == .screenerComplete {
                statusStore.advance(to: .packetGenerated)
            }
        } catch {
            phase = .error(SNAPApplicationPacketStrings.errorGeneric.value(in: language))
        }
    }
}

// MARK: - System share sheet wrap

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Strings

enum SNAPApplicationPacketStrings {

    static let eyebrow = CivicaText(
        "Application packet",
        es: "Paquete de solicitud"
    )
    static let title = CivicaText(
        "Your SNAP application summary is ready to save or share",
        es: "Tu resumen de solicitud de SNAP está listo para guardar o compartir"
    )
    static let body = CivicaText(
        "We turned your answers into a PDF you can save to Files, email to a SNAP navigator, or print and bring to a DTA office.",
        es: "Convertimos tus respuestas en un PDF que puedes guardar en Archivos, enviar por correo a un asesor de SNAP o imprimir y llevar a una oficina del DTA."
    )

    static let generating = CivicaText(
        "Putting your packet together…",
        es: "Preparando tu paquete…"
    )
    static let ready = CivicaText(
        "Your packet is ready.",
        es: "Tu paquete está listo."
    )
    static let errorGeneric = CivicaText(
        "We couldn't generate the PDF. Try again in a moment.",
        es: "No pudimos generar el PDF. Inténtalo de nuevo en un momento."
    )
    static let retry = CivicaText(
        "Try again",
        es: "Inténtalo de nuevo"
    )

    static let walkthroughHeading = CivicaText(
        "What to do with this",
        es: "Qué hacer con esto"
    )
    static let walkthroughBody = CivicaText(
        "This PDF is a reference document — it's not the official application. To file, open DTA Connect and use this PDF as your guide, or hand it to a navigator who can help.",
        es: "Este PDF es un documento de referencia — no es la solicitud oficial. Para presentarla, abre DTA Connect y usa este PDF como guía, o entrégaselo a un asesor que pueda ayudarte."
    )

    static let share = CivicaText(
        "Save or share my packet",
        es: "Guardar o compartir mi paquete"
    )
    static let done = CivicaText(
        "Done for now",
        es: "Listo por ahora"
    )
}
