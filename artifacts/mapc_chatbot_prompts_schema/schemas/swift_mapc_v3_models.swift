struct CivicMAPCV3ContextTurn: Codable, Sendable {
    let turn: Int
    let role: String
    let text: String
}

struct CivicMAPCV3Session: Codable, Sendable {
    let sessionID: String
    let rawUserIssue: String
    let normalizedIssue: String
    let displayIssue: String
    let issueDomain: String
    let targetProblem: String
    let congressionalLever: String
    let askType: String
    let displayAsk: String
    let stance: String
    let geographicRelevance: String
    let optionalBillRef: String?
    let constraintsFromUser: String?
    let confidence: Double
    let needsClarification: Bool
    let clarificationPrompt: String?
    let spokenLanguageNotes: String?
    let sessionState: String
    let userZip: String?
    let accumulatedContext: [CivicMAPCV3ContextTurn]
    let introShown: Bool
    let clarificationTurnCount: Int
    let mapcApproved: Bool

    enum CodingKeys: String, CodingKey {
        case sessionID = "session_id"
        case rawUserIssue = "raw_user_issue"
        case normalizedIssue = "normalized_issue"
        case displayIssue = "display_issue"
        case issueDomain = "issue_domain"
        case targetProblem = "target_problem"
        case congressionalLever = "congressional_lever"
        case askType = "ask_type"
        case displayAsk = "display_ask"
        case stance
        case geographicRelevance = "geographic_relevance"
        case optionalBillRef = "optional_bill_ref"
        case constraintsFromUser = "constraints_from_user"
        case confidence
        case needsClarification = "needs_clarification"
        case clarificationPrompt = "clarification_prompt"
        case spokenLanguageNotes = "spoken_language_notes"
        case sessionState = "session_state"
        case userZip = "user_zip"
        case accumulatedContext = "accumulated_context"
        case introShown = "intro_shown"
        case clarificationTurnCount = "clarification_turn_count"
        case mapcApproved = "mapc_approved"
    }
}

private struct CivicMAPCV3AskOption: Codable, Sendable {
    let optionID: String
    let askType: String
    let displayAsk: String
    let confidence: Double

    enum CodingKeys: String, CodingKey {
        case optionID = "option_id"
        case askType = "ask_type"
        case displayAsk = "display_ask"
        case confidence
    }
}

private struct CivicMAPCV3ValidatorReport: Codable {
    let stage: String?
    let checks: [CivicMAPCV3ValidatorCheck]?
}

private struct CivicMAPCV3ValidatorCheck: Codable {
    let name: String?
    let passed: Bool?
}

private struct CivicMAPCV3InterpretRequest: Codable {
    let sessionID: String
    let rawUserIssue: String
    let concernText: String
    let sessionState: String
    let userZip: String?
    let accumulatedContext: [CivicMAPCV3ContextTurn]
    let clarificationTurnCount: Int
    let introShown: Bool
    let mapcApproved: Bool

    enum CodingKeys: String, CodingKey {
        case sessionID = "session_id"
        case rawUserIssue = "raw_user_issue"
        case concernText = "concern_text"
        case sessionState = "session_state"
        case userZip = "user_zip"
        case accumulatedContext = "accumulated_context"
        case clarificationTurnCount = "clarification_turn_count"
        case introShown = "intro_shown"
        case mapcApproved = "mapc_approved"
    }
}

private struct CivicMAPCV3InterpretResponse: Codable {
    let session: CivicMAPCV3Session
    let validatorReport: CivicMAPCV3ValidatorReport?

    enum CodingKeys: String, CodingKey {
        case session
        case validatorReport = "validator_report"
    }
}

private struct CivicMAPCV3BackgroundRequest: Codable {
    let session: CivicMAPCV3Session
    let concernText: String

    enum CodingKeys: String, CodingKey {
        case session
        case concernText = "concern_text"
    }
}

private struct CivicMAPCV3BackgroundResponse: Codable {
    let session: CivicMAPCV3Session
    let backgroundText: String?
    let reason: String?
    let validatorReport: CivicMAPCV3ValidatorReport?

    enum CodingKeys: String, CodingKey {
        case session
        case backgroundText = "background_text"
        case reason
        case validatorReport = "validator_report"
    }
}

private struct CivicMAPCV3AskOptionsRequest: Codable {
    let session: CivicMAPCV3Session
    let requireBillRef: Bool
    let concernText: String

    enum CodingKeys: String, CodingKey {
        case session
        case requireBillRef = "require_bill_ref"
        case concernText = "concern_text"
    }
}

private struct CivicMAPCV3AskOptionsResponse: Codable {
    let session: CivicMAPCV3Session
    let options: [CivicMAPCV3AskOption]
    let validatorReport: CivicMAPCV3ValidatorReport?

    enum CodingKeys: String, CodingKey {
        case session
        case options
        case validatorReport = "validator_report"
    }
}

private struct CivicMAPCV3ScriptRequest: Codable {
    let session: CivicMAPCV3Session
    let options: [CivicMAPCV3AskOption]
    let selectedOptionID: String
    let confirmed: Bool
    let concernText: String

    enum CodingKeys: String, CodingKey {
        case session
        case options
        case selectedOptionID = "selected_option_id"
        case confirmed
        case concernText = "concern_text"
    }
}

private struct CivicMAPCV3ScriptResponse: Codable {
    let session: CivicMAPCV3Session
    let liveScript: String
    let voicemailScript: String
    let validatorReport: CivicMAPCV3ValidatorReport?

    enum CodingKeys: String, CodingKey {
        case session
        case liveScript = "live_script"
        case voicemailScript = "voicemail_script"
        case validatorReport = "validator_report"
    }
}

struct CivicMAPCV3PreparedOption: Identifiable, Sendable {
    let optionID: String
    let askType: String
    let displayAsk: String
    let confidence: Double

    var id: String { optionID }
}

struct CivicMAPCV3PreparedSelection: Sendable {
    let sessionID: String
    let session: CivicMAPCV3Session
    let displayIssue: String
    let needsClarification: Bool
    let clarificationPrompt: String?
    let options: [CivicMAPCV3PreparedOption]
}
