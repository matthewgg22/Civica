import Foundation
import SwiftUI
import OSLog

private struct CivicExamplesResponse: Codable {
    let examples: [CivicExampleIssueCard]
}

private struct CivicAssistantResolveRequest: Codable {
    let concernText: String
    let selectedAsk: CivicAsk
    let targetReps: [CivicRepSlot]
    let optionalBillRef: String?

    enum CodingKeys: String, CodingKey {
        case concernText = "concern_text"
        case selectedAsk = "selected_ask"
        case targetReps = "target_reps"
        case optionalBillRef = "optional_bill_ref"
    }
}

enum CivicIssueBriefStatus: String, Codable {
    case ok
    case refused
    case needsClarification = "needs_clarification"
}

private struct CivicIssueBriefRequest: Codable {
    let concernText: String
    let allowRevision: Bool

    enum CodingKeys: String, CodingKey {
        case concernText = "concern_text"
        case allowRevision = "allow_revision"
    }
}

private struct CivicScriptPackageRequest: Codable {
    struct RepContextPayload: Codable {
        let repID: String
        let repName: String
        let officeType: String
        let chamber: String
        let district: String?
        let state: String?
        let primaryPhoneNumber: String
        let localOfficePhoneNumber: String?

        enum CodingKeys: String, CodingKey {
            case repID = "rep_id"
            case repName = "rep_name"
            case officeType = "office_type"
            case chamber
            case district
            case state
            case primaryPhoneNumber = "primary_phone_number"
            case localOfficePhoneNumber = "local_office_phone_number"
        }
    }

    let concernText: String
    let selectedAsk: CivicAsk
    let targetReps: [CivicRepSlot]
    let repContexts: [RepContextPayload]
    let optionalBillRef: String?
    let allowRevision: Bool
    let userZip: String?
    let userState: String?
    let chosenOption: String?

    enum CodingKeys: String, CodingKey {
        case concernText = "concern_text"
        case selectedAsk = "selected_ask"
        case targetReps = "target_reps"
        case repContexts = "rep_contexts"
        case optionalBillRef = "optional_bill_ref"
        case allowRevision = "allow_revision"
        case userZip = "user_zip"
        case userState = "user_state"
        case chosenOption = "chosen_option"
    }
}

private struct CivicScriptFeedbackRequest: Codable {
    let packageID: String
    let decision: String
    let chosenOption: String?
    let finalScript: String?

    enum CodingKeys: String, CodingKey {
        case packageID = "package_id"
        case decision
        case chosenOption = "chosen_option"
        case finalScript = "final_script"
    }
}

private struct CivicScriptChatTurnRequest: Codable {
    let sessionID: String
    let packageID: String?
    let role: String
    let turnIndex: Int
    let messageText: String
    let messageType: String?

    enum CodingKeys: String, CodingKey {
        case sessionID = "session_id"
        case packageID = "package_id"
        case role
        case turnIndex = "turn_index"
        case messageText = "message_text"
        case messageType = "message_type"
    }
}

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

struct CivicIssueBriefFact: Codable {
    let fact: String
    let sourceName: String?
    let sourceURL: String?
    let publishedAt: String?

    enum CodingKeys: String, CodingKey {
        case fact
        case sourceName = "source_name"
        case sourceURL = "source_url"
        case publishedAt = "published_at"
    }
}

struct CivicIssueBriefArgument: Codable {
    let view: String
    let argument: String
}

struct CivicIssueBriefResponse: Codable {
    let status: CivicIssueBriefStatus
    let canonicalIssue: String
    let summaryNeutral: String
    let currentStatus: String
    let keyFacts: [CivicIssueBriefFact]
    let argumentsByView: [CivicIssueBriefArgument]
    let unknowns: [String]
    let questionsToConsider: [String]
    let policyFlags: [String]
    let clarificationQuestion: String?
    let reviewPrompt: String?

    enum CodingKeys: String, CodingKey {
        case status
        case canonicalIssue = "canonical_issue"
        case summaryNeutral = "summary_neutral"
        case currentStatus = "current_status"
        case keyFacts = "key_facts"
        case argumentsByView = "arguments_by_view"
        case unknowns
        case questionsToConsider = "questions_to_consider"
        case policyFlags = "policy_flags"
        case clarificationQuestion = "clarification_question"
        case reviewPrompt = "review_prompt"
    }
}

struct CivicScriptPackageCommitteeMatch: Codable {
    let matched: Bool
    let matchedCommittees: [String]
    let jurisdictionCallout: String?

    enum CodingKeys: String, CodingKey {
        case matched
        case matchedCommittees = "matched_committees"
        case jurisdictionCallout = "jurisdiction_callout"
    }
}

extension CivicScriptPackageCommitteeMatch {
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        matched = try container.decodeIfPresent(Bool.self, forKey: .matched) ?? false
        matchedCommittees = try container.decodeIfPresent([String].self, forKey: .matchedCommittees) ?? []
        jurisdictionCallout = try container.decodeIfPresent(String.self, forKey: .jurisdictionCallout)
    }
}

struct CivicScriptPackageOfficeOverlay: Codable {
    let repID: String
    let repName: String
    let officeType: String
    let chamber: String
    let committeeMatch: CivicScriptPackageCommitteeMatch
    let roleOverlays: [String]
    let liveScriptFinal: String
    let voicemailScriptFinal: String
    let relatedCommittees: [String]

    enum CodingKeys: String, CodingKey {
        case repID = "rep_id"
        case repName = "rep_name"
        case officeType = "office_type"
        case chamber
        case committeeMatch = "committee_match"
        case roleOverlays = "role_overlays"
        case liveScriptFinal = "live_script_final"
        case voicemailScriptFinal = "voicemail_script_final"
        case relatedCommittees = "related_committees"
    }
}

extension CivicScriptPackageOfficeOverlay {
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        repID = try container.decodeIfPresent(String.self, forKey: .repID) ?? ""
        repName = try container.decodeIfPresent(String.self, forKey: .repName) ?? "Congressional Office"
        officeType = try container.decodeIfPresent(String.self, forKey: .officeType) ?? "Congressional Office"
        chamber = try container.decodeIfPresent(String.self, forKey: .chamber) ?? ""
        committeeMatch = try container.decodeIfPresent(CivicScriptPackageCommitteeMatch.self, forKey: .committeeMatch)
            ?? CivicScriptPackageCommitteeMatch(matched: false, matchedCommittees: [], jurisdictionCallout: nil)
        roleOverlays = try container.decodeIfPresent([String].self, forKey: .roleOverlays) ?? []
        liveScriptFinal = try container.decodeIfPresent(String.self, forKey: .liveScriptFinal) ?? ""
        voicemailScriptFinal = try container.decodeIfPresent(String.self, forKey: .voicemailScriptFinal) ?? ""
        relatedCommittees = try container.decodeIfPresent([String].self, forKey: .relatedCommittees) ?? []
    }
}

struct CivicScriptPackageCanonicalContext: Codable {
    let issueID: String
    let title: String
    let summaryPlain: String
    let commonAsk: String
    let relatedBills: [String]
    let billSource: String
    let billDisplayText: String
    let evidenceQuality: String
    let evidenceWarning: String?
    let keyFacts: [CivicIssueBriefFact]

    enum CodingKeys: String, CodingKey {
        case issueID = "issue_id"
        case title
        case summaryPlain = "summary_plain"
        case commonAsk = "common_ask"
        case relatedBills = "related_bills"
        case billSource = "bill_source"
        case billDisplayText = "bill_display_text"
        case evidenceQuality = "evidence_quality"
        case evidenceWarning = "evidence_warning"
        case keyFacts = "key_facts"
    }
}

extension CivicScriptPackageCanonicalContext {
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        issueID = try container.decodeIfPresent(String.self, forKey: .issueID) ?? UUID().uuidString
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Constituent issue"
        summaryPlain = try container.decodeIfPresent(String.self, forKey: .summaryPlain) ?? ""
        commonAsk = try container.decodeIfPresent(String.self, forKey: .commonAsk) ?? CivicAsk.support.rawValue
        relatedBills = try container.decodeIfPresent([String].self, forKey: .relatedBills) ?? []
        billSource = try container.decodeIfPresent(String.self, forKey: .billSource) ?? "none"
        billDisplayText = try container.decodeIfPresent(String.self, forKey: .billDisplayText) ?? "this issue"
        evidenceQuality = try container.decodeIfPresent(String.self, forKey: .evidenceQuality) ?? "limited"
        evidenceWarning = try container.decodeIfPresent(String.self, forKey: .evidenceWarning)
        keyFacts = try container.decodeIfPresent([CivicIssueBriefFact].self, forKey: .keyFacts) ?? []
    }
}

struct CivicScriptPackageScriptCore: Codable {
    let liveScriptCore: String
    let voicemailScriptCore: String

    enum CodingKeys: String, CodingKey {
        case liveScriptCore = "live_script_core"
        case voicemailScriptCore = "voicemail_script_core"
    }
}

extension CivicScriptPackageScriptCore {
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        liveScriptCore = try container.decodeIfPresent(String.self, forKey: .liveScriptCore)
            ?? "Hi, my name is [Your Name], and I am a constituent calling about this issue."
        voicemailScriptCore = try container.decodeIfPresent(String.self, forKey: .voicemailScriptCore)
            ?? "Hi, constituent calling about this issue. Please share the member's current position and next step."
    }
}

struct CivicScriptPackageTruthTrace: Codable {
    let normalizedInput: String
    let canonicalIssueID: String
    let classificationReason: String
    let billSource: String
    let personalizationFieldsUsed: [String]
    let fallbackUsed: String
    let refusalReason: String?

    enum CodingKeys: String, CodingKey {
        case normalizedInput = "normalized_input"
        case canonicalIssueID = "canonical_issue_id"
        case classificationReason = "classification_reason"
        case billSource = "bill_source"
        case personalizationFieldsUsed = "personalization_fields_used"
        case fallbackUsed = "fallback_used"
        case refusalReason = "refusal_reason"
    }
}

extension CivicScriptPackageTruthTrace {
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        normalizedInput = try container.decodeIfPresent(String.self, forKey: .normalizedInput) ?? ""
        canonicalIssueID = try container.decodeIfPresent(String.self, forKey: .canonicalIssueID) ?? "general-civic-issue"
        classificationReason = try container.decodeIfPresent(String.self, forKey: .classificationReason) ?? "unknown"
        billSource = try container.decodeIfPresent(String.self, forKey: .billSource) ?? "none"
        personalizationFieldsUsed = try container.decodeIfPresent([String].self, forKey: .personalizationFieldsUsed) ?? []
        fallbackUsed = try container.decodeIfPresent(String.self, forKey: .fallbackUsed) ?? "none"
        refusalReason = try container.decodeIfPresent(String.self, forKey: .refusalReason)
    }
}

struct CivicScriptPackageResponse: Codable {
    let status: CivicIssueBriefStatus
    let packageID: String
    let canonicalContext: CivicScriptPackageCanonicalContext?
    let scriptCore: CivicScriptPackageScriptCore?
    let officeOverlays: [CivicScriptPackageOfficeOverlay]
    let reviewCanRegenerate: Bool
    let reviewRegenerateHint: String
    let truthTrace: CivicScriptPackageTruthTrace?
    let policyFlags: [String]

    enum CodingKeys: String, CodingKey {
        case status
        case packageID = "package_id"
        case canonicalContext = "canonical_context"
        case scriptCore = "script_core"
        case officeOverlays = "office_overlays"
        case reviewCanRegenerate = "review_can_regenerate"
        case reviewRegenerateHint = "review_regenerate_hint"
        case truthTrace = "truth_trace"
        case policyFlags = "policy_flags"
    }
}

extension CivicScriptPackageResponse {
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let rawStatus = try container.decodeIfPresent(String.self, forKey: .status)?.trimmingCharacters(in: .whitespacesAndNewlines)
        status = CivicIssueBriefStatus(rawValue: rawStatus ?? "") ?? .ok
        packageID = try container.decodeIfPresent(String.self, forKey: .packageID) ?? UUID().uuidString
        canonicalContext = try container.decodeIfPresent(CivicScriptPackageCanonicalContext.self, forKey: .canonicalContext)
        scriptCore = try container.decodeIfPresent(CivicScriptPackageScriptCore.self, forKey: .scriptCore)
        officeOverlays = try container.decodeIfPresent([CivicScriptPackageOfficeOverlay].self, forKey: .officeOverlays) ?? []
        reviewCanRegenerate = try container.decodeIfPresent(Bool.self, forKey: .reviewCanRegenerate) ?? true
        reviewRegenerateHint = try container.decodeIfPresent(String.self, forKey: .reviewRegenerateHint)
            ?? "Tell me what to change and I can regenerate."
        truthTrace = try container.decodeIfPresent(CivicScriptPackageTruthTrace.self, forKey: .truthTrace)
        policyFlags = try container.decodeIfPresent([String].self, forKey: .policyFlags) ?? []
    }
}

private struct CivicCallLogRequest: Codable {
    let repID: String
    let issueID: String
    let briefID: String
    let outcome: CivicCallOutcome
    let stafferPosition: String?
    let notes: String

    enum CodingKeys: String, CodingKey {
        case repID = "rep_id"
        case issueID = "issue_id"
        case briefID = "brief_id"
        case outcome
        case stafferPosition = "staffer_position"
        case notes
    }
}

private struct CivicHistoryResponse: Codable {
    let history: [CivicHistoryGroup]
}

private struct CivicCallLaunchRequest: Codable {
    let officeID: String
    let issueID: String?
    let sourceScreen: String
    let sessionID: String?

    enum CodingKeys: String, CodingKey {
        case officeID = "office_id"
        case issueID = "issue_id"
        case sourceScreen = "source_screen"
        case sessionID = "session_id"
    }
}

private struct CivicCallCompletionRequestPayload: Codable {
    let launchEventID: String
    let completed: Bool

    enum CodingKeys: String, CodingKey {
        case launchEventID = "launch_event_id"
        case completed
    }
}

private struct CivicCallScoreRecomputePayload: Encodable {
    let noop: Bool = true
}

protocol CivicIssueCallAPIClientProtocol {
    func fetchExamples(userID: String, reps: [CivicRepTarget]) async throws -> [CivicExampleIssueCard]
    func createScriptPackage(
        userID: String,
        concernText: String,
        selectedAsk: CivicAsk,
        targetReps: [CivicRepSlot],
        repTargets: [CivicRepTarget],
        optionalBillRef: String?,
        userZip: String?,
        userState: String?
    ) async throws -> CivicScriptPackageResponse
    func prepareMAPCV3Selection(
        userID: String,
        sessionID: String?,
        sessionState: String,
        concernText: String,
        accumulatedContext: [CivicMAPCV3ContextTurn],
        clarificationTurnCount: Int,
        introShown: Bool,
        mapcApproved: Bool,
        userZip: String?
    ) async throws -> CivicMAPCV3PreparedSelection
    func generateMAPCV3ScriptFromSelection(
        userID: String,
        concernText: String,
        sessionID: String,
        selectedOptionID: String,
        targetReps: [CivicRepSlot],
        repTargets: [CivicRepTarget],
        optionalBillRef: String?,
        userState: String?
    ) async throws -> CivicScriptPackageResponse
    func logScriptFeedback(
        userID: String,
        packageID: String,
        decision: String,
        chosenOption: String?,
        finalScript: String?
    ) async throws
    func logScriptChatTurn(
        userID: String,
        sessionID: String,
        packageID: String?,
        role: String,
        turnIndex: Int,
        messageText: String,
        messageType: String?
    ) async throws
    func logCall(
        userID: String,
        repID: String,
        issueID: String,
        briefID: String,
        outcome: CivicCallOutcome,
        stafferPosition: String?,
        notes: String
    ) async throws
    func fetchHistory(userID: String) async throws -> [CivicHistoryGroup]
    func logCallLaunch(
        userID: String,
        officeID: String,
        issueID: String?,
        sourceScreen: String,
        sessionID: String?
    ) async throws -> CivicCallLaunchResponse
    func confirmCallCompletion(
        userID: String,
        launchEventID: String,
        completed: Bool
    ) async throws -> CivicCallCompletionResponse
    func fetchCallScoreSummary(userID: String) async throws -> CivicCallScoreSummary
    func fetchCallScoreBreakdown(userID: String) async throws -> CivicCallScoreBreakdown
    func fetchCallScoreHistory(userID: String, limit: Int) async throws -> [CivicCallScoreHistoryItem]
    func recomputeCallScore(userID: String) async throws -> CivicCallScoreSnapshot
    func fetchLeaderboard(periodType: String, periodStart: Date?) async throws -> CivicLeaderboardResponse
    func fetchUserLeaderboardSummary(userID: String, periodType: String, periodStart: Date?) async throws -> CivicLeaderboardUserSummary
}

final class CivicIssueCallAPIClient: CivicIssueCallAPIClientProtocol {
    private struct MAPCV3PendingSelectionState {
        let concernText: String
        let session: CivicMAPCV3Session
        let options: [CivicMAPCV3AskOption]
    }

    private let baseURL: URL
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder: JSONDecoder
    private let logger = Logger(subsystem: "VoteNow", category: "CivicIssueCallAPIClient")
    // Render free instances can cold-start slowly; allow enough time before failing.
    private let requestTimeout: TimeInterval = 65
    private let mapcPipelineV3FlagKey = "mapc_pipeline_v3_enabled"
    private var mapcV3PendingSelectionStateBySessionID: [String: MAPCV3PendingSelectionState] = [:]

    init(baseURL: URL = CivicIssueCallAPIClient.resolveBaseURL(), session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder

        encoder.dateEncodingStrategy = .iso8601
    }

    func fetchExamples(userID _: String, reps: [CivicRepTarget]) async throws -> [CivicExampleIssueCard] {
        var components = URLComponents(url: endpoint("/api/v1/civic/examples"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "rep_ids", value: reps.map { stableRepID(for: $0.official) }.joined(separator: ","))
        ]
        guard let url = components?.url else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        await attachAuthorizationIfAvailable(to: &request)

        let data = try await requestData(for: request, timeout: 12, allowTimeoutRetry: false)
        let decoded = try decoder.decode(CivicExamplesResponse.self, from: data)
        return decoded.examples
    }

    func createScriptPackage(
        userID _: String,
        concernText: String,
        selectedAsk: CivicAsk,
        targetReps: [CivicRepSlot],
        repTargets: [CivicRepTarget],
        optionalBillRef: String?,
        userZip: String?,
        userState: String?
    ) async throws -> CivicScriptPackageResponse {
        if mapcPipelineV3Enabled {
            return try await createScriptPackageV3(
                concernText: concernText,
                selectedAsk: selectedAsk,
                targetReps: targetReps,
                repTargets: repTargets,
                optionalBillRef: optionalBillRef,
                userZip: userZip,
                userState: userState
            )
        }

        let repContextPayload = targetReps.compactMap { slot -> CivicScriptPackageRequest.RepContextPayload? in
            guard let target = repTargets.first(where: { $0.slot == slot }) else {
                return nil
            }
            let officeType = target.officeType.trimmingCharacters(in: .whitespacesAndNewlines)
            let chamber: String = slot == .house ? "house" : "senate"
            let district = target.official.district?.trimmingCharacters(in: .whitespacesAndNewlines)
            let primaryPhone = (target.official.officialPhone ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return CivicScriptPackageRequest.RepContextPayload(
                repID: stableRepID(for: target.official),
                repName: target.official.name,
                officeType: officeType.isEmpty ? (slot == .house ? "Representative" : "U.S. Senator") : officeType,
                chamber: chamber,
                district: (district?.isEmpty == true) ? nil : district,
                state: stateCodeFromDivisionID(target.official.divisionId),
                primaryPhoneNumber: primaryPhone.isEmpty ? (slot == .house ? "(202) 225-3121" : "(202) 224-3121") : primaryPhone,
                localOfficePhoneNumber: nil
            )
        }

        let requestBody = CivicScriptPackageRequest(
            concernText: concernText,
            selectedAsk: selectedAsk,
            targetReps: targetReps,
            repContexts: repContextPayload,
            optionalBillRef: optionalBillRef,
            allowRevision: true,
            userZip: userZip,
            userState: userState,
            chosenOption: concernText
        )
        var request = URLRequest(url: endpoint("/api/v1/civic/script-package"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        await attachAuthorizationIfAvailable(to: &request)
        request.httpBody = try encoder.encode(requestBody)

        let data = try await requestData(for: request)
        do {
            return try decoder.decode(CivicScriptPackageResponse.self, from: data)
        } catch {
            let rawPayload = String(data: data, encoding: .utf8) ?? "<non-utf8-payload>"
            let snippet = String(rawPayload.prefix(900))
            logger.error("Failed to decode script-package payload. Error: \(String(describing: error), privacy: .public) Payload: \(snippet, privacy: .public)")
            throw NSError(
                domain: "CivicIssueCallAPIClient",
                code: -2,
                userInfo: [
                    NSLocalizedDescriptionKey: "Received an unexpected script payload from civic API."
                ]
            )
        }
    }

    private var mapcPipelineV3Enabled: Bool {
        if let boolValue = UserDefaults.standard.object(forKey: mapcPipelineV3FlagKey) as? Bool {
            return boolValue
        }
        if let stringValue = UserDefaults.standard.string(forKey: mapcPipelineV3FlagKey) {
            let normalized = stringValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if ["1", "true", "yes", "on"].contains(normalized) { return true }
            if ["0", "false", "no", "off"].contains(normalized) { return false }
        }
        if let envValue = ProcessInfo.processInfo.environment[mapcPipelineV3FlagKey] {
            let normalized = envValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return ["1", "true", "yes", "on"].contains(normalized)
        }
        return true
    }

    private func createScriptPackageV3(
        concernText: String,
        selectedAsk: CivicAsk,
        targetReps: [CivicRepSlot],
        repTargets: [CivicRepTarget],
        optionalBillRef: String?,
        userZip: String?,
        userState: String?
    ) async throws -> CivicScriptPackageResponse {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        _ = concernText
        _ = selectedAsk
        _ = targetReps
        _ = repTargets
        _ = optionalBillRef
        _ = userZip
        _ = userState
        throw NSError(
            domain: "CivicIssueCallAPIClient",
            code: -31_001,
            userInfo: [NSLocalizedDescriptionKey: "MAPC v3 requires explicit ask-option selection before script generation."]
        )
    }

    func prepareMAPCV3Selection(
        userID _: String,
        sessionID: String?,
        sessionState: String,
        concernText: String,
        accumulatedContext: [CivicMAPCV3ContextTurn],
        clarificationTurnCount: Int,
        introShown: Bool,
        mapcApproved: Bool,
        userZip: String?
    ) async throws -> CivicMAPCV3PreparedSelection {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        guard mapcPipelineV3Enabled else {
            throw NSError(
                domain: "CivicIssueCallAPIClient",
                code: -31_002,
                userInfo: [NSLocalizedDescriptionKey: "MAPC v3 is disabled."]
            )
        }

        let normalizedConcern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedSessionState = sessionState.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "new"
            : sessionState.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedSessionID = sessionID?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? sessionID!.trimmingCharacters(in: .whitespacesAndNewlines)
            : UUID().uuidString
        let interpretPayload = CivicMAPCV3InterpretRequest(
            sessionID: resolvedSessionID,
            rawUserIssue: normalizedConcern,
            concernText: normalizedConcern,
            sessionState: normalizedSessionState,
            userZip: userZip,
            accumulatedContext: accumulatedContext,
            clarificationTurnCount: clarificationTurnCount,
            introShown: introShown,
            mapcApproved: mapcApproved
        )
        var interpretRequest = URLRequest(url: endpoint("/api/v2/civic/mapc/interpret"))
        interpretRequest.httpMethod = "POST"
        interpretRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        await attachAuthorizationIfAvailable(to: &interpretRequest)
        interpretRequest.httpBody = try encoder.encode(interpretPayload)
        let interpretData = try await requestData(for: interpretRequest)
        let interpretResponse = try decoder.decode(CivicMAPCV3InterpretResponse.self, from: interpretData)

        if interpretResponse.session.needsClarification {
            mapcV3PendingSelectionStateBySessionID[interpretResponse.session.sessionID] = MAPCV3PendingSelectionState(
                concernText: normalizedConcern,
                session: interpretResponse.session,
                options: []
            )
            return CivicMAPCV3PreparedSelection(
                sessionID: interpretResponse.session.sessionID,
                session: interpretResponse.session,
                displayIssue: interpretResponse.session.displayIssue,
                needsClarification: true,
                clarificationPrompt: interpretResponse.session.clarificationPrompt
                    ?? "I need one detail to make this usable: what issue do you care about most?",
                options: []
            )
        }

        var askRequest = URLRequest(url: endpoint("/api/v2/civic/mapc/ask-options"))
        askRequest.httpMethod = "POST"
        askRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        await attachAuthorizationIfAvailable(to: &askRequest)
        askRequest.httpBody = try encoder.encode(
            CivicMAPCV3AskOptionsRequest(
                session: interpretResponse.session,
                requireBillRef: false,
                concernText: normalizedConcern
            )
        )
        let askData = try await requestData(for: askRequest)
        let askResponse = try decoder.decode(CivicMAPCV3AskOptionsResponse.self, from: askData)
        guard !askResponse.options.isEmpty else {
            throw NSError(
                domain: "CivicIssueCallAPIClient",
                code: -31_003,
                userInfo: [NSLocalizedDescriptionKey: "MAPC v3 returned no ask options."]
            )
        }

        mapcV3PendingSelectionStateBySessionID[askResponse.session.sessionID] = MAPCV3PendingSelectionState(
            concernText: normalizedConcern,
            session: askResponse.session,
            options: askResponse.options
        )

        return CivicMAPCV3PreparedSelection(
            sessionID: askResponse.session.sessionID,
            session: askResponse.session,
            displayIssue: askResponse.session.displayIssue,
            needsClarification: askResponse.session.needsClarification,
            clarificationPrompt: askResponse.session.clarificationPrompt,
            options: askResponse.options.map {
                CivicMAPCV3PreparedOption(
                    optionID: $0.optionID,
                    askType: $0.askType,
                    displayAsk: $0.displayAsk,
                    confidence: $0.confidence
                )
            }
        )
    }

    func generateMAPCV3ScriptFromSelection(
        userID _: String,
        concernText: String,
        sessionID: String,
        selectedOptionID: String,
        targetReps: [CivicRepSlot],
        repTargets: [CivicRepTarget],
        optionalBillRef: String?,
        userState: String?
    ) async throws -> CivicScriptPackageResponse {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        guard mapcPipelineV3Enabled else {
            throw NSError(
                domain: "CivicIssueCallAPIClient",
                code: -31_004,
                userInfo: [NSLocalizedDescriptionKey: "MAPC v3 is disabled."]
            )
        }

        let normalizedConcern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !selectedOptionID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw NSError(
                domain: "CivicIssueCallAPIClient",
                code: -31_005,
                userInfo: [NSLocalizedDescriptionKey: "selected_option_id is required."]
            )
        }
        let pending = mapcV3PendingSelectionStateBySessionID[sessionID]
        guard let pending else {
            throw NSError(
                domain: "CivicIssueCallAPIClient",
                code: -31_006,
                userInfo: [NSLocalizedDescriptionKey: "No pending MAPC v3 selection state was found."]
            )
        }
        if pending.concernText.caseInsensitiveCompare(normalizedConcern) != .orderedSame {
            throw NSError(
                domain: "CivicIssueCallAPIClient",
                code: -31_007,
                userInfo: [NSLocalizedDescriptionKey: "MAPC v3 session does not match the current issue input."]
            )
        }

        var backgroundRequest = URLRequest(url: endpoint("/api/v2/civic/mapc/background"))
        backgroundRequest.httpMethod = "POST"
        backgroundRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        await attachAuthorizationIfAvailable(to: &backgroundRequest)
        backgroundRequest.httpBody = try encoder.encode(
            CivicMAPCV3BackgroundRequest(
                session: pending.session,
                concernText: normalizedConcern
            )
        )
        let backgroundData = try await requestData(for: backgroundRequest)
        let backgroundResponse = try decoder.decode(CivicMAPCV3BackgroundResponse.self, from: backgroundData)
        let resolvedBackgroundText = backgroundResponse.backgroundText?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let missingBackground = resolvedBackgroundText.isEmpty
        let canProceedWithoutBackground = backgroundResponse.session.confidence >= 0.65
            && !backgroundResponse.session.needsClarification

        if missingBackground && !canProceedWithoutBackground {
            return CivicScriptPackageResponse(
                status: .needsClarification,
                packageID: UUID().uuidString,
                canonicalContext: nil,
                scriptCore: nil,
                officeOverlays: [],
                reviewCanRegenerate: true,
                reviewRegenerateHint: backgroundResponse.session.clarificationPrompt
                    ?? "I need one detail to make this usable: what issue do you care about most?",
                truthTrace: nil,
                policyFlags: ["mapc_pipeline_v3_background_\(backgroundResponse.reason ?? "null")"]
            )
        }
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        // UI safeguard: if Stage 3 returns null, proceed without injecting a generic background paragraph.
        let backgroundText = resolvedBackgroundText

        var scriptRequest = URLRequest(url: endpoint("/api/v2/civic/mapc/script"))
        scriptRequest.httpMethod = "POST"
        scriptRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        await attachAuthorizationIfAvailable(to: &scriptRequest)
        scriptRequest.httpBody = try encoder.encode(
            CivicMAPCV3ScriptRequest(
                session: backgroundResponse.session,
                options: pending.options,
                selectedOptionID: selectedOptionID,
                confirmed: true,
                concernText: normalizedConcern
            )
        )
        let scriptData = try await requestData(for: scriptRequest)
        let scriptResponse = try decoder.decode(CivicMAPCV3ScriptResponse.self, from: scriptData)
        mapcV3PendingSelectionStateBySessionID[sessionID] = nil

        return buildV3ScriptPackageFromStageOutputs(
            scriptResponse: scriptResponse,
            backgroundText: backgroundText,
            concernText: normalizedConcern,
            targetReps: targetReps,
            repTargets: repTargets,
            optionalBillRef: optionalBillRef,
            userState: userState
        )
    }

    private func buildV3ScriptPackageFromStageOutputs(
        scriptResponse: CivicMAPCV3ScriptResponse,
        backgroundText: String,
        concernText: String,
        targetReps: [CivicRepSlot],
        repTargets: [CivicRepTarget],
        optionalBillRef: String?,
        userState: String?
    ) -> CivicScriptPackageResponse {
        let packageID = UUID().uuidString
        let resolvedIssueTitle = scriptResponse.session.normalizedIssue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? scriptResponse.session.displayIssue
            : scriptResponse.session.normalizedIssue
        let canonicalIssueID = UUID().uuidString
        let billSource = (optionalBillRef?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false) ? "user" : "none"
        let billDisplay = optionalBillRef?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? optionalBillRef!.trimmingCharacters(in: .whitespacesAndNewlines)
            : "this issue"
        let relatedBills = optionalBillRef.map { [$0] } ?? []

        let core = CivicScriptPackageScriptCore(
            liveScriptCore: scriptResponse.liveScript,
            voicemailScriptCore: scriptResponse.voicemailScript
        )

        let officeOverlays = buildV3OfficeOverlays(
            targetReps: targetReps,
            repTargets: repTargets,
            liveScript: scriptResponse.liveScript,
            voicemailScript: scriptResponse.voicemailScript
        )

        let resolvedCommonAsk: String = {
            let candidate = scriptResponse.session.askType.trimmingCharacters(in: .whitespacesAndNewlines)
            return candidate.isEmpty ? "support" : candidate
        }()

        return CivicScriptPackageResponse(
            status: .ok,
            packageID: packageID,
            canonicalContext: CivicScriptPackageCanonicalContext(
                issueID: canonicalIssueID,
                title: resolvedIssueTitle,
                summaryPlain: backgroundText,
                commonAsk: resolvedCommonAsk,
                relatedBills: relatedBills,
                billSource: billSource,
                billDisplayText: billDisplay,
                evidenceQuality: "limited",
                evidenceWarning: nil,
                keyFacts: []
            ),
            scriptCore: core,
            officeOverlays: officeOverlays,
            reviewCanRegenerate: true,
            reviewRegenerateHint: "Use revise to adjust issue scope, stance, or local angle.",
            truthTrace: CivicScriptPackageTruthTrace(
                normalizedInput: concernText,
                canonicalIssueID: canonicalIssueID,
                classificationReason: "mapc_pipeline_v3",
                billSource: billSource,
                personalizationFieldsUsed: userState.map { [$0] } ?? [],
                fallbackUsed: "none",
                refusalReason: nil
            ),
            policyFlags: ["mapc_pipeline_v3_enabled"]
        )
    }

    private func preferredV3Option(from options: [CivicMAPCV3AskOption], selectedAsk: CivicAsk) -> CivicMAPCV3AskOption? {
        guard !options.isEmpty else { return nil }
        let askHint = selectedAsk.rawValue.lowercased()
        if let matched = options.first(where: {
            $0.askType.lowercased().contains(askHint)
                || $0.displayAsk.lowercased().contains(askHint.replacingOccurrences(of: "_", with: " "))
        }) {
            return matched
        }
        return options.first
    }

    private func buildV3OfficeOverlays(
        targetReps: [CivicRepSlot],
        repTargets: [CivicRepTarget],
        liveScript: String,
        voicemailScript: String
    ) -> [CivicScriptPackageOfficeOverlay] {
        let selectedTargets = repTargets.filter { targetReps.contains($0.slot) }
        if selectedTargets.isEmpty {
            return [
                CivicScriptPackageOfficeOverlay(
                    repID: UUID().uuidString,
                    repName: "Congressional Office",
                    officeType: "Congressional Office",
                    chamber: "",
                    committeeMatch: CivicScriptPackageCommitteeMatch(matched: false, matchedCommittees: [], jurisdictionCallout: nil),
                    roleOverlays: [],
                    liveScriptFinal: liveScript,
                    voicemailScriptFinal: voicemailScript,
                    relatedCommittees: []
                )
            ]
        }

        return selectedTargets.map { target in
            let personalizedLiveScript = personalizeV3ScriptForTarget(liveScript, target: target)
            let personalizedVoicemailScript = personalizeV3ScriptForTarget(voicemailScript, target: target)
            return CivicScriptPackageOfficeOverlay(
                repID: stableRepID(for: target.official),
                repName: target.official.name,
                officeType: target.officeType,
                chamber: target.slot == .house ? "house" : "senate",
                committeeMatch: CivicScriptPackageCommitteeMatch(matched: false, matchedCommittees: [], jurisdictionCallout: nil),
                roleOverlays: [],
                liveScriptFinal: personalizedLiveScript,
                voicemailScriptFinal: personalizedVoicemailScript,
                relatedCommittees: []
            )
        }
    }

    private func personalizeV3ScriptForTarget(_ script: String, target: CivicRepTarget) -> String {
        let trimmed = script.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return script }

        let fullName = target.official.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let lastName = fullName.split(whereSeparator: \.isWhitespace).last.map(String.init) ?? fullName
        let title = target.slot == .house ? "Representative" : "Senator"
        let titledName = "\(title) \(lastName.trimmingCharacters(in: .whitespacesAndNewlines))"

        var personalized = trimmed
            .replacingOccurrences(of: "[REPRESENTATIVE]", with: titledName)
            .replacingOccurrences(of: "{REP_NAME}", with: titledName)

        let substitutions: [(String, String)] = [
            (#"(?i)\bthe representative\b"#, titledName),
            (#"(?i)\byour representative\b"#, titledName),
            (#"(?i)\bthis representative\b"#, titledName),
            (#"(?i)\bthe senator\b"#, titledName),
            (#"(?i)\byour senator\b"#, titledName),
            (#"(?i)\bthis senator\b"#, titledName),
            (#"(?i)\bthe member of congress\b"#, titledName),
            (#"(?i)\bthe member\b"#, titledName)
        ]

        for (pattern, replacement) in substitutions {
            personalized = personalized.replacingOccurrences(
                of: pattern,
                with: replacement,
                options: .regularExpression
            )
        }

        return personalized
    }

    func logScriptFeedback(
        userID _: String,
        packageID: String,
        decision: String,
        chosenOption: String?,
        finalScript: String?
    ) async throws {
        let payload = CivicScriptFeedbackRequest(
            packageID: packageID,
            decision: decision,
            chosenOption: chosenOption,
            finalScript: finalScript
        )
        var request = URLRequest(url: endpoint("/api/v1/civic/script-feedback"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        await attachAuthorizationIfAvailable(to: &request)
        request.httpBody = try encoder.encode(payload)
        _ = try await requestData(for: request)
    }

    func logScriptChatTurn(
        userID _: String,
        sessionID: String,
        packageID: String?,
        role: String,
        turnIndex: Int,
        messageText: String,
        messageType: String?
    ) async throws {
        let payload = CivicScriptChatTurnRequest(
            sessionID: sessionID,
            packageID: packageID,
            role: role,
            turnIndex: turnIndex,
            messageText: messageText,
            messageType: messageType
        )
        var request = URLRequest(url: endpoint("/api/v1/civic/script-chat-turn"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        await attachAuthorizationIfAvailable(to: &request)
        request.httpBody = try encoder.encode(payload)
        _ = try await requestData(for: request)
    }

    func logCall(
        userID _: String,
        repID: String,
        issueID: String,
        briefID: String,
        outcome: CivicCallOutcome,
        stafferPosition: String?,
        notes: String
    ) async throws {
        let payload = CivicCallLogRequest(
            repID: repID,
            issueID: issueID,
            briefID: briefID,
            outcome: outcome,
            stafferPosition: stafferPosition,
            notes: notes
        )
        var request = URLRequest(url: endpoint("/api/v1/civic/calls/log"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await attachAuthorization(to: &request)
        request.httpBody = try encoder.encode(payload)
        _ = try await requestData(for: request)
    }

    func fetchHistory(userID _: String) async throws -> [CivicHistoryGroup] {
        let url = endpoint("/api/v1/civic/history")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        try await attachAuthorization(to: &request)

        let data = try await requestData(for: request)
        return try decoder.decode(CivicHistoryResponse.self, from: data).history
    }

    func logCallLaunch(
        userID _: String,
        officeID: String,
        issueID: String?,
        sourceScreen: String,
        sessionID: String?
    ) async throws -> CivicCallLaunchResponse {
        let payload = CivicCallLaunchRequest(
            officeID: officeID,
            issueID: issueID,
            sourceScreen: sourceScreen,
            sessionID: sessionID
        )
        var request = URLRequest(url: endpoint("/api/v1/civic/calls/launch"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await attachAuthorization(to: &request)
        request.httpBody = try encoder.encode(payload)
        let data = try await requestData(for: request)
        return try decoder.decode(CivicCallLaunchResponse.self, from: data)
    }

    func confirmCallCompletion(
        userID _: String,
        launchEventID: String,
        completed: Bool
    ) async throws -> CivicCallCompletionResponse {
        let payload = CivicCallCompletionRequestPayload(
            launchEventID: launchEventID,
            completed: completed
        )
        var request = URLRequest(url: endpoint("/api/v1/civic/calls/confirm"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await attachAuthorization(to: &request)
        request.httpBody = try encoder.encode(payload)
        let data = try await requestData(for: request)
        return try decoder.decode(CivicCallCompletionResponse.self, from: data)
    }

    func fetchCallScoreSummary(userID _: String) async throws -> CivicCallScoreSummary {
        let url = endpoint("/api/v1/civic/call-score/summary")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        try await attachAuthorization(to: &request)
        let data = try await requestData(for: request)
        return try decoder.decode(CivicCallScoreSummary.self, from: data)
    }

    func fetchCallScoreBreakdown(userID _: String) async throws -> CivicCallScoreBreakdown {
        let url = endpoint("/api/v1/civic/call-score/breakdown")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        try await attachAuthorization(to: &request)
        let data = try await requestData(for: request)
        return try decoder.decode(CivicCallScoreBreakdown.self, from: data)
    }

    func fetchCallScoreHistory(userID _: String, limit: Int) async throws -> [CivicCallScoreHistoryItem] {
        var components = URLComponents(url: endpoint("/api/v1/civic/call-score/history"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "limit", value: String(max(1, limit)))
        ]
        guard let url = components?.url else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        try await attachAuthorization(to: &request)
        let data = try await requestData(for: request)
        return try decoder.decode(CivicCallScoreHistoryResponse.self, from: data).history
    }

    func recomputeCallScore(userID _: String) async throws -> CivicCallScoreSnapshot {
        let payload = CivicCallScoreRecomputePayload()
        var request = URLRequest(url: endpoint("/api/v1/civic/call-score/recompute"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await attachAuthorization(to: &request)
        request.httpBody = try encoder.encode(payload)
        let data = try await requestData(for: request)
        struct RecomputeResponse: Codable { let snapshot: CivicCallScoreSnapshot }
        return try decoder.decode(RecomputeResponse.self, from: data).snapshot
    }

    func fetchLeaderboard(periodType: String, periodStart: Date?) async throws -> CivicLeaderboardResponse {
        var components = URLComponents(url: endpoint("/api/v1/civic/leaderboard"), resolvingAgainstBaseURL: false)
        var queryItems = [URLQueryItem(name: "period_type", value: periodType)]
        if let periodStart {
            queryItems.append(URLQueryItem(name: "period_start", value: ISO8601DateFormatter().string(from: periodStart)))
        }
        components?.queryItems = queryItems
        guard let url = components?.url else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        try await attachAuthorization(to: &request)
        let data = try await requestData(for: request)
        return try decoder.decode(CivicLeaderboardResponse.self, from: data)
    }

    func fetchUserLeaderboardSummary(userID _: String, periodType: String, periodStart: Date?) async throws -> CivicLeaderboardUserSummary {
        var components = URLComponents(url: endpoint("/api/v1/civic/leaderboard/me"), resolvingAgainstBaseURL: false)
        var queryItems = [
            URLQueryItem(name: "period_type", value: periodType),
        ]
        if let periodStart {
            queryItems.append(URLQueryItem(name: "period_start", value: ISO8601DateFormatter().string(from: periodStart)))
        }
        components?.queryItems = queryItems
        guard let url = components?.url else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        try await attachAuthorization(to: &request)
        let data = try await requestData(for: request)
        return try decoder.decode(CivicLeaderboardUserSummary.self, from: data)
    }

    private func attachAuthorization(to request: inout URLRequest) async throws {
        let token = try await currentAccessToken()
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }

    private func attachAuthorizationIfAvailable(to request: inout URLRequest) async {
        if let token = try? await currentAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func currentAccessToken() async throws -> String {
        // Ensure an anon session exists before requesting a bearer token.
        try? await SupabaseManager.shared.signInAnonymouslyIfNeeded()

        do {
            return try await SupabaseClientProvider.shared.client.auth.session.accessToken
        } catch {
            do {
                let refreshed = try await SupabaseClientProvider.shared.client.auth.refreshSession()
                return refreshed.accessToken
            } catch {
                throw NSError(
                    domain: "CivicIssueCallAPIClient",
                    code: 401,
                    userInfo: [NSLocalizedDescriptionKey: "Authentication required."]
                )
            }
        }
    }

    private func requestData(
        for request: URLRequest,
        timeout: TimeInterval? = nil,
        allowTimeoutRetry: Bool = true
    ) async throws -> Data {
        var firstAttempt = request
        if let timeout {
            firstAttempt.timeoutInterval = timeout
        } else if firstAttempt.timeoutInterval <= 0 {
            firstAttempt.timeoutInterval = requestTimeout
        }

        do {
            return try await performRequest(firstAttempt)
        } catch {
            // Retry once on timeout in case the backend is waking from cold start.
            if allowTimeoutRetry, let urlError = error as? URLError, urlError.code == .timedOut {
                var retryAttempt = request
                let baselineTimeout = timeout ?? requestTimeout
                retryAttempt.timeoutInterval = max(baselineTimeout, 75)
                do {
                    return try await performRequest(retryAttempt)
                } catch {
                    throw NSError(
                        domain: "CivicIssueCallAPIClient",
                        code: urlError.errorCode,
                        userInfo: [NSLocalizedDescriptionKey: "The civic API request timed out."]
                    )
                }
            }
            throw error
        }
    }

    private func performRequest(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard (200...299).contains(http.statusCode) else {
            let compactMessage = compactHTTPErrorMessage(statusCode: http.statusCode, responseData: data)
            throw NSError(domain: "CivicIssueCallAPIClient", code: http.statusCode, userInfo: [
                NSLocalizedDescriptionKey: compactMessage
            ])
        }
        return data
    }

    private func compactHTTPErrorMessage(statusCode: Int, responseData: Data) -> String {
        guard !responseData.isEmpty else {
            return "API request failed with status \(statusCode)"
        }

        let maxPreviewBytes = 2048
        let rawPreview = String(decoding: responseData.prefix(maxPreviewBytes), as: UTF8.self)
        var normalized = rawPreview.replacingOccurrences(
            of: "\\s+",
            with: " ",
            options: .regularExpression
        )
        normalized = normalized.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            return "API request failed with status \(statusCode)"
        }

        let lowerPreview = normalized.lowercased()
        if lowerPreview.contains("<!doctype html") || lowerPreview.contains("<html") {
            return "status \(statusCode): upstream HTML error page"
        }

        let maxPreviewChars = 240
        let snippet = String(normalized.prefix(maxPreviewChars))
        if normalized.count > maxPreviewChars || responseData.count > maxPreviewBytes {
            return "status \(statusCode): \(snippet)..."
        }
        return "status \(statusCode): \(snippet)"
    }

    private func endpoint(_ path: String) -> URL {
        baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
    }

    private static func resolveBaseURL(bundle: Bundle = .main) -> URL {
        if let configured = (bundle.object(forInfoDictionaryKey: "CIVIC_API_BASE_URL") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !configured.isEmpty,
           let url = URL(string: configured) {
            return url
        }

        if let supabaseURL = (bundle.object(forInfoDictionaryKey: "SUPABASE_URL") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !supabaseURL.isEmpty,
           let url = URL(string: supabaseURL) {
            return url
        }

        return URL(string: "https://YOUR-PROJECT-REF.supabase.co") ?? URL(fileURLWithPath: "/")
    }
}

final class CivicCallBriefCacheStore {
    private let defaults: UserDefaults
    private let key = "civic.issue_call.snapshot.v1"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let retentionDays = 90
    private let maxHistoryGroups = 24
    private let maxLogsPerGroup = 20
    private let maxConcernLength = 1200
    private let maxBillReferenceLength = 64

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        decoder.dateDecodingStrategy = .iso8601
        encoder.dateEncodingStrategy = .iso8601
    }

    func load() -> CivicLocalSnapshot {
        guard let data = defaults.data(forKey: key),
              let snapshot = try? decoder.decode(CivicLocalSnapshot.self, from: data) else {
            return CivicLocalSnapshot(latestResolution: nil, history: [], updatedAt: .distantPast)
        }
        let sanitized = sanitizedSnapshot(snapshot)
        if let encoded = try? encoder.encode(sanitized), encoded != data {
            defaults.set(encoded, forKey: key)
        }
        return sanitized
    }

    func save(_ snapshot: CivicLocalSnapshot) {
        let sanitized = sanitizedSnapshot(snapshot)
        guard let data = try? encoder.encode(sanitized) else { return }
        defaults.set(data, forKey: key)
    }

    func clear() {
        defaults.removeObject(forKey: key)
    }

    private func sanitizedSnapshot(_ snapshot: CivicLocalSnapshot) -> CivicLocalSnapshot {
        let cutoff = Date().addingTimeInterval(-TimeInterval(retentionDays * 24 * 60 * 60))
        let trimmedHistory = snapshot.history
            .filter { $0.date >= cutoff }
            .sorted(by: { $0.date > $1.date })
            .prefix(maxHistoryGroups)
            .map { sanitizeHistoryGroup($0) }

        let sanitizedDraft = snapshot.assistantDraft.map { draft in
            CivicAssistantDraft(
                selectedTab: draft.selectedTab,
                selectedRepFilter: draft.selectedRepFilter,
                concernText: String(draft.concernText.prefix(maxConcernLength)),
                selectedAsk: draft.selectedAsk,
                optionalBillRef: String(draft.optionalBillRef.prefix(maxBillReferenceLength)),
                activeBriefID: draft.activeBriefID
            )
        }

        return CivicLocalSnapshot(
            latestResolution: snapshot.latestResolution,
            history: Array(trimmedHistory),
            assistantDraft: sanitizedDraft,
            updatedAt: snapshot.updatedAt
        )
    }

    private func sanitizeHistoryGroup(_ group: CivicHistoryGroup) -> CivicHistoryGroup {
        let trimmedLogs = Array(group.logs.prefix(maxLogsPerGroup)).map { log in
            CivicCallLogRecord(
                id: log.id,
                createdAt: log.createdAt,
                repID: log.repID,
                repName: log.repName,
                issueID: log.issueID,
                issueTitle: log.issueTitle,
                briefID: log.briefID,
                outcome: log.outcome,
                stafferPosition: log.stafferPosition,
                notes: String((log.notes ?? "").prefix(500))
            )
        }

        return CivicHistoryGroup(
            id: group.id,
            issueID: group.issueID,
            issueTitle: group.issueTitle,
            issueSummary: group.issueSummary,
            date: group.date,
            briefs: group.briefs,
            logs: trimmedLogs
        )
    }
}

@MainActor
final class IssueCallCenterViewModel: ObservableObject {
    struct CivicCallStats: Sendable {
        let totalVoteNowCalls: Int
        let monthlyVoteNowCalls: Int
        let userCallCount: Int

        static let empty = CivicCallStats(
            totalVoteNowCalls: 0,
            monthlyVoteNowCalls: 0,
            userCallCount: 0
        )
    }

    struct CivicOutcomeBreakdown: Sendable {
        let contacted: Int
        let voicemail: Int
        let unavailable: Int

        static let empty = CivicOutcomeBreakdown(contacted: 0, voicemail: 0, unavailable: 0)
    }

    struct PendingCallLaunch: Sendable {
        let launchEventID: String
        let briefID: String
        let officeID: String
        let issueID: String?
        let launchedAt: Date
    }

    private struct ScriptChatTurnPayload: Codable, Sendable {
        let sessionID: String
        let packageID: String?
        let role: String
        let turnIndex: Int
        let messageText: String
        let messageType: String?
    }

    private struct PersistedScriptChatState: Codable, Sendable {
        let sessionID: String?
        let turnIndex: Int
        let pendingPayloads: [ScriptChatTurnPayload]
    }

    @Published var selectedTab: CivicIssueCallTab = .assistant
    @Published var selectedRepFilter: CivicRepFilter = .all
    @Published var concernText: String = ""
    @Published var selectedAsk: CivicAsk?
    @Published var optionalBillRef: String = ""
    @Published var isSubmitting = false
    @Published var errorMessage: String?

    @Published var issueTitle: String = ""
    @Published var issueSummary: String = ""
    @Published var resolvedEntities: CivicResolvedEntities = .empty
    @Published var callBriefs: [CivicCallBrief] = []
    @Published var examples: [CivicExampleIssueCard] = []
    @Published var historyGroups: [CivicHistoryGroup] = []
    @Published var activeBriefID: String?
    @Published var loggedOutcomeByBriefID: [String: CivicCallOutcome] = [:]
    @Published var callScoreSummary: CivicCallScoreSummary?
    @Published var callScoreBreakdown: CivicCallScoreBreakdown?
    @Published var callScoreHistory: [CivicCallScoreHistoryItem] = []
    @Published var leaderboardSummary: CivicLeaderboardUserSummary?
    @Published var callStats: CivicCallStats = .empty
    @Published var appWideCompletedCallsByIssueID: [String: Int] = [:]
    @Published var lastCompletionResult: CivicCallCompletionResponse?
    @Published var pendingCallLaunch: PendingCallLaunch?
    @Published var requiresDraftApproval = false
    @Published var mapcV3DisplayIssue: String = ""
    @Published var mapcV3AskOptions: [CivicMAPCV3PreparedOption] = []
    @Published var mapcV3SelectedOptionID: String?
    @Published var mapcV3SelectedDisplayAsk: String = ""
    @Published var mapcV3BackgroundText: String = ""
    @Published var mapcV3SessionState: String = "new"
    @Published var mapcV3NeedsClarification: Bool = false
    @Published var mapcV3ClarificationPrompt: String?
    @Published var mapcV3IntroShown: Bool = false
    @Published var mapcV3ClarificationTurnCount: Int = 0
    @Published var mapcV3MapcApproved: Bool = false
    @Published var mapcV3AccumulatedContext: [CivicMAPCV3ContextTurn] = []
    @Published var generationPath: String = "v3"
    @Published var fallbackReason: String?
    @Published var sessionResetReason: String?

    var outcomeBreakdown: CivicOutcomeBreakdown {
        var contacted = 0
        var voicemail = 0
        var unavailable = 0
        var seenLogIDs = Set<String>()

        for group in historyGroups {
            for log in group.logs {
                let logID = log.id.trimmingCharacters(in: .whitespacesAndNewlines)
                if !logID.isEmpty, !seenLogIDs.insert(logID).inserted {
                    continue
                }

                switch log.outcome {
                case .voicemail:
                    voicemail += 1
                case .unavailable:
                    unavailable += 1
                case .stafferReached, .supportive, .opposed, .undecided, .followUpRequested, .other:
                    contacted += 1
                }
            }
        }

        return CivicOutcomeBreakdown(
            contacted: contacted,
            voicemail: voicemail,
            unavailable: unavailable
        )
    }

    let repTargets: [CivicRepTarget]
    private let officialLookupByRepID: [String: Official]
    private let officialLookupByName: [String: Official]
    private let officialBySlot: [CivicRepSlot: Official]
    private let slotByRepID: [String: CivicRepSlot]
    private let slotByName: [String: CivicRepSlot]
    private let userZip: String
    private let apiClient: CivicIssueCallAPIClientProtocol
    private let cacheStore: CivicCallBriefCacheStore
    private let supabaseManager: SupabaseManager
    private let logger = Logger(subsystem: "VoteNow", category: "IssueCallCenter")
    private var deferredSnapshotTask: Task<Void, Never>?
    private var hasLoadedExamplesAndHistoryThisSession = false
    private var callScoreRefreshTask: Task<Void, Never>?
    private var lastCallScoreRefreshAt: Date = .distantPast
    private var lastCallScoreRefreshUserID: String?
    private let callScoreRefreshCooldown: TimeInterval = 8
    private var activeMAPCSessionID: UUID?
    private var pendingGeneratedResolution: CivicIssueResolutionResponse?
    private var lastGeneratedPackageID: String?
    private var scriptChatSessionID: UUID?
    private var scriptChatTurnIndex: Int = 0
    private var pendingScriptChatTurnPayloads: [ScriptChatTurnPayload] = []
    private var isFlushingScriptChatTurns = false
    private var hasLoggedScriptChatTelemetryFailure = false
    private var hasLoggedScriptFeedbackTelemetryFailure = false
    private let scriptChatStateDefaultsKey = "civic.issue_call.script_chat_state.v1"
    private let zipFallbackToken = "[ZIPCODE]"
    private let mapcPipelineV3FlagKey = "mapc_pipeline_v3_enabled"
    private let mapcV3RecoveryMessage = "I hit a snag, but I still have your issue. Pick a fix or restate the action you want."
    private let mapcV3LintRecoveryMessage = "I hit a snag, but I still have your issue. Pick a fix or restate the action you want."
    private let mapcGenerationPathV3 = "v3"
    private let mapcGenerationPathPremade = "premade"
    private let mapcGenerationPathOfflineNotice = "offline_notice"
    private let mapcGenerationPathBlockedLegacy = "blocked_legacy"
    private var mapcV3PendingSessionID: String?
    private var mapcV3PreserveSessionForNextSubmit = false

    init(
        federalReps: [Official],
        userZip: String,
        apiClient: CivicIssueCallAPIClientProtocol = CivicIssueCallAPIClient(),
        cacheStore: CivicCallBriefCacheStore = CivicCallBriefCacheStore(),
        supabaseManager: SupabaseManager? = nil
    ) {
        let targets = IssueCallCenterViewModel.buildRepTargets(from: federalReps)
        self.repTargets = targets
        self.officialLookupByRepID = Dictionary(
            uniqueKeysWithValues: targets.map { (stableRepID(for: $0.official), $0.official) }
        )
        self.officialLookupByName = Dictionary(
            uniqueKeysWithValues: targets.map { (IssueCallCenterViewModel.normalizeNameKey($0.official.name), $0.official) }
        )
        self.officialBySlot = Dictionary(
            uniqueKeysWithValues: targets.map { ($0.slot, $0.official) }
        )
        self.slotByRepID = Dictionary(
            uniqueKeysWithValues: targets.map { (stableRepID(for: $0.official), $0.slot) }
        )
        self.slotByName = Dictionary(
            uniqueKeysWithValues: targets.map { (IssueCallCenterViewModel.normalizeNameKey($0.official.name), $0.slot) }
        )
        self.userZip = userZip
        self.apiClient = apiClient
        self.cacheStore = cacheStore
        self.supabaseManager = supabaseManager ?? SupabaseManager.shared

        let snapshot = cacheStore.load()
        // Do not preload stale briefs into Assistant on open.
        // Offline access is preserved via History/reopen.
        historyGroups = snapshot.history.sorted(by: { $0.date > $1.date })
        // Keep Build Script composer blank on open (no auto-prefill from prior session).
        selectedTab = .assistant
        selectedRepFilter = .all
        restorePersistedScriptChatState()
        if !pendingScriptChatTurnPayloads.isEmpty {
            Task {
                await self.flushPendingScriptChatTurns()
            }
        }
    }

    private var resolvedUserZip: String {
        let normalized = String(userZip.filter(\.isNumber).prefix(5))
        return normalized.count == 5 ? normalized : zipFallbackToken
    }

    private var requestUserZip: String? {
        let normalized = String(userZip.filter(\.isNumber).prefix(5))
        return normalized.count == 5 ? normalized : nil
    }

    private var resolvedUserState: String? {
        if let requestUserZip,
           let stateFromZip = USZipStateResolver().stateCode(for: requestUserZip) {
            return stateFromZip
        }
        for target in repTargets {
            if let state = stateCodeFromDivisionID(target.official.divisionId) {
                return state
            }
        }
        return nil
    }

    var mapcPipelineV3Enabled: Bool {
        if let boolValue = UserDefaults.standard.object(forKey: mapcPipelineV3FlagKey) as? Bool {
            return boolValue
        }
        if let stringValue = UserDefaults.standard.string(forKey: mapcPipelineV3FlagKey) {
            let normalized = stringValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if ["1", "true", "yes", "on"].contains(normalized) { return true }
            if ["0", "false", "no", "off"].contains(normalized) { return false }
        }
        if let envValue = ProcessInfo.processInfo.environment[mapcPipelineV3FlagKey] {
            let normalized = envValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if ["1", "true", "yes", "on"].contains(normalized) { return true }
            if ["0", "false", "no", "off"].contains(normalized) { return false }
        }
        return true
    }

    var availableFilters: [CivicRepFilter] {
        var filters: [CivicRepFilter] = [.all]
        if repTargets.contains(where: { $0.slot == .house }) { filters.append(.house) }
        if repTargets.contains(where: { $0.slot == .senate1 }) { filters.append(.senate1) }
        if repTargets.contains(where: { $0.slot == .senate2 }) { filters.append(.senate2) }
        return filters
    }

    var filteredBriefs: [CivicCallBrief] {
        callBriefs
    }

    var orderedBriefs: [CivicCallBrief] {
        let briefs = filteredBriefs
        guard let activeBriefID else { return briefs }
        guard let index = briefs.firstIndex(where: { $0.id == activeBriefID }) else {
            return briefs
        }
        var reordered = briefs
        let active = reordered.remove(at: index)
        reordered.insert(active, at: 0)
        return reordered
    }

    var requestRepSlots: [CivicRepSlot] {
        return repTargets.map(\.slot)
    }

    var canSubmit: Bool {
        selectedAsk != nil && !concernText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !repTargets.isEmpty
    }

    var hasMAPCV3PreparedSelection: Bool {
        !mapcV3DisplayIssue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !mapcV3AskOptions.isEmpty
    }

    var shouldContinueMAPCV3Clarification: Bool {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        guard mapcPipelineV3Enabled else { return false }
        guard let pendingID = mapcV3PendingSessionID?.trimmingCharacters(in: .whitespacesAndNewlines),
              !pendingID.isEmpty else { return false }
        return mapcV3NeedsClarification
    }

    var hasScriptChatHistory: Bool {
        scriptChatTurnIndex > 0 || !pendingScriptChatTurnPayloads.isEmpty
    }

    var mapcTransportNotice: String {
        mapcV3RecoveryMessage
    }

    // Supabase is the source of truth for premade scripts.
    func fetchPublishedPremadeScripts() async throws -> [RemotePremadeScript] {
        try? await supabaseManager.signInAnonymouslyIfNeeded()

        #if canImport(Supabase)
        let response = try await SupabaseClientProvider.shared.client
            .from("civic_example_templates")
            .select("""
                slug,
                title,
                category,
                issue_area,
                summary,
                background_summary,
                action_sentence,
                live_script,
                voicemail_script,
                vehicle_label,
                status,
                display_order,
                target_chambers,
                primary_ask,
                template_asks,
                related_bills,
                tags,
                updated_at
            """)
            .eq("status", value: "published")
            .order("display_order", ascending: true)
            .order("updated_at", ascending: false)
            .execute()

        return try JSONDecoder().decode([RemotePremadeScript].self, from: response.data)
        #else
        struct SupabaseUnavailableError: LocalizedError {
            var errorDescription: String? { "Supabase SDK is unavailable." }
        }
        throw SupabaseUnavailableError()
        #endif
    }

    // Loading remains non-fatal: network failures resolve to an empty data set, and UI
    // can use its existing loading/error/empty states.
    func loadPremadeScripts() async -> [RemotePremadeScript] {
        do {
            return try await fetchPublishedPremadeScripts()
        } catch {
            logger.error("Failed loading published premade scripts: \(String(describing: error), privacy: .public)")
            return []
        }
    }

    func loadExamplesAndHistory() async {
        let userID = await userIDForRequest()

        async let remotePremadeScriptsTask: [RemotePremadeScript] = loadPremadeScripts()
        async let historyTask: [CivicHistoryGroup] = apiClient.fetchHistory(userID: userID)

        let remotePremadeScripts = await remotePremadeScriptsTask
        let mappedRemoteExamples = mapRemoteScriptsToExampleCards(remotePremadeScripts)
        examples = mappedRemoteExamples

        do {
            historyGroups = try await historyTask
            saveSnapshot()
        } catch {
            // Keep local snapshot history as offline fallback.
        }

        await refreshCallScoreData(for: userID)
    }

    func loadExamplesAndHistoryIfNeeded(force: Bool = false) async {
        guard force || !hasLoadedExamplesAndHistoryThisSession else { return }
        hasLoadedExamplesAndHistoryThisSession = true
        await loadExamplesAndHistory()
    }

    private func mapRemoteScriptsToExampleCards(
        _ scripts: [RemotePremadeScript]
    ) -> [CivicExampleIssueCard] {
        let availableChambers = availablePremadeTargetChambers()
        let placeholders = [
            "[YOUR_NAME]",
            "[CITY]",
            "[ZIP]",
            "[OFFICIAL_TITLE]",
            "[OFFICIAL_LAST]",
            "[BILL_OR_RESOLUTION]"
        ]
        let availableChamberSet = Set(availableChambers)

        let cards = scripts.compactMap { script -> CivicExampleIssueCard? in
            guard let key = normalizedPremadeKey(script.slug) else { return nil }

            let title = normalizedNonEmpty(script.title)
                ?? key.replacingOccurrences(of: "-", with: " ").capitalized
            let actionSentence = normalizedSentence(script.actionSentence)
            let summary = normalizedNonEmpty(script.backgroundSummary)
                ?? normalizedNonEmpty(script.summary)
                ?? actionSentence
                ?? "Call your representatives about this issue."
            let rawLiveScript = normalizedNonEmpty(script.liveScript)
                ?? generatedFallbackScript(title: title, actionSentence: actionSentence, isVoicemail: false)
            let rawVoicemailScript = normalizedNonEmpty(script.voicemailScript)
                ?? generatedFallbackScript(title: title, actionSentence: actionSentence, isVoicemail: true)
            let liveScript = normalizedPremadeScriptWithCanonicalIntro(
                rawLiveScript,
                isVoicemail: false
            )
            let voicemailScript = normalizedPremadeScriptWithCanonicalIntro(
                rawVoicemailScript,
                isVoicemail: true
            )
            var targetChambers = (script.targetChambers ?? [])
                .compactMap { normalizedNonEmpty($0)?.lowercased() }
            if targetChambers.isEmpty {
                targetChambers = availableChambers
            }

            let chamberIntersection = Set(targetChambers).intersection(availableChamberSet)
            guard !chamberIntersection.isEmpty else { return nil }

            let askFromPrimary = civicAsk(from: script.primaryAsk)
            let templateAsks = (script.templateAsks ?? []).compactMap { civicAsk(from: $0) }
            let resolvedTemplateAsks = templateAsks.isEmpty
                ? (askFromPrimary.map { [$0] } ?? [.support])
                : templateAsks
            let relatedBills = (script.relatedBills ?? []).compactMap { normalizedNonEmpty($0) }
            let vehicleLabel = normalizedNonEmpty(script.vehicleLabel)
                ?? relatedBills.first.flatMap { normalizedBillReference($0) }
            let tags = (script.tags ?? []).compactMap { normalizedNonEmpty($0) }

            return CivicExampleIssueCard(
                id: key,
                slug: key,
                title: title,
                category: normalizedNonEmpty(script.issueArea)
                    ?? normalizedNonEmpty(script.category)
                    ?? "Issue",
                targetChambers: targetChambers,
                primaryAsk: normalizedNonEmpty(script.primaryAsk) ?? askFromPrimary?.rawValue,
                summary: summary,
                vehicleLabel: vehicleLabel,
                actionSentence: actionSentence,
                relatedBills: relatedBills,
                repRelevance: repRelevanceLines(for: targetChambers),
                templateAsks: resolvedTemplateAsks,
                liveScript: liveScript,
                voicemailScript: voicemailScript,
                supporterVariant: nil,
                undecidedVariant: nil,
                stafferVariant: nil,
                voicemailFooter: nil,
                placeholders: placeholders,
                tags: tags,
                updatedAt: parseRemotePremadeTimestamp(script.updatedAt)
            )
        }

        return cards
    }

    private func normalizedPremadeKey(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else { return nil }
        return trimmed.lowercased()
    }

    private func availablePremadeTargetChambers() -> [String] {
        var chambers: [String] = []
        if repTargets.contains(where: { $0.slot == .house }) {
            chambers.append("house")
        }
        if repTargets.contains(where: { $0.slot == .senate1 || $0.slot == .senate2 }) {
            chambers.append("senate")
        }
        return chambers.isEmpty ? ["house", "senate"] : chambers
    }

    private func repRelevanceLines(for targetChambers: [String]) -> [String] {
        var lines: [String] = []
        let chamberSet = Set(targetChambers)
        if chamberSet == Set(["senate"]) {
            lines.append("This issue is currently targeted to the Senate.")
        } else if chamberSet == Set(["house"]) {
            lines.append("This issue is currently targeted to the House.")
        } else {
            lines.append("This issue can be raised with both House and Senate offices.")
        }

        lines += repTargets
            .filter { target in
                if targetChambers.contains("house"), target.slot == .house { return true }
                if targetChambers.contains("senate"), target.slot == .senate1 || target.slot == .senate2 { return true }
                return false
            }
            .prefix(3)
            .map { "\($0.official.name) serves in \($0.officeType)." }

        return lines
    }

    private func civicAsk(from rawAsk: String?) -> CivicAsk? {
        guard let normalized = normalizedNonEmpty(rawAsk)?.lowercased() else { return nil }
        switch normalized {
        case "support": return .support
        case "oppose": return .oppose
            case "cosponsor": return .cosponsor
        case "vote_yes", "vote-yes", "vote yes": return .voteYes
        case "vote_no", "vote-no", "vote no": return .voteNo
        case "seek_oversight", "seek-oversight", "seek oversight": return .seekOversight
        case "ask_public_statement", "ask-public-statement", "ask public statement": return .askPublicStatement
        case "ask_amendment", "ask-amendment", "ask amendment": return .askAmendment
        default:
            return CivicAsk(rawValue: normalized)
        }
    }

    private func generatedFallbackScript(title: String, actionSentence: String?, isVoicemail: Bool) -> String {
        let actionLine = actionSentence ?? "take clear public action on this issue."
        if isVoicemail {
            return """
            Hi, this is [YOUR_NAME] from [CITY], [ZIP].

            I'm calling about \(title).

            Please ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to \(actionLine)

            Thank you.
            """
        }

        return """
        Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].

        I'm calling about \(title).

        Please ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to \(actionLine)

        Thank you for your time and consideration.
        """
    }

    private func normalizedPremadeScriptWithCanonicalIntro(_ script: String, isVoicemail: Bool) -> String {
        let intro = isVoicemail
            ? "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP]."
            : "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP]."

        let body = strippedLeadingPremadeIntroSentences(from: script)
        guard !body.isEmpty else { return intro }
        return "\(intro)\n\n\(body)"
    }

    private func strippedLeadingPremadeIntroSentences(from script: String) -> String {
        let introPattern = #"""
        ^\s*(?:hi|hello)[^.!?]{0,220}\b(?:my\s+name\s+is|this\s+is)\b[^.!?]*(?:\[(?:your_name|your name)\]|\bconstituent\b|\[(?:city|zip|your city/state)\])[^.!?]*[.!?]\s*
        """#
        var remaining = script
            .replacingOccurrences(of: "\r\n", with: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        for _ in 0..<4 {
            let updated = remaining.replacingOccurrences(
                of: introPattern,
                with: "",
                options: [.regularExpression, .caseInsensitive]
            )
            if updated == remaining {
                break
            }
            remaining = updated.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        return remaining
    }

    private func normalizedSentence(_ value: String?) -> String? {
        guard let value = normalizedNonEmpty(value) else { return nil }
        if value.hasSuffix(".") || value.hasSuffix("!") || value.hasSuffix("?") {
            return value
        }
        return "\(value)."
    }

    private func normalizedNonEmpty(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else { return nil }
        return trimmed
    }

    private func parseRemotePremadeTimestamp(_ value: String?) -> Date? {
        guard let value = normalizedNonEmpty(value) else { return nil }
        return Self.iso8601WithFractional.date(from: value) ?? Self.iso8601Basic.date(from: value)
    }

    private static let iso8601WithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601Basic: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    func submitAssistantRequest() async {
        errorMessage = nil
        guard selectedAsk != nil else {
            errorMessage = "Select an explicit ask before generating call briefs."
            return
        }
        guard canSubmit else {
            errorMessage = "Enter your concern and keep at least one representative selected."
            return
        }

        isSubmitting = true
        defer { isSubmitting = false }

        let trimmedConcern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        let userID = await userIDForRequest()
        if mapcPipelineV3Enabled && shouldContinueMAPCV3Clarification {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            prepareForMAPCV3ClarificationFollowUp()
        } else {
            prepareForFreshGeneration()
        }
        guard mapcPipelineV3Enabled else {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            pendingGeneratedResolution = nil
            lastGeneratedPackageID = nil
            requiresDraftApproval = false
            recordMAPCGenerationTelemetry(
                path: mapcGenerationPathBlockedLegacy,
                fallbackReason: "v3_disabled",
                sessionResetReason: nil
            )
            errorMessage = mapcV3RecoveryMessage
            logger.notice("Blocked legacy free-text generation because MAPC v3 is disabled.")
            return
        }

        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        await submitAssistantRequestV3(
            userID: userID,
            concernText: trimmedConcern
        )
    }

    private func submitAssistantRequestV3(
        userID: String,
        concernText: String
    ) async {
        let isClarificationFollowUp = shouldContinueMAPCV3Clarification
        let preserveSessionForTurn = mapcV3PreserveSessionForNextSubmit
        mapcV3PreserveSessionForNextSubmit = false
        if !isClarificationFollowUp && !preserveSessionForTurn {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            mapcV3PendingSessionID = nil
            mapcV3SessionState = "new"
            mapcV3NeedsClarification = false
            mapcV3ClarificationPrompt = nil
            mapcV3ClarificationTurnCount = 0
            mapcV3MapcApproved = false
            mapcV3AccumulatedContext = []
        }
        mapcV3DisplayIssue = ""
        mapcV3AskOptions = []
        mapcV3SelectedOptionID = nil
        mapcV3SelectedDisplayAsk = ""
        mapcV3BackgroundText = ""
        pendingGeneratedResolution = nil
        lastGeneratedPackageID = nil
        requiresDraftApproval = false

        do {
            let prepared = try await apiClient.prepareMAPCV3Selection(
                userID: userID,
                sessionID: mapcV3PendingSessionID,
                sessionState: mapcV3SessionState,
                concernText: concernText,
                accumulatedContext: mapcV3AccumulatedContext,
                clarificationTurnCount: mapcV3ClarificationTurnCount,
                introShown: mapcV3IntroShown,
                mapcApproved: mapcV3MapcApproved,
                userZip: requestUserZip
            )

            mapcV3PendingSessionID = prepared.sessionID
            mapcV3SessionState = prepared.session.sessionState
            mapcV3NeedsClarification = prepared.session.needsClarification
            mapcV3ClarificationPrompt = prepared.session.clarificationPrompt
            mapcV3ClarificationTurnCount = max(0, prepared.session.clarificationTurnCount)
            mapcV3MapcApproved = prepared.session.mapcApproved
            mapcV3AccumulatedContext = prepared.session.accumulatedContext
            mapcV3IntroShown = mapcV3IntroShown || prepared.session.introShown
            mapcV3DisplayIssue = prepared.displayIssue
            mapcV3AskOptions = prepared.options
            mapcV3SelectedOptionID = nil
            mapcV3SelectedDisplayAsk = ""

            if prepared.needsClarification {
                recordMAPCGenerationTelemetry(
                    path: mapcGenerationPathV3,
                    fallbackReason: nil,
                    sessionResetReason: nil
                )
                errorMessage = prepared.clarificationPrompt ?? "I need one detail to make this usable: what issue do you care about most?"
                return
            }
            if prepared.options.isEmpty {
                recordMAPCGenerationTelemetry(
                    path: mapcGenerationPathOfflineNotice,
                    fallbackReason: "stage2_no_options",
                    sessionResetReason: nil
                )
                errorMessage = "I hit a snag, but I still have your issue. Pick a fix or restate the action you want."
                return
            }

            mapcV3NeedsClarification = false
            mapcV3ClarificationPrompt = nil
            recordMAPCGenerationTelemetry(
                path: mapcGenerationPathV3,
                fallbackReason: nil,
                sessionResetReason: nil
            )
            errorMessage = nil
            selectedTab = .assistant
        } catch {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            let failureMessage = resolveMAPCV3FailureMessage(for: error)
            errorMessage = failureMessage
            pendingGeneratedResolution = nil
            requiresDraftApproval = false
            recordMAPCGenerationTelemetry(
                path: mapcGenerationPathOfflineNotice,
                fallbackReason: compactLogError(error),
                sessionResetReason: nil
            )
            logger.error("MAPC v3 Stage 1/2 failed: \(self.compactLogError(error), privacy: .public)")
        }
    }

    func selectMAPCV3Option(optionID: String) {
        let trimmed = optionID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard let option = mapcV3AskOptions.first(where: { $0.optionID == trimmed }) else { return }
        mapcV3SelectedOptionID = option.optionID
        mapcV3SelectedDisplayAsk = option.displayAsk
        mapcV3SessionState = "ask_selected"
    }

    func clearMAPCV3OptionSelection() {
        mapcV3SelectedOptionID = nil
        mapcV3SelectedDisplayAsk = ""
    }

    func generateMAPCV3ScriptAfterPreviewConfirmation() async {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        // New flow order: this can be invoked immediately after ask selection to build preview content.
        guard mapcPipelineV3Enabled else { return }
        guard let selectedOptionID = mapcV3SelectedOptionID,
              let sessionID = mapcV3PendingSessionID else {
            errorMessage = "Pick one ask option before confirming preview."
            return
        }
        let selectedOption = mapcV3AskOptions.first(where: { $0.optionID == selectedOptionID })
        let resolvedAsk = civicAsk(from: selectedOption?.askType) ?? selectedAsk ?? .support
        selectedAsk = resolvedAsk

        isSubmitting = true
        defer { isSubmitting = false }

        let trimmedConcern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedBill = optionalBillRef.trimmingCharacters(in: .whitespacesAndNewlines)
        let userID = await userIDForRequest()
        mapcV3SessionState = "ask_selected"
        mapcV3MapcApproved = false

        do {
            let package = try await apiClient.generateMAPCV3ScriptFromSelection(
                userID: userID,
                concernText: trimmedConcern,
                sessionID: sessionID,
                selectedOptionID: selectedOptionID,
                targetReps: requestRepSlots,
                repTargets: repTargets,
                optionalBillRef: trimmedBill.isEmpty ? nil : trimmedBill,
                userState: resolvedUserState
            )

            switch package.status {
            case .ok:
                let response = resolutionFromScriptPackage(
                    package,
                    concernText: trimmedConcern,
                    ask: resolvedAsk,
                    selectedSlots: requestRepSlots,
                    optionalBillRef: trimmedBill.isEmpty ? nil : trimmedBill
                )
                let validation = generatedResolutionValidation(
                    response,
                    concernText: trimmedConcern,
                    ask: resolvedAsk,
                    optionalBillRef: trimmedBill.isEmpty ? nil : trimmedBill
                )
                if validation.shouldFallback {
                    // mapc_pipeline_v3 — remove flag check after rollout confirmed
                    pendingGeneratedResolution = nil
                    lastGeneratedPackageID = nil
                    requiresDraftApproval = false
                    mapcV3SessionState = "preview_shown"
                    mapcV3NeedsClarification = false
                    mapcV3ClarificationPrompt = nil
                    mapcV3MapcApproved = false
                    mapcV3BackgroundText = package.canonicalContext?.summaryPlain ?? ""
                    errorMessage = mapcV3RecoveryMessage
                    recordMAPCGenerationTelemetry(
                        path: mapcGenerationPathBlockedLegacy,
                        fallbackReason: "v3_validation_blocked_legacy_fallback",
                        sessionResetReason: nil
                    )
                    logger.warning("Blocked legacy fallback script from MAPC v3 preview handoff.")
                    return
                }
                let finalResponse = validation.sanitized
                errorMessage = nil
                applyResolution(finalResponse)
                pendingGeneratedResolution = finalResponse
                lastGeneratedPackageID = package.packageID
                requiresDraftApproval = true
                // Preview is now shown before final "Looks right" confirmation.
                mapcV3SessionState = "preview_shown"
                mapcV3NeedsClarification = false
                mapcV3ClarificationPrompt = nil
                mapcV3MapcApproved = false
                mapcV3BackgroundText = package.canonicalContext?.summaryPlain ?? ""
                mapcV3AskOptions = []
                recordMAPCGenerationTelemetry(
                    path: mapcGenerationPathV3,
                    fallbackReason: nil,
                    sessionResetReason: nil
                )
                saveSnapshot()
                selectedRepFilter = .all
                selectedTab = .assistant
                Task { [userID] in
                    await self.refreshCallScoreData(for: userID)
                }
            case .needsClarification:
                pendingGeneratedResolution = nil
                lastGeneratedPackageID = nil
                requiresDraftApproval = false
                mapcV3SessionState = "issue_received"
                mapcV3NeedsClarification = true
                let hint = package.reviewRegenerateHint.trimmingCharacters(in: .whitespacesAndNewlines)
                if hint.isEmpty {
                    errorMessage = "I need one detail to make this usable: what issue do you care about most?"
                    mapcV3ClarificationPrompt = "I need one detail to make this usable: what issue do you care about most?"
                } else {
                    errorMessage = hint
                    mapcV3ClarificationPrompt = hint
                }
                recordMAPCGenerationTelemetry(
                    path: mapcGenerationPathV3,
                    fallbackReason: "stage3_needs_clarification",
                    sessionResetReason: nil
                )
            case .refused:
                pendingGeneratedResolution = nil
                lastGeneratedPackageID = nil
                requiresDraftApproval = false
                mapcV3SessionState = "issue_received"
                errorMessage = package.truthTrace?.refusalReason ?? package.reviewRegenerateHint
                recordMAPCGenerationTelemetry(
                    path: mapcGenerationPathV3,
                    fallbackReason: "stage4_refused",
                    sessionResetReason: nil
                )
            }
        } catch {
            pendingGeneratedResolution = nil
            lastGeneratedPackageID = nil
            requiresDraftApproval = false
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            let failureMessage = resolveMAPCV3FailureMessage(for: error)
            errorMessage = failureMessage
            recordMAPCGenerationTelemetry(
                path: mapcGenerationPathOfflineNotice,
                fallbackReason: compactLogError(error),
                sessionResetReason: nil
            )
            logger.error("MAPC v3 Stage 3/4 failed: \(self.compactLogError(error), privacy: .public)")
        }
    }

    private func isMAPCV3TransportFailure(_ error: Error) -> Bool {
        if error is URLError { return true }
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain { return true }
        if nsError.domain == NSCocoaErrorDomain && (nsError.code == 4865 || nsError.code == 3840) {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            // Upstream returned empty/invalid JSON payload; treat as recoverable transport-style failure.
            return true
        }
        return nsError.domain == "CivicIssueCallAPIClient" && nsError.code == 502
    }

    private func resolveMAPCV3FailureMessage(for error: Error) -> String {
        if isMAPCV3TransportFailure(error) {
            return mapcV3RecoveryMessage
        }
        let nsError = error as NSError
        let lowered = nsError.localizedDescription.lowercased()
        if nsError.domain == "CivicIssueCallAPIClient" && nsError.code == 404 {
            return "MAPC v3 API route is unavailable. Confirm /api/v2/civic/mapc endpoints are deployed."
        }
        if nsError.domain == "CivicIssueCallAPIClient" && nsError.code == 401 {
            return "Session expired. Please reopen VoteNow and try again."
        }
        if lowered.contains("feature_flag_disabled") {
            return "MAPC v3 is disabled on the backend."
        }
        if lowered.contains("placeholder_leak") || lowered.contains("disallowed token remained") {
            return "I kept your issue, but the script had an unfilled placeholder. Tap Fix this and I’ll regenerate it."
        }
        if lowered.contains("missing_selected_option") || lowered.contains("invalid_selected_option") {
            return "I kept your issue, but the selected ask did not sync. Tap an ask option again."
        }
        if lowered.contains("invalid_initial_state") || lowered.contains("invalid_state_transition") {
            return "I kept your issue, but the session got out of sync. Tap an ask option again."
        }
        if lowered.contains("preview_not_confirmed") {
            return "Please confirm the preview before generating the script."
        }
        if lowered.contains("universal_script_lint_failed") {
            return mapcV3LintRecoveryMessage
        }
        if nsError.domain == "CivicIssueCallAPIClient" && nsError.code == 400 {
            return "I kept your issue, but this request did not sync. Tap your ask option again."
        }
        if nsError.domain == "CivicIssueCallAPIClient"
            && [-31_006, -31_007].contains(nsError.code) {
            return mapcV3RecoveryMessage
        }
        return mapcV3RecoveryMessage
    }

    private func recordMAPCGenerationTelemetry(
        path: String? = nil,
        fallbackReason fallbackReasonValue: String? = nil,
        sessionResetReason sessionResetReasonValue: String? = nil
    ) {
        if let path {
            generationPath = path
        }
        fallbackReason = fallbackReasonValue
        sessionResetReason = sessionResetReasonValue
        logger.notice(
            "MAPC generation telemetry path=\(self.generationPath, privacy: .public) fallback_reason=\((self.fallbackReason ?? "none"), privacy: .public) session_reset_reason=\((self.sessionResetReason ?? "none"), privacy: .public)"
        )
    }

    func blockLegacyPreviewAtHandoff(reason: String) {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        clearDisplayedDraftBeforeNewGeneration()
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        recordMAPCGenerationTelemetry(
            path: mapcGenerationPathBlockedLegacy,
            fallbackReason: reason,
            sessionResetReason: nil
        )
    }

    private func clearDisplayedDraftBeforeNewGeneration() {
        issueTitle = ""
        issueSummary = ""
        resolvedEntities = .empty
        callBriefs = []
        activeBriefID = nil
        loggedOutcomeByBriefID = [:]
        pendingCallLaunch = nil
        lastCompletionResult = nil
        lastGeneratedPackageID = nil
    }

    private func resetMAPCV3SelectionState() {
        mapcV3PendingSessionID = nil
        mapcV3DisplayIssue = ""
        mapcV3AskOptions = []
        mapcV3SelectedOptionID = nil
        mapcV3SelectedDisplayAsk = ""
        mapcV3BackgroundText = ""
        mapcV3SessionState = "new"
        mapcV3NeedsClarification = false
        mapcV3ClarificationPrompt = nil
        mapcV3ClarificationTurnCount = 0
        mapcV3MapcApproved = false
        mapcV3AccumulatedContext = []
    }

    func prepareForMAPCV3ClarificationFollowUp() {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        mapcV3PreserveSessionForNextSubmit = true
        clearDisplayedDraftBeforeNewGeneration()
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        activeMAPCSessionID = nil
        selectedRepFilter = .all
        mapcV3DisplayIssue = ""
        mapcV3AskOptions = []
        mapcV3SelectedOptionID = nil
        mapcV3SelectedDisplayAsk = ""
        mapcV3BackgroundText = ""
        recordMAPCGenerationTelemetry(
            path: mapcGenerationPathV3,
            fallbackReason: nil,
            sessionResetReason: "clarification_follow_up"
        )
    }

    func prepareForMAPCV3RevisionFollowUp() {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        mapcV3PreserveSessionForNextSubmit = true
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        // Backend Stage 1 accepts new/issue_received/revising. Revision turns must not reuse script_shown.
        mapcV3SessionState = "revising"
        clearDisplayedDraftBeforeNewGeneration()
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        activeMAPCSessionID = nil
        selectedRepFilter = .all
        mapcV3DisplayIssue = ""
        mapcV3AskOptions = []
        mapcV3SelectedOptionID = nil
        mapcV3SelectedDisplayAsk = ""
        mapcV3BackgroundText = ""
        recordMAPCGenerationTelemetry(
            path: mapcGenerationPathV3,
            fallbackReason: nil,
            sessionResetReason: "revision_follow_up"
        )
    }

    func markMAPCV3IntroShown() {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        mapcV3IntroShown = true
    }

    func markMAPCV3ApprovedByUser() {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        mapcV3MapcApproved = true
    }

    func prepareForFreshGeneration() {
        mapcV3PreserveSessionForNextSubmit = false
        clearDisplayedDraftBeforeNewGeneration()
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        activeMAPCSessionID = nil
        selectedRepFilter = .all
        resetMAPCV3SelectionState()
        recordMAPCGenerationTelemetry(
            path: mapcGenerationPathV3,
            fallbackReason: nil,
            sessionResetReason: "fresh_generation"
        )
    }

    func startOverMAPCV3Session() {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        mapcV3PreserveSessionForNextSubmit = false
        clearDisplayedDraftBeforeNewGeneration()
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        activeMAPCSessionID = nil
        selectedRepFilter = .all
        resetMAPCV3SelectionState()
        recordMAPCGenerationTelemetry(
            path: mapcGenerationPathV3,
            fallbackReason: nil,
            sessionResetReason: "start_over"
        )
    }

    func logScriptChatTurn(role: String, messageText: String, messageType: String?) {
        let normalizedRole = role.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard normalizedRole == "user" || normalizedRole == "assistant" else { return }
        let normalizedText = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedText.isEmpty else { return }

        let sessionID = ensureScriptChatSessionID().uuidString
        scriptChatTurnIndex += 1
        let turnIndex = scriptChatTurnIndex
        let packageID = lastGeneratedPackageID
        let normalizedType = messageType?.trimmingCharacters(in: .whitespacesAndNewlines)
        pendingScriptChatTurnPayloads.append(
            ScriptChatTurnPayload(
                sessionID: sessionID,
                packageID: packageID,
                role: normalizedRole,
                turnIndex: turnIndex,
                messageText: normalizedText,
                messageType: (normalizedType?.isEmpty == false) ? normalizedType : nil
            )
        )
        persistScriptChatState()

        Task {
            await self.flushPendingScriptChatTurns()
        }
    }

    func resetScriptChatSession() {
        scriptChatSessionID = nil
        scriptChatTurnIndex = 0
        persistScriptChatState()
    }

    private func flushPendingScriptChatTurns() async {
        guard !isFlushingScriptChatTurns else { return }
        isFlushingScriptChatTurns = true
        defer { isFlushingScriptChatTurns = false }

        while !pendingScriptChatTurnPayloads.isEmpty {
            let payload = pendingScriptChatTurnPayloads[0]
            let userID = await userIDForRequest()
            do {
                try await apiClient.logScriptChatTurn(
                    userID: userID,
                    sessionID: payload.sessionID,
                    packageID: payload.packageID,
                    role: payload.role,
                    turnIndex: payload.turnIndex,
                    messageText: payload.messageText,
                    messageType: payload.messageType
                )
                pendingScriptChatTurnPayloads.removeFirst()
                persistScriptChatState()
            } catch {
                if !self.hasLoggedScriptChatTelemetryFailure {
                    self.hasLoggedScriptChatTelemetryFailure = true
                    self.logger.notice(
                        "Script chat telemetry unavailable; retrying silently. \(self.compactLogError(error), privacy: .public)"
                    )
                }
                Task { [weak self] in
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                    guard let self else { return }
                    await self.flushPendingScriptChatTurns()
                }
                break
            }
        }
    }

    private func restorePersistedScriptChatState() {
        guard let data = UserDefaults.standard.data(forKey: scriptChatStateDefaultsKey) else { return }
        guard let state = try? JSONDecoder().decode(PersistedScriptChatState.self, from: data) else {
            UserDefaults.standard.removeObject(forKey: scriptChatStateDefaultsKey)
            return
        }

        if let sessionID = state.sessionID, let parsedSessionID = UUID(uuidString: sessionID) {
            scriptChatSessionID = parsedSessionID
        } else {
            scriptChatSessionID = nil
        }
        scriptChatTurnIndex = max(state.turnIndex, 0)
        pendingScriptChatTurnPayloads = state.pendingPayloads
    }

    private func persistScriptChatState() {
        let state = PersistedScriptChatState(
            sessionID: scriptChatSessionID?.uuidString,
            turnIndex: scriptChatTurnIndex,
            pendingPayloads: pendingScriptChatTurnPayloads
        )

        if scriptChatSessionID == nil && scriptChatTurnIndex == 0 && pendingScriptChatTurnPayloads.isEmpty {
            UserDefaults.standard.removeObject(forKey: scriptChatStateDefaultsKey)
            return
        }

        guard let data = try? JSONEncoder().encode(state) else { return }
        UserDefaults.standard.set(data, forKey: scriptChatStateDefaultsKey)
    }

    func approveGeneratedDraft() {
        if mapcPipelineV3Enabled && mapcV3SessionState != "script_shown" {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            errorMessage = "Review the script preview first, then tap Looks right before approving."
            return
        }
        let packageID = lastGeneratedPackageID
        let chosenOption = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalScript = pendingGeneratedResolution?.callBriefs.first?.liveScript
        if let pendingGeneratedResolution {
            appendHistory(for: pendingGeneratedResolution)
        }
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        lastGeneratedPackageID = nil
        resetMAPCV3SelectionState()
        saveSnapshot()

        if let packageID, !packageID.isEmpty {
            Task { [apiClient] in
                let userID = await self.userIDForRequest()
                do {
                    try await apiClient.logScriptFeedback(
                        userID: userID,
                        packageID: packageID,
                        decision: "accurate",
                        chosenOption: chosenOption.isEmpty ? nil : chosenOption,
                        finalScript: finalScript
                    )
                } catch {
                    if !self.hasLoggedScriptFeedbackTelemetryFailure {
                        self.hasLoggedScriptFeedbackTelemetryFailure = true
                        self.logger.notice(
                            "Script feedback telemetry unavailable; continuing. \(self.compactLogError(error), privacy: .public)"
                        )
                    }
                }
            }
        }
    }

    func reviseGeneratedDraft() {
        let packageID = lastGeneratedPackageID
        let chosenOption = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalScript = pendingGeneratedResolution?.callBriefs.first?.liveScript
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        lastGeneratedPackageID = nil
        resetMAPCV3SelectionState()
        issueTitle = ""
        issueSummary = ""
        resolvedEntities = .empty
        callBriefs = []
        activeBriefID = nil
        selectedTab = .assistant
        recordMAPCGenerationTelemetry(
            path: mapcGenerationPathV3,
            fallbackReason: nil,
            sessionResetReason: "user_revise"
        )
        saveSnapshot()

        if let packageID, !packageID.isEmpty {
            Task { [apiClient] in
                let userID = await self.userIDForRequest()
                do {
                    try await apiClient.logScriptFeedback(
                        userID: userID,
                        packageID: packageID,
                        decision: "revise",
                        chosenOption: chosenOption.isEmpty ? nil : chosenOption,
                        finalScript: finalScript
                    )
                } catch {
                    if !self.hasLoggedScriptFeedbackTelemetryFailure {
                        self.hasLoggedScriptFeedbackTelemetryFailure = true
                        self.logger.notice(
                            "Script feedback telemetry unavailable; continuing. \(self.compactLogError(error), privacy: .public)"
                        )
                    }
                }
            }
        }
    }

    func startMAPC(from example: CivicExampleIssueCard) {
        // Premade selection should open MAPC directly without overriding
        // the user's Build Script personalization draft fields.
        // Also clear any stale composer inputs so Build Script remains blank
        // when the user returns from MAPC.
        activeMAPCSessionID = UUID()
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        concernText = ""
        selectedAsk = nil
        optionalBillRef = ""
        applySeedResolution(for: example)
        recordMAPCGenerationTelemetry(
            path: mapcGenerationPathPremade,
            fallbackReason: nil,
            sessionResetReason: nil
        )

        queueMAPCCallEvent(
            type: .mapcStarted,
            brief: activeBrief,
            issueID: seededIssueID(for: example),
            issueTitle: example.title,
            sourceScreen: "issue_call_center",
            metadata: [
                "example_id": example.id,
                "example_category": example.category ?? "",
                "target_chambers": example.targetChambers.joined(separator: ",")
            ]
        )
    }

    func reopen(historyGroup: CivicHistoryGroup) {
        issueTitle = historyGroup.issueTitle
        issueSummary = historyGroup.issueSummary
        let fallbackIssueID = resolvedIssueIdentifier(
            preferredIssueID: historyGroup.issueID,
            issueTitle: historyGroup.issueTitle,
            issueSummary: historyGroup.issueSummary
        )
        let reopenedBriefs = normalizedBriefs(
            historyGroup.briefs,
            fallbackIssueID: fallbackIssueID,
            regenerateIDs: true
        )
        callBriefs = reopenedBriefs
        let reopenedBriefIDs = Set(reopenedBriefs.map(\.id))
        loggedOutcomeByBriefID = loggedOutcomeByBriefID.filter { reopenedBriefIDs.contains($0.key) }
        pendingCallLaunch = nil
        lastCompletionResult = nil
        activeMAPCSessionID = nil
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        resolvedEntities = .empty
        activeBriefID = filteredBriefs.first?.id
        selectedTab = .assistant
        persistDraftState()
    }

    func beginCallLaunch(for brief: CivicCallBrief, sourceScreen: String = "issue_call_center") async {
        let userID = await userIDForRequest()
        let launchSessionID = UUID().uuidString
        do {
            let launch = try await apiClient.logCallLaunch(
                userID: userID,
                officeID: brief.repID,
                issueID: brief.issueID.isEmpty ? nil : brief.issueID,
                sourceScreen: sourceScreen,
                sessionID: launchSessionID
            )
            pendingCallLaunch = PendingCallLaunch(
                launchEventID: launch.launchEventID,
                briefID: brief.id,
                officeID: brief.repID,
                issueID: brief.issueID.isEmpty ? nil : brief.issueID,
                launchedAt: launch.launchedAt
            )
            queueMAPCCallEvent(
                type: .callLaunch,
                brief: brief,
                sourceScreen: sourceScreen,
                metadata: [
                    "launch_event_id": launch.launchEventID,
                    "api_launch_logged": "true",
                    "session_id": launchSessionID
                ]
            )
        } catch {
            // Preserve the ability to ask for completion locally even when network launch logging fails.
            let fallbackLaunchEventID = UUID().uuidString
            pendingCallLaunch = PendingCallLaunch(
                launchEventID: fallbackLaunchEventID,
                briefID: brief.id,
                officeID: brief.repID,
                issueID: brief.issueID.isEmpty ? nil : brief.issueID,
                launchedAt: Date()
            )
            queueMAPCCallEvent(
                type: .callLaunch,
                brief: brief,
                sourceScreen: sourceScreen,
                metadata: [
                    "launch_event_id": fallbackLaunchEventID,
                    "api_launch_logged": "false",
                    "session_id": launchSessionID
                ]
            )
            logger.info("Call launch log failed; continuing with local completion prompt.")
        }
    }

    func shouldPromptForPendingCallCompletion(timeout: TimeInterval = 10 * 60) -> Bool {
        guard let pending = pendingCallLaunch else { return false }
        return Date().timeIntervalSince(pending.launchedAt) <= timeout
    }

    func confirmPendingCallCompletion(completed: Bool) async {
        guard let pending = pendingCallLaunch else { return }
        let userID = await userIDForRequest()

        do {
            let response = try await apiClient.confirmCallCompletion(
                userID: userID,
                launchEventID: pending.launchEventID,
                completed: completed
            )

            let completionBrief = callBriefs.first { $0.id == pending.briefID }
            queueMAPCCallEvent(
                type: .callCompletionConfirmed,
                brief: completionBrief,
                issueID: pending.issueID,
                issueTitle: issueTitle,
                completed: completed,
                sourceScreen: "issue_call_center",
                metadata: [
                    "launch_event_id": pending.launchEventID,
                    "call_logged": response.callLogged ? "true" : "false",
                    "scoring_eligible": (response.scoringEligible ?? false) ? "true" : "false"
                ]
            )

            if completed {
                lastCompletionResult = response
                pendingCallLaunch = nil
                await refreshCallScoreData(for: userID, force: true)
            } else {
                lastCompletionResult = nil
            }
        } catch {
            let completionBrief = callBriefs.first { $0.id == pending.briefID }
            queueMAPCCallEvent(
                type: .callCompletionFailed,
                brief: completionBrief,
                issueID: pending.issueID,
                issueTitle: issueTitle,
                completed: completed,
                sourceScreen: "issue_call_center",
                metadata: [
                    "launch_event_id": pending.launchEventID
                ]
            )
        }
    }

    func clearCompletionResult() {
        lastCompletionResult = nil
    }

    func componentDisplayName(for key: String) -> String {
        switch key {
        case "activation_points": return "Activation"
        case "recency_points": return "Recency"
        case "consistency_points": return "Consistency"
        case "breadth_points": return "Breadth"
        case "momentum_points": return "Momentum"
        default: return key.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    func logOutcome(for brief: CivicCallBrief, outcome: CivicCallOutcome, notes: String = "") async {
        loggedOutcomeByBriefID[brief.id] = outcome
        let userID = await userIDForRequest()

        do {
            try await apiClient.logCall(
                userID: userID,
                repID: brief.repID,
                issueID: brief.issueID,
                briefID: brief.id,
                outcome: outcome,
                stafferPosition: outcome.inferredStafferPosition,
                notes: notes
            )
        } catch {
            // Continue and persist local history even when network logging fails.
        }

        let newLog = CivicCallLogRecord(
            id: UUID().uuidString,
            createdAt: Date(),
            repID: brief.repID,
            repName: brief.repName,
            issueID: brief.issueID,
            issueTitle: issueTitle,
            briefID: brief.id,
            outcome: outcome,
            stafferPosition: outcome.inferredStafferPosition,
            notes: notes.isEmpty ? nil : notes
        )

        if let idx = historyGroups.firstIndex(where: { $0.issueID == brief.issueID }) {
            let group = historyGroups[idx]
            var logs = group.logs
            logs.insert(newLog, at: 0)
            historyGroups[idx] = CivicHistoryGroup(
                id: group.id,
                issueID: group.issueID,
                issueTitle: group.issueTitle,
                issueSummary: group.issueSummary,
                date: Date(),
                briefs: group.briefs,
                logs: logs
            )
        } else {
            historyGroups.insert(
                CivicHistoryGroup(
                    id: UUID().uuidString,
                    issueID: brief.issueID,
                    issueTitle: issueTitle,
                    issueSummary: issueSummary,
                    date: Date(),
                    briefs: callBriefs,
                    logs: [newLog]
                ),
                at: 0
            )
        }

        queueMAPCCallEvent(
            type: .callOutcomeLogged,
            brief: brief,
            issueID: brief.issueID,
            issueTitle: issueTitle,
            outcome: outcome,
            sourceScreen: "issue_call_center",
            metadata: notes.isEmpty ? nil : ["notes_present": "true"]
        )

        saveSnapshot()
    }

    func refreshCallScoreData(for userID: String? = nil, force: Bool = false) async {
        let resolvedUserID: String
        if let userID {
            resolvedUserID = userID
        } else {
            resolvedUserID = await userIDForRequest()
        }

        if let inFlight = callScoreRefreshTask {
            await inFlight.value
            if !force { return }
        }

        let now = Date()
        if !force,
           lastCallScoreRefreshUserID == resolvedUserID,
           now.timeIntervalSince(lastCallScoreRefreshAt) < callScoreRefreshCooldown {
            return
        }

        lastCallScoreRefreshAt = now
        lastCallScoreRefreshUserID = resolvedUserID

        let refreshTask = Task { [weak self] in
            guard let self else { return }
            await self.performCallScoreRefreshData(for: resolvedUserID)
        }

        callScoreRefreshTask = refreshTask
        await refreshTask.value
        callScoreRefreshTask = nil
    }

    private func performCallScoreRefreshData(for resolvedUserID: String) async {
        async let summaryTask = apiClient.fetchCallScoreSummary(userID: resolvedUserID)
        async let breakdownTask = apiClient.fetchCallScoreBreakdown(userID: resolvedUserID)
        async let historyTask = apiClient.fetchCallScoreHistory(userID: resolvedUserID, limit: 30)
        async let monthlyUserLeaderboardTask = apiClient.fetchUserLeaderboardSummary(
            userID: resolvedUserID,
            periodType: "monthly",
            periodStart: nil
        )
        async let monthlyLeaderboardTask = apiClient.fetchLeaderboard(periodType: "monthly", periodStart: nil)
        async let allTimeLeaderboardTask = apiClient.fetchLeaderboard(periodType: "all_time", periodStart: nil)
        async let annualLeaderboardTask = apiClient.fetchLeaderboard(periodType: "annual", periodStart: nil)
        async let allTimeUserSummaryTask = apiClient.fetchUserLeaderboardSummary(
            userID: resolvedUserID,
            periodType: "all_time",
            periodStart: nil
        )
        async let annualUserSummaryTask = apiClient.fetchUserLeaderboardSummary(
            userID: resolvedUserID,
            periodType: "annual",
            periodStart: nil
        )

        if let summary = try? await summaryTask {
            callScoreSummary = summary
        }
        if let breakdown = try? await breakdownTask {
            callScoreBreakdown = breakdown
        }
        if let history = try? await historyTask {
            callScoreHistory = history
        }
        if let leaderboard = try? await monthlyUserLeaderboardTask {
            leaderboardSummary = leaderboard
        }

        let monthlyLeaderboard = try? await monthlyLeaderboardTask
        let allTimeLeaderboard = try? await allTimeLeaderboardTask
        let annualLeaderboard = try? await annualLeaderboardTask
        let allTimeUserSummary = try? await allTimeUserSummaryTask
        let annualUserSummary = try? await annualUserSummaryTask

        let monthlyVoteNowCalls = monthlyLeaderboard
            .map(Self.sumEligibleVerifiedCalls(in:)) ?? 0

        let totalVoteNowCalls: Int
        if let allTime = allTimeLeaderboard {
            totalVoteNowCalls = Self.sumEligibleVerifiedCalls(in: allTime)
        } else if let annual = annualLeaderboard {
            totalVoteNowCalls = Self.sumEligibleVerifiedCalls(in: annual)
        } else {
            totalVoteNowCalls = monthlyVoteNowCalls
        }

        let userCallCount: Int
        if let allTime = allTimeUserSummary {
            userCallCount = allTime.eligibleVerifiedCallCount
        } else if let annual = annualUserSummary {
            userCallCount = annual.eligibleVerifiedCallCount
        } else {
            userCallCount = leaderboardSummary?.eligibleVerifiedCallCount ?? 0
        }

        var mergedStats = CivicCallStats(
            totalVoteNowCalls: totalVoteNowCalls,
            monthlyVoteNowCalls: monthlyVoteNowCalls,
            userCallCount: userCallCount
        )

        if let supabaseSums = await supabaseManager.fetchMAPCCallSums() {
            mergedStats = CivicCallStats(
                totalVoteNowCalls: max(mergedStats.totalVoteNowCalls, supabaseSums.totalCompletedCalls),
                monthlyVoteNowCalls: max(mergedStats.monthlyVoteNowCalls, supabaseSums.monthlyCompletedCalls),
                userCallCount: max(mergedStats.userCallCount, supabaseSums.userCompletedCalls)
            )
        }
        callStats = mergedStats

        let trackedIssueIDs = trackedIssueIDsForCivicScore(maxCount: 24)
        if trackedIssueIDs.isEmpty {
            appWideCompletedCallsByIssueID = [:]
        } else if let issueSums = await supabaseManager.fetchMAPCCallIssueSums(issueIDs: trackedIssueIDs) {
            var normalizedCounts: [String: Int] = [:]
            for (issueID, count) in issueSums.appCompletedCallsByIssueID {
                guard let key = Self.normalizedIssueIDKey(issueID) else { continue }
                normalizedCounts[key] = max(0, count)
            }
            for issueID in trackedIssueIDs {
                guard let key = Self.normalizedIssueIDKey(issueID) else { continue }
                if normalizedCounts[key] == nil {
                    normalizedCounts[key] = 0
                }
            }
            appWideCompletedCallsByIssueID = normalizedCounts
        }
    }

    func appWideCompletedCalls(forIssueID issueID: String) -> Int? {
        guard let key = Self.normalizedIssueIDKey(issueID) else { return nil }
        return appWideCompletedCallsByIssueID[key]
    }

    private static func sumEligibleVerifiedCalls(in leaderboard: CivicLeaderboardResponse) -> Int {
        leaderboard.entries.reduce(0) { partial, entry in
            partial + max(0, entry.eligibleVerifiedCallCount)
        }
    }

    private static func normalizedIssueIDKey(_ issueID: String) -> String? {
        let normalized = issueID
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        return normalized.isEmpty ? nil : normalized
    }

    private func trackedIssueIDsForCivicScore(maxCount: Int) -> [String] {
        var orderedIssueIDs: [String] = []
        var seenKeys = Set<String>()

        func appendIssueID(_ rawIssueID: String?) {
            guard let rawIssueID else { return }
            let normalized = rawIssueID.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalized.isEmpty else { return }
            let key = normalized.lowercased()
            guard seenKeys.insert(key).inserted else { return }
            orderedIssueIDs.append(normalized)
        }

        for brief in callBriefs {
            appendIssueID(brief.issueID)
            if orderedIssueIDs.count >= maxCount { return orderedIssueIDs }
        }

        for group in historyGroups.sorted(by: { $0.date > $1.date }) {
            appendIssueID(group.issueID)
            if orderedIssueIDs.count >= maxCount { return orderedIssueIDs }
        }

        return orderedIssueIDs
    }

    private func ensureActiveMAPCSessionID() -> UUID {
        if let activeMAPCSessionID {
            return activeMAPCSessionID
        }
        let generated = UUID()
        activeMAPCSessionID = generated
        return generated
    }

    private func ensureScriptChatSessionID() -> UUID {
        if let scriptChatSessionID {
            return scriptChatSessionID
        }
        let generated = UUID()
        scriptChatSessionID = generated
        return generated
    }

    private func queueMAPCCallEvent(
        type: MAPCCallEventInsert.EventType,
        brief: CivicCallBrief?,
        issueID: String? = nil,
        issueTitle: String? = nil,
        completed: Bool? = nil,
        outcome: CivicCallOutcome? = nil,
        sourceScreen: String? = nil,
        metadata: [String: String]? = nil
    ) {
        let normalizedIssueTitle: String? = {
            let direct = issueTitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !direct.isEmpty { return direct }
            let fallback = self.issueTitle.trimmingCharacters(in: .whitespacesAndNewlines)
            return fallback.isEmpty ? nil : fallback
        }()

        let payload = MAPCCallEventInsert(
            sessionID: ensureActiveMAPCSessionID(),
            userID: nil,
            issueID: issueID ?? brief?.issueID,
            issueTitle: normalizedIssueTitle,
            briefID: brief?.id,
            repID: brief?.repID,
            repName: brief?.repName,
            repSlot: brief?.repSlot?.rawValue,
            eventType: type,
            completed: completed,
            outcome: outcome?.rawValue,
            sourceScreen: sourceScreen,
            metadata: metadata
        )

        Task { [supabaseManager] in
            await supabaseManager.logMAPCCallEvent(payload)
        }
    }

    func advanceToNextRep(after brief: CivicCallBrief) {
        moveToNextBrief(after: brief)
    }

    func retreatToPreviousRep(before brief: CivicCallBrief) {
        moveToPreviousBrief(before: brief)
    }

    func hasLoggedOutcome(for brief: CivicCallBrief) -> Bool {
        if loggedOutcomeByBriefID[brief.id] != nil {
            return true
        }

        return historyGroups.contains { group in
            group.issueID == brief.issueID &&
            group.logs.contains { log in
                log.briefID == brief.id
            }
        }
    }

    var activeBrief: CivicCallBrief? {
        if let activeBriefID,
           let matched = callBriefs.first(where: { $0.id == activeBriefID }) {
            return matched
        }
        return callBriefs.first
    }

    var activeBriefIndex: Int? {
        guard let active = activeBrief else { return nil }
        return callBriefs.firstIndex(where: { $0.id == active.id })
    }

    func isLastBrief(_ brief: CivicCallBrief) -> Bool {
        guard let idx = callBriefs.firstIndex(where: { $0.id == brief.id }) else { return false }
        return idx == callBriefs.index(before: callBriefs.endIndex)
    }

    func finishScript() {
        saveSnapshot()
    }

    func isSenateBrief(_ brief: CivicCallBrief) -> Bool {
        if brief.repSlot == .senate1 || brief.repSlot == .senate2 {
            return true
        }
        return brief.officeType.lowercased().contains("senator")
    }

    func committeeAssignments(for brief: CivicCallBrief) -> [String] {
        let fromOfficial = official(for: brief)?.committeeAssignments ?? []
        let fromRelevance = extractedCommitteeAssignments(from: brief.relevanceBadges)
        return Array(Set(fromOfficial + fromRelevance)).sorted()
    }

    func hasNextRep(after brief: CivicCallBrief) -> Bool {
        let scoped = callBriefs
        guard let currentIndex = scoped.firstIndex(where: { $0.id == brief.id }) else { return false }
        return scoped.index(after: currentIndex) < scoped.endIndex
    }

    func official(for brief: CivicCallBrief) -> Official? {
        if let official = officialLookupByRepID[brief.repID] {
            return official
        }
        if let slot = brief.repSlot, let official = officialBySlot[slot] {
            return official
        }
        let normalizedName = Self.normalizeNameKey(brief.repName)
        if let official = officialLookupByName[normalizedName] {
            return official
        }
        if let placeholderMatch = fallbackOfficialForPlaceholder(brief: brief) {
            return placeholderMatch
        }
        if let idx = callBriefs.firstIndex(where: { $0.id == brief.id }),
           repTargets.indices.contains(idx) {
            return repTargets[idx].official
        }
        return nil
    }

    func persistDraftState() {
        saveSnapshot()
    }

    private func applyResolution(_ response: CivicIssueResolutionResponse) {
        let enriched = enrichResolutionWithFallbackBills(response)
        let fallbackIssueID = resolvedIssueIdentifier(
            preferredIssueID: enriched.issueID,
            issueTitle: enriched.issueTitle,
            issueSummary: enriched.issueSummary
        )
        let normalized = normalizedBriefs(enriched.callBriefs, fallbackIssueID: fallbackIssueID)
        issueTitle = enriched.issueTitle
        issueSummary = enriched.issueSummary
        resolvedEntities = enriched.resolvedEntities
        callBriefs = normalized
        activeBriefID = filteredBriefs.first?.id
    }

    private func enrichResolutionWithFallbackBills(_ response: CivicIssueResolutionResponse) -> CivicIssueResolutionResponse {
        let explicitBill = normalizedBillReference(optionalBillRef)
        var resolvedBills = response.resolvedEntities.bills.compactMap(normalizedBillReference)
        if let explicitBill, !containsCaseInsensitive(resolvedBills, value: explicitBill) {
            resolvedBills.append(explicitBill)
        }

        let updatedBriefs = response.callBriefs.map { brief in
            let cleanedBriefBills = brief.relatedBills.compactMap(normalizedBillReference)
            let selectedBill = cleanedBriefBills.first ?? explicitBill
            if let selectedBill, !containsCaseInsensitive(resolvedBills, value: selectedBill) {
                resolvedBills.append(selectedBill)
            }

            let relatedBills = cleanedBriefBills.isEmpty ? (selectedBill.map { [$0] } ?? []) : cleanedBriefBills
            let liveScript = interpolateBillPlaceholder(in: brief.liveScript, billReference: selectedBill)
            let voicemailScript = interpolateBillPlaceholder(in: brief.voicemailScript, billReference: selectedBill)

            return CivicCallBrief(
                id: brief.id,
                repID: brief.repID,
                repName: brief.repName,
                officeType: brief.officeType,
                primaryPhoneNumber: brief.primaryPhoneNumber,
                localOfficePhoneNumber: brief.localOfficePhoneNumber,
                relevanceBadges: brief.relevanceBadges,
                relatedBills: relatedBills,
                relatedCommittees: brief.relatedCommittees,
                liveScript: liveScript,
                voicemailScript: voicemailScript,
                talkingPoints: brief.talkingPoints,
                issueID: brief.issueID,
                repSlot: brief.repSlot
            )
        }

        return CivicIssueResolutionResponse(
            issueID: response.issueID,
            issueTitle: response.issueTitle,
            issueSummary: response.issueSummary,
            resolvedEntities: CivicResolvedEntities(
                bills: resolvedBills,
                committees: response.resolvedEntities.committees,
                agencies: response.resolvedEntities.agencies
            ),
            callBriefs: updatedBriefs
        )
    }

    private func appendHistory(for resolution: CivicIssueResolutionResponse) {
        let fallbackIssueID = resolvedIssueIdentifier(
            preferredIssueID: resolution.issueID,
            issueTitle: resolution.issueTitle,
            issueSummary: resolution.issueSummary
        )
        let normalized = normalizedBriefs(resolution.callBriefs, fallbackIssueID: fallbackIssueID)
        let fresh = CivicHistoryGroup(
            id: UUID().uuidString,
            issueID: fallbackIssueID,
            issueTitle: resolution.issueTitle,
            issueSummary: resolution.issueSummary,
            date: Date(),
            briefs: normalized,
            logs: []
        )
        historyGroups.removeAll(where: { $0.issueID == fresh.issueID })
        historyGroups.insert(fresh, at: 0)
    }

    private func applySeedResolution(for example: CivicExampleIssueCard) {
        let selectedSlots = slotsForExample(example)
        let selectedTargets = repTargets.filter { selectedSlots.contains($0.slot) }
        guard !selectedTargets.isEmpty else { return }

        let issueID = seededIssueID(for: example)
        let explicitRelatedBills = example.relatedBills.compactMap(normalizedBillReference)
        var resolvedBills = explicitRelatedBills
        let relatedCommittees = inferredCommittees(for: example)
        let talkPointAsk = selectedAsk?.title ?? example.primaryAsk ?? "Support"

        let briefs: [CivicCallBrief] = selectedTargets.map { target in
            let repName = target.official.name
            let repLastName = repName
                .split(separator: " ")
                .last
                .map(String.init) ?? repName
            let billValue = explicitRelatedBills.first
            if let billValue, !containsCaseInsensitive(resolvedBills, value: billValue) {
                resolvedBills.append(billValue)
            }
            let relevance = example.repRelevance.isEmpty
                ? fallbackRelevance(for: target, billRef: billValue)
                : example.repRelevance
            let committeeCallout = committeeJurisdictionCallout(
                repName: repName,
                officeType: target.officeType,
                officialCommittees: target.official.committeeAssignments,
                issueCommittees: relatedCommittees,
                repRelevance: relevance
            )

            let baseLiveScript = interpolateExampleScript(
                example.liveScript,
                officialTitle: target.officeType,
                officialLastName: repLastName,
                billOrResolution: billValue
            )
            let baseVoicemailScript = interpolateExampleScript(
                example.voicemailScript,
                officialTitle: target.officeType,
                officialLastName: repLastName,
                billOrResolution: billValue
            )
            let liveScript = injectCommitteeCallout(committeeCallout, into: baseLiveScript)
            let voicemailScript = injectCommitteeCallout(committeeCallout, into: baseVoicemailScript)
            let briefRelatedBills = explicitRelatedBills.isEmpty
                ? billValue.map { [$0] } ?? []
                : explicitRelatedBills

            return CivicCallBrief(
                id: UUID().uuidString,
                repID: stableRepID(for: target.official),
                repName: repName,
                officeType: target.officeType,
                primaryPhoneNumber: resolvedPrimaryPhone(for: target),
                localOfficePhoneNumber: nil,
                relevanceBadges: relevance,
                relatedBills: briefRelatedBills,
                relatedCommittees: relatedCommittees,
                liveScript: liveScript,
                voicemailScript: voicemailScript,
                talkingPoints: [
                    "Issue: \(example.title)",
                    "Explicit ask: \(talkPointAsk)",
                    "Request the office to share the member's current position"
                ],
                issueID: issueID,
                repSlot: target.slot
            )
        }

        applyResolution(
            CivicIssueResolutionResponse(
                issueID: issueID,
                issueTitle: example.title,
                issueSummary: example.summary,
                resolvedEntities: CivicResolvedEntities(
                    bills: resolvedBills,
                    committees: relatedCommittees,
                    agencies: resolvedEntities.agencies
                ),
                callBriefs: briefs
            )
        )
        selectedRepFilter = .all
        saveSnapshot()
    }

    private func seededIssueID(for example: CivicExampleIssueCard) -> String {
        let raw = example.id.trimmingCharacters(in: .whitespacesAndNewlines)
        if !raw.isEmpty {
            return raw
        }
        if let slug = example.slug?.trimmingCharacters(in: .whitespacesAndNewlines), !slug.isEmpty {
            return slug
        }
        return resolvedIssueIdentifier(
            preferredIssueID: nil,
            issueTitle: example.title,
            issueSummary: example.summary
        )
    }

    private func slotsForExample(_ example: CivicExampleIssueCard) -> [CivicRepSlot] {
        let chamberSet = Set(
            example.targetChambers
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
                .filter { !$0.isEmpty }
        )
        guard !chamberSet.isEmpty else { return requestRepSlots }

        var slots: [CivicRepSlot] = []
        if chamberSet.contains("house") {
            slots.append(.house)
        }
        if chamberSet.contains("senate") {
            if repTargets.contains(where: { $0.slot == .senate1 }) {
                slots.append(.senate1)
            }
            if repTargets.contains(where: { $0.slot == .senate2 }) {
                slots.append(.senate2)
            }
        }

        return slots.isEmpty ? requestRepSlots : slots
    }

    private func interpolateExampleScript(
        _ script: String,
        officialTitle: String,
        officialLastName: String,
        billOrResolution: String?
    ) -> String {
        let billText: String
        if let billOrResolution,
           !billOrResolution.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            billText = billOrResolution
        } else {
            billText = "this issue"
        }

        return script
            .replacingOccurrences(of: "[OFFICIAL_TITLE]", with: officialTitle)
            .replacingOccurrences(of: "[OFFICIAL_LAST]", with: officialLastName)
            .replacingOccurrences(of: "[BILL_OR_RESOLUTION]", with: billText)
            .replacingOccurrences(of: "[ZIP]", with: resolvedUserZip)
    }

    private func interpolateBillPlaceholder(in script: String, billReference: String?) -> String {
        let replacement: String
        if let billReference,
           !billReference.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            replacement = billReference
        } else {
            replacement = "this issue"
        }

        return script.replacingOccurrences(of: "[BILL_OR_RESOLUTION]", with: replacement)
    }

    private func targetForBrief(_ brief: CivicCallBrief) -> CivicRepTarget? {
        if let slot = brief.repSlot,
           let target = repTargets.first(where: { $0.slot == slot }) {
            return target
        }

        let trimmedRepID = brief.repID.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedRepID.isEmpty,
           let target = repTargets.first(where: {
               stableRepID(for: $0.official).caseInsensitiveCompare(trimmedRepID) == .orderedSame
           }) {
            return target
        }

        let normalizedName = Self.normalizeNameKey(brief.repName)
        if !normalizedName.isEmpty,
           let target = repTargets.first(where: {
               Self.normalizeNameKey($0.official.name) == normalizedName
           }) {
            return target
        }

        guard let official = official(for: brief) else {
            return nil
        }

        if let resolvedSlot = brief.repSlot
            ?? slotByRepID[trimmedRepID]
            ?? slotByName[normalizedName] {
            return CivicRepTarget(slot: resolvedSlot, official: official)
        }

        return nil
    }

    private func extractedCommitteeAssignments(from relevanceBadges: [String]) -> [String] {
        var assignments: [String] = []

        for badge in relevanceBadges {
            let normalized = badge.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalized.isEmpty else { continue }
            guard normalized.localizedCaseInsensitiveContains("committee") else { continue }

            if let servesOnRange = normalized.range(of: "serves on", options: [.caseInsensitive]) {
                var committee = String(normalized[servesOnRange.upperBound...])
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if let parentheticalStart = committee.firstIndex(of: "(") {
                    committee = String(committee[..<parentheticalStart])
                }
                committee = committee.trimmingCharacters(in: CharacterSet(charactersIn: " ."))
                if !committee.isEmpty {
                    assignments.append(committee)
                    continue
                }
            }

            if normalized.localizedCaseInsensitiveContains("serves on ") {
                let components = normalized.components(separatedBy: "serves on ")
                if let tail = components.last {
                    let committee = tail.trimmingCharacters(in: CharacterSet(charactersIn: " ."))
                    if !committee.isEmpty {
                        assignments.append(committee)
                    }
                }
            }
        }

        return Array(Set(assignments)).sorted()
    }

    private func inferredCommittees(for example: CivicExampleIssueCard) -> [String] {
        var ordered: [String] = []

        func appendUnique(_ values: [String]) {
            for value in values {
                let cleaned = value.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !cleaned.isEmpty else { continue }
                if !ordered.contains(where: { normalizeCommitteeName($0) == normalizeCommitteeName(cleaned) }) {
                    ordered.append(cleaned)
                }
            }
        }

        appendUnique(extractedCommitteeAssignments(from: example.repRelevance))

        let categoryKey = (example.category ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let categoryCommittees: [String: [String]] = [
            "foreign affairs": ["Foreign Relations", "Armed Services", "Intelligence", "Appropriations"],
            "lgbtq": ["Judiciary", "Health, Education, Labor, and Pensions", "Homeland Security and Governmental Affairs"],
            "government oversight": ["Judiciary", "Homeland Security and Governmental Affairs", "Appropriations", "Intelligence"],
            "nominations": ["Judiciary", "Health, Education, Labor, and Pensions", "Finance", "Environment and Public Works", "Energy and Natural Resources"],
            "voter rights": ["Judiciary", "Rules and Administration", "Homeland Security and Governmental Affairs"],
            "immigration": ["Judiciary", "Homeland Security and Governmental Affairs", "Foreign Relations"],
            "environment": ["Environment and Public Works", "Energy and Natural Resources", "Appropriations"],
            "digital rights": ["Commerce, Science, and Transportation", "Judiciary", "Homeland Security and Governmental Affairs"],
        ]
        appendUnique(categoryCommittees[categoryKey] ?? [])

        let tagCommittees: [String: [String]] = [
            "foreign-policy": ["Foreign Relations", "Armed Services", "Intelligence"],
            "war-powers": ["Foreign Relations", "Armed Services"],
            "climate": ["Environment and Public Works", "Energy and Natural Resources"],
            "public-health": ["Health, Education, Labor, and Pensions", "Finance"],
            "immigration": ["Judiciary", "Homeland Security and Governmental Affairs"],
            "voting-rights": ["Judiciary", "Rules and Administration"],
            "digital-rights": ["Commerce, Science, and Transportation", "Judiciary"],
        ]
        let tagKeys = example.tags.map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
        for key in tagKeys {
            appendUnique(tagCommittees[key] ?? [])
        }

        return ordered
    }

    private func committeeJurisdictionCallout(
        repName: String,
        officeType: String,
        officialCommittees: [String],
        issueCommittees: [String],
        repRelevance: [String]
    ) -> String? {
        var candidateIssueCommittees = issueCommittees
        var relevanceCommittee: String?
        if let relevanceLine = matchingCommitteeRelevanceLine(for: repName, in: repRelevance),
           let fromRelevance = committeeNameFromRelevanceLine(relevanceLine) {
            relevanceCommittee = fromRelevance
            candidateIssueCommittees.append(fromRelevance)
        }

        let matchedCommittee = bestMatchedCommittee(
            assigned: officialCommittees,
            relevant: candidateIssueCommittees
        ) ?? relevanceCommittee

        guard let matchedCommittee else {
            return nil
        }

        let officeLabel = officeType.lowercased().contains("senator") ? "Senator" : "Representative"
        let lastName = preferredLastName(from: repName)
        let committeeLabel = formattedCommitteeLabel(matchedCommittee, officeLabel: officeLabel)

        return "As \(officeLabel) \(lastName) is a member of the \(committeeLabel), this issue is in that committee's jurisdiction."
    }

    private func bestMatchedCommittee(assigned: [String], relevant: [String]) -> String? {
        let assignedClean = assigned
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        let relevantClean = relevant
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        guard !assignedClean.isEmpty, !relevantClean.isEmpty else {
            return nil
        }

        for targetCommittee in relevantClean {
            let normalizedTarget = normalizeCommitteeName(targetCommittee)
            guard !normalizedTarget.isEmpty else { continue }

            for assignedCommittee in assignedClean {
                let normalizedAssigned = normalizeCommitteeName(assignedCommittee)
                guard !normalizedAssigned.isEmpty else { continue }
                if normalizedAssigned.contains(normalizedTarget)
                    || normalizedTarget.contains(normalizedAssigned) {
                    return assignedCommittee
                }
            }
        }

        return nil
    }

    private func formattedCommitteeLabel(_ committeeName: String, officeLabel: String) -> String {
        var committeeLabel: String
        if committeeName.lowercased().contains("committee") {
            committeeLabel = committeeName
        } else {
            committeeLabel = "\(committeeName) Committee"
        }
        if officeLabel == "Senator", !committeeLabel.lowercased().contains("senate") {
            committeeLabel = "Senate \(committeeLabel)"
        } else if officeLabel == "Representative", !committeeLabel.lowercased().contains("house") {
            committeeLabel = "House \(committeeLabel)"
        }
        return committeeLabel
    }

    private func normalizeCommitteeName(_ value: String) -> String {
        var normalized = value
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)

        normalized = normalized.replacingOccurrences(of: "&", with: " and ")
        normalized = normalized.replacingOccurrences(of: "committee on ", with: "")
        normalized = normalized.replacingOccurrences(of: "committee for ", with: "")
        normalized = normalized.replacingOccurrences(of: "committee of ", with: "")
        normalized = normalized.replacingOccurrences(of: "senate ", with: "")
        normalized = normalized.replacingOccurrences(of: "house ", with: "")
        normalized = normalized.replacingOccurrences(of: "u.s. ", with: "")
        normalized = normalized.replacingOccurrences(of: "us ", with: "")
        normalized = normalized.replacingOccurrences(of: "'", with: "")

        let allowed = CharacterSet.alphanumerics.union(.whitespaces)
        normalized = String(normalized.unicodeScalars.map { allowed.contains($0) ? Character($0) : " " })
        normalized = normalized.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        return normalized.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func matchingCommitteeRelevanceLine(for repName: String, in repRelevance: [String]) -> String? {
        let committeeLines = repRelevance.filter {
            $0.localizedCaseInsensitiveContains("committee of jurisdiction")
        }
        guard !committeeLines.isEmpty else { return nil }

        let normalizedRepName = Self.normalizeNameKey(repName)
        if let match = committeeLines.first(where: { Self.normalizeNameKey($0).contains(normalizedRepName) }) {
            return match
        }

        let lastName = preferredLastName(from: repName)
        let normalizedLastName = Self.normalizeNameKey(lastName)
        if let match = committeeLines.first(where: { Self.normalizeNameKey($0).contains(normalizedLastName) }) {
            return match
        }

        return committeeLines.first
    }

    private func committeeNameFromRelevanceLine(_ line: String) -> String? {
        let withoutSuffix = line
            .replacingOccurrences(
                of: "(committee of jurisdiction).",
                with: "",
                options: [.caseInsensitive],
                range: nil
            )
            .replacingOccurrences(
                of: "(committee of jurisdiction)",
                with: "",
                options: [.caseInsensitive],
                range: nil
            )
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let servesOnRange = withoutSuffix.range(of: "serves on", options: [.caseInsensitive]) else {
            return nil
        }

        let committeeName = withoutSuffix[servesOnRange.upperBound...]
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "."))

        return committeeName.isEmpty ? nil : committeeName
    }

    private func preferredLastName(from repName: String) -> String {
        repName
            .split(separator: " ")
            .last
            .map(String.init) ?? repName
    }

    private func injectCommitteeCallout(_ callout: String?, into script: String) -> String {
        guard let callout,
              !callout.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return script
        }

        if script.localizedCaseInsensitiveContains("committee's jurisdiction")
            || script.localizedCaseInsensitiveContains("committee of jurisdiction") {
            return script
        }

        let paragraphs = script
            .components(separatedBy: "\n\n")
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

        guard paragraphs.count >= 2 else {
            return script + "\n\n" + callout
        }

        var updated = paragraphs
        updated.insert(callout, at: 2)
        return updated.joined(separator: "\n\n")
    }

    private func saveSnapshot() {
        let resolution: CivicIssueResolutionResponse? = issueTitle.isEmpty
            ? nil
            : CivicIssueResolutionResponse(
                issueID: callBriefs.first?.issueID ?? UUID().uuidString,
                issueTitle: issueTitle,
                issueSummary: issueSummary,
                resolvedEntities: resolvedEntities,
                callBriefs: callBriefs
            )

        cacheStore.save(
            CivicLocalSnapshot(
                latestResolution: resolution,
                history: historyGroups,
                assistantDraft: CivicAssistantDraft(
                    selectedTab: selectedTab,
                    selectedRepFilter: selectedRepFilter,
                    concernText: concernText,
                    selectedAsk: selectedAsk,
                    optionalBillRef: optionalBillRef,
                    activeBriefID: activeBriefID
                ),
                updatedAt: Date()
            )
        )
    }

    private func moveToNextBrief(after brief: CivicCallBrief) {
        let scoped = callBriefs
        guard let currentIndex = scoped.firstIndex(where: { $0.id == brief.id }) else {
            activeBriefID = filteredBriefs.first?.id
            return
        }

        let nextIndex = scoped.index(after: currentIndex)
        if nextIndex < scoped.endIndex {
            activeBriefID = scoped[nextIndex].id
            scheduleDeferredSnapshotPersistence()
        } else {
            activeBriefID = scoped[currentIndex].id
            scheduleDeferredSnapshotPersistence()
        }
    }

    private func moveToPreviousBrief(before brief: CivicCallBrief) {
        let scoped = callBriefs
        guard let currentIndex = scoped.firstIndex(where: { $0.id == brief.id }) else {
            activeBriefID = filteredBriefs.first?.id
            return
        }

        guard currentIndex > scoped.startIndex else {
            activeBriefID = scoped[currentIndex].id
            scheduleDeferredSnapshotPersistence()
            return
        }

        let previousIndex = scoped.index(before: currentIndex)
        activeBriefID = scoped[previousIndex].id
        scheduleDeferredSnapshotPersistence()
    }

    private func scheduleDeferredSnapshotPersistence(delayNanoseconds: UInt64 = 300_000_000) {
        deferredSnapshotTask?.cancel()
        deferredSnapshotTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: delayNanoseconds)
            guard let self, !Task.isCancelled else { return }
            self.saveSnapshot()
        }
    }

    private func resolutionFromScriptPackage(
        _ package: CivicScriptPackageResponse,
        concernText: String,
        ask: CivicAsk,
        selectedSlots: [CivicRepSlot],
        optionalBillRef: String?
    ) -> CivicIssueResolutionResponse {
        let trimmedConcern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        let canonicalContext = package.canonicalContext
        let issueTitle = normalizedNonEmpty(canonicalContext?.title) ?? deriveIssueTitle(from: trimmedConcern)
        let issueSummary = normalizedNonEmpty(canonicalContext?.summaryPlain) ?? trimmedConcern
        let issueID = resolvedIssueIdentifier(
            preferredIssueID: canonicalContext?.issueID,
            issueTitle: issueTitle,
            issueSummary: issueSummary
        )

        var resolvedBills = (canonicalContext?.relatedBills ?? [])
            .compactMap(normalizedBillReference)
        if let explicitBill = normalizedBillReference(optionalBillRef),
           !containsCaseInsensitive(resolvedBills, value: explicitBill) {
            resolvedBills.append(explicitBill)
        }

        let selectedTargets = repTargets.filter { selectedSlots.contains($0.slot) }
        let scopedTargets = selectedTargets.isEmpty ? repTargets : selectedTargets

        let coreLive = normalizedNonEmpty(package.scriptCore?.liveScriptCore)
            ?? generatedFallbackScript(title: issueTitle, actionSentence: canonicalContext?.commonAsk, isVoicemail: false)
        let coreVoicemail = normalizedNonEmpty(package.scriptCore?.voicemailScriptCore)
            ?? generatedFallbackScript(title: issueTitle, actionSentence: canonicalContext?.commonAsk, isVoicemail: true)

        let briefs: [CivicCallBrief] = scopedTargets.map { target in
            let targetRepID = stableRepID(for: target.official)
            let overlay = package.officeOverlays.first(where: { !$0.repID.isEmpty && $0.repID == targetRepID })
                ?? package.officeOverlays.first(where: { Self.normalizeNameKey($0.repName) == Self.normalizeNameKey(target.official.name) })
                ?? package.officeOverlays.first(where: { overlay in
                    let chamber = overlay.chamber.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                    if chamber == "house" { return target.slot == .house }
                    if chamber == "senate" { return target.slot == .senate1 || target.slot == .senate2 }
                    return false
                })

            let liveTemplate = normalizedNonEmpty(overlay?.liveScriptFinal) ?? coreLive
            let voicemailTemplate = normalizedNonEmpty(overlay?.voicemailScriptFinal) ?? coreVoicemail
            let repLastName = target.official.name
                .split(separator: " ")
                .last
                .map(String.init) ?? target.official.name
            let liveScript = interpolateExampleScript(
                liveTemplate,
                officialTitle: target.officeType,
                officialLastName: repLastName,
                billOrResolution: resolvedBills.first
            )
            let voicemailScript = interpolateExampleScript(
                voicemailTemplate,
                officialTitle: target.officeType,
                officialLastName: repLastName,
                billOrResolution: resolvedBills.first
            )
            let relatedCommittees = Array(Set((overlay?.relatedCommittees ?? []).compactMap { normalizedNonEmpty($0) })).sorted()
            let relevanceBadges = fallbackRelevance(for: target, billRef: resolvedBills.first)

            return CivicCallBrief(
                id: UUID().uuidString,
                repID: targetRepID,
                repName: target.official.name,
                officeType: target.officeType,
                primaryPhoneNumber: resolvedPrimaryPhone(for: target),
                localOfficePhoneNumber: nil,
                relevanceBadges: relevanceBadges,
                relatedBills: resolvedBills,
                relatedCommittees: relatedCommittees,
                liveScript: liveScript,
                voicemailScript: voicemailScript,
                talkingPoints: [
                    "Issue: \(issueTitle)",
                    "Explicit ask: \(canonicalContext?.commonAsk ?? ask.title)",
                    "Request the office to share the member's current position and next step."
                ],
                issueID: issueID,
                repSlot: target.slot
            )
        }

        let resolvedCommittees = Array(
            Set(package.officeOverlays.flatMap { overlay in
                overlay.relatedCommittees.compactMap { normalizedNonEmpty($0) }
            })
        ).sorted()

        return CivicIssueResolutionResponse(
            issueID: issueID,
            issueTitle: issueTitle,
            issueSummary: issueSummary,
            resolvedEntities: CivicResolvedEntities(
                bills: resolvedBills,
                committees: resolvedCommittees,
                agencies: []
            ),
            callBriefs: briefs
        )
    }

    private func fallbackOfficialForPlaceholder(brief: CivicCallBrief) -> Official? {
        if let slot = brief.repSlot, let official = officialBySlot[slot] {
            return official
        }

        let normalizedOfficeType = brief.officeType.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalizedOfficeType.contains("senator"),
           let senator = repTargets.first(where: { $0.slot == .senate1 || $0.slot == .senate2 }) {
            return senator.official
        }
        if (normalizedOfficeType.contains("representative") || normalizedOfficeType.contains("congress")),
           let house = repTargets.first(where: { $0.slot == .house }) {
            return house.official
        }
        return repTargets.first?.official
    }

    private func resolvedPrimaryPhone(for target: CivicRepTarget) -> String {
        if let phone = normalizedNonEmpty(target.official.officialPhone) {
            return phone
        }
        if let fallbackOffice = normalizedNonEmpty(target.officeType), fallbackOffice.lowercased().contains("senator") {
            return "(202) 224-3121"
        }
        return "(202) 225-3121"
    }

    private func fallbackResolution(
        concernText: String,
        ask: CivicAsk,
        selectedSlots: [CivicRepSlot],
        optionalBillRef: String?
    ) -> CivicIssueResolutionResponse {
        let issueID = UUID().uuidString
        let title = deriveIssueTitle(from: concernText)
        let summary = concernText.trimmingCharacters(in: .whitespacesAndNewlines)

        let selectedTargets = repTargets.filter { selectedSlots.contains($0.slot) }
        let explicitBillRef = normalizedBillReference(optionalBillRef)
        var resolvedBills: [String] = explicitBillRef.map { [$0] } ?? []
        var briefs: [CivicCallBrief] = []

        for target in selectedTargets {
            let repID = stableRepID(for: target.official)
            let selectedBillRef = explicitBillRef
            if let selectedBillRef, !containsCaseInsensitive(resolvedBills, value: selectedBillRef) {
                resolvedBills.append(selectedBillRef)
            }

            let reasons = fallbackRelevance(for: target, billRef: selectedBillRef)
            let (live, voicemail, points) = composeScripts(
                repName: target.official.name,
                issueTitle: title,
                ask: ask,
                billRef: selectedBillRef,
                zip: resolvedUserZip,
                reasons: reasons
            )

            let brief = CivicCallBrief(
                id: UUID().uuidString,
                repID: repID,
                repName: target.official.name,
                officeType: target.officeType,
                primaryPhoneNumber: resolvedPrimaryPhone(for: target),
                localOfficePhoneNumber: nil,
                relevanceBadges: reasons,
                relatedBills: selectedBillRef.map { [$0] } ?? [],
                relatedCommittees: [],
                liveScript: live,
                voicemailScript: voicemail,
                talkingPoints: points,
                issueID: issueID,
                repSlot: target.slot
            )

            briefs.append(brief)
        }

        return CivicIssueResolutionResponse(
            issueID: issueID,
            issueTitle: title,
            issueSummary: summary,
            resolvedEntities: CivicResolvedEntities(
                bills: resolvedBills,
                committees: [],
                agencies: []
            ),
            callBriefs: briefs
        )
    }

    private func vettedGeneratedResolution(
        _ response: CivicIssueResolutionResponse,
        concernText: String,
        ask: CivicAsk,
        selectedSlots: [CivicRepSlot],
        optionalBillRef: String?
    ) -> (resolution: CivicIssueResolutionResponse, usedFallback: Bool) {
        let validation = generatedResolutionValidation(
            response,
            concernText: concernText,
            ask: ask,
            optionalBillRef: optionalBillRef
        )
        let sanitized = validation.sanitized
        let shouldFallback = validation.shouldFallback
        if shouldFallback {
            let fallback = fallbackResolution(
                concernText: concernText,
                ask: ask,
                selectedSlots: selectedSlots,
                optionalBillRef: optionalBillRef
            )
            return (fallback, true)
        }
        return (sanitized, false)
    }

    private func generatedResolutionValidation(
        _ response: CivicIssueResolutionResponse,
        concernText: String,
        ask: CivicAsk,
        optionalBillRef: String?
    ) -> (sanitized: CivicIssueResolutionResponse, shouldFallback: Bool) {
        let sanitized = sanitizedGeneratedResolution(response)
        let shouldFallback = containsDisallowedScriptMeta(in: sanitized)
            || isLikelyOffTopic(response: sanitized, concernText: concernText, optionalBillRef: optionalBillRef)
            || !hasReadableCallScripts(
                in: sanitized,
                ask: ask,
                concernText: concernText,
                optionalBillRef: optionalBillRef
            )
        return (sanitized, shouldFallback)
    }

    private func sanitizedGeneratedResolution(_ response: CivicIssueResolutionResponse) -> CivicIssueResolutionResponse {
        let cleanedTitle = normalizeIssueTitle(response.issueTitle)
        let cleanedSummary = normalizeScriptText(response.issueSummary, maxWords: 90)
        let cleanedBriefs = response.callBriefs.map { brief in
            let cleanedTalkingPoints = brief.talkingPoints
                .map { normalizeScriptText($0, maxWords: 28) }
                .filter { !$0.isEmpty }
            return CivicCallBrief(
                id: brief.id,
                repID: brief.repID,
                repName: brief.repName,
                officeType: brief.officeType,
                primaryPhoneNumber: brief.primaryPhoneNumber,
                localOfficePhoneNumber: brief.localOfficePhoneNumber,
                relevanceBadges: brief.relevanceBadges,
                relatedBills: brief.relatedBills,
                relatedCommittees: brief.relatedCommittees,
                liveScript: normalizeScriptText(brief.liveScript, maxWords: 95),
                voicemailScript: normalizeScriptText(brief.voicemailScript, maxWords: 55),
                talkingPoints: cleanedTalkingPoints.isEmpty ? brief.talkingPoints.map { trimToWordLimit($0, maxWords: 28) } : cleanedTalkingPoints,
                issueID: brief.issueID,
                repSlot: brief.repSlot
            )
        }

        return CivicIssueResolutionResponse(
            issueID: response.issueID,
            issueTitle: cleanedTitle,
            issueSummary: cleanedSummary,
            resolvedEntities: response.resolvedEntities,
            callBriefs: cleanedBriefs
        )
    }

    private func normalizeIssueTitle(_ raw: String) -> String {
        let cleaned = raw
            .replacingOccurrences(of: "\r\n", with: " ")
            .replacingOccurrences(of: "\r", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
            .replacingOccurrences(of: "```", with: "")
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return "Constituent issue" }
        return trimToWordLimit(cleaned, maxWords: 12)
    }

    private func normalizeScriptText(_ raw: String, maxWords: Int) -> String {
        let trimmed = raw
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        var paragraphs: [String] = []
        var currentParagraphLines: [String] = []
        for rawLine in trimmed.components(separatedBy: .newlines) {
            let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            if line.isEmpty {
                if !currentParagraphLines.isEmpty {
                    paragraphs.append(currentParagraphLines.joined(separator: " "))
                    currentParagraphLines = []
                }
                continue
            }
            let lower = line.lowercased()
            if lower.hasPrefix("assistant:")
                || lower.hasPrefix("system:")
                || lower.hasPrefix("developer:")
                || lower.hasPrefix("user:") {
                continue
            }
            let collapsedLine = line
                .replacingOccurrences(of: "[ \\t]+", with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !collapsedLine.isEmpty {
                currentParagraphLines.append(collapsedLine)
            }
        }
        if !currentParagraphLines.isEmpty {
            paragraphs.append(currentParagraphLines.joined(separator: " "))
        }

        var collapsed = paragraphs.joined(separator: "\n\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        // Remove low-value boilerplate labels that make scripts feel machine-generated.
        let boilerplatePatterns = [
            #"(?i)\bcurrent status:\s*[^\n]*"#,
            #"(?i)\badditional context:\s*[^\n]*"#,
            #"(?i)\bpolicy focus:\s*[^\n]*"#,
            #"(?i)\bfocus refinement:\s*[^\n]*"#,
            #"(?i)\boffice tie-in:\s*[^\n]*"#,
            #"(?i)\blatest item:\s*[^\n]*"#,
            #"(?i)\bthis issue is typically handled in[^\n]*"#,
            #"(?i)\bno verified evidence items are available yet[^\n]*"#,
            #"(?i)\bmost recent evidence points to ongoing activity[^\n]*"#,
        ]
        for pattern in boilerplatePatterns {
            collapsed = collapsed.replacingOccurrences(
                of: pattern,
                with: "",
                options: .regularExpression
            )
        }
        collapsed = collapsed
            .replacingOccurrences(of: "\\n{3,}", with: "\n\n", options: .regularExpression)
            .replacingOccurrences(of: " {2,}", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        collapsed = collapsed.replacingOccurrences(
            of: #"(?i)\bto\s+(support|oppose|protect|fund|expand|reject|block)\s+(?:and\s+)?\1\b"#,
            with: "to $1",
            options: .regularExpression
        )

        guard !collapsed.isEmpty else {
            return "Hi, my name is [Your Name], and I am a constituent calling about this issue."
        }

        return trimToWordLimit(collapsed, maxWords: maxWords)
    }

    private func clarificationPromptForConcern(
        _ concernText: String,
        optionalBillRef: String?,
        selectedAsk: CivicAsk?
    ) -> String? {
        if let requiredPrompt = requiredMAPCFollowUpPrompt(
            concernText: concernText,
            optionalBillRef: optionalBillRef,
            selectedAsk: selectedAsk
        ) {
            return requiredPrompt
        }

        if normalizedBillReference(optionalBillRef) != nil {
            return nil
        }

        let normalizedConcern = concernText
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard !normalizedConcern.isEmpty else {
            return "Please describe the issue in one sentence and include the action you want Congress to take."
        }

        let words = normalizedConcern
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .map(String.init)
        let wordSet = Set(words)

        let knownIssueSignals: Set<String> = [
            "crypto", "ukraine", "iran", "housing", "lihtc", "snap", "medicaid", "medicare",
            "social", "security", "immigration", "climate", "voting", "election", "reproductive",
            "labor", "workers", "health", "ai", "trans", "tps", "farm", "pell", "student"
        ]
        let policyActionSignals = [
            "bill", "act", "resolution", "funding", "appropriations", "regulation",
            "oversight", "confirm", "nomination", "vote", "support", "oppose", "amendment"
        ]

        let hasKnownIssueSignal = !wordSet.intersection(knownIssueSignals).isEmpty
        let hasPolicyActionSignal = policyActionSignals.contains(where: { normalizedConcern.contains($0) })

        if hasKnownIssueSignal || hasPolicyActionSignal || words.count >= 3 {
            return nil
        }

        return "Please add one specific policy action so I can generate a stronger script. Example: 'Support federal funding to protect wild horse habitats' or include a bill/resolution."
    }

    private func requiredMAPCFollowUpPrompt(
        concernText: String,
        optionalBillRef: String?,
        selectedAsk: CivicAsk?
    ) -> String? {
        let concern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        if concern.isEmpty {
            return nil
        }

        let lowered = concern.lowercased()
        let hasAction = selectedAsk != nil || hasCongressionalActionSignal(in: lowered)
        let hasReference = hasBillProgramAgencySignal(in: concern, optionalBillRef: optionalBillRef)
        let hasKnownTopic = hasKnownIssueTopicSignal(in: lowered)
        let wordCount = concern
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .count

        let isVeryVague = wordCount <= 1 && !hasKnownTopic && !hasReference
        if hasAction && !isVeryVague {
            return nil
        }
        if wordCount >= 2 || hasKnownTopic || hasReference {
            return nil
        }

        return """
        For short or broad prompts, please add:
        1) What exact action should Congress take?
        2) Is there a bill, program, or agency tied to this?

        Example: "Please support VA pilot grant funding for therapeutic riding programs for veterans through appropriations."
        """
    }

    private func hasCongressionalActionSignal(in loweredConcern: String) -> Bool {
        let actionSignals = [
            "support", "oppose", "cosponsor", "vote yes", "vote no", "fund", "increase funding",
            "cut funding", "block", "pass", "reject", "repeal", "amend", "oversight",
            "hold a hearing", "confirm", "delay", "protect", "expand", "extend", "enforce"
        ]
        return actionSignals.contains(where: { loweredConcern.contains($0) })
    }

    private func hasBillProgramAgencySignal(in concernText: String, optionalBillRef: String?) -> Bool {
        if normalizedBillReference(optionalBillRef) != nil {
            return true
        }

        let lowered = concernText.lowercased()
        let namedEntitySignals = [
            "bill", "act", "resolution", "program", "grant", "pilot", "appropriations", "appropriation",
            "agency", "department", "administration", "office", "va", "veterans affairs", "usda",
            "hud", "epa", "fema", "cms", "hhs", "irs", "snap", "medicaid", "medicare", "pell",
        ]
        if namedEntitySignals.contains(where: { lowered.contains($0) }) {
            return true
        }

        let patterns = [
            #"(?i)\b(?:h\.?\s?r\.?|s\.?|h\.?\s?j\.?\s?res\.?|s\.?\s?j\.?\s?res\.?)\s*\d+\b"#,
            #"(?i)\btitle\s+[ivx0-9]+\b"#,
        ]
        return patterns.contains { pattern in
            lowered.range(of: pattern, options: .regularExpression) != nil
        }
    }

    private func hasKnownIssueTopicSignal(in loweredConcern: String) -> Bool {
        let topicSignals = [
            "gun", "guns", "gun control", "firearm", "firearms", "background check", "assault weapon",
            "abortion", "reproductive", "immigration", "border", "climate", "environment", "housing",
            "healthcare", "health care", "medicaid", "medicare", "snap", "farm", "student", "pell",
            "ukraine", "iran", "crypto", "digital assets", "voting", "election", "social security"
        ]
        return topicSignals.contains(where: { loweredConcern.contains($0) })
    }

    private func containsDisallowedScriptMeta(in response: CivicIssueResolutionResponse) -> Bool {
        let combined = [
            response.issueTitle,
            response.issueSummary
        ] + response.callBriefs.flatMap { brief in
            [brief.liveScript, brief.voicemailScript] + brief.talkingPoints
        }
        let text = combined.joined(separator: "\n").lowercased()

        let blockedMarkers = [
            "as an ai",
            "language model",
            "you are chatgpt",
            "openai policy",
            "system prompt",
            "developer message",
            "developer instruction",
            "internal note",
            "policy requires",
            "ignore previous instructions",
            "do not reveal",
            "do not disclose",
            "for internal use",
            "tool output",
            "prompt injection",
            "chain of thought",
            "i cannot help with",
            "i can't help with",
            "unable to assist with that request",
            "the user should",
            "issue packet",
            "briefing packet",
            "policy packet"
        ]
        return blockedMarkers.contains(where: { text.contains($0) })
    }

    private func hasReadableCallScripts(
        in response: CivicIssueResolutionResponse,
        ask: CivicAsk,
        concernText: String,
        optionalBillRef: String?
    ) -> Bool {
        guard !response.callBriefs.isEmpty else { return false }

        let askSignals = askSignalPhrases(for: ask)
        let concernContext = "\(concernText) \(optionalBillRef ?? "")"
        let concernTokens = semanticTopicTokens(in: concernContext)
        let concernAcronyms = uppercaseAcronyms(in: concernContext)
        let concernDomainAnchors = domainAnchors(in: concernContext)

        for brief in response.callBriefs {
            let live = brief.liveScript.trimmingCharacters(in: .whitespacesAndNewlines)
            let voicemail = brief.voicemailScript.trimmingCharacters(in: .whitespacesAndNewlines)
            if live.isEmpty || voicemail.isEmpty {
                return false
            }
            if wordCount(in: live) < 12 || wordCount(in: voicemail) < 8 {
                return false
            }

            let combined = "\(live) \(voicemail)".lowercased()
            let hasConstituentSignal = [
                "constituent",
                "[your name]",
                "my name is",
                "calling from",
                "zip"
            ].contains(where: { combined.contains($0) })
            if !hasConstituentSignal {
                return false
            }

            let hasAskSignal = askSignals.contains(where: { combined.contains($0) })
            if !hasAskSignal {
                return false
            }

            if !concernDomainAnchors.isEmpty {
                let hasDomainAnchor = concernDomainAnchors.contains { combined.contains($0) }
                if !hasDomainAnchor {
                    return false
                }
            }

            if !concernTokens.isEmpty {
                let scriptTokens = semanticTopicTokens(in: combined)
                if concernTokens.intersection(scriptTokens).isEmpty {
                    return false
                }
            }

            if !concernAcronyms.isEmpty {
                let scriptUpper = combined.uppercased()
                let anyAcronymMatched = concernAcronyms.contains(where: { scriptUpper.contains($0) })
                if !anyAcronymMatched {
                    return false
                }
            }
        }

        return true
    }

    private func askSignalPhrases(for ask: CivicAsk) -> [String] {
        switch ask {
        case .support:
            return ["support", "back", "in favor"]
        case .oppose:
            return ["oppose", "reject", "against"]
        case .cosponsor:
            return ["cosponsor", "co-sponsor"]
        case .voteYes:
            return ["vote yes", "yes on"]
        case .voteNo:
            return ["vote no", "no on"]
        case .seekOversight:
            return ["oversight", "investigate", "investigation"]
        case .askPublicStatement:
            return ["public statement", "speak out", "publicly"]
        case .askAmendment:
            return ["amendment", "amend"]
        }
    }

    private func isLikelyOffTopic(
        response: CivicIssueResolutionResponse,
        concernText: String,
        optionalBillRef: String?
    ) -> Bool {
        let concern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !concern.isEmpty else { return false }

        let responseText = [
            response.issueTitle,
            response.issueSummary
        ] + response.callBriefs.flatMap { brief in
            [brief.liveScript, brief.voicemailScript] + brief.relatedBills + brief.talkingPoints
        }
        let responseBlob = responseText.joined(separator: " ")

        let concernTokens = semanticTopicTokens(in: concern + " " + (optionalBillRef ?? ""))
        let responseTokens = semanticTopicTokens(in: responseBlob)
        let concernAnchors = highSignalTopicTokens(in: concern + " " + (optionalBillRef ?? ""))

        if !concernAnchors.isEmpty {
            let anchorOverlap = concernAnchors.intersection(responseTokens)
            if anchorOverlap.isEmpty {
                let responseLower = responseBlob.lowercased()
                if !hasKnownAcronymExpansionMatch(concernText: concern, responseLower: responseLower) {
                    return true
                }
            }
        }

        if !concernTokens.isEmpty {
            let overlap = concernTokens.intersection(responseTokens).count
            let overlapRatio = Double(overlap) / Double(concernTokens.count)
            if concernTokens.count >= 2 && overlapRatio < 0.20 {
                return true
            }
        }

        let concernAcronyms = uppercaseAcronyms(in: concern + " " + (optionalBillRef ?? ""))
        if !concernAcronyms.isEmpty {
            let responseUpper = responseBlob.uppercased()
            let anyAcronymMatched = concernAcronyms.contains(where: { responseUpper.contains($0) })
            if !anyAcronymMatched {
                return true
            }
        }

        let concernLower = concern.lowercased()
        let billLower = (optionalBillRef ?? "").lowercased()
        let responseLower = responseBlob.lowercased()
        if responseLower.contains("iran")
            && !concernLower.contains("iran")
            && !billLower.contains("iran") {
            return true
        }

        if responseLower.contains("nomination")
            && !concernLower.contains("nomination")
            && !concernLower.contains("nominee")
            && !billLower.contains("nomination") {
            return true
        }

        return false
    }

    private func highSignalTopicTokens(in raw: String) -> Set<String> {
        let words = raw.lowercased()
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .map(String.init)
            .filter { $0.count >= 5 }

        let stopWords: Set<String> = [
            "about", "would", "should", "could", "please", "issue", "support",
            "oppose", "urgent", "federal", "state", "congress", "member",
            "office", "people", "their", "them", "these", "those", "which",
            "where", "while", "there", "because", "after", "before", "under",
            "over", "between", "against", "around", "request", "asking", "asked",
            "needs", "need", "action"
        ]
        return Set(words.filter { !stopWords.contains($0) })
    }

    private func hasKnownAcronymExpansionMatch(concernText: String, responseLower: String) -> Bool {
        let concernLower = concernText.lowercased()
        let knownAcronyms: [String: [String]] = [
            "lihtc": ["low-income housing tax credit", "low income housing tax credit", "housing tax credit"],
            "snap": ["supplemental nutrition assistance program", "snap benefits"],
            "aca": ["affordable care act", "obamacare"],
            "epa": ["environmental protection agency"]
        ]

        for (acronym, expansions) in knownAcronyms where concernLower.contains(acronym) {
            if expansions.contains(where: { responseLower.contains($0) }) {
                return true
            }
        }
        return false
    }

    private func semanticTopicTokens(in raw: String) -> Set<String> {
        let lower = raw.lowercased()
        let words = lower
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .map(String.init)
            .filter { $0.count >= 4 }

        let stopWords: Set<String> = [
            "that", "this", "with", "from", "about", "would", "should", "could",
            "please", "issue", "support", "oppose", "urgent", "federal", "state",
            "congress", "member", "office", "people", "their", "them", "into",
            "over", "under", "have", "been", "were", "will", "your", "public"
        ]
        let filtered = words.filter { !stopWords.contains($0) }
        return Set(filtered)
    }

    private func domainAnchors(in raw: String) -> Set<String> {
        let lower = raw.lowercased()
        var anchors = Set<String>()

        let waterAnchors = [
            "water",
            "drinking water",
            "clean water",
            "wastewater",
            "pfas",
            "lead pipes",
            "lead pipe"
        ]

        let transitAnchors = [
            "transportation",
            "transit",
            "public transit",
            "public transportation",
            "bus",
            "rail",
            "train",
            "subway",
            "metro"
        ]

        for token in waterAnchors where lower.contains(token) {
            anchors.insert(token)
        }
        for token in transitAnchors where lower.contains(token) {
            anchors.insert(token)
        }

        return anchors
    }

    private func uppercaseAcronyms(in raw: String) -> Set<String> {
        let parts = raw.split(whereSeparator: { !$0.isLetter && !$0.isNumber })
        var tokens = Set<String>()
        tokens.reserveCapacity(parts.count)

        for part in parts {
            let token = String(part)
            if token.count < 3 { continue }
            if token != token.uppercased() { continue }
            if token.rangeOfCharacter(from: .letters) == nil { continue }
            tokens.insert(token)
        }

        return tokens
    }

    private func wordCount(in text: String) -> Int {
        text
            .split(whereSeparator: { $0.isWhitespace || $0 == "\n" || $0 == "\t" })
            .count
    }

    private func fallbackRelevance(for target: CivicRepTarget, billRef: String?) -> [String] {
        var reasons: [String] = []
        switch target.slot {
        case .house:
            reasons.append("Represents your House district")
            reasons.append("House chamber relevance")
        case .senate1, .senate2:
            reasons.append("Represents your state in the Senate")
            reasons.append("Senate chamber relevance")
        }
        if let billRef, !billRef.isEmpty {
            reasons.insert("Related to \(billRef)", at: 0)
        } else {
            reasons.append("No public position found")
        }
        return reasons
    }

    private func normalizedBillReference(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let cleaned = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        guard !cleaned.isEmpty else { return nil }
        if cleaned.localizedCaseInsensitiveContains("[BILL_OR_RESOLUTION]") {
            return nil
        }
        return cleaned
    }

    private func containsCaseInsensitive(_ values: [String], value: String) -> Bool {
        values.contains { existing in
            existing.caseInsensitiveCompare(value) == .orderedSame
        }
    }

    private func suggestedBillReference(
        issueTitle: String,
        issueSummary: String,
        issueCommittees: [String],
        target: CivicRepTarget?
    ) -> String? {
        let context = "\(issueTitle) \(issueSummary)".lowercased()
        let resolutionContext = isResolutionContext(context)
        let targetCommittees = Set(
            (target?.official.committeeAssignments ?? [])
                .map(normalizeCommitteeName)
                .filter { !$0.isEmpty }
        )
        let relevantIssueCommittees = Set(
            issueCommittees
                .map(normalizeCommitteeName)
                .filter { !$0.isEmpty }
        )

        var bestTemplate: FallbackBillTemplate?
        var bestScore = Int.min

        for template in Self.fallbackBillTemplates {
            let keywordScore = template.keywords.reduce(into: 0) { partial, keyword in
                if context.contains(keyword) {
                    partial += 3
                }
            }
            let targetCommitteeScore = hasCommitteeOverlap(
                candidateCommittees: template.committees,
                normalizedCommittees: targetCommittees
            ) ? 6 : 0
            let issueCommitteeScore = hasCommitteeOverlap(
                candidateCommittees: template.committees,
                normalizedCommittees: relevantIssueCommittees
            ) ? 4 : 0
            let resolutionScore = (resolutionContext && isResolutionReference(template.reference)) ? 5 : 0

            let score = keywordScore + targetCommitteeScore + issueCommitteeScore + resolutionScore
            if score > bestScore {
                bestScore = score
                bestTemplate = template
            }
        }

        if bestScore > 0 {
            return bestTemplate?.reference
        }

        if !targetCommittees.isEmpty,
           let byTargetCommittee = Self.fallbackBillTemplates.first(where: {
               hasCommitteeOverlap(candidateCommittees: $0.committees, normalizedCommittees: targetCommittees)
           }) {
            return byTargetCommittee.reference
        }

        if !relevantIssueCommittees.isEmpty,
           let byIssueCommittee = Self.fallbackBillTemplates.first(where: {
               hasCommitteeOverlap(candidateCommittees: $0.committees, normalizedCommittees: relevantIssueCommittees)
           }) {
            return byIssueCommittee.reference
        }

        if let byKeyword = Self.fallbackBillTemplates.first(where: { template in
            template.keywords.contains(where: { context.contains($0) })
        }) {
            return byKeyword.reference
        }

        return Self.fallbackBillTemplates.first?.reference
    }

    private func hasCommitteeOverlap(candidateCommittees: [String], normalizedCommittees: Set<String>) -> Bool {
        guard !candidateCommittees.isEmpty, !normalizedCommittees.isEmpty else {
            return false
        }

        for candidate in candidateCommittees {
            let normalizedCandidate = normalizeCommitteeName(candidate)
            guard !normalizedCandidate.isEmpty else { continue }
            if normalizedCommittees.contains(where: { normalized in
                normalized.contains(normalizedCandidate) || normalizedCandidate.contains(normalized)
            }) {
                return true
            }
        }
        return false
    }

    private func isResolutionContext(_ lowercasedContext: String) -> Bool {
        let markers = ["resolution", "joint resolution", "disapproval", "s.j.res", "s.res"]
        return markers.contains { lowercasedContext.contains($0) }
    }

    private func isResolutionReference(_ reference: String) -> Bool {
        let normalized = reference.lowercased().replacingOccurrences(of: " ", with: "")
        return normalized.contains("s.j.res.") || normalized.contains("s.res.")
    }

    private struct FallbackBillTemplate {
        let reference: String
        let keywords: [String]
        let committees: [String]
    }

    private static let fallbackBillTemplates: [FallbackBillTemplate] = [
        FallbackBillTemplate(
            reference: "S.J.Res. 114 Iran War Powers Resolution",
            keywords: ["iran", "war powers", "unauthorized hostilities", "armed forces", "congressional authorization"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 112 BIS End-Use Controls Disapproval Resolution",
            keywords: ["bureau of industry and security", "end-use controls", "export controls", "disapproval", "rule"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 116 Iran War Powers Resolution",
            keywords: ["iran", "war powers", "unauthorized hostilities", "armed forces", "congressional authorization"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 118 Iran War Powers Resolution",
            keywords: ["iran", "war powers", "unauthorized hostilities", "armed forces", "congressional authorization"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 115 Iran War Powers Resolution",
            keywords: ["iran", "war powers", "unauthorized hostilities", "armed forces", "congressional authorization"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 628 Music in Our Schools Month Resolution",
            keywords: ["music in our schools", "music education", "schools", "arts education"],
            committees: ["Health, Education, Labor, and Pensions"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 627 National Slam the Scam Day Resolution",
            keywords: ["scam", "fraud", "impostor scams", "consumer protection", "public awareness"],
            committees: ["Judiciary"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 113 OCC Climate Financial Risk Disapproval Resolution",
            keywords: ["office of the comptroller", "occ", "climate-related financial risk", "bank regulation", "disapproval"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 117 Iran War Powers Resolution",
            keywords: ["iran", "war powers", "unauthorized hostilities", "armed forces", "congressional authorization"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 110 Treasury Leverage Ratio Disapproval Resolution",
            keywords: ["treasury", "supplementary leverage ratio", "bank holding companies", "financial regulation", "disapproval"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 109 Grand Staircase-Escalante Management Plan Disapproval Resolution",
            keywords: ["bureau of land management", "grand staircase-escalante", "public lands", "national monument", "management plans"],
            committees: ["Energy and Natural Resources"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 111 Federal Reserve Rating System Disapproval Resolution",
            keywords: ["federal reserve", "large financial institution rating system", "bank oversight", "financial regulation", "disapproval"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 625 Hawaiian Language Month Resolution",
            keywords: ["hawaiian language", "olelo hawaii", "language month", "cultural preservation"],
            committees: ["Judiciary"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 624 National Social and Emotional Learning Week Resolution",
            keywords: ["social and emotional learning", "sel", "schools", "students", "mental health"],
            committees: ["Health, Education, Labor, and Pensions"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 616 Human Rights in Honduras Resolution",
            keywords: ["human rights", "honduras", "oversight", "foreign policy", "state department"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 623 Team USA Ice Hockey Resolution",
            keywords: ["team usa", "ice hockey", "international competition", "sports diplomacy"],
            committees: ["Commerce, Science, and Transportation"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 612 Support for Ukraine Resolution",
            keywords: ["ukraine", "russia invasion", "support ukraine", "foreign policy", "security assistance"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 607 Marjory Stoneman Douglas Victims Resolution",
            keywords: ["marjory stoneman douglas", "school shooting", "gun violence", "victims"],
            committees: ["Judiciary"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 608 Ghislaine Maxwell Clemency Opposition Resolution",
            keywords: ["ghislaine maxwell", "clemency", "justice", "victims rights"],
            committees: ["Judiciary"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 557 Climate Financial Market Risk Resolution",
            keywords: ["climate change", "financial market", "systemic risk", "market collapse", "banking risk"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 552 Ocean Warming Resolution",
            keywords: ["oceans warming", "ocean temperature", "climate change", "marine environment"],
            committees: ["Commerce, Science, and Transportation"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 100 Caribbean and Eastern Pacific War Powers Resolution",
            keywords: ["caribbean sea", "eastern pacific", "unauthorized hostilities", "war powers", "armed forces"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 567 Foreign Censorship Opposition Resolution",
            keywords: ["foreign censorship", "free speech", "constitutionally protected speech", "civil liberties"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 565 Renewable Electricity Cost Resolution",
            keywords: ["renewable electricity", "clean energy", "energy costs", "grid", "electricity"],
            committees: ["Energy and Natural Resources"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 547 U.S.-Japan Alliance Support Resolution",
            keywords: ["u.s.-japan alliance", "japan alliance", "indo-pacific", "china pressure", "foreign policy"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 556 Florida Insurance Climate Risk Resolution",
            keywords: ["florida insurance", "insurance market", "climate risks", "property insurance"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 561 Particulate Matter Pollution Resolution",
            keywords: ["particulate matter", "pm2.5", "air pollution", "health harms", "environment"],
            committees: ["Environment and Public Works"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 555 Climate Mortgage Risk Resolution",
            keywords: ["climate change", "mortgage market", "home values", "housing risk", "financial risk"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 562 Ozone Pollution Health Harms Resolution",
            keywords: ["ozone pollution", "air quality", "public health", "reproductive harms", "environment"],
            committees: ["Environment and Public Works"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 549 Seize Shadow Fleet Russian Oil Resolution",
            keywords: ["shadow fleet", "russian oil", "sanctions enforcement", "maritime shipping", "foreign policy"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.1241 Sanctioning Russia Act of 2025",
            keywords: ["russia", "ukraine", "sanction", "international", "foreign policy"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.1032 Major Richard Star Act",
            keywords: ["armed forces", "military", "national security", "veteran", "defense"],
            committees: ["Armed Services"]
        ),
        FallbackBillTemplate(
            reference: "S.1748 Kids Online Safety Act",
            keywords: ["kids online", "online safety", "social media", "technology", "internet"],
            committees: ["Commerce, Science, and Transportation"]
        ),
        FallbackBillTemplate(
            reference: "S.1261 CONNECT for Health Act of 2025",
            keywords: ["health", "telehealth", "care access", "medicare", "coverage"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.2837 Protect America's Workforce Act",
            keywords: ["workforce", "labor", "employment", "worker", "layoff"],
            committees: ["Homeland Security and Governmental Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.1515 Affordable Housing Credit Improvement Act of 2025",
            keywords: ["housing", "rent", "homelessness", "affordability", "zoning"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.1973 Treat and Reduce Obesity Act of 2025",
            keywords: ["obesity", "nutrition", "chronic disease", "health"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.3048 TREATS Act",
            keywords: ["addiction", "opioid", "e-prescribing", "telehealth", "substance use"],
            committees: ["Health, Education, Labor, and Pensions"]
        ),
        FallbackBillTemplate(
            reference: "S.3209 NOPAIN for Veterans Act",
            keywords: ["veterans", "pain", "military health", "opioid"],
            committees: ["Veterans Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.3257 Mental Health in Aviation Act of 2025",
            keywords: ["mental health", "aviation", "airline", "pilot"],
            committees: ["Commerce, Science, and Transportation"]
        ),
        FallbackBillTemplate(
            reference: "S.847 Child Care Availability and Affordability Act",
            keywords: ["child care", "families", "caregiving", "affordability"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.932 Give Kids a Chance Act of 2025",
            keywords: ["kids", "children", "health", "pediatric"],
            committees: ["Health, Education, Labor, and Pensions"]
        ),
        FallbackBillTemplate(
            reference: "S.29 Sunshine Protection Act of 2025",
            keywords: ["sunshine", "daylight saving", "time change"],
            committees: ["Commerce, Science, and Transportation"]
        ),
        FallbackBillTemplate(
            reference: "S.1272 Trade Review Act of 2025",
            keywords: ["trade", "tariff", "import", "export", "international finance"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.179 FARM Act (Foreign Adversary Risk Management Act)",
            keywords: ["farm", "agriculture", "foreign adversary", "food security", "supply chain"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.2237 Hospital Inpatient Services Modernization Act",
            keywords: ["hospital", "inpatient", "health care", "modernization"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.41 Advanced Border Coordination Act of 2025",
            keywords: ["immigration", "border", "asylum", "homeland security"],
            committees: ["Homeland Security and Governmental Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.3281 Restoring Food Security for American Families and Farmers Act of 2025",
            keywords: ["snap", "food security", "farmers", "agriculture", "nutrition"],
            committees: ["Agriculture, Nutrition, and Forestry"]
        ),
        FallbackBillTemplate(
            reference: "S.852 Richard L. Trumka Protecting the Right to Organize Act of 2025",
            keywords: ["union", "organize", "labor", "workers rights", "collective bargaining"],
            committees: ["Health, Education, Labor, and Pensions"]
        ),
        FallbackBillTemplate(
            reference: "S.46 Health Care Affordability Act of 2025",
            keywords: ["health care", "premiums", "deductibles", "coverage", "affordability"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.51 Washington, D.C. Admission Act",
            keywords: ["dc", "statehood", "representation", "voting rights", "democracy"],
            committees: ["Homeland Security and Governmental Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.1531 Assault Weapons Ban of 2025",
            keywords: ["assault weapons", "gun violence", "firearms", "crime"],
            committees: ["Judiciary"]
        ),
        FallbackBillTemplate(
            reference: "S.3043 Military and Federal Employee Protection Act",
            keywords: ["federal employee", "military", "workforce", "public finance"],
            committees: ["Appropriations"]
        ),
        FallbackBillTemplate(
            reference: "S.2823 FAMILY Act",
            keywords: ["family leave", "paid leave", "workers", "families", "labor"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.40 Commission to Study and Develop Reparation Proposals for African Americans Act",
            keywords: ["reparations", "civil rights", "racial justice", "minority issues"],
            committees: ["Judiciary"]
        ),
        FallbackBillTemplate(
            reference: "S.2939 Child Care for Every Community Act",
            keywords: ["child care", "families", "early childhood", "community"],
            committees: ["Health, Education, Labor, and Pensions"]
        )
    ]

    private func composeScripts(
        repName: String,
        issueTitle: String,
        ask: CivicAsk,
        billRef: String?,
        zip: String,
        reasons: [String]
    ) -> (String, String, [String]) {
        let billFragment = billRef.map { " \($0)" } ?? " this issue"
        let factLine = reasons.first ?? "This issue is currently active in Congress."

        let liveBase = "Hi, my name is [Your Name], and I am a constituent in ZIP \(zip). I am calling about \(issueTitle). I'm urging \(repName) to \(ask.scriptPhrase)\(billFragment). \(factLine). Can you share the member's current position and next step on this issue? Thank you for your time."

        let voicemailBase = "Hi, constituent in ZIP \(zip) calling about \(issueTitle). I'm urging \(repName) to \(ask.scriptPhrase)\(billFragment). Please share the member's current position and next step. Thank you."

        let liveScript = trimToWordLimit(liveBase, maxWords: 90)
        let voicemailScript = trimToWordLimit(voicemailBase, maxWords: 50)

        let points: [String] = [
            "Constituent location: ZIP \(zip)",
            "Explicit ask: \(ask.title)\(billRef.map { " \($0)" } ?? " this issue")",
            "Request the office to share the member's current position"
        ]

        return (liveScript, voicemailScript, points)
    }

    private func deriveIssueTitle(from concern: String) -> String {
        let trimmed = concern.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Constituent issue" }

        if let sentenceEnd = trimmed.firstIndex(where: { [".", "!", "?", "\n"].contains($0) }) {
            let sentence = String(trimmed[..<sentenceEnd]).trimmingCharacters(in: .whitespacesAndNewlines)
            if sentence.count > 6 {
                return trimToWordLimit(sentence, maxWords: 9)
            }
        }
        return trimToWordLimit(trimmed, maxWords: 9)
    }

    private func canonicalIssueDisplayTitle(from canonicalIssue: String) -> String {
        let trimmed = canonicalIssue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }

        let tokens = trimmed
            .split(separator: "-")
            .map(String.init)
            .filter { !$0.isEmpty }

        guard !tokens.isEmpty else { return "" }

        return tokens.map { token in
            if token.count <= 3 {
                return token.uppercased()
            }
            return token.prefix(1).uppercased() + token.dropFirst().lowercased()
        }.joined(separator: " ")
    }

    private func curatedIssueBillReference(for canonicalIssue: String) -> String? {
        let key = canonicalIssue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !key.isEmpty else { return nil }

        let mapping: [String: String] = [
            "oppose-the-save-america-act": "SAVE America Act",
            "save-america-act": "SAVE America Act",
            "stop-unauthorized-military-strikes-on-iran": "War Powers Resolution"
        ]
        return mapping[key]
    }

    private func inferredIssueCommittees(
        canonicalIssue: String,
        concernText: String,
        currentStatus: String
    ) -> [String] {
        let key = canonicalIssue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let context = "\(key) \(concernText.lowercased()) \(currentStatus.lowercased())"

        func containsAny(_ tokens: [String]) -> Bool {
            tokens.contains { context.contains($0) }
        }

        var committees: [String] = []
        if containsAny(["crypto", "cryptocurrency", "digital asset", "stablecoin", "token"]) {
            committees.append(contentsOf: ["Banking, Housing, and Urban Affairs", "Financial Services", "Agriculture"])
        }
        if containsAny(["tsa", "aviation", "airport", "checkpoint", "travel delays"]) {
            committees.append(contentsOf: ["Commerce, Science, and Transportation", "Homeland Security"])
        }
        if containsAny(["flood", "fema", "disaster", "recovery"]) {
            committees.append(contentsOf: ["Appropriations", "Homeland Security", "Transportation and Infrastructure"])
        }
        if containsAny(["war powers", "iran", "foreign policy", "military"]) {
            committees.append(contentsOf: ["Foreign Relations", "Armed Services"])
        }
        if containsAny(["oversight", "accountability", "executive", "white house", "presidential"]) {
            committees.append(contentsOf: ["Judiciary", "Oversight and Government Reform", "Homeland Security and Governmental Affairs"])
        }

        var ordered: [String] = []
        for item in committees {
            let cleaned = item.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !cleaned.isEmpty else { continue }
            if !ordered.contains(where: { normalizeCommitteeName($0) == normalizeCommitteeName(cleaned) }) {
                ordered.append(cleaned)
            }
        }
        return ordered
    }

    private static func buildRepTargets(from federalReps: [Official]) -> [CivicRepTarget] {
        let senators = federalReps
            .filter { official in
                let title = (official.officeTitle ?? "").lowercased()
                if title.contains("senator") { return true }
                let division = (official.divisionId ?? "").lowercased()
                return division.contains("/state:") && !division.contains("/cd:")
            }
            .sorted { lhs, rhs in
                let lhsRank = senateClassRank(for: lhs)
                let rhsRank = senateClassRank(for: rhs)
                if lhsRank != rhsRank {
                    return lhsRank < rhsRank
                }
                return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
            }
        var seenSenatorNameKeys = Set<String>()
        let uniqueSenators = senators.filter { senator in
            let nameKey = Self.normalizeNameKey(senator.name)
            guard !nameKey.isEmpty else { return true }
            return seenSenatorNameKeys.insert(nameKey).inserted
        }

        let house = federalReps.first {
            let title = ($0.officeTitle ?? "").lowercased()
            if title.contains("representative") || title.contains("congress") { return true }
            let division = ($0.divisionId ?? "").lowercased()
            if division.contains("/cd:") { return true }
            return false
        }

        var targets: [CivicRepTarget] = []
        if let house {
            targets.append(CivicRepTarget(slot: .house, official: house))
        }
        if uniqueSenators.indices.contains(0) {
            targets.append(CivicRepTarget(slot: .senate1, official: uniqueSenators[0]))
        }
        if uniqueSenators.indices.contains(1) {
            targets.append(CivicRepTarget(slot: .senate2, official: uniqueSenators[1]))
        }

        if targets.isEmpty {
            for (index, rep) in federalReps.prefix(3).enumerated() {
                let slot: CivicRepSlot = index == 0 ? .house : (index == 1 ? .senate1 : .senate2)
                targets.append(CivicRepTarget(slot: slot, official: rep))
            }
        }

        return targets
    }

    private static func senateClassRank(for official: Official) -> Int {
        let upper = (official.officeTitle ?? "")
            .uppercased()
            .replacingOccurrences(of: "CLASS", with: " ")
        let token = upper
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .first(where: { !$0.isEmpty && ($0 == "I" || $0 == "II" || $0 == "III" || $0 == "1" || $0 == "2" || $0 == "3") })

        switch token {
        case "I", "1":
            return 1
        case "II", "2":
            return 2
        case "III", "3":
            return 3
        default:
            return 99
        }
    }

    private func normalizedBriefs(
        _ briefs: [CivicCallBrief],
        fallbackIssueID: String,
        regenerateIDs: Bool = false
    ) -> [CivicCallBrief] {
        var seenIDs = Set<String>()
        var normalized: [(index: Int, brief: CivicCallBrief)] = []

        for (index, brief) in briefs.enumerated() {
            let baseID: String
            if regenerateIDs {
                baseID = UUID().uuidString
            } else {
                let trimmedID = brief.id.trimmingCharacters(in: .whitespacesAndNewlines)
                baseID = trimmedID.isEmpty ? UUID().uuidString : trimmedID
            }
            let uniqueID = seenIDs.insert(baseID).inserted ? baseID : "\(baseID)-\(index)"

            let nameKey = Self.normalizeNameKey(brief.repName)
            let resolvedSlot = brief.repSlot ?? slotByRepID[brief.repID] ?? slotByName[nameKey]
            let resolvedIssueID = resolvedIssueIdentifier(
                preferredIssueID: brief.issueID,
                issueTitle: issueTitle,
                issueSummary: issueSummary,
                fallbackIssueID: fallbackIssueID
            )

            let normalizedBrief = CivicCallBrief(
                id: uniqueID,
                repID: brief.repID,
                repName: brief.repName,
                officeType: brief.officeType,
                primaryPhoneNumber: brief.primaryPhoneNumber,
                localOfficePhoneNumber: brief.localOfficePhoneNumber,
                relevanceBadges: brief.relevanceBadges,
                relatedBills: brief.relatedBills,
                relatedCommittees: brief.relatedCommittees,
                liveScript: brief.liveScript,
                voicemailScript: brief.voicemailScript,
                talkingPoints: brief.talkingPoints,
                issueID: resolvedIssueID,
                repSlot: resolvedSlot
            )

            normalized.append((index, normalizedBrief))
        }

        let defaultOrder: [CivicRepSlot: Int] = [
            .house: 0,
            .senate1: 1,
            .senate2: 2
        ]

        return normalized
            .sorted { lhs, rhs in
                let lRank = lhs.brief.repSlot.flatMap { defaultOrder[$0] } ?? 99
                let rRank = rhs.brief.repSlot.flatMap { defaultOrder[$0] } ?? 99
                if lRank != rRank {
                    return lRank < rRank
                }
                return lhs.index < rhs.index
            }
            .map(\.brief)
    }

    private func resolvedIssueIdentifier(
        preferredIssueID: String?,
        issueTitle: String,
        issueSummary: String,
        fallbackIssueID: String? = nil
    ) -> String {
        let preferred = preferredIssueID?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !preferred.isEmpty {
            return preferred
        }

        if let fallbackIssueID {
            let normalizedFallback = fallbackIssueID.trimmingCharacters(in: .whitespacesAndNewlines)
            if !normalizedFallback.isEmpty {
                return normalizedFallback
            }
        }

        if let slug = slugifiedIssueIdentifier(from: issueTitle) {
            return slug
        }
        if let slug = slugifiedIssueIdentifier(from: issueSummary) {
            return slug
        }

        return UUID().uuidString
    }

    private func slugifiedIssueIdentifier(from raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let lowercased = trimmed.lowercased()
        let slug = lowercased
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))

        guard !slug.isEmpty else { return nil }
        return String(slug.prefix(80))
    }

    private static func normalizeNameKey(_ raw: String) -> String {
        raw
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }

    private func isSafetyBlockedError(_ error: Error) -> Bool {
        let lower = (error as NSError).localizedDescription.lowercased()
        return lower.contains("safety_blocked")
            || (lower.contains("disallowed") && lower.contains("safety"))
            || (lower.contains("harmful") && lower.contains("request"))
    }

    private func resolveFailureMessage(for error: Error) -> String {
        let raw = (error as NSError).localizedDescription
        let lower = raw.lowercased()

        if lower.contains("unexpected script payload")
            || lower.contains("decode")
            || lower.contains("invalid response format") {
            return "The civic API responded, but in an unexpected format. Using a safe local draft for now."
        }
        if lower.contains("requested path is invalid")
            || lower.contains("status 404")
            || lower.contains("badurl") {
            return "Civic API is not configured yet. Set CIVIC_API_BASE_URL to your deployed civic backend. Using offline call briefs for now."
        }
        if lower.contains("timed out") || lower.contains("timeout") {
            return "The civic API took too long to respond. Using offline call briefs for now."
        }
        if lower.contains("authentication required")
            || lower.contains("invalid or expired token")
            || lower.contains("status 401")
            || lower.contains("status 403") {
            return "Session expired. Please reopen VoteNow and try generating again."
        }

        return "Using offline call briefs while the civic API is unavailable."
    }

    private func compactLogError(_ error: Error) -> String {
        let nsError = error as NSError
        let compact = nsError.localizedDescription
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let snippet = String(compact.prefix(240))
        if compact.count > 240 {
            return "\(nsError.domain)#\(nsError.code) \(snippet)..."
        }
        return "\(nsError.domain)#\(nsError.code) \(snippet)"
    }

    private func userIDForRequest() async -> String {
        if let id = await SupabaseManager.shared.currentUserIDIfAvailable() {
            return id.uuidString
        }
        return UUID().uuidString
    }
}

func stableRepID(for official: Official) -> String {
    [
        official.name.lowercased(),
        (official.divisionId ?? "").lowercased(),
        (official.officeTitle ?? "").lowercased()
    ].joined(separator: "|")
        .replacingOccurrences(of: " ", with: "_")
        .replacingOccurrences(of: "/", with: "_")
        .replacingOccurrences(of: ":", with: "_")
        .replacingOccurrences(of: ",", with: "_")
        .replacingOccurrences(of: ".", with: "_")
}

func stateCodeFromDivisionID(_ divisionID: String?) -> String? {
    guard let divisionID,
          let stateRange = divisionID.lowercased().range(of: "/state:") else {
        return nil
    }
    let suffix = divisionID[stateRange.upperBound...]
    let code = suffix.prefix { $0.isLetter }
    guard code.count == 2 else { return nil }
    return String(code).uppercased()
}

func trimToWordLimit(_ text: String, maxWords: Int) -> String {
    let words = text
        .split(whereSeparator: { $0.isWhitespace || $0 == "\n" || $0 == "\t" })
        .map(String.init)
    guard words.count > maxWords else { return text }
    return words.prefix(maxWords).joined(separator: " ")
}
