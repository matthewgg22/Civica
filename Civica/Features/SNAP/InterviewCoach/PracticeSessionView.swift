import AVFoundation
import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE: practice session chat UI.
// Renders the transcript as alternating bubbles, exposes a text input bar
// at the bottom, and pushes to ReviewSummaryView once scoring completes.
// UI chrome bilingual via InterviewCoachStrings; the LLM-generated
// caseworker turns come back in the language the backend produced them
// (English-only at v1 -- backend localization tracked separately).
struct PracticeSessionView: View {
    // The parent passes a recertId (or empty string when not yet wired up
    // to a real recert store — the VM surfaces a clear error in that case).
    @StateObject private var viewModel: PracticeSessionViewModel
    @State private var showScoreSheet = false
    @FocusState private var inputFocused: Bool

    /// Default initializer used by existing call sites that don't yet have
    /// a recertId or a wired auth in scope. Constructs a VM whose token
    /// provider returns nil, so the first network call lands the VM in a
    /// clear `.notAuthenticated` / `.failed` state until the call site is
    /// migrated to `init(recertId:auth:)`.
    init(recertId: String = "") {
        _viewModel = StateObject(wrappedValue: PracticeSessionViewModel(recertId: recertId))
    }

    /// Preferred init: wires the live token provider against an
    /// already-resolved CivicaEnrollmentAuth.
    init(recertId: String, auth: CivicaEnrollmentAuth) {
        _viewModel = StateObject(wrappedValue: PracticeSessionViewModel.make(
            recertId: recertId,
            auth: auth
        ))
    }

    /// Persona-aware init used by PersonaPickerView. Lets the caller
    /// thread a chosen SessionContext (caseworker style + applicant
    /// scenario) into the underlying view model without changing the
    /// shorter convenience inits above.
    init(
        recertId: String,
        context: PracticeSessionViewModel.SessionContext,
        auth: CivicaEnrollmentAuth
    ) {
        _viewModel = StateObject(wrappedValue: PracticeSessionViewModel.make(
            recertId: recertId,
            context: context,
            auth: auth
        ))
    }

    // Voice input: SNAPVoiceIntakeService in transcript-only mode feeds
    // the final transcript into `viewModel.draftResponse` so the user can
    // review and edit before sending. Gated on iOS 26 because the service
    // is `@available(iOS 26.0, *)`.
    @StateObject private var voiceService = VoiceServiceContainer()

    // T-DR7: track mic permission so the mic button is suppressed when
    // the user has explicitly denied access.
    @State private var micPermissionStatus: AVAudioApplication.recordPermission = AVAudioApplication.shared.recordPermission

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    /// Wrapper that hides the iOS 26 availability gate behind a plain
    /// ObservableObject. SwiftUI's @StateObject requires a non-conditional
    /// type, so we own the optional service inside and expose it via
    /// `service`. Older iOS versions get nil → voice UI is suppressed.
    @MainActor
    final class VoiceServiceContainer: ObservableObject {
        private var _service: AnyObject?

        @available(iOS 26.0, *)
        var service: SNAPVoiceIntakeService? {
            if _service == nil { _service = SNAPVoiceIntakeService() }
            return _service as? SNAPVoiceIntakeService
        }

        var isAvailable: Bool {
            if #available(iOS 26.0, *) { return true }
            return false
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            contextHeader

            InterviewCoachDisclaimer(language: language, variant: .compact)

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                        ForEach(Array(viewModel.transcript.enumerated()), id: \.offset) { index, turn in
                            TurnRowView(turn: turn).id(index)
                        }

                        if case .awaitingCaseworker = viewModel.status {
                            if viewModel.streamingCaseworkerText.isEmpty {
                                HStack(spacing: CivicaSpacing.xs) {
                                    ProgressView().controlSize(.small)
                                    Text(InterviewCoachStrings.caseworkerTyping.value(in: language))
                                        .font(CivicaTypography.captionStrong)
                                        .foregroundStyle(CivicaColors.graphite)
                                    Spacer(minLength: CivicaSpacing.sm)
                                    CivicaAIBadge()
                                }
                                .padding(.leading, CivicaSpacing.sm)
                                .padding(.trailing, CivicaSpacing.sm)
                            } else {
                                HStack {
                                    Text(viewModel.streamingCaseworkerText)
                                        .font(CivicaTypography.body)
                                        .foregroundStyle(CivicaColors.ink)
                                        .padding(CivicaSpacing.sm)
                                        .background(
                                            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                                                .fill(CivicaColors.surfacePrimary)
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                                                .stroke(CivicaColors.hairline, lineWidth: 1)
                                        )
                                    Spacer(minLength: 32)
                                }
                            }
                        }

                        if let coaching = viewModel.latestCoaching, !coaching.isEmpty {
                            HStack(alignment: .top, spacing: CivicaSpacing.xs) {
                                CivicaAIBadge()
                                Text(coaching)
                                    .font(CivicaTypography.captionStrong)
                                    .foregroundStyle(CivicaColors.graphite)
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, CivicaSpacing.sm)
                        }

                        if case .failed(let message) = viewModel.status {
                            errorBanner(message)
                            retryButton
                        }

                        if viewModel.status == .complete {
                            completionFooter
                        }
                    }
                    .padding(.horizontal, CivicaSpacing.md)
                    .padding(.vertical, CivicaSpacing.md)
                }
                .onChange(of: viewModel.transcript.count) { _, newCount in
                    if newCount > 0 {
                        civicaWithAnimation(.easeOut(duration: 0.2)) {
                            proxy.scrollTo(newCount - 1, anchor: .bottom)
                        }
                    }
                }
            }

            if viewModel.status != .complete {
                inputBar
            }
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(InterviewCoachStrings.navPracticeSession.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.startIfNeeded() }
        .onAppear {
            InterviewCoachAnalytics.track(.sessionStarted, parameters: [
                "state_code": viewModel.context.stateCode,
                "scenario":   viewModel.context.scenario.rawValue,
                "archetype":  viewModel.context.archetype.rawValue,
                "persona":    viewModel.context.persona.rawValue,
                "language":   InterviewCoachAnalytics.languageCode(language)
            ])
        }
        .onChange(of: viewModel.status) { _, newStatus in
            switch newStatus {
            case .complete:
                InterviewCoachAnalytics.track(.sessionCompleted, parameters: [
                    "turn_count": String(viewModel.transcript.count)
                ])
            case .failed:
                InterviewCoachAnalytics.track(.sessionFailed, parameters: [
                    "turn_count": String(viewModel.transcript.count)
                ])
            default:
                break
            }
        }
        .navigationDestination(isPresented: $showScoreSheet) {
            if let score = viewModel.score {
                ReviewSummaryView(score: score)
            }
        }
    }

    // State-flag images live in the VoteNow assets bundle; on the Civica
    // side we surface the state code in a hairline pill instead until the
    // flag asset catalog ships.
    private var contextHeader: some View {
        HStack(spacing: CivicaSpacing.sm) {
            Text(viewModel.context.stateCode)
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.ink)
                .padding(.horizontal, CivicaSpacing.xs)
                .padding(.vertical, 2)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .fill(CivicaColors.amberSurface)
                )
            VStack(alignment: .leading, spacing: 0) {
                Text("\(viewModel.context.stateName) — \(viewModel.context.scenario.localizedLabel(in: language))")
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text("\(viewModel.context.persona.localizedLabel(in: language)) · \(viewModel.context.archetype.localizedLabel(in: language))")
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, CivicaSpacing.md)
        .padding(.vertical, CivicaSpacing.xs)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .overlay(
            Rectangle().frame(height: 1).foregroundStyle(CivicaColors.hairline),
            alignment: .bottom
        )
    }

    private var inputBar: some View {
        VStack(spacing: 0) {
            // T-DR7: when mic access is denied, show an inline link to Settings
            // instead of the mic button so the user knows how to re-enable it.
            if micPermissionStatus == .denied {
                HStack(spacing: CivicaSpacing.xs) {
                    Image(systemName: "mic.slash.fill")
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .accessibilityHidden(true)
                    Button(InterviewCoachStrings.micAccessNeeded.value(in: language)) {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, CivicaSpacing.md)
                .padding(.top, CivicaSpacing.xs)
            }

            HStack(alignment: .bottom, spacing: CivicaSpacing.sm) {
                TextField(InterviewCoachStrings.yourAnswerPlaceholder.value(in: language),
                          text: $viewModel.draftResponse,
                          axis: .vertical)
                    .focused($inputFocused)
                    .textInputAutocapitalization(.sentences)
                    .font(CivicaTypography.body)
                    .padding(CivicaSpacing.sm)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                            .fill(CivicaColors.surfacePrimary)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                            .stroke(CivicaColors.hairline, lineWidth: 1)
                    )
                    .lineLimit(1...5)
                    .disabled(viewModel.status != .awaitingUser)

                // T-DR7: mic button — shown only when permission is granted or
                // undetermined (tapping undetermined requests permission first).
                // Hidden entirely when denied; Settings link shown above instead.
                if #available(iOS 26.0, *), let micService = voiceService.service {
                    if micPermissionStatus != .denied {
                        SNAPVoiceMicButton(service: micService)
                            .disabled(viewModel.status != .awaitingUser)
                            .opacity(viewModel.status == .awaitingUser ? 1.0 : 0.4)
                            .simultaneousGesture(TapGesture().onEnded {
                                // Request permission on first tap when undetermined.
                                if micPermissionStatus == .undetermined {
                                    AVAudioApplication.requestRecordPermission { _ in
                                        DispatchQueue.main.async {
                                            micPermissionStatus = AVAudioApplication.shared.recordPermission
                                        }
                                    }
                                }
                            })
                    }
                }

                // T-DR8: send button — minimum 44×44pt touch target (HIG).
                // The icon is rendered at 28pt; the tappable area is padded
                // out to 44pt via the inner frame + contentShape.
                Button {
                    inputFocused = false
                    InterviewCoachAnalytics.track(.sessionTurnSent, parameters: [
                        "turn_count": String(viewModel.transcript.count + 1)
                    ])
                    Task { await viewModel.submitUserResponse() }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .resizable().scaledToFit()
                        .frame(width: 28, height: 28)
                        .foregroundStyle(canSend ? CivicaColors.pinePrimary : CivicaColors.graphite.opacity(0.4))
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .disabled(!canSend)
                .buttonStyle(.plain)
                .accessibilityLabel("Send response")
            }
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.sm)
        }
        .background(CivicaColors.paper)
        .overlay(
            Rectangle().frame(height: 1).foregroundStyle(CivicaColors.hairline),
            alignment: .top
        )
        .task {
            // Drain the voice service's update stream once per view lifetime.
            // On `.finalTranscript(text)` the recognized speech is appended
            // to draftResponse so the user can review + edit before sending.
            // Cancellation propagates when the view goes away (.task scope).
            if #available(iOS 26.0, *), let micService = voiceService.service {
                for await update in micService.updates {
                    switch update {
                    case .finalTranscript(let text):
                        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !trimmed.isEmpty else { continue }
                        // Append to existing draft if user was typing, otherwise replace.
                        if viewModel.draftResponse.isEmpty {
                            viewModel.draftResponse = trimmed
                        } else {
                            viewModel.draftResponse += " " + trimmed
                        }
                        inputFocused = true
                    case .partialTranscript, .extracted, .failed:
                        // Partial transcripts are shown in the mic button's
                        // visual state; extracted/failed don't apply to
                        // transcript-only mode (extracted) or are surfaced
                        // by the mic button's error state (failed).
                        break
                    }
                }
            }
        }
    }

    private var canSend: Bool {
        viewModel.status == .awaitingUser &&
            !viewModel.draftResponse.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var completionFooter: some View {
        VStack(spacing: CivicaSpacing.sm) {
            Text(InterviewCoachStrings.interviewComplete.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)

            if viewModel.score == nil {
                Button {
                    InterviewCoachAnalytics.track(.feedbackRequested)
                    Task {
                        await viewModel.requestScore()
                        if viewModel.score != nil { showScoreSheet = true }
                    }
                } label: {
                    Text(InterviewCoachStrings.getFeedback.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(.white)
                        .padding(.horizontal, CivicaSpacing.lg)
                        .padding(.vertical, CivicaSpacing.sm)
                        .background(Capsule().fill(CivicaColors.pinePrimary))
                }
                .buttonStyle(.plain)
            } else {
                Button {
                    showScoreSheet = true
                } label: {
                    Text(InterviewCoachStrings.seeFeedback.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(.white)
                        .padding(.horizontal, CivicaSpacing.lg)
                        .padding(.vertical, CivicaSpacing.sm)
                        .background(Capsule().fill(CivicaColors.pinePrimary))
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, CivicaSpacing.md)
    }

    private func errorBanner(_ message: String) -> some View {
        Text(message)
            .font(CivicaTypography.footnoteStrong)
            .foregroundStyle(CivicaColors.destructive)
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                    .fill(CivicaColors.destructive.opacity(0.10))
            )
    }

    private var retryButton: some View {
        Button {
            InterviewCoachAnalytics.track(.retryTapped)
            Task { await viewModel.retry() }
        } label: {
            Label(InterviewCoachStrings.tryAgain.value(in: language),
                  systemImage: "arrow.clockwise")
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(.white)
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.vertical, CivicaSpacing.sm)
                .background(Capsule().fill(CivicaColors.pinePrimary))
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .padding(.top, CivicaSpacing.xs)
    }
}

private struct TurnRowView: View {
    let turn: InterviewTurnDTO

    /// The new orchestrator-shaped DTO doesn't carry an explicit role.
    /// Applicant turns are synthesized client-side with a known
    /// questionId prefix ("applicant-turn-"). Caseworker / system turns
    /// have orchestrator-issued question IDs.
    private var isApplicant: Bool {
        turn.questionId.hasPrefix("applicant-turn-")
    }

    var body: some View {
        HStack {
            if isApplicant { Spacer(minLength: 32) }

            Text(turn.questionText)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .padding(CivicaSpacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                        .fill(isApplicant
                              ? CivicaColors.pinePrimary.opacity(0.12)
                              : CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                        .stroke(CivicaColors.hairline, lineWidth: 1)
                )

            if !isApplicant { Spacer(minLength: 32) }
        }
    }
}
