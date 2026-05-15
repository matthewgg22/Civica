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
        case idScanOffer
        case sequential(currentSection: SNAPApplicationSection)
        case review
        case editing(section: SNAPApplicationSection)
    }

    @Published var draft: SNAPApplicationDraft
    @Published var mode: Mode
    /// Latest expedited-triage result, recomputed after every
    /// `finishSection` call. Nil until the user completes the first
    /// section. UI surfaces (decision math, waiting room) read this
    /// to decide whether to show the expedited banner.
    @Published var triageResult: ExpeditedTriageResult?
    /// Per-field confidence scores written by the voice-intake layer.
    /// In-memory only; consumed by `.snapVoiceFieldHighlight(_:)` to
    /// paint the amber "needs review" border. Cleared on resetDraft.
    @Published var voiceConfidence: [SNAPFieldKey: Double] = [:]

    private let store: SNAPApplicationDraftStore
    private let classifier: any ExpeditedClassifier

    /// Sequential order — must match SNAPApplicationSection.allCases.
    private static let sequence: [SNAPApplicationSection] = SNAPApplicationSection.allCases

    init(
        store: SNAPApplicationDraftStore = SNAPApplicationDraftStore(),
        classifier: any ExpeditedClassifier = HeuristicExpeditedClassifier()
    ) {
        self.store = store
        self.classifier = classifier
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
            self.mode = .idScanOffer
        }
        // Seed the triage result from any restored draft so the banner
        // is correct on launch without waiting for a step transition.
        recomputeTriage()
    }

    func finishIDScanOffer() {
        mode = .sequential(currentSection: .whereApplying)
        persist()
    }

    func finishSection(_ section: SNAPApplicationSection) {
        switch mode {
        case .editing:
            mode = .review
        case .sequential, .review, .idScanOffer:
            if let next = nextSection(after: section) {
                mode = .sequential(currentSection: next)
            } else {
                mode = .review
            }
        }
        recomputeTriage()
        persist()
    }

    /// Detached so the API stays consistent when a future CoreML
    /// classifier replaces the heuristic. Today's heuristic is
    /// sync-fast (<1ms); the hop keeps callers off the main thread.
    private func recomputeTriage() {
        let snapshot = draft
        let classifier = classifier
        Task { [weak self] in
            let result = await evaluateTriage(draft: snapshot, classifier: classifier)
            await MainActor.run { self?.triageResult = result }
        }
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
                // At first section — go back to ID scan offer so the
                // back button from whereApplying returns there.
                mode = .idScanOffer
            }
        case .review, .idScanOffer:
            break
        }
        persist()
    }

    /// Clears the saved draft and snaps back to the first section.
    /// Wired to the review screen's "Clear my answers and start
    /// over" secondary action. Also wipes any captured document
    /// images on disk — "start over" should leave no trace.
    func resetDraft() {
        draft = SNAPApplicationDraft()
        voiceConfidence.removeAll()
        mode = .idScanOffer
        store.clear()
        SNAPCapturedDocumentStore.clearAll()
        SNAPCapturedDocumentStore.clearPacketPDFs()
        triageResult = nil
    }

    var isAtFirstSectionInSequence: Bool {
        if case .idScanOffer = mode { return true }
        if case .sequential(let current) = mode, current == .whereApplying {
            return true
        }
        return false
    }

    /// Supported-state beta gate predicate. Returns true when the
    /// saved draft has a stateCode outside SNAPCoveragePolicy.
    /// supportedStateCodes AND the user isn't actively editing the
    /// whereApplying section (the edit case lets them switch back
    /// to a supported state without bouncing off the gate first).
    /// Exposed on the view model so compliance tests can assert
    /// routing without spinning up SwiftUI. Delegates the in/out-of-
    /// scope decision to SNAPCoveragePolicy so the same rule applies
    /// at every entry point (orchestrator, standalone estimator,
    /// launch-time invalidation).
    var shouldShowUnsupportedStateGate: Bool {
        if case .editing(.whereApplying) = mode { return false }
        return SNAPCoveragePolicy.shouldShowUnsupportedStateGate(
            for: draft.whereApplying.stateCode
        )
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

    func autosave() { persist() }

    private func persist() {
        let persistedMode: SNAPApplicationDraftStore.PersistedMode
        var sequentialSection: SNAPApplicationSection?
        switch mode {
        case .idScanOffer:
            // Persist as sequential at the first section so a kill-and-
            // resume returns to whereApplying (the ID offer is ephemeral).
            persistedMode = .sequential
            sequentialSection = .whereApplying
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
            .onChange(of: viewModel.draft) { _, _ in
                viewModel.autosave()
            }
    }

    @ViewBuilder
    private var currentDestination: some View {
        // Supported-state beta gate (CA + MA today via
        // SNAPCoveragePolicy.supportedStateCodes) — enforced at the
        // orchestrator level so it's deep-link safe. Predicate lives
        // on the view model so it's testable from compliance tests.
        if viewModel.shouldShowUnsupportedStateGate {
            SNAPUnsupportedStateView(
                stateCode: viewModel.draft.whereApplying.stateCode ?? "",
                language: language,
                onChangeState: { viewModel.startEditing(.whereApplying) },
                onExit: onDismiss
            )
        } else {
            switch viewModel.mode {
            case .idScanOffer:
                SNAPIDScanOfferView(
                    language: language,
                    onScanComplete: { image, dateOfBirth in
                        if let dob = dateOfBirth {
                            viewModel.draft.applicantAge.dateOfBirth = dob
                        }
                        if let image {
                            viewModel.draft.documentsChecklist.capturedDocuments.insert(.photoID)
                            viewModel.draft.documentsChecklist.documentsAvailable.insert(.photoID)
                            SNAPCapturedDocumentStore.save(image, as: .photoID)
                        }
                        viewModel.finishIDScanOffer()
                    },
                    onSkip: { viewModel.finishIDScanOffer() },
                    onExit: onDismiss
                )
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
            voiceWrap(.whereApplyingFrom) {
                SNAPWhereApplyingFlowView(
                    viewModel: SNAPWhereApplyingFlowViewModel(answers: viewModel.draft.whereApplying),
                    language: language,
                    onComplete: { answers in
                        viewModel.draft.whereApplying = answers
                        viewModel.finishSection(.whereApplying)
                    },
                    onExit: handleExit
                )
            }
        case .applicantAge:
            voiceWrap(.applicantAge) {
                SNAPApplicantAgeFlowView(
                    viewModel: SNAPApplicantAgeFlowViewModel(answers: viewModel.draft.applicantAge),
                    language: language,
                    onComplete: { answers in
                        viewModel.draft.applicantAge = answers
                        viewModel.finishSection(.applicantAge)
                    },
                    onExit: handleExit
                )
            }
        case .household:
            voiceWrap(.householdBasics) {
                SNAPHouseholdQuestionFlowView(
                    viewModel: SNAPHouseholdQuestionFlowViewModel(answers: viewModel.draft.household),
                    language: language,
                    onComplete: { answers in
                        viewModel.draft.household = answers
                        viewModel.finishSection(.household)
                    },
                    onExit: handleExit
                )
            }
        case .contact:
            voiceWrap(.addressContact) {
                SNAPContactFlowView(
                    viewModel: SNAPContactFlowViewModel(answers: viewModel.draft.contact),
                    language: language,
                    onComplete: { answers in
                        viewModel.draft.contact = answers
                        viewModel.finishSection(.contact)
                    },
                    onExit: handleExit
                )
            }
        case .income:
            voiceWrap(.income) {
                SNAPIncomeFlowView(
                    viewModel: SNAPIncomeFlowViewModel(answers: viewModel.draft.income),
                    language: language,
                    onComplete: { answers in
                        viewModel.draft.income = answers
                        viewModel.finishSection(.income)
                    },
                    onExit: handleExit
                )
            }
        case .studentStatus:
            voiceWrap(.studentStatus) {
                SNAPStudentStatusFlowView(
                    viewModel: SNAPStudentStatusFlowViewModel(answers: viewModel.draft.studentStatus),
                    language: language,
                    onComplete: { answers in
                        viewModel.draft.studentStatus = answers
                        viewModel.finishSection(.studentStatus)
                    },
                    onExit: handleExit
                )
            }
        case .expenses:
            voiceWrap(.expenses) {
                SNAPExpensesFlowView(
                    viewModel: SNAPExpensesFlowViewModel(
                        answers: viewModel.draft.expenses,
                        hasMinorInHousehold: viewModel.draft.household.hasMinorInHousehold ?? true,
                        hasElderlyOrDisabled: viewModel.draft.household.hasElderlyOrDisabled ?? true
                    ),
                    language: language,
                    onComplete: { answers in
                        viewModel.draft.expenses = answers
                        viewModel.finishSection(.expenses)
                    },
                    onExit: handleExit
                )
            }
        case .documentsChecklist:
            voiceWrap(.documentsChecklist) {
                SNAPDocumentsChecklistFlowView(
                    viewModel: SNAPDocumentsChecklistFlowViewModel(
                        answers: viewModel.draft.documentsChecklist,
                        draft: viewModel.draft
                    ),
                    language: language,
                    onComplete: { answers in
                        viewModel.draft.documentsChecklist = answers
                        viewModel.finishSection(.documentsChecklist)
                    },
                    onExit: handleExit
                )
            }
        }
    }

    /// Wraps a per-section flow view with the voice-intake affordance
    /// (mic button + transcript chip) on iOS 26+. On older OS versions
    /// the wrap is a no-op and the typed flow is unchanged.
    @ViewBuilder
    private func voiceWrap<Content: View>(
        _ step: SNAPDraftStep,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        if #available(iOS 26.0, *) {
            SNAPVoiceSection(
                step: step,
                draft: $viewModel.draft,
                confidence: $viewModel.voiceConfidence,
                content: content
            )
        } else {
            content()
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
        if case .idScanOffer = viewModel.mode {
            onDismiss()
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
