import Foundation

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

    nonisolated static let appGroupID = "group.turnoutthevote.votenow"
    static let shared = MAPVPlanStore()

    @Published private(set) var plan: MAPVPlan?
    @Published private(set) var liveActivityEnabled: Bool = false
    @Published private(set) var locationETAUpdatesEnabled: Bool = false

    private static var completionPushInFlight = false
    private static var lastCompletionPushSentAt: Date?

    private let defaults: UserDefaults
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let zipStateResolver = USZipStateResolver()
    private var lastSupabaseSyncFingerprint: String?
    private var didAttemptSupabaseBootstrap = false
    private let completionPushCooldown: TimeInterval = 10

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
        var value = newPlan
        value.liveActivityEnabled = liveActivityEnabled
        value.updatedAt = Date()

        plan = value
        persist()

        if shouldSyncSupabase {
            syncPlanToSupabaseIfNeeded(value)
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

        if beginCompletionPushGate(at: Date()) {
            Task {
                do {
                    _ = try await SupabaseManager.shared.sendTestPush(
                        title: "VoteNow",
                        body: "Your voting plan is set."
                    )
                } catch {
                    print("[MAPVPlanStore] send_test_push failed:", String(describing: error))
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
        guard let url = Bundle.main.url(forResource: "USMidterm2026ElectionDates", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let records = try? JSONDecoder().decode([TimelineStateRecord].self, from: data),
              let record = records.first(where: { $0.state_code == stateCode }) else {
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
            print("MAPVPlanStore persist failed: \(error.localizedDescription)")
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
                print("[MAPVPlanStore] Supabase sync failed: \(String(describing: error))")
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
        } catch {
            print("[MAPVPlanStore] Supabase bootstrap skipped: \(String(describing: error))")
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
            print("[MAPVPlanStore] Missing polling_place from Supabase row \(remote.id.uuidString); using fallback.")
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
}
