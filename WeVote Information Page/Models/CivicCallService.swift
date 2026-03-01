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
        if let draft = snapshot.assistantDraft {
            selectedTab = (draft.selectedTab == .history) ? .civicScore : draft.selectedTab
            selectedRepFilter = .all
            concernText = draft.concernText
            selectedAsk = draft.selectedAsk
            optionalBillRef = draft.optionalBillRef
            activeBriefID = draft.activeBriefID
        }
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

    func reopen(historyGroup: CivicHistoryGroup) {
        issueTitle = historyGroup.issueTitle
        issueSummary = historyGroup.issueSummary
        callBriefs = normalizedBriefs(historyGroup.briefs)
        resolvedEntities = .empty
        activeBriefID = filteredBriefs.first?.id
        selectedTab = .assistant
        persistDraftState()
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
        let normalized = normalizedBriefs(response.callBriefs)
        issueTitle = response.issueTitle
        issueSummary = response.issueSummary
        resolvedEntities = response.resolvedEntities
        callBriefs = normalized
        activeBriefID = filteredBriefs.first?.id
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
        return [
            CivicExampleIssueCard(
                id: "example-federal-budget",
                title: "Federal budget oversight",
                summary: "Congress is reviewing appropriations and agency oversight priorities for the current fiscal cycle.",
                relatedBills: ["H.R.____", "S.____"],
                repRelevance: repTargets.map { "\($0.official.name) serves in \($0.officeType)." },
                templateAsks: [.seekOversight, .askPublicStatement, .support],
                liveScript: "Hi, I am a constituent from \(userZip). I am calling about federal budget oversight. Please prioritize transparent oversight hearings and share the member's current position. Thank you.",
                voicemailScript: "Constituent from \(userZip) calling on budget oversight. Please share the member's position. Thank you."
            )
        ]
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
        let briefs: [CivicCallBrief] = selectedTargets.map { target in
            let repID = stableRepID(for: target.official)
            let reasons = fallbackRelevance(for: target, billRef: optionalBillRef)
            let (live, voicemail, points) = composeScripts(
                repName: target.official.name,
                issueTitle: title,
                ask: ask,
                billRef: optionalBillRef,
                zip: userZip,
                reasons: reasons
            )

            return CivicCallBrief(
                id: UUID().uuidString,
                repID: repID,
                repName: target.official.name,
                officeType: target.officeType,
                primaryPhoneNumber: target.official.officialPhone ?? "",
                localOfficePhoneNumber: nil,
                relevanceBadges: reasons,
                relatedBills: optionalBillRef.map { [$0] } ?? [],
                relatedCommittees: [],
                liveScript: live,
                voicemailScript: voicemail,
                talkingPoints: points,
                issueID: issueID,
                repSlot: target.slot
            )
        }

        return CivicIssueResolutionResponse(
            issueID: issueID,
            issueTitle: title,
            issueSummary: summary,
            resolvedEntities: CivicResolvedEntities(
                bills: optionalBillRef.map { [$0] } ?? [],
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
        return "anonymous-local"
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
