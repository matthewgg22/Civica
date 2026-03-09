import Foundation

enum UserElectionCompletionState: String, Codable, Sendable, CaseIterable {
    case notStarted = "not_started"
    case inProgress = "in_progress"
    case ballotMailed = "ballot_mailed"
    case ballotDelivered = "ballot_delivered"
    case provisionalPending = "provisional_pending"
    case cureNeeded = "cure_needed"
    case voted = "voted"
    case ballotReceived = "ballot_received"
    case ballotAccepted = "ballot_accepted"

    var isTerminal: Bool {
        switch self {
        case .voted, .ballotReceived, .ballotAccepted:
            return true
        case .notStarted, .inProgress, .ballotMailed, .ballotDelivered, .provisionalPending, .cureNeeded:
            return false
        }
    }

    var isProvisionalFlow: Bool {
        switch self {
        case .provisionalPending, .cureNeeded:
            return true
        default:
            return false
        }
    }
}

enum UserElectionCompletionSource: String, Codable, Sendable {
    case selfReport = "self_report"
    case ballotTracker = "ballot_tracker"
    case system = "system"
    case undo = "undo"
}

struct UserElectionStatusRecord: Decodable, Sendable {
    let userID: UUID
    let electionID: String
    let completionState: UserElectionCompletionState
    let completedAt: Date?
    let completionSource: String?
    let completionConfidence: Double?
    let notificationsSuppressed: Bool
    let suppressionReason: String?
    let suppressionUpdatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case electionID = "election_id"
        case completionState = "completion_state"
        case completedAt = "completed_at"
        case completionSource = "completion_source"
        case completionConfidence = "completion_confidence"
        case notificationsSuppressed = "notifications_suppressed"
        case suppressionReason = "suppression_reason"
        case suppressionUpdatedAt = "suppression_updated_at"
    }

    init(
        userID: UUID,
        electionID: String,
        completionState: UserElectionCompletionState,
        completedAt: Date?,
        completionSource: String?,
        completionConfidence: Double?,
        notificationsSuppressed: Bool,
        suppressionReason: String?,
        suppressionUpdatedAt: Date?
    ) {
        self.userID = userID
        self.electionID = electionID
        self.completionState = completionState
        self.completedAt = completedAt
        self.completionSource = completionSource
        self.completionConfidence = completionConfidence
        self.notificationsSuppressed = notificationsSuppressed
        self.suppressionReason = suppressionReason
        self.suppressionUpdatedAt = suppressionUpdatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        userID = try container.decode(UUID.self, forKey: .userID)
        electionID = try container.decode(String.self, forKey: .electionID)
        completionState = try container.decode(UserElectionCompletionState.self, forKey: .completionState)
        completionSource = try container.decodeIfPresent(String.self, forKey: .completionSource)
        completionConfidence = try container.decodeIfPresent(Double.self, forKey: .completionConfidence)
        notificationsSuppressed = try container.decodeIfPresent(Bool.self, forKey: .notificationsSuppressed) ?? false
        suppressionReason = try container.decodeIfPresent(String.self, forKey: .suppressionReason)

        if let completedAtRaw = try container.decodeIfPresent(String.self, forKey: .completedAt) {
            completedAt = SupabaseTimestampCodec.decode(completedAtRaw)
        } else if let completedAtDate = try container.decodeIfPresent(Date.self, forKey: .completedAt) {
            completedAt = completedAtDate
        } else {
            completedAt = nil
        }

        if let suppressionUpdatedAtRaw = try container.decodeIfPresent(String.self, forKey: .suppressionUpdatedAt) {
            suppressionUpdatedAt = SupabaseTimestampCodec.decode(suppressionUpdatedAtRaw)
        } else if let suppressionUpdatedAtDate = try container.decodeIfPresent(Date.self, forKey: .suppressionUpdatedAt) {
            suppressionUpdatedAt = suppressionUpdatedAtDate
        } else {
            suppressionUpdatedAt = nil
        }
    }
}

struct UserElectionStatusInsertPayload: Encodable, Sendable {
    let userID: UUID
    let electionID: String
    let completionState: String
    let completedAt: String?
    let completionSource: String?
    let completionConfidence: Double?
    let notificationsSuppressed: Bool
    let suppressionReason: String?
    let suppressionUpdatedAt: String

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case electionID = "election_id"
        case completionState = "completion_state"
        case completedAt = "completed_at"
        case completionSource = "completion_source"
        case completionConfidence = "completion_confidence"
        case notificationsSuppressed = "notifications_suppressed"
        case suppressionReason = "suppression_reason"
        case suppressionUpdatedAt = "suppression_updated_at"
    }
}

struct UserElectionStatusUpdatePayload: Encodable, Sendable {
    let completionState: String
    let completedAt: String?
    let completionSource: String?
    let completionConfidence: Double?
    let notificationsSuppressed: Bool
    let suppressionReason: String?
    let suppressionUpdatedAt: String

    enum CodingKeys: String, CodingKey {
        case completionState = "completion_state"
        case completedAt = "completed_at"
        case completionSource = "completion_source"
        case completionConfidence = "completion_confidence"
        case notificationsSuppressed = "notifications_suppressed"
        case suppressionReason = "suppression_reason"
        case suppressionUpdatedAt = "suppression_updated_at"
    }
}

enum MAPVNotificationPluginID: String, CaseIterable, Sendable {
    case mapvPlanSavedOrIncomplete = "mapv_plan_saved_or_incomplete"
    case mapvCommitmentReplay = "mapv_commitment_replay"
    case mapvBuddyAccountability = "mapv_buddy_accountability"
    case mapvOfficialChangeOverride = "mapv_official_change_override"
    case mapvMissedPlanRescue = "mapv_missed_plan_rescue"
    case edPlanLock72h = "ed_plan_lock_72h"
    case edNightBeforePrep = "ed_night_before_prep"
    case edMorningDeparture = "ed_morning_departure"
    case edMiddayRescue = "ed_midday_rescue"
    case edCloseSoon = "ed_close_soon"
    case evWindowOpen = "ev_window_open"
    case evSlotSelectionNudge = "ev_slot_selection_nudge"
    case evTomorrowConfirm = "ev_tomorrow_confirm"
    case evLeaveNow = "ev_leave_now"
    case evWindowEndingSwitch = "ev_window_ending_switch"
    case mailRequestNow = "mail_request_now"
    case mailBallotOutbound = "mail_ballot_outbound"
    case mailFillTonight = "mail_fill_tonight"
    case mailSafeReturnOrPivot = "mail_safe_return_or_pivot"
}

enum MAPVNotificationTrigger: String, Sendable {
    case planUpdated = "PLAN_UPDATED"
    case officialHashChange = "OFFICIAL_HASH_CHANGE"
    case lifecycleTick = "LIFECYCLE_TICK"
    case postPlanGracePassed = "POST_PLAN_GRACE_PASSED"
}

struct MAPVOfficialChange: Sendable {
    let field: String
    let oldValue: String
    let newValue: String
}

struct MAPVNotificationPluginContext: Sendable {
    let electionID: String
    let planSnapshotID: String
    let method: String
    let electionDay: Date
    let plannedActionTime: Date?
    let plannedDepartureTime: Date?
    let pollSiteName: String?
    let pollOpen: Date?
    let pollClose: Date?
    let isPlanComplete: Bool
    let missingField: String?
    let materialEditInLast24h: Bool
    let commitmentText: String?
    let replayAllowed: Bool
    let commitmentRemoved: Bool
    let buddyName: String?
    let buddyContactID: String?
    let buddyTwoWayOptIn: Bool
    let officialChange: MAPVOfficialChange?
    let completionState: UserElectionCompletionState
    let completionMethodDescription: String?
    let earlyVoteWindowStart: Date?
    let earlyVoteWindowEnd: Date?
    let mailRequestRequired: Bool?
    let mailRequestWindowOpen: Bool?
    let mailBallotRequested: Bool?
    let autoMailJurisdiction: Bool?
    let trackerStatus: String?
    let returnMethod: String?
    let safeMailDeadline: Date?
    let backupOption1: String?
    let backupOption2: String?
    let now: Date

    var isElectionDayMethod: Bool { method == "election_day" }
    var isEarlyVoteMethod: Bool { method == "early_vote" }
    var isMailMethod: Bool { method == "vote_by_mail" }
}

struct MAPVNotificationDraft: Sendable {
    let pluginID: MAPVNotificationPluginID
    let notificationType: String
    let title: String
    let body: String
    let sendAt: Date
    let bypassQuietHours: Bool
}

enum MAPVNotificationPluginEngine {
    static func generateDrafts(
        trigger: MAPVNotificationTrigger,
        context: MAPVNotificationPluginContext
    ) -> [MAPVNotificationDraft] {
        guard context.completionState.isTerminal == false else { return [] }

        var drafts: [MAPVNotificationDraft] = []

        switch trigger {
        case .planUpdated:
            if let draft = planSavedOrIncomplete(context: context) {
                drafts.append(draft)
            }
            if let draft = commitmentReplay(context: context) {
                drafts.append(draft)
            }
            drafts.append(contentsOf: buddyAccountability(context: context))
            drafts.append(contentsOf: electionDayDrafts(context: context))
            drafts.append(contentsOf: earlyVoteDrafts(context: context))
            drafts.append(contentsOf: mailDrafts(context: context))
        case .officialHashChange:
            if let draft = officialChangeOverride(context: context) {
                drafts.append(draft)
            }
        case .postPlanGracePassed:
            if let draft = missedPlanRescue(context: context) {
                drafts.append(draft)
            }
        case .lifecycleTick:
            if let draft = commitmentReplay(context: context) {
                drafts.append(draft)
            }
            drafts.append(contentsOf: buddyAccountability(context: context))
            drafts.append(contentsOf: electionDayDrafts(context: context))
            drafts.append(contentsOf: earlyVoteDrafts(context: context))
            drafts.append(contentsOf: mailDrafts(context: context))
            if let draft = missedPlanRescue(context: context) {
                drafts.append(draft)
            }
        }

        return dedupe(drafts)
    }

    static func isProvisionalOrCureNotification(type: String) -> Bool {
        let key = type.lowercased()
        return key.contains("provisional") || key.contains("cure")
    }

    static func shouldSuppressNotification(
        completionState: UserElectionCompletionState,
        notificationsSuppressed: Bool,
        notificationType: String
    ) -> Bool {
        if completionState.isTerminal {
            return true
        }

        if completionState.isProvisionalFlow {
            return !isProvisionalOrCureNotification(type: notificationType)
        }

        if notificationsSuppressed {
            return true
        }

        return false
    }

    static func shouldSuppressNotification(
        status: UserElectionStatusRecord?,
        notificationType: String
    ) -> Bool {
        guard let status else { return false }
        return shouldSuppressNotification(
            completionState: status.completionState,
            notificationsSuppressed: status.notificationsSuppressed,
            notificationType: notificationType
        )
    }

    static func status(
        for electionID: String,
        in statuses: [UserElectionStatusRecord]
    ) -> UserElectionStatusRecord? {
        statuses.first(where: { $0.electionID == electionID })
    }

    private static func planSavedOrIncomplete(context: MAPVNotificationPluginContext) -> MAPVNotificationDraft? {
        guard context.materialEditInLast24h else {
            return nil
        }

        let title = "Plan updated"
        let body: String
        if context.isPlanComplete, let planned = context.plannedActionTime {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .short
            body = "You picked \(displayMethod(context.method)) on \(formatter.string(from: planned)). Please confirm your saved plan."
        } else if let missingField = context.missingField {
            body = "You picked \(displayMethod(context.method)) — finish the missing step: \(missingField)."
        } else {
            body = "You updated your plan. Confirm details and add a backup option."
        }

        return MAPVNotificationDraft(
            pluginID: .mapvPlanSavedOrIncomplete,
            notificationType: MAPVNotificationPluginID.mapvPlanSavedOrIncomplete.rawValue,
            title: title,
            body: body,
            sendAt: context.now,
            bypassQuietHours: false
        )
    }

    private static func commitmentReplay(context: MAPVNotificationPluginContext) -> MAPVNotificationDraft? {
        guard let commitmentText = context.commitmentText?.trimmingCharacters(in: .whitespacesAndNewlines),
              !commitmentText.isEmpty,
              context.replayAllowed,
              !context.commitmentRemoved,
              let planned = context.plannedActionTime else {
            return nil
        }

        let replayTime = planned.addingTimeInterval(-48 * 60 * 60)
        guard replayTime > context.now else { return nil }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short

        return MAPVNotificationDraft(
            pluginID: .mapvCommitmentReplay,
            notificationType: MAPVNotificationPluginID.mapvCommitmentReplay.rawValue,
            title: "Keep your plan",
            body: "You said: \"\(commitmentText).\" Keep your plan: \(displayMethod(context.method)) \(formatter.string(from: planned)).",
            sendAt: replayTime,
            bypassQuietHours: false
        )
    }

    private static func buddyAccountability(context: MAPVNotificationPluginContext) -> [MAPVNotificationDraft] {
        guard let buddyName = context.buddyName?.trimmingCharacters(in: .whitespacesAndNewlines),
              !buddyName.isEmpty,
              let planned = context.plannedActionTime,
              context.buddyTwoWayOptIn,
              context.buddyContactID?.isEmpty == false else {
            return []
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        let plannedText = formatter.string(from: planned)

        return [
            MAPVNotificationDraft(
                pluginID: .mapvBuddyAccountability,
                notificationType: "\(MAPVNotificationPluginID.mapvBuddyAccountability.rawValue)_night_before",
                title: "Buddy check-in",
                body: "\(buddyName) is expecting your \"I voted\" check-in after \(plannedText).",
                sendAt: planned.addingTimeInterval(-12 * 60 * 60),
                bypassQuietHours: false
            ),
            MAPVNotificationDraft(
                pluginID: .mapvBuddyAccountability,
                notificationType: "\(MAPVNotificationPluginID.mapvBuddyAccountability.rawValue)_post_time",
                title: "Send proof",
                body: "\(buddyName) is waiting for your check-in. Send your \"I voted\" update now.",
                sendAt: planned.addingTimeInterval(20 * 60),
                bypassQuietHours: false
            ),
        ]
    }

    private static func officialChangeOverride(context: MAPVNotificationPluginContext) -> MAPVNotificationDraft? {
        guard let change = context.officialChange else { return nil }
        return MAPVNotificationDraft(
            pluginID: .mapvOfficialChangeOverride,
            notificationType: MAPVNotificationPluginID.mapvOfficialChangeOverride.rawValue,
            title: "Your plan changed",
            body: "Your plan changed: \(change.oldValue) → \(change.newValue).",
            sendAt: context.now,
            bypassQuietHours: true
        )
    }

    private static func missedPlanRescue(context: MAPVNotificationPluginContext) -> MAPVNotificationDraft? {
        guard let planned = context.plannedActionTime else { return nil }
        let graceCutoff = planned.addingTimeInterval(30 * 60)
        guard context.now >= graceCutoff else { return nil }
        guard context.completionState.isTerminal == false else { return nil }

        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        let plannedText = formatter.string(from: planned)
        let backup1 = context.backupOption1 ?? "vote early"
        let backup2 = context.backupOption2 ?? "in-person Election Day"

        return MAPVNotificationDraft(
            pluginID: .mapvMissedPlanRescue,
            notificationType: MAPVNotificationPluginID.mapvMissedPlanRescue.rawValue,
            title: "Plan rescue",
            body: "You missed your \(plannedText) plan. Want \(backup1) or \(backup2) instead?",
            sendAt: context.now,
            bypassQuietHours: false
        )
    }

    private static func electionDayDrafts(context: MAPVNotificationPluginContext) -> [MAPVNotificationDraft] {
        guard context.isElectionDayMethod else { return [] }
        var drafts: [MAPVNotificationDraft] = []

        let lockAt = context.electionDay.addingTimeInterval(-72 * 60 * 60)
        if lockAt > context.now {
            drafts.append(
                MAPVNotificationDraft(
                    pluginID: .edPlanLock72h,
                    notificationType: MAPVNotificationPluginID.edPlanLock72h.rawValue,
                    title: "Lock your Election Day plan",
                    body: "You chose Election Day. Lock your leave time now.",
                    sendAt: lockAt,
                    bypassQuietHours: false
                )
            )
        }

        let nightBefore = context.electionDay.addingTimeInterval(-14 * 60 * 60)
        if nightBefore > context.now {
            drafts.append(
                MAPVNotificationDraft(
                    pluginID: .edNightBeforePrep,
                    notificationType: MAPVNotificationPluginID.edNightBeforePrep.rawValue,
                    title: "Tomorrow is vote day",
                    body: "Tomorrow is your vote day. Confirm site, hours, and departure time.",
                    sendAt: nightBefore,
                    bypassQuietHours: false
                )
            )
        }

        if let depart = context.plannedDepartureTime, depart > context.now {
            drafts.append(
                MAPVNotificationDraft(
                    pluginID: .edMorningDeparture,
                    notificationType: MAPVNotificationPluginID.edMorningDeparture.rawValue,
                    title: "Leave on time",
                    body: "Polls are opening. To keep your plan, leave by \(timeText(depart)).",
                    sendAt: depart.addingTimeInterval(-50 * 60),
                    bypassQuietHours: false
                )
            )
        } else if let pollOpen = context.pollOpen, pollOpen > context.now {
            drafts.append(
                MAPVNotificationDraft(
                    pluginID: .edMorningDeparture,
                    notificationType: MAPVNotificationPluginID.edMorningDeparture.rawValue,
                    title: "Polls are opening",
                    body: "Polls are opening. Leave soon to stay on plan.",
                    sendAt: pollOpen.addingTimeInterval(-30 * 60),
                    bypassQuietHours: false
                )
            )
        }

        let noon = Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: context.electionDay) ?? context.electionDay
        if noon > context.now {
            drafts.append(
                MAPVNotificationDraft(
                    pluginID: .edMiddayRescue,
                    notificationType: MAPVNotificationPluginID.edMiddayRescue.rawValue,
                    title: "You can still vote today",
                    body: "You planned earlier. You can still vote today — recalculate your leave time now.",
                    sendAt: noon,
                    bypassQuietHours: false
                )
            )
        }

        if let pollClose = context.pollClose, pollClose > context.now {
            drafts.append(
                MAPVNotificationDraft(
                    pluginID: .edCloseSoon,
                    notificationType: MAPVNotificationPluginID.edCloseSoon.rawValue,
                    title: "Polls close soon",
                    body: "Still time. Your site closes at \(timeText(pollClose)); leave soon to keep the plan alive.",
                    sendAt: pollClose.addingTimeInterval(-2.5 * 60 * 60),
                    bypassQuietHours: false
                )
            )
        }

        return drafts
    }

    private static func earlyVoteDrafts(context: MAPVNotificationPluginContext) -> [MAPVNotificationDraft] {
        guard context.isEarlyVoteMethod else { return [] }
        var drafts: [MAPVNotificationDraft] = []

        if let windowStart = context.earlyVoteWindowStart, windowStart > context.now {
            drafts.append(
                MAPVNotificationDraft(
                    pluginID: .evWindowOpen,
                    notificationType: MAPVNotificationPluginID.evWindowOpen.rawValue,
                    title: "Early vote is open",
                    body: "Your Early Vote plan is live. Pick the exact day and time now.",
                    sendAt: windowStart,
                    bypassQuietHours: false
                )
            )
        }

        if context.plannedActionTime == nil {
            drafts.append(
                MAPVNotificationDraft(
                    pluginID: .evSlotSelectionNudge,
                    notificationType: MAPVNotificationPluginID.evSlotSelectionNudge.rawValue,
                    title: "Pick your early-vote slot",
                    body: "You chose Early Vote but haven’t picked the day yet. Grab a slot now so it becomes real.",
                    sendAt: context.now.addingTimeInterval(24 * 60 * 60),
                    bypassQuietHours: false
                )
            )
        }

        if let planned = context.plannedActionTime {
            let nightBefore = planned.addingTimeInterval(-14 * 60 * 60)
            if nightBefore > context.now {
                drafts.append(
                    MAPVNotificationDraft(
                        pluginID: .evTomorrowConfirm,
                        notificationType: MAPVNotificationPluginID.evTomorrowConfirm.rawValue,
                        title: "Early-vote check",
                        body: "You picked tomorrow at \(timeText(planned)) at \(context.pollSiteName ?? "your site"). Still good?",
                        sendAt: nightBefore,
                        bypassQuietHours: false
                    )
                )
            }

            let leaveNowAt = planned.addingTimeInterval(-45 * 60)
            if leaveNowAt > context.now {
                drafts.append(
                    MAPVNotificationDraft(
                        pluginID: .evLeaveNow,
                        notificationType: MAPVNotificationPluginID.evLeaveNow.rawValue,
                        title: "Leave now for early vote",
                        body: "Your early-vote slot is now. Leave by \(timeText(planned)) to stay on plan.",
                        sendAt: leaveNowAt,
                        bypassQuietHours: false
                    )
                )
            }
        }

        if let windowEnd = context.earlyVoteWindowEnd, windowEnd > context.now {
            let warningTime = windowEnd.addingTimeInterval(-48 * 60 * 60)
            if warningTime > context.now {
                drafts.append(
                    MAPVNotificationDraft(
                        pluginID: .evWindowEndingSwitch,
                        notificationType: MAPVNotificationPluginID.evWindowEndingSwitch.rawValue,
                        title: "Early-vote window ending",
                        body: "Your early-vote plan is slipping. Last easy chance is coming up. Backup plan is \(context.backupOption1 ?? "Election Day in-person").",
                        sendAt: warningTime,
                        bypassQuietHours: false
                    )
                )
            }
        }

        return drafts
    }

    private static func mailDrafts(context: MAPVNotificationPluginContext) -> [MAPVNotificationDraft] {
        guard context.isMailMethod else { return [] }
        var drafts: [MAPVNotificationDraft] = []

        if context.mailRequestRequired == true,
           context.mailRequestWindowOpen == true,
           context.mailBallotRequested == false,
           context.autoMailJurisdiction != true {
            drafts.append(
                MAPVNotificationDraft(
                    pluginID: .mailRequestNow,
                    notificationType: MAPVNotificationPluginID.mailRequestNow.rawValue,
                    title: "Request your ballot now",
                    body: "You chose mail. First step: request your ballot now.",
                    sendAt: context.now,
                    bypassQuietHours: false
                )
            )
        }

        if let trackerStatus = context.trackerStatus?.lowercased(),
           trackerStatus.contains("issued") || trackerStatus.contains("mailed") {
            drafts.append(
                MAPVNotificationDraft(
                    pluginID: .mailBallotOutbound,
                    notificationType: MAPVNotificationPluginID.mailBallotOutbound.rawValue,
                    title: "Ballot on the way",
                    body: "Your ballot is coming. Keep your return plan as \(context.returnMethod ?? "mail or drop box").",
                    sendAt: context.now,
                    bypassQuietHours: false
                )
            )
        }

        if let trackerStatus = context.trackerStatus?.lowercased(),
           trackerStatus.contains("delivered"),
           context.completionState.isTerminal == false {
            drafts.append(
                MAPVNotificationDraft(
                    pluginID: .mailFillTonight,
                    notificationType: MAPVNotificationPluginID.mailFillTonight.rawValue,
                    title: "Ballot in hand",
                    body: "Your ballot is at home. Fill it out tonight so your plan doesn’t slip.",
                    sendAt: context.now,
                    bypassQuietHours: false
                )
            )
        }

        if let safeDeadline = context.safeMailDeadline {
            if context.now < safeDeadline {
                drafts.append(
                    MAPVNotificationDraft(
                        pluginID: .mailSafeReturnOrPivot,
                        notificationType: MAPVNotificationPluginID.mailSafeReturnOrPivot.rawValue,
                        title: "Return by safe date",
                        body: "To keep your mail plan, return it by \(dateText(safeDeadline)).",
                        sendAt: max(context.now, safeDeadline.addingTimeInterval(-24 * 60 * 60)),
                        bypassQuietHours: false
                    )
                )
            } else {
                drafts.append(
                    MAPVNotificationDraft(
                        pluginID: .mailSafeReturnOrPivot,
                        notificationType: MAPVNotificationPluginID.mailSafeReturnOrPivot.rawValue,
                        title: "Switch return method",
                        body: "Don’t mail this now — use a drop box or switch to in-person voting.",
                        sendAt: context.now,
                        bypassQuietHours: false
                    )
                )
            }
        }

        return drafts
    }

    private static func dedupe(_ drafts: [MAPVNotificationDraft]) -> [MAPVNotificationDraft] {
        var seen = Set<String>()
        var ordered: [MAPVNotificationDraft] = []
        for draft in drafts {
            let key = "\(draft.notificationType)|\(Int(draft.sendAt.timeIntervalSince1970))"
            if seen.insert(key).inserted {
                ordered.append(draft)
            }
        }
        return ordered
    }

    private static func displayMethod(_ rawMethod: String) -> String {
        switch rawMethod {
        case "early_vote": return "Early Vote"
        case "vote_by_mail": return "Mail"
        default: return "Election Day"
        }
    }

    private static func dateText(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    private static func timeText(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
