import CivicaDesignSystem
import SwiftUI

// SwiftUI sheet for the SNAP intake contextual-help marker, per
// office-hours design 2026-05-29 (GSTACK REVIEW REPORT D6 / T6 /
// "Monday v1 — Demo Ship Plan").
//
// Behavior contract (D6):
//   • On appear → call the intake-help endpoint with (title, locale).
//   • Loading state shows IntakeHelpStrings.loadingText immediately.
//   • After ~1.5s elapsed without a response, swap to stillThinkingText
//     so the user knows we're not stuck.
//   • On success → render the explainer_text in a scrollable VStack
//     using CivicaTypography.body.
//   • On any failure (network / 429 / 500 / timeout / decode) → render
//     IntakeHelpStrings.errorFallback(title:language:), which echoes
//     the question title and nudges the user toward their county
//     navigator. The AI EXPLAINS questions; it never COMMITS to
//     eligibility outcomes. A broken fallback in front of a CBO ED
//     kills the demo (founder's stated #1 fear in the design doc).
//
// Tokens: CivicaColors / CivicaSpacing / CivicaTypography throughout
// per the design system. No raw hex, no raw spacing constants.
//
// This sheet is presented from CivicaQuestionScreen (T5 lane, NOT
// touched in this PR) — that view owns the questionmark.circle
// marker and the .sheet(isPresented:) plumbing.

struct SNAPApplicationContextualHelpSheet: View {

    /// View state machine: loading (with a derived "still thinking"
    /// substate) → success or error. The error fallback is rendered
    /// inline rather than as a separate sheet so the user always sees
    /// useful content; the safe fallback IS the page on failure.
    private enum ViewState: Equatable {
        case loading
        case success(String)
        case error
    }

    let questionTitle: String
    let language: CivicaLanguage

    /// Test seam: swap in a stub client (e.g. one that throws
    /// `.rateLimited` synchronously) without touching the call site.
    /// Defaults to a real client pointed at the enrollment-api host
    /// resolution chain shared with InterviewCoachAPIClient.
    private let client: SNAPApplicationContextualHelpAPIClient

    @Environment(\.dismiss) private var dismiss
    @State private var state: ViewState = .loading
    @State private var stillThinking: Bool = false

    /// Delay before the loading copy swaps from "Looking that up…" to
    /// "Still thinking…". 1.5s per the design doc — long enough that
    /// a fast response never sees the swap, short enough that the
    /// user notices we're actively working before the 3s timeout
    /// trips.
    private static let stillThinkingDelay: TimeInterval = 1.5

    public init(
        questionTitle: String,
        language: CivicaLanguage
    ) {
        self.init(
            questionTitle: questionTitle,
            language: language,
            client: SNAPApplicationContextualHelpAPIClient()
        )
    }

    /// Internal initializer used by tests + previews to inject a
    /// stub client. The public API stays simple (title + language)
    /// so call sites don't need to know about the client surface.
    init(
        questionTitle: String,
        language: CivicaLanguage,
        client: SNAPApplicationContextualHelpAPIClient
    ) {
        self.questionTitle = questionTitle
        self.language = language
        self.client = client
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                    questionHeader

                    contentForCurrentState
                }
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.vertical, CivicaSpacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationTitle(IntakeHelpStrings.sheetTitle.value(in: language))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(IntakeHelpStrings.sheetDoneButton.value(in: language)) {
                        dismiss()
                    }
                    .foregroundStyle(CivicaColors.pinePrimary)
                }
            }
            .task { await loadHelp() }
        }
    }

    // MARK: - Question header
    //
    // The question title is echoed at the top of the sheet so the user
    // never loses the context of what they tapped on. This doubles as
    // the substituted {title} on the error fallback below — same
    // visual treatment in both branches keeps the failure mode honest.

    private var questionHeader: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(questionTitle)
                .font(CivicaTypography.cardHero)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - State router

    @ViewBuilder
    private var contentForCurrentState: some View {
        switch state {
        case .loading:
            loadingView
        case .success(let text):
            successView(text: text)
        case .error:
            errorView
        }
    }

    // MARK: - Loading

    private var loadingView: some View {
        HStack(spacing: CivicaSpacing.md) {
            ProgressView()
                .progressViewStyle(.circular)
                .tint(CivicaColors.pinePrimary)

            Text(
                stillThinking
                    ? IntakeHelpStrings.stillThinkingText.value(in: language)
                    : IntakeHelpStrings.loadingText.value(in: language)
            )
            .font(CivicaTypography.body)
            .foregroundStyle(CivicaColors.graphite)
            .accessibilityIdentifier("intakeHelp.loading.label")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, CivicaSpacing.md)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Success
    //
    // The LLM response is rendered as a single body paragraph. Multi-
    // paragraph responses are split on \n\n so they read with the
    // breathing room CivicaQuestionScreen's "single question, big
    // breathing room" cadence calls for.

    private func successView(text: String) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            ForEach(Array(paragraphs(in: text).enumerated()), id: \.offset) { _, paragraph in
                Text(paragraph)
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .accessibilityIdentifier("intakeHelp.success.body")
    }

    // MARK: - Error fallback (load-bearing per D6)
    //
    // Renders the IntakeHelpStrings.errorFallback string with the
    // question title substituted. The user always sees something
    // useful: the title they tapped on, plus the navigator nudge.
    // No "something went wrong" framing, no apology — just the
    // honest punt to the human escalation path.

    private var errorView: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(IntakeHelpStrings.errorFallback(title: questionTitle, language: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("intakeHelp.errorFallback.body")
        }
    }

    // MARK: - Side effects

    private func loadHelp() async {
        // Kick off the "still thinking" swap on a parallel task so the
        // sheet shows the secondary copy if the response is slow but
        // not yet timed out. Skipped (no-op'd) when the response
        // beats the timer.
        let stillThinkingTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(Self.stillThinkingDelay * 1_000_000_000))
            if case .loading = state { stillThinking = true }
        }

        do {
            let response = try await client.fetchHelp(
                questionTitle: questionTitle,
                language: language
            )
            stillThinkingTask.cancel()
            let trimmed = response.explainerText.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                state = .error
            } else {
                state = .success(trimmed)
            }
        } catch {
            stillThinkingTask.cancel()
            state = .error
        }
    }

    private func paragraphs(in text: String) -> [String] {
        text
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }
}

#if DEBUG
#Preview("Loading") {
    SNAPApplicationContextualHelpSheet(
        questionTitle: "How many people live in your household?",
        language: .english
    )
}
#endif
