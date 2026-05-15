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
    /// Whether the household pays for utilities separately from rent.
    /// Defaults to false (No pre-selected). When false the utilities
    /// amount and shutoff screens are skipped and monthlyUtilities is
    /// treated as nil by the rules engine.
    var paysUtilitiesSeparately: Bool? = false
    var monthlyUtilities: Decimal?
    /// Whether the household has received a utility-shutoff notice —
    /// a strong soft signal for expedited need, asked right after
    /// utilities cost while the user is in that frame of mind.
    var utilityShutoffNotice: SNAPTri?
    var monthlyChildcare: Decimal?
    var monthlyMedical: Decimal?
}

@MainActor
final class SNAPExpensesFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case rent, paysUtilitiesSeparately, utilities, utilityShutoff, childcare, medical

        var oneBasedIndex: Int { rawValue + 1 }
        static let total = Self.allCases.count
    }

    @Published var step: Step = .rent
    @Published var rentField: String
    @Published var utilitiesField: String
    @Published var childcareField: String
    @Published var medicalField: String
    @Published var answers: SNAPExpensesAnswers

    private let hasMinorInHousehold: Bool
    private let hasElderlyOrDisabled: Bool

    /// Recomputed on every access so the utilities and shutoff screens
    /// appear / disappear immediately when the user toggles
    /// paysUtilitiesSeparately — without restarting the flow.
    var effectiveSteps: [Step] {
        var steps: [Step] = [.rent, .paysUtilitiesSeparately]
        if answers.paysUtilitiesSeparately == true {
            steps.append(.utilities)
            steps.append(.utilityShutoff)
        }
        if hasMinorInHousehold { steps.append(.childcare) }
        if hasElderlyOrDisabled { steps.append(.medical) }
        return steps
    }

    init(
        answers: SNAPExpensesAnswers = .init(),
        hasMinorInHousehold: Bool = false,
        hasElderlyOrDisabled: Bool = false
    ) {
        self.answers = answers
        self.hasMinorInHousehold = hasMinorInHousehold
        self.hasElderlyOrDisabled = hasElderlyOrDisabled

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
        case .rent:                   answers.monthlyRentOrHousing = decimalValue(rentField)
        case .paysUtilitiesSeparately: break  // bound directly into answers.paysUtilitiesSeparately
        case .utilities:              answers.monthlyUtilities     = decimalValue(utilitiesField)
        case .utilityShutoff:         break  // bound directly into answers.utilityShutoffNotice
        case .childcare:              answers.monthlyChildcare     = decimalValue(childcareField)
        case .medical:                answers.monthlyMedical       = decimalValue(medicalField)
        }
    }

    var canAdvanceFromCurrentStep: Bool {
        switch step {
        case .rent, .utilities, .childcare, .medical:
            return true  // empty = $0, already a valid answer
        case .paysUtilitiesSeparately:
            return true  // defaults to false (No), user can always proceed
        case .utilityShutoff:
            return answers.utilityShutoffNotice != nil
        }
    }

    func advance() {
        recordCurrentField()
        // When the user says they don't pay utilities separately, clear
        // any previously entered utilities data before skipping forward.
        if step == .paysUtilitiesSeparately && answers.paysUtilitiesSeparately != true {
            answers.monthlyUtilities = nil
            answers.utilityShutoffNotice = nil
        }
        if let i = effectiveSteps.firstIndex(of: step), i + 1 < effectiveSteps.count {
            step = effectiveSteps[i + 1]
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
        viewModel: SNAPExpensesFlowViewModel,
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
            .id(viewModel.step)
            .transition(.opacity.animation(.easeInOut(duration: 0.18)))
            .animation(.easeInOut(duration: 0.18), value: viewModel.step)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        if viewModel.isAtFirstStep {
                            onExit()
                        } else {
                            withAnimation(.easeInOut(duration: 0.18)) { viewModel.goBack() }
                        }
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
        case .rent:                    moneyScreen(.rent, binding: $viewModel.rentField)
        case .paysUtilitiesSeparately: paysUtilitiesSeparatelyScreen
        case .utilities:               moneyScreen(.utilities, binding: $viewModel.utilitiesField)
        case .utilityShutoff:          utilityShutoffScreen
        case .childcare:               moneyScreen(.childcare, binding: $viewModel.childcareField)
        case .medical:                 moneyScreen(.medical, binding: $viewModel.medicalField)
        }
    }

    private var paysUtilitiesSeparatelyScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .paysUtilitiesSeparately),
            title: SNAPExpensesStrings.title(for: .paysUtilitiesSeparately, language: language),
            helper: SNAPExpensesStrings.helper(for: .paysUtilitiesSeparately, language: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionYesNo(
                selection: $viewModel.answers.paysUtilitiesSeparately,
                yesLabel: CivicaQuestionStrings.yesLabel.value(in: language),
                noLabel: CivicaQuestionStrings.noLabel.value(in: language)
            )
        }
    }

    private var utilityShutoffScreen: some View {
        let options: [SNAPTri] = [.yes, .no, .notSure]
        return CivicaQuestionScreen(
            progress: progress(for: .utilityShutoff),
            title: SNAPExpensesStrings.title(for: .utilityShutoff, language: language),
            helper: SNAPExpensesStrings.helper(for: .utilityShutoff, language: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: options.map { SNAPExpensesStrings.triLabel(for: $0, language: language) },
                selection: Binding(
                    get: {
                        viewModel.answers.utilityShutoffNotice.map {
                            SNAPExpensesStrings.triLabel(for: $0, language: language)
                        }
                    },
                    set: { label in
                        viewModel.answers.utilityShutoffNotice = options.first { tri in
                            SNAPExpensesStrings.triLabel(for: tri, language: language) == label
                        }
                    }
                )
            )
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
                TextField(
                    CivicaQuestionStrings.amountPlaceholder.value(in: language),
                    text: binding
                )
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
        -> CivicaQuestionScreenProgress
    {
        .init(
            current: step.oneBasedIndex,
            total: SNAPExpensesFlowViewModel.Step.total,
            sectionIndex: SNAPApplicationSection.expenses.oneBasedIndex,
            sectionCount: SNAPApplicationSection.count,
            sectionTitle: SNAPApplicationSection.expenses.title(in: language)
        )
    }

    private func advanceOrComplete() {
        withAnimation(.easeInOut(duration: 0.18)) {
            viewModel.recordCurrentField()
            if viewModel.isAtLastStep {
                onComplete(viewModel.answers)
            } else {
                viewModel.advance()
            }
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
        case (.paysUtilitiesSeparately, .english):
            return "Do you pay for utilities separately from your rent?"
        case (.paysUtilitiesSeparately, .spanish):
            return "¿Pagas los servicios por separado de tu renta?"
        case (.utilities, .english):
            return "What do you spend on utilities each month?"
        case (.utilities, .spanish):
            return "¿Cuánto gastas en servicios cada mes?"
        case (.utilityShutoff, .english):
            return "Have you received a shutoff notice from any utility?"
        case (.utilityShutoff, .spanish):
            return "¿Has recibido un aviso de corte de algún servicio?"
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
        case (.paysUtilitiesSeparately, .english):
            return "Select Yes if you get and pay your own electric, gas, water, or heat bills. Select No if utilities are included in your rent."
        case (.paysUtilitiesSeparately, .spanish):
            return "Selecciona Sí si recibes y pagas tus propias facturas de electricidad, gas, agua o calefacción. Selecciona No si los servicios están incluidos en tu renta."
        case (.utilities, .english):
            return "Add up a typical month — electricity, heat, gas, water, phone. The total matters more than each line item."
        case (.utilities, .spanish):
            return "Suma un mes típico — electricidad, calefacción, gas, agua, teléfono. El total importa más que cada línea."
        case (.utilityShutoff, .english):
            return "A written or paper notice that power, gas, water, or heat will be cut off if you don't pay. This can speed up your SNAP application."
        case (.utilityShutoff, .spanish):
            return "Un aviso escrito o en papel de que cortarán la luz, el gas, el agua o la calefacción si no pagas. Esto puede acelerar tu solicitud de SNAP."
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

    static func fieldAccessibilityLabel(for step: SNAPExpensesFlowViewModel.Step, language: CivicaLanguage) -> String {
        switch (step, language) {
        case (.rent, .english):                    return "Monthly rent or housing payment, in dollars"
        case (.rent, .spanish):                    return "Pago mensual de renta o vivienda, en dólares"
        case (.utilities, .english):               return "Monthly utilities, in dollars"
        case (.utilities, .spanish):               return "Servicios mensuales, en dólares"
        case (.childcare, .english):               return "Monthly childcare costs, in dollars"
        case (.childcare, .spanish):               return "Costos mensuales de cuidado infantil, en dólares"
        case (.medical, .english):                 return "Monthly out-of-pocket medical costs, in dollars"
        case (.medical, .spanish):                 return "Gastos médicos mensuales de bolsillo, en dólares"
        case (.utilityShutoff, _):                 return ""
        case (.paysUtilitiesSeparately, _):        return ""
        }
    }

    static func triLabel(for value: SNAPTri, language: CivicaLanguage) -> String {
        switch (value, language) {
        case (.yes, .english):     return "Yes"
        case (.yes, .spanish):     return "Sí"
        case (.no, .english):      return "No"
        case (.no, .spanish):      return "No"
        case (.notSure, .english): return "I'm not sure"
        case (.notSure, .spanish): return "No estoy seguro"
        }
    }
}

#if DEBUG
struct SNAPExpensesFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPExpensesFlowView(
                viewModel: SNAPExpensesFlowViewModel(),
            language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
