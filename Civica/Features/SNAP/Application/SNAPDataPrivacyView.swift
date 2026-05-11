import CivicaDesignSystem
import SwiftUI

// HANDOFF MobilePrivacyBoard · screen 1 — "Your data" settings
// landing. Plain-English inventory of what Civica has stored on the
// user + who's seen it + paths to Download or Delete.
//
// Brand-voice rule from the board: "Most apps treat data deletion
// as a punishment — warnings in red, scary modals, are you really
// really sure? Civica treats it as a reasonable request from
// someone with reasonable concerns." No destructive-modal pattern,
// no friction beyond the explanation screen.

struct SNAPDataPrivacyView: View {
    let language: CivicaLanguage

    @State private var inventory: CivicaUserData.Inventory = CivicaUserData.currentInventory()
    @State private var downloadURL: URL?
    @State private var isShareSheetPresented: Bool = false
    @State private var downloadError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                eyebrow
                header
                whatWeHaveCard
                whosSeenItCard
                actionRows
                if let error = downloadError {
                    Text(error)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.destructive)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { inventory = CivicaUserData.currentInventory() }
        .sheet(isPresented: $isShareSheetPresented) {
            if let url = downloadURL {
                DataPrivacyShareSheet(items: [url])
            }
        }
    }

    // MARK: - Header

    private var eyebrow: some View {
        Text(SNAPDataPrivacyStrings.eyebrow.value(in: language))
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.graphite)
            .textCase(.uppercase)
            .kerning(1.2)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPDataPrivacyStrings.title.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(SNAPDataPrivacyStrings.subtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - "What we have" card

    private var whatWeHaveCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(SNAPDataPrivacyStrings.whatWeHaveHeading.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.0)

            VStack(spacing: 0) {
                inventoryRow(
                    label: SNAPDataPrivacyStrings.rowApplicationAnswers.value(in: language),
                    detail: SNAPDataPrivacyStrings.sectionsCompleted(
                        completed: inventory.completedSections,
                        total: inventory.totalSections,
                        language: language
                    )
                )
                Divider().background(CivicaColors.hairline)
                inventoryRow(
                    label: SNAPDataPrivacyStrings.rowDocuments.value(in: language),
                    detail: SNAPDataPrivacyStrings.photosOnDevice(
                        count: inventory.capturedDocumentCount,
                        language: language
                    )
                )
                Divider().background(CivicaColors.hairline)
                inventoryRow(
                    label: SNAPDataPrivacyStrings.rowLanguage.value(in: language),
                    detail: languageDisplayName
                )
                Divider().background(CivicaColors.hairline)
                inventoryRow(
                    label: SNAPDataPrivacyStrings.rowStatus.value(in: language),
                    detail: SNAPDataPrivacyStrings.statusLabel(
                        status: inventory.status,
                        language: language
                    )
                )
            }
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
    }

    private func inventoryRow(label: String, detail: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
            Spacer(minLength: CivicaSpacing.md)
            Text(detail)
                .font(CivicaTypography.footnoteStrong.monospacedDigit())
                .foregroundStyle(CivicaColors.graphite)
        }
        .padding(.horizontal, CivicaSpacing.lg)
        .padding(.vertical, CivicaSpacing.md)
    }

    private var languageDisplayName: String {
        (CivicaLanguage(rawValue: inventory.languageRaw) ?? .english).displayName
    }

    // MARK: - "Who's seen it" card

    private var whosSeenItCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(SNAPDataPrivacyStrings.whosSeenItHeading.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.0)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                if inventory.hasBeenSubmittedToState {
                    Text(SNAPDataPrivacyStrings.sharedWithStateTitle.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    Text(SNAPDataPrivacyStrings.sharedWithStateBody.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    Text(SNAPDataPrivacyStrings.nothingSharedTitle.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    Text(SNAPDataPrivacyStrings.nothingSharedBody.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
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

    // MARK: - Action rows

    private var actionRows: some View {
        VStack(spacing: CivicaSpacing.sm) {
            Button(action: triggerDownload) {
                actionRow(
                    title: SNAPDataPrivacyStrings.downloadCopy.value(in: language),
                    accent: CivicaColors.ink
                )
            }
            .buttonStyle(.plain)

            NavigationLink {
                SNAPDataDeletionView(language: language)
            } label: {
                actionRow(
                    title: SNAPDataPrivacyStrings.deleteEverything.value(in: language),
                    accent: CivicaColors.brickPrimary
                )
            }
            .buttonStyle(.plain)
        }
    }

    private func actionRow(title: String, accent: Color) -> some View {
        HStack {
            Text(title)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(accent)
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(accent)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, CivicaSpacing.lg)
        .padding(.vertical, CivicaSpacing.md)
        .frame(minHeight: 56)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    // MARK: - Download

    private func triggerDownload() {
        downloadError = nil
        // Reuse the application-packet renderer so users get the same
        // PDF they'd export at packet-generation time. Their answers
        // get materialized exactly as Civica has them.
        let draftStore = SNAPApplicationDraftStore()
        let draft = draftStore.load()?.draft ?? SNAPApplicationDraft()
        do {
            let url = try SNAPApplicationDraftPDFRenderer.render(draft, language: language)
            downloadURL = url
            isShareSheetPresented = true
        } catch {
            downloadError = SNAPDataPrivacyStrings.downloadError.value(in: language)
        }
    }
}

// MARK: - Share sheet

private struct DataPrivacyShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Strings

enum SNAPDataPrivacyStrings {

    static let eyebrow = CivicaText("Your data", es: "Tus datos")
    static let title = CivicaText(
        "What we have. Who's seen it.",
        es: "Lo que tenemos. Quién lo ha visto."
    )
    static let subtitle = CivicaText(
        "Plain English, on this screen, every time you ask. No emails, no support tickets.",
        es: "En lenguaje claro, en esta pantalla, cada vez que preguntes. Sin correos electrónicos, sin tickets de soporte."
    )

    // What we have card
    static let whatWeHaveHeading = CivicaText(
        "What we have on you",
        es: "Lo que tenemos de ti"
    )
    static let rowApplicationAnswers = CivicaText(
        "Application answers",
        es: "Respuestas de la solicitud"
    )
    static let rowDocuments = CivicaText(
        "Documents",
        es: "Documentos"
    )
    static let rowLanguage = CivicaText(
        "Language preference",
        es: "Idioma preferido"
    )
    static let rowStatus = CivicaText(
        "Application status",
        es: "Estado de la solicitud"
    )

    static func sectionsCompleted(completed: Int, total: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return completed == 0
            ? "Nothing yet"
            : "\(completed) of \(total) sections"
        case .spanish: return completed == 0
            ? "Nada todavía"
            : "\(completed) de \(total) secciones"
        }
    }

    static func photosOnDevice(count: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return count == 0
            ? "None on device"
            : (count == 1 ? "1 photo on device" : "\(count) photos on device")
        case .spanish: return count == 0
            ? "Ninguno en el dispositivo"
            : (count == 1 ? "1 foto en el dispositivo" : "\(count) fotos en el dispositivo")
        }
    }

    static func statusLabel(status: SNAPApplicationStatus, language: CivicaLanguage) -> String {
        switch (status, language) {
        case (.notStarted, .english):              return "Not started"
        case (.notStarted, .spanish):              return "No iniciado"
        case (.screenerInProgress, .english):      return "Screener in progress"
        case (.screenerInProgress, .spanish):      return "Evaluación en curso"
        case (.screenerComplete, .english):        return "Screener complete"
        case (.screenerComplete, .spanish):        return "Evaluación completada"
        case (.packetGenerated, .english):         return "Packet generated"
        case (.packetGenerated, .spanish):         return "Paquete generado"
        case (.submittedToState, .english):        return "Submitted to DTA"
        case (.submittedToState, .spanish):        return "Enviado al DTA"
        case (.documentsRequested, .english):      return "Documents requested by DTA"
        case (.documentsRequested, .spanish):      return "Documentos solicitados por el DTA"
        case (.interviewScheduled, .english):      return "Interview scheduled"
        case (.interviewScheduled, .spanish):      return "Entrevista programada"
        case (.interviewCompleted, .english):      return "Interview completed"
        case (.interviewCompleted, .spanish):      return "Entrevista completada"
        case (.decisionApproved, .english):        return "Approved"
        case (.decisionApproved, .spanish):        return "Aprobado"
        case (.decisionDenied, .english):          return "Denied"
        case (.decisionDenied, .spanish):          return "Denegado"
        case (.recertDue, .english):               return "Recertification due"
        case (.recertDue, .spanish):               return "Recertificación pendiente"
        }
    }

    // Who's seen it card
    static let whosSeenItHeading = CivicaText(
        "Who's seen it",
        es: "Quién lo ha visto"
    )
    static let nothingSharedTitle = CivicaText(
        "Nothing has left this device",
        es: "Nada ha salido de este dispositivo"
    )
    static let nothingSharedBody = CivicaText(
        "Your answers, documents, and status all live on this phone only. Civica hasn't shared anything with anyone yet.",
        es: "Tus respuestas, documentos y estado solo viven en este teléfono. Civica aún no ha compartido nada con nadie."
    )
    static let sharedWithStateTitle = CivicaText(
        "Massachusetts DTA has your application",
        es: "El DTA de Massachusetts tiene tu solicitud"
    )
    static let sharedWithStateBody = CivicaText(
        "Once an application is submitted to DTA Connect, it becomes the state's record. Civica can't pull that back — only DTA can change or close it.",
        es: "Una vez que la solicitud se envía a DTA Connect, se convierte en el registro del estado. Civica no puede recuperarla — solo el DTA puede cambiarla o cerrarla."
    )

    // Action rows
    static let downloadCopy = CivicaText(
        "Download a copy",
        es: "Descargar una copia"
    )
    static let deleteEverything = CivicaText(
        "Delete everything",
        es: "Eliminar todo"
    )

    static let downloadError = CivicaText(
        "We couldn't prepare the download. Try again in a moment.",
        es: "No pudimos preparar la descarga. Inténtalo de nuevo en un momento."
    )
}

#if DEBUG
struct SNAPDataPrivacyView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SNAPDataPrivacyView(language: .english)
        }
    }
}
#endif
