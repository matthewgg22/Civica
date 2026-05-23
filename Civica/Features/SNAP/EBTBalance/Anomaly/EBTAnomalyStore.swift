import Combine
import Foundation
import OSLog

// Owns the live set of skimming/anomaly alerts and the travel-mute
// preference. Per plan Q1/D8: subscribes to EBTBalanceRepository.$account
// (Combine) and re-scores whenever the account changes.
//
// Travel mute (D5): set by enableTravelMute() → persists to UserDefaults
// + calls API client. The detector suppresses cross-state alerts during
// the mute window.

@MainActor
final class EBTAnomalyStore: ObservableObject {

    // MARK: - Published state

    @Published private(set) var activeAlerts: [EBTAnomalyAlert] = []
    @Published private(set) var travelMuteUntil: Date?

    // MARK: - Dependencies

    private let repository: EBTBalanceRepository
    private let apiClient: (any EBTBalanceAPIClient)?
    private let defaults: UserDefaults
    private var cancellables: Set<AnyCancellable> = []
    private static let logger = Logger(subsystem: "Civica", category: "EBTAnomalyStore")

    // MARK: - UserDefaults keys

    static let travelMuteKey = "co.civica.ebt.travelMute"

    // MARK: - Init

    init(
        repository: EBTBalanceRepository,
        apiClient: (any EBTBalanceAPIClient)? = nil,
        defaults: UserDefaults = .standard
    ) {
        self.repository = repository
        self.apiClient = apiClient
        self.defaults = defaults

        // Restore persisted travel-mute date.
        if let stored = defaults.object(forKey: Self.travelMuteKey) as? Date {
            // Discard stale mutes silently (they're past; no need to persist 0).
            self.travelMuteUntil = stored > Date() ? stored : nil
        }

        // Subscribe to repository account updates.
        repository.$account
            .receive(on: RunLoop.main)
            .sink { [weak self] account in
                self?.rescore(account: account)
            }
            .store(in: &cancellables)
    }

    // MARK: - Public actions

    /// Enable a travel mute window. Defaults to 30 days per plan D5.
    /// Persists to UserDefaults and syncs to the gateway.
    func enableTravelMute(days: Int = 30) {
        let until = Date().addingTimeInterval(Double(days) * 86_400)
        travelMuteUntil = until
        defaults.set(until, forKey: Self.travelMuteKey)

        // Re-score immediately to clear cross-state alerts.
        rescore(account: repository.account)

        // Sync to backend if an API client is available.
        guard let client = apiClient else { return }
        Task { @MainActor in
            do {
                try await client.updateNotificationPrefs(
                    EBTNotificationPrefsPayload(
                        depositOn: true,
                        lowBalanceOn: true,
                        perksOn: true,
                        recertOn: true,
                        quietStartMinutes: EBTNotificationPrefsStore.defaultQuietStartMinutes,
                        quietEndMinutes: EBTNotificationPrefsStore.defaultQuietEndMinutes
                    )
                )
            } catch {
                Self.logger.error("Travel mute backend sync failed: \(String(describing: error), privacy: .public)")
            }
        }
    }

    /// Dismiss a specific alert (recipient has acknowledged it).
    func dismiss(_ alert: EBTAnomalyAlert) {
        activeAlerts.removeAll { $0.id == alert.id }
    }

    // MARK: - Private

    private func rescore(account: EBTAccount?) {
        guard let account else {
            activeAlerts = []
            return
        }
        activeAlerts = EBTAnomalyDetector.score(
            transactions: account.transactions,
            travelMuteUntil: travelMuteUntil
        )
    }
}
