import Foundation

// Protocol abstracting the Interview Coach backend.
// Conformers: InterviewCoachAPIClient (live, enrollment-api) and
// OfflineInterviewCoachClient (bundled question bank, no network).
// PracticeSessionViewModel holds `any InterviewCoachProviding` so it can swap
// to offline when the live backend is unavailable.

protocol InterviewCoachProviding: AnyObject {
    func startPracticeSession(
        recertId: String,
        snapshot: PacketSnapshotDTO?
    ) async throws -> StartPracticeResponseDTO

    func sendPracticeResponse(
        recertId: String,
        sessionId: String,
        response: String,
        audioBytesDuration: Int?
    ) async throws -> PracticeRespondResponseDTO

    func fetchPracticeSession(
        recertId: String,
        sessionId: String
    ) async throws -> PracticeSessionStateDTO

    func fetchScore(
        recertId: String,
        sessionId: String
    ) async throws -> InterviewScoreResponseDTO
}

extension InterviewCoachAPIClient: InterviewCoachProviding {}

// Offline fallback that drives a practice session entirely from the bundled
// InterviewQuestions_MA.json question bank. No network calls; no AI coaching.
// Used by previews and by PracticeSessionViewModel when the live backend is
// unreachable or the user is not signed in.
final class OfflineInterviewCoachClient: InterviewCoachProviding {

    private struct OfflineSession {
        var index: Int
        var questions: [InterviewQuestion]
    }

    private let questions: [InterviewQuestion]
    private var sessions: [String: OfflineSession] = [:]

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

    func startPracticeSession(
        recertId: String,
        snapshot: PacketSnapshotDTO?
    ) async throws -> StartPracticeResponseDTO {
        let sessionId = UUID().uuidString
        sessions[sessionId] = OfflineSession(index: 0, questions: questions)
        let first = questions.first
        let turn = InterviewTurnDTO(
            questionId: first?.id ?? "offline-greeting",
            questionText: first?.prompt
                ?? "Hi, this is your practice SNAP interview. I'll ask a few questions — answer as completely as you can.",
            response: nil
        )
        return StartPracticeResponseDTO(sessionId: sessionId, firstQuestion: turn)
    }

    func sendPracticeResponse(
        recertId: String,
        sessionId: String,
        response: String,
        audioBytesDuration: Int?
    ) async throws -> PracticeRespondResponseDTO {
        guard var session = sessions[sessionId] else {
            throw InterviewCoachAPIClient.CoachAPIError.sessionLost
        }
        session.index += 1
        let done = session.index >= session.questions.count
        sessions[sessionId] = session

        let turn: InterviewTurnDTO
        if done {
            turn = InterviewTurnDTO(
                questionId: session.questions.last?.id ?? "offline-end",
                questionText: "Thank you — that covers everything. You'll receive a written decision within 30 days.",
                response: response
            )
        } else {
            let q = session.questions[session.index]
            turn = InterviewTurnDTO(questionId: q.id, questionText: q.prompt, response: nil)
        }
        return PracticeRespondResponseDTO(turn: turn, flags: [], done: done, coaching: nil)
    }

    func fetchPracticeSession(
        recertId: String,
        sessionId: String
    ) async throws -> PracticeSessionStateDTO {
        guard let session = sessions[sessionId] else {
            throw InterviewCoachAPIClient.CoachAPIError.notFound
        }
        return PracticeSessionStateDTO(
            sessionId: sessionId,
            recertId: recertId,
            stateCode: "MA",
            turnCount: session.index,
            flags: [],
            done: session.index >= session.questions.count,
            startedAt: nil,
            completedAt: nil
        )
    }

    // Offline mode synthesizes a neutral encouragement score so the
    // UI flow still surfaces a summary sheet even without network.
    func fetchScore(
        recertId: String,
        sessionId: String
    ) async throws -> InterviewScoreResponseDTO {
        return InterviewScoreResponseDTO(
            sessionId: sessionId,
            overallScore: 70,
            strengths: [
                "You walked through the whole practice interview.",
                "You gave concrete answers in your own words.",
            ],
            improvements: [
                "Try the live practice mode for personalized feedback.",
                "Practice once more with the trickier questions.",
            ],
            summaryEn: "Solid practice run. Try again online when you can — we'll give you tailored feedback.",
            summaryEs: "Buena práctica. Inténtalo en línea cuando puedas — te daremos comentarios personalizados.",
            generatedAt: ISO8601DateFormatter().string(from: Date()),
            engineVersion: "offline-stub-v1"
        )
    }
}
