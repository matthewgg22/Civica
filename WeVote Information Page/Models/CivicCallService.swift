import Foundation
import SwiftUI

private struct CivicExamplesResponse: Codable {
    let examples: [CivicExampleIssueCard]
}

private struct CivicAssistantResolveRequest: Codable {
    let userID: String
    let concernText: String
    let selectedAsk: CivicAsk
    let targetReps: [CivicRepSlot]
    let optionalBillRef: String?

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case concernText = "concern_text"
        case selectedAsk = "selected_ask"
        case targetReps = "target_reps"
        case optionalBillRef = "optional_bill_ref"
    }
}

private struct CivicCallLogRequest: Codable {
    let userID: String
    let repID: String
    let issueID: String
    let briefID: String
    let outcome: CivicCallOutcome
    let stafferPosition: String?
    let notes: String

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
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
    let userID: String
    let officeID: String
    let issueID: String?
    let sourceScreen: String
    let sessionID: String?

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case officeID = "office_id"
        case issueID = "issue_id"
        case sourceScreen = "source_screen"
        case sessionID = "session_id"
    }
}

private struct CivicCallCompletionRequestPayload: Codable {
    let userID: String
    let launchEventID: String
    let completed: Bool

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case launchEventID = "launch_event_id"
        case completed
    }
}

private struct CivicCallScoreRecomputePayload: Codable {
    let userID: String

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
    }
}

protocol CivicIssueCallAPIClientProtocol {
    func fetchExamples(userID: String, reps: [CivicRepTarget]) async throws -> [CivicExampleIssueCard]
    func resolve(
        userID: String,
        concernText: String,
        selectedAsk: CivicAsk,
        targetReps: [CivicRepSlot],
        optionalBillRef: String?
    ) async throws -> CivicIssueResolutionResponse
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

    init(baseURL: URL = CivicIssueCallAPIClient.resolveBaseURL(), session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder

        encoder.dateEncodingStrategy = .iso8601
    }

    func fetchExamples(userID: String, reps: [CivicRepTarget]) async throws -> [CivicExampleIssueCard] {
        var components = URLComponents(url: endpoint("/api/v1/civic/examples"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "user_id", value: userID),
            URLQueryItem(name: "rep_ids", value: reps.map { stableRepID(for: $0.official) }.joined(separator: ","))
        ]
        guard let url = components?.url else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data = try await requestData(for: request)
        let decoded = try decoder.decode(CivicExamplesResponse.self, from: data)
        return decoded.examples
    }

    func resolve(
        userID: String,
        concernText: String,
        selectedAsk: CivicAsk,
        targetReps: [CivicRepSlot],
        optionalBillRef: String?
    ) async throws -> CivicIssueResolutionResponse {
        let requestBody = CivicAssistantResolveRequest(
            userID: userID,
            concernText: concernText,
            selectedAsk: selectedAsk,
            targetReps: targetReps,
            optionalBillRef: optionalBillRef
        )
        var request = URLRequest(url: endpoint("/api/v1/civic/assistant/resolve"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(requestBody)

        let data = try await requestData(for: request)
        return try decoder.decode(CivicIssueResolutionResponse.self, from: data)
    }

    func logCall(
        userID: String,
        repID: String,
        issueID: String,
        briefID: String,
        outcome: CivicCallOutcome,
        stafferPosition: String?,
        notes: String
    ) async throws {
        let payload = CivicCallLogRequest(
            userID: userID,
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
        request.httpBody = try encoder.encode(payload)
        _ = try await requestData(for: request)
    }

    func fetchHistory(userID: String) async throws -> [CivicHistoryGroup] {
        var components = URLComponents(url: endpoint("/api/v1/civic/history"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "user_id", value: userID)]
        guard let url = components?.url else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data = try await requestData(for: request)
        return try decoder.decode(CivicHistoryResponse.self, from: data).history
    }

    func logCallLaunch(
        userID: String,
        officeID: String,
        issueID: String?,
        sourceScreen: String,
        sessionID: String?
    ) async throws -> CivicCallLaunchResponse {
        let payload = CivicCallLaunchRequest(
            userID: userID,
            officeID: officeID,
            issueID: issueID,
            sourceScreen: sourceScreen,
            sessionID: sessionID
        )
        var request = URLRequest(url: endpoint("/api/v1/civic/calls/launch"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(payload)
        let data = try await requestData(for: request)
        return try decoder.decode(CivicCallLaunchResponse.self, from: data)
    }

    func confirmCallCompletion(
        userID: String,
        launchEventID: String,
        completed: Bool
    ) async throws -> CivicCallCompletionResponse {
        let payload = CivicCallCompletionRequestPayload(
            userID: userID,
            launchEventID: launchEventID,
            completed: completed
        )
        var request = URLRequest(url: endpoint("/api/v1/civic/calls/confirm"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(payload)
        let data = try await requestData(for: request)
        return try decoder.decode(CivicCallCompletionResponse.self, from: data)
    }

    func fetchCallScoreSummary(userID: String) async throws -> CivicCallScoreSummary {
        var components = URLComponents(url: endpoint("/api/v1/civic/call-score/summary"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "user_id", value: userID)]
        guard let url = components?.url else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let data = try await requestData(for: request)
        return try decoder.decode(CivicCallScoreSummary.self, from: data)
    }

    func fetchCallScoreBreakdown(userID: String) async throws -> CivicCallScoreBreakdown {
        var components = URLComponents(url: endpoint("/api/v1/civic/call-score/breakdown"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "user_id", value: userID)]
        guard let url = components?.url else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let data = try await requestData(for: request)
        return try decoder.decode(CivicCallScoreBreakdown.self, from: data)
    }

    func fetchCallScoreHistory(userID: String, limit: Int) async throws -> [CivicCallScoreHistoryItem] {
        var components = URLComponents(url: endpoint("/api/v1/civic/call-score/history"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "user_id", value: userID),
            URLQueryItem(name: "limit", value: String(max(1, limit)))
        ]
        guard let url = components?.url else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let data = try await requestData(for: request)
        return try decoder.decode(CivicCallScoreHistoryResponse.self, from: data).history
    }

    func recomputeCallScore(userID: String) async throws -> CivicCallScoreSnapshot {
        let payload = CivicCallScoreRecomputePayload(userID: userID)
        var request = URLRequest(url: endpoint("/api/v1/civic/call-score/recompute"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
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
        let data = try await requestData(for: request)
        return try decoder.decode(CivicLeaderboardResponse.self, from: data)
    }

    func fetchUserLeaderboardSummary(userID: String, periodType: String, periodStart: Date?) async throws -> CivicLeaderboardUserSummary {
        var components = URLComponents(url: endpoint("/api/v1/civic/leaderboard/me"), resolvingAgainstBaseURL: false)
        var queryItems = [
            URLQueryItem(name: "user_id", value: userID),
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
        let data = try await requestData(for: request)
        return try decoder.decode(CivicLeaderboardUserSummary.self, from: data)
    }

    private func requestData(for request: URLRequest) async throws -> Data {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard (200...299).contains(http.statusCode) else {
            throw NSError(domain: "CivicIssueCallAPIClient", code: http.statusCode, userInfo: [
                NSLocalizedDescriptionKey: String(data: data, encoding: .utf8) ?? "API request failed with status \(http.statusCode)"
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
        return SupabaseConfig.current.url
    }
}

final class CivicCallBriefCacheStore {
    private let defaults: UserDefaults
    private let key = "civic.issue_call.snapshot.v1"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

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
        return snapshot
    }

    func save(_ snapshot: CivicLocalSnapshot) {
        guard let data = try? encoder.encode(snapshot) else { return }
        defaults.set(data, forKey: key)
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
    @Published var lastCompletionResult: CivicCallCompletionResponse?
    @Published var pendingCallLaunch: PendingCallLaunch?

    let repTargets: [CivicRepTarget]
    private let officialLookupByRepID: [String: Official]
    private let officialLookupByName: [String: Official]
    private let officialBySlot: [CivicRepSlot: Official]
    private let slotByRepID: [String: CivicRepSlot]
    private let slotByName: [String: CivicRepSlot]
    private let userZip: String
    private let apiClient: CivicIssueCallAPIClientProtocol
    private let cacheStore: CivicCallBriefCacheStore

    init(
        federalReps: [Official],
        userZip: String,
        apiClient: CivicIssueCallAPIClientProtocol = CivicIssueCallAPIClient(),
        cacheStore: CivicCallBriefCacheStore = CivicCallBriefCacheStore()
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

        do {
            let response = try await apiClient.resolve(
                userID: userID,
                concernText: trimmedConcern,
                selectedAsk: ask,
                targetReps: requestRepSlots,
                optionalBillRef: trimmedBill.isEmpty ? nil : trimmedBill
            )
            applyResolution(response)
            appendHistory(for: response)
            saveSnapshot()
            selectedRepFilter = .all
            selectedTab = .assistant
        } catch {
            let fallback = fallbackResolution(
                concernText: trimmedConcern,
                ask: ask,
                selectedSlots: requestRepSlots,
                optionalBillRef: trimmedBill.isEmpty ? nil : trimmedBill
            )
            applyResolution(fallback)
            appendHistory(for: fallback)
            saveSnapshot()
            selectedRepFilter = .all
            errorMessage = "Using offline call briefs while the civic API is unavailable."
        }
    }

    func startMAPC(from example: CivicExampleIssueCard) {
        // Premade selection should open MAPC directly without overriding
        // the user's Build Script personalization draft fields.
        // Also clear any stale composer inputs so Build Script remains blank
        // when the user returns from MAPC.
        concernText = ""
        selectedAsk = nil
        optionalBillRef = ""
        applySeedResolution(for: example)
    }

    func reopen(historyGroup: CivicHistoryGroup) {
        issueTitle = historyGroup.issueTitle
        issueSummary = historyGroup.issueSummary
        callBriefs = normalizedBriefs(historyGroup.briefs)
        resolvedEntities = .empty
        activeBriefID = filteredBriefs.first?.id
        selectedTab = .assistant
        persistDraftState()
    }

    func beginCallLaunch(for brief: CivicCallBrief, sourceScreen: String = "issue_call_center") async {
        let userID = await userIDForRequest()
        do {
            let launch = try await apiClient.logCallLaunch(
                userID: userID,
                officeID: brief.repID,
                issueID: brief.issueID.isEmpty ? nil : brief.issueID,
                sourceScreen: sourceScreen,
                sessionID: UUID().uuidString
            )
            pendingCallLaunch = PendingCallLaunch(
                launchEventID: launch.launchEventID,
                briefID: brief.id,
                officeID: brief.repID,
                issueID: brief.issueID.isEmpty ? nil : brief.issueID,
                launchedAt: launch.launchedAt
            )
            if launch.callScoreEnabled == false {
                print("[IssueCall] Call score is currently disabled for this rollout.")
            }
        } catch {
            // Preserve the ability to ask for completion locally even when network launch logging fails.
            pendingCallLaunch = PendingCallLaunch(
                launchEventID: UUID().uuidString,
                briefID: brief.id,
                officeID: brief.repID,
                issueID: brief.issueID.isEmpty ? nil : brief.issueID,
                launchedAt: Date()
            )
            print("[IssueCall] call launch log failed; continuing with local completion prompt.")
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

            if completed {
                lastCompletionResult = response
                pendingCallLaunch = nil
                await refreshCallScoreData(for: userID)
            } else {
                lastCompletionResult = nil
            }
        } catch {
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

        callStats = CivicCallStats(
            totalVoteNowCalls: totalVoteNowCalls,
            monthlyVoteNowCalls: monthlyVoteNowCalls,
            userCallCount: userCallCount
        )
    }

    private static func sumEligibleVerifiedCalls(in leaderboard: CivicLeaderboardResponse) -> Int {
        leaderboard.entries.reduce(0) { partial, entry in
            partial + max(0, entry.eligibleVerifiedCallCount)
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
        let normalized = normalizedBriefs(enriched.callBriefs)
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
        let normalized = normalizedBriefs(resolution.callBriefs)
        let fresh = CivicHistoryGroup(
            id: UUID().uuidString,
            issueID: resolution.issueID,
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
        return UUID().uuidString
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
                summary: "Recent military escalation has renewed pressure on Congress to reassert its constitutional war powers. This issue asks members of Congress to oppose unauthorized U.S. military action against Iran, support de-escalation, and back legislation or resolutions requiring congressional approval before further escalation.",
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
                summary: "This issue asks Congress to oppose anti-trans legislation, censorship efforts, and restrictions on medically necessary gender-affirming care. The focus is equal protection, bodily autonomy, and evidence-based treatment rather than political targeting.",
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
                summary: "This issue frames concerns about FBI leadership as an accountability and public-trust issue. Constituents ask members of Congress to demand Kash Patel's resignation, support investigations into misconduct or misuse of resources, and pursue formal accountability measures if needed.",
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
                summary: "This issue asks senators to oppose Steve Pearce for Bureau of Land Management director because of his record on public lands and ties to extraction interests. The message emphasizes stewardship, conservation, and protection of federal lands.",
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
                summary: "This issue asks senators to reject legislation that would impose new documentation barriers to voter registration and participation. The emphasis is protecting ballot access for eligible voters and opposing unnecessary bureaucratic hurdles.",
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
                summary: "This issue asks senators to oppose Casey Means for Surgeon General and support evidence-based public health leadership. The message centers on credibility, trust, and the importance of science-driven health communication.",
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
                summary: "This issue asks lawmakers to defend Temporary Protected Status for Haitians, oppose efforts to end those protections, and support stability for families facing dangerous conditions and legal uncertainty.",
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
                summary: "This issue asks members of Congress to oppose efforts to dismantle the legal basis for federal climate regulation and to defend protections against dangerous pollution. The focus is climate responsibility and public health.",
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
                summary: "This issue asks Congress to oppose any effort by the administration to pressure or take control of Greenland and to defend allied sovereignty, international stability, and responsible foreign policy.",
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
                summary: "This issue asks Congress to preserve states' ability to regulate AI systems when federal protections are incomplete. The message centers on consumer protection, state authority, and the need for enforceable safeguards.",
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
                summary: "This issue asks lawmakers to support a farm bill that protects SNAP, strengthens food security, and helps family farmers instead of shifting large new costs to states.",
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
                summary: "This issue asks lawmakers to protect Pell Grants and student-aid programs and avoid changes that make college or job training harder to afford.",
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
                summary: "This issue asks Congress to invest in resilience, grid reliability, and insurance-market stability so disaster costs do not keep falling on households.",
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
                summary: "This issue asks lawmakers to support fair maps, transparent election administration, and guardrails against mid-cycle partisan redistricting.",
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
                summary: "This issue asks lawmakers to advance a bipartisan solvency plan now so any changes are gradual, protect earned benefits, and avoid sudden cuts.",
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
                summary: "This issue asks lawmakers to support more housing supply, more rental relief, and federal incentives for states and cities to allow more homes near jobs and transit.",
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
                summary: "This issue asks lawmakers to prevent avoidable coverage losses by restoring affordability and rejecting paperwork rules that push eligible people off insurance.",
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
                summary: "This issue asks lawmakers to prioritize lower premiums, deductibles, and drug costs while protecting health coverage.",
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
                summary: "This issue asks lawmakers to clearly support federal protections and funding for reproductive health care and to vote accordingly.",
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
                summary: "This issue asks lawmakers to support worker protections, retraining, and transparent impact assessments for layoffs and federal workforce cuts.",
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
                summary: "This issue asks lawmakers to back policies that lower everyday costs for families without adding hidden taxes or supply shocks.",
                liveScript: "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to back policies that lower everyday costs for families without adding new hidden taxes or supply shocks.\n\nPlease focus on affordability in the real economy, especially food, housing, and other essential household costs.\n\nThank you for your time and consideration.",
                voicemailScript: "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to back policies that lower everyday costs for families without adding hidden taxes or supply shocks.\n\nThank you for your time and consideration.",
                templateAsks: [.support, .askPublicStatement, .seekOversight],
                relatedBills: [],
                tags: ["economy", "inflation", "cost-of-living", "prices", "families"]
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

    private static func buildRepTargets(from federalReps: [Official]) -> [CivicRepTarget] {
        let senators = federalReps.filter { official in
            let title = (official.officeTitle ?? "").lowercased()
            if title.contains("senator") { return true }
            let division = (official.divisionId ?? "").lowercased()
            return division.contains("/state:") && !division.contains("/cd:")
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

    private func normalizedBriefs(_ briefs: [CivicCallBrief]) -> [CivicCallBrief] {
        var seenIDs = Set<String>()
        var normalized: [(index: Int, brief: CivicCallBrief)] = []

        for (index, brief) in briefs.enumerated() {
            let baseID = brief.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? UUID().uuidString
                : brief.id.trimmingCharacters(in: .whitespacesAndNewlines)
            let uniqueID = seenIDs.insert(baseID).inserted ? baseID : "\(baseID)-\(index)"

            let nameKey = Self.normalizeNameKey(brief.repName)
            let resolvedSlot = brief.repSlot ?? slotByRepID[brief.repID] ?? slotByName[nameKey]

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
                issueID: brief.issueID,
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

    private static func normalizeNameKey(_ raw: String) -> String {
        raw
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }

    private func userIDForRequest() async -> String {
        if let id = await SupabaseManager.shared.currentUserIDIfAvailable() {
            return id.uuidString
        }
        let key = "civic.local.user_id.v1"
        if let existing = UserDefaults.standard.string(forKey: key),
           UUID(uuidString: existing) != nil {
            return existing
        }
        let generated = UUID().uuidString
        UserDefaults.standard.set(generated, forKey: key)
        return generated
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
