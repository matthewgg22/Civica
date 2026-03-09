import Foundation
import OSLog
import Supabase

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

struct ElectionReminderSchedule: Sendable {
    let electionID: String
    let electionDay: Date
    let earlyVotingStart: Date?
    let stateCode: String
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
    private var isSigningIn = false
    private var insertedPlanFingerprintsThisLaunch: Set<String> = []
    private var insertedNotificationFingerprintsThisLaunch: Set<String> = []
    private var hasLoggedMissingUserElectionStatusTable = false
    #if DEBUG
    private var hasInsertedDebugPlanThisLaunch = false
    #endif
    private let addressSearchSessionID = UUID()

    private init(client: AppSupabaseClient = SupabaseClientProvider.shared.client) {
        self.client = client
    }

    func signInAnonymouslyIfNeeded() async throws {
        if cachedSession != nil {
            return
        }
        if isSigningIn { return }
        isSigningIn = true
        defer { isSigningIn = false }

        do {
            let existingSession = try await client.auth.session
            cachedSession = existingSession
            return
        } catch {
            logger.debug("No existing session found; attempting anonymous sign-in.")
        }

        try await client.auth.signInAnonymously()

        let session = try await client.auth.session
        cachedSession = session
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
            _ = try await client
                .from("mapv_plans")
                .insert(payload)
                .execute()
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
            _ = try await client
                .from("mapv_plans")
                .insert(fallback)
                .execute()
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
        _ = try await client
            .from("feedback")
            .insert(payload)
            .execute()
    }

    func saveDeviceToken(_ token: String) async {
        let deviceToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !deviceToken.isEmpty else {
            print("⚠️ APNs token is empty; skipping Supabase save")
            return
        }

        func redactedToken(_ raw: String) -> String {
            guard raw.count > 12 else { return raw }
            return "\(raw.prefix(8))...\(raw.suffix(4))"
        }

        do {
            let session = try await client.auth.session
            let userId = session.user.id

            _ = try await client
                .from("device_tokens")
                .insert([
                    [
                        "user_id": userId.uuidString,
                        "token": deviceToken
                    ]
                ])
                .execute()

            print("✅ Device token saved to Supabase (\(redactedToken(deviceToken)))")
        } catch {
            let message = String(describing: error)
            if message.contains("23505") && message.contains("device_tokens_token_key") {
                print("ℹ️ Device token already exists; keeping current record (\(redactedToken(deviceToken)))")
            } else {
                print("❌ Failed saving device token:", message)
            }
        }
    }

    func scheduleElectionRemindersForResolvedAddress(_ schedule: ElectionReminderSchedule) async throws {
        let session = try await client.auth.session
        let userID = session.user.id
        var createdAnyReminder = false

        print("ℹ️ cancelling old pending election reminders for user")
        try await cancelPendingElectionReminders(userID: userID)

        if let earlyVotingStart = schedule.earlyVotingStart {
            if try await shouldSuppressNotificationForElection(
                userID: userID,
                electionID: schedule.electionID,
                notificationType: "early_voting_open"
            ) {
                print("ℹ️ suppression active: skipping early_voting_open for election \(schedule.electionID)")
            } else {
            let earlyVotingSendAt = try reminderSendAt10_30AM(
                on: earlyVotingStart,
                stateCode: schedule.stateCode
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

            _ = try await client
                .from("scheduled_notifications")
                .insert([earlyVotingPayload])
                .execute()
            print("✅ early voting reminder created")
            createdAnyReminder = true
            }
        } else {
            print("ℹ️ no early voting date found, skipping early voting reminder")
        }

        if try await shouldSuppressNotificationForElection(
            userID: userID,
            electionID: schedule.electionID,
            notificationType: "election_day_reminder"
        ) {
            print("ℹ️ suppression active: skipping election_day_reminder for election \(schedule.electionID)")
            if createdAnyReminder {
                print("✅ new election reminders scheduled")
            }
            return
        }

        let electionDaySendAt = try reminderSendAt10_30AM(
            on: schedule.electionDay,
            stateCode: schedule.stateCode
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

        _ = try await client
            .from("scheduled_notifications")
            .insert([electionDayPayload])
            .execute()
        print("✅ election day reminder created")
        createdAnyReminder = true
        if createdAnyReminder {
            print("✅ new election reminders scheduled")
        }
    }

    func processMAPVNotificationPlugins(
        trigger: MAPVNotificationTrigger,
        context: MAPVNotificationPluginContext
    ) async {
        do {
            let session = try await client.auth.session
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
                    print("ℹ️ notification suppressed for plugin \(draft.pluginID.rawValue)")
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

                _ = try await client
                    .from("scheduled_notifications")
                    .insert([payload])
                    .execute()
                insertedNotificationFingerprintsThisLaunch.insert(fingerprint)
            }
        } catch {
            print("❌ MAPV plugin notification scheduling failed: \(error.localizedDescription)")
        }
    }

    func fetchUserElectionStatus(electionID: String) async -> UserElectionStatusRecord? {
        do {
            let session = try await client.auth.session
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
            let session = try await client.auth.session
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
                _ = try await client
                    .from("user_election_status")
                    .insert([insertPayload])
                    .execute()
            } else {
                _ = try await client
                    .from("user_election_status")
                    .update(updatePayload)
                    .eq("user_id", value: userID.uuidString)
                    .eq("election_id", value: electionID)
                    .execute()
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
            let session = try await client.auth.session
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
                _ = try await client
                    .from("user_election_status")
                    .insert([insertPayload])
                    .execute()
            } else {
                _ = try await client
                    .from("user_election_status")
                    .update(updatePayload)
                    .eq("user_id", value: userID.uuidString)
                    .eq("election_id", value: electionID)
                    .execute()
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
        _ = try await client
            .from("scheduled_notifications")
            .update(["status": "canceled"])
            .eq("user_id", value: userID.uuidString)
            .eq("notification_type", value: notificationType)
            .eq("status", value: "pending")
            .execute()
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
        return message.contains("PGRST205")
            || message.contains("Could not find the table 'public.user_election_status'")
    }

    private func logMissingUserElectionStatusTableOnce(context: String) {
        guard !hasLoggedMissingUserElectionStatusTable else { return }
        hasLoggedMissingUserElectionStatusTable = true
        print("⚠️ user_election_status table is missing (\(context)). Apply migration 20260308_mapv_notification_suppression.sql in Supabase.")
    }

    private func reminderSendAt10_30AM(on date: Date, stateCode: String) throws -> Date {
        let timeZone = electionTimeZone(for: stateCode)
        print("✅ reminder timezone: \(timeZone.identifier)")

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
        print("✅ computed local 10:30 AM send_at: \(localFormatter.string(from: sendAt))")

        return sendAt
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

        try await signInAnonymouslyIfNeeded()
        guard cachedSession != nil else {
            throw SupabaseManagerError.noSession
        }

        return try await client
            .from("mapv_plans")
            .select()
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
            print("[SupabaseManager] Inserted debug MAPV plan.")
        } catch {
            hasInsertedDebugPlanThisLaunch = false
            print("[SupabaseManager] insertDebugMAPVPlan failed:", String(describing: error))
            throw error
        }
    }

    func deleteDebugPlans(forUserId userId: UUID) async throws {
        try await client.from("mapv_plans").delete().eq("user_id", value: userId.uuidString).eq("election_id", value: "debug-election").execute()
    }

    func fetchMAPVPlans() async throws -> [MapvPlan] {
        do {
            let plans = try await fetchLatestMapvPlans(limit: 20)
            print("[SupabaseManager] Fetched MAPV plans:", plans.count)
            plans.forEach { plan in
                print("• \(plan.id.uuidString) | \(plan.electionID) | \(plan.plannedTime?.description ?? "nil") | \(plan.pollingPlace ?? "nil")")
            }
            return plans
        } catch {
            print("[SupabaseManager] fetchMAPVPlans failed:", String(describing: error))
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

            let payload = AddressSearchEvent(
                userID: event.userID ?? session.user.id,
                context: event.context,
                rawInput: event.rawInput,
                inputType: event.inputType,
                success: event.success,
                errorCode: event.errorCode,
                resolvedDisplay: event.resolvedDisplay,
                postalCode: event.postalCode,
                city: event.city,
                state: event.state,
                countryCode: event.countryCode,
                lat: event.lat,
                lng: event.lng,
                placeSource: event.placeSource,
                sessionID: event.sessionID ?? addressSearchSessionID
            )

            _ = try await client
                .from("address_search_events")
                .insert(payload)
                .execute()
        } catch {
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
                return
            }
            print("[SupabaseManager] address_search_events insert failed:", String(describing: error))
        }
    }

    private func isMissingPollingPlaceColumnError(_ error: Error) -> Bool {
        if let postgrestError = error as? PostgrestError {
            let code = postgrestError.code?.lowercased() ?? ""
            let message = postgrestError.message.lowercased()
            if code == "pgrst204" && message.contains("polling_place") {
                return true
            }
        }

        let combined = "\(String(describing: error)) \(error.localizedDescription)".lowercased()
        if combined.contains("pgrst204") && combined.contains("polling_place") {
            return true
        }
        if combined.contains("schema cache") && combined.contains("polling_place") {
            return true
        }
        return false
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
