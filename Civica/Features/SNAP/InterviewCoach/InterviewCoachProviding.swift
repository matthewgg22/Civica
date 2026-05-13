import Foundation

// EXPERIMENTAL SILOED MODULE: protocol surface that PracticeSessionViewModel
// uses to drive practice sessions. Exists so the view model can swap to an
// offline stub (OfflineInterviewCoachClient) when the Supabase Edge Function
// backend is unreachable, without leaking HTTP/URL details into the view layer.
//
// Mirrors the two public methods on InterviewCoachAPIClient. Any new endpoint
// the coach exposes should land here AND on both conformers in the same
// commit so the offline path doesn't silently drop scenarios.
protocol InterviewCoachProviding: Sendable {
    func postTurn(_ payload: InterviewTurnRequestDTO) async throws -> InterviewTurnResponseDTO
    func postScore(_ payload: InterviewScoreRequestDTO) async throws -> InterviewScoreResponseDTO
}

extension InterviewCoachAPIClient: InterviewCoachProviding {}

// Offline fallback used by PracticeSessionViewModel when the live backend
// is unreachable or returns 404. Returns canned content that's good enough
// for the user to keep practicing without leaving the screen — the goal is
// to keep the session interactive, not to mimic the LLM caseworker exactly.
//
// English-only for now; Spanish parity lands when the live coach itself
// ships Spanish. The transcript-aware turn count keeps the offline session
// from looping forever — after ~6 caseworker turns the offline path flags
// `endOfInterview` so PracticeSessionViewModel transitions to .complete.
final class OfflineInterviewCoachClient: InterviewCoachProviding, Sendable {

    private static let maxTurnsBeforeWrapUp = 6

    func postTurn(_ payload: InterviewTurnRequestDTO) async throws -> InterviewTurnResponseDTO {
        let caseworkerTurnCount = payload.transcript.filter { $0.role == "caseworker" }.count
        let endOfInterview = caseworkerTurnCount + 1 >= Self.maxTurnsBeforeWrapUp
        let prompt = offlinePrompt(forCaseworkerTurnIndex: caseworkerTurnCount, endOfInterview: endOfInterview)
        return InterviewTurnResponseDTO(
            sessionId: payload.sessionId,
            caseworkerText: prompt,
            endOfInterview: endOfInterview
        )
    }

    func postScore(_ payload: InterviewScoreRequestDTO) async throws -> InterviewScoreResponseDTO {
        let neutralAxis = InterviewScoreAxisDTO(
            score: 0,
            summary: "Practice mode is offline — connect to the internet to get a real score."
        )
        return InterviewScoreResponseDTO(
            sessionId: payload.sessionId,
            completeness: neutralAxis,
            accuracyRisk: neutralAxis,
            missingContext: neutralAxis,
            perTurnNotes: []
        )
    }

    private func offlinePrompt(forCaseworkerTurnIndex index: Int, endOfInterview: Bool) -> String {
        if endOfInterview {
            return "Thanks — that gives me what I need. We'll be in touch about next steps."
        }
        switch index {
        case 0: return "Hi, thanks for coming in today. Can you tell me a bit about your household — who lives with you?"
        case 1: return "Got it. And what does your income look like right now? Any jobs, gig work, side income?"
        case 2: return "Thanks. How about housing — do you rent, own, or stay with someone else? Roughly what does that cost you each month?"
        case 3: return "Okay. Any other expenses I should know about — utilities, child care, medical bills?"
        case 4: return "One more thing — has anyone in the household lost a job in the last 30 days, or had hours cut?"
        default: return "Anything else you'd like me to know before we wrap up?"
        }
    }
}
