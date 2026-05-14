import Foundation

// Offline stand-in for InterviewCoachAPIClient. Returns scripted
// caseworker turns so PracticeSessionViewModel can run end-to-end
// without a network connection or a live Supabase Edge Function.
// Used when the user taps "Switch to offline mode" in the practice UI.
final class OfflineInterviewCoachClient: InterviewCoachProviding {
    private var turnIndex = 0

    private static let caseworkerScript: [String] = [
        "Hi, thanks for calling. Can you confirm your name and date of birth for me?",
        "Got it. And what's your current address?",
        "Thanks. How many people are living in your household right now, including yourself?",
        "Okay. And does anyone in the household have a job or receive any income — things like wages, self-employment, disability, or child support?",
        "Alright. Do you pay rent or a mortgage? If so, roughly how much per month?",
        "Almost done. Do you have any utility bills — electric, gas, or heating costs — that you pay separately from your rent?",
        "Thanks for that. I've noted everything down. We'll review your application and send you a notice within 30 days. Is there anything else you'd like to ask before we wrap up?",
        "You're all set. Thanks for calling, and good luck with your application.",
    ]

    func postTurn(_ payload: InterviewTurnRequestDTO) async throws -> InterviewTurnResponseDTO {
        // Simulate a brief network delay so the UI doesn't feel instant/broken.
        try await Task.sleep(nanoseconds: 600_000_000)
        let index = turnIndex
        let text = index < Self.caseworkerScript.count
            ? Self.caseworkerScript[index]
            : "I think we've covered everything. Best of luck!"
        let isEnd = index >= Self.caseworkerScript.count - 1
        turnIndex += 1
        return InterviewTurnResponseDTO(
            sessionId: payload.sessionId,
            caseworkerText: text,
            endOfInterview: isEnd
        )
    }

    func postScore(_ payload: InterviewScoreRequestDTO) async throws -> InterviewScoreResponseDTO {
        try await Task.sleep(nanoseconds: 800_000_000)
        return InterviewScoreResponseDTO(
            sessionId: payload.sessionId,
            completeness: InterviewScoreAxisDTO(
                score: 0.78,
                summary: "You answered the main questions about household size and income. Mentioning your address earlier in the call would strengthen completeness."
            ),
            accuracyRisk: InterviewScoreAxisDTO(
                score: 0.15,
                summary: "No high-risk inaccuracies detected in your practice responses."
            ),
            missingContext: InterviewScoreAxisDTO(
                score: 0.30,
                summary: "Consider volunteering information about utility expenses — caseworkers use it to calculate deductions."
            ),
            perTurnNotes: []
        )
    }
}
