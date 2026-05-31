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

/// BenefitsCal ABMRS marital-status options. Optional throughout —
/// an applicant who prefers not to say still passes through. The
/// extension maps each case to the state portal's matching label.
enum SNAPMaritalStatus: String, Codable, CaseIterable, Equatable {
    case single
    case married
    case domesticPartnership
    case separated
    case divorced
    case widowed
    case preferNotToSay
}

struct SNAPHouseholdAnswers: Equatable, Codable {
    var householdSize: String?              // choice from buckets
    var hasMinorInHousehold: Bool?
    // OBBBA §10102(a) (FNS memo Oct 3 2025): dependent-child ABAWD exception
    // narrowed from under-18 to under-14. Populated only when hasMinorInHousehold
    // == true; nil when no minors are present (question is skipped).
    var hasChildUnder14InHousehold: Bool?
    var hasElderlyOrDisabled: Bool? = false
    /// Migrant or seasonal farmworker status. With low liquid resources,
    /// satisfies 7 CFR 273.2(i)(1)(ii) (migrant/seasonal destitute) and
    /// the household qualifies for expedited service regardless of
    /// income. Asked as Tri because "not sure" is common.
    var migrantSeasonalFarmworker: SNAPTri?
    /// Wave 4 — BenefitsCal ABMRS. Optional. Used to autofill the
    /// state portal's marital-status field.
    var maritalStatus: SNAPMaritalStatus?

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
            && (hasMinorInHousehold != true || hasChildUnder14InHousehold != nil)
            && hasElderlyOrDisabled != nil
            && migrantSeasonalFarmworker != nil
    }
}

@MainActor
final class SNAPHouseholdQuestionFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case size
        case minors
        case childrenUnder14    // shown only when hasMinorInHousehold == true
        case elderlyOrDisabled
        case migrantFarmworker
        case maritalStatus      // Wave 4 — always asked, optional

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
        switch step {
        case .minors:
            // Skip childrenUnder14 when no minors in the household.
            step = answers.hasMinorInHousehold == true ? .childrenUnder14 : .elderlyOrDisabled
        default:
            if let next = Step(rawValue: step.rawValue + 1) { step = next }
        }
    }

    func goBack() {
        switch step {
        case .elderlyOrDisabled:
            step = answers.hasMinorInHousehold == true ? .childrenUnder14 : .minors
        default:
            if let prev = Step(rawValue: step.rawValue - 1) { step = prev }
        }
    }

    var canAdvanceFromCurrentStep: Bool {
        switch step {
        case .size: return answers.householdSize != nil
        case .minors: return answers.hasMinorInHousehold != nil
        case .childrenUnder14: return answers.hasChildUnder14InHousehold != nil
        case .elderlyOrDisabled: return answers.hasElderlyOrDisabled != nil
        case .migrantFarmworker: return answers.migrantSeasonalFarmworker != nil
        case .maritalStatus: return answers.maritalStatus != nil
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
            .civicaAnimation(.easeInOut(duration: 0.18), value: viewModel.step)
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
                            civicaWithAnimation(.easeInOut(duration: 0.18)) { viewModel.goBack() }
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
        case .childrenUnder14: childrenUnder14Screen
        case .elderlyOrDisabled: elderlyOrDisabledScreen
        case .migrantFarmworker: migrantFarmworkerScreen
        case .maritalStatus: maritalStatusScreen
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

    // MARK: - Screen 3: any children under 14? (shown only when hasMinorInHousehold == true)

    private var childrenUnder14Screen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .childrenUnder14),
            title: SNAPHouseholdQuestionStrings.childrenUnder14Title.value(in: language),
            helper: SNAPHouseholdQuestionStrings.childrenUnder14Helper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionYesNo(
                selection: $viewModel.answers.hasChildUnder14InHousehold,
                yesLabel: CivicaQuestionStrings.yesLabel.value(in: language),
                noLabel: CivicaQuestionStrings.noLabel.value(in: language)
            )
        }
    }

    // MARK: - Screen 4: migrant or seasonal farmworker?

    // MARK: - Wave 4: marital status (BenefitsCal ABMRS)

    private var maritalStatusScreen: some View {
        let options = SNAPMaritalStatus.allCases
        return CivicaQuestionScreen(
            progress: progress(for: .maritalStatus),
            title: SNAPHouseholdQuestionStrings.maritalStatusTitle.value(in: language),
            helper: SNAPHouseholdQuestionStrings.maritalStatusHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: options.map {
                    SNAPHouseholdQuestionStrings.maritalStatusLabel(for: $0, language: language)
                },
                selection: Binding(
                    get: {
                        viewModel.answers.maritalStatus.map {
                            SNAPHouseholdQuestionStrings.maritalStatusLabel(for: $0, language: language)
                        }
                    },
                    set: { label in
                        viewModel.answers.maritalStatus = options.first { status in
                            SNAPHouseholdQuestionStrings.maritalStatusLabel(for: status, language: language) == label
                        }
                    }
                )
            )
        }
    }

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
        civicaWithAnimation(.easeInOut(duration: 0.18)) {
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

    // OBBBA §10102(a): shown only when hasMinorInHousehold == true
    static let childrenUnder14Title = CivicaText(
        "Are any of those children under 14?",
        es: "¿Alguno de esos niños tiene menos de 14 años?"
    )
    static let childrenUnder14Helper = CivicaText(
        "This determines who in your household needs to meet SNAP's work requirement for able-bodied adults.",
        es: "Esto determina quién en tu hogar necesita cumplir con el requisito de trabajo de SNAP para adultos capaces."
    )

    static let elderlyOrDisabledTitle = CivicaText(
        "Is anyone 60 or older, or living with a disability?",
        es: "¿Hay alguien de 60 años o más, o que vive con una discapacidad?"
    )
    static let elderlyOrDisabledHelper = CivicaText(
        "This matters for SNAP — older adults and people with disabilities get extra deductions and don't face an asset test in Massachusetts.",
        es: "Esto importa para SNAP — los adultos mayores y las personas con discapacidad reciben deducciones adicionales y no enfrentan una prueba de bienes en Massachusetts."
    )

    // Wave 4 — marital status (BenefitsCal ABMRS)
    static let maritalStatusTitle = CivicaText(
        "What's your marital status?",
        es: "¿Cuál es tu estado civil?"
    )
    static let maritalStatusHelper = CivicaText(
        "California asks this on the SNAP application. Pick what fits — \"Prefer not to say\" is a valid answer and your benefits aren't affected by your choice.",
        es: "California pregunta esto en la solicitud de SNAP. Elige lo que aplica — \"Prefiero no decir\" es una respuesta válida y tus beneficios no se ven afectados por tu elección."
    )

    static func maritalStatusLabel(for value: SNAPMaritalStatus, language: CivicaLanguage) -> String {
        switch (value, language) {
        case (.single,              .english): return "Single"
        case (.single,              .spanish): return "Soltero/a"
        case (.married,             .english): return "Married"
        case (.married,             .spanish): return "Casado/a"
        case (.domesticPartnership, .english): return "Domestic partnership"
        case (.domesticPartnership, .spanish): return "Unión doméstica"
        case (.separated,           .english): return "Separated"
        case (.separated,           .spanish): return "Separado/a"
        case (.divorced,            .english): return "Divorced"
        case (.divorced,            .spanish): return "Divorciado/a"
        case (.widowed,             .english): return "Widowed"
        case (.widowed,             .spanish): return "Viudo/a"
        case (.preferNotToSay,      .english): return "Prefer not to say"
        case (.preferNotToSay,      .spanish): return "Prefiero no decir"
        }
    }

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
