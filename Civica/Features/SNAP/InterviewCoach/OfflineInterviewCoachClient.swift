import Foundation

// EXPERIMENTAL SILOED MODULE: offline fallback for the Interview Coach.
//
// PracticeSessionViewModel swaps to this client when the live backend
// is unreachable (the Edge Functions are not yet deployed to the Civica
// Supabase project). It serves a short scripted caseworker interview
// and a canned score so the Coach UI is fully walkable in SNAP_DEV
// builds without a network. Nothing here touches the network or disk.
struct OfflineInterviewCoachClient: InterviewCoachProviding {
    // Scripted caseworker prompts, served in order. The applicant turns
    // in between come from the user. The final prompt closes the
    // interview (endOfInterview = true on the response that serves it).
    private static let script: [String] = [
        "Hi, thanks for taking my call. I'm a caseworker reviewing your SNAP application. To start — can you tell me who lives in your household and who you buy and prepare food with?",
        "Got it. And can you walk me through your household's income right now — any jobs, gig work, or other money coming in?",
        "Thank you. Do you have any expenses I should know about — rent or mortgage, utilities, child care, or medical costs?",
        "That's helpful. Last question: has anything changed recently — a job ending, someone moving in or out, a change in hours?",
        "Okay, I have what I need for now. We'll review everything and send you a notice in the mail. Thanks for your time today — that's the end of our interview.",
    ]

    func postTurn(_ payload: InterviewTurnRequestDTO) async throws -> InterviewTurnResponseDTO {
        // One scripted caseworker line per caseworker turn already in the
        // transcript. Index 0 is the opener (empty transcript).
        let caseworkerTurnsSoFar = payload.transcript.filter { $0.role == "caseworker" }.count
        let index = min(caseworkerTurnsSoFar, Self.script.count - 1)
        let isLast = index == Self.script.count - 1
        return InterviewTurnResponseDTO(
            sessionId: payload.sessionId,
            caseworkerText: Self.script[index],
            endOfInterview: isLast
        )
    }

    func postScore(_ payload: InterviewScoreRequestDTO) async throws -> InterviewScoreResponseDTO {
        InterviewScoreResponseDTO(
            sessionId: payload.sessionId,
            completeness: InterviewScoreAxisDTO(
                score: 0.8,
                summary: "You answered each question directly and covered the main topics a caseworker asks about."
            ),
            accuracyRisk: InterviewScoreAxisDTO(
                score: 0.85,
                summary: "Nothing in your answers looks likely to conflict with your application. Keep answers consistent with what you wrote."
            ),
            missingContext: InterviewScoreAxisDTO(
                score: 0.7,
                summary: "Consider adding specifics next time — exact hours, dollar amounts, and dates help a caseworker move faster."
            ),
            perTurnNotes: []
        )
    }
}
