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
    var hasElderlyOrDisabled: Bool? = false
    /// Migrant or seasonal farmworker status. With low liquid resources,
    /// satisfies 7 CFR 273.2(i)(1)(ii) (migrant/seasonal destitute) and
    /// the household qualifies for expedited service regardless of
    /// income. Asked as Tri because "not sure" is common.
    var migrantSeasonalFarmworker: SNAPTri?

    // Categorical eligibility inputs (7 CFR 273.2(j)). The question
    // flow does not yet ask these directly -- they're plumbed
    // through so SNAPRulesRegistry / SNAPLocalEligibilityEvaluator
    // can short-circuit income/asset tests when populated. Until
    // dedicated screens land, these stay nil and the evaluator
    // treats them as "unknown" rather than "no".
    var receivesTANF: Bool?
    var receivesSSI: Bool?
    var receivesGeneralAssistance: Bool?

    var isComplete: Bool {
        householdSize != nil
            && hasMinorInHousehold != nil
            && hasElderlyOrDisabled != nil
            && migrantSeasonalFarmworker != nil
    }
}

@MainActor
final class SNAPHouseholdQuestionFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case size
        case minors
        case elderlyOrDisabled
        case migrantFarmworker

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
        case .migrantFarmworker: return answers.migrantSeasonalFarmworker != nil
        }
    }

    var isAtFirstStep: Bool { step == .size }
    var isAtLastStep: Bool { step == .migrantFarmworker }
}

struct SNAPHouseholdQuestionFlowView: View {
    @StateObject var viewModel: SNAPHouseholdQuestionFlowViewModel
    let language: CivicaLanguage
    let onComplete: (SNAPHouseholdAnswers) -> Void
    let onExit: () -> Void

    init(
        viewModel: SNAPHouseholdQuestionFlowViewModel,
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
            .id(viewModel.step)
            .transition(.opacity.animation(.easeInOut(duration: 0.18)))
            .animation(.easeInOut(duration: 0.18), value: viewModel.step)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if viewModel.isAtFirstStep {
                        Button(action: onExit) {
                            Image(systemName: "xmark")
                                .foregroundStyle(CivicaColors.ink)
                        }
                        .accessibilityLabel(CivicaQuestionStrings.backLabel.value(in: language))
                    } else {
                        Button {
                            withAnimation(.easeInOut(duration: 0.18)) { viewModel.goBack() }
                        } label: {
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
        case .migrantFarmworker: migrantFarmworkerScreen
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

    // MARK: - Screen 4: migrant or seasonal farmworker?

    private var migrantFarmworkerScreen: some View {
        let options: [SNAPTri] = [.yes, .no, .notSure]
        return CivicaQuestionScreen(
            progress: progress(for: .migrantFarmworker),
            title: SNAPHouseholdQuestionStrings.migrantFarmworkerTitle.value(in: language),
            helper: SNAPHouseholdQuestionStrings.migrantFarmworkerHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: options.map {
                    SNAPHouseholdQuestionStrings.migrantTriLabel(for: $0, language: language)
                },
                selection: Binding(
                    get: {
                        viewModel.answers.migrantSeasonalFarmworker.map {
                            SNAPHouseholdQuestionStrings.migrantTriLabel(for: $0, language: language)
                        }
                    },
                    set: { label in
                        viewModel.answers.migrantSeasonalFarmworker = options.first { tri in
                            SNAPHouseholdQuestionStrings.migrantTriLabel(for: tri, language: language) == label
                        }
                    }
                )
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
            total: SNAPHouseholdQuestionFlowViewModel.Step.total,
            sectionIndex: SNAPApplicationSection.household.oneBasedIndex,
            sectionCount: SNAPApplicationSection.count,
            sectionTitle: SNAPApplicationSection.household.title(in: language)
        )
    }

    private func advanceOrComplete() {
        withAnimation(.easeInOut(duration: 0.18)) {
            if viewModel.isAtLastStep {
                onComplete(viewModel.answers)
            } else {
                viewModel.advance()
            }
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

    static let migrantFarmworkerTitle = CivicaText(
        "Is anyone in your household a migrant or seasonal farmworker?",
        es: "¿Alguien en tu hogar es trabajador agrícola migrante o de temporada?"
    )
    static let migrantFarmworkerHelper = CivicaText(
        "Yes if someone works in crops, livestock, or food processing on a seasonal or traveling basis. SNAP has a separate expedited path for farmworker households.",
        es: "Sí si alguien trabaja en cultivos, ganadería o procesamiento de alimentos de manera estacional o viajando. SNAP tiene una vía expedita aparte para hogares de trabajadores agrícolas."
    )

    static func migrantTriLabel(for value: SNAPTri, language: CivicaLanguage) -> String {
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
struct SNAPHouseholdQuestionFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPHouseholdQuestionFlowView(
                viewModel: SNAPHouseholdQuestionFlowViewModel(),
            language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
