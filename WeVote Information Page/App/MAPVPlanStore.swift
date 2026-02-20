import Foundation

@MainActor
final class MAPVPlanStore: ObservableObject {
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
        let plan = MAPVPlan.fromWizard(
            electionTitle: election.title,
            electionDate: election.date,
            selectedMethod: selectedMethod,
            selectedPollingPlace: selectedPollingPlace,
            plannedArrival: chosenVotingTime,
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
            plannedArrival: voteTime,
            distanceETAString: planVM.plan.distanceETA,
            liveActivityEnabled: liveActivityEnabled,
            travelMode: .driving
        )

        save(restored, shouldSyncLiveActivity: false, shouldSyncSupabase: false)
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
        let place = (remote.pollingPlace?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
            ? remote.pollingPlace!.trimmingCharacters(in: .whitespacesAndNewlines)
            : "Polling Place"
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
