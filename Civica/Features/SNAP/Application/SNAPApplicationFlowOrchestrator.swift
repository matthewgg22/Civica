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

    @Published var draft = SNAPApplicationDraft()
    @Published var mode: Mode = .sequential(currentSection: .whereApplying)

    /// Sequential order — must match SNAPApplicationSection.allCases.
    private static let sequence: [SNAPApplicationSection] = SNAPApplicationSection.allCases

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
    }

    func startEditing(_ section: SNAPApplicationSection) {
        mode = .editing(section: section)
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
}

struct SNAPApplicationFlowOrchestratorView: View {
    @StateObject var viewModel: SNAPApplicationFlowOrchestratorViewModel
    let language: CivicaLanguage
    let onGeneratePacket: (SNAPApplicationDraft) -> Void
    let onDismiss: () -> Void

    init(
        viewModel: SNAPApplicationFlowOrchestratorViewModel = SNAPApplicationFlowOrchestratorViewModel(),
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
        currentDestination
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
                onExit: onDismiss
            )
        }
    }

    // MARK: - Section dispatcher

    @ViewBuilder
    private func flow(for section: SNAPApplicationSection) -> some View {
        switch section {
        case .whereApplying:
            SNAPWhereApplyingFlowView(
                language: language,
                onComplete: { answers in
                    viewModel.draft.whereApplying = answers
                    viewModel.finishSection(.whereApplying)
                },
                onExit: handleExit
            )
        case .applicantAge:
            SNAPApplicantAgeFlowView(
                language: language,
                onComplete: { answers in
                    viewModel.draft.applicantAge = answers
                    viewModel.finishSection(.applicantAge)
                },
                onExit: handleExit
            )
        case .household:
            SNAPHouseholdQuestionFlowView(
                language: language,
                onComplete: { answers in
                    viewModel.draft.household = answers
                    viewModel.finishSection(.household)
                },
                onExit: handleExit
            )
        case .contact:
            SNAPContactFlowView(
                language: language,
                onComplete: { answers in
                    viewModel.draft.contact = answers
                    viewModel.finishSection(.contact)
                },
                onExit: handleExit
            )
        case .income:
            SNAPIncomeFlowView(
                language: language,
                onComplete: { answers in
                    viewModel.draft.income = answers
                    viewModel.finishSection(.income)
                },
                onExit: handleExit
            )
        case .studentStatus:
            SNAPStudentStatusFlowView(
                language: language,
                onComplete: { answers in
                    viewModel.draft.studentStatus = answers
                    viewModel.finishSection(.studentStatus)
                },
                onExit: handleExit
            )
        case .expenses:
            SNAPExpensesFlowView(
                language: language,
                onComplete: { answers in
                    viewModel.draft.expenses = answers
                    viewModel.finishSection(.expenses)
                },
                onExit: handleExit
            )
        case .documentsChecklist:
            SNAPDocumentsChecklistFlowView(
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
    static var previews: some View {
        NavigationStack {
            SNAPApplicationFlowOrchestratorView(
                language: .english,
                onGeneratePacket: { _ in },
                onDismiss: {}
            )
        }
    }
}
#endif
