import CivicaDesignSystem
import SwiftUI

// Migrates the legacy "incomeStep" multi-field card from
// SNAPApplicationView. The legacy form asks ~10 fields on one screen
// (employment status, monthly income, income variability, self-
// employment toggle, employer name, gross pay, pay frequency, hours,
// recent job loss, last pay date, plus unearned-income sub-blocks).
//
// This flow captures the eligibility-critical signal — earned-income
// presence + amount + variability + unearned-income presence — and
// leaves the secondary detail (employer name, exact hours, last pay
// date) for an optional drilldown later. SNAP's rules engine needs
// gross monthly income for the threshold test; the rest is for the
// official PDF and doesn't affect the verdict.
//
// Not wired into SNAPRouter yet — router cutover happens once all
// nine legacy steps are migrated.

struct SNAPIncomeAnswers: Equatable, Codable {
    enum Tri: String, Equatable, Codable { case yes, no, notSure }

    var anyoneEarning: Tri?
    var grossMonthlyIncome: Decimal?
    var incomeChangesMonthToMonth: Tri?
    var hasUnearnedIncome: Tri?

    /// Optional explicit dollar amount of monthly earned income
    /// (wages + self-employment net). Federally the 20% earned-
    /// income deduction only applies to this portion of gross.
    /// The current flow does not yet ask for the split -- when
    /// nil, SNAPBenefitCalculator derives an estimate from
    /// `anyoneEarning` + `hasUnearnedIncome`. A dedicated screen
    /// asking the exact split lands as separate work.
    var monthlyEarnedAmount: Decimal?
}

@MainActor
final class SNAPIncomeFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case earningPresence
        case grossMonthlyIncome
        case incomeVariability
        case unearnedIncome

        var oneBasedIndex: Int { rawValue + 1 }
        static let total = Self.allCases.count
    }

    @Published var step: Step = .earningPresence
    @Published var grossIncomeField: String
    @Published var answers: SNAPIncomeAnswers

    init(answers: SNAPIncomeAnswers = .init()) {
        self.answers = answers
        // Seed the gross-income text field from the stored Decimal so
        // resume / edit shows the prior amount.
        if let gross = answers.grossMonthlyIncome {
            self.grossIncomeField = NSDecimalNumber(decimal: gross).stringValue
        } else {
            self.grossIncomeField = ""
        }
    }

    /// Skip earned-income subquestions when the user says no one
    /// is earning. They go straight from screen 1 to screen 4.
    private func nextStep(after current: Step) -> Step? {
        var rawNext = current.rawValue + 1
        if answers.anyoneEarning == .no {
            // From earningPresence (0) → unearnedIncome (3).
            if rawNext == Step.grossMonthlyIncome.rawValue ||
               rawNext == Step.incomeVariability.rawValue {
                rawNext = Step.unearnedIncome.rawValue
            }
        }
        return Step(rawValue: rawNext)
    }

    private func previousStep(before current: Step) -> Step? {
        var rawPrev = current.rawValue - 1
        if answers.anyoneEarning == .no {
            if rawPrev == Step.incomeVariability.rawValue ||
               rawPrev == Step.grossMonthlyIncome.rawValue {
                rawPrev = Step.earningPresence.rawValue
            }
        }
        return Step(rawValue: rawPrev)
    }

    func recordGrossIncomeField() {
        let trimmed = grossIncomeField
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: ",", with: "")
        answers.grossMonthlyIncome = Decimal(string: trimmed)
    }

    func advance() {
        if step == .grossMonthlyIncome {
            recordGrossIncomeField()
        }
        if let next = nextStep(after: step) {
            step = next
        }
    }

    func goBack() {
        if let prev = previousStep(before: step) {
            step = prev
        }
    }

    var canAdvanceFromCurrentStep: Bool {
        switch step {
        case .earningPresence:
            return answers.anyoneEarning != nil
        case .grossMonthlyIncome:
            let trimmed = grossIncomeField.trimmingCharacters(in: .whitespaces)
                .replacingOccurrences(of: ",", with: "")
            return Decimal(string: trimmed) != nil
        case .incomeVariability:
            return answers.incomeChangesMonthToMonth != nil
        case .unearnedIncome:
            return answers.hasUnearnedIncome != nil
        }
    }

    var isAtFirstStep: Bool { step == .earningPresence }
    var isAtLastStep: Bool { step == .unearnedIncome }
}

struct SNAPIncomeFlowView: View {
    @StateObject var viewModel: SNAPIncomeFlowViewModel
    let language: CivicaLanguage
    let onComplete: (SNAPIncomeAnswers) -> Void
    let onExit: () -> Void

    init(
        viewModel: SNAPIncomeFlowViewModel,
        language: CivicaLanguage = .english,
        onComplete: @escaping (SNAPIncomeAnswers) -> Void,
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
        case .earningPresence:   earningPresenceScreen
        case .grossMonthlyIncome: grossMonthlyIncomeScreen
        case .incomeVariability: incomeVariabilityScreen
        case .unearnedIncome:    unearnedIncomeScreen
        }
    }

    // MARK: - Screen 1: anyone earning?

    private var earningPresenceScreen: some View {
        triScreen(
            step: .earningPresence,
            title: SNAPIncomeStrings.earningTitle.value(in: language),
            helper: SNAPIncomeStrings.earningHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.anyoneEarning },
                set: { viewModel.answers.anyoneEarning = $0 }
            )
        )
    }

    // MARK: - Screen 2: gross monthly income

    private var grossMonthlyIncomeScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .grossMonthlyIncome),
            title: SNAPIncomeStrings.grossTitle.value(in: language),
            helper: SNAPIncomeStrings.grossHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            grossIncomeAffordance
        }
    }

    private var grossIncomeAffordance: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.sm) {
                Text("$")
                    .font(.system(size: 32, weight: .semibold))
                    .foregroundStyle(CivicaColors.graphite)
                TextField(
                    SNAPIncomeStrings.grossPlaceholder.value(in: language),
                    text: $viewModel.grossIncomeField
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
            Text(SNAPIncomeStrings.grossSuffix.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
        }
    }

    // MARK: - Screen 3: variability

    private var incomeVariabilityScreen: some View {
        triScreen(
            step: .incomeVariability,
            title: SNAPIncomeStrings.variabilityTitle.value(in: language),
            helper: SNAPIncomeStrings.variabilityHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.incomeChangesMonthToMonth },
                set: { viewModel.answers.incomeChangesMonthToMonth = $0 }
            )
        )
    }

    // MARK: - Screen 4: unearned income

    private var unearnedIncomeScreen: some View {
        triScreen(
            step: .unearnedIncome,
            title: SNAPIncomeStrings.unearnedTitle.value(in: language),
            helper: SNAPIncomeStrings.unearnedHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.hasUnearnedIncome },
                set: { viewModel.answers.hasUnearnedIncome = $0 }
            )
        )
    }

    // MARK: - Shared 3-way affordance

    private func triScreen(
        step: SNAPIncomeFlowViewModel.Step,
        title: String,
        helper: String,
        value: Binding<SNAPIncomeAnswers.Tri?>
    ) -> some View {
        let options: [SNAPIncomeAnswers.Tri] = [.yes, .no, .notSure]
        return CivicaQuestionScreen(
            progress: progress(for: step),
            title: title,
            helper: helper,
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: value.wrappedValue != nil,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: options.map { SNAPIncomeStrings.triLabel(for: $0, language: language) },
                selection: Binding(
                    get: {
                        value.wrappedValue.map { SNAPIncomeStrings.triLabel(for: $0, language: language) }
                    },
                    set: { label in
                        value.wrappedValue = options.first { tri in
                            SNAPIncomeStrings.triLabel(for: tri, language: language) == label
                        }
                    }
                )
            )
        }
    }

    // MARK: - Helpers

    private func progress(for step: SNAPIncomeFlowViewModel.Step)
        -> CivicaQuestionScreenProgress
    {
        .init(current: step.oneBasedIndex, total: SNAPIncomeFlowViewModel.Step.total)
    }

    private func advanceOrComplete() {
        if viewModel.step == .grossMonthlyIncome {
            viewModel.recordGrossIncomeField()
        }
        if viewModel.isAtLastStep {
            onComplete(viewModel.answers)
        } else {
            viewModel.advance()
        }
    }
}

// MARK: - Strings

enum SNAPIncomeStrings {

    // 3-way option labels — shared across all four screens.
    static func triLabel(for value: SNAPIncomeAnswers.Tri, language: CivicaLanguage) -> String {
        switch (value, language) {
        case (.yes, .english): return "Yes"
        case (.yes, .spanish): return "Sí"
        case (.no, .english):  return "No"
        case (.no, .spanish):  return "No"
        case (.notSure, .english): return "I'm not sure"
        case (.notSure, .spanish): return "No estoy seguro"
        }
    }

    // Screen 1
    static let earningTitle = CivicaText(
        "Is anyone in your household earning money right now?",
        es: "¿Alguien en tu hogar está ganando dinero ahora mismo?"
    )
    static let earningHelper = CivicaText(
        "Count any job — full-time, part-time, gig work, side jobs, self-employment. We'll ask for amounts next.",
        es: "Cuenta cualquier trabajo — tiempo completo, medio tiempo, trabajo por encargo, trabajos secundarios, por cuenta propia. Preguntaremos los montos después."
    )

    // Screen 2
    static let grossTitle = CivicaText(
        "About how much does the whole household bring in each month, before taxes?",
        es: "¿Cuánto trae el hogar entero cada mes, antes de impuestos?"
    )
    static let grossHelper = CivicaText(
        "An estimate is fine. SNAP looks at gross income — what you make before taxes and deductions.",
        es: "Una estimación está bien. SNAP mira los ingresos brutos — lo que ganas antes de impuestos y deducciones."
    )
    /// Word placeholder ("Amount" / "Cantidad") rather than "0" so the
    /// empty state is unambiguous — see CivicaQuestionStrings for the
    /// shared rationale.
    static let grossPlaceholder = CivicaQuestionStrings.amountPlaceholder
    static let grossSuffix = CivicaText(
        "Total monthly, before taxes",
        es: "Total mensual, antes de impuestos"
    )

    // Screen 3
    static let variabilityTitle = CivicaText(
        "Does that amount change month to month?",
        es: "¿Esa cantidad cambia mes a mes?"
    )
    static let variabilityHelper = CivicaText(
        "Yes if hours, tips, or seasonal work make it different each month. SNAP averages variable income across recent months.",
        es: "Sí si las horas, propinas o trabajo de temporada lo hacen diferente cada mes. SNAP promedia los ingresos variables en los últimos meses."
    )

    // Screen 4
    static let unearnedTitle = CivicaText(
        "Does anyone get income that's not from a job?",
        es: "¿Alguien recibe ingresos que no son de un trabajo?"
    )
    static let unearnedHelper = CivicaText(
        "Things like SSI, Social Security, unemployment, child support, pension, or veterans benefits. These count for SNAP too.",
        es: "Cosas como SSI, Seguro Social, desempleo, manutención de hijos, pensión o beneficios para veteranos. Estos también cuentan para SNAP."
    )
}

#if DEBUG
struct SNAPIncomeFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPIncomeFlowView(
                viewModel: SNAPIncomeFlowViewModel(),
            language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
