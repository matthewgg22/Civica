import CivicaDesignSystem
import SwiftUI

// Migrates the legacy "expensesStep" multi-field card. Captures the
// four dollar fields that affect SNAP deductions:
//
//   • Rent / housing payment
//   • Utilities (electricity, heat, gas, water, phone)
//   • Childcare costs (dependent-care deduction)
//   • Out-of-pocket medical costs (medical deduction for 60+ /
//     disabled members)
//
// All four are technically optional from a flow perspective —
// leaving a screen blank means "$0," which is a valid answer (an
// unhoused applicant has $0 rent). The rules engine treats empty
// as $0 and skips the corresponding deduction. The helper copy on
// each screen names what counts so users don't have to guess.

struct SNAPExpensesAnswers: Equatable, Codable {
    var monthlyRentOrHousing: Decimal?
    var monthlyUtilities: Decimal?
    var monthlyChildcare: Decimal?
    var monthlyMedical: Decimal?
}

@MainActor
final class SNAPExpensesFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case rent, utilities, childcare, medical

        var oneBasedIndex: Int { rawValue + 1 }
        static let total = Self.allCases.count
    }

    @Published var step: Step = .rent
    @Published var rentField: String
    @Published var utilitiesField: String
    @Published var childcareField: String
    @Published var medicalField: String
    @Published var answers: SNAPExpensesAnswers

    init(answers: SNAPExpensesAnswers = .init()) {
        self.answers = answers
        func render(_ value: Decimal?) -> String {
            guard let value else { return "" }
            return NSDecimalNumber(decimal: value).stringValue
        }
        self.rentField = render(answers.monthlyRentOrHousing)
        self.utilitiesField = render(answers.monthlyUtilities)
        self.childcareField = render(answers.monthlyChildcare)
        self.medicalField = render(answers.monthlyMedical)
    }

    func recordCurrentField() {
        switch step {
        case .rent:      answers.monthlyRentOrHousing = decimalValue(rentField)
        case .utilities: answers.monthlyUtilities     = decimalValue(utilitiesField)
        case .childcare: answers.monthlyChildcare     = decimalValue(childcareField)
        case .medical:   answers.monthlyMedical       = decimalValue(medicalField)
        }
    }

    func advance() {
        recordCurrentField()
        if let next = Step(rawValue: step.rawValue + 1) {
            step = next
        }
    }

    func goBack() {
        if let prev = Step(rawValue: step.rawValue - 1) {
            step = prev
        }
    }

    var isAtFirstStep: Bool { step == .rent }
    var isAtLastStep: Bool { step == .medical }

    // Empty / non-numeric input is intentionally "no answer" rather
    // than $0 — that distinction lets the rules engine flag missing
    // data separately from "$0 is the real answer."
    private func decimalValue(_ raw: String) -> Decimal? {
        let cleaned = raw
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: ",", with: "")
        guard !cleaned.isEmpty else { return nil }
        return Decimal(string: cleaned)
    }
}

struct SNAPExpensesFlowView: View {
    @StateObject var viewModel: SNAPExpensesFlowViewModel
    let language: CivicaLanguage
    let onComplete: (SNAPExpensesAnswers) -> Void
    let onExit: () -> Void

    init(
        viewModel: SNAPExpensesFlowViewModel = SNAPExpensesFlowViewModel(),
        language: CivicaLanguage = .english,
        onComplete: @escaping (SNAPExpensesAnswers) -> Void,
        onExit: @escaping () -> Void
    ) {
        self._viewModel = StateObject(wrappedValue: viewModel)
        self.language = language
        self.onComplete = onComplete
        self.onExit = onExit
    }

    var body: some View {
        currentScreen
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        viewModel.isAtFirstStep ? onExit() : viewModel.goBack()
                    } label: {
                        Image(systemName: viewModel.isAtFirstStep ? "xmark" : "chevron.left")
                            .foregroundStyle(CivicaColors.ink)
                    }
                    .accessibilityLabel(CivicaQuestionStrings.backLabel.value(in: language))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private var currentScreen: some View {
        switch viewModel.step {
        case .rent:      moneyScreen(.rent, binding: $viewModel.rentField)
        case .utilities: moneyScreen(.utilities, binding: $viewModel.utilitiesField)
        case .childcare: moneyScreen(.childcare, binding: $viewModel.childcareField)
        case .medical:   moneyScreen(.medical, binding: $viewModel.medicalField)
        }
    }

    // MARK: - Shared money-screen affordance

    private func moneyScreen(
        _ step: SNAPExpensesFlowViewModel.Step,
        binding: Binding<String>
    ) -> some View {
        CivicaQuestionScreen(
            progress: progress(for: step),
            title: SNAPExpensesStrings.title(for: step, language: language),
            helper: SNAPExpensesStrings.helper(for: step, language: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: true,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            moneyAffordance(
                binding: binding,
                suffix: SNAPExpensesStrings.suffix(for: step, language: language)
            )
        }
    }

    private func moneyAffordance(binding: Binding<String>, suffix: String) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.sm) {
                Text("$")
                    .font(.system(size: 32, weight: .semibold))
                    .foregroundStyle(CivicaColors.graphite)
                TextField("0", text: binding)
                    .font(.system(size: 32, weight: .semibold, design: .monospaced))
                    .foregroundStyle(CivicaColors.ink)
                    .keyboardType(.decimalPad)
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.md)
            .frame(minHeight: 72)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
            Text(suffix)
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
        }
    }

    // MARK: - Helpers

    private func progress(for step: SNAPExpensesFlowViewModel.Step)
        -> CivicaQuestionScreen<EmptyView>.Progress
    {
        .init(current: step.oneBasedIndex, total: SNAPExpensesFlowViewModel.Step.total)
    }

    private func advanceOrComplete() {
        viewModel.recordCurrentField()
        if viewModel.isAtLastStep {
            onComplete(viewModel.answers)
        } else {
            viewModel.advance()
        }
    }
}

// MARK: - Strings

enum SNAPExpensesStrings {

    static func title(for step: SNAPExpensesFlowViewModel.Step, language: CivicaLanguage) -> String {
        switch (step, language) {
        case (.rent, .english):
            return "About how much is your rent or housing payment each month?"
        case (.rent, .spanish):
            return "¿Cuánto es tu renta o pago de vivienda cada mes?"
        case (.utilities, .english):
            return "What do you spend on utilities each month?"
        case (.utilities, .spanish):
            return "¿Cuánto gastas en servicios cada mes?"
        case (.childcare, .english):
            return "Do you pay for childcare?"
        case (.childcare, .spanish):
            return "¿Pagas por el cuidado infantil?"
        case (.medical, .english):
            return "Any out-of-pocket medical costs each month?"
        case (.medical, .spanish):
            return "¿Algún gasto médico de tu bolsillo cada mes?"
        }
    }

    static func helper(for step: SNAPExpensesFlowViewModel.Step, language: CivicaLanguage) -> String {
        switch (step, language) {
        case (.rent, .english):
            return "Include rent, mortgage, or anything you pay regularly to live where you live. Estimate is fine. Enter 0 if you don't pay rent right now."
        case (.rent, .spanish):
            return "Incluye renta, hipoteca o cualquier pago regular por donde vives. Una estimación está bien. Pon 0 si no pagas renta ahora mismo."
        case (.utilities, .english):
            return "Add up a typical month — electricity, heat, gas, water, phone. The total matters more than each line item."
        case (.utilities, .spanish):
            return "Suma un mes típico — electricidad, calefacción, gas, agua, teléfono. El total importa más que cada línea."
        case (.childcare, .english):
            return "Daycare, after-school, or anything that lets a working adult in your household keep working. Enter 0 if none."
        case (.childcare, .spanish):
            return "Guardería, programas después de la escuela, o cualquier cosa que permita a un adulto trabajador del hogar seguir trabajando. Pon 0 si no aplica."
        case (.medical, .english):
            return "Only counts if someone in your household is 60+ or has a disability. We're asking about co-pays, prescriptions, dental, or insurance premiums you pay out of pocket. Don't share diagnoses."
        case (.medical, .spanish):
            return "Solo cuenta si alguien en tu hogar tiene 60 años o más o vive con una discapacidad. Preguntamos por copagos, medicamentos, dentista o primas de seguro que pagas de tu bolsillo. No compartas diagnósticos."
        }
    }

    static func suffix(for step: SNAPExpensesFlowViewModel.Step, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Per month"
        case .spanish: return "Por mes"
        }
    }
}

#if DEBUG
struct SNAPExpensesFlowView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SNAPExpensesFlowView(
                language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
