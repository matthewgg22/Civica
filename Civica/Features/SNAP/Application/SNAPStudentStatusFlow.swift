import CivicaDesignSystem
import SwiftUI

// Migrates the legacy "studentStatusStep" card. SNAP student rules
// (7 CFR 273.5) are real: most enrolled higher-ed students don't
// qualify unless they meet a specific exception — working 20+ hours
// a week, doing federal/state work-study, caring for a dependent
// under 6 (or under 12 with no adequate childcare), etc. The legacy
// form asks the gating yes/no plus four follow-ups; this flow keeps
// that exact shape but spreads it across five conversational screens.
//
// Skip logic: if the user is not enrolled in higher ed, screen 1 is
// the only screen. The four follow-ups (half-time / 20-hr / work-
// study / dependent-child) only render for enrolled students.

struct SNAPStudentStatusAnswers: Equatable, Codable {
    var enrolledInHigherEd: Bool?
    var enrolledHalfTime: Bool?
    var works20PlusHours: Bool?
    var inWorkStudy: Bool?
    var responsibleForDependentChild: Bool?
}

@MainActor
final class SNAPStudentStatusFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case enrollment
        case halfTime
        case twentyHours
        case workStudy
        case dependentChild

        var oneBasedIndex: Int { rawValue + 1 }
        static let total = Self.allCases.count
    }

    @Published var step: Step = .enrollment
    @Published var answers: SNAPStudentStatusAnswers

    init(answers: SNAPStudentStatusAnswers = .init()) {
        self.answers = answers
    }

    func advance() {
        if step == .enrollment && answers.enrolledInHigherEd == false {
            // Non-students are done at screen 1 — no follow-ups apply.
            isComplete = true
            return
        }
        if let next = Step(rawValue: step.rawValue + 1) {
            step = next
        } else {
            isComplete = true
        }
    }

    func goBack() {
        if let prev = Step(rawValue: step.rawValue - 1) {
            step = prev
        }
    }

    @Published var isComplete: Bool = false

    var canAdvanceFromCurrentStep: Bool {
        switch step {
        case .enrollment:      return answers.enrolledInHigherEd != nil
        case .halfTime:        return answers.enrolledHalfTime != nil
        case .twentyHours:     return answers.works20PlusHours != nil
        case .workStudy:       return answers.inWorkStudy != nil
        case .dependentChild:  return answers.responsibleForDependentChild != nil
        }
    }

    var isAtFirstStep: Bool { step == .enrollment }

    /// When non-student: enrollment is the only step, so it's also
    /// the last step. When enrolled: dependent-child is the last.
    var isAtFunctionalLastStep: Bool {
        if step == .enrollment && answers.enrolledInHigherEd == false {
            return true
        }
        return step == .dependentChild
    }

    /// Total screens for the progress chip. Five when student-flow
    /// applies; one when the user said "no" on screen 1.
    var visibleTotal: Int {
        answers.enrolledInHigherEd == false ? 1 : Step.total
    }
}

struct SNAPStudentStatusFlowView: View {
    @StateObject var viewModel: SNAPStudentStatusFlowViewModel
    let language: CivicaLanguage
    let onComplete: (SNAPStudentStatusAnswers) -> Void
    let onExit: () -> Void

    init(
        viewModel: SNAPStudentStatusFlowViewModel,
        language: CivicaLanguage = .english,
        onComplete: @escaping (SNAPStudentStatusAnswers) -> Void,
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
                    .accessibilityLabel(viewModel.isAtFirstStep
                        ? CivicaQuestionStrings.closeLabel.value(in: language)
                        : CivicaQuestionStrings.backLabel.value(in: language))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private var currentScreen: some View {
        switch viewModel.step {
        case .enrollment:     enrollmentScreen
        case .halfTime:       halfTimeScreen
        case .twentyHours:    twentyHoursScreen
        case .workStudy:      workStudyScreen
        case .dependentChild: dependentChildScreen
        }
    }

    // MARK: - Screens

    private var enrollmentScreen: some View {
        yesNoScreen(
            step: .enrollment,
            title: SNAPStudentStatusStrings.enrollmentTitle.value(in: language),
            helper: SNAPStudentStatusStrings.enrollmentHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.enrolledInHigherEd },
                set: { viewModel.answers.enrolledInHigherEd = $0 }
            )
        )
    }

    private var halfTimeScreen: some View {
        yesNoScreen(
            step: .halfTime,
            title: SNAPStudentStatusStrings.halfTimeTitle.value(in: language),
            helper: SNAPStudentStatusStrings.halfTimeHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.enrolledHalfTime },
                set: { viewModel.answers.enrolledHalfTime = $0 }
            )
        )
    }

    private var twentyHoursScreen: some View {
        yesNoScreen(
            step: .twentyHours,
            title: SNAPStudentStatusStrings.twentyHoursTitle.value(in: language),
            helper: SNAPStudentStatusStrings.twentyHoursHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.works20PlusHours },
                set: { viewModel.answers.works20PlusHours = $0 }
            )
        )
    }

    private var workStudyScreen: some View {
        yesNoScreen(
            step: .workStudy,
            title: SNAPStudentStatusStrings.workStudyTitle.value(in: language),
            helper: SNAPStudentStatusStrings.workStudyHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.inWorkStudy },
                set: { viewModel.answers.inWorkStudy = $0 }
            )
        )
    }

    private var dependentChildScreen: some View {
        yesNoScreen(
            step: .dependentChild,
            title: SNAPStudentStatusStrings.dependentChildTitle.value(in: language),
            helper: SNAPStudentStatusStrings.dependentChildHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.responsibleForDependentChild },
                set: { viewModel.answers.responsibleForDependentChild = $0 }
            )
        )
    }

    // MARK: - Shared yes/no affordance

    private func yesNoScreen(
        step: SNAPStudentStatusFlowViewModel.Step,
        title: String,
        helper: String,
        value: Binding<Bool?>
    ) -> some View {
        CivicaQuestionScreen(
            progress: .init(
                current: step.oneBasedIndex,
                total: viewModel.visibleTotal,
                sectionIndex: SNAPApplicationSection.studentStatus.oneBasedIndex,
                sectionCount: SNAPApplicationSection.count,
                sectionTitle: SNAPApplicationSection.studentStatus.title(in: language)
            ),
            title: title,
            helper: helper,
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: value.wrappedValue != nil,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionYesNo(
                selection: value,
                yesLabel: CivicaQuestionStrings.yesLabel.value(in: language),
                noLabel: CivicaQuestionStrings.noLabel.value(in: language)
            )
        }
    }

    private func advanceOrComplete() {
        withAnimation(.easeInOut(duration: 0.18)) {
            if viewModel.isAtFunctionalLastStep {
                onComplete(viewModel.answers)
            } else {
                viewModel.advance()
                if viewModel.isComplete {
                    onComplete(viewModel.answers)
                }
            }
        }
    }
}

// MARK: - Strings

enum SNAPStudentStatusStrings {

    static let enrollmentTitle = CivicaText(
        "Are you currently in college or another higher-ed program?",
        es: "¿Estás actualmente en la universidad o en otro programa de educación superior?"
    )
    static let enrollmentHelper = CivicaText(
        "This includes college, grad school, trade school, certificate programs, GED, or adult basic education. SNAP has special rules for students.",
        es: "Esto incluye universidad, posgrado, escuela técnica, programas de certificado, GED o educación básica para adultos. SNAP tiene reglas especiales para estudiantes."
    )

    static let halfTimeTitle = CivicaText(
        "Are you enrolled at least half-time?",
        es: "¿Estás inscrito al menos a medio tiempo?"
    )
    static let halfTimeHelper = CivicaText(
        "Use your school's definition. If you're not sure, pick the closer answer — you can confirm later.",
        es: "Usa la definición de tu escuela. Si no estás seguro, elige la respuesta más cercana — puedes confirmar después."
    )

    static let twentyHoursTitle = CivicaText(
        "Do you work at least 20 hours a week?",
        es: "¿Trabajas al menos 20 horas a la semana?"
    )
    static let twentyHoursHelper = CivicaText(
        "Use your usual weekly hours across all jobs. Working 20+ hours is one of the main SNAP student exceptions.",
        es: "Usa tus horas semanales habituales en todos tus trabajos. Trabajar más de 20 horas es una de las principales excepciones estudiantiles de SNAP."
    )

    static let workStudyTitle = CivicaText(
        "Are you in a work-study program?",
        es: "¿Estás en un programa de estudio y trabajo?"
    )
    static let workStudyHelper = CivicaText(
        "A federal or state work-study placement counts as a SNAP student exception even if it's part-time.",
        es: "Una colocación de estudio y trabajo federal o estatal cuenta como excepción estudiantil de SNAP, aunque sea de medio tiempo."
    )

    static let dependentChildTitle = CivicaText(
        "Are you the parent or guardian of a child?",
        es: "¿Eres padre, madre o tutor de un menor?"
    )
    static let dependentChildHelper = CivicaText(
        "Caring for a child under 6 is a SNAP student exception. Caring for a child under 12 may also qualify if you can't find adequate childcare.",
        es: "Cuidar a un menor de 6 años es una excepción estudiantil de SNAP. Cuidar a un menor de 12 años también puede calificar si no encuentras cuidado infantil adecuado."
    )
}

#if DEBUG
struct SNAPStudentStatusFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPStudentStatusFlowView(
                viewModel: SNAPStudentStatusFlowViewModel(),
            language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
