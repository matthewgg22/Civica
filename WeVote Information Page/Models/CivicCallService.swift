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
    func createIssueBrief(
        userID: String,
        concernText: String
    ) async throws -> CivicIssueBriefResponse
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
    private let requestTimeout: TimeInterval = 35

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
        try await attachAuthorization(to: &request)

        let data = try await requestData(for: request)
        let decoded = try decoder.decode(CivicExamplesResponse.self, from: data)
        return decoded.examples
    }

    func createIssueBrief(
        userID _: String,
        concernText: String
    ) async throws -> CivicIssueBriefResponse {
        let requestBody = CivicIssueBriefRequest(
            concernText: concernText,
            allowRevision: true
        )
        var request = URLRequest(url: endpoint("/api/issue-brief"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await attachAuthorization(to: &request)
        request.httpBody = try encoder.encode(requestBody)

        let data = try await requestData(for: request)
        return try decoder.decode(CivicIssueBriefResponse.self, from: data)
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

    private func currentAccessToken() async throws -> String {
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

    private func requestData(for request: URLRequest) async throws -> Data {
        var timedRequest = request
        timedRequest.timeoutInterval = requestTimeout

        do {
            let (data, response) = try await session.data(for: timedRequest)
            guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
            guard (200...299).contains(http.statusCode) else {
                throw NSError(domain: "CivicIssueCallAPIClient", code: http.statusCode, userInfo: [
                    NSLocalizedDescriptionKey: String(data: data, encoding: .utf8) ?? "API request failed with status \(http.statusCode)"
                ])
            }
            return data
        } catch {
            if let urlError = error as? URLError, urlError.code == .timedOut {
                throw NSError(
                    domain: "CivicIssueCallAPIClient",
                    code: urlError.errorCode,
                    userInfo: [NSLocalizedDescriptionKey: "The civic API request timed out."]
                )
            }
            throw error
        }
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
    private var activeMAPCSessionID: UUID?
    private var pendingGeneratedResolution: CivicIssueResolutionResponse?

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
        do {
            examples = try await apiClient.fetchExamples(userID: userID, reps: repTargets)
        } catch {
            examples = fallbackExamples()
        }

        do {
            historyGroups = try await apiClient.fetchHistory(userID: userID)
            saveSnapshot()
        } catch {
            // Keep local snapshot history as offline fallback.
        }

        await refreshCallScoreData(for: userID)
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
        pendingGeneratedResolution = nil
        requiresDraftApproval = false

        do {
            let brief = try await apiClient.createIssueBrief(
                userID: userID,
                concernText: trimmedConcern
            )

            switch brief.status {
            case .ok:
                let response = resolutionFromIssueBrief(
                    brief,
                    concernText: trimmedConcern,
                    ask: ask,
                    selectedSlots: requestRepSlots,
                    optionalBillRef: trimmedBill.isEmpty ? nil : trimmedBill
                )
                applyResolution(response)
                pendingGeneratedResolution = response
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
                requiresDraftApproval = false
                errorMessage = brief.clarificationQuestion ?? "Please clarify the issue so I can generate the draft."
            case .refused:
                pendingGeneratedResolution = nil
                requiresDraftApproval = false
                errorMessage = brief.reviewPrompt ?? brief.summaryNeutral
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

    func approveGeneratedDraft() {
        if let pendingGeneratedResolution {
            appendHistory(for: pendingGeneratedResolution)
        }
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        saveSnapshot()
    }

    func reviseGeneratedDraft() {
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        issueTitle = ""
        issueSummary = ""
        resolvedEntities = .empty
        callBriefs = []
        activeBriefID = nil
        selectedTab = .assistant
        saveSnapshot()
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
                await refreshCallScoreData(for: userID)
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
            if completed {
                errorMessage = "Could not confirm the call right now. Please try again."
            }
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

    func refreshCallScoreData(for userID: String? = nil) async {
        let resolvedUserID: String
        if let userID {
            resolvedUserID = userID
        } else {
            resolvedUserID = await userIDForRequest()
        }

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

        let issueCommittees = response.resolvedEntities.committees
        let updatedBriefs = response.callBriefs.map { brief in
            let cleanedBriefBills = brief.relatedBills.compactMap(normalizedBillReference)
            let inferredBill = suggestedBillReference(
                issueTitle: response.issueTitle,
                issueSummary: response.issueSummary,
                issueCommittees: issueCommittees,
                target: targetForBrief(brief)
            )
            let selectedBill = cleanedBriefBills.first ?? explicitBill ?? inferredBill
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
            let inferredBill = suggestedBillReference(
                issueTitle: example.title,
                issueSummary: example.summary,
                issueCommittees: relatedCommittees,
                target: target
            )
            let billValue = explicitRelatedBills.first ?? inferredBill
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
                primaryPhoneNumber: target.official.officialPhone ?? "",
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
            .replacingOccurrences(of: "[ZIP]", with: userZip)
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
            saveSnapshot()
        } else {
            activeBriefID = scoped[currentIndex].id
            saveSnapshot()
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
            saveSnapshot()
            return
        }

        let previousIndex = scoped.index(before: currentIndex)
        activeBriefID = scoped[previousIndex].id
        saveSnapshot()
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
                summary: "Congress-not the president acting alone-holds the constitutional power to declare war, and the War Powers Resolution says unauthorized hostilities must end within 60 days unless Congress approves them. Even so, in early March 2026 both the Senate and House rejected resolutions that would have required congressional authorization for hostilities against Iran, even as Reuters reported Pentagon briefers told Congress there was no intelligence that Iran planned to attack U.S. forces first. This issue asks lawmakers to reassert Congress's war powers, oppose further unauthorized escalation, and require a vote before any expanded military action.",
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
                summary: "State restrictions remain widespread: KFF's latest tracker counted 27 states with laws or policies limiting youth access to gender-affirming care, 24 penalizing providers, and about half of trans youth ages 13 to 17 living in affected states. At the same time, major medical organizations continue to back evidence-based care: the APA supports unobstructed access to evidence-based clinical care, the Endocrine Society says this care is needed and often life-saving, and a federal judge this month blocked HHS from punishing providers who offer it. This issue asks Congress to oppose anti-trans restrictions, reject political interference in medicine, and protect equal treatment and clinically grounded care.",
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
                summary: "Recent developments have intensified scrutiny of FBI leadership and public trust. Reuters reported whistleblower allegations that Patel's personal travel and decision-making hampered investigations, two former FBI agents are suing and allege they were fired over work on the Trump election case, and newly released records show a broader special-counsel probe of Patel as a private citizen than previously known, though Reuters said the exact nature of any allegations was unclear. This issue asks Congress to treat the matter as an accountability crisis: demand transparency, investigate potential misuse of power or resources, and press for Patel's resignation and other formal remedies if warranted.",
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
                summary: "The Bureau of Land Management oversees 245 million acres of public land and 700 million acres of mineral estate under a mission that includes both multiple use and conservation. Pearce has long supported expanded domestic oil production, previously owned an oilfield services company, and would oversee major leasing decisions affecting drilling, mining, grazing, recreation, and renewable energy if confirmed; while he told senators he would not recommend broad-scale public-land selloffs, his record still points toward extraction-first management. This issue asks senators to oppose his nomination and insist on BLM leadership centered on stewardship, public access, and balanced land management.",
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
                summary: "The House passed the SAVE America Act in February 2026, and the bill would require documentary proof of citizenship to register for federal elections while adding stricter ID rules. Independent analysis from the Bipartisan Policy Center estimates about 12% of registered voters do not have ready access to the documents most likely to satisfy those requirements, and because only five states issue Real IDs that indicate citizenship, most eligible voters would need a valid passport or a birth certificate paired with photo ID. This issue asks senators to reject the bill because it would add federal paperwork barriers for eligible voters instead of improving election administration and ballot access.",
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
                summary: "The surgeon general's effectiveness depends on public trust and clear, science-based communication. Casey Means's nomination has stalled after senators in both parties questioned her experience, inactive medical license, and reluctance at hearing to clearly urge routine vaccination against illnesses like flu and measles; Reuters also described her confirmation hearing as focused on contentious positions on vaccines and birth control. This issue asks senators to reject the nomination and support public-health leadership grounded in evidence, vaccine confidence, and medical credibility.",
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
                summary: "Temporary Protected Status exists for countries facing extraordinary conditions, and the Supreme Court has kept in place lower-court orders that, for now, preserve protections for more than 350,000 Haitians living and working in the United States. The State Department continues to warn Americans not to travel to Haiti because of kidnapping, crime, terrorist activity, civil unrest, and limited healthcare, while Reuters and the U.N. report more than 1.4 million Haitians displaced and at least 5,519 people killed between March 2025 and January 2026. This issue asks lawmakers to defend TPS for Haitians and support stability for families who cannot safely be returned to a country in deep crisis.",
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
                summary: "The EPA's 2009 endangerment finding concluded that six key greenhouse gases threaten public health and welfare and served as the legal prerequisite for federal greenhouse-gas standards. On February 12, 2026, EPA finalized rescission of that finding and repeal of related vehicle greenhouse-gas rules, and 23 states plus cities and counties have already sued to overturn the rollback. This issue asks Congress to oppose dismantling the scientific and legal foundation of climate regulation and to defend protections against dangerous pollution.",
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
                summary: "Earlier this year, the White House said Trump was discussing options to acquire Greenland, including purchase and even potential use of the U.S. military, despite clear opposition from Greenland and Denmark. Reuters also reported bipartisan concern in Congress, including proposals to block federal funds from being used for any takeover attempt, and Greenland's prime minister warned that continued U.S. efforts toward ownership or control were \"completely unacceptable.\" This issue asks Congress to reject any funding or authorization for coercion and to defend allied sovereignty, Arctic stability, and NATO cohesion.",
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
                summary: "The White House's March 2026 AI framework explicitly urges Congress to preempt state AI laws, following Trump's December threat to withhold broadband funding from states whose AI rules his administration says hinder innovation. But states are already filling real gaps: NCSL says all 50 states introduced AI legislation in 2025, 38 enacted about 100 measures, lawmakers advanced rules on transparency, health care, chatbot safety, and algorithmic discrimination, and the Senate voted 99 to 1 last year to strip a proposed 10-year moratorium on state and local AI laws. This issue asks Congress to preserve state authority to regulate AI systems until strong, enforceable federal protections actually exist.",
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
                summary: "Federal farm legislation shapes agricultural subsidies, food-assistance programs, and rural economic policy across the United States. Negotiations over new farm bills often involve balancing support for farmers with nutrition assistance programs such as SNAP. Because the legislation governs billions of dollars in spending and affects food security nationwide, even small policy adjustments can have significant economic and social impacts.",
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
                summary: "Federal student-aid programs, including Pell Grants, play a central role in helping students afford higher education and workforce training. Changes to eligibility rules, funding levels, or loan structures can influence college access, debt levels, and long-term economic mobility. Policymakers frequently debate how best to balance affordability, fiscal sustainability, and workforce development goals.",
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
                summary: "Extreme weather events and climate-related disasters have placed growing pressure on insurance markets, infrastructure systems, and local government budgets. Policymakers are increasingly examining how federal investments in resilience, grid modernization, and disaster preparedness might reduce long-term economic risks. Decisions in this area could shape how communities prepare for natural disasters and how insurance systems adapt to rising climate-related costs.",
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
                summary: "Redistricting and election-administration rules play a significant role in determining how voters are represented in federal and state government. Debates over district boundaries, transparency, and election procedures often focus on whether political incentives influence how electoral maps are drawn. Changes to these systems can affect representation, competition between parties, and public confidence in the electoral process.",
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
                summary: "Social Security and Medicare provide retirement and health benefits to tens of millions of Americans, making their long-term financial sustainability a central policy concern. Demographic shifts, rising health-care costs, and longer life expectancies have prompted discussions about how the programs should be financed in future decades. Policymakers face difficult trade-offs involving taxes, benefits, and eligibility rules as they consider options to maintain the programs' stability.",
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
                summary: "Housing affordability has become a major economic challenge in many parts of the United States as supply shortages push rents and home prices upward. Policymakers are exploring a range of approaches, including zoning reforms, housing subsidies, and incentives to encourage new construction. Federal policy decisions can influence how quickly housing supply expands and how communities respond to rising homelessness.",
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
                summary: "Medicaid provides health coverage to millions of low-income Americans, and proposals to introduce work or reporting requirements have generated significant policy debate. Supporters argue such requirements encourage workforce participation, while critics warn they may lead eligible individuals to lose coverage due to administrative complexity. The outcome of these discussions could influence access to health care and the structure of public health-insurance programs.",
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
                summary: "Health-care affordability remains a major concern for households, employers, and governments as insurance premiums, deductibles, and prescription-drug prices continue to rise. Policymakers are examining strategies ranging from market competition and price transparency to federal negotiation authority and regulatory reform. The direction of federal policy could affect both the cost and accessibility of medical care nationwide.",
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
                summary: "Federal policy plays an important role in shaping access to reproductive health services through funding programs, regulatory standards, and health-care coverage rules. Debates in Congress often focus on how federal programs such as Medicaid and Title X should support or regulate reproductive health services. These decisions can influence health-care availability, funding for clinics, and how medical providers deliver services across different states.",
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
                summary: "Economic downturns and industry restructuring periodically lead to layoffs that affect workers, local communities, and regional economies. Policymakers often examine whether federal programs should provide stronger worker protections, retraining opportunities, or transition assistance during periods of job loss. Decisions in this area can shape how effectively workers adapt to economic change and how quickly communities recover.",
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
                summary: "Rising prices for housing, food, energy, and other everyday expenses have made cost-of-living pressures a central economic concern for many households. Policymakers are debating how federal fiscal, regulatory, and economic policies influence inflation and affordability. The broader challenge involves balancing economic growth, consumer protection, and financial stability while addressing household budget pressures.",
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

    private func resolutionFromIssueBrief(
        _ brief: CivicIssueBriefResponse,
        concernText: String,
        ask: CivicAsk,
        selectedSlots: [CivicRepSlot],
        optionalBillRef: String?
    ) -> CivicIssueResolutionResponse {
        let canonicalIssue = brief.canonicalIssue.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = canonicalIssueDisplayTitle(from: canonicalIssue).isEmpty
            ? deriveIssueTitle(from: concernText)
            : canonicalIssueDisplayTitle(from: canonicalIssue)

        let summaryHeadline = brief.summaryNeutral.trimmingCharacters(in: .whitespacesAndNewlines)
        let currentStatus = brief.currentStatus.trimmingCharacters(in: .whitespacesAndNewlines)
        let unknownsLine = brief.unknowns.prefix(2)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "; ")

        var summaryParts: [String] = []
        if !summaryHeadline.isEmpty {
            summaryParts.append(summaryHeadline)
        }
        if !currentStatus.isEmpty {
            summaryParts.append("Current status: \(currentStatus)")
        }
        if !unknownsLine.isEmpty {
            summaryParts.append("Open questions: \(unknownsLine)")
        }
        let summary = summaryParts.isEmpty
            ? concernText.trimmingCharacters(in: .whitespacesAndNewlines)
            : summaryParts.joined(separator: "\n\n")

        let issueID = resolvedIssueIdentifier(
            preferredIssueID: canonicalIssue.isEmpty ? nil : canonicalIssue,
            issueTitle: title,
            issueSummary: summary
        )

        let selectedTargets = repTargets.filter { selectedSlots.contains($0.slot) }
        let explicitBillRef = normalizedBillReference(optionalBillRef)
        var resolvedBills: [String] = explicitBillRef.map { [$0] } ?? []
        var briefs: [CivicCallBrief] = []

        let topFact = brief.keyFacts.first?.fact.trimmingCharacters(in: .whitespacesAndNewlines)
        let topQuestion = brief.questionsToConsider.first?.trimmingCharacters(in: .whitespacesAndNewlines)

        for target in selectedTargets {
            let repID = stableRepID(for: target.official)
            let selectedBillRef = explicitBillRef
                ?? suggestedBillReference(
                    issueTitle: title,
                    issueSummary: summary,
                    issueCommittees: [],
                    target: target
                )
            if let selectedBillRef, !containsCaseInsensitive(resolvedBills, value: selectedBillRef) {
                resolvedBills.append(selectedBillRef)
            }

            var reasons = fallbackRelevance(for: target, billRef: selectedBillRef)
            if let topFact, !topFact.isEmpty {
                reasons.insert(trimToWordLimit(topFact, maxWords: 16), at: 0)
            }

            let (live, voicemail, basePoints) = composeScripts(
                repName: target.official.name,
                issueTitle: title,
                ask: ask,
                billRef: selectedBillRef,
                zip: userZip,
                reasons: reasons
            )

            var talkingPoints = basePoints
            if let topQuestion, !topQuestion.isEmpty {
                talkingPoints.append("Follow-up question: \(trimToWordLimit(topQuestion, maxWords: 16))")
            }

            let created = CivicCallBrief(
                id: UUID().uuidString,
                repID: repID,
                repName: target.official.name,
                officeType: target.officeType,
                primaryPhoneNumber: target.official.officialPhone ?? "",
                localOfficePhoneNumber: nil,
                relevanceBadges: reasons,
                relatedBills: selectedBillRef.map { [$0] } ?? [],
                relatedCommittees: [],
                liveScript: live,
                voicemailScript: voicemail,
                talkingPoints: talkingPoints,
                issueID: issueID,
                repSlot: target.slot
            )
            briefs.append(created)
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
                ?? suggestedBillReference(
                    issueTitle: title,
                    issueSummary: summary,
                    issueCommittees: [],
                    target: target
                )
            if let selectedBillRef, !containsCaseInsensitive(resolvedBills, value: selectedBillRef) {
                resolvedBills.append(selectedBillRef)
            }

            let reasons = fallbackRelevance(for: target, billRef: selectedBillRef)
            let (live, voicemail, points) = composeScripts(
                repName: target.official.name,
                issueTitle: title,
                ask: ask,
                billRef: selectedBillRef,
                zip: userZip,
                reasons: reasons
            )

            let brief = CivicCallBrief(
                id: UUID().uuidString,
                repID: repID,
                repName: target.official.name,
                officeType: target.officeType,
                primaryPhoneNumber: target.official.officialPhone ?? "",
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
        let billFragment = billRef.map { " \($0)" } ?? ""
        let factLine = reasons.first ?? "This issue is currently active in Congress."

        let liveBase = "Hi, my name is [Your Name], and I am a constituent in ZIP \(zip). I am calling about \(issueTitle). I ask that \(repName) \(ask.scriptPhrase)\(billFragment). \(factLine). Could you share the member's current position on this? Thank you for your time."

        let voicemailBase = "Hi, constituent in ZIP \(zip) calling about \(issueTitle). Please ask \(repName) to \(ask.scriptPhrase)\(billFragment), and please share the member's current position. Thank you."

        let liveScript = trimToWordLimit(liveBase, maxWords: 90)
        let voicemailScript = trimToWordLimit(voicemailBase, maxWords: 50)

        let points: [String] = [
            "Constituent location: ZIP \(zip)",
            "Explicit ask: \(ask.title)\(billRef.map { " \($0)" } ?? "")",
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
        if senators.indices.contains(0) {
            targets.append(CivicRepTarget(slot: .senate1, official: senators[0]))
        }
        if senators.indices.contains(1) {
            targets.append(CivicRepTarget(slot: .senate2, official: senators[1]))
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

        if lower.contains("requested path is invalid")
            || lower.contains("status 404")
            || lower.contains("badurl") {
            return "Civic API is not configured yet. Set CIVIC_API_BASE_URL to your deployed civic backend. Using offline call briefs for now."
        }
        if lower.contains("timed out") || lower.contains("timeout") {
            return "The civic API took too long to respond. Using offline call briefs for now."
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

func trimToWordLimit(_ text: String, maxWords: Int) -> String {
    let words = text
        .split(whereSeparator: { $0.isWhitespace || $0 == "\n" || $0 == "\t" })
        .map(String.init)
    guard words.count > maxWords else { return text }
    return words.prefix(maxWords).joined(separator: " ")
}
