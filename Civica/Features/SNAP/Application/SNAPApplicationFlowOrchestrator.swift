import CivicaDesignSystem
import SwiftUI

// Orchestrator that walks the user through the nine migrated SNAP
// sub-flows in order, owns one shared SNAPApplicationDraft, and
// hands off to the PDF generator at the end. Replaces the legacy
// SNAPStepContainerView + SNAPApplicationView pair as the default
// destination from SNAPEligibilityIntroView when the conversation
// flag is off.
//
// Two visit modes:
//
//   • Sequential — user is walking the flow start-to-finish. Each
//     sub-flow's onComplete advances to the next section. After
//     the last sub-flow the orchestrator shows the review surface.
//
//   • Edit — user tapped Edit on a specific section from the review
//     screen. The orchestrator mounts that one sub-flow, and its
//     onComplete returns to review rather than advancing.
//
// The legacy SNAPApplicationView remains in code as dead reference
// until a later cleanup commit deletes it.

@MainActor
final class SNAPApplicationFlowOrchestratorViewModel: ObservableObject {
    enum Mode {
        case sequential(currentSection: SNAPApplicationSection)
        case review
        case editing(section: SNAPApplicationSection)
    }

    @Published var draft: SNAPApplicationDraft
    @Published var mode: Mode

    private let store: SNAPApplicationDraftStore

    /// Sequential order — must match SNAPApplicationSection.allCases.
    private static let sequence: [SNAPApplicationSection] = SNAPApplicationSection.allCases

    init(store: SNAPApplicationDraftStore = SNAPApplicationDraftStore()) {
        self.store = store
        // Restore prior draft + resume target if one exists. Editing
        // mode at-kill-time falls back to review on resume — less
        // surprising than re-mounting a half-edited sub-flow.
        if let saved = store.load() {
            self.draft = saved.draft
            switch saved.mode {
            case .sequential:
                let section = saved.sequentialSection ?? .whereApplying
                self.mode = .sequential(currentSection: section)
            case .review:
                self.mode = .review
            }
        } else {
            self.draft = SNAPApplicationDraft()
            self.mode = .sequential(currentSection: .whereApplying)
        }
    }

    func finishSection(_ section: SNAPApplicationSection) {
        switch mode {
        case .editing:
            mode = .review
        case .sequential, .review:
            if let next = nextSection(after: section) {
                mode = .sequential(currentSection: next)
            } else {
                mode = .review
            }
        }
        persist()
    }

    func startEditing(_ section: SNAPApplicationSection) {
        mode = .editing(section: section)
        // Don't persist editing mode — kept in-memory only so resume
        // returns to review rather than re-mounting a half-edit.
    }

    /// Called when a sub-flow's back-arrow exits without completing.
    /// In sequential mode it backs up to the previous section; in
    /// edit mode it returns to the review screen.
    func exitCurrentSection() {
        switch mode {
        case .editing:
            mode = .review
        case .sequential(let current):
            if let prev = previousSection(before: current) {
                mode = .sequential(currentSection: prev)
            } else {
                // Already at first section — defer to caller for the
                // top-level dismiss.
            }
        case .review:
            break
        }
        persist()
    }

    /// Clears the saved draft and snaps back to the first section.
    /// Wired to the review screen's "Clear my answers and start
    /// over" secondary action.
    func resetDraft() {
        draft = SNAPApplicationDraft()
        mode = .sequential(currentSection: .whereApplying)
        store.clear()
    }

    var isAtFirstSectionInSequence: Bool {
        if case .sequential(let current) = mode, current == .whereApplying {
            return true
        }
        return false
    }

    private func nextSection(after section: SNAPApplicationSection) -> SNAPApplicationSection? {
        guard let i = Self.sequence.firstIndex(of: section), i + 1 < Self.sequence.count else {
            return nil
        }
        return Self.sequence[i + 1]
    }

    private func previousSection(before section: SNAPApplicationSection) -> SNAPApplicationSection? {
        guard let i = Self.sequence.firstIndex(of: section), i > 0 else { return nil }
        return Self.sequence[i - 1]
    }

    private func persist() {
        let persistedMode: SNAPApplicationDraftStore.PersistedMode
        var sequentialSection: SNAPApplicationSection?
        switch mode {
        case .sequential(let current):
            persistedMode = .sequential
            sequentialSection = current
        case .review:
            persistedMode = .review
        case .editing:
            // Editing is transient — persist as review so resume
            // returns to the summary, not a half-edited sub-flow.
            persistedMode = .review
        }
        store.save(.init(
            draft: draft,
            mode: persistedMode,
            sequentialSection: sequentialSection
        ))
    }
}

struct SNAPApplicationFlowOrchestratorView: View {
    @StateObject var viewModel: SNAPApplicationFlowOrchestratorViewModel
    let language: CivicaLanguage
    let onGeneratePacket: (SNAPApplicationDraft) -> Void
    let onDismiss: () -> Void

    init(
        viewModel: SNAPApplicationFlowOrchestratorViewModel,
        language: CivicaLanguage = .english,
        onGeneratePacket: @escaping (SNAPApplicationDraft) -> Void,
        onDismiss: @escaping () -> Void
    ) {
        self._viewModel = StateObject(wrappedValue: viewModel)
        self.language = language
        self.onGeneratePacket = onGeneratePacket
        self.onDismiss = onDismiss
    }

    var body: some View {
        // Hide the system back chevron — each sub-flow installs its
        // own navigationBarLeading button that routes through the
        // orchestrator's intra-flow steps (and dismisses the whole
        // flow at the first step). Rendering both produced the
        // stacked `< Civica <` chevron pair on every question screen.
        currentDestination
            .navigationBarBackButtonHidden(true)
    }

    @ViewBuilder
    private var currentDestination: some View {
        switch viewModel.mode {
        case .sequential(let section), .editing(let section):
            flow(for: section)
        case .review:
            SNAPReviewDraftFlowView(
                draft: viewModel.draft,
                language: language,
                onEdit: viewModel.startEditing,
                onGeneratePacket: { onGeneratePacket(viewModel.draft) },
                onStartOver: { viewModel.resetDraft() },
                onExit: onDismiss
            )
        }
    }

    // MARK: - Section dispatcher
    //
    // Each sub-flow is constructed with the draft slice for its
    // section so resume / edit round-trips preserve prior answers.
    // Re-instantiating per mode change is intentional — the
    // @StateObject inside each sub-flow re-seeds from the passed-in
    // view model when SwiftUI rebuilds the view tree on section change.

    @ViewBuilder
    private func flow(for section: SNAPApplicationSection) -> some View {
        switch section {
        case .whereApplying:
            SNAPWhereApplyingFlowView(
                viewModel: SNAPWhereApplyingFlowViewModel(answers: viewModel.draft.whereApplying),
                language: language,
                onComplete: { answers in
                    viewModel.draft.whereApplying = answers
                    viewModel.finishSection(.whereApplying)
                },
                onExit: handleExit
            )
        case .applicantAge:
            SNAPApplicantAgeFlowView(
                viewModel: SNAPApplicantAgeFlowViewModel(answers: viewModel.draft.applicantAge),
                language: language,
                onComplete: { answers in
                    viewModel.draft.applicantAge = answers
                    viewModel.finishSection(.applicantAge)
                },
                onExit: handleExit
            )
        case .household:
            SNAPHouseholdQuestionFlowView(
                viewModel: SNAPHouseholdQuestionFlowViewModel(answers: viewModel.draft.household),
                language: language,
                onComplete: { answers in
                    viewModel.draft.household = answers
                    viewModel.finishSection(.household)
                },
                onExit: handleExit
            )
        case .contact:
            SNAPContactFlowView(
                viewModel: SNAPContactFlowViewModel(answers: viewModel.draft.contact),
                language: language,
                onComplete: { answers in
                    viewModel.draft.contact = answers
                    viewModel.finishSection(.contact)
                },
                onExit: handleExit
            )
        case .income:
            SNAPIncomeFlowView(
                viewModel: SNAPIncomeFlowViewModel(answers: viewModel.draft.income),
                language: language,
                onComplete: { answers in
                    viewModel.draft.income = answers
                    viewModel.finishSection(.income)
                },
                onExit: handleExit
            )
        case .studentStatus:
            SNAPStudentStatusFlowView(
                viewModel: SNAPStudentStatusFlowViewModel(answers: viewModel.draft.studentStatus),
                language: language,
                onComplete: { answers in
                    viewModel.draft.studentStatus = answers
                    viewModel.finishSection(.studentStatus)
                },
                onExit: handleExit
            )
        case .expenses:
            SNAPExpensesFlowView(
                viewModel: SNAPExpensesFlowViewModel(answers: viewModel.draft.expenses),
                language: language,
                onComplete: { answers in
                    viewModel.draft.expenses = answers
                    viewModel.finishSection(.expenses)
                },
                onExit: handleExit
            )
        case .documentsChecklist:
            SNAPDocumentsChecklistFlowView(
                viewModel: SNAPDocumentsChecklistFlowViewModel(answers: viewModel.draft.documentsChecklist),
                language: language,
                onComplete: { answers in
                    viewModel.draft.documentsChecklist = answers
                    viewModel.finishSection(.documentsChecklist)
                },
                onExit: handleExit
            )
        }
    }

    /// Exit-from-current-section behavior. In edit mode we go back to
    /// review. In sequential mode at the first section we dismiss to
    /// the parent navigation stack; otherwise we step back one section.
    private func handleExit() {
        if case .editing = viewModel.mode {
            viewModel.exitCurrentSection()
            return
        }
        if viewModel.isAtFirstSectionInSequence {
            onDismiss()
        } else {
            viewModel.exitCurrentSection()
        }
    }
}

#if DEBUG
struct SNAPApplicationFlowOrchestratorView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPApplicationFlowOrchestratorView(
                viewModel: SNAPApplicationFlowOrchestratorViewModel(),
            language: .english,
                onGeneratePacket: { _ in },
                onDismiss: {}
            )
        }
    }
}
#endif
