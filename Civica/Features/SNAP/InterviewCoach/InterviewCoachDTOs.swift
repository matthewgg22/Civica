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
/// Per respondSchema in recert.ts: `{ user_message: string }`.
/// NOTE: the orchestrator's RespondInput has no `audio_bytes_duration` field,
/// and neither does the Zod schema on the route. Voice input is transcribed
/// on-device and only the resulting text is sent. If we later want duration
/// telemetry that's a backend gap.
struct PracticeRespondRequestDTO: Codable {
    let userMessage: String

    enum CodingKeys: String, CodingKey {
        case userMessage = "user_message"
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

// MARK: - Legacy types (retained for compile-compatibility)
//
// `InterviewScoreResponseDTO` and friends are still referenced by
// `ReviewSummaryView.swift` and `InterviewCoachAnalytics.swift`. The new
// backend has no end-of-session scoring endpoint — only per-turn
// `coaching`. The score sheet is not surfaced in the new flow, so these
// types live on as dormant shapes. A follow-up PR can either rebuild the
// score sheet from accumulated `coaching` text or remove the score path
// entirely. See InterviewCoachAPIClient for the new live calls.

struct InterviewScoreAxisDTO: Codable, Hashable {
    let score: Double
    let summary: String
}

struct InterviewPerTurnNoteDTO: Codable, Hashable {
    let turnIndex: Int
    let applicantText: String
    let note: String
}

struct InterviewScoreResponseDTO: Codable {
    let sessionId: String
    let completeness: InterviewScoreAxisDTO
    let accuracyRisk: InterviewScoreAxisDTO
    let missingContext: InterviewScoreAxisDTO
    let perTurnNotes: [InterviewPerTurnNoteDTO]
}
