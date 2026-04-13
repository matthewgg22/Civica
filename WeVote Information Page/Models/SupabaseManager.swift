import Foundation
import OSLog
import CryptoKit
import CoreLocation
import Supabase

@MainActor
enum ReminderSchedulingDeduper {
    static func begin(
        key: String,
        inFlight: inout Set<String>,
        scheduledThisSession: inout Set<String>
    ) -> Bool {
        guard !inFlight.contains(key), !scheduledThisSession.contains(key) else {
            return false
        }
        inFlight.insert(key)
        return true
    }

    static func finish(
        key: String,
        markScheduled: Bool,
        inFlight: inout Set<String>,
        scheduledThisSession: inout Set<String>
    ) {
        inFlight.remove(key)
        if markScheduled {
            scheduledThisSession.insert(key)
        }
    }
}

private enum SupabaseErrorInspector {
    static func isUniqueConstraintViolation(_ error: Error) -> Bool {
        hasPostgrestCode(error, "23505")
            || combinedErrorText(error).contains("23505")
    }

    static func isRLSPermissionDenied(_ error: Error) -> Bool {
        if hasPostgrestCode(error, "42501") {
            return true
        }
        let combined = combinedErrorText(error)
        return combined.contains("42501")
            || combined.contains("row-level security")
            || combined.contains("permission denied for table")
    }

    static func isMissingPollingPlaceColumn(_ error: Error) -> Bool {
        if let postgrestError = error as? PostgrestError {
            let code = postgrestError.code?.lowercased() ?? ""
            let message = postgrestError.message.lowercased()
            if code == "pgrst204" && message.contains("polling_place") {
                return true
            }
        }

        let combined = combinedErrorText(error)
        if combined.contains("pgrst204") && combined.contains("polling_place") {
            return true
        }
        if combined.contains("schema cache") && combined.contains("polling_place") {
            return true
        }
        return false
    }

    static func isRequestCancelled(_ error: Error) -> Bool {
        if error is CancellationError {
            return true
        }
        let nsError = error as NSError
        return nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled
    }

    static func isTransientNetworkError(_ error: Error) -> Bool {
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain {
            switch nsError.code {
            case NSURLErrorTimedOut,
                 NSURLErrorNetworkConnectionLost,
                 NSURLErrorNotConnectedToInternet,
                 NSURLErrorCannotFindHost,
                 NSURLErrorCannotConnectToHost,
                 NSURLErrorDNSLookupFailed:
                return true
            default:
                break
            }
        }

        let combined = combinedErrorText(error)
        return combined.contains("operation timed out")
            || combined.contains("network connection was lost")
            || combined.contains("timed out")
    }

    private static func hasPostgrestCode(_ error: Error, _ code: String) -> Bool {
        guard let postgrestError = error as? PostgrestError else { return false }
        return postgrestError.code == code
    }

    private static func combinedErrorText(_ error: Error) -> String {
        "\(String(describing: error)) \(error.localizedDescription)".lowercased()
    }
}

struct AddressSearchEvent: Encodable, Sendable {
    enum InputType: String, Codable, Sendable {
        case zip
        case fullAddress = "full_address"
        case placeSearch = "place_search"
    }

    enum PlaceSource: String, Codable, Sendable {
        case clGeocoder = "CLGeocoder"
        case mkLocalSearch = "MKLocalSearch"
    }

    let userID: UUID?
    let context: String
    let rawInput: String
    let inputType: InputType?
    let success: Bool
    let errorCode: String?
    let resolvedDisplay: String?
    let postalCode: String?
    let city: String?
    let state: String?
    let countryCode: String?
    let lat: Double?
    let lng: Double?
    let placeSource: PlaceSource?
    let sessionID: UUID?

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case context
        case rawInput = "raw_input"
        case inputType = "input_type"
        case success
        case errorCode = "error_code"
        case resolvedDisplay = "resolved_display"
        case postalCode = "postal_code"
        case city
        case state
        case countryCode = "country_code"
        case lat
        case lng
        case placeSource = "place_source"
        case sessionID = "session_id"
    }
}

struct MAPCCallEventInsert: Encodable, Sendable {
    enum EventType: String, Codable, Sendable {
        case mapcStarted = "mapc_started"
        case callLaunch = "call_launch"
        case callCompletionConfirmed = "call_completion_confirmed"
        case callCompletionFailed = "call_completion_failed"
        case callOutcomeLogged = "call_outcome_logged"
    }

    let sessionID: UUID
    let userID: UUID?
    let issueID: String?
    let issueTitle: String?
    let briefID: String?
    let repID: String?
    let repName: String?
    let repSlot: String?
    let eventType: EventType
    let completed: Bool?
    let outcome: String?
    let sourceScreen: String?
    let metadata: [String: String]?

    enum CodingKeys: String, CodingKey {
        case sessionID = "session_id"
        case userID = "user_id"
        case issueID = "issue_id"
        case issueTitle = "issue_title"
        case briefID = "brief_id"
        case repID = "rep_id"
        case repName = "rep_name"
        case repSlot = "rep_slot"
        case eventType = "event_type"
        case completed
        case outcome
        case sourceScreen = "source_screen"
        case metadata
    }
}

struct MAPCCallSums: Sendable {
    let totalCompletedCalls: Int
    let monthlyCompletedCalls: Int
    let userCompletedCalls: Int

    static let empty = MAPCCallSums(
        totalCompletedCalls: 0,
        monthlyCompletedCalls: 0,
        userCompletedCalls: 0
    )
}

struct MAPCCallIssueSums: Sendable {
    let appCompletedCallsByIssueID: [String: Int]

    static let empty = MAPCCallIssueSums(appCompletedCallsByIssueID: [:])
}

private struct MAPCCallSumsRPCRow: Decodable {
    let totalCompletedCalls: Int
    let monthlyCompletedCalls: Int
    let userCompletedCalls: Int

    enum CodingKeys: String, CodingKey {
        case totalCompletedCalls = "total_completed_calls"
        case monthlyCompletedCalls = "monthly_completed_calls"
        case userCompletedCalls = "user_completed_calls"
    }
}

private struct MAPCCallIssueSumsRPCRow: Decodable {
    let issueID: String
    let totalCompletedCalls: Int

    enum CodingKeys: String, CodingKey {
        case issueID = "issue_id"
        case totalCompletedCalls = "total_completed_calls"
    }
}

private struct MAPCCallIssueSumsRPCParams: Encodable {
    let issue_ids: [String]
}

struct MapvPlanInsert: Encodable, Sendable {
    typealias VotingMethod = MapvPlan.VotingMethod

    let electionID: String
    let plannedTime: Date?
    let pollingPlace: String?
    let votingMethod: VotingMethod?

    enum CodingKeys: String, CodingKey {
        case electionID = "election_id"
        case plannedTime = "planned_time"
        case pollingPlace = "polling_place"
        case votingMethod = "voting_method"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(electionID, forKey: .electionID)
        try container.encodeIfPresent(pollingPlace, forKey: .pollingPlace)
        try container.encodeIfPresent(votingMethod, forKey: .votingMethod)

        if let plannedTime {
            try container.encode(SupabaseTimestampCodec.encode(plannedTime), forKey: .plannedTime)
        } else {
            try container.encodeNil(forKey: .plannedTime)
        }
    }
}

struct MapvPlanInsertCore: Encodable, Sendable {
    typealias VotingMethod = MapvPlan.VotingMethod

    let electionID: String
    let plannedTime: Date?
    let votingMethod: VotingMethod?

    enum CodingKeys: String, CodingKey {
        case electionID = "election_id"
        case plannedTime = "planned_time"
        case votingMethod = "voting_method"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(electionID, forKey: .electionID)
        try container.encodeIfPresent(votingMethod, forKey: .votingMethod)
        if let plannedTime {
            try container.encode(SupabaseTimestampCodec.encode(plannedTime), forKey: .plannedTime)
        } else {
            try container.encodeNil(forKey: .plannedTime)
        }
    }
}

struct MapvPlan: Decodable, Identifiable, Sendable {
    enum VotingMethod: String, Codable, Sendable {
        case earlyVote = "early_vote"
        case voteByMail = "vote_by_mail"
        case electionDay = "election_day"
    }

    let id: UUID
    let createdAt: Date
    let userID: UUID?
    let electionID: String
    let plannedTime: Date?
    let pollingPlace: String?
    let votingMethod: VotingMethod?

    enum CodingKeys: String, CodingKey {
        case id
        case createdAt = "created_at"
        case userID = "user_id"
        case electionID = "election_id"
        case plannedTime = "planned_time"
        case pollingPlace = "polling_place"
        case votingMethod = "voting_method"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        electionID = try container.decode(String.self, forKey: .electionID)
        userID = try container.decodeIfPresent(UUID.self, forKey: .userID)
        pollingPlace = try container.decodeIfPresent(String.self, forKey: .pollingPlace)
        votingMethod = try container.decodeIfPresent(VotingMethod.self, forKey: .votingMethod)

        if let createdRaw = try container.decodeIfPresent(String.self, forKey: .createdAt),
           let parsedCreated = SupabaseTimestampCodec.decode(createdRaw) {
            createdAt = parsedCreated
        } else if let created = try container.decodeIfPresent(Date.self, forKey: .createdAt) {
            createdAt = created
        } else {
            throw DecodingError.dataCorruptedError(
                forKey: .createdAt,
                in: container,
                debugDescription: "Unable to decode created_at timestamp."
            )
        }

        if let plannedRaw = try container.decodeIfPresent(String.self, forKey: .plannedTime) {
            plannedTime = SupabaseTimestampCodec.decode(plannedRaw)
        } else if let planned = try container.decodeIfPresent(Date.self, forKey: .plannedTime) {
            plannedTime = planned
        } else {
            plannedTime = nil
        }
    }
}

struct ScheduledNotificationInsert: Encodable, Sendable {
    let userID: UUID
    let electionID: String
    let notificationType: String
    let title: String
    let body: String
    let sendAt: Date
    let status: String
    let pluginID: String?
    let planSnapshotID: String?
    let metadata: [String: String]?

    init(
        userID: UUID,
        electionID: String,
        notificationType: String,
        title: String,
        body: String,
        sendAt: Date,
        status: String,
        pluginID: String? = nil,
        planSnapshotID: String? = nil,
        metadata: [String: String]? = nil
    ) {
        self.userID = userID
        self.electionID = electionID
        self.notificationType = notificationType
        self.title = title
        self.body = body
        self.sendAt = sendAt
        self.status = status
        self.pluginID = pluginID
        self.planSnapshotID = planSnapshotID
        self.metadata = metadata
    }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case electionID = "election_id"
        case notificationType = "notification_type"
        case title
        case body
        case sendAt = "send_at"
        case status
        case pluginID = "plugin_id"
        case planSnapshotID = "plan_snapshot_id"
        case metadata
    }
}

private struct ScheduledNotificationUpdate: Encodable, Sendable {
    let title: String
    let body: String
    let sendAt: Date
    let status: String
    let pluginID: String?
    let planSnapshotID: String?
    let metadata: [String: String]?

    enum CodingKeys: String, CodingKey {
        case title
        case body
        case sendAt = "send_at"
        case status
        case pluginID = "plugin_id"
        case planSnapshotID = "plan_snapshot_id"
        case metadata
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(title, forKey: .title)
        try container.encode(body, forKey: .body)
        try container.encode(SupabaseTimestampCodec.encode(sendAt), forKey: .sendAt)
        try container.encode(status, forKey: .status)
        try container.encodeIfPresent(pluginID, forKey: .pluginID)
        try container.encodeIfPresent(planSnapshotID, forKey: .planSnapshotID)
        try container.encodeIfPresent(metadata, forKey: .metadata)
    }
}

struct ElectionReminderSchedule: Sendable {
    let electionID: String
    let electionDay: Date
    let earlyVotingStart: Date?
    let stateCode: String
    let latitude: Double?
    let longitude: Double?
}

private struct DeviceTokenUpsertPayload: Encodable, Sendable {
    let userID: UUID
    let token: String
    let apnsEnv: String
    let isEnabled: Bool

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case token
        case apnsEnv = "apns_env"
        case isEnabled = "is_enabled"
    }
}

enum SupabaseManagerError: LocalizedError {
    case invalidLimit
    case noSession
    case dateCalculationFailed

    var errorDescription: String? {
        switch self {
        case .invalidLimit:
            return "Limit must be greater than zero."
        case .noSession:
            return "No Supabase session is available."
        case .dateCalculationFailed:
            return "Unable to compute notification send date."
        }
    }
}

@MainActor
final class SupabaseManager {
    static let shared = SupabaseManager()

    private let client: AppSupabaseClient
    private let logger = Logger(subsystem: "VoteNow", category: "SupabaseManager")

    private var cachedSession: SupabaseSession?
    private var signInTask: Task<SupabaseSession, Error>?
    private var reminderSchedulingKeysInFlight: Set<String> = []
    private var insertedPlanFingerprintsThisLaunch: Set<String> = []
    private var insertedNotificationFingerprintsThisLaunch: Set<String> = []
    private var hasLoggedMissingUserElectionStatusTable = false
    private var hasLoggedMissingMAPCCallEventsTable = false
    private var hasLoggedAddressSearchEventsRLSDenied = false
    private var hasLoggedMAPCCallEventsRLSDenied = false
    private var hasLoggedDeviceTokensRLSDenied = false
    private var hasLoggedAddressSearchEventsTransientFailure = false
    private var hasLoggedMAPCCallEventsTransientFailure = false
    private var hasLoggedMAPCCallSumsTransientFailure = false
    private var hasLoggedMAPCCallIssueSumsTransientFailure = false
    #if DEBUG
    private var hasInsertedDebugPlanThisLaunch = false
    #endif
    private let addressSearchSessionID = UUID()

    private init(client: AppSupabaseClient = SupabaseClientProvider.shared.client) {
        self.client = client
    }

    func signInAnonymouslyIfNeeded() async throws {
        if let signInTask {
            cachedSession = try await signInTask.value
            return
        }

        if let session = try? await resolvedSession() {
            cachedSession = session
            return
        }

        let task = Task<SupabaseSession, Error> {
            logger.debug("No valid session found; attempting anonymous sign-in.")
            try await client.auth.signInAnonymously()
            return try await resolvedSession()
        }
        signInTask = task
        defer { signInTask = nil }

        let session = try await task.value
        cachedSession = session
    }

    private func authenticatedSession() async throws -> SupabaseSession {
        try await signInAnonymouslyIfNeeded()
        return try await resolvedSession()
    }

    private func resolvedSession() async throws -> SupabaseSession {
        do {
            var session = try await client.auth.session
            if session.isExpired {
                session = try await client.auth.refreshSession()
            }
            cachedSession = session
            return session
        } catch {
            let refreshed = try await client.auth.refreshSession()
            cachedSession = refreshed
            return refreshed
        }
    }

    func insertMapvPlan(
        electionID: String,
        plannedTime: Date?,
        pollingPlace: String?,
        votingMethod: MapvPlan.VotingMethod? = nil
    ) async throws {
        try await signInAnonymouslyIfNeeded()
        guard cachedSession != nil else {
            throw SupabaseManagerError.noSession
        }

        let normalizedPollingPlace = pollingPlace?.trimmingCharacters(in: .whitespacesAndNewlines)
        let fingerprint = planFingerprint(
            electionID: electionID,
            plannedTime: plannedTime,
            pollingPlace: normalizedPollingPlace
        )
        guard insertedPlanFingerprintsThisLaunch.contains(fingerprint) == false else {
            logger.debug("Skipping duplicate MAPV insert in same app launch.")
            return
        }

        let resolvedVotingMethod = votingMethod ?? .electionDay
        let payload = MapvPlanInsert(
            electionID: electionID,
            plannedTime: plannedTime,
            pollingPlace: normalizedPollingPlace,
            votingMethod: resolvedVotingMethod
        )

        do {
            _ = try await performWriteWithRetry(operation: "mapv_plans insert") {
                try await client
                    .from("mapv_plans")
                    .insert(payload)
                    .execute()
            }
            insertedPlanFingerprintsThisLaunch.insert(fingerprint)
        } catch {
            guard isMissingPollingPlaceColumnError(error) else {
                throw error
            }

            logger.warning("mapv_plans insert failed on polling_place; retrying insert without polling_place.")
            let fallback = MapvPlanInsertCore(
                electionID: electionID,
                plannedTime: plannedTime,
                votingMethod: resolvedVotingMethod
            )
            _ = try await performWriteWithRetry(operation: "mapv_plans fallback insert") {
                try await client
                    .from("mapv_plans")
                    .insert(fallback)
                    .execute()
            }
            insertedPlanFingerprintsThisLaunch.insert(fingerprint)
        }
    }

    func currentUserIDIfAvailable() async -> UUID? {
        do {
            let session = try await client.auth.session
            return session.user.id
        } catch {
            return nil
        }
    }

    func submitFeedback(_ payload: FeedbackInsert) async throws {
        let session = try await authenticatedSession()
        let sanitizedPayload = FeedbackInsert(
            userID: session.user.id,
            email: payload.email,
            message: payload.message,
            category: payload.category,
            rating: payload.rating,
            appVersion: payload.appVersion,
            buildNumber: payload.buildNumber,
            platform: payload.platform,
            deviceModel: payload.deviceModel,
            osVersion: payload.osVersion,
            locale: payload.locale
        )
        _ = try await performWriteWithRetry(operation: "feedback insert") {
            try await client
                .from("feedback")
                .insert(sanitizedPayload)
                .execute()
        }
    }

    func saveDeviceToken(_ token: String) async {
        let deviceToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !deviceToken.isEmpty else {
            logger.warning("APNs token was empty; skipping save.")
            return
        }

        do {
            let session = try await authenticatedSession()
            let userId = session.user.id

            let expectedEnv = expectedAPNSEnvironment()
            let payload = DeviceTokenUpsertPayload(
                userID: userId,
                token: deviceToken,
                apnsEnv: expectedEnv,
                isEnabled: true
            )
            _ = try await performWriteWithRetry(operation: "device_tokens upsert") {
                try await client
                    .from("device_tokens")
                    .upsert([payload], onConflict: "token")
                    .execute()
            }

            logger.info("Device token upserted/rebound for current user.")
        } catch {
            if isRLSPermissionDeniedError(error) {
                logRLSPermissionDeniedOnce(table: "device_tokens", flag: &hasLoggedDeviceTokensRLSDenied)
            } else if isTransientNetworkError(error) {
                logger.warning("Device token save deferred due to transient network conditions.")
            } else {
                logger.error("Failed to save device token.")
            }
        }
    }

    func scheduleElectionRemindersForResolvedAddress(_ schedule: ElectionReminderSchedule) async throws {
        let session = try await authenticatedSession()
        let userID = session.user.id
        let scheduleKey = "\(userID.uuidString)|\(schedule.electionID.lowercased())"
        guard reminderSchedulingKeysInFlight.insert(scheduleKey).inserted else {
            logger.debug("Skipping duplicate in-flight reminder scheduling for election \(schedule.electionID, privacy: .public)")
            return
        }
        defer { reminderSchedulingKeysInFlight.remove(scheduleKey) }
        var createdAnyReminder = false
        let reminderTimeZone = await reminderTimeZone(
            for: schedule.stateCode,
            coordinate: schedule.coordinate
        )

        logger.debug("Cancelling old pending election reminders for current user.")
        try await cancelPendingElectionReminders(userID: userID)

        if let earlyVotingStart = schedule.earlyVotingStart {
            if try await shouldSuppressNotificationForElection(
                userID: userID,
                electionID: schedule.electionID,
                notificationType: "early_voting_open"
            ) {
                logger.debug("Suppression active: skipping early_voting_open for election \(schedule.electionID, privacy: .public)")
            } else {
                let earlyVotingSendAt = try reminderSendAt10_30AM(
                    on: earlyVotingStart,
                    timeZone: reminderTimeZone
                )
                let earlyVotingPayload = ScheduledNotificationInsert(
                    userID: userID,
                    electionID: schedule.electionID,
                    notificationType: "early_voting_open",
                    title: "You are eligible to vote",
                    body: "Early voting is now open for your next election.",
                    sendAt: earlyVotingSendAt,
                    status: "pending"
                )

                let inserted = try await insertScheduledNotificationIdempotent(earlyVotingPayload)
                createdAnyReminder = true
                if inserted {
                    logger.info("Early voting reminder created for election \(schedule.electionID, privacy: .public)")
                } else {
                    logger.debug("Early voting reminder already existed; refreshed pending row for election \(schedule.electionID, privacy: .public)")
                }
            }
        } else {
            logger.debug("No early voting date found; skipping early voting reminder.")
        }

        if try await shouldSuppressNotificationForElection(
            userID: userID,
            electionID: schedule.electionID,
            notificationType: "election_day_reminder"
        ) {
            logger.debug("Suppression active: skipping election_day_reminder for election \(schedule.electionID, privacy: .public)")
            if createdAnyReminder {
                logger.info("Election reminders scheduled for election \(schedule.electionID, privacy: .public)")
            }
            return
        }

        let electionDaySendAt = try reminderSendAt10_30AM(
            on: schedule.electionDay,
            timeZone: reminderTimeZone
        )
        let electionDayPayload = ScheduledNotificationInsert(
            userID: userID,
            electionID: schedule.electionID,
            notificationType: "election_day_reminder",
            title: "It's Election Day",
            body: "Today is Election Day. Head to your polling place and vote.",
            sendAt: electionDaySendAt,
            status: "pending"
        )

        let electionReminderInserted = try await insertScheduledNotificationIdempotent(electionDayPayload)
        createdAnyReminder = true
        if electionReminderInserted {
            logger.info("Election day reminder created for election \(schedule.electionID, privacy: .public)")
        } else {
            logger.debug("Election day reminder already existed; refreshed pending row for election \(schedule.electionID, privacy: .public)")
        }
        if createdAnyReminder {
            logger.info("Election reminders scheduled for election \(schedule.electionID, privacy: .public)")
        }
    }

    func processMAPVNotificationPlugins(
        trigger: MAPVNotificationTrigger,
        context: MAPVNotificationPluginContext
    ) async {
        do {
            let session = try await authenticatedSession()
            let userID = session.user.id

            let drafts = MAPVNotificationPluginEngine.generateDrafts(
                trigger: trigger,
                context: context
            )

            guard !drafts.isEmpty else { return }

            for draft in drafts {
                let fingerprint = "\(userID.uuidString)|\(context.electionID)|\(context.planSnapshotID)|\(draft.notificationType)|\(Int(draft.sendAt.timeIntervalSince1970))"
                guard insertedNotificationFingerprintsThisLaunch.contains(fingerprint) == false else {
                    continue
                }

                guard try await shouldSuppressNotificationForElection(
                    userID: userID,
                    electionID: context.electionID,
                    notificationType: draft.notificationType
                ) == false else {
                    logger.debug("Notification suppressed by plugin policy.")
                    continue
                }

                if try await hasRecentScheduledNotification(
                    userID: userID,
                    electionID: context.electionID,
                    notificationType: draft.notificationType,
                    sinceHours: 24
                ) {
                    continue
                }

                let payload = ScheduledNotificationInsert(
                    userID: userID,
                    electionID: context.electionID,
                    notificationType: draft.notificationType,
                    title: draft.title,
                    body: draft.body,
                    sendAt: draft.sendAt,
                    status: "pending",
                    pluginID: draft.pluginID.rawValue,
                    planSnapshotID: context.planSnapshotID,
                    metadata: [
                        "bypass_quiet_hours": draft.bypassQuietHours ? "true" : "false"
                    ]
                )

                _ = try await insertScheduledNotificationIdempotent(payload)
                insertedNotificationFingerprintsThisLaunch.insert(fingerprint)
            }
        } catch {
            logger.error("MAPV plugin notification scheduling failed.")
        }
    }

    func fetchUserElectionStatus(electionID: String) async -> UserElectionStatusRecord? {
        do {
            let session = try await authenticatedSession()
            let userID = session.user.id

            let records: [UserElectionStatusRecord] = try await client
                .from("user_election_status")
                .select()
                .eq("user_id", value: userID.uuidString)
                .eq("election_id", value: electionID)
                .limit(1)
                .execute()
                .value

            return records.first
        } catch {
            if isMissingUserElectionStatusTableError(error) {
                logMissingUserElectionStatusTableOnce(context: "fetch")
            }
            return nil
        }
    }

    func updateUserElectionStatus(
        electionID: String,
        completionState: UserElectionCompletionState,
        completionSource: UserElectionCompletionSource,
        completionConfidence: Double?
    ) async throws {
        do {
            let session = try await authenticatedSession()
            let userID = session.user.id

            let notificationsSuppressed = completionState.isTerminal || completionState.isProvisionalFlow
            let suppressionReason: String? = {
                if completionState.isTerminal {
                    return "completed_\(completionState.rawValue)"
                }
                if completionState == .provisionalPending {
                    return "provisional_pending"
                }
                if completionState == .cureNeeded {
                    return "cure_needed"
                }
                return nil
            }()

            let nowISO = SupabaseTimestampCodec.encode(Date())
            let completedAtISO = completionState.isTerminal ? nowISO : nil
            let insertPayload = UserElectionStatusInsertPayload(
                userID: userID,
                electionID: electionID,
                completionState: completionState.rawValue,
                completedAt: completedAtISO,
                completionSource: completionSource.rawValue,
                completionConfidence: completionConfidence,
                notificationsSuppressed: notificationsSuppressed,
                suppressionReason: suppressionReason,
                suppressionUpdatedAt: nowISO
            )
            let updatePayload = UserElectionStatusUpdatePayload(
                completionState: completionState.rawValue,
                completedAt: completedAtISO,
                completionSource: completionSource.rawValue,
                completionConfidence: completionConfidence,
                notificationsSuppressed: notificationsSuppressed,
                suppressionReason: suppressionReason,
                suppressionUpdatedAt: nowISO
            )

            let existing: [UserElectionStatusRecord] = try await client
                .from("user_election_status")
                .select()
                .eq("user_id", value: userID.uuidString)
                .eq("election_id", value: electionID)
                .limit(1)
                .execute()
                .value

            if existing.isEmpty {
                do {
                    _ = try await performWriteWithRetry(operation: "user_election_status insert") {
                        try await client
                            .from("user_election_status")
                            .insert([insertPayload])
                            .execute()
                    }
                } catch {
                    guard isUniqueConstraintViolation(error) else { throw error }
                    _ = try await performWriteWithRetry(operation: "user_election_status update after conflict") {
                        try await client
                            .from("user_election_status")
                            .update(updatePayload)
                            .eq("user_id", value: userID.uuidString)
                            .eq("election_id", value: electionID)
                            .execute()
                    }
                }
            } else {
                _ = try await performWriteWithRetry(operation: "user_election_status update") {
                    try await client
                        .from("user_election_status")
                        .update(updatePayload)
                        .eq("user_id", value: userID.uuidString)
                        .eq("election_id", value: electionID)
                        .execute()
                }
            }
        } catch {
            if isMissingUserElectionStatusTableError(error) {
                logMissingUserElectionStatusTableOnce(context: "update")
                return
            }
            throw error
        }
    }

    func undoUserElectionCompletion(electionID: String) async throws {
        do {
            let session = try await authenticatedSession()
            let userID = session.user.id

            let nowISO = SupabaseTimestampCodec.encode(Date())
            let updatePayload = UserElectionStatusUpdatePayload(
                completionState: UserElectionCompletionState.inProgress.rawValue,
                completedAt: nil,
                completionSource: UserElectionCompletionSource.undo.rawValue,
                completionConfidence: nil,
                notificationsSuppressed: false,
                suppressionReason: nil,
                suppressionUpdatedAt: nowISO
            )

            let existing: [UserElectionStatusRecord] = try await client
                .from("user_election_status")
                .select()
                .eq("user_id", value: userID.uuidString)
                .eq("election_id", value: electionID)
                .limit(1)
                .execute()
                .value

            if existing.isEmpty {
                let insertPayload = UserElectionStatusInsertPayload(
                    userID: userID,
                    electionID: electionID,
                    completionState: UserElectionCompletionState.inProgress.rawValue,
                    completedAt: nil,
                    completionSource: UserElectionCompletionSource.undo.rawValue,
                    completionConfidence: nil,
                    notificationsSuppressed: false,
                    suppressionReason: nil,
                    suppressionUpdatedAt: nowISO
                )
                do {
                    _ = try await performWriteWithRetry(operation: "user_election_status undo insert") {
                        try await client
                            .from("user_election_status")
                            .insert([insertPayload])
                            .execute()
                    }
                } catch {
                    guard isUniqueConstraintViolation(error) else { throw error }
                    _ = try await performWriteWithRetry(operation: "user_election_status undo update after conflict") {
                        try await client
                            .from("user_election_status")
                            .update(updatePayload)
                            .eq("user_id", value: userID.uuidString)
                            .eq("election_id", value: electionID)
                            .execute()
                    }
                }
            } else {
                _ = try await performWriteWithRetry(operation: "user_election_status undo update") {
                    try await client
                        .from("user_election_status")
                        .update(updatePayload)
                        .eq("user_id", value: userID.uuidString)
                        .eq("election_id", value: electionID)
                        .execute()
                }
            }
        } catch {
            if isMissingUserElectionStatusTableError(error) {
                logMissingUserElectionStatusTableOnce(context: "undo")
                return
            }
            throw error
        }
    }

    private func cancelPendingElectionReminders(userID: UUID) async throws {
        try await cancelPendingElectionReminder(
            userID: userID,
            notificationType: "early_voting_open"
        )
        try await cancelPendingElectionReminder(
            userID: userID,
            notificationType: "election_day_reminder"
        )
    }

    private func cancelPendingElectionReminder(
        userID: UUID,
        notificationType: String
    ) async throws {
        _ = try await performWriteWithRetry(operation: "scheduled_notifications cancel pending") {
            try await client
                .from("scheduled_notifications")
                .update(["status": "canceled"])
                .eq("user_id", value: userID.uuidString)
                .eq("notification_type", value: notificationType)
                .eq("status", value: "pending")
                .execute()
        }
    }

    private func insertScheduledNotificationIdempotent(_ payload: ScheduledNotificationInsert) async throws -> Bool {
        do {
            _ = try await performWriteWithRetry(operation: "scheduled_notifications insert") {
                try await client
                    .from("scheduled_notifications")
                    .insert([payload])
                    .execute()
            }
            return true
        } catch {
            guard isUniqueConstraintViolation(error) else {
                throw error
            }

            let updatePayload = ScheduledNotificationUpdate(
                title: payload.title,
                body: payload.body,
                sendAt: payload.sendAt,
                status: payload.status,
                pluginID: payload.pluginID,
                planSnapshotID: payload.planSnapshotID,
                metadata: payload.metadata
            )

            _ = try await performWriteWithRetry(operation: "scheduled_notifications update existing pending") {
                try await client
                    .from("scheduled_notifications")
                    .update(updatePayload)
                    .eq("user_id", value: payload.userID.uuidString)
                    .eq("election_id", value: payload.electionID)
                    .eq("notification_type", value: payload.notificationType)
                    .eq("status", value: "pending")
                    .execute()
            }
            return false
        }
    }

    private func hasRecentScheduledNotification(
        userID: UUID,
        electionID: String,
        notificationType: String,
        sinceHours: Int
    ) async throws -> Bool {
        struct ExistingScheduledNotification: Decodable {
            let sendAt: Date?

            enum CodingKeys: String, CodingKey {
                case sendAt = "send_at"
            }

            init(from decoder: Decoder) throws {
                let container = try decoder.container(keyedBy: CodingKeys.self)
                if let raw = try container.decodeIfPresent(String.self, forKey: .sendAt) {
                    sendAt = SupabaseTimestampCodec.decode(raw)
                } else {
                    sendAt = try container.decodeIfPresent(Date.self, forKey: .sendAt)
                }
            }
        }

        let threshold = Date().addingTimeInterval(TimeInterval(-sinceHours * 3600))
        let rows: [ExistingScheduledNotification] = try await client
            .from("scheduled_notifications")
            .select("send_at")
            .eq("user_id", value: userID.uuidString)
            .eq("election_id", value: electionID)
            .eq("notification_type", value: notificationType)
            .neq("status", value: "canceled")
            .order("send_at", ascending: false)
            .limit(1)
            .execute()
            .value

        guard let sendAt = rows.first?.sendAt else {
            return false
        }
        return sendAt >= threshold
    }

    private func shouldSuppressNotificationForElection(
        userID: UUID,
        electionID: String,
        notificationType: String
    ) async throws -> Bool {
        do {
            let rows: [UserElectionStatusRecord] = try await client
                .from("user_election_status")
                .select()
                .eq("user_id", value: userID.uuidString)
                .eq("election_id", value: electionID)
                .limit(1)
                .execute()
                .value

            let status = MAPVNotificationPluginEngine.status(
                for: electionID,
                in: rows
            )
            return MAPVNotificationPluginEngine.shouldSuppressNotification(
                status: status,
                notificationType: notificationType
            )
        } catch {
            if isMissingUserElectionStatusTableError(error) {
                logMissingUserElectionStatusTableOnce(context: "suppression_check")
                return false
            }
            throw error
        }
    }

    private func isMissingUserElectionStatusTableError(_ error: Error) -> Bool {
        let message = String(describing: error)
        let lowered = message.lowercased()
        let explicitMissing =
            lowered.contains("could not find the table 'public.user_election_status'")
            || lowered.contains("relation \"user_election_status\" does not exist")
        let pgrst205ForThisTable = lowered.contains("pgrst205") && lowered.contains("user_election_status")
        return explicitMissing || pgrst205ForThisTable
    }

    private func logMissingUserElectionStatusTableOnce(context: String) {
        guard !hasLoggedMissingUserElectionStatusTable else { return }
        hasLoggedMissingUserElectionStatusTable = true
        logger.warning("user_election_status table is missing (\(context, privacy: .public)). Apply migration 20260308_mapv_notification_suppression.sql in Supabase.")
    }

    private func reminderSendAt10_30AM(on date: Date, timeZone: TimeZone) throws -> Date {
        logger.debug("Reminder timezone resolved to \(timeZone.identifier, privacy: .public)")

        var utcCalendar = Calendar(identifier: .gregorian)
        let utc = TimeZone(secondsFromGMT: 0) ?? .current
        utcCalendar.timeZone = utc
        var localCalendar = Calendar(identifier: .gregorian)
        localCalendar.timeZone = timeZone

        let dateParts = utcCalendar.dateComponents([.year, .month, .day], from: date)
        var localDateParts = DateComponents()
        localDateParts.year = dateParts.year
        localDateParts.month = dateParts.month
        localDateParts.day = dateParts.day
        localDateParts.hour = 10
        localDateParts.minute = 30
        localDateParts.second = 0
        localDateParts.timeZone = timeZone

        guard let sendAt = localCalendar.date(from: localDateParts) else {
            throw SupabaseManagerError.dateCalculationFailed
        }

        let localFormatter = DateFormatter()
        localFormatter.calendar = localCalendar
        localFormatter.locale = Locale(identifier: "en_US_POSIX")
        localFormatter.timeZone = timeZone
        localFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss zzz"
        logger.debug("Computed local 10:30 AM send_at: \(localFormatter.string(from: sendAt), privacy: .public)")

        return sendAt
    }

    private func reminderTimeZone(
        for stateCode: String,
        coordinate: CLLocationCoordinate2D?
    ) async -> TimeZone {
        if let coordinate, let resolved = await timeZoneFromCoordinate(coordinate) {
            return resolved
        }
        return electionTimeZone(for: stateCode)
    }

    private func timeZoneFromCoordinate(_ coordinate: CLLocationCoordinate2D) async -> TimeZone? {
        guard CLLocationCoordinate2DIsValid(coordinate) else { return nil }
        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        do {
            let placemarks = try await CLGeocoder().reverseGeocodeLocation(location)
            return placemarks.first?.timeZone
        } catch {
            return nil
        }
    }

    private func electionTimeZone(for stateCode: String) -> TimeZone {
        let mapping: [String: String] = [
            // Eastern
            "CT": "America/New_York",
            "DC": "America/New_York",
            "DE": "America/New_York",
            "FL": "America/New_York",
            "GA": "America/New_York",
            "IN": "America/New_York",
            "KY": "America/New_York",
            "MA": "America/New_York",
            "MD": "America/New_York",
            "ME": "America/New_York",
            "MI": "America/New_York",
            "NC": "America/New_York",
            "NH": "America/New_York",
            "NJ": "America/New_York",
            "NY": "America/New_York",
            "OH": "America/New_York",
            "PA": "America/New_York",
            "RI": "America/New_York",
            "SC": "America/New_York",
            "VA": "America/New_York",
            "VT": "America/New_York",
            "WV": "America/New_York",

            // Central
            "AL": "America/Chicago",
            "AR": "America/Chicago",
            "IA": "America/Chicago",
            "IL": "America/Chicago",
            "KS": "America/Chicago",
            "LA": "America/Chicago",
            "MN": "America/Chicago",
            "MO": "America/Chicago",
            "MS": "America/Chicago",
            "NE": "America/Chicago",
            "ND": "America/Chicago",
            "OK": "America/Chicago",
            "SD": "America/Chicago",
            "TN": "America/Chicago",
            "TX": "America/Chicago",
            "WI": "America/Chicago",

            // Mountain
            "CO": "America/Denver",
            "ID": "America/Denver",
            "MT": "America/Denver",
            "NM": "America/Denver",
            "UT": "America/Denver",
            "WY": "America/Denver",

            // Arizona exception
            "AZ": "America/Phoenix",

            // Pacific
            "CA": "America/Los_Angeles",
            "NV": "America/Los_Angeles",
            "OR": "America/Los_Angeles",
            "WA": "America/Los_Angeles",

            // Alaska / Hawaii
            "AK": "America/Anchorage",
            "HI": "Pacific/Honolulu"
        ]
        let identifier = mapping[stateCode.uppercased()] ?? "America/New_York"
        return TimeZone(identifier: identifier) ?? (TimeZone(secondsFromGMT: 0) ?? .current)
    }

    func fetchLatestMapvPlans(limit: Int = 10) async throws -> [MapvPlan] {
        guard limit > 0 else { throw SupabaseManagerError.invalidLimit }

        let session = try await authenticatedSession()

        return try await client
            .from("mapv_plans")
            .select()
            .eq("user_id", value: session.user.id.uuidString)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func sendTestPush(
        title: String = "VoteNow",
        body: String = "Your voting plan is set."
    ) async throws -> String {
        try await signInAnonymouslyIfNeeded()

        var session: SupabaseSession
        do {
            session = try await client.auth.session
        } catch {
            session = try await client.auth.refreshSession()
        }

        if session.isExpired {
            session = try await client.auth.refreshSession()
        }

        if try await hasEnabledDeviceToken(for: session.user.id) == false {
            logger.debug("Skipping send_test_push invoke: no enabled device token for current user.")
            return #"{"ok":false,"skipped":"no_enabled_device_tokens"}"#
        }

        let functions = client.functions
        functions.setAuth(token: session.accessToken)

        let payload: [String: String] = [
            "title": title,
            "body": body
        ]

        let options = FunctionInvokeOptions(
            headers: [
                "Authorization": "Bearer \(session.accessToken)",
                "apikey": SupabaseConfig.current.anonKey
            ],
            body: payload
        )

        let data: Data = try await functions.invoke(
            "send_test_push",
            options: options,
            decode: { body, _ in body }
        )

        return String(data: data, encoding: .utf8) ?? "<no data>"
    }

    #if DEBUG
    // MARK: - Debug API

    func insertDebugMAPVPlan() async throws {
        guard hasInsertedDebugPlanThisLaunch == false else {
            logger.debug("Debug MAPV insert skipped: already inserted once this app launch.")
            return
        }

        do {
            try await insertMapvPlan(
                electionID: "debug-election",
                plannedTime: Date().addingTimeInterval(3600),
                pollingPlace: "DEBUG POLLING PLACE"
            )
            hasInsertedDebugPlanThisLaunch = true
            logger.debug("Inserted debug MAPV plan.")
        } catch {
            hasInsertedDebugPlanThisLaunch = false
            logger.error("insertDebugMAPVPlan failed.")
            throw error
        }
    }

    func deleteDebugPlans(forUserId userId: UUID) async throws {
        try await client.from("mapv_plans").delete().eq("user_id", value: userId.uuidString).eq("election_id", value: "debug-election").execute()
    }

    func fetchMAPVPlans() async throws -> [MapvPlan] {
        do {
            let plans = try await fetchLatestMapvPlans(limit: 20)
            logger.debug("Fetched MAPV plans count: \(plans.count, privacy: .public)")
            return plans
        } catch {
            logger.error("fetchMAPVPlans failed.")
            throw error
        }
    }
    #endif

    func logAddressSearchEvent(_ event: AddressSearchEvent) async {
        do {
            try await signInAnonymouslyIfNeeded()
            guard let session = cachedSession else {
                throw SupabaseManagerError.noSession
            }

            let payload = sanitizedAddressSearchEvent(
                event,
                fallbackUserID: session.user.id,
                fallbackSessionID: addressSearchSessionID
            )

            _ = try await performWriteWithRetry(operation: "address_search_events insert") {
                try await client
                    .from("address_search_events")
                    .insert(payload)
                    .execute()
            }
        } catch {
            if isRequestCancelledError(error) {
                return
            }
            if isTransientNetworkError(error) {
                logTransientNetworkFailureOnce(
                    operation: "address_search_events insert",
                    flag: &hasLoggedAddressSearchEventsTransientFailure
                )
                return
            }
            if isRLSPermissionDeniedError(error) {
                logRLSPermissionDeniedOnce(
                    table: "address_search_events",
                    flag: &hasLoggedAddressSearchEventsRLSDenied
                )
                return
            }
            logger.error("address_search_events insert failed.")
        }
    }

    func disableCurrentUserDeviceTokens() async {
        do {
            let session: SupabaseSession
            do {
                session = try await client.auth.session
            } catch {
                session = try await client.auth.refreshSession()
            }
            _ = try await performWriteWithRetry(operation: "device_tokens disable for user") {
                try await client
                    .from("device_tokens")
                    .update(["is_enabled": false])
                    .eq("user_id", value: session.user.id.uuidString)
                    .eq("apns_env", value: expectedAPNSEnvironment())
                    .execute()
            }
        } catch {
            if isRLSPermissionDeniedError(error) {
                logRLSPermissionDeniedOnce(table: "device_tokens", flag: &hasLoggedDeviceTokensRLSDenied)
            } else if isTransientNetworkError(error) {
                logger.warning("Device token disable deferred due to transient network conditions.")
            }
        }
    }

    func clearCachedSessionState() {
        signInTask?.cancel()
        signInTask = nil
        cachedSession = nil
    }

    func logMAPCCallEvent(_ event: MAPCCallEventInsert) async {
        do {
            try await signInAnonymouslyIfNeeded()
            guard let session = cachedSession else {
                throw SupabaseManagerError.noSession
            }

            let payload = MAPCCallEventInsert(
                sessionID: event.sessionID,
                userID: session.user.id,
                issueID: event.issueID,
                issueTitle: event.issueTitle,
                briefID: event.briefID,
                repID: event.repID,
                repName: event.repName,
                repSlot: event.repSlot,
                eventType: event.eventType,
                completed: event.completed,
                outcome: event.outcome,
                sourceScreen: event.sourceScreen,
                metadata: event.metadata
            )

            _ = try await performWriteWithRetry(operation: "mapc_call_events insert") {
                try await client
                    .from("mapc_call_events")
                    .insert(payload)
                    .execute()
            }
        } catch {
            if isMissingMAPCCallEventsTableError(error) {
                logMissingMAPCCallEventsTableOnce(context: "insert")
                return
            }
            if isRequestCancelledError(error) {
                return
            }
            if isTransientNetworkError(error) {
                logTransientNetworkFailureOnce(
                    operation: "mapc_call_events insert",
                    flag: &hasLoggedMAPCCallEventsTransientFailure
                )
                return
            }
            if isRLSPermissionDeniedError(error) {
                logRLSPermissionDeniedOnce(
                    table: "mapc_call_events",
                    flag: &hasLoggedMAPCCallEventsRLSDenied
                )
                return
            }
            logger.error("mapc_call_events insert failed.")
        }
    }

    func fetchMAPCCallSums() async -> MAPCCallSums? {
        do {
            try await signInAnonymouslyIfNeeded()
            guard let session = cachedSession else {
                throw SupabaseManagerError.noSession
            }

            if let rpcSums = try? await fetchMAPCCallSumsViaRPC() {
                return rpcSums
            }

            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
            let monthStart = calendar.date(
                from: calendar.dateComponents([.year, .month], from: Date())
            ) ?? Date()

            async let totalTask = countMAPCCallEvents(
                userID: nil,
                monthStart: nil
            )
            async let monthlyTask = countMAPCCallEvents(
                userID: nil,
                monthStart: monthStart
            )
            async let userTask = countMAPCCallEvents(
                userID: session.user.id,
                monthStart: nil
            )

            let total = try await totalTask
            let monthly = try await monthlyTask
            let user = try await userTask

            return MAPCCallSums(
                totalCompletedCalls: total,
                monthlyCompletedCalls: monthly,
                userCompletedCalls: user
            )
        } catch {
            if isMissingMAPCCallEventsTableError(error) {
                logMissingMAPCCallEventsTableOnce(context: "fetch_sums")
                return nil
            }
            if isRequestCancelledError(error) {
                return nil
            }
            if isTransientNetworkError(error) {
                logTransientNetworkFailureOnce(
                    operation: "fetchMAPCCallSums",
                    flag: &hasLoggedMAPCCallSumsTransientFailure
                )
                return nil
            }
            logger.error("fetchMAPCCallSums failed.")
            return nil
        }
    }

    func fetchMAPCCallIssueSums(issueIDs: [String]) async -> MAPCCallIssueSums? {
        let normalizedIssueIDs = normalizedIssueIDList(issueIDs)
        if normalizedIssueIDs.isEmpty {
            return .empty
        }

        do {
            try await signInAnonymouslyIfNeeded()
            guard cachedSession != nil else {
                throw SupabaseManagerError.noSession
            }

            if let rpcIssueSums = try? await fetchMAPCCallIssueSumsViaRPC(issueIDs: normalizedIssueIDs) {
                return rpcIssueSums
            }

            var countsByIssueID: [String: Int] = [:]
            for issueID in normalizedIssueIDs {
                let count = try await countMAPCCallEvents(
                    userID: nil,
                    monthStart: nil,
                    issueID: issueID
                )
                countsByIssueID[issueID] = max(0, count)
            }

            return MAPCCallIssueSums(appCompletedCallsByIssueID: countsByIssueID)
        } catch {
            if isMissingMAPCCallEventsTableError(error) {
                logMissingMAPCCallEventsTableOnce(context: "fetch_issue_sums")
                return nil
            }
            if isRequestCancelledError(error) {
                return nil
            }
            if isTransientNetworkError(error) {
                logTransientNetworkFailureOnce(
                    operation: "fetchMAPCCallIssueSums",
                    flag: &hasLoggedMAPCCallIssueSumsTransientFailure
                )
                return nil
            }
            logger.error("fetchMAPCCallIssueSums failed.")
            return nil
        }
    }

    private func fetchMAPCCallIssueSumsViaRPC(issueIDs: [String]) async throws -> MAPCCallIssueSums? {
        let response = try await client
            .rpc(
                "mapc_call_issue_sums",
                params: MAPCCallIssueSumsRPCParams(issue_ids: issueIDs)
            )
            .execute()

        let decoder = JSONDecoder()
        let rows: [MAPCCallIssueSumsRPCRow]
        if let decodedRows = try? decoder.decode([MAPCCallIssueSumsRPCRow].self, from: response.data) {
            rows = decodedRows
        } else if let singleRow = try? decoder.decode(MAPCCallIssueSumsRPCRow.self, from: response.data) {
            rows = [singleRow]
        } else {
            return nil
        }

        var countsByIssueID = Dictionary(
            uniqueKeysWithValues: issueIDs.map { ($0, 0) }
        )

        for row in rows {
            let normalizedIssueID = row.issueID.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalizedIssueID.isEmpty else { continue }
            countsByIssueID[normalizedIssueID] = max(0, row.totalCompletedCalls)
        }

        return MAPCCallIssueSums(appCompletedCallsByIssueID: countsByIssueID)
    }

    private func fetchMAPCCallSumsViaRPC() async throws -> MAPCCallSums? {
        let response = try await client
            .rpc("mapc_call_sums_for_current_user")
            .execute()

        let decoder = JSONDecoder()
        if let row = try? decoder.decode(MAPCCallSumsRPCRow.self, from: response.data) {
            return MAPCCallSums(
                totalCompletedCalls: row.totalCompletedCalls,
                monthlyCompletedCalls: row.monthlyCompletedCalls,
                userCompletedCalls: row.userCompletedCalls
            )
        }

        if let rows = try? decoder.decode([MAPCCallSumsRPCRow].self, from: response.data),
           let row = rows.first {
            return MAPCCallSums(
                totalCompletedCalls: row.totalCompletedCalls,
                monthlyCompletedCalls: row.monthlyCompletedCalls,
                userCompletedCalls: row.userCompletedCalls
            )
        }

        return nil
    }

    private func countMAPCCallEvents(
        userID: UUID?,
        monthStart: Date?,
        issueID: String? = nil
    ) async throws -> Int {
        var builder = client
            .from("mapc_call_events")
            .select("session_id", head: true, count: .exact)
            .eq("event_type", value: MAPCCallEventInsert.EventType.callCompletionConfirmed.rawValue)
            .eq("completed", value: true)

        if let userID {
            builder = builder.eq("user_id", value: userID)
        }
        if let monthStart {
            builder = builder.gte("created_at", value: monthStart)
        }
        if let issueID {
            builder = builder.eq("issue_id", value: issueID)
        }

        let response = try await builder.execute()
        return response.count ?? 0
    }

    private func normalizedIssueIDList(_ issueIDs: [String]) -> [String] {
        var seen = Set<String>()
        var ordered: [String] = []

        for issueID in issueIDs {
            let normalized = issueID.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalized.isEmpty else { continue }
            let key = normalized.lowercased()
            guard seen.insert(key).inserted else { continue }
            ordered.append(normalized)
        }

        return ordered
    }

    private func isMissingMAPCCallEventsTableError(_ error: Error) -> Bool {
        let message = String(describing: error)
        return message.contains("PGRST205")
            || message.contains("Could not find the table 'public.mapc_call_events'")
    }

    private func logMissingMAPCCallEventsTableOnce(context: String) {
        guard !hasLoggedMissingMAPCCallEventsTable else { return }
        hasLoggedMissingMAPCCallEventsTable = true
        logger.warning("mapc_call_events table is missing (\(context, privacy: .public)). Apply migration 20260327_add_mapc_call_analytics.sql in Supabase.")
    }

    private func isMissingPollingPlaceColumnError(_ error: Error) -> Bool {
        SupabaseErrorInspector.isMissingPollingPlaceColumn(error)
    }

    private func isUniqueConstraintViolation(_ error: Error) -> Bool {
        SupabaseErrorInspector.isUniqueConstraintViolation(error)
    }

    private func isRequestCancelledError(_ error: Error) -> Bool {
        SupabaseErrorInspector.isRequestCancelled(error)
    }

    private func isTransientNetworkError(_ error: Error) -> Bool {
        SupabaseErrorInspector.isTransientNetworkError(error)
    }

    private func isRLSPermissionDeniedError(_ error: Error) -> Bool {
        SupabaseErrorInspector.isRLSPermissionDenied(error)
    }

    private func writeRetryDelayNanoseconds(forAttempt attempt: Int) -> UInt64 {
        switch attempt {
        case 2: return 300_000_000
        case 3: return 700_000_000
        default: return 0
        }
    }

    private func performWriteWithRetry<T>(
        operation: String,
        maxAttempts: Int = 3,
        _ action: () async throws -> T
    ) async throws -> T {
        var attempt = 1
        while true {
            do {
                return try await action()
            } catch {
                if isRequestCancelledError(error) {
                    throw error
                }
                guard isTransientNetworkError(error), attempt < maxAttempts else {
                    throw error
                }
                attempt += 1
                logger.warning("Transient network error during \(operation, privacy: .public). Retrying.")
                let delay = writeRetryDelayNanoseconds(forAttempt: attempt)
                if delay > 0 {
                    try await Task.sleep(nanoseconds: delay)
                }
            }
        }
    }

    private func logTransientNetworkFailureOnce(operation: String, flag: inout Bool) {
        guard flag == false else { return }
        flag = true
        logger.warning("Transient network failure while \(operation, privacy: .public).")
    }

    private func logRLSPermissionDeniedOnce(table: String, flag: inout Bool) {
        guard flag == false else { return }
        flag = true
        logger.warning("RLS denied write to table '\(table, privacy: .public)'. Check Supabase policy configuration.")
    }

    private func sanitizedAddressSearchEvent(
        _ event: AddressSearchEvent,
        fallbackUserID: UUID,
        fallbackSessionID: UUID
    ) -> AddressSearchEvent {
        let normalizedCity = normalizedText(event.city, maxLength: 64)
        let normalizedState = normalizedStateCode(event.state)
        let normalizedPostalCode = normalizedZip(event.postalCode)
        let normalizedCountryCode = normalizedCountryCode(event.countryCode)
        let coarseResolvedDisplay = coarseResolvedDisplay(
            city: normalizedCity,
            state: normalizedState,
            postalCode: normalizedPostalCode,
            fallback: event.resolvedDisplay
        )

        return AddressSearchEvent(
            userID: fallbackUserID,
            context: normalizedText(event.context, maxLength: 64) ?? "unknown",
            rawInput: anonymizedRawInput(event.rawInput, inputType: event.inputType),
            inputType: event.inputType,
            success: event.success,
            errorCode: normalizedText(event.errorCode, maxLength: 64),
            resolvedDisplay: coarseResolvedDisplay,
            postalCode: normalizedPostalCode,
            city: normalizedCity,
            state: normalizedState,
            countryCode: normalizedCountryCode,
            lat: coarseCoordinate(event.lat),
            lng: coarseCoordinate(event.lng),
            placeSource: event.placeSource,
            sessionID: event.sessionID ?? fallbackSessionID
        )
    }

    private func anonymizedRawInput(_ rawInput: String, inputType: AddressSearchEvent.InputType?) -> String {
        let trimmed = rawInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "empty" }

        switch inputType {
        case .zip:
            let normalized = String(trimmed.filter(\.isNumber).prefix(5))
            return normalized.count == 5 ? "zip:\(normalized)" : "zip:invalid"
        case .fullAddress, .placeSearch, .none:
            return "hash:\(stableHashPrefix(trimmed.lowercased()))"
        }
    }

    private func coarseResolvedDisplay(
        city: String?,
        state: String?,
        postalCode: String?,
        fallback: String?
    ) -> String? {
        if let city, let state {
            return "\(city), \(state)"
        }
        if let state, let postalCode {
            return "\(state) \(postalCode)"
        }
        if let postalCode {
            return "ZIP \(postalCode)"
        }
        guard let fallback = normalizedText(fallback, maxLength: 120), !fallback.isEmpty else {
            return nil
        }
        return "hash:\(stableHashPrefix(fallback.lowercased()))"
    }

    private func normalizedZip(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        let digits = String(value.filter(\.isNumber).prefix(5))
        return digits.count == 5 ? digits : nil
    }

    private func normalizedStateCode(_ value: String?) -> String? {
        guard let value = normalizedText(value, maxLength: 32), !value.isEmpty else {
            return nil
        }
        let upper = value.uppercased()
        if upper.count == 2 { return upper }
        return upper
    }

    private func normalizedCountryCode(_ value: String?) -> String? {
        guard let value = normalizedText(value, maxLength: 8), !value.isEmpty else {
            return nil
        }
        return value.uppercased()
    }

    private func normalizedText(_ value: String?, maxLength: Int) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        return String(value.prefix(max(1, maxLength)))
    }

    private func coarseCoordinate(_ value: Double?) -> Double? {
        guard let value, value.isFinite else { return nil }
        return (value * 10).rounded() / 10
    }

    private func stableHashPrefix(_ raw: String, length: Int = 12) -> String {
        let digest = SHA256.hash(data: Data(raw.utf8))
        let hex = digest.map { String(format: "%02x", $0) }.joined()
        return String(hex.prefix(max(6, min(length, hex.count))))
    }

    private func planFingerprint(
        electionID: String,
        plannedTime: Date?,
        pollingPlace: String?
    ) -> String {
        let plannedKey = plannedTime.map(SupabaseTimestampCodec.encode(_:)) ?? "nil"
        let placeKey = pollingPlace ?? "nil"
        return "\(electionID.lowercased())|\(plannedKey)|\(placeKey.lowercased())"
    }

    private func hasEnabledDeviceToken(for userID: UUID) async throws -> Bool {
        struct DeviceTokenProbe: Decodable {
            let token: String
        }

        let rows: [DeviceTokenProbe] = try await client
            .from("device_tokens")
            .select("token")
            .eq("user_id", value: userID.uuidString)
            .eq("is_enabled", value: true)
            .eq("apns_env", value: expectedAPNSEnvironment())
            .limit(1)
            .execute()
            .value

        return rows.isEmpty == false
    }

    private func expectedAPNSEnvironment() -> String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }
}

private extension ElectionReminderSchedule {
    var coordinate: CLLocationCoordinate2D? {
        guard let latitude, let longitude else { return nil }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

enum SupabaseTimestampCodec {
    private static let withFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let withoutFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func decode(_ raw: String) -> Date? {
        withFractional.date(from: raw) ?? withoutFractional.date(from: raw)
    }

    static func encode(_ date: Date) -> String {
        withFractional.string(from: date)
    }
}
