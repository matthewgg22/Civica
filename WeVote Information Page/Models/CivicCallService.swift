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
    private let baseURL: URL
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder: JSONDecoder
    private let logger = Logger(subsystem: "VoteNow", category: "CivicIssueCallAPIClient")
    // Render free instances can cold-start slowly; allow enough time before failing.
    private let requestTimeout: TimeInterval = 65

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
                officeType: officeType.isEmpty ? (slot == .house ? "U.S. Representative" : "U.S. Senator") : officeType,
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
            let responseBody = String(data: data, encoding: .utf8) ?? ""
            throw NSError(domain: "CivicIssueCallAPIClient", code: http.statusCode, userInfo: [
                NSLocalizedDescriptionKey: responseBody.isEmpty
                ? "API request failed with status \(http.statusCode)"
                : "status \(http.statusCode): \(responseBody)"
            ])
        }
        return data
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
    private let zipFallbackToken = "[ZIPCODE]"

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

    func loadExamplesAndHistory() async {
        let userID = await userIDForRequest()
        let localFallback = fallbackExamples()
        if examples.isEmpty, !localFallback.isEmpty {
            examples = localFallback
        }

        async let remoteExamplesTask: [CivicExampleIssueCard] = apiClient.fetchExamples(userID: userID, reps: repTargets)
        async let historyTask: [CivicHistoryGroup] = apiClient.fetchHistory(userID: userID)

        do {
            let remoteExamples = try await remoteExamplesTask
            let mergedExamples = mergePremadeExamples(remote: remoteExamples, local: localFallback)
            if !mergedExamples.isEmpty || examples.isEmpty {
                examples = mergedExamples
            }
        } catch {
            if examples.isEmpty {
                examples = localFallback
            }
        }

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

    private func mergePremadeExamples(
        remote: [CivicExampleIssueCard],
        local: [CivicExampleIssueCard]
    ) -> [CivicExampleIssueCard] {
        var mergedByKey: [String: CivicExampleIssueCard] = [:]
        var orderedKeys: [String] = []

        for card in remote + local {
            let key = premadeExampleMergeKey(for: card)
            guard !key.isEmpty else { continue }

            if let existing = mergedByKey[key] {
                if premadeExampleQualityScore(card) > premadeExampleQualityScore(existing) {
                    mergedByKey[key] = card
                }
                continue
            }

            mergedByKey[key] = card
            orderedKeys.append(key)
        }

        return orderedKeys.compactMap { mergedByKey[$0] }
    }

    private func premadeExampleMergeKey(for card: CivicExampleIssueCard) -> String {
        let slug = card.slug?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        if !slug.isEmpty { return slug }

        let issueID = card.id.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !issueID.isEmpty { return issueID }

        return card.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func premadeExampleQualityScore(_ card: CivicExampleIssueCard) -> Int {
        var score = 0
        score += premadeWordCount(card.liveScript) * 2
        score += premadeWordCount(card.voicemailScript)
        score += premadeWordCount(card.summary)
        score += card.relatedBills.count * 14
        score += card.tags.count * 4
        if let supporter = card.supporterVariant, !supporter.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            score += 8
        }
        if let undecided = card.undecidedVariant, !undecided.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            score += 8
        }
        if let staffer = card.stafferVariant, !staffer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            score += 8
        }
        if let footer = card.voicemailFooter, !footer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            score += 6
        }
        return score
    }

    private func premadeWordCount(_ text: String) -> Int {
        text.split { $0.isWhitespace || $0.isNewline }.count
    }

    func submitAssistantRequest() async {
        errorMessage = nil
        guard let ask = selectedAsk else {
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
        let trimmedBill = optionalBillRef.trimmingCharacters(in: .whitespacesAndNewlines)
        let userID = await userIDForRequest()
        prepareForFreshGeneration()

        do {
            let package = try await apiClient.createScriptPackage(
                userID: userID,
                concernText: trimmedConcern,
                selectedAsk: ask,
                targetReps: requestRepSlots,
                repTargets: repTargets,
                optionalBillRef: trimmedBill.isEmpty ? nil : trimmedBill,
                userZip: requestUserZip,
                userState: resolvedUserState
            )

            switch package.status {
            case .ok:
                let response = resolutionFromScriptPackage(
                    package,
                    concernText: trimmedConcern,
                    ask: ask,
                    selectedSlots: requestRepSlots,
                    optionalBillRef: trimmedBill.isEmpty ? nil : trimmedBill
                )
                let vetted = vettedGeneratedResolution(
                    response,
                    concernText: trimmedConcern,
                    ask: ask,
                    selectedSlots: requestRepSlots,
                    optionalBillRef: trimmedBill.isEmpty ? nil : trimmedBill
                )
                let finalResponse = vetted.resolution
                if vetted.usedFallback {
                    logger.warning("Discarded off-topic or unsafe MAPC package and rebuilt a local draft.")
                    errorMessage = clarificationPromptForConcern(
                        trimmedConcern,
                        optionalBillRef: trimmedBill.isEmpty ? nil : trimmedBill,
                        selectedAsk: ask
                    )
                }
                applyResolution(finalResponse)
                pendingGeneratedResolution = finalResponse
                lastGeneratedPackageID = package.packageID
                requiresDraftApproval = true
                saveSnapshot()
                selectedRepFilter = .all
                selectedTab = .assistant
                isSubmitting = false
                Task { [userID] in
                    await self.refreshCallScoreData(for: userID)
                }
            case .needsClarification:
                pendingGeneratedResolution = nil
                lastGeneratedPackageID = nil
                requiresDraftApproval = false
                let hint = package.reviewRegenerateHint.trimmingCharacters(in: .whitespacesAndNewlines)
                if hint.isEmpty {
                    errorMessage = "Please clarify your requested congressional action, then try again."
                } else {
                    errorMessage = "\(hint)\n\nUpdate your concern with that action, then tap Generate again."
                }
            case .refused:
                pendingGeneratedResolution = nil
                lastGeneratedPackageID = nil
                requiresDraftApproval = false
                errorMessage = package.truthTrace?.refusalReason ?? package.reviewRegenerateHint
            }
        } catch {
            if isSafetyBlockedError(error) {
                pendingGeneratedResolution = nil
                requiresDraftApproval = false
                errorMessage = "We can't generate scripts for harmful, hateful, or violent requests."
                return
            }

            let fallback = fallbackResolution(
                concernText: trimmedConcern,
                ask: ask,
                selectedSlots: requestRepSlots,
                optionalBillRef: trimmedBill.isEmpty ? nil : trimmedBill
            )
            applyResolution(fallback)
            pendingGeneratedResolution = fallback
            lastGeneratedPackageID = nil
            requiresDraftApproval = true
            saveSnapshot()
            selectedRepFilter = .all
            errorMessage = resolveFailureMessage(for: error)
            isSubmitting = false
            Task { [userID] in
                await self.refreshCallScoreData(for: userID)
            }
        }
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

    func prepareForFreshGeneration() {
        clearDisplayedDraftBeforeNewGeneration()
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        activeMAPCSessionID = nil
        selectedRepFilter = .all
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

        Task { [apiClient] in
            let userID = await self.userIDForRequest()
            do {
                try await apiClient.logScriptChatTurn(
                    userID: userID,
                    sessionID: sessionID,
                    packageID: packageID,
                    role: normalizedRole,
                    turnIndex: turnIndex,
                    messageText: normalizedText,
                    messageType: (normalizedType?.isEmpty == false) ? normalizedType : nil
                )
            } catch {
                self.logger.error("Failed to log script chat turn: \(String(describing: error), privacy: .public)")
            }
        }
    }

    func resetScriptChatSession() {
        scriptChatSessionID = nil
        scriptChatTurnIndex = 0
    }

    func approveGeneratedDraft() {
        let packageID = lastGeneratedPackageID
        let chosenOption = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalScript = pendingGeneratedResolution?.callBriefs.first?.liveScript
        if let pendingGeneratedResolution {
            appendHistory(for: pendingGeneratedResolution)
        }
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        lastGeneratedPackageID = nil
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
                    self.logger.error("Failed to log script feedback (accurate): \(String(describing: error), privacy: .public)")
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
        issueTitle = ""
        issueSummary = ""
        resolvedEntities = .empty
        callBriefs = []
        activeBriefID = nil
        selectedTab = .assistant
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
                    self.logger.error("Failed to log script feedback (revise): \(String(describing: error), privacy: .public)")
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

    private func fallbackExamples() -> [CivicExampleIssueCard] {
        guard !repTargets.isEmpty else { return [] }
        struct Seed {
            let id: String
            let title: String
            let category: String
            let targetChambers: [String]
            let primaryAsk: String
            let summary: String
            let liveScript: String
            let voicemailScript: String
            let templateAsks: [CivicAsk]
            let relatedBills: [String]
            let tags: [String]
        }

        let sharedSupporter = "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you."
        let sharedUndecided = "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible."
        let sharedStaffer = "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent."
        let sharedVoicemailFooter = "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied."
        let placeholders = ["[YOUR_NAME]", "[CITY]", "[ZIP]", "[FULL_ADDRESS]", "[OFFICIAL_TITLE]", "[OFFICIAL_LAST]", "[BILL_OR_RESOLUTION]"]

        let availableChambers: Set<String> = Set(
            repTargets.map { $0.slot == .house ? "house" : "senate" }
        )

        let seeds: [Seed] = [
            Seed(
                id: "stop-unauthorized-military-strikes-on-iran",
                title: "Stop Unauthorized Military Strikes on Iran",
                category: "Foreign Affairs",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "On March 4-5, 2026, the Senate voted 53-47 and the House voted 219-212 against war-powers measures that would have required congressional authorization for hostilities against Iran. Reuters noted that the 1973 War Powers Resolution still gives the administration only 60 days to continue unauthorized military action, putting a deadline at the end of April 2026 unless Congress approves it. The issue is whether Congress will reassert its constitutional role before the conflict widens.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support [BILL_OR_RESOLUTION] and oppose any unauthorized U.S. war with Iran. Congress must reassert its constitutional authority and prevent further escalation without a vote.\n\nPlease speak out publicly, support immediate de-escalation, and vote to block any continued military action that has not been authorized by Congress.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, my name is [YOUR_NAME], and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support [BILL_OR_RESOLUTION] and oppose unauthorized military action against Iran. The United States should not be pulled deeper into another war without congressional approval.\n\nPlease take public action to defend Congress's war powers and push for de-escalation.\n\nThank you.",
                templateAsks: [.support, .askPublicStatement, .seekOversight],
                relatedBills: ["[BILL_OR_RESOLUTION]"],
                tags: ["foreign-policy", "war-powers", "congress", "deescalation", "iran"]
            ),
            Seed(
                id: "protect-trans-rights-and-gender-affirming-care",
                title: "Protect Trans Rights and Gender-Affirming Care",
                category: "LGBTQ",
                targetChambers: ["house", "senate"],
                primaryAsk: "oppose",
                summary: "Kansas became the 27th state to enact restrictions on gender-affirming care for minors, even as the APA continues to support \"unobstructed access\" to evidence-based care and the Endocrine Society says this care is \"needed and often life-saving.\" On March 19, 2026, a federal judge said he would block HHS from using RFK Jr.'s declaration to threaten providers, in a case brought by 19 states and Washington, D.C.; those states said three hospitals had already been referred to HHS's inspector general. The issue is whether federal policy will override major medical guidance and state protections.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to defend transgender people and oppose federal attacks on gender-affirming care. Please oppose any ban on care, reject anti-trans censorship bills like [BILL_OR_RESOLUTION], and fight policies that strip trans people of safety, dignity, and medically necessary treatment.\n\nTrans people deserve evidence-based care and equal protection under the law, not political targeting.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\nI'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to protect trans rights and oppose new federal restrictions on gender-affirming care and anti-LGBTQ censorship. Please speak out publicly and vote against measures that harm transgender people and their families.\n\nThank you.",
                templateAsks: [.oppose, .askPublicStatement, .support],
                relatedBills: ["[BILL_OR_RESOLUTION]"],
                tags: ["trans-rights", "lgbtq", "healthcare", "civil-rights", "anti-discrimination"]
            ),
            Seed(
                id: "demand-the-resignation-of-fbi-director-kash-patel",
                title: "Demand the Resignation of FBI Director Kash Patel",
                category: "Government Oversight",
                targetChambers: ["house", "senate"],
                primaryAsk: "seek_oversight",
                summary: "In March 2026, Reuters reported that a special-counsel probe had sought more than two years of Patel's phone records, text logs, IP data, and financial information, with subpoenas covering periods from October 1, 2020, to February 22, 2023, and from January 1, 2021, to November 23, 2023. Days earlier, two former FBI agents sued Patel, saying they were fired over work on the \"Arctic Frost\" election investigation and had been unable to find new employment since. The issue is whether Congress treats this as an oversight crisis involving retaliation, management, or both.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to demand FBI Director Kash Patel's resignation and support aggressive oversight into his conduct. Reports about misuse of government resources, retaliation, and mismanagement at the FBI are serious and demand a response.\n\nIf Patel refuses to resign, [OFFICIAL_TITLE] [OFFICIAL_LAST] should support formal investigations and pursue every available accountability measure.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to call for Kash Patel's resignation and back immediate oversight of his conduct as FBI director. The bureau should never be used as a tool for personal privilege or political retaliation.\n\nPlease take public action on this issue.\n\nThank you.",
                templateAsks: [.seekOversight, .askPublicStatement, .oppose],
                relatedBills: [],
                tags: ["oversight", "fbi", "accountability", "corruption", "rule-of-law"]
            ),
            Seed(
                id: "oppose-steve-pearce-as-blm-director",
                title: "Oppose Steve Pearce as Bureau of Land Management Director",
                category: "Nominations",
                targetChambers: ["senate"],
                primaryAsk: "vote_no",
                summary: "Trump nominated Stevan Pearce on November 5, 2025 to run the Bureau of Land Management, the agency that oversees 245 million acres of public land. Reuters noted Pearce, 78, comes from New Mexico, has long backed expanded oil production, and previously owned an oilfield services company; as BLM director he would oversee leasing for oil and gas, mining, grazing, and renewable energy. The issue is whether the Senate wants a BLM chief aligned more with extraction or stewardship.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge Senator [OFFICIAL_LAST] to oppose Steve Pearce's confirmation as Director of the Bureau of Land Management. His record shows too much alignment with oil and gas interests and too little commitment to protecting public lands for future generations.\n\nPlease vote no on his confirmation and speak out in defense of our public lands.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME], and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to ask Senator [OFFICIAL_LAST] to oppose Steve Pearce for BLM director. This position should go to someone committed to stewardship of public lands, not someone whose record raises concerns about extraction and selloffs.\n\nThank you.",
                templateAsks: [.voteNo, .oppose, .askPublicStatement],
                relatedBills: [],
                tags: ["nominations", "public-lands", "environment", "senate", "blm"]
            ),
            Seed(
                id: "oppose-the-save-america-act",
                title: "Oppose the SAVE America Act",
                category: "Voter Rights",
                targetChambers: ["senate"],
                primaryAsk: "oppose",
                summary: "On February 11, 2026, the House passed the SAVE America Act by 218-213, and Reuters said it then faced a likely 60-vote Senate hurdle. Reuters also reported that about 12% of Americans do not have easy access to either a passport or birth certificate, and about 21 million eligible voters lack easy access to citizenship documents; AP noted that only five states issue enhanced driver's licenses that prove citizenship. The issue is whether proof-of-citizenship rules solve a meaningful problem or create documentation barriers for eligible voters.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge Senator [OFFICIAL_LAST] to oppose the SAVE America Act and any effort to force it through the Senate. This bill would create unnecessary documentation barriers that make it harder for eligible citizens to register and vote.\n\nPlease defend voting rights, reject this bill, and oppose any attempt to make voting less accessible for lawful voters.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\nI'm calling to ask Senator [OFFICIAL_LAST] to oppose the SAVE America Act. Eligible Americans should not lose access to the ballot because of burdensome paperwork requirements.\n\nPlease vote no and speak out against this bill.\n\nThank you.",
                templateAsks: [.oppose, .voteNo, .askPublicStatement],
                relatedBills: [],
                tags: ["voting-rights", "democracy", "senate", "ballot-access", "elections"]
            ),
            Seed(
                id: "oppose-casey-means-for-surgeon-general",
                title: "Oppose Casey Means for U.S. Surgeon General",
                category: "Nominations",
                targetChambers: ["senate"],
                primaryAsk: "vote_no",
                summary: "Casey Means's nomination has stalled after a February hearing where Reuters reported her Oregon medical license is inactive, she left her surgical residency early, and she declined to disavow RFK Jr.'s debunked autism-vaccine claim even while expressing support for measles vaccination. AP reported that senators from both parties questioned her qualifications and vaccine views, and that the confirmation process had stretched to roughly 300 days. The issue is whether the Senate wants a surgeon general with traditional public-health credentials or a more heterodox wellness profile.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge Senator [OFFICIAL_LAST] to oppose Casey Means for U.S. Surgeon General. This role should go to someone with strong public health credibility, clear support for evidence-based medicine, and full public trust.\n\nPlease vote no on this nomination and speak out for qualified, science-based public health leadership.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\nI'm calling to ask Senator [OFFICIAL_LAST] to oppose Casey Means for Surgeon General. The country needs trusted, evidence-based public health leadership in this role.\n\nPlease vote no on this nomination.\n\nThank you.",
                templateAsks: [.voteNo, .oppose, .askPublicStatement],
                relatedBills: [],
                tags: ["nominations", "public-health", "senate", "science", "surgeon-general"]
            ),
            Seed(
                id: "support-tps-extension-for-haitians",
                title: "Support Temporary Protected Status for Haitians",
                category: "Immigration",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "On March 16, 2026, the Supreme Court agreed to hear the administration's attempt to end TPS for more than 350,000 Haitians, but left lower-court protections in place for now. Reuters notes that the State Department still warns Americans not to travel to Haiti because of kidnapping, crime, terrorist activity, civil unrest, and limited healthcare; meanwhile, the U.N. reported 5,519 people killed between March 1, 2025, and January 15, 2026, and IOM reported that more than 1.4 million people have been displaced. The issue is whether the U.S. should withdraw protections while conditions remain this severe.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support continued Temporary Protected Status for Haitians and oppose any effort to strip those protections away.\n\nPlease speak out publicly, support every available legislative and oversight tool to protect Haitian TPS holders, and reject deportation policies that would put families at risk.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support TPS protections for Haitians and oppose efforts to end them. Haitian families deserve stability and protection, not more fear and uncertainty.\n\nThank you.",
                templateAsks: [.support, .askPublicStatement, .seekOversight],
                relatedBills: [],
                tags: ["immigration", "tps", "haiti", "humanitarian", "deportation"]
            ),
            Seed(
                id: "protest-the-epa-repeal-of-the-endangerment-finding",
                title: "Protest the EPA's Repeal of the Endangerment Finding",
                category: "Environment",
                targetChambers: ["house", "senate"],
                primaryAsk: "oppose",
                summary: "On February 12, 2026, EPA repealed the 2009 endangerment finding that underpins federal greenhouse-gas regulation. On March 19, 2026, 23 states and 14 cities and counties sued to reverse the move, and Reuters noted the rollback also swept in vehicle greenhouse-gas rules for model years 2012 through 2027. The issue is whether Congress and the courts will allow the federal government to dismantle the legal basis for national climate rules.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to oppose the repeal of the EPA's endangerment finding and defend strong federal climate protections.\n\nPlease support aggressive oversight and legislation to restore meaningful greenhouse-gas standards and protect communities from dangerous pollution.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\nI'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to oppose the repeal of the EPA's endangerment finding and defend strong climate and public-health protections.\n\nPlease take public action on this issue.\n\nThank you.",
                templateAsks: [.oppose, .seekOversight, .askPublicStatement],
                relatedBills: [],
                tags: ["climate", "epa", "pollution", "public-health", "environment"]
            ),
            Seed(
                id: "block-trumps-push-to-take-control-of-greenland",
                title: "Block Trump's Push to Take Control of Greenland",
                category: "Foreign Affairs",
                targetChambers: ["house", "senate"],
                primaryAsk: "oppose",
                summary: "On February 2, 2026, Greenland Prime Minister Jens-Frederik Nielsen said Washington still fundamentally sought control of Greenland and called the pressure \"completely unacceptable.\" Reuters also reported the standoff was serious enough to show up in a Greenland mental-health survey measuring anxiety over U.S. pressure. The issue is whether Congress should block any funding or authorization for coercive action against an autonomous Danish territory and NATO partner.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to reject any attempt by the administration to seize, pressure, or coerce Greenland.\n\nThe United States should respect Greenlandic and Danish sovereignty, protect our alliances, and make clear that Congress will not support reckless attempts to take control of allied territory.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to oppose any U.S. attempt to take control of Greenland and to defend allied sovereignty and international stability.\n\nPlease speak out publicly on this issue.\n\nThank you.",
                templateAsks: [.oppose, .askPublicStatement, .support],
                relatedBills: [],
                tags: ["foreign-policy", "greenland", "sovereignty", "diplomacy", "congress"]
            ),
            Seed(
                id: "protect-state-level-ai-regulation",
                title: "Protect State-Level AI Regulation",
                category: "Digital Rights",
                targetChambers: ["house", "senate"],
                primaryAsk: "oppose",
                summary: "On March 20, 2026, the White House released a national AI framework that explicitly calls on Congress to preempt state AI rules, after Trump had already threatened in December 2025 to withhold federal broadband funds from states whose AI laws the administration views as too restrictive. NCSL says all 50 states introduced AI legislation in 2025 and 38 states enacted about 100 measures; Reuters also reported the Senate voted 99-1 in July 2025 to strip a proposed 10-year federal moratorium on state AI laws. The issue is whether states keep regulating AI until Congress passes a durable federal standard.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to protect states' ability to regulate artificial intelligence and oppose any federal effort to punish states for passing basic AI safeguards.\n\nCongress should not strip states of the power to enact consumer protections while federal law remains incomplete. Please oppose preemption and any funding threats tied to state AI regulation.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\nI'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to protect state authority to regulate AI and oppose efforts to override state safeguards or threaten funding.\n\nPlease defend the ability of states to protect their residents.\n\nThank you.",
                templateAsks: [.oppose, .askPublicStatement, .seekOversight],
                relatedBills: [],
                tags: ["ai", "digital-rights", "consumer-protection", "states-rights", "tech-policy"]
            ),
            Seed(
                id: "protect-snap-food-security-and-family-farmers",
                title: "Protect SNAP, Food Security, and Family Farmers",
                category: "Agriculture",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "Starting October 1, 2026, states' share of SNAP administrative costs rises to 75% from 50%, and starting October 1, 2027, states with payment-error rates above 6% can be required to cover 5% to 15% of SNAP benefits that the federal government had previously paid in full. Reuters estimated those changes could shift about $22 billion in SNAP costs to states and localities, and the program serves more than 41 million people. At the same time, USDA forecasts 2026 net farm income at $153.4 billion, down 0.7%, even with $44.3 billion in direct government payments that are expected to account for nearly 29% of farm income. The issue is whether Congress can protect both food assistance and family-farm stability without pushing more of the cost onto states or low-income households.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support a farm bill that protects SNAP, strengthens food security, and helps family farmers rather than shifting big new costs to states.\n\nPlease oppose harmful cuts or cost-shifts and support a final bill that keeps food assistance strong and rural communities stable.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support a farm bill that protects SNAP, strengthens food security, and helps family farmers instead of shifting new costs to states.\n\nThank you for your time and consideration.",
                templateAsks: [.support, .askPublicStatement, .seekOversight],
                relatedBills: [],
                tags: ["farm-bill", "snap", "food-security", "family-farmers", "agriculture"]
            ),
            Seed(
                id: "protect-pell-grants-and-affordable-student-aid",
                title: "Protect Pell Grants and Affordable Student Aid",
                category: "Education",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "In February 2026, CBO-based projections showed the Pell Grant program facing a $5.4 billion funding gap in FY2026 and nearly an $11.5 billion shortfall in FY2027, even after a $10.5 billion one-time funding injection in the 2025 law. TICAS says more than 7 million students rely on Pell each year, and CRFB says the cumulative 10-year shortfall could reach $104 billion to $132 billion, with the risk of disrupting full awards by the 2028-2029 school year if Congress does not act. The policy question is whether lawmakers close the gap with new funding or by cutting award amounts or eligibility.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to protect Pell Grants and student-aid programs and avoid changes that make college or job training harder to afford.\n\nStudents and working adults need real access to education and job training, not new barriers or higher costs.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to protect Pell Grants and student-aid programs and avoid changes that make college or job training harder to afford.\n\nThank you for your time and consideration.",
                templateAsks: [.support, .askPublicStatement, .seekOversight],
                relatedBills: [],
                tags: ["education", "pell-grants", "student-aid", "college-affordability", "job-training"]
            ),
            Seed(
                id: "invest-in-climate-resilience-grid-and-insurance-stability",
                title: "Invest in Climate Resilience and Insurance Stability",
                category: "Environment",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "NOAA counts 403 U.S. weather and climate disasters with losses above $1 billion from 1980 through 2024, and the annual average has risen to 23 events over the last five years versus 9 over the full period. Swiss Re projects global insured catastrophe losses of about $148 billion in 2026, with a severe-year scenario as high as $320 billion, while NERC says winter peak electricity demand in the U.S. and Canada is expected to grow by 245 gigawatts over the next decade. After a court order, FEMA reopened its BRIC resilience program on March 26, 2026 with $1 billion in grants, reversing a cancellation that had frozen about $3.6 billion. The issue is whether federal policy keeps paying mainly after disasters or invests earlier in resilience, grid reliability, and insurance-market stability.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to invest in resilience, grid reliability, and insurance-market stability so disaster costs do not keep falling on households.\n\nPlease support policies that help communities prepare for climate disasters instead of leaving families to absorb the damage alone.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to invest in resilience, grid reliability, and insurance-market stability so disaster costs do not keep falling on households.\n\nThank you for your time and consideration.",
                templateAsks: [.support, .askPublicStatement, .seekOversight],
                relatedBills: [],
                tags: ["climate", "resilience", "insurance", "grid-reliability", "disasters"]
            ),
            Seed(
                id: "support-fair-maps-and-election-guardrails",
                title: "Support Fair Maps and Transparent Election Rules",
                category: "Democracy",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "In March 2026, Reuters described a national mid-decade redistricting fight after Trump pressed Republican-led states to redraw congressional maps ahead of the midterms. On March 25, 2026, the Missouri Supreme Court upheld a new congressional map in a 4-3 decision; Missouri had previously elected 6 Republicans and 2 Democrats under its post-2020 map, and opponents submitted more than 300,000 signatures seeking to force a statewide vote on the redraw. AP also reported that Utah's Trump-backed effort to repeal the state's 2018 anti-gerrymandering law failed to make the 2026 ballot, leaving a court-imposed map in place for now. The debate is whether states should be allowed to rewrite the rules mid-cycle for partisan gain or whether stronger guardrails are needed around maps and election administration.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support fair maps, transparent election administration, and guardrails against mid-cycle partisan redistricting.\n\nVoters deserve stable rules, equal representation, and a democracy that is not manipulated for partisan advantage.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support fair maps, transparent election administration, and guardrails against mid-cycle partisan redistricting.\n\nThank you for your time and consideration.",
                templateAsks: [.support, .askPublicStatement, .seekOversight],
                relatedBills: [],
                tags: ["democracy", "redistricting", "elections", "fair-maps", "representation"]
            ),
            Seed(
                id: "advance-social-security-and-medicare-solvency-plan",
                title: "Advance a Bipartisan Social Security and Medicare Plan",
                category: "Retirement Security",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "The 2025 trustees projected that Social Security's Old-Age and Survivors Insurance trust fund can pay full scheduled benefits until 2033, with 77% payable after that, while the combined OASDI funds can pay full benefits until 2034 and Medicare's Hospital Insurance trust fund until 2033, with 89% payable thereafter. SSA says about 75 million Americans will receive Social Security or SSI payments in 2026, and CMS says Medicare covers about 68 million people. The debate is no longer whether these programs matter; it is whether Congress acts early enough to avoid across-the-board cuts or abrupt financing changes.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to advance a bipartisan Social Security and Medicare solvency plan now so any changes are gradual and not sudden benefit cuts.\n\nPlease protect earned benefits and work across the aisle on a long-term solution before the choices become more painful.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to advance a bipartisan Social Security and Medicare solvency plan now so any changes are gradual and not sudden benefit cuts.\n\nThank you for your time and consideration.",
                templateAsks: [.support, .askPublicStatement],
                relatedBills: [],
                tags: ["social-security", "medicare", "solvency", "retirement-security", "earned-benefits"]
            ),
            Seed(
                id: "expand-housing-supply-and-prevent-homelessness",
                title: "Expand Housing Supply and Prevent Homelessness",
                category: "Housing",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "Reuters reported in March 2026 that Congress is debating housing legislation against an estimated national shortage of 4 million homes, with home prices up about 60% since 2019. NLIHC's 2026 Gap report found an even sharper crunch at the low end: 11 million extremely low-income renter households are facing a shortage of 7.2 million affordable and available homes, leaving only 35 homes for every 100 households, and 74% of those renters are severely cost-burdened. The issue is whether federal policy focuses only on abstract supply growth or also addresses the affordability and homelessness pressures hitting the lowest-income renters.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support more housing supply, more rental relief, and federal incentives for states and cities to allow more homes near jobs and transit.\n\nPlease treat housing affordability and homelessness as urgent national issues and back policies that make it easier to build and keep people housed.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support more housing supply, more rental relief, and federal incentives for states and cities to allow more homes near jobs and transit.\n\nThank you for your time and consideration.",
                templateAsks: [.support, .askPublicStatement, .seekOversight],
                relatedBills: [],
                tags: ["housing", "homelessness", "rental-relief", "zoning", "affordability"]
            ),
            Seed(
                id: "protect-affordable-coverage-and-reject-medicaid-work-requirements",
                title: "Protect Affordable Coverage and Reject Medicaid Work Requirements",
                category: "Health Care",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "The 2025 reconciliation law, signed on July 4, 2025, makes work requirements a condition of Medicaid eligibility for ACA expansion adults starting January 1, 2027. KFF says 41 states including D.C. have expanded Medicaid up to 138% of the federal poverty level, and its March 2026 tracker says coverage losses from work requirements account for more than half of the projected increase in the uninsured, or about 5.3 million people. The policy fight is whether lawmakers are improving program integrity or creating large coverage losses through reporting rules and paperwork.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to prevent avoidable coverage losses by restoring affordability and rejecting Medicaid work requirements and other paperwork rules that push eligible people off insurance.\n\nPlease protect access to care and do not let eligible families lose coverage because of higher costs or red tape.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to restore affordable coverage and reject Medicaid work requirements and other paperwork rules that push eligible people off insurance.\n\nThank you for your time and consideration.",
                templateAsks: [.support, .oppose, .askPublicStatement],
                relatedBills: [],
                tags: ["aca", "medicaid", "coverage", "work-requirements", "affordability"]
            ),
            Seed(
                id: "lower-health-care-costs-and-protect-coverage",
                title: "Lower Health Care Costs While Protecting Coverage",
                category: "Health Care",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "For 2026, CMS raised the standard Medicare Part B premium to $202.90 a month from $185.00 and the annual deductible to $283 from $257, while BLS reported medical care prices were up 3.4% year over year in February 2026. At the same time, CMS says 23.1 million people selected or were automatically re-enrolled in marketplace coverage for 2026. The central question is how lawmakers bring down premiums, deductibles, and out-of-pocket costs without shrinking coverage or destabilizing the insurance market.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to prioritize lower premiums, deductibles, and drug costs while protecting coverage.\n\nHealth care has to be more affordable for families without forcing people to give up access or benefits.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to lower premiums, deductibles, and drug costs while protecting coverage.\n\nThank you for your time and consideration.",
                templateAsks: [.support, .askPublicStatement, .seekOversight],
                relatedBills: [],
                tags: ["health-care", "premiums", "deductibles", "drug-costs", "coverage"]
            ),
            Seed(
                id: "protect-federal-reproductive-health-care-and-funding",
                title: "Protect Federal Reproductive Health Care and Funding",
                category: "Reproductive Rights",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "Title X provides $286 million a year to a network of nearly 4,000 clinics and served 2.8 million people in 2023, but the program has faced repeated federal disruption. KFF says the administration withheld $65.8 million in year-four funding from 16 of 86 Title X grants in April 2025, and Reuters reported that a federal judge later blocked Medicaid funding cuts to abortion-providing nonprofits in 22 states and Washington, D.C., after the law had already contributed to at least 20 health-center closures since September 2025. The issue is whether Congress protects reproductive health access through stable Medicaid and Title X funding or allows ongoing legal and administrative instability to keep shrinking the provider network.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to state clearly whether they support federal protections and funding for reproductive health care, and to vote to protect that care.\n\nCongress still shapes access through Medicaid, Title X, appropriations, and broader health-funding laws, so this position should be explicit.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to state clearly whether they support federal protections and funding for reproductive health care, and to vote to protect that care.\n\nThank you for your time and consideration.",
                templateAsks: [.support, .askPublicStatement],
                relatedBills: [],
                tags: ["reproductive-health", "abortion", "title-x", "medicaid", "health-funding"]
            ),
            Seed(
                id: "support-workers-during-layoffs-and-economic-uncertainty",
                title: "Support Workers During Layoffs and Economic Uncertainty",
                category: "Labor",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "Reuters reported that the U.S. lost 92,000 jobs in February 2026 and the unemployment rate rose to 4.4%. The latest JOLTS data showed 6.9 million job openings in January, 3.1 million quits, and 1.6 million layoffs and discharges, while Reuters separately reported private payroll growth has averaged just 18,000 a month over the last three months and the federal civilian workforce shrank 12% between September 2024 and January 2026. The policy question is whether lawmakers respond to a cooling labor market with better retraining, transition support, and layoff planning before job losses deepen.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support worker protections, retraining, and transparent impact assessments for layoffs and federal workforce cuts.\n\nFamilies need job security, honest planning, and real support when the labor market starts to cool.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support worker protections, retraining, and transparent impact assessments for layoffs and federal workforce cuts.\n\nThank you for your time and consideration.",
                templateAsks: [.support, .askPublicStatement, .seekOversight],
                relatedBills: [],
                tags: ["jobs", "layoffs", "workers", "retraining", "labor-market"]
            ),
            Seed(
                id: "lower-everyday-costs-for-working-families",
                title: "Lower Everyday Costs for Working Families",
                category: "Economy",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "BLS reported that consumer prices were up 2.4% year over year in February 2026, but the pressure on household essentials remained uneven: food was up 3.1%, shelter 3.0%, medical care 3.4%, household furnishings and operations 3.9%, full-service meals 4.6%, electricity 4.8%, and natural gas 10.9%. Reuters also noted in March that economists expected the Iran-driven oil shock and tariffs to add new inflation pressure even after relatively moderate core CPI readings. The issue is which mix of housing, food, energy, wage, and tax policy can actually lower day-to-day costs without creating new supply shocks.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to back policies that lower everyday costs for families without adding new hidden taxes or supply shocks.\n\nPlease focus on affordability in the real economy, especially food, housing, and other essential household costs.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to back policies that lower everyday costs for families without adding hidden taxes or supply shocks.\n\nThank you for your time and consideration.",
                templateAsks: [.support, .askPublicStatement, .seekOversight],
                relatedBills: [],
                tags: ["economy", "inflation", "cost-of-living", "prices", "families"]
            ),
            Seed(
                id: "fully-fund-hawaii-flood-relief-and-recovery",
                title: "Fully Fund Hawaii Flood Relief and Recovery",
                category: "Disaster Relief",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "Hawaii is facing some of its worst flooding in more than 20 years, with more than 230 rescues, evacuation orders affecting about 5,500 residents, and major damage to homes and public infrastructure. Early estimates indicate damage could exceed $1 billion across roads, schools, farms, and health facilities, while state and county assessments are still ongoing. Governor Josh Green has requested a presidential major disaster declaration and sought up to a 90% federal cost share, signaling state and local resources are not enough. This makes timely federal action through FEMA's Disaster Relief Fund urgent to prevent rebuilding delays and stabilize impacted communities.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to fully support Hawaii flood recovery by backing immediate FEMA Disaster Relief Fund support, an expedited major disaster declaration response, and strong federal cost sharing so rebuilding is not delayed.\n\nThe scale of damage is severe and local resources are not enough. Please push for fast federal action and public accountability so communities can recover quickly.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support urgent federal flood relief for Hawaii through FEMA's Disaster Relief Fund and prompt disaster assistance.\n\nPlease act quickly so families and infrastructure can recover without delay.\n\nThank you.",
                templateAsks: [.support, .askPublicStatement, .seekOversight],
                relatedBills: [],
                tags: ["urgent", "hawaii", "flooding", "disaster-relief", "fema", "recovery", "infrastructure"]
            ),
            Seed(
                id: "strengthen-tsa-staffing-and-reduce-checkpoint-bottlenecks",
                title: "Strengthen TSA Staffing and Reduce Checkpoint Bottlenecks",
                category: "Transportation",
                targetChambers: ["house", "senate"],
                primaryAsk: "support",
                summary: "U.S. air travel demand remains very high, placing sustained pressure on TSA screening operations and frontline officers. TSA has faced continuing staffing strain and turnover, including more than 1,100 officers leaving in a two-month period in late 2025, even as passenger volume stays elevated. Federal delay data also shows flight disruptions come from multiple sources: in December 2025, 71.74% of flights were on time, with delays largely tied to carriers and the national aviation system, while a smaller share was directly tied to security. The most accurate policy case is that fully funding TSA staffing and compensation reduces checkpoint bottlenecks, improves traveler experience, and protects safety while broader delay drivers are handled across airlines and air traffic control.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support full TSA staffing and compensation funding to reduce checkpoint bottlenecks and improve traveler safety and reliability.\n\nPlease prioritize appropriations and oversight that stabilize the TSA workforce and strengthen frontline operations at high-volume airports.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to fully fund TSA staffing and pay so screening lines move more efficiently and safety stays strong during heavy travel demand.\n\nPlease support urgent action on this.\n\nThank you.",
                templateAsks: [.support, .askPublicStatement, .seekOversight],
                relatedBills: [],
                tags: ["urgent", "tsa", "air-travel", "aviation", "staffing", "travel-delays", "airport-security"]
            )
        ]

        return seeds
            .filter { seed in
                !Set(seed.targetChambers).intersection(availableChambers).isEmpty
            }
            .map { seed in
                let relevantReps = repTargets.filter { target in
                    if seed.targetChambers.contains("house") && target.slot == .house { return true }
                    if seed.targetChambers.contains("senate") && (target.slot == .senate1 || target.slot == .senate2) { return true }
                    return false
                }
                let repRelevance = [
                    seed.targetChambers == ["senate"]
                    ? "This issue is currently targeted to the Senate."
                    : "This issue can be raised with both House and Senate offices."
                ] + relevantReps.prefix(3).map { "\($0.official.name) serves in \($0.officeType)." }

                return CivicExampleIssueCard(
                    id: seed.id,
                    slug: seed.id,
                    title: seed.title,
                    category: seed.category,
                    targetChambers: seed.targetChambers,
                    primaryAsk: seed.primaryAsk,
                    summary: seed.summary,
                    relatedBills: seed.relatedBills,
                    repRelevance: repRelevance,
                    templateAsks: seed.templateAsks,
                    liveScript: seed.liveScript,
                    voicemailScript: seed.voicemailScript,
                    supporterVariant: sharedSupporter,
                    undecidedVariant: sharedUndecided,
                    stafferVariant: sharedStaffer,
                    voicemailFooter: sharedVoicemailFooter,
                    placeholders: placeholders,
                    tags: seed.tags
                )
            }
    }

    private func resolutionFromScriptPackage(
        _ package: CivicScriptPackageResponse,
        concernText: String,
        ask: CivicAsk,
        selectedSlots: [CivicRepSlot],
        optionalBillRef: String?
    ) -> CivicIssueResolutionResponse {
        let canonical = package.canonicalContext
        let trimmedConcern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = canonical?.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? (canonical?.title ?? "")
            : deriveIssueTitle(from: trimmedConcern)

        var summaryParts: [String] = []
        if let summary = canonical?.summaryPlain.trimmingCharacters(in: .whitespacesAndNewlines),
           !summary.isEmpty {
            summaryParts.append(summary)
        }
        if let warning = canonical?.evidenceWarning?.trimmingCharacters(in: .whitespacesAndNewlines),
           !warning.isEmpty {
            summaryParts.append("Note: \(warning)")
        }
        if summaryParts.isEmpty, !trimmedConcern.isEmpty {
            summaryParts.append(trimmedConcern)
        }
        let summary = summaryParts.joined(separator: "\n\n")

        let preferredIssueID = canonical?.issueID.trimmingCharacters(in: .whitespacesAndNewlines)
        let issueID = resolvedIssueIdentifier(
            preferredIssueID: (preferredIssueID?.isEmpty == false) ? preferredIssueID : nil,
            issueTitle: title,
            issueSummary: summary
        )

        let explicitBillRef = normalizedBillReference(optionalBillRef)
        var resolvedBills = canonical?.relatedBills.compactMap(normalizedBillReference) ?? []
        if let explicitBillRef, !containsCaseInsensitive(resolvedBills, value: explicitBillRef) {
            resolvedBills.append(explicitBillRef)
        }

        let overlays = orderedOverlaysForSlots(
            package.officeOverlays,
            selectedSlots: selectedSlots
        )
        let selectedTargets = repTargets.filter { selectedSlots.contains($0.slot) }

        let keyFactPoints = (canonical?.keyFacts ?? [])
            .map { $0.fact.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .prefix(2)
            .map { trimToWordLimit($0, maxWords: 18) }
        let firstKeyFactBadge = keyFactPoints.first.map { "Issue context: \($0)" }
        let canonicalBillSource = canonical?.billSource.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let scriptIssueLine = (canonical?.billDisplayText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
            ? canonical?.billDisplayText
            : "this issue"
        let billTieInBadge: String? = {
            guard let issueLine = scriptIssueLine?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !issueLine.isEmpty else { return nil }
            switch canonicalBillSource {
            case "user":
                return "Using your bill reference: \(issueLine)"
            case "curated":
                return "Curated tie-in: \(issueLine)"
            default:
                return nil
            }
        }()

        var briefs: [CivicCallBrief] = []
        var usedResolvedSlots = Set<CivicRepSlot>()
        for (index, overlay) in overlays.enumerated() {
            let slot = slotForOverlay(overlay)
                ?? fallbackSlotForOverlay(
                    overlay,
                    selectedSlots: selectedSlots,
                    usedSlots: usedResolvedSlots
                )
            if let slot {
                usedResolvedSlots.insert(slot)
            }
            let official = officialForOverlay(overlay, slot: slot)
            let repID = resolvedRepID(for: overlay, official: official, slot: slot)
            let repName = resolvedRepName(for: overlay, official: official, slot: slot)
            let officeType = resolvedOfficeType(for: overlay, official: official, slot: slot)
            let phone = resolvedPrimaryPhone(for: overlay, official: official, slot: slot)

            var reasons: [String] = []
            if let billTieInBadge {
                reasons.append(billTieInBadge)
            }
            if overlay.committeeMatch.matched {
                reasons.append("Direct committee jurisdiction match")
            }
            if let callout = overlay.committeeMatch.jurisdictionCallout?.trimmingCharacters(in: .whitespacesAndNewlines),
               !callout.isEmpty {
                reasons.append(callout)
            }
            if !overlay.relatedCommittees.isEmpty {
                let committeeSummary = overlay.relatedCommittees
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                    .prefix(2)
                    .joined(separator: ", ")
                if !committeeSummary.isEmpty {
                    reasons.append("Committee tie-in: \(committeeSummary)")
                }
            }
            if overlay.roleOverlays.contains(where: { $0 != "none" }) {
                reasons.append("Office role relevance")
            }
            if let firstKeyFactBadge {
                reasons.append(firstKeyFactBadge)
            }
            if canonical?.evidenceQuality.lowercased() == "limited" {
                reasons.append("Evidence limited; using broad issue framing")
            }
            if reasons.isEmpty, let slot, let target = repTargets.first(where: { $0.slot == slot }) {
                reasons.append(contentsOf: fallbackRelevance(for: target, billRef: explicitBillRef))
            } else if reasons.isEmpty {
                reasons.append("Issue relevance for this office")
            }
            reasons = Array(NSOrderedSet(array: reasons).array as? [String] ?? reasons)
            if reasons.count > 5 {
                reasons = Array(reasons.prefix(5))
            }

            let liveScript = renderedScript(
                finalScript: overlay.liveScriptFinal,
                coreTemplate: package.scriptCore?.liveScriptCore,
                officeType: officeType,
                repName: repName
            )
            let voicemailScript = renderedScript(
                finalScript: overlay.voicemailScriptFinal,
                coreTemplate: package.scriptCore?.voicemailScriptCore,
                officeType: officeType,
                repName: repName
            )

            var talkingPoints = [
                "Issue: \(title)",
                "Ask: \(ask.title) \(scriptIssueLine ?? "this issue")"
            ]
            talkingPoints.append(contentsOf: keyFactPoints)
            if let summaryPlain = canonical?.summaryPlain.trimmingCharacters(in: .whitespacesAndNewlines),
               !summaryPlain.isEmpty {
                talkingPoints.append("Summary: \(trimToWordLimit(summaryPlain, maxWords: 22))")
            }
            if let warning = canonical?.evidenceWarning?.trimmingCharacters(in: .whitespacesAndNewlines),
               !warning.isEmpty {
                talkingPoints.append("Evidence note: \(warning)")
            }
            if !overlay.relatedCommittees.isEmpty {
                let committeePoint = overlay.relatedCommittees
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                    .prefix(3)
                    .joined(separator: ", ")
                if !committeePoint.isEmpty {
                    talkingPoints.append("Committee path: \(committeePoint)")
                }
            }

            let brief = CivicCallBrief(
                id: "\(package.packageID)-\(index)-\(repID)",
                repID: repID,
                repName: repName,
                officeType: officeType,
                primaryPhoneNumber: phone,
                localOfficePhoneNumber: nil,
                relevanceBadges: reasons,
                relatedBills: resolvedBills,
                relatedCommittees: overlay.relatedCommittees,
                liveScript: liveScript,
                voicemailScript: voicemailScript,
                talkingPoints: talkingPoints,
                issueID: issueID,
                repSlot: slot
            )
            briefs.append(brief)
        }

        let existingSlotSet = Set(briefs.compactMap(\.repSlot))
        let existingNameKeys = Set(briefs.map { Self.normalizeNameKey($0.repName) })
        let missingTargets = selectedTargets.filter { target in
            if existingSlotSet.contains(target.slot) {
                return false
            }
            let key = Self.normalizeNameKey(target.official.name)
            return !existingNameKeys.contains(key)
        }

        if !missingTargets.isEmpty {
            let liveTemplate = package.scriptCore?.liveScriptCore ?? ""
            let voicemailTemplate = package.scriptCore?.voicemailScriptCore ?? ""
            let startIndex = briefs.count
            let fallbackBriefs = missingTargets.enumerated().map { offset, target in
                let repID = stableRepID(for: target.official)
                let live = renderedScript(
                    finalScript: "",
                    coreTemplate: liveTemplate,
                    officeType: target.officeType,
                    repName: target.official.name
                )
                let voicemail = renderedScript(
                    finalScript: "",
                    coreTemplate: voicemailTemplate,
                    officeType: target.officeType,
                    repName: target.official.name
                )
                return CivicCallBrief(
                    id: "\(package.packageID)-fallback-\(startIndex + offset)-\(repID)",
                    repID: repID,
                    repName: target.official.name,
                    officeType: target.officeType,
                    primaryPhoneNumber: resolvedPrimaryPhone(for: target),
                    localOfficePhoneNumber: nil,
                    relevanceBadges: fallbackRelevance(for: target, billRef: explicitBillRef),
                    relatedBills: resolvedBills,
                    relatedCommittees: [],
                    liveScript: live,
                    voicemailScript: voicemail,
                    talkingPoints: ["Issue: \(title)", "Ask: \(ask.title) \(scriptIssueLine ?? "this issue")"],
                    issueID: issueID,
                    repSlot: target.slot
                )
            }
            briefs.append(contentsOf: fallbackBriefs)
        }

        let allCommittees = Array(
            Set(briefs.flatMap(\.relatedCommittees).map {
                $0.trimmingCharacters(in: .whitespacesAndNewlines)
            }.filter { !$0.isEmpty })
        ).sorted()

        return CivicIssueResolutionResponse(
            issueID: issueID,
            issueTitle: title,
            issueSummary: summary,
            resolvedEntities: CivicResolvedEntities(
                bills: resolvedBills,
                committees: allCommittees,
                agencies: []
            ),
            callBriefs: briefs
        )
    }

    private func orderedOverlaysForSlots(
        _ overlays: [CivicScriptPackageOfficeOverlay],
        selectedSlots: [CivicRepSlot]
    ) -> [CivicScriptPackageOfficeOverlay] {
        var remaining = overlays
        var assignedBySlot: [CivicRepSlot: CivicScriptPackageOfficeOverlay] = [:]

        for overlay in overlays {
            guard let slot = slotForOverlay(overlay) else { continue }
            guard assignedBySlot[slot] == nil else { continue }
            assignedBySlot[slot] = overlay
            if let index = remaining.firstIndex(where: { $0.repID == overlay.repID && $0.repName == overlay.repName }) {
                remaining.remove(at: index)
            }
        }

        for slot in selectedSlots where assignedBySlot[slot] == nil {
            if slot == .house {
                if let index = remaining.firstIndex(where: { $0.chamber.localizedCaseInsensitiveContains("house") }) {
                    assignedBySlot[slot] = remaining.remove(at: index)
                }
                continue
            }
            if let index = remaining.firstIndex(where: { $0.chamber.localizedCaseInsensitiveContains("senate") }) {
                assignedBySlot[slot] = remaining.remove(at: index)
            }
        }

        var ordered: [CivicScriptPackageOfficeOverlay] = []
        for slot in selectedSlots {
            if let overlay = assignedBySlot[slot] {
                ordered.append(overlay)
            }
        }
        ordered.append(contentsOf: remaining)
        return ordered
    }

    private func fallbackSlotForOverlay(
        _ overlay: CivicScriptPackageOfficeOverlay,
        selectedSlots: [CivicRepSlot],
        usedSlots: Set<CivicRepSlot>
    ) -> CivicRepSlot? {
        let chamber = overlay.chamber.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        if chamber.contains("house") {
            return selectedSlots.first(where: { $0 == .house && !usedSlots.contains($0) })
                ?? selectedSlots.first(where: { $0 == .house })
        }

        if chamber.contains("senate") {
            return selectedSlots.first(where: {
                ($0 == .senate1 || $0 == .senate2) && !usedSlots.contains($0)
            }) ?? selectedSlots.first(where: { $0 == .senate1 || $0 == .senate2 })
        }

        return selectedSlots.first(where: { !usedSlots.contains($0) }) ?? selectedSlots.first
    }

    private func slotForOverlay(_ overlay: CivicScriptPackageOfficeOverlay) -> CivicRepSlot? {
        let repIDKey = overlay.repID.trimmingCharacters(in: .whitespacesAndNewlines)
        if let slot = slotByRepID[repIDKey] {
            return slot
        }
        let repIDLower = repIDKey.lowercased()
        if repIDLower.contains("house-local") {
            return .house
        }
        if repIDLower.contains("senate-local-1") {
            return .senate1
        }
        if repIDLower.contains("senate-local-2") {
            return .senate2
        }

        let nameKey = Self.normalizeNameKey(overlay.repName)
        if let slot = slotByName[nameKey] {
            return slot
        }

        let chamber = overlay.chamber.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if chamber == "house" {
            return .house
        }
        return nil
    }

    private func officialForOverlay(_ overlay: CivicScriptPackageOfficeOverlay, slot: CivicRepSlot?) -> Official? {
        let repIDKey = overlay.repID.trimmingCharacters(in: .whitespacesAndNewlines)
        if let official = officialLookupByRepID[repIDKey] {
            return official
        }
        let nameKey = Self.normalizeNameKey(overlay.repName)
        if let official = officialLookupByName[nameKey] {
            return official
        }
        if let slot {
            return officialBySlot[slot]
        }
        return nil
    }

    private func resolvedRepID(for overlay: CivicScriptPackageOfficeOverlay, official: Official?, slot: CivicRepSlot?) -> String {
        if let official {
            return stableRepID(for: official)
        }
        let trimmed = overlay.repID.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            return trimmed
        }
        if let slot {
            return slot.rawValue
        }
        return UUID().uuidString
    }

    private func resolvedRepName(for overlay: CivicScriptPackageOfficeOverlay, official: Official?, slot: CivicRepSlot?) -> String {
        let trimmed = overlay.repName.trimmingCharacters(in: .whitespacesAndNewlines)
        if let official, (trimmed.isEmpty || isGenericOverlayRepName(trimmed)) {
            return official.name
        }
        if isGenericOverlayRepName(trimmed) {
            if let slot, let slotOfficial = officialBySlot[slot] {
                return slotOfficial.name
            }
            if let slot, let target = repTargets.first(where: { $0.slot == slot }) {
                return target.official.name
            }
        }
        if !trimmed.isEmpty {
            return trimmed
        }
        if let official {
            return official.name
        }
        return "Congressional Office"
    }

    private func resolvedOfficeType(for overlay: CivicScriptPackageOfficeOverlay, official: Official?, slot: CivicRepSlot?) -> String {
        let trimmed = overlay.officeType.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty, !isGenericOverlayOfficeType(trimmed) {
            return trimmed
        }
        if let title = official?.officeTitle, !title.isEmpty {
            return title
        }
        switch slot {
        case .house:
            return "U.S. Representative"
        case .senate1, .senate2:
            return "U.S. Senator"
        case .none:
            return "Congressional Office"
        }
    }

    private func resolvedPrimaryPhone(for overlay: CivicScriptPackageOfficeOverlay, official: Official?, slot: CivicRepSlot?) -> String {
        if let phone = official?.officialPhone, !phone.isEmpty {
            return phone
        }
        if overlay.chamber.localizedCaseInsensitiveContains("house") || slot == .house {
            return "(202) 225-3121"
        }
        return "(202) 224-3121"
    }

    private func resolvedPrimaryPhone(for target: CivicRepTarget) -> String {
        let explicitPhone = (target.official.officialPhone ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !explicitPhone.isEmpty {
            return explicitPhone
        }
        return target.slot == .house ? "(202) 225-3121" : "(202) 224-3121"
    }

    private func renderedScript(
        finalScript: String,
        coreTemplate: String?,
        officeType: String,
        repName: String
    ) -> String {
        let trimmedFinal = finalScript.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedFinal.isEmpty {
            return normalizedOverlayScript(trimmedFinal, officeType: officeType, repName: repName)
        }

        let template = (coreTemplate ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !template.isEmpty else {
            return "Hi, my name is [Your Name], and I am a constituent calling about this issue."
        }

        let rendered = template
            .replacingOccurrences(of: "{OFFICE_TYPE}", with: officeType)
            .replacingOccurrences(of: "{REP_NAME}", with: repName)
        return normalizedOverlayScript(rendered, officeType: officeType, repName: repName)
    }

    private func normalizedOverlayScript(_ raw: String, officeType: String, repName: String) -> String {
        var normalized = raw
        let fullOfficeName = "\(officeType) \(repName)"

        let replacements: [(pattern: String, replacement: String)] = [
            (#"(?i)\bu\.?\s*s\.?\s*representative\s+house office\b"#, fullOfficeName),
            (#"(?i)\bu\.?\s*s\.?\s*senator\s+senate office\s*\d+\b"#, fullOfficeName),
            (#"(?i)\bu\.?\s*s\.?\s*senator\s+senate office\b"#, fullOfficeName),
            (#"(?i)\bhouse office\b"#, repName),
            (#"(?i)\bsenate office\s+\d+\b"#, repName),
            (#"(?i)\bsenate office\b"#, repName),
            (#"(?i)\bcongressional office\b"#, repName),
            (#"(?i)\bcall\s+congress(?:man|woman)?\s+office\b"#, "Call \(repName)"),
            (#"(?i)\bcall\s+congressional\s+office\b"#, "Call \(repName)"),
        ]

        for entry in replacements {
            normalized = normalized.replacingOccurrences(
                of: entry.pattern,
                with: entry.replacement,
                options: .regularExpression
            )
        }

        let escapedRepName = NSRegularExpression.escapedPattern(for: repName)
        if officeType.lowercased().contains("senator") {
            normalized = normalized.replacingOccurrences(
                of: #"(?i)\bas a\s+\#(escapedRepName),\s*this member can influence"#,
                with: "In the Senate, this member can influence",
                options: .regularExpression
            )
            normalized = normalized.replacingOccurrences(
                of: #"(?i)\bas a[n]?\s+[^,]{1,80},\s*this member can influence hearings, confirmations, and final senate votes"#,
                with: "In the Senate, this member can influence hearings, confirmations, and final Senate votes",
                options: .regularExpression
            )
        } else if officeType.lowercased().contains("representative") || officeType.lowercased().contains("house") {
            normalized = normalized.replacingOccurrences(
                of: #"(?i)\bas a\s+\#(escapedRepName),\s*this member can press committee action and shape house floor votes"#,
                with: "In the House, this member can press committee action and shape House floor votes",
                options: .regularExpression
            )
            normalized = normalized.replacingOccurrences(
                of: #"(?i)\bas a[n]?\s+[^,]{1,80},\s*this member can press committee action and shape house floor votes"#,
                with: "In the House, this member can press committee action and shape House floor votes",
                options: .regularExpression
            )
        }
        return normalized
    }

    private func isGenericOverlayOfficeType(_ raw: String) -> Bool {
        let lowered = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        if lowered.isEmpty { return true }

        if lowered == "congressional office" || lowered == "house office" || lowered == "senate office" {
            return true
        }
        if lowered.hasPrefix("senate office") || lowered.hasPrefix("house office") {
            return true
        }
        return false
    }

    private func isGenericOverlayRepName(_ raw: String) -> Bool {
        let lowered = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        if lowered.isEmpty { return true }

        if lowered == "house office" || lowered == "congressional office" || lowered == "senate office" {
            return true
        }
        if lowered.hasPrefix("senate office")
            || lowered.contains("house office")
            || lowered.contains("congressman office")
            || lowered.contains("congresswoman office")
            || lowered.contains("congressional office") {
            return true
        }
        return false
    }

    private func fallbackOfficialForPlaceholder(brief: CivicCallBrief) -> Official? {
        let repIDLower = brief.repID.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let repNameLower = brief.repName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let officeLower = brief.officeType.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        if repIDLower.contains("house-local")
            || repNameLower == "house office"
            || (brief.repSlot == .house)
            || officeLower.contains("representative") {
            if let match = repTargets.first(where: { $0.slot == .house }) {
                return match.official
            }
        }

        if repIDLower.contains("senate-local-1")
            || repNameLower == "senate office 1"
            || brief.repSlot == .senate1 {
            if let match = repTargets.first(where: { $0.slot == .senate1 }) {
                return match.official
            }
            let senateTargets = repTargets.filter { $0.slot == .senate1 || $0.slot == .senate2 }
            return senateTargets.first?.official
        }

        if repIDLower.contains("senate-local-2")
            || repNameLower == "senate office 2"
            || brief.repSlot == .senate2 {
            if let match = repTargets.first(where: { $0.slot == .senate2 }) {
                return match.official
            }
            let senateTargets = repTargets.filter { $0.slot == .senate1 || $0.slot == .senate2 }
            if senateTargets.count >= 2 {
                return senateTargets[1].official
            }
            return senateTargets.first?.official
        }

        if repNameLower.hasPrefix("senate office") || officeLower.contains("senator") {
            if let match = repTargets.first(where: { $0.slot == .senate1 }) {
                return match.official
            }
            return repTargets.first(where: { $0.slot == .senate2 })?.official
        }

        return nil
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
        let sanitized = sanitizedGeneratedResolution(response)
        let shouldFallback = containsDisallowedScriptMeta(in: sanitized)
            || isLikelyOffTopic(response: sanitized, concernText: concernText, optionalBillRef: optionalBillRef)
            || !hasReadableCallScripts(
                in: sanitized,
                ask: ask,
                concernText: concernText,
                optionalBillRef: optionalBillRef
            )
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
