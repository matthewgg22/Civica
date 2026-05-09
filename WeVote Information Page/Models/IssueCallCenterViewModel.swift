import Foundation
import SwiftUI
import OSLog

@MainActor
final class IssueCallCenterViewModel: ObservableObject {

    // MARK: – Nested Types

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

    // Private types used by ScriptChat — kept here so extensions in
    // IssueCallCenterViewModel+ScriptChat.swift can reference them.
    struct ScriptChatTurnPayload: Codable, Sendable {
        let sessionID: String
        let packageID: String?
        let role: String
        let turnIndex: Int
        let messageText: String
        let messageType: String?
        let metadata: [String: String]?
    }

    struct PersistedScriptChatState: Codable, Sendable {
        let sessionID: String?
        let turnIndex: Int
        let pendingPayloads: [ScriptChatTurnPayload]
    }

    // MARK: – @Published Properties

    @Published var selectedTab: CivicIssueCallTab = .assistant
    @Published var selectedRepFilter: CivicRepFilter = .all
    @Published var concernText: String = ""
    @Published var selectedAsk: CivicAsk?
    @Published var optionalBillRef: String = ""
    @Published var isSubmitting = false
    @Published var errorMessage: String?
    @Published var isInitialContentLoading = false
    @Published var hasLoadedInitialContent = false
    @Published var isInitialContentEmpty = false
    @Published var initialContentErrorMessage: String?

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
    @Published var mapcV3LastFailureReasonCode: String?

    // MARK: – Computed Properties

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

    // MARK: – Stored Properties

    let repTargets: [CivicRepTarget]
    let officialLookupByRepID: [String: Official]
    let officialLookupByName: [String: Official]
    let officialBySlot: [CivicRepSlot: Official]
    let slotByRepID: [String: CivicRepSlot]
    let slotByName: [String: CivicRepSlot]
    let userZip: String
    let apiClient: CivicIssueCallAPIClientProtocol
    let cacheStore: CivicCallBriefCacheStore
    let supabaseManager: SupabaseManager
    let logger = Logger(subsystem: "Civica", category: "IssueCallCenter")
    var deferredSnapshotTask: Task<Void, Never>?
    var hasLoadedExamplesAndHistoryThisSession = false
    var callScoreRefreshTask: Task<Void, Never>?
    var lastCallScoreRefreshAt: Date = .distantPast
    var lastCallScoreRefreshUserID: String?
    let callScoreRefreshCooldown: TimeInterval = 8
    var activeMAPCSessionID: UUID?
    var pendingGeneratedResolution: CivicIssueResolutionResponse?
    var lastGeneratedPackageID: String?
    var scriptChatSessionID: UUID?
    var scriptChatTurnIndex: Int = 0
    var pendingScriptChatTurnPayloads: [ScriptChatTurnPayload] = []
    var isFlushingScriptChatTurns = false
    var hasLoggedScriptChatTelemetryFailure = false
    var hasLoggedScriptFeedbackTelemetryFailure = false
    let scriptChatStateDefaultsKey = "civic.issue_call.script_chat_state.v1"
    let zipFallbackToken = "[ZIPCODE]"
    let mapcV3RecoveryMessage = "I hit a snag, but I still have your issue. Pick a fix or restate the action you want."
    let mapcV3LintRecoveryMessage = "I hit a snag, but I still have your issue. Pick a fix or restate the action you want."
    let mapcRepResolutionRequiredMessage = "We couldn't find your representatives yet. Set or confirm your location, then try again."
    let mapcGenerationPathV3 = "v3"
    let mapcGenerationPathPremade = "premade"
    let mapcGenerationPathOfflineNotice = "offline_notice"
    let mapcGenerationPathBlockedLegacy = "blocked_legacy"
    var mapcV3PendingSessionID: String?
    var mapcV3PreserveSessionForNextSubmit = false

    // MARK: – Initializer

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

    // MARK: – Derived Zip Helpers

    var resolvedUserZip: String {
        let normalized = String(userZip.filter(\.isNumber).prefix(5))
        return normalized.count == 5 ? normalized : zipFallbackToken
    }

    var requestUserZip: String? {
        let normalized = String(userZip.filter(\.isNumber).prefix(5))
        return normalized.count == 5 ? normalized : nil
    }

    var resolvedUserState: String? {
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

    // MARK: – Feature Flags & Filters

    var mapcPipelineV3Enabled: Bool {
        VoteNowLaunchFeatures.resolvedMAPCV3Enabled()
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
        selectedAsk != nil && !concernText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
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
}

// MARK: – Module-Level Utilities

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
