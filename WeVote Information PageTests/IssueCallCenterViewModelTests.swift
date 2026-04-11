import Foundation
import Testing
@testable import VoteNow

@MainActor
struct IssueCallCenterViewModelTests {
    private struct MockAPIClient: CivicIssueCallAPIClientProtocol {
        var resolveResponse: CivicIssueResolutionResponse
        var examples: [CivicExampleIssueCard] = []
        var history: [CivicHistoryGroup] = []
        var completionResponseOverride: CivicCallCompletionResponse? = nil

        func fetchExamples(userID: String, reps: [CivicRepTarget]) async throws -> [CivicExampleIssueCard] {
            examples
        }

        func createScriptPackage(
            userID: String,
            concernText: String,
            selectedAsk: CivicAsk,
            targetReps: [CivicRepSlot],
            repTargets _: [CivicRepTarget],
            optionalBillRef: String?,
            userZip _: String?,
            userState _: String?
        ) async throws -> CivicScriptPackageResponse {
            let billText = optionalBillRef ?? resolveResponse.resolvedEntities.bills.first ?? "this issue"
            let overlays = resolveResponse.callBriefs.map { brief in
                CivicScriptPackageOfficeOverlay(
                    repID: brief.repID,
                    repName: brief.repName,
                    officeType: brief.officeType,
                    chamber: brief.officeType.lowercased().contains("senator") ? "senate" : "house",
                    committeeMatch: CivicScriptPackageCommitteeMatch(
                        matched: !brief.relatedCommittees.isEmpty,
                        matchedCommittees: brief.relatedCommittees,
                        jurisdictionCallout: nil
                    ),
                    roleOverlays: ["none"],
                    liveScriptFinal: brief.liveScript,
                    voicemailScriptFinal: brief.voicemailScript,
                    relatedCommittees: brief.relatedCommittees
                )
            }
            return CivicScriptPackageResponse(
                status: .ok,
                packageID: "pkg-test",
                canonicalContext: CivicScriptPackageCanonicalContext(
                    issueID: resolveResponse.issueID,
                    title: resolveResponse.issueTitle,
                    summaryPlain: resolveResponse.issueSummary,
                    commonAsk: selectedAsk.rawValue,
                    relatedBills: resolveResponse.resolvedEntities.bills,
                    billSource: optionalBillRef == nil ? "none" : "user",
                    billDisplayText: billText,
                    evidenceQuality: "limited",
                    evidenceWarning: nil,
                    keyFacts: [
                        CivicIssueBriefFact(
                            fact: "Test fact",
                            sourceName: "UnitTest",
                            sourceURL: nil,
                            publishedAt: nil
                        )
                    ]
                ),
                scriptCore: CivicScriptPackageScriptCore(
                    liveScriptCore: "Hi, I am calling {OFFICE_TYPE} {REP_NAME} about this issue.",
                    voicemailScriptCore: "Voicemail for {OFFICE_TYPE} {REP_NAME} about this issue."
                ),
                officeOverlays: overlays,
                reviewCanRegenerate: true,
                reviewRegenerateHint: "Adjust and regenerate.",
                truthTrace: CivicScriptPackageTruthTrace(
                    normalizedInput: concernText,
                    canonicalIssueID: resolveResponse.issueID,
                    classificationReason: "unit_test",
                    billSource: optionalBillRef == nil ? "none" : "user",
                    personalizationFieldsUsed: ["rep_name", "office_type"],
                    fallbackUsed: "none",
                    refusalReason: nil
                ),
                policyFlags: []
            )
        }

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
        ) async throws -> CivicMAPCV3PreparedSelection {
            let resolvedSessionID = sessionID ?? UUID().uuidString
            let normalizedConcern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
            let displayIssue = normalizedConcern.isEmpty ? "Federal policy issue" : normalizedConcern
            let session = CivicMAPCV3Session(
                sessionID: resolvedSessionID,
                rawUserIssue: normalizedConcern,
                normalizedIssue: displayIssue,
                displayIssue: displayIssue,
                issueDomain: "general_policy",
                targetProblem: "Constituent requests office action",
                congressionalLever: "oversight",
                askType: "oversight_reporting_requirement",
                displayAsk: "Require public reporting deadlines",
                stance: "support",
                geographicRelevance: "national",
                optionalBillRef: nil,
                constraintsFromUser: nil,
                confidence: 0.82,
                needsClarification: false,
                clarificationPrompt: nil,
                spokenLanguageNotes: nil,
                sessionState: "ask_selected",
                userZip: userZip,
                accumulatedContext: accumulatedContext,
                introShown: introShown,
                clarificationTurnCount: clarificationTurnCount,
                mapcApproved: mapcApproved
            )
            return CivicMAPCV3PreparedSelection(
                sessionID: resolvedSessionID,
                session: session,
                displayIssue: session.displayIssue,
                needsClarification: false,
                clarificationPrompt: nil,
                options: [
                    CivicMAPCV3PreparedOption(
                        optionID: "A1",
                        askType: "oversight_reporting_requirement",
                        displayAsk: "Require public reporting deadlines",
                        confidence: 0.82
                    ),
                    CivicMAPCV3PreparedOption(
                        optionID: "A2",
                        askType: "appropriations_funding",
                        displayAsk: "Fund targeted enforcement capacity",
                        confidence: 0.78
                    )
                ]
            )
        }

        func generateMAPCV3ScriptFromSelection(
            userID: String,
            concernText: String,
            sessionID: String,
            selectedOptionID: String,
            targetReps: [CivicRepSlot],
            repTargets: [CivicRepTarget],
            optionalBillRef: String?,
            userState: String?
        ) async throws -> CivicScriptPackageResponse {
            try await createScriptPackage(
                userID: userID,
                concernText: concernText,
                selectedAsk: .support,
                targetReps: targetReps,
                repTargets: repTargets,
                optionalBillRef: optionalBillRef,
                userZip: nil,
                userState: userState
            )
        }

        func logScriptFeedback(
            userID: String,
            packageID: String,
            decision: String,
            chosenOption: String?,
            finalScript: String?
        ) async throws {}

        func logScriptChatTurn(
            userID: String,
            sessionID: String,
            packageID: String?,
            role: String,
            turnIndex: Int,
            messageText: String,
            messageType: String?,
            metadata: [String: String]?
        ) async throws {}

        func logCall(
            userID: String,
            repID: String,
            issueID: String,
            briefID: String,
            outcome: CivicCallOutcome,
            stafferPosition: String?,
            notes: String
        ) async throws {}

        func fetchHistory(userID: String) async throws -> [CivicHistoryGroup] {
            history
        }

        func logCallLaunch(
            userID: String,
            officeID: String,
            issueID: String?,
            sourceScreen: String,
            sessionID: String?
        ) async throws -> CivicCallLaunchResponse {
            CivicCallLaunchResponse(
                ok: true,
                launchEventID: "launch-\(officeID)",
                launchedAt: Date(),
                callScoreEnabled: true
            )
        }

        func confirmCallCompletion(
            userID: String,
            launchEventID: String,
            completed: Bool
        ) async throws -> CivicCallCompletionResponse {
            if let completionResponseOverride {
                return completionResponseOverride
            }
            CivicCallCompletionResponse(
                ok: true,
                launchEventID: launchEventID,
                callLogged: completed,
                callEventID: completed ? "event-\(launchEventID)" : nil,
                scoringEligible: completed ? true : nil,
                scoringIneligibilityReason: nil,
                callScoreSnapshot: completed
                    ? CivicCallScoreSnapshot(
                        callScore: 56,
                        activationPoints: 30,
                        recencyPoints: 10,
                        consistencyPoints: 6,
                        breadthPoints: 5,
                        momentumPoints: 5,
                        tierName: "Active Advocate",
                        updatedAt: Date()
                    )
                    : nil,
                changedComponents: completed ? ["activation_points"] : [],
                baselineCrossed: completed,
                tierChanged: false
            )
        }

        func fetchCallScoreSummary(userID: String) async throws -> CivicCallScoreSummary {
            CivicCallScoreSummary(
                callScore: 56,
                tierName: "Active Advocate",
                explanation: "Summary",
                updatedAt: Date(),
                enabled: true
            )
        }

        func fetchCallScoreBreakdown(userID: String) async throws -> CivicCallScoreBreakdown {
            let components = CivicCallScoreComponents(
                activationPoints: 30,
                recencyPoints: 10,
                consistencyPoints: 6,
                breadthPoints: 5,
                momentumPoints: 5
            )
            let maxima = CivicCallScoreComponents(
                activationPoints: 30,
                recencyPoints: 10,
                consistencyPoints: 25,
                breadthPoints: 20,
                momentumPoints: 15
            )
            return CivicCallScoreBreakdown(
                callScore: 56,
                tierName: "Active Advocate",
                components: components,
                maxima: maxima,
                updatedAt: Date(),
                enabled: true
            )
        }

        func fetchCallScoreHistory(userID: String, limit: Int) async throws -> [CivicCallScoreHistoryItem] {
            []
        }

        func recomputeCallScore(userID: String) async throws -> CivicCallScoreSnapshot {
            CivicCallScoreSnapshot(
                callScore: 56,
                activationPoints: 30,
                recencyPoints: 10,
                consistencyPoints: 6,
                breadthPoints: 5,
                momentumPoints: 5,
                tierName: "Active Advocate",
                updatedAt: Date()
            )
        }

        func fetchLeaderboard(periodType: String, periodStart: Date?) async throws -> CivicLeaderboardResponse {
            CivicLeaderboardResponse(periodType: periodType, periodStart: Date(), entries: [])
        }

        func fetchUserLeaderboardSummary(userID: String, periodType: String, periodStart: Date?) async throws -> CivicLeaderboardUserSummary {
            CivicLeaderboardUserSummary(
                periodType: periodType,
                periodStart: Date(),
                userID: userID,
                eligibleVerifiedCallCount: 1,
                uniqueOfficeCount: 1,
                rank: 1
            )
        }
    }

    @Test
    func submitAndAdvanceToNextRep() async {
        let reps = sampleFederalReps()
        let response = sampleResolution()
        let vm = IssueCallCenterViewModel(
            federalReps: reps,
            userZip: "10001",
            apiClient: MockAPIClient(resolveResponse: response),
            cacheStore: CivicCallBriefCacheStore(defaults: UserDefaults(suiteName: "IssueCallCenterViewModelTests.submitAndAdvance")!)
        )

        vm.concernText = "Air quality standards and enforcement"
        vm.selectedAsk = .support

        await vm.submitAssistantRequest()

        #expect(vm.callBriefs.count == 3)
        #expect(vm.activeBriefID == vm.filteredBriefs.first?.id)

        if let first = vm.filteredBriefs.first {
            await vm.logOutcome(for: first, outcome: .voicemail)
            #expect(vm.activeBriefID == vm.filteredBriefs.dropFirst().first?.id)
        } else {
            Issue.record("Expected first brief to exist")
        }
    }

    @Test
    func requiresExplicitAskBeforeSubmit() async {
        let vm = IssueCallCenterViewModel(
            federalReps: sampleFederalReps(),
            userZip: "10001",
            apiClient: MockAPIClient(resolveResponse: sampleResolution()),
            cacheStore: CivicCallBriefCacheStore(defaults: UserDefaults(suiteName: "IssueCallCenterViewModelTests.askRequired")!)
        )

        vm.concernText = "Constituent concern"
        vm.selectedAsk = nil

        await vm.submitAssistantRequest()

        #expect(vm.callBriefs.isEmpty)
        #expect(vm.errorMessage != nil)
    }

    @Test
    func callLaunchAndCompletionUpdatesScoreState() async {
        let reps = sampleFederalReps()
        let response = sampleResolution()
        let vm = IssueCallCenterViewModel(
            federalReps: reps,
            userZip: "10001",
            apiClient: MockAPIClient(resolveResponse: response),
            cacheStore: CivicCallBriefCacheStore(defaults: UserDefaults(suiteName: "IssueCallCenterViewModelTests.callLaunch")!)
        )

        vm.concernText = "Constituent concern"
        vm.selectedAsk = .support
        await vm.submitAssistantRequest()

        guard let first = vm.callBriefs.first else {
            Issue.record("Expected a brief")
            return
        }

        await vm.beginCallLaunch(for: first)
        #expect(vm.pendingCallLaunch != nil)
        #expect(vm.shouldPromptForPendingCallCompletion())

        await vm.confirmPendingCallCompletion(completed: true)
        #expect(vm.pendingCallLaunch == nil)
        #expect(vm.lastCompletionResult?.callLogged == true)
        #expect(vm.callScoreSummary?.callScore == 56)
    }

    @Test
    func duplicateCompletionStateIsCaptured() async {
        let reps = sampleFederalReps()
        let response = sampleResolution()
        let duplicateCompletion = CivicCallCompletionResponse(
            ok: true,
            launchEventID: "launch-dup",
            callLogged: true,
            callEventID: "event-dup",
            scoringEligible: false,
            scoringIneligibilityReason: "Recent call to this office already counted in the past 7 days.",
            callScoreSnapshot: CivicCallScoreSnapshot(
                callScore: 56,
                activationPoints: 30,
                recencyPoints: 10,
                consistencyPoints: 6,
                breadthPoints: 5,
                momentumPoints: 5,
                tierName: "Active Advocate",
                updatedAt: Date()
            ),
            changedComponents: [],
            baselineCrossed: false,
            tierChanged: false
        )
        let vm = IssueCallCenterViewModel(
            federalReps: reps,
            userZip: "10001",
            apiClient: MockAPIClient(resolveResponse: response, completionResponseOverride: duplicateCompletion),
            cacheStore: CivicCallBriefCacheStore(defaults: UserDefaults(suiteName: "IssueCallCenterViewModelTests.duplicateCompletion")!)
        )

        vm.concernText = "Constituent concern"
        vm.selectedAsk = .support
        await vm.submitAssistantRequest()

        guard let first = vm.callBriefs.first else {
            Issue.record("Expected a brief")
            return
        }

        await vm.beginCallLaunch(for: first)
        await vm.confirmPendingCallCompletion(completed: true)

        #expect(vm.lastCompletionResult?.scoringEligible == false)
        #expect(vm.lastCompletionResult?.scoringIneligibilityReason?.contains("past 7 days") == true)
    }

    @Test
    func mapcV3FailureMappingUsesEmbeddedReasonCodeWhenPresent() async {
        let vm = IssueCallCenterViewModel(
            federalReps: sampleFederalReps(),
            userZip: "10001",
            apiClient: MockAPIClient(resolveResponse: sampleResolution()),
            cacheStore: CivicCallBriefCacheStore(defaults: UserDefaults(suiteName: "IssueCallCenterViewModelTests.mapcReasonCode")!)
        )
        let description = #"CivicIssueCallAPIClient#400 status 400: {"detail":"{\"reason_code\": \"placeholder_leak\", \"message\": \"disallowed token remained: [Your Name]\"}"}"#
        let result = vm.mapcV3FailureMappingPreview(description: description, domain: "CivicIssueCallAPIClient", code: 400)
        #expect(result.reasonCode == "placeholder_leak")
        #expect(result.message.contains("placeholder"))
    }

    @Test
    func mapcV3FailureMappingPendingStateMissingUsesRecoveryCopy() async {
        let vm = IssueCallCenterViewModel(
            federalReps: sampleFederalReps(),
            userZip: "10001",
            apiClient: MockAPIClient(resolveResponse: sampleResolution()),
            cacheStore: CivicCallBriefCacheStore(defaults: UserDefaults(suiteName: "IssueCallCenterViewModelTests.mapcPendingRecovery")!)
        )
        let result = vm.mapcV3FailureMappingPreview(
            description: "No pending MAPC v3 selection state was found.",
            domain: "CivicIssueCallAPIClient",
            code: -31_006
        )
        #expect(result.reasonCode == "pending_state_missing")
        #expect(result.message == "I hit a snag, but I still have your issue. Pick a fix or restate the action you want.")
    }

    private func sampleFederalReps() -> [Official] {
        [
            Official(
                name: "House Test",
                divisionId: "ocd-division/country:us/state:ny/cd:10",
                party: "Independent",
                officeTitle: "U.S. Representative",
                photoURL: nil,
                officialPhone: "(202) 555-1001"
            ),
            Official(
                name: "Senator Alpha",
                divisionId: "ocd-division/country:us/state:ny",
                party: "Independent",
                officeTitle: "U.S. Senator",
                photoURL: nil,
                officialPhone: "(202) 555-1002"
            ),
            Official(
                name: "Senator Beta",
                divisionId: "ocd-division/country:us/state:ny",
                party: "Independent",
                officeTitle: "U.S. Senator",
                photoURL: nil,
                officialPhone: "(202) 555-1003"
            )
        ]
    }

    private func sampleResolution() -> CivicIssueResolutionResponse {
        CivicIssueResolutionResponse(
            issueID: "issue-1",
            issueTitle: "Air quality standards",
            issueSummary: "Constituent asks for support",
            resolvedEntities: CivicResolvedEntities(
                bills: ["H.R.123"],
                committees: ["Energy and Commerce"],
                agencies: ["EPA"]
            ),
            callBriefs: [
                sampleBrief("brief-1", slot: .house, repName: "House Test", phone: "(202) 555-1001"),
                sampleBrief("brief-2", slot: .senate1, repName: "Senator Alpha", phone: "(202) 555-1002"),
                sampleBrief("brief-3", slot: .senate2, repName: "Senator Beta", phone: "(202) 555-1003")
            ]
        )
    }

    private func sampleBrief(_ id: String, slot: CivicRepSlot, repName: String, phone: String) -> CivicCallBrief {
        CivicCallBrief(
            id: id,
            repID: "rep-\(id)",
            repName: repName,
            officeType: slot == .house ? "U.S. Representative" : "U.S. Senator",
            primaryPhoneNumber: phone,
            localOfficePhoneNumber: nil,
            relevanceBadges: ["Related bill active"],
            relatedBills: ["H.R.123"],
            relatedCommittees: ["Energy"],
            liveScript: "Live script",
            voicemailScript: "Voicemail",
            talkingPoints: ["Point 1", "Point 2", "Point 3"],
            issueID: "issue-1",
            repSlot: slot
        )
    }
}
