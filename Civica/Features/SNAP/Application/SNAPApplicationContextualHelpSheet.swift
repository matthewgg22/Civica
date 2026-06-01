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

    /// One row in the chat thread. Mae's responses, the applicant's
    /// follow-ups, and inline error bubbles share the same shape so
    /// the conversation can grow as a single ordered list.
    private struct ChatMessage: Identifiable, Equatable {
        enum Role: Equatable {
            case mae
            case user
            /// Inline error bubble — rendered with the error fallback
            /// copy + diagnostic detail, distinguishable from a
            /// regular Mae reply visually.
            case error(diagnosticDetail: String)
        }
        let id = UUID()
        let role: Role
        let content: String
    }

    let questionTitle: String
    /// The on-screen helper paragraph the applicant is already reading
    /// (the question screen's `helper` prop). Forwarded to the endpoint
    /// as the optional `question_helper` field so the explainer can
    /// ground its answer in what the user already sees. Nil when the
    /// question ships without a helper — the request omits the key and
    /// behavior is identical to before.
    let questionHelper: String?
    let language: CivicaLanguage

    /// Test seam: swap in a stub client (e.g. one that throws
    /// `.rateLimited` synchronously) without touching the call site.
    /// Defaults to a real client pointed at the enrollment-api host
    /// resolution chain shared with InterviewCoachAPIClient.
    private let client: SNAPApplicationContextualHelpAPIClient

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var messages: [ChatMessage] = []
    @State private var inputText: String = ""
    @State private var isAwaitingReply: Bool = false
    @State private var stillThinking: Bool = false
    @State private var hasLoadedInitialReply: Bool = false
    /// Drives the typewriter reveal of the most recent Mae bubble.
    /// `revealingMessageID` is the message currently animating in;
    /// `revealedChars` is how many characters of it are shown. nil ID
    /// = nothing animating (all bubbles render in full).
    @State private var revealingMessageID: UUID?
    @State private var revealedChars: Int = 0
    @FocusState private var inputFocused: Bool

    /// Delay before the "still thinking…" indicator joins the spinner
    /// bubble. Long enough that a sub-1.5s reply never shows it.
    private static let stillThinkingDelay: TimeInterval = 1.5

    public init(
        questionTitle: String,
        questionHelper: String? = nil,
        language: CivicaLanguage
    ) {
        self.init(
            questionTitle: questionTitle,
            questionHelper: questionHelper,
            language: language,
            client: SNAPApplicationContextualHelpAPIClient()
        )
    }

    /// Internal initializer used by tests + previews to inject a
    /// stub client. The public API stays simple (title + helper +
    /// language) so call sites don't need to know about the client
    /// surface.
    init(
        questionTitle: String,
        questionHelper: String? = nil,
        language: CivicaLanguage,
        client: SNAPApplicationContextualHelpAPIClient
    ) {
        self.questionTitle = questionTitle
        self.questionHelper = questionHelper
        self.language = language
        self.client = client
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                            questionHeader
                            chatIntroLabel
                            ForEach(messages) { message in
                                bubble(for: message)
                                    .id(message.id)
                            }
                            if isAwaitingReply {
                                pendingReplyBubble
                                    .id("pending")
                            }
                        }
                        .padding(.horizontal, CivicaSpacing.lg)
                        .padding(.vertical, CivicaSpacing.xl)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .background(CivicaColors.paper)
                    .onChange(of: messages.count) { _, _ in
                        // Scroll the latest message into view on
                        // every append. Dispatch async to the next
                        // runloop tick — calling withAnimation
                        // synchronously inside .onChange during a
                        // sheet's first-load body pass has been
                        // observed to trip a NavigationStack
                        // re-layout that auto-dismisses the sheet on
                        // iOS 17+. Async + no withAnimation avoids
                        // both that hazard and the visible jump.
                        let lastId = messages.last?.id
                        guard let lastId else { return }
                        DispatchQueue.main.async {
                            proxy.scrollTo(lastId, anchor: .bottom)
                        }
                    }
                    .onChange(of: isAwaitingReply) { _, awaiting in
                        guard awaiting else { return }
                        DispatchQueue.main.async {
                            proxy.scrollTo("pending", anchor: .bottom)
                        }
                    }
                }
                Divider().background(CivicaColors.hairline)
                aiDisclaimer
                inputBar
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
            // Prevent the sheet from being swipe-dismissed while the
            // first Mae reply is still in flight. A reviewer who
            // accidentally drags the sheet during the 3-5s LLM wait
            // would otherwise lose context with nothing useful
            // rendered yet.
            .interactiveDismissDisabled(isAwaitingReply && messages.isEmpty)
            .onAppear {
                // Use `.onAppear` + manually-dispatched Task instead
                // of `.task` — the latter has shown lifecycle quirks
                // when its body mutates state during a sheet's first
                // present pass, intermittently triggering the sheet
                // to dismiss itself. `.onAppear` runs exactly once
                // per view appearance, and the `hasLoadedInitialReply`
                // guard prevents a second fetch on re-appear (e.g.
                // app returns from background).
                guard !hasLoadedInitialReply else { return }
                hasLoadedInitialReply = true
                Task { await sendInitialExplainer() }
            }
        }
    }

    // MARK: - Chat bubbles

    private var chatIntroLabel: some View {
        Text(IntakeHelpStrings.chatIntroLabel.value(in: language))
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.graphite)
            .textCase(.uppercase)
            .kerning(1.0)
    }

    @ViewBuilder
    private func bubble(for message: ChatMessage) -> some View {
        switch message.role {
        case .mae:
            maeBubble(message: message)
        case .user:
            userBubble(text: message.content)
        case .error(let detail):
            errorBubble(diagnosticDetail: detail)
        }
    }

    /// Left-aligned cream bubble. Renders the message body, splitting
    /// on double-newlines to give multi-paragraph replies breathing
    /// room and detecting bullet lines so a list-shaped answer reads
    /// as a real list. When this is the message currently revealing,
    /// only the first `revealedChars` characters show (+ a caret), so
    /// the reply types in conversationally instead of dumping in all
    /// at once.
    private func maeBubble(message: ChatMessage) -> some View {
        let isRevealing = message.id == revealingMessageID
        let shownBody = isRevealing
            ? String(message.content.prefix(revealedChars))
            : message.content
        let caret = isRevealing ? " ▍" : ""
        return VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            ForEach(Array(paragraphs(in: shownBody + caret).enumerated()), id: \.offset) { _, paragraph in
                paragraphView(paragraph)
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    /// Type the message in character-by-character (chunked so total
    /// reveal time stays ~1s regardless of length). Skipped entirely
    /// when Reduce Motion is on — that user sees the full text at once.
    private func startReveal(messageID: UUID, fullText: String) {
        guard !reduceMotion else { return }
        revealingMessageID = messageID
        revealedChars = 0
        let total = fullText.count
        let step = max(1, total / 50)   // ~50 ticks → ~1s at 20ms/tick
        Task { @MainActor in
            while revealedChars < total, revealingMessageID == messageID {
                try? await Task.sleep(nanoseconds: 20_000_000)
                revealedChars = min(total, revealedChars + step)
            }
            if revealingMessageID == messageID { revealingMessageID = nil }
        }
    }

    /// Right-aligned pine-tint bubble. iMessage convention without
    /// the loud solid-pine fill — keeps the visual hierarchy quiet so
    /// Mae's reply stays the focal point.
    private func userBubble(text: String) -> some View {
        HStack(spacing: 0) {
            Spacer(minLength: CivicaSpacing.xl)
            Text(text)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, CivicaSpacing.md)
                .padding(.vertical, CivicaSpacing.sm)
                .background(CivicaColors.pinePrimary.opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        }
    }

    /// Error bubble — same visual shape as a Mae bubble but with the
    /// fallback copy and an optional diagnostic line beneath. Lets
    /// the conversation continue (the user can still ask a new
    /// question) instead of dead-ending the sheet on the first
    /// transient failure.
    private func errorBubble(diagnosticDetail: String) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(IntakeHelpStrings.errorFallback(title: questionTitle, language: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            if !diagnosticDetail.isEmpty {
                Text("Debug: \(diagnosticDetail)")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private var pendingReplyBubble: some View {
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
            Spacer(minLength: 0)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    /// Render one paragraph. If the paragraph is a bullet block
    /// (each line starts with `-` or `•`), render as a proper
    /// VStack of bullet rows with hanging indent. Otherwise render
    /// as a single Text.
    @ViewBuilder
    private func paragraphView(_ text: String) -> some View {
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        let trimmedLines = lines.map { $0.trimmingCharacters(in: .whitespaces) }
        let allBullets = trimmedLines.allSatisfy { isBulletLine($0) }
        if trimmedLines.count > 1, allBullets {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                ForEach(Array(trimmedLines.enumerated()), id: \.offset) { _, line in
                    HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                        Text("•")
                            .font(CivicaTypography.body)
                            .foregroundStyle(CivicaColors.pinePrimary)
                            .accessibilityHidden(true)
                        Text(stripBullet(line))
                            .font(CivicaTypography.body)
                            .foregroundStyle(CivicaColors.ink)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        } else {
            Text(text)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func isBulletLine(_ line: String) -> Bool {
        line.hasPrefix("- ") || line.hasPrefix("• ") || line == "-" || line == "•"
    }

    private func stripBullet(_ line: String) -> String {
        if line.hasPrefix("- ") { return String(line.dropFirst(2)) }
        if line.hasPrefix("• ") { return String(line.dropFirst(2)) }
        return line
    }

    // MARK: - Input bar

    /// Small AI-transparency line above the input. Tells the applicant
    /// Mae is an AI assistant and to verify anything important with a
    /// human — sits right where they're about to ask a follow-up.
    private var aiDisclaimer: some View {
        HStack(spacing: CivicaSpacing.xs) {
            Image(systemName: "sparkles")
                .imageScale(.small)
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
            Text(IntakeHelpStrings.aiDisclaimer.value(in: language))
                .font(CivicaTypography.caption)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, CivicaSpacing.lg)
        .padding(.top, CivicaSpacing.sm)
        .padding(.bottom, CivicaSpacing.xs)
        .accessibilityElement(children: .combine)
    }

    private var inputBar: some View {
        HStack(spacing: CivicaSpacing.sm) {
            TextField(
                IntakeHelpStrings.chatInputPlaceholder.value(in: language),
                text: $inputText,
                axis: .vertical
            )
            .font(CivicaTypography.body)
            .lineLimit(1...4)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.sm)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
            .focused($inputFocused)
            .submitLabel(.send)
            .onSubmit { sendFollowUp() }
            Button(action: sendFollowUp) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 32, weight: .regular))
                    .foregroundStyle(canSend ? CivicaColors.pinePrimary : CivicaColors.graphite.opacity(0.4))
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .accessibilityLabel(IntakeHelpStrings.chatSendButtonLabel.value(in: language))
        }
        .padding(.horizontal, CivicaSpacing.lg)
        .padding(.vertical, CivicaSpacing.md)
        .background(CivicaColors.paper)
    }

    private var canSend: Bool {
        !isAwaitingReply
            && !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func sendFollowUp() {
        guard canSend else { return }
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        inputText = ""
        messages.append(ChatMessage(role: .user, content: trimmed))
        Task { await fetchReply() }
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

    // MARK: - Side effects

    /// Initial Mae call on sheet appear — no user message yet, no
    /// history. Behaves exactly like the original one-shot endpoint
    /// for the first turn so the response shape and caching path are
    /// unchanged.
    private func sendInitialExplainer() async {
        await fetchReply()
    }

    /// Shared fetch path. Sends every accumulated user/Mae turn back
    /// to the worker so Claude has the full conversation context.
    /// On success appends a Mae bubble; on failure appends an error
    /// bubble that the conversation can still grow past.
    private func fetchReply() async {
        isAwaitingReply = true
        stillThinking = false
        let stillThinkingTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(Self.stillThinkingDelay * 1_000_000_000))
            if isAwaitingReply { stillThinking = true }
        }
        defer {
            stillThinkingTask.cancel()
            isAwaitingReply = false
            stillThinking = false
        }
        do {
            let response = try await client.fetchHelp(
                questionTitle: questionTitle,
                questionHelper: questionHelper,
                language: language,
                history: historyWire()
            )
            if response.wasFiltered {
                SNAPAnalytics.trackIntakeHelpFiltered(questionTitle: questionTitle)
            }
            let trimmed = response.explainerText.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                SNAPAnalytics.trackIntakeHelpError(questionTitle: questionTitle)
                messages.append(ChatMessage(
                    role: .error(diagnosticDetail: "empty response body"),
                    content: ""
                ))
            } else {
                let msg = ChatMessage(role: .mae, content: trimmed)
                messages.append(msg)
                startReveal(messageID: msg.id, fullText: trimmed)
            }
        } catch let error as SNAPApplicationContextualHelpAPIClient.IntakeHelpError {
            SNAPAnalytics.trackIntakeHelpError(questionTitle: questionTitle)
            messages.append(ChatMessage(
                role: .error(diagnosticDetail: error.diagnosticSummary),
                content: ""
            ))
        } catch {
            SNAPAnalytics.trackIntakeHelpError(questionTitle: questionTitle)
            messages.append(ChatMessage(
                role: .error(diagnosticDetail: error.localizedDescription),
                content: ""
            ))
        }
    }

    /// Map the in-memory chat thread into the wire format the worker
    /// expects: `[{role: "user"|"assistant", content: ...}]`. Error
    /// bubbles are skipped — they aren't part of the LLM conversation,
    /// they're just inline feedback.
    private func historyWire() -> [SNAPApplicationContextualHelpAPIClient.ChatMessageWire] {
        messages.compactMap { msg in
            switch msg.role {
            case .mae:
                return .init(role: "assistant", content: msg.content)
            case .user:
                return .init(role: "user", content: msg.content)
            case .error:
                return nil
            }
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
