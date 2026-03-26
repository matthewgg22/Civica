import Foundation
import OSLog

@MainActor
final class MAPVPlanStore: ObservableObject {
    private struct TimelineStateRecord: Decodable {
        let state_name: String
        let state_code: String
        let primary_date: String?
        let primary_runoff_date: String?
        let general_election_date: String?
    }

    private enum Keys {
        static let plan = "mapv.plan.v1"
        static let liveEnabled = "mapv.live.enabled.v1"
        static let etaOptIn = "mapv.eta.optin.v1"
    }

    private static let timelineRecordsByStateCode: [String: TimelineStateRecord] = {
        guard
            let url = Bundle.main.url(forResource: "USMidterm2026ElectionDates", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let records = try? JSONDecoder().decode([TimelineStateRecord].self, from: data)
        else {
            return [:]
        }

        var output: [String: TimelineStateRecord] = [:]
        for record in records {
            output[record.state_code.uppercased()] = record
        }
        return output
    }()

    nonisolated static let appGroupID = "group.turnoutthevote.votenow"
    static let shared = MAPVPlanStore()

    @Published private(set) var plan: MAPVPlan?
    @Published private(set) var userElectionStatus: UserElectionStatusRecord?
    @Published private(set) var liveActivityEnabled: Bool = false
    @Published private(set) var locationETAUpdatesEnabled: Bool = false

    private static var completionPushInFlight = false
    private static var lastCompletionPushSentAt: Date?

    private let defaults: UserDefaults
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let logger = Logger(subsystem: "VoteNow", category: "MAPVPlanStore")
    private let zipStateResolver = USZipStateResolver()
    private var lastSupabaseSyncFingerprint: String?
    private var didAttemptSupabaseBootstrap = false
    private let completionPushCooldown: TimeInterval = 10
    private var reminderSchedulingInFlightKeys: Set<String> = []
    private var reminderScheduledKeysThisSession: Set<String> = []

    init(appGroupID: String = MAPVPlanStore.appGroupID) {
        defaults = UserDefaults(suiteName: appGroupID) ?? .standard
        encoder = JSONEncoder()
        decoder = JSONDecoder()
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601

        load()
        Task {
            await bootstrapFromSupabaseIfNeeded()
        }
    }

    func save(
        _ newPlan: MAPVPlan,
        shouldSyncLiveActivity: Bool = true,
        shouldSyncSupabase: Bool = true
    ) {
        let previousPlan = plan
        var value = newPlan
        value.liveActivityEnabled = liveActivityEnabled
        value.updatedAt = Date()
        value.planSnapshotID = resolvePlanSnapshotID(newPlan: value, previousPlan: previousPlan)

        plan = value
        persist()

        if shouldSyncSupabase {
            syncPlanToSupabaseIfNeeded(value)
            schedulePlanUpdatedNotifications(newPlan: value, previousPlan: previousPlan)
            refreshUserElectionStatus(forElectionID: value.electionTitle)
        }

        guard shouldSyncLiveActivity else { return }
        Task {
            await MAPVLiveActivityManager.shared.refresh(using: value, enabled: liveActivityEnabled)
        }
    }

    func clear(endLiveActivity: Bool = true) {
        plan = nil
        defaults.removeObject(forKey: Keys.plan)

        guard endLiveActivity else { return }
        Task {
            await MAPVLiveActivityManager.shared.endAll(immediate: false)
        }
    }

    func setLiveActivityEnabled(_ enabled: Bool) {
        liveActivityEnabled = enabled
        defaults.set(enabled, forKey: Keys.liveEnabled)

        if var currentPlan = plan {
            currentPlan.liveActivityEnabled = enabled
            save(currentPlan, shouldSyncLiveActivity: false, shouldSyncSupabase: false)
        }

        Task {
            await MAPVLiveActivityManager.shared.refresh(using: plan, enabled: enabled)
        }
    }

    func setLocationETAUpdatesEnabled(_ enabled: Bool) {
        locationETAUpdatesEnabled = enabled
        defaults.set(enabled, forKey: Keys.etaOptIn)
    }

    func markEnRoute(_ value: Bool) {
        guard var currentPlan = plan else { return }
        currentPlan.isEnRoute = value
        save(currentPlan)
    }

    func markCompleted() {
        guard var currentPlan = plan else { return }
        guard currentPlan.isCompleted == false else { return }
        currentPlan.isCompleted = true
        currentPlan.completedAt = Date()
        currentPlan.isEnRoute = false
        save(currentPlan)
        setUserElectionCompletionState(
            .voted,
            source: .selfReport,
            confidence: 1.0
        )

        if beginCompletionPushGate(at: Date()) {
            Task {
                do {
                    _ = try await SupabaseManager.shared.sendTestPush(
                        title: "VoteNow",
                        body: "Your voting plan is set."
                    )
                } catch {
                    logger.error("send_test_push failed for completion flow.")
                }
                await MainActor.run {
                    self.endCompletionPushGate(sentAt: Date())
                }
            }
        }

        Task {
            await MAPVLiveActivityManager.shared.end(
                with: currentPlan,
                finalStatus: .completed,
                dismissalPolicy: .after(Date().addingTimeInterval(10 * 60))
            )
        }
    }

    func resetCompleted() {
        guard var currentPlan = plan else { return }
        currentPlan.isCompleted = false
        currentPlan.completedAt = nil
        save(currentPlan)
        undoUserElectionCompletionState()
    }

    func markBallotReturned() {
        guard var currentPlan = plan else { return }
        currentPlan.isCompleted = true
        currentPlan.completedAt = Date()
        save(currentPlan)
        setUserElectionCompletionState(
            .ballotReceived,
            source: .selfReport,
            confidence: 0.95
        )
    }

    func markBallotAccepted() {
        guard var currentPlan = plan else { return }
        currentPlan.isCompleted = true
        currentPlan.completedAt = Date()
        save(currentPlan)
        setUserElectionCompletionState(
            .ballotAccepted,
            source: .selfReport,
            confidence: 1.0
        )
    }

    func markNotYetVoted() {
        setUserElectionCompletionState(
            .inProgress,
            source: .selfReport,
            confidence: 0.7
        )
    }

    func updateETA(distanceMiles: Double?, etaMinutes: Int?, timestamp: Date = Date()) {
        guard var currentPlan = plan else { return }
        currentPlan.distanceMiles = distanceMiles
        currentPlan.etaMinutes = etaMinutes
        currentPlan.lastETAUpdatedAt = timestamp
        save(currentPlan)
    }

    func updatePlannedArrival(_ date: Date) {
        guard var currentPlan = plan else { return }
        currentPlan.plannedArrival = min(max(date, currentPlan.pollingOpen), currentPlan.pollingClose)
        currentPlan.isCompleted = false
        currentPlan.completedAt = nil
        save(currentPlan)
    }

    func saveFromWizard(
        planVM: PlanViewModel,
        selectedMethod: VotingMethod?,
        selectedPollingPlace: PollingPlace?,
        chosenVotingTime: Date
    ) {
        let election = resolveElection(from: planVM, chosenVotingTime: chosenVotingTime)
        let normalizedArrival = normalizePlannedArrivalForMAPV(
            chosenVotingTime: chosenVotingTime,
            electionDate: election.date
        )
        let plan = MAPVPlan.fromWizard(
            electionTitle: election.title,
            electionDate: election.date,
            selectedMethod: selectedMethod,
            selectedPollingPlace: selectedPollingPlace,
            plannedArrival: normalizedArrival,
            distanceETAString: planVM.plan.distanceETA,
            liveActivityEnabled: liveActivityEnabled,
            travelMode: .driving
        )
        save(plan)
    }

    func bootstrapFromLegacyPlanViewModel(_ planVM: PlanViewModel) {
        guard plan == nil else { return }
        guard let voteTime = planVM.plan.voteTime else { return }

        let election = resolveElection(from: planVM, chosenVotingTime: voteTime)
        let syntheticPlace = PollingPlace(
            label: "1",
            name: planVM.plan.placeName ?? "Polling Place",
            address: planVM.plan.placeAddress ?? "",
            distance: "",
            hours: planVM.plan.placeHours ?? "6 AM - 9 PM"
        )

        let method: VotingMethod? = {
            switch planVM.plan.method?.lowercased() {
            case VotingMethod.early.rawValue.lowercased(): return .early
            case VotingMethod.mail.rawValue.lowercased(): return .mail
            case VotingMethod.election.rawValue.lowercased(): return .election
            default: return nil
            }
        }()

        let restored = MAPVPlan.fromWizard(
            electionTitle: election.title,
            electionDate: election.date,
            selectedMethod: method,
            selectedPollingPlace: syntheticPlace,
            plannedArrival: normalizePlannedArrivalForMAPV(
                chosenVotingTime: voteTime,
                electionDate: election.date
            ),
            distanceETAString: planVM.plan.distanceETA,
            liveActivityEnabled: liveActivityEnabled,
            travelMode: .driving
        )

        save(restored, shouldSyncLiveActivity: false, shouldSyncSupabase: false)
    }

    func resolvedElectionForMAPV(planVM: PlanViewModel, chosenVotingTime: Date) -> (title: String, date: Date) {
        resolveElection(from: planVM, chosenVotingTime: chosenVotingTime)
    }

    func normalizePlannedArrivalForMAPV(chosenVotingTime: Date, electionDate: Date) -> Date {
        let calendar = Calendar.current
        let targetYear = calendar.component(.year, from: electionDate)
        var components = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute, .second, .nanosecond],
            from: chosenVotingTime
        )
        components.year = targetYear
        return calendar.date(from: components) ?? chosenVotingTime
    }

    func refreshLiveActivity(now: Date = Date()) {
        Task {
            await MAPVLiveActivityManager.shared.refresh(
                using: plan,
                enabled: liveActivityEnabled,
                now: now
            )
        }
    }

    private func resolveElection(from planVM: PlanViewModel, chosenVotingTime: Date) -> (title: String, date: Date) {
        if let timelineElection = resolveTimelineUpcomingElection(from: planVM) {
            return timelineElection
        }

        if let future = planVM.upcomingElections
            .filter({ $0.electionDay >= chosenVotingTime })
            .sorted(by: { $0.electionDay < $1.electionDay })
            .first {
            return (future.name, future.electionDay)
        }

        if let nearest = planVM.upcomingElections.min(by: {
            abs($0.electionDay.timeIntervalSince(chosenVotingTime)) < abs($1.electionDay.timeIntervalSince(chosenVotingTime))
        }) {
            return (nearest.name, nearest.electionDay)
        }

        return ("Upcoming Election", chosenVotingTime)
    }

    private func resolveTimelineUpcomingElection(from planVM: PlanViewModel) -> (title: String, date: Date)? {
        guard let stateCode = resolvedStateCode(from: planVM) else { return nil }
        let elections = loadTimelineElections(for: stateCode)
        guard !elections.isEmpty else { return nil }

        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let upcoming = elections
            .filter { calendar.startOfDay(for: $0.date) >= today }
            .sorted { lhs, rhs in
                if lhs.date != rhs.date { return lhs.date < rhs.date }
                return lhs.title < rhs.title
            }
            .first

        return upcoming ?? elections.sorted { $0.date < $1.date }.first
    }

    private func loadTimelineElections(for stateCode: String) -> [(title: String, date: Date)] {
        guard let record = Self.timelineRecordsByStateCode[stateCode.uppercased()] else {
            return []
        }

        let stateName = record.state_name
        let midtermName = "\(stateName) 2026 Midterm"
        let presidentialName = "\(stateName) 2028 Presidential"
        var output: [(title: String, date: Date)] = []

        func append(name: String, subtitle: String, dateISO: String?) {
            guard let date = Self.isoDate(from: dateISO) else { return }
            let title = displayElectionTitle(name: name, subtitle: subtitle, stateName: stateName)
            output.append((title: title, date: date))
        }

        append(name: midtermName, subtitle: "Primary Election", dateISO: record.primary_date)
        append(name: midtermName, subtitle: "Primary Runoff Election", dateISO: record.primary_runoff_date)
        append(name: midtermName, subtitle: "General Election", dateISO: record.general_election_date)
        append(
            name: presidentialName,
            subtitle: "Presidential Primary Election",
            dateISO: Self.shiftedISOYear(from: record.primary_date, toYear: 2028) ?? "2028-03-07"
        )
        append(
            name: presidentialName,
            subtitle: "Presidential General Election",
            dateISO: "2028-11-07"
        )

        return output
    }

    private func displayElectionTitle(name: String, subtitle: String, stateName: String) -> String {
        let base = name
            .replacingOccurrences(of: stateName, with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let phase = subtitle
            .replacingOccurrences(of: "Election", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if !base.isEmpty, !phase.isEmpty {
            let phaseWords = phase.split(separator: " ").map(String.init)
            if let lastBaseWord = base.split(separator: " ").last?.lowercased(),
               let firstPhaseWord = phaseWords.first?.lowercased(),
               lastBaseWord == firstPhaseWord {
                let dedupedPhase = phaseWords.dropFirst().joined(separator: " ")
                if !dedupedPhase.isEmpty {
                    return "\(base) \(dedupedPhase)"
                }
            }
            return "\(base) \(phase)"
        }

        if !base.isEmpty { return base }
        if !phase.isEmpty { return phase }
        return name
    }

    private func resolvedStateCode(from planVM: PlanViewModel) -> String? {
        let directZip = String(planVM.zip.filter(\.isNumber).prefix(5))
        if directZip.count == 5, let code = zipStateResolver.stateCode(for: directZip) {
            return code
        }

        let addressZip = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
        if addressZip.count == 5, let code = zipStateResolver.stateCode(for: addressZip) {
            return code
        }

        let rawState = planVM.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !rawState.isEmpty else { return nil }
        if rawState.count == 2 { return rawState.uppercased() }
        return Self.stateCodeByName[rawState.lowercased()]
    }

    private static func isoDate(from iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        return isoFormatter.date(from: iso)
    }

    private static func shiftedISOYear(from sourceISO: String?, toYear: Int) -> String? {
        guard let sourceDate = isoDate(from: sourceISO) else { return nil }
        let calendar = Calendar(identifier: .gregorian)
        var components = calendar.dateComponents(in: TimeZone(secondsFromGMT: 0) ?? .current, from: sourceDate)
        components.year = toYear
        guard let shiftedDate = calendar.date(from: components) else { return nil }
        return isoFormatter.string(from: shiftedDate)
    }

    private static let isoFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let stateCodeByName: [String: String] = [
        "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
        "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
        "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
        "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
        "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
        "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
        "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
        "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
        "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
        "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
        "district of columbia": "DC"
    ]

    private func load() {
        liveActivityEnabled = defaults.object(forKey: Keys.liveEnabled) as? Bool ?? false
        locationETAUpdatesEnabled = defaults.object(forKey: Keys.etaOptIn) as? Bool ?? false

        guard let data = defaults.data(forKey: Keys.plan) else {
            plan = nil
            return
        }

        do {
            var decoded = try decoder.decode(MAPVPlan.self, from: data)
            decoded.liveActivityEnabled = liveActivityEnabled
            plan = decoded
            lastSupabaseSyncFingerprint = supabaseSyncFingerprint(for: decoded)
            refreshUserElectionStatus(forElectionID: decoded.electionTitle)
        } catch {
            plan = nil
            defaults.removeObject(forKey: Keys.plan)
        }
    }

    private func persist() {
        guard let plan else {
            defaults.removeObject(forKey: Keys.plan)
            return
        }

        do {
            let data = try encoder.encode(plan)
            defaults.set(data, forKey: Keys.plan)
        } catch {
            logger.error("Failed to persist MAPV plan locally.")
        }
    }

    private func syncPlanToSupabaseIfNeeded(_ value: MAPVPlan) {
        let fingerprint = supabaseSyncFingerprint(for: value)
        guard fingerprint != lastSupabaseSyncFingerprint else { return }
        lastSupabaseSyncFingerprint = fingerprint

        let pollingPlace = normalizedPollingPlace(for: value)

        Task {
            do {
                try await SupabaseManager.shared.insertMapvPlan(
                    electionID: value.electionTitle,
                    plannedTime: value.plannedArrival,
                    pollingPlace: pollingPlace,
                    votingMethod: supabaseVotingMethod(from: value.votingMethodRawValue)
                )
            } catch {
                logger.error("Supabase sync failed for MAPV plan.")
                if lastSupabaseSyncFingerprint == fingerprint {
                    lastSupabaseSyncFingerprint = nil
                }
            }
        }
    }

    private func supabaseSyncFingerprint(for value: MAPVPlan) -> String {
        let plannedEpoch = Int(value.plannedArrival.timeIntervalSince1970)
        let votingMethod = value.votingMethodRawValue ?? "election_day"
        return "\(value.electionTitle)|\(plannedEpoch)|\(normalizedPollingPlace(for: value))|\(votingMethod)"
    }

    private func supabaseVotingMethod(from rawValue: String?) -> MapvPlan.VotingMethod? {
        guard let rawValue else { return nil }
        return MapvPlan.VotingMethod(rawValue: rawValue)
    }

    private func normalizedPollingPlace(for value: MAPVPlan) -> String {
        let name = value.pollingPlaceName.trimmingCharacters(in: .whitespacesAndNewlines)
        let address = value.pollingPlaceAddress.trimmingCharacters(in: .whitespacesAndNewlines)
        if address.isEmpty { return name }
        if name.isEmpty { return address }
        return "\(name), \(address)"
    }

    private func bootstrapFromSupabaseIfNeeded() async {
        guard !didAttemptSupabaseBootstrap else { return }
        didAttemptSupabaseBootstrap = true
        guard plan == nil else { return }

        do {
            try await SupabaseManager.shared.signInAnonymouslyIfNeeded()
            let plans = try await SupabaseManager.shared.fetchLatestMapvPlans(limit: 20)
            guard let latest = plans.first(where: { $0.electionID.lowercased() != "debug-election" }) else {
                return
            }
            guard let restored = mapvPlan(from: latest) else { return }

            save(restored, shouldSyncLiveActivity: false, shouldSyncSupabase: false)
            refreshUserElectionStatus(forElectionID: restored.electionTitle)
        } catch {
            logger.info("Supabase bootstrap skipped for MAPV plan restore.")
        }
    }

    private func mapvPlan(from remote: MapvPlan) -> MAPVPlan? {
        let now = Date()
        let plannedArrival = remote.plannedTime ?? now
        let window = MAPVPlan.resolvePollingWindow(
            selectedMethod: nil,
            hoursText: nil,
            on: plannedArrival
        )
        let clampedArrival = min(max(plannedArrival, window.open), window.close)
        let trimmedPollingPlace = remote.pollingPlace?.trimmingCharacters(in: .whitespacesAndNewlines)
        let place: String
        if let trimmedPollingPlace, !trimmedPollingPlace.isEmpty {
            place = trimmedPollingPlace
        } else {
            logger.info("Missing polling_place from Supabase row; using fallback.")
            place = "Polling Place"
        }
        let electionTitle = remote.electionID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "Upcoming Election"
            : remote.electionID

        return MAPVPlan(
            id: remote.id,
            electionTitle: electionTitle,
            electionDate: Calendar.current.startOfDay(for: clampedArrival),
            pollingPlaceName: place,
            pollingPlaceAddress: place,
            pollingOpen: window.open,
            pollingClose: window.close,
            plannedArrival: clampedArrival,
            lat: nil,
            lon: nil,
            travelMode: .driving,
            distanceMiles: nil,
            etaMinutes: nil,
            lastETAUpdatedAt: nil,
            isEnRoute: false,
            isCompleted: false,
            completedAt: nil,
            liveActivityEnabled: liveActivityEnabled,
            createdAt: remote.createdAt,
            updatedAt: Date(),
            missedArrivalGraceMinutes: 30,
            votingMethodRawValue: remote.votingMethod?.rawValue
        )
    }

    private func beginCompletionPushGate(at now: Date) -> Bool {
        guard Self.completionPushInFlight == false else { return false }
        if let lastSent = Self.lastCompletionPushSentAt,
           now.timeIntervalSince(lastSent) < completionPushCooldown {
            return false
        }
        Self.completionPushInFlight = true
        return true
    }

    private func endCompletionPushGate(sentAt: Date) {
        Self.completionPushInFlight = false
        Self.lastCompletionPushSentAt = sentAt
    }

    private func resolvePlanSnapshotID(newPlan: MAPVPlan, previousPlan: MAPVPlan?) -> String {
        guard let previousPlan else {
            return UUID().uuidString
        }
        let newFingerprint = materialPlanFingerprint(for: newPlan)
        let oldFingerprint = materialPlanFingerprint(for: previousPlan)
        if newFingerprint == oldFingerprint {
            return previousPlan.planSnapshotID
        }
        return UUID().uuidString
    }

    private func materialPlanFingerprint(for value: MAPVPlan) -> String {
        let plannedEpoch = Int(value.plannedArrival.timeIntervalSince1970)
        let method = value.votingMethodRawValue ?? "election_day"
        let place = normalizedPollingPlace(for: value).lowercased()
        return "\(value.electionTitle.lowercased())|\(plannedEpoch)|\(method)|\(place)"
    }

    private func schedulePlanUpdatedNotifications(newPlan: MAPVPlan, previousPlan: MAPVPlan?) {
        let changed = previousPlan.map { materialPlanFingerprint(for: $0) != materialPlanFingerprint(for: newPlan) } ?? true
        if let previousPlan,
           changed == false,
           Date().timeIntervalSince(previousPlan.updatedAt) < 24 * 60 * 60 {
            logger.debug("Skipping reminder scheduling because plan is unchanged within 24h.")
            return
        }
        let reminderKey = "\(newPlan.electionTitle.lowercased())|\(newPlan.planSnapshotID.lowercased())"
        guard ReminderSchedulingDeduper.begin(
            key: reminderKey,
            inFlight: &reminderSchedulingInFlightKeys,
            scheduledThisSession: &reminderScheduledKeysThisSession
        ) else {
            logger.debug("Skipping duplicate reminder scheduling task for key \(reminderKey, privacy: .public)")
            return
        }
        let context = MAPVNotificationPluginContext(
            electionID: newPlan.electionTitle,
            planSnapshotID: newPlan.planSnapshotID,
            method: newPlan.votingMethodRawValue ?? "election_day",
            electionDay: newPlan.electionDate,
            plannedActionTime: newPlan.plannedArrival,
            plannedDepartureTime: newPlan.plannedArrival,
            pollSiteName: newPlan.pollingPlaceName,
            pollOpen: newPlan.pollingOpen,
            pollClose: newPlan.pollingClose,
            isPlanComplete: missingField(for: newPlan) == nil,
            missingField: missingField(for: newPlan),
            materialEditInLast24h: changed,
            commitmentText: nil,
            replayAllowed: false,
            commitmentRemoved: false,
            buddyName: nil,
            buddyContactID: nil,
            buddyTwoWayOptIn: false,
            officialChange: nil,
            completionState: userElectionStatus?.completionState ?? (newPlan.isCompleted ? .voted : .inProgress),
            completionMethodDescription: newPlan.votingMethodRawValue,
            earlyVoteWindowStart: nil,
            earlyVoteWindowEnd: nil,
            mailRequestRequired: nil,
            mailRequestWindowOpen: nil,
            mailBallotRequested: nil,
            autoMailJurisdiction: nil,
            trackerStatus: nil,
            returnMethod: nil,
            safeMailDeadline: nil,
            backupOption1: "early vote",
            backupOption2: "in-person Election Day",
            now: Date()
        )

        Task {
            defer {
                ReminderSchedulingDeduper.finish(
                    key: reminderKey,
                    markScheduled: true,
                    inFlight: &self.reminderSchedulingInFlightKeys,
                    scheduledThisSession: &self.reminderScheduledKeysThisSession
                )
            }
            await SupabaseManager.shared.processMAPVNotificationPlugins(
                trigger: .planUpdated,
                context: context
            )
        }
    }

    private func missingField(for plan: MAPVPlan) -> String? {
        let method = plan.votingMethodRawValue ?? "election_day"
        let hasPollingPlace = !plan.pollingPlaceName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && plan.pollingPlaceName.lowercased() != "polling place"
        let hasDate = plan.electionDate.timeIntervalSince1970 > 0
        let hasTime = plan.plannedArrival.timeIntervalSince1970 > 0

        switch method {
        case "vote_by_mail":
            if hasDate == false { return "date" }
            if hasTime == false { return "time" }
            return nil
        case "early_vote", "election_day":
            if hasDate == false { return "date" }
            if hasTime == false { return "time" }
            if hasPollingPlace == false { return "polling place" }
            return nil
        default:
            if hasPollingPlace == false { return "polling place" }
            return nil
        }
    }

    private func setUserElectionCompletionState(
        _ completionState: UserElectionCompletionState,
        source: UserElectionCompletionSource,
        confidence: Double?
    ) {
        guard let electionID = plan?.electionTitle else { return }
        Task {
            do {
                try await SupabaseManager.shared.updateUserElectionStatus(
                    electionID: electionID,
                    completionState: completionState,
                    completionSource: source,
                    completionConfidence: confidence
                )
                await MainActor.run {
                    self.refreshUserElectionStatus(forElectionID: electionID)
                }
            } catch {
                logger.error("Failed updating user_election_status.")
            }
        }
    }

    private func undoUserElectionCompletionState() {
        guard let electionID = plan?.electionTitle else { return }
        Task {
            do {
                try await SupabaseManager.shared.undoUserElectionCompletion(electionID: electionID)
                await MainActor.run {
                    self.refreshUserElectionStatus(forElectionID: electionID)
                }
            } catch {
                logger.error("Failed undoing user_election_status.")
            }
        }
    }

    private func refreshUserElectionStatus(forElectionID electionID: String) {
        Task {
            let status = await SupabaseManager.shared.fetchUserElectionStatus(electionID: electionID)
            await MainActor.run {
                self.userElectionStatus = status
            }
        }
    }
}
