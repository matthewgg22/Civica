import Foundation
import Testing
@testable import VoteNow

struct MAPVNotificationPluginTests {
    @Test
    func pluginCatalogIncludesAllRequestedPlugins() {
        #expect(MAPVNotificationPluginID.allCases.count == 19)
    }

    @Test
    func planUpdatedGeneratesImmediateIncompletePrompt() {
        let context = MAPVNotificationPluginContext(
            electionID: "CA 2026 General Election",
            planSnapshotID: "snap-1",
            method: "election_day",
            electionDay: Date().addingTimeInterval(7 * 24 * 3600),
            plannedActionTime: nil,
            plannedDepartureTime: nil,
            pollSiteName: nil,
            pollOpen: nil,
            pollClose: nil,
            isPlanComplete: false,
            missingField: "polling place",
            materialEditInLast24h: true,
            commitmentText: nil,
            replayAllowed: false,
            commitmentRemoved: false,
            buddyName: nil,
            buddyContactID: nil,
            buddyTwoWayOptIn: false,
            officialChange: nil,
            completionState: .inProgress,
            completionMethodDescription: nil,
            earlyVoteWindowStart: nil,
            earlyVoteWindowEnd: nil,
            mailRequestRequired: nil,
            mailRequestWindowOpen: nil,
            mailBallotRequested: nil,
            autoMailJurisdiction: nil,
            trackerStatus: nil,
            returnMethod: nil,
            safeMailDeadline: nil,
            backupOption1: nil,
            backupOption2: nil,
            now: Date()
        )

        let drafts = MAPVNotificationPluginEngine.generateDrafts(
            trigger: .planUpdated,
            context: context
        )

        #expect(drafts.contains(where: { $0.pluginID == .mapvPlanSavedOrIncomplete }))
    }

    @Test
    func terminalCompletionSuppressesPluginDrafts() {
        let context = MAPVNotificationPluginContext(
            electionID: "NY 2026 General Election",
            planSnapshotID: "snap-2",
            method: "election_day",
            electionDay: Date().addingTimeInterval(24 * 3600),
            plannedActionTime: Date().addingTimeInterval(5 * 3600),
            plannedDepartureTime: Date().addingTimeInterval(4 * 3600),
            pollSiteName: "Test Site",
            pollOpen: Date().addingTimeInterval(2 * 3600),
            pollClose: Date().addingTimeInterval(10 * 3600),
            isPlanComplete: true,
            missingField: nil,
            materialEditInLast24h: true,
            commitmentText: "I promised my family I would vote.",
            replayAllowed: true,
            commitmentRemoved: false,
            buddyName: "Alex",
            buddyContactID: "buddy-1",
            buddyTwoWayOptIn: true,
            officialChange: nil,
            completionState: .voted,
            completionMethodDescription: "election_day",
            earlyVoteWindowStart: nil,
            earlyVoteWindowEnd: nil,
            mailRequestRequired: nil,
            mailRequestWindowOpen: nil,
            mailBallotRequested: nil,
            autoMailJurisdiction: nil,
            trackerStatus: nil,
            returnMethod: nil,
            safeMailDeadline: nil,
            backupOption1: nil,
            backupOption2: nil,
            now: Date()
        )

        let drafts = MAPVNotificationPluginEngine.generateDrafts(
            trigger: .planUpdated,
            context: context
        )

        #expect(drafts.isEmpty)
    }

    @Test
    func provisionalAndCureTypeDetection() {
        #expect(MAPVNotificationPluginEngine.isProvisionalOrCureNotification(type: "provisional_followup"))
        #expect(MAPVNotificationPluginEngine.isProvisionalOrCureNotification(type: "cure_deadline_warning"))
        #expect(MAPVNotificationPluginEngine.isProvisionalOrCureNotification(type: "election_day_reminder") == false)
    }

    @Test
    func selfReportSuppressionForTerminalVote() {
        let suppressed = MAPVNotificationPluginEngine.shouldSuppressNotification(
            completionState: .voted,
            notificationsSuppressed: true,
            notificationType: "election_day_reminder"
        )
        #expect(suppressed)
    }

    @Test
    func ballotTrackerSuppressionForAcceptedBallot() {
        let suppressed = MAPVNotificationPluginEngine.shouldSuppressNotification(
            completionState: .ballotAccepted,
            notificationsSuppressed: true,
            notificationType: "early_voting_open"
        )
        #expect(suppressed)
    }

    @Test
    func provisionalFlowAllowsOnlyProvisionalAndCureNotifications() {
        let allowProvisional = MAPVNotificationPluginEngine.shouldSuppressNotification(
            completionState: .provisionalPending,
            notificationsSuppressed: true,
            notificationType: "provisional_followup"
        )
        let suppressGeneric = MAPVNotificationPluginEngine.shouldSuppressNotification(
            completionState: .provisionalPending,
            notificationsSuppressed: true,
            notificationType: "election_day_reminder"
        )
        #expect(allowProvisional == false)
        #expect(suppressGeneric)
    }

    @Test
    func cureNeededFlowAllowsOnlyCureNotifications() {
        let allowCure = MAPVNotificationPluginEngine.shouldSuppressNotification(
            completionState: .cureNeeded,
            notificationsSuppressed: true,
            notificationType: "cure_deadline_warning"
        )
        let suppressGeneric = MAPVNotificationPluginEngine.shouldSuppressNotification(
            completionState: .cureNeeded,
            notificationsSuppressed: true,
            notificationType: "mapv_plan_saved_or_incomplete"
        )
        #expect(allowCure == false)
        #expect(suppressGeneric)
    }

    @Test
    func undoCompletionRemovesSuppression() {
        let suppressed = MAPVNotificationPluginEngine.shouldSuppressNotification(
            completionState: .inProgress,
            notificationsSuppressed: false,
            notificationType: "election_day_reminder"
        )
        #expect(suppressed == false)
    }

    @Test
    func multiElectionIsolationPicksStatusForRequestedElectionOnly() {
        let userID = UUID()
        let statusA = UserElectionStatusRecord(
            userID: userID,
            electionID: "election-a",
            completionState: .voted,
            completedAt: Date(),
            completionSource: "self_report",
            completionConfidence: 1.0,
            notificationsSuppressed: true,
            suppressionReason: "completed_voted",
            suppressionUpdatedAt: Date()
        )
        let statusB = UserElectionStatusRecord(
            userID: userID,
            electionID: "election-b",
            completionState: .inProgress,
            completedAt: nil,
            completionSource: nil,
            completionConfidence: nil,
            notificationsSuppressed: false,
            suppressionReason: nil,
            suppressionUpdatedAt: Date()
        )

        let targetStatus = MAPVNotificationPluginEngine.status(
            for: "election-b",
            in: [statusA, statusB]
        )
        #expect(targetStatus?.electionID == "election-b")
        #expect(targetStatus?.completionState == .inProgress)
    }
}
