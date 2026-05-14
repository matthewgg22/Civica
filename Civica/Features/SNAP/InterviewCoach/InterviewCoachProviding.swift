import Foundation

// Protocol abstracting the Interview Coach backend.
// Conformers: InterviewCoachAPIClient (live) and OfflineInterviewCoachClient (bundled).
// PracticeSessionViewModel holds `any InterviewCoachProviding` so it can swap
// to offline when the live backend is unavailable.

protocol InterviewCoachProviding: AnyObject {
    func postTurn(_ payload: InterviewTurnRequestDTO) async throws -> InterviewTurnResponseDTO
    func postScore(_ payload: InterviewScoreRequestDTO) async throws -> InterviewScoreResponseDTO
}

extension InterviewCoachAPIClient: InterviewCoachProviding {}

// Offline fallback that drives a practice session entirely from the bundled
// InterviewQuestions_MA.json question bank. No network calls; no AI scoring.
// Activated automatically by PracticeSessionViewModel when the live backend
// returns 404 and the user chooses "Practice offline instead."
final class OfflineInterviewCoachClient: InterviewCoachProviding {

    private let questions: [InterviewQuestion]

    init() {
        guard
            let url = Bundle.main.url(forResource: "InterviewQuestions_MA", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let loaded = try? JSONDecoder().decode([InterviewQuestion].self, from: data)
        else {
            questions = []
            return
        }
        // Use initial-scenario questions that apply to all archetypes.
        questions = loaded.filter { $0.scenario == .initial && $0.archetypeTags.isEmpty }
    }

    func postTurn(_ payload: InterviewTurnRequestDTO) async throws -> InterviewTurnResponseDTO {
        let applicantCount = payload.transcript.filter { $0.role == "applicant" }.count

        if applicantCount == 0 {
            return InterviewTurnResponseDTO(
                sessionId: payload.sessionId,
                caseworkerText: "Hi, I'm with Massachusetts DTA. This is your SNAP interview. I'll ask a few questions — please answer as completely as you can.",
                endOfInterview: false
            )
        }

        let qIndex = applicantCount - 1
        if qIndex < questions.count {
            return InterviewTurnResponseDTO(
                sessionId: payload.sessionId,
                caseworkerText: questions[qIndex].prompt,
                endOfInterview: false
            )
        }

        return InterviewTurnResponseDTO(
            sessionId: payload.sessionId,
            caseworkerText: "Thank you — that covers everything I need. You'll receive a written decision within 30 days.",
            endOfInterview: true
        )
    }

    func postScore(_ payload: InterviewScoreRequestDTO) async throws -> InterviewScoreResponseDTO {
        let applicantTurns = payload.transcript.filter { $0.role == "applicant" }.count
        let expected = max(1, questions.count)
        let completeness = min(1.0, Double(applicantTurns) / Double(expected))

        return InterviewScoreResponseDTO(
            sessionId: payload.sessionId,
            completeness: InterviewScoreAxisDTO(
                score: completeness,
                summary: "You answered \(applicantTurns) of \(expected) questions in offline practice. Offline scores are indicative only."
            ),
            accuracyRisk: InterviewScoreAxisDTO(
                score: 0.25,
                summary: "Offline mode can't assess accuracy. Review your answers against the guidance in the question browser."
            ),
            missingContext: InterviewScoreAxisDTO(
                score: 0.30,
                summary: "Offline mode can't detect missing context. Consider whether you referenced specific numbers and documents."
            ),
            perTurnNotes: []
        )
    }
}
