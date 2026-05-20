import Foundation

// Wire-format types for the Interview Coach (a.k.a. practice session)
// backend. The active backend is the enrollment-api (Cloudflare Workers)
// `recert/practice/*` routes — see apps/enrollment-api/src/routes/recert.ts
// and packages/recert-engine/src/interview/orchestrator.ts.
//
// JSON on the wire is snake_case; the client uses
// .convertToSnakeCase / .convertFromSnakeCase so these structs use
// idiomatic Swift naming without explicit CodingKeys.

// MARK: - Orchestrator-mirrored types

/// Mirrors `InterviewTurn` from packages/recert-engine/src/interview/orchestrator.ts.
struct InterviewTurnDTO: Codable, Hashable {
    let questionId: String
    let questionText: String
    /// Present on `respond` results when the orchestrator echoes the last
    /// applicant answer back on the final (done=true) turn. Optional in
    /// the question→turn position because the very first turn has none.
    let response: String?
}

/// Mirrors `Flag` from the orchestrator. Emitted when a user_message
/// matches one of the current question's `flagTriggers`.
struct InterviewFlagDTO: Codable, Hashable {
    let type: String
    let description: String
}

/// Mirrors `PacketSnapshot` from packages/recert-engine/src/interview/personalizer.ts
/// (re-exported by orchestrator.ts). The start route builds this server-side
/// from packet_answers, so the client doesn't strictly need to send one —
/// but the type is kept here so future callers can pass a richer snapshot.
struct PacketSnapshotDTO: Codable, Hashable {
    let stateCode: String  // "CA" | "MA"
    let isEmployed: Bool
    let incomeSourceCount: Int
    let hasDependentUnder6: Bool
    let hasDependentUnder14: Bool
    let hasStudents: Bool
    let hasVehicles: Bool
    let hasBankAccounts: Bool
    let isSubjectToWorkRequirements: Bool
}

// MARK: - Request bodies

/// POST /v1/enrollment/recert/:recertId/practice/start
/// Per recert.ts the start route currently takes no JSON body — it derives
/// the snapshot server-side from packet_answers. This empty struct exists
/// so the HTTP helper signature stays uniform across the three calls.
struct StartPracticeRequestDTO: Codable {}

/// POST /v1/enrollment/recert/:recertId/practice/:sessionId/respond
/// Per respondSchema in recert.ts: `{ user_message: string, audio_bytes_duration?: int }`.
/// `audioBytesDuration` is only sent when the response was captured via
/// SNAPVoiceIntakeService on-device — it's a soft "stuck vs confident"
/// signal that the orchestrator threads into the AI coach prompt.
struct PracticeRespondRequestDTO: Codable {
    let userMessage: String
    let audioBytesDuration: Int?

    enum CodingKeys: String, CodingKey {
        case userMessage = "user_message"
        case audioBytesDuration = "audio_bytes_duration"
    }
}

// MARK: - Response bodies

/// 201 response from POST .../practice/start.
struct StartPracticeResponseDTO: Codable {
    let sessionId: String
    let firstQuestion: InterviewTurnDTO
}

/// 200 response from POST .../practice/:sessionId/respond.
struct PracticeRespondResponseDTO: Codable {
    let turn: InterviewTurnDTO
    let flags: [InterviewFlagDTO]
    let done: Bool
    /// Per-turn coaching tip from Claude Haiku. Null when the backend has
    /// AI disabled (RECERT_AI_ENABLED != "true") or when the session is
    /// done. The orchestrator marks `coaching` as null on the final turn.
    let coaching: String?
}

/// 200 response from GET .../practice/:sessionId — session state for resume.
/// Matches the `select(...)` in the GET route; flags is the cumulative
/// list across all responses so far.
struct PracticeSessionStateDTO: Codable {
    let sessionId: String
    let recertId: String
    let stateCode: String
    let turnCount: Int
    let flags: [InterviewFlagDTO]
    let done: Bool
    let startedAt: String?
    let completedAt: String?
}

// MARK: - End-of-session scoring
//
// 200/201 response from POST .../practice/:sessionId/score.
// Mirrors `ScoreResult` from packages/recert-engine/src/interview/scorer.ts
// plus the route-side `session_id` and `generated_at` envelope fields.
struct InterviewScoreResponseDTO: Codable, Hashable {
    let sessionId: String
    let overallScore: Int           // 0-100
    let strengths: [String]         // 2-4 bullets
    let improvements: [String]      // 2-4 bullets
    let summaryEn: String           // 1-2 sentences in English
    let summaryEs: String           // 1-2 sentences in Spanish
    let generatedAt: String         // ISO-8601 timestamp
    let engineVersion: String       // e.g. "claude-haiku-4-5/score-v1"
}

// MARK: - GET /me/active-recert
//
// Returns the signed-in applicant's most recent recertification (any status),
// or 404 when none exists. Used by InterviewCoachEntryView to wire recertId
// into PracticeSessionView without requiring the user to know their packetId.
struct ActiveRecertResponseDTO: Codable, Hashable {
    let recertId: String
    let packetId: String
    let certPeriodEnd: String?
    let status: String
}
