import CivicaDesignSystem
import SwiftUI

// Migrates the legacy "documentsChecklistStep". Unlike the other
// migrated steps, this isn't really a question — it's a single
// confirmation surface where the user marks which documents they
// already have. It stays as one screen, but in the HANDOFF
// breathing-room cadence using CivicaQuestionScreen with a
// checklist-style affordance.
//
// No questions to skip / split; we keep the legacy semantics:
// document types are nudges, not requirements. The user can
// continue with nothing checked.

struct SNAPDocumentsChecklistAnswers: Equatable, Codable {
    var documentsAvailable: Set<SNAPDocumentType> = []
}

@MainActor
final class SNAPDocumentsChecklistFlowViewModel: ObservableObject {
    @Published var answers: SNAPDocumentsChecklistAnswers

    init(answers: SNAPDocumentsChecklistAnswers = .init()) {
        self.answers = answers
    }

    func toggle(_ document: SNAPDocumentType) {
        if answers.documentsAvailable.contains(document) {
            answers.documentsAvailable.remove(document)
        } else {
            answers.documentsAvailable.insert(document)
        }
    }
}

struct SNAPDocumentsChecklistFlowView: View {
    @StateObject var viewModel: SNAPDocumentsChecklistFlowViewModel
    let language: CivicaLanguage
    let onComplete: (SNAPDocumentsChecklistAnswers) -> Void
    let onExit: () -> Void

    init(
        viewModel: SNAPDocumentsChecklistFlowViewModel,
        language: CivicaLanguage = .english,
        onComplete: @escaping (SNAPDocumentsChecklistAnswers) -> Void,
        onExit: @escaping () -> Void
    ) {
        self._viewModel = StateObject(wrappedValue: viewModel)
        self.language = language
        self.onComplete = onComplete
        self.onExit = onExit
    }

    var body: some View {
        CivicaQuestionScreen(
            title: SNAPDocumentsChecklistStrings.title.value(in: language),
            helper: SNAPDocumentsChecklistStrings.helper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: true,
            onPrimary: { onComplete(viewModel.answers) },
            language: language
        ) {
            VStack(spacing: CivicaSpacing.sm) {
                ForEach(SNAPDocumentType.allCases) { document in
                    checklistRow(for: document)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: onExit) {
                    Image(systemName: "xmark")
                        .foregroundStyle(CivicaColors.ink)
                }
                .accessibilityLabel(CivicaQuestionStrings.backLabel.value(in: language))
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    private func checklistRow(for document: SNAPDocumentType) -> some View {
        let isChecked = viewModel.answers.documentsAvailable.contains(document)
        return Button {
            viewModel.toggle(document)
        } label: {
            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(isChecked ? CivicaColors.brickPrimary : CivicaColors.graphite)
                    .padding(.top, 2)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(SNAPDocumentsChecklistStrings.label(for: document, language: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if let example = SNAPDocumentsChecklistStrings.example(for: document, language: language) {
                        Text(example)
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.graphite)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.md)
            .frame(minHeight: 56)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(
                        isChecked ? CivicaColors.brickPrimary : CivicaColors.hairline,
                        lineWidth: isChecked ? 2 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(SNAPDocumentsChecklistStrings.label(for: document, language: language))
        .accessibilityAddTraits(isChecked ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Strings

enum SNAPDocumentsChecklistStrings {

    static let title = CivicaText(
        "Which of these do you already have?",
        es: "¿Cuáles de estos ya tienes?"
    )
    static let helper = CivicaText(
        "Mark anything you already have. You don't need everything to start — Massachusetts DTA can ask for the rest later. Civica doesn't upload or store these.",
        es: "Marca lo que ya tengas. No necesitas todo para empezar — el DTA de Massachusetts puede pedir el resto después. Civica no sube ni almacena estos documentos."
    )

    static func label(for document: SNAPDocumentType, language: CivicaLanguage) -> String {
        switch (document, language) {
        case (.photoID, .english):                       return "Photo ID"
        case (.photoID, .spanish):                       return "Identificación con foto"
        case (.proofOfAddress, .english):                return "Proof of where you live"
        case (.proofOfAddress, .spanish):                return "Prueba de donde vives"
        case (.proofOfIncome, .english):                 return "Recent paystubs or proof of income"
        case (.proofOfIncome, .spanish):                 return "Talones de pago recientes o prueba de ingresos"
        case (.rentOrHousingCostProof, .english):        return "Rent or housing cost"
        case (.rentOrHousingCostProof, .spanish):        return "Renta o costo de vivienda"
        case (.utilityBill, .english):                   return "A recent utility bill"
        case (.utilityBill, .spanish):                   return "Un recibo reciente de servicios"
        case (.studentStatusDocuments, .english):        return "Student enrollment paper"
        case (.studentStatusDocuments, .spanish):        return "Comprobante de inscripción estudiantil"
        case (.workStatusOrExemptions, .english):        return "Letter about work status or work exemption"
        case (.workStatusOrExemptions, .spanish):        return "Carta sobre estado laboral o exención de trabajo"
        case (.childcareCostProof, .english):            return "Childcare receipt or invoice"
        case (.childcareCostProof, .spanish):            return "Recibo o factura de cuidado infantil"
        case (.immigrationDocumentsIfRelevant, .english):
            return "Immigration documents (only if the state asks)"
        case (.immigrationDocumentsIfRelevant, .spanish):
            return "Documentos de inmigración (solo si el estado los pide)"
        }
    }

    /// Plain-language example so the user knows what to look for.
    /// Returns nil when the label already says it all.
    static func example(for document: SNAPDocumentType, language: CivicaLanguage) -> String? {
        switch (document, language) {
        case (.photoID, .english):                       return "Driver's license, state ID, passport"
        case (.photoID, .spanish):                       return "Licencia de conducir, identificación estatal, pasaporte"
        case (.proofOfAddress, .english):                return "Lease, mail, bill with your name and address"
        case (.proofOfAddress, .spanish):                return "Contrato de renta, correo o recibo con tu nombre y dirección"
        case (.proofOfIncome, .english):                 return "Last 4 weeks of paystubs, or a letter from your employer"
        case (.proofOfIncome, .spanish):                 return "Talones de pago de las últimas 4 semanas, o una carta de tu empleador"
        case (.rentOrHousingCostProof, .english):        return "Lease, mortgage statement, or shelter receipt"
        case (.rentOrHousingCostProof, .spanish):        return "Contrato, estado de cuenta de hipoteca o recibo de refugio"
        case (.utilityBill, .english):                   return "Electricity, gas, heat, water, or phone"
        case (.utilityBill, .spanish):                   return "Electricidad, gas, calefacción, agua o teléfono"
        case (.studentStatusDocuments, .english):        return "A letter from the school or financial aid office"
        case (.studentStatusDocuments, .spanish):        return "Una carta de la escuela o la oficina de ayuda financiera"
        case (.workStatusOrExemptions, .english):        return nil
        case (.workStatusOrExemptions, .spanish):        return nil
        case (.childcareCostProof, .english):            return nil
        case (.childcareCostProof, .spanish):            return nil
        case (.immigrationDocumentsIfRelevant, .english):
            return "Only some applicants need this. SNAP does not require status info from every household member."
        case (.immigrationDocumentsIfRelevant, .spanish):
            return "Solo algunos solicitantes necesitan esto. SNAP no requiere información migratoria de cada miembro del hogar."
        }
    }
}

#if DEBUG
struct SNAPDocumentsChecklistFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPDocumentsChecklistFlowView(
                viewModel: SNAPDocumentsChecklistFlowViewModel(),
            language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
