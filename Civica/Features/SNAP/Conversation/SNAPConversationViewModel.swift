import Foundation

// EXPERIMENTAL SILOED MODULE: backend-driven SNAP conversational screener.
// Sibling to SNAPApplicationViewModel — keeps the static-flow view model
// focused on its existing draft-state responsibilities.
//
// Per the locked persistence decision in plans/i-am-looking-to-fizzy-eagle.md,
// the backend is the source of truth: this view model holds the visible
// transcript and the latest assistant question, but neither is
// authoritative — the server can replay the full conversation from
// snap_conversation_turns at any time.

@MainActor
final class SNAPConversationViewModel: ObservableObject {
    enum SessionPhase: Equatable {
        /// Before `start()` has been called.
        case idle
        /// `start()` is in flight.
        case connecting
        /// Awaiting user input on the latest assistant turn.
        case awaitingInput
        /// User submitted; waiting for the next assistant turn.
        case sending
        /// Interpreter returned confidence < 0.6. Holds the next turn
        /// so the user can confirm before the conversation advances.
        case awaitingConfirmation(pendingTurn: SNAPTurnResult)
        /// Terminal eligibility verdict reached.
        case terminal(SNAPEligibilityResult?)
        /// Network failure (recoverable). Holds the last-known-good prompt
        /// so the user can retry without losing the question.
        case error(String)
    }

    enum TranscriptEntry: Identifiable, Equatable {
        case user(id: UUID, text: String)
        case assistant(turn: SNAPTurnResult, id: UUID)

        var id: UUID {
            switch self {
            case .user(let id, _): return id
            case .assistant(_, let id): return id
            }
        }
    }

    // MARK: - Published state

    @Published private(set) var phase: SessionPhase = .idle
    @Published private(set) var transcript: [TranscriptEntry] = []
    @Published private(set) var currentAssistantTurn: SNAPTurnResult?
    @Published private(set) var sessionId: String?

    /// Visible to SwiftUI input controls — null between turns or when terminal.
    var pendingInputType: SNAPExpectedInputType? {
        guard case .awaitingInput = phase, let turn = currentAssistantTurn else {
            return nil
        }
        return turn.expectedInputType
    }

    var pendingChoiceOptions: [String]? {
        currentAssistantTurn?.choiceOptions
    }

    // MARK: - Dependencies

    private let client: SNAPNetworkClient
    private let language: String
    let stateCode: String

    init(
        client: SNAPNetworkClient,
        stateCode: String,
        language: String = "en"
    ) {
        self.client = client
        self.stateCode = stateCode
        self.language = language
    }

    // MARK: - Lifecycle

    func start() async {
        guard phase == .idle else { return }
        phase = .connecting
        do {
            let response = try await client.startSession(
                state: stateCode,
                language: language
            )
            sessionId = response.sessionId
            appendAssistant(response.openingTurn)
            applyTurnPhase(response.openingTurn)
        } catch {
            SNAPAnalytics.trackConversationError()
            phase = .error(humanizedError(error))
        }
    }

    /// User submitted a response. If the conversation is currently
    /// terminal, the call is a no-op so duplicate taps don't reopen
    /// the session.
    func send(_ userText: String) async {
        let trimmed = userText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard let sessionId else { return }
        if case .terminal = phase { return }

        appendUser(trimmed)
        phase = .sending
        do {
            let result = try await client.sendTurn(sessionId: sessionId, userText: trimmed)
            appendAssistant(result)
            if result.needsUserConfirmation {
                SNAPAnalytics.trackConversationConfirmationRequested()
                phase = .awaitingConfirmation(pendingTurn: result)
            } else {
                applyTurnPhase(result)
            }
        } catch {
            SNAPAnalytics.trackConversationError()
            phase = .error(humanizedError(error))
        }
    }

    /// Recover an existing session via magic-link token. Replaces the
    /// current transcript with whatever the backend has stored.
    func recover(token: String) async {
        phase = .connecting
        do {
            let response = try await client.recoverSession(token: token)
            sessionId = response.sessionId
            transcript = []
            appendAssistant(response.openingTurn)
            applyTurnPhase(response.openingTurn)
        } catch {
            SNAPAnalytics.trackConversationError()
            phase = .error(humanizedError(error))
        }
    }

    /// Confirm the low-confidence interpretation and advance to the next question.
    func confirmTurn() {
        guard case .awaitingConfirmation(let turn) = phase else { return }
        applyTurnPhase(turn)
    }

    /// Discard the low-confidence exchange and let the user re-answer.
    /// Removes the pending next-question from the display transcript so the
    /// conversation stays coherent. The user's correction is sent as a new turn;
    /// the backend's interpreter handles it in context.
    func retypeAnswer() {
        guard case .awaitingConfirmation = phase else { return }
        if let last = transcript.last, case .assistant = last {
            transcript.removeLast()
        }
        currentAssistantTurn = transcript.compactMap {
            if case .assistant(let t, _) = $0 { return t } else { return nil }
        }.last
        phase = .awaitingInput
    }

    func reset() {
        phase = .idle
        transcript = []
        currentAssistantTurn = nil
        sessionId = nil
    }

    // MARK: - Helpers

    private func appendAssistant(_ turn: SNAPTurnResult) {
        currentAssistantTurn = turn
        transcript.append(.assistant(turn: turn, id: UUID()))
    }

    private func appendUser(_ text: String) {
        transcript.append(.user(id: UUID(), text: text))
    }

    private func applyTurnPhase(_ turn: SNAPTurnResult) {
        SNAPAnalytics.trackConversationTurnSent(topic: turn.nextTopic.rawValue)
        if turn.needsClarification {
            SNAPAnalytics.trackConversationClarificationRequested()
        }
        if turn.isTerminal {
            let verdict = turn.eligibilityPreview?.status.rawValue ?? "insufficient_information"
            SNAPAnalytics.trackConversationVerdictReached(verdict: verdict)
            phase = .terminal(turn.eligibilityPreview)
        } else {
            phase = .awaitingInput
        }
    }

    private func humanizedError(_ error: Error) -> String {
        switch error {
        case SNAPNetworkError.invalidURL:
            return "We couldn't reach the server. Please check the app configuration."
        case SNAPNetworkError.unexpectedStatus(let code):
            return "The server returned an unexpected status (\(code)). Please try again."
        case SNAPNetworkError.decodingFailed:
            return "We received an unexpected response from the server."
        default:
            return "Something went wrong. Please try again."
        }
    }
}
