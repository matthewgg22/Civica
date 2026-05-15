import CivicaDesignSystem
import SwiftUI

// Migrates the legacy "whereApplyingFromStep" multi-field card from
// SNAPApplicationView into the one-question-per-screen cadence.
// Two sequential screens — state, then housing status — using the
// CivicaQuestionScreen primitive.
//
// Ordering rationale: state gates every downstream rules-engine call
// (federal-only vs federal + MA-specific BBCE / shelter standard).
// Housing status changes the deduction picture (unhoused vs stable
// home affects the homeless shelter deduction).
//
// Not wired into SNAPRouter yet — the legacy multi-field flow
// remains the active path until all 8 legacy steps are migrated
// and the router cuts over in one switch commit.

struct SNAPWhereApplyingAnswers: Equatable, Codable {
    /// Two-letter US state code ("MA", "NY", etc.) or "OTHER" when
    /// the user selected a state Civica doesn't tune for yet.
    var stateCode: String?
    var housingStatus: HousingStatus?
    /// County name within the active state, when known. CalFresh
    /// is county-administered: the right hotline, the right office,
    /// and the right Restaurant Meals Program participation all
    /// depend on county. Derived by zip-code lookup
    /// (`CACountyResolver.county(forZIP:)` etc.) at the point the
    /// user enters a ZIP, then persisted here so downstream surfaces
    /// don't re-resolve. Free-form string so future states can use
    /// their own naming (e.g. "Suffolk", "Los Angeles", "San Mateo").
    var county: String?

    var isComplete: Bool { stateCode != nil && housingStatus != nil }
}

@MainActor
final class SNAPWhereApplyingFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case state, housing

        var oneBasedIndex: Int { rawValue + 1 }
        static let total = Self.allCases.count
    }

    @Published var step: Step = .state
    @Published var answers: SNAPWhereApplyingAnswers

    init(answers: SNAPWhereApplyingAnswers = .init()) {
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
        case .state:   return answers.stateCode != nil
        case .housing: return answers.housingStatus != nil
        }
    }

    var isAtFirstStep: Bool { step == .state }
    var isAtLastStep: Bool { step == .housing }
}

struct SNAPWhereApplyingFlowView: View {
    @StateObject var viewModel: SNAPWhereApplyingFlowViewModel
    let language: CivicaLanguage
    let onComplete: (SNAPWhereApplyingAnswers) -> Void
    let onExit: () -> Void

    init(
        viewModel: SNAPWhereApplyingFlowViewModel,
        language: CivicaLanguage = .english,
        onComplete: @escaping (SNAPWhereApplyingAnswers) -> Void,
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
        case .state: stateScreen
        case .housing: housingScreen
        }
    }

    // MARK: - Screen 1: state

    private var stateScreen: some View {
        let options = SNAPWhereApplyingStrings.stateOptionsOrdered(language: language)
        return CivicaQuestionScreen(
            progress: progress(for: .state),
            title: SNAPWhereApplyingStrings.stateTitle.value(in: language),
            helper: SNAPWhereApplyingStrings.stateHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: options.map(\.label),
                selection: Binding(
                    get: {
                        options.first(where: { $0.code == viewModel.answers.stateCode })?.label
                    },
                    set: { label in
                        viewModel.answers.stateCode = options.first(where: { $0.label == label })?.code
                    }
                )
            )
        }
    }

    // MARK: - Screen 2: housing status

    private var housingScreen: some View {
        let options = HousingStatus.allCases
        return CivicaQuestionScreen(
            progress: progress(for: .housing),
            title: SNAPWhereApplyingStrings.housingTitle.value(in: language),
            helper: SNAPWhereApplyingStrings.housingHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: options.map { SNAPWhereApplyingStrings.housingLabel(for: $0, language: language) },
                selection: Binding(
                    get: {
                        viewModel.answers.housingStatus.map {
                            SNAPWhereApplyingStrings.housingLabel(for: $0, language: language)
                        }
                    },
                    set: { label in
                        viewModel.answers.housingStatus = options.first { option in
                            SNAPWhereApplyingStrings.housingLabel(for: option, language: language) == label
                        }
                    }
                )
            )
        }
    }

    // MARK: - Helpers

    private func progress(for step: SNAPWhereApplyingFlowViewModel.Step)
        -> CivicaQuestionScreenProgress
    {
        .init(
            current: step.oneBasedIndex,
            total: SNAPWhereApplyingFlowViewModel.Step.total,
            sectionIndex: SNAPApplicationSection.whereApplying.oneBasedIndex,
            sectionCount: SNAPApplicationSection.count,
            sectionTitle: SNAPApplicationSection.whereApplying.title(in: language)
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

// MARK: - Strings

enum SNAPWhereApplyingStrings {

    static let stateTitle = CivicaText(
        "Which state are you applying in?",
        es: "¿En qué estado estás solicitando?"
    )
    static let stateHelper = CivicaText(
        "SNAP rules and timelines vary by state. Civica is tuned for Massachusetts right now — other states still get a general application packet.",
        es: "Las reglas y plazos de SNAP varían según el estado. Civica está ajustada para Massachusetts ahora mismo — los otros estados aún reciben un paquete de solicitud general."
    )

    struct StateOption: Equatable {
        let code: String
        let label: String
    }

    /// MA first because Civica is MA-tuned. The "Another US state"
    /// row collapses the remaining 49 — refined to full state pickers
    /// once we add per-state rules engines.
    static func stateOptionsOrdered(language: CivicaLanguage) -> [StateOption] {
        switch language {
        case .english:
            return [
                .init(code: "MA", label: "Massachusetts"),
                .init(code: "NY", label: "New York"),
                .init(code: "CA", label: "California"),
                .init(code: "OTHER", label: "Another US state")
            ]
        case .spanish:
            return [
                .init(code: "MA", label: "Massachusetts"),
                .init(code: "NY", label: "Nueva York"),
                .init(code: "CA", label: "California"),
                .init(code: "OTHER", label: "Otro estado de EE. UU.")
            ]
        }
    }

    static let housingTitle = CivicaText(
        "How would you describe your housing right now?",
        es: "¿Cómo describirías tu vivienda en este momento?"
    )
    static let housingHelper = CivicaText(
        "This shapes which SNAP deductions can apply. It doesn't disqualify anyone.",
        es: "Esto afecta qué deducciones de SNAP pueden aplicarse. No descalifica a nadie."
    )

    static func housingLabel(for status: HousingStatus, language: CivicaLanguage) -> String {
        switch (status, language) {
        case (.stableHome, .english):         return "Stable home"
        case (.stableHome, .spanish):         return "Hogar estable"
        case (.temporaryHousing, .english):   return "Temporary housing"
        case (.temporaryHousing, .spanish):   return "Vivienda temporal"
        case (.stayingWithOthers, .english):  return "Staying with someone else"
        case (.stayingWithOthers, .spanish):  return "Quedándome con alguien"
        case (.unhoused, .english):           return "Unhoused right now"
        case (.unhoused, .spanish):           return "Sin hogar en este momento"
        }
    }
}

#if DEBUG
struct SNAPWhereApplyingFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPWhereApplyingFlowView(
                viewModel: SNAPWhereApplyingFlowViewModel(),
            language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
