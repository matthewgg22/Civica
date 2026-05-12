import Foundation
import SwiftUI

// EXPERIMENTAL SILOED MODULE: practice session orchestrator.
// Owns the transcript + status state, drives turn requests via
// InterviewCoachAPIClient, and exposes scoring as a separate async step.
// All Coach state is session-only; nothing is persisted to disk or
// transmitted to the server beyond the transcript itself when requested.
@MainActor
final class PracticeSessionViewModel: ObservableObject {
    enum SessionStatus: Equatable {
        case idle
        case awaitingCaseworker
        case awaitingUser
        case scoring
        case complete
        case failed(String)
    }

    struct SessionContext {
        let stateCode: String
        let stateName: String
        let scenario: InterviewScenario
        let archetype: ApplicantArchetype
        let persona: CaseworkerArchetype

        static let defaultMA = SessionContext(
            stateCode: "MA",
            stateName: "Massachusetts",
            scenario: .initial,
            archetype: .gigWorker,
            persona: .friendlyRushed
        )
    }

    // Tracks what call last hit the network so retry() knows which one to
    // re-issue when the user taps "Try again" after a .failed status.
    private enum LastAttempt {
        case turn
        case score
    }

    @Published private(set) var transcript: [InterviewTurnDTO] = []
    @Published private(set) var status: SessionStatus = .idle
    @Published private(set) var score: InterviewScoreResponseDTO?
    @Published var draftResponse: String = ""

    let sessionID: String
    let context: SessionContext
    private let client: InterviewCoachAPIClient
    private var lastAttempt: LastAttempt = .turn

    init(context: SessionContext = .defaultMA,
         client: InterviewCoachAPIClient = InterviewCoachAPIClient()) {
        self.sessionID = UUID().uuidString
        self.context = context
        self.client = client
    }

    func startIfNeeded() async {
        guard status == .idle else { return }
        await requestCaseworkerTurn()
    }

    func submitUserResponse() async {
        let text = draftResponse.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        guard status == .awaitingUser else { return }

        transcript.append(InterviewTurnDTO(role: "applicant", text: text))
        draftResponse = ""

        await requestCaseworkerTurn()
    }

    func retry() async {
        guard case .failed = status else { return }
        switch lastAttempt {
        case .turn:  await requestCaseworkerTurn()
        case .score: await requestScore()
        }
    }

    func requestScore() async {
        guard score == nil else { return }
        guard !transcript.isEmpty else { return }

        let previous = status
        lastAttempt = .score
        status = .scoring
        let payload = InterviewScoreRequestDTO(
            sessionId: sessionID,
            stateCode: context.stateCode,
            stateName: context.stateName,
            scenario: context.scenario.rawValue,
            scenarioLabel: context.scenario.label,
            applicantArchetype: context.archetype.rawValue,
            applicantArchetypeLabel: context.archetype.label,
            caseworkerPersona: context.persona.rawValue,
            transcript: transcript
        )

        do {
            let response = try await client.postScore(payload)
            score = response
            status = .complete
        } catch {
            status = .failed("Scoring failed: \(error.localizedDescription)")
            if case .failed = previous { /* keep the new failure */ } else {
                // Leave .failed so the UI can surface a retry affordance.
            }
        }
    }

    private func requestCaseworkerTurn() async {
        lastAttempt = .turn
        status = .awaitingCaseworker
        let payload = InterviewTurnRequestDTO(
            sessionId: sessionID,
            stateCode: context.stateCode,
            stateName: context.stateName,
            scenario: context.scenario.rawValue,
            scenarioLabel: context.scenario.label,
            applicantArchetype: context.archetype.rawValue,
            applicantArchetypeLabel: context.archetype.label,
            caseworkerPersona: context.persona.rawValue,
            transcript: transcript
        )

        do {
            let response = try await client.postTurn(payload)
            transcript.append(InterviewTurnDTO(role: "caseworker", text: response.caseworkerText))
            if response.endOfInterview {
                status = .complete
            } else {
                status = .awaitingUser
            }
        } catch {
            status = .failed("Caseworker turn failed: \(error.localizedDescription)")
        }
    }
}
