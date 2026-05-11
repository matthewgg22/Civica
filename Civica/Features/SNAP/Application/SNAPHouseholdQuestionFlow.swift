import CivicaDesignSystem
import SwiftUI

// Proof of the one-question-per-screen cadence using
// CivicaQuestionScreen. Reshapes the "household basics" step from the
// legacy multi-field card into 3 sequential single-question screens.
//
// Order matters: household size is asked first because it's the
// strongest gate on every downstream calculation, then the two
// "special status" yes/nos that unlock SNAP's elderly/disabled
// deductions and child-related deductions.
//
// Not wired into SNAPRouter yet — the legacy SNAPApplicationView
// remains the active path. This file is the working template the
// remaining 8 application steps will follow when the migration
// commit lands.

struct SNAPHouseholdAnswers: Equatable, Codable {
    var householdSize: String?              // choice from buckets
    var hasMinorInHousehold: Bool?
    var hasElderlyOrDisabled: Bool?

    var isComplete: Bool {
        householdSize != nil
            && hasMinorInHousehold != nil
            && hasElderlyOrDisabled != nil
    }
}

@MainActor
final class SNAPHouseholdQuestionFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case size
        case minors
        case elderlyOrDisabled

        static let total = Self.allCases.count
        var oneBasedIndex: Int { rawValue + 1 }
    }

    @Published var step: Step = .size
    @Published var answers: SNAPHouseholdAnswers

    /// Seed prior answers so resume / edit round-trips preserve state.
    init(answers: SNAPHouseholdAnswers = .init()) {
        self.answers = answers
    }

    func advance() {
        if let next = Step(rawValue: step.rawValue + 1) {
            step = next
        }
    }

    func goBack() {
        if let prev = Step(rawValue: step.rawValue - 1) {
            step = prev
        }
    }

    var canAdvanceFromCurrentStep: Bool {
        switch step {
        case .size: return answers.householdSize != nil
        case .minors: return answers.hasMinorInHousehold != nil
        case .elderlyOrDisabled: return answers.hasElderlyOrDisabled != nil
        }
    }

    var isAtFirstStep: Bool { step == .size }
    var isAtLastStep: Bool { step == .elderlyOrDisabled }
}

struct SNAPHouseholdQuestionFlowView: View {
    @StateObject var viewModel: SNAPHouseholdQuestionFlowViewModel
    let language: CivicaLanguage
    let onComplete: (SNAPHouseholdAnswers) -> Void
    let onExit: () -> Void

    init(
        viewModel: SNAPHouseholdQuestionFlowViewModel = SNAPHouseholdQuestionFlowViewModel(),
        language: CivicaLanguage = .english,
        onComplete: @escaping (SNAPHouseholdAnswers) -> Void,
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
                    if viewModel.isAtFirstStep {
                        Button(action: onExit) {
                            Image(systemName: "xmark")
                                .foregroundStyle(CivicaColors.ink)
                        }
                        .accessibilityLabel(CivicaQuestionStrings.backLabel.value(in: language))
                    } else {
                        Button(action: viewModel.goBack) {
                            Image(systemName: "chevron.left")
                                .foregroundStyle(CivicaColors.ink)
                        }
                        .accessibilityLabel(CivicaQuestionStrings.backLabel.value(in: language))
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private var currentScreen: some View {
        switch viewModel.step {
        case .size: sizeScreen
        case .minors: minorsScreen
        case .elderlyOrDisabled: elderlyOrDisabledScreen
        }
    }

    // MARK: - Screen 1: household size

    private var sizeScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .size),
            title: SNAPHouseholdQuestionStrings.sizeTitle.value(in: language),
            helper: SNAPHouseholdQuestionStrings.sizeHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: [
                    SNAPHouseholdQuestionStrings.sizeOptionJustMe.value(in: language),
                    SNAPHouseholdQuestionStrings.sizeOptionTwo.value(in: language),
                    SNAPHouseholdQuestionStrings.sizeOptionThree.value(in: language),
                    SNAPHouseholdQuestionStrings.sizeOptionFourPlus.value(in: language)
                ],
                selection: $viewModel.answers.householdSize
            )
        }
    }

    // MARK: - Screen 2: minors present?

    private var minorsScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .minors),
            title: SNAPHouseholdQuestionStrings.minorsTitle.value(in: language),
            helper: SNAPHouseholdQuestionStrings.minorsHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionYesNo(
                selection: $viewModel.answers.hasMinorInHousehold,
                yesLabel: CivicaQuestionStrings.yesLabel.value(in: language),
                noLabel: CivicaQuestionStrings.noLabel.value(in: language)
            )
        }
    }

    // MARK: - Screen 3: elderly / disabled in household?

    private var elderlyOrDisabledScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .elderlyOrDisabled),
            title: SNAPHouseholdQuestionStrings.elderlyOrDisabledTitle.value(in: language),
            helper: SNAPHouseholdQuestionStrings.elderlyOrDisabledHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionYesNo(
                selection: $viewModel.answers.hasElderlyOrDisabled,
                yesLabel: CivicaQuestionStrings.yesLabel.value(in: language),
                noLabel: CivicaQuestionStrings.noLabel.value(in: language)
            )
        }
    }

    // MARK: - Helpers

    private func progress(for step: SNAPHouseholdQuestionFlowViewModel.Step)
        -> CivicaQuestionScreenProgress
    {
        .init(
            current: step.oneBasedIndex,
            total: SNAPHouseholdQuestionFlowViewModel.Step.total
        )
    }

    private func advanceOrComplete() {
        if viewModel.isAtLastStep {
            onComplete(viewModel.answers)
        } else {
            viewModel.advance()
        }
    }
}

// Strings live alongside the flow so each question's exact wording is
// reviewable in one place. EN/ES parity held.
enum SNAPHouseholdQuestionStrings {

    static let sizeTitle = CivicaText(
        "How many people live in your household?",
        es: "¿Cuántas personas viven en tu hogar?"
    )
    static let sizeHelper = CivicaText(
        "Include anyone who shares groceries with you — partners, kids, roommates who eat together.",
        es: "Incluye a cualquiera que comparta comestibles contigo — pareja, hijos o compañeros de casa que comen juntos."
    )
    static let sizeOptionJustMe = CivicaText("Just me", es: "Solo yo")
    static let sizeOptionTwo = CivicaText("2 people", es: "2 personas")
    static let sizeOptionThree = CivicaText("3 people", es: "3 personas")
    static let sizeOptionFourPlus = CivicaText("4 or more", es: "4 o más")

    static let minorsTitle = CivicaText(
        "Is anyone in your household 18 or under?",
        es: "¿Hay alguien en tu hogar de 18 años o menos?"
    )
    static let minorsHelper = CivicaText(
        "Children in the household can unlock extra SNAP deductions and may make you eligible for expedited service.",
        es: "Los menores en el hogar pueden desbloquear deducciones adicionales de SNAP y pueden hacer que califiques para servicio expedito."
    )

    static let elderlyOrDisabledTitle = CivicaText(
        "Is anyone 60 or older, or living with a disability?",
        es: "¿Hay alguien de 60 años o más, o que vive con una discapacidad?"
    )
    static let elderlyOrDisabledHelper = CivicaText(
        "This matters for SNAP — older adults and people with disabilities get extra deductions and don't face an asset test in Massachusetts.",
        es: "Esto importa para SNAP — los adultos mayores y las personas con discapacidad reciben deducciones adicionales y no enfrentan una prueba de bienes en Massachusetts."
    )
}

#if DEBUG
struct SNAPHouseholdQuestionFlowView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SNAPHouseholdQuestionFlowView(
                language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
