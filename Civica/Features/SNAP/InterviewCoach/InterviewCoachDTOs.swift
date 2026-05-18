import Foundation

// EXPERIMENTAL SILOED MODULE: wire-format types mirroring
// backend/civic_api/models.py Interview* dataclasses. JSON uses snake_case;
// the API client sets keyEncodingStrategy / keyDecodingStrategy to
// .convertToSnakeCase / .convertFromSnakeCase so these structs can use
// idiomatic Swift naming without explicit CodingKeys.

struct InterviewTurnDTO: Codable, Hashable {
    let role: String  // "caseworker" | "applicant"
    let text: String
}

struct InterviewTurnRequestDTO: Codable {
    let sessionId: String
    let stateCode: String
    let stateName: String
    let scenario: String
    let scenarioLabel: String
    let applicantArchetype: String
    let applicantArchetypeLabel: String
    let caseworkerPersona: String
    let transcript: [InterviewTurnDTO]
}

struct InterviewTurnResponseDTO: Codable {
    let sessionId: String
    let caseworkerText: String
    let endOfInterview: Bool
}

struct InterviewScoreRequestDTO: Codable {
    let sessionId: String
    let stateCode: String
    let stateName: String
    let scenario: String
    let scenarioLabel: String
    let applicantArchetype: String
    let applicantArchetypeLabel: String
    let caseworkerPersona: String
    let transcript: [InterviewTurnDTO]
}

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

// Events emitted by InterviewCoachAPIClient.streamTurn(_:).
// .delta arrives once per streamed token; .completed fires once when the
// edge function closes the SSE stream.
enum CoachTurnEvent {
    case delta(String)
    case completed(caseworkerText: String, endOfInterview: Bool)
}
