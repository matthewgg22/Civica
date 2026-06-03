import CivicaDesignSystem
import SwiftUI

// Review-and-edit screen for the generated appeal. Shows the
// rendered document, surfaces any unfilled slots, lets the user
// edit free-form, and offers export actions.
//
// The user can:
//   - View the full appeal as it will be sent
//   - Edit any paragraph inline (modifies the body in-place; the
//     statutory citations + paragraph structure aren't re-rendered
//     after editing — that's intentional, the user owns the final
//     wording)
//   - Fill in missing slots via a "Fix missing fields" sheet
//   - Export to PDF, copy to clipboard, or open the state portal

struct AppealReviewView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    @Environment(\.dismiss) private var dismiss

    let initialDocument: AppealDocument
    let template: AppealTemplate
    let denialReason: DenialReason
    let initialSlots: [String: String]

    @State private var editedBody: String
    @State private var slots: [String: String]
    @State private var presentingFixSlots = false
    @State private var presentingExport = false

    init(
        initialDocument: AppealDocument,
        template: AppealTemplate,
        denialReason: DenialReason,
        initialSlots: [String: String]
    ) {
        self.initialDocument = initialDocument
        self.template = template
        self.denialReason = denialReason
        self.initialSlots = initialSlots
        _editedBody = State(initialValue: initialDocument.body)
        _slots = State(initialValue: initialSlots)
    }

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                header

                if !initialDocument.missingSlots.isEmpty {
                    missingSlotsCard
                }

                bodyEditor

                exportCTA
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(RecertCompanionStrings.appealReviewHeader.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $presentingFixSlots) {
            AppealFixSlotsView(
                slots: $slots,
                requested: initialDocument.missingSlots,
                language: language,
                onDone: regenerate
            )
        }
        .sheet(isPresented: $presentingExport) {
            AppealExportSheetView(
                appealText: editedBody,
                stateCode: template.stateCode,
                language: language
            )
        }
    }

    // MARK: - Pieces

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(template.agencyName)
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            Text(AppealReviewStrings.citationsLabel(
                federal: template.statutoryCitations.federal,
                state: template.statutoryCitations.state
            ).value(in: language))
            .font(CivicaTypography.footnote)
            .foregroundStyle(CivicaColors.graphite)
        }
    }

    private var missingSlotsCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(CivicaColors.brickAccent)
                Text(AppealReviewStrings.missingSlotsTitle.value(in: language))
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
            }
            Text(AppealReviewStrings.missingSlotsBody(count: initialDocument.missingSlots.count).value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
            Button(AppealReviewStrings.fixMissingCTA.value(in: language)) {
                presentingFixSlots = true
            }
            .font(CivicaTypography.footnoteStrong)
            .foregroundStyle(CivicaColors.brickAccent)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.brickSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    private var bodyEditor: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(AppealReviewStrings.draftHeader.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            TextEditor(text: $editedBody)
                .font(CivicaTypography.body)
                .frame(minHeight: 320)
                .padding(CivicaSpacing.sm)
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card)
                        .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                )
                .onChange(of: editedBody) { _, _ in
                    RecertCompanionAnalytics.trackAppealEdited(stateCode: template.stateCode)
                }
        }
    }

    private var exportCTA: some View {
        Button(action: {
            presentingExport = true
        }) {
            Text(RecertCompanionStrings.appealExportPDF.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(CivicaColors.brickAccent)
                )
        }
        .buttonStyle(.plain)
    }

    private func regenerate() {
        let document = AppealRenderer.render(
            template: template,
            denialReason: denialReason,
            slots: slots
        )
        editedBody = document.body
    }
}

// MARK: - Fix-slots sheet

private struct AppealFixSlotsView: View {
    @Environment(\.dismiss) private var dismiss

    @Binding var slots: [String: String]
    let requested: [String]
    let language: CivicaLanguage
    let onDone: () -> Void

    @State private var local: [String: String] = [:]

    var body: some View {
        NavigationStack {
            Form {
                ForEach(requested, id: \.self) { name in
                    TextField(label(for: name).value(in: language), text: bindingFor(name))
                }
            }
            .navigationTitle(AppealReviewStrings.fixMissingTitle.value(in: language))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(AppealReviewStrings.doneCTA.value(in: language)) {
                        for (key, value) in local where !value.isEmpty {
                            slots[key] = value
                        }
                        onDone()
                        dismiss()
                    }
                }
            }
            .onAppear {
                for name in requested where local[name] == nil {
                    local[name] = slots[name] ?? ""
                }
            }
        }
    }

    private func bindingFor(_ name: String) -> Binding<String> {
        Binding(
            get: { local[name] ?? "" },
            set: { local[name] = $0 }
        )
    }

    private func label(for slot: String) -> CivicaText {
        switch slot {
        case "caseNumber": return CivicaText("Case number", es: "Número de caso", zh: "案件编号")
        case "claimantName": return CivicaText("Full legal name", es: "Nombre legal completo", zh: "法定全名")
        case "denialDate": return CivicaText("Date of denial (YYYY-MM-DD)", es: "Fecha de denegación (AAAA-MM-DD)", zh: "拒绝日期（YYYY-MM-DD）")
        case "todayDate": return CivicaText("Today's date (YYYY-MM-DD)", es: "Fecha de hoy (AAAA-MM-DD)", zh: "今天的日期（YYYY-MM-DD）")
        case "claimantAddress": return CivicaText("Mailing address", es: "Dirección postal", zh: "邮寄地址")
        case "claimantPhone": return CivicaText("Phone", es: "Teléfono", zh: "电话")
        case "claimantEmail": return CivicaText("Email", es: "Correo electrónico", zh: "电子邮箱")
        default: return CivicaText(slot, es: slot)
        }
    }
}

enum AppealReviewStrings {
    static let draftHeader = CivicaText("Your appeal text", es: "Tu texto de apelación", zh: "你的申诉文本")

    static let missingSlotsTitle = CivicaText(
        "Some details are missing",
        es: "Faltan algunos datos",
        zh: "还缺少一些信息"
    )

    static func missingSlotsBody(count: Int) -> CivicaText {
        CivicaText(
            "You'll need to fill in \(count) more field\(count == 1 ? "" : "s") before sending. We've highlighted them in the text below.",
            es: "Necesitas completar \(count) campo\(count == 1 ? "" : "s") más antes de enviar. Los hemos marcado en el texto.",
            zh: "在发送之前，你还需要填写 \(count) 个字段。我们已在下面的文本中标出了它们。"
        )
    }

    static let fixMissingCTA = CivicaText(
        "Fix missing fields",
        es: "Completar los campos faltantes",
        zh: "补全缺失字段"
    )
    static let fixMissingTitle = CivicaText(
        "Fill in your details",
        es: "Completa tus datos",
        zh: "填写你的信息"
    )
    static let doneCTA = CivicaText("Done", es: "Listo", zh: "完成")

    static func citationsLabel(federal: String, state: String) -> CivicaText {
        CivicaText(
            "Citing \(federal) · \(state)",
            es: "Citando \(federal) · \(state)",
            zh: "引用 \(federal) · \(state)"
        )
    }
}
