import Foundation
import SwiftUI
import OSLog

// MARK: – Draft Approval & Revision

extension IssueCallCenterViewModel {

    func approveGeneratedDraft() {
        if mapcPipelineV3Enabled && mapcV3SessionState != "script_shown" {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            errorMessage = "Review the script preview first, then tap Looks right before approving."
            return
        }
        let preserveApprovedLaunchState = mapcPipelineV3Enabled && mapcV3MapcApproved
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
        if preserveApprovedLaunchState {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            mapcV3MapcApproved = true
        }
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
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        // Premade tap is an explicit user approval to enter MAPC immediately.
        mapcV3MapcApproved = true
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

    // MARK: – Call Launch & Completion

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
                // Suppress technical "launch_event_missing" feedback card copy in MAPC flow.
                lastCompletionResult = shouldSuppressCompletionFeedback(for: response) ? nil : response
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

    func shouldSuppressCompletionFeedback(for response: CivicCallCompletionResponse) -> Bool {
        let reason = response.scoringIneligibilityReason?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased() ?? ""
        return reason.contains("launch_event_missing")
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

    // MARK: – Civic Score & Leaderboard

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

    func performCallScoreRefreshData(for resolvedUserID: String) async {
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

    static func sumEligibleVerifiedCalls(in leaderboard: CivicLeaderboardResponse) -> Int {
        leaderboard.entries.reduce(0) { partial, entry in
            partial + max(0, entry.eligibleVerifiedCallCount)
        }
    }

    static func normalizedIssueIDKey(_ issueID: String) -> String? {
        let normalized = issueID
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        return normalized.isEmpty ? nil : normalized
    }

    func trackedIssueIDsForCivicScore(maxCount: Int) -> [String] {
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
}
