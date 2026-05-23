import Foundation
import OSLog

// Per-user notification preferences for the EBT Push surface.
// Drives EBTNotificationPrefsView (Form-with-toggles) and is the
// source of truth the gateway consults when fanning out APNs sends.
//
// Per plan §4.4:
//   - default deposit + low-balance + perks + recert all ON
//   - quiet hours default 9pm → 8am recipient-local
//
// Persistence: UserDefaults (one bool per category, two ints for
// quiet-hour HH:MM). Backend sync: every change POSTs to
// /ebt/notifications/prefs via the API client. If the API client
// isn't wired yet (Lane C), the local UserDefaults state stays
// authoritative and the gateway will receive prefs on next sync.

/// API surface needed by the prefs store. Lane C's full
/// EBTBalanceAPIClient will conform to this — kept narrow to keep
/// the test seam tight.
protocol EBTNotificationPrefsAPIClient: AnyObject, Sendable {
    func updateNotificationPrefs(_ prefs: EBTNotificationPrefsPayload) async throws
}

/// Wire-format snapshot of all preference state. Matches the JSON
/// body expected by POST /ebt/notifications/prefs in the gateway.
struct EBTNotificationPrefsPayload: Codable, Equatable, Sendable {
    var depositOn: Bool
    var lowBalanceOn: Bool
    var perksOn: Bool
    var recertOn: Bool
    /// Quiet-hour start, minutes-since-midnight in recipient-local time.
    var quietStartMinutes: Int
    /// Quiet-hour end, minutes-since-midnight in recipient-local time.
    var quietEndMinutes: Int

    enum CodingKeys: String, CodingKey {
        case depositOn       = "deposit_on"
        case lowBalanceOn    = "low_balance_on"
        case perksOn         = "perks_on"
        case recertOn        = "recert_on"
        case quietStartMinutes = "quiet_start_minutes"
        case quietEndMinutes   = "quiet_end_minutes"
    }
}

@MainActor
final class EBTNotificationPrefsStore: ObservableObject {

    // MARK: - UserDefaults keys (namespaced co.civica.ebt.notification.*)

    static let depositOnKey       = "co.civica.ebt.notification.deposit_on"
    static let lowBalanceOnKey    = "co.civica.ebt.notification.low_balance_on"
    static let perksOnKey         = "co.civica.ebt.notification.perks_on"
    static let recertOnKey        = "co.civica.ebt.notification.recert_on"
    static let quietStartKey      = "co.civica.ebt.notification.quiet_start_minutes"
    static let quietEndKey        = "co.civica.ebt.notification.quiet_end_minutes"
    /// Sentinel so we can distinguish "user hasn't touched prefs yet"
    /// (apply plan defaults) from "user turned everything off".
    static let initializedKey     = "co.civica.ebt.notification.initialized"

    /// Default quiet hours per plan §4.4 — 9pm to 8am recipient-local.
    static let defaultQuietStartMinutes = 21 * 60   // 21:00
    static let defaultQuietEndMinutes   =  8 * 60   // 08:00

    // MARK: - Published state

    @Published var depositOn: Bool {
        didSet { persistAndSync(key: Self.depositOnKey, value: depositOn) }
    }
    @Published var lowBalanceOn: Bool {
        didSet { persistAndSync(key: Self.lowBalanceOnKey, value: lowBalanceOn) }
    }
    @Published var perksOn: Bool {
        didSet { persistAndSync(key: Self.perksOnKey, value: perksOn) }
    }
    @Published var recertOn: Bool {
        didSet { persistAndSync(key: Self.recertOnKey, value: recertOn) }
    }
    @Published var quietStartMinutes: Int {
        didSet { persistAndSyncInt(key: Self.quietStartKey, value: quietStartMinutes) }
    }
    @Published var quietEndMinutes: Int {
        didSet { persistAndSyncInt(key: Self.quietEndKey, value: quietEndMinutes) }
    }

    // MARK: - Dependencies

    let defaults: UserDefaults
    /// Lane C wires this. Nil = local-only mode (sync deferred).
    var apiClient: EBTNotificationPrefsAPIClient?

    private static let logger = Logger(subsystem: "Civica", category: "EBTNotificationPrefsStore")

    // MARK: - Init

    init(defaults: UserDefaults = .standard,
         apiClient: EBTNotificationPrefsAPIClient? = nil) {
        self.defaults = defaults
        self.apiClient = apiClient

        let initialized = defaults.bool(forKey: Self.initializedKey)
        if initialized {
            // Read back persisted values.
            self.depositOn    = defaults.bool(forKey: Self.depositOnKey)
            self.lowBalanceOn = defaults.bool(forKey: Self.lowBalanceOnKey)
            self.perksOn      = defaults.bool(forKey: Self.perksOnKey)
            self.recertOn     = defaults.bool(forKey: Self.recertOnKey)
            self.quietStartMinutes = defaults.integer(forKey: Self.quietStartKey)
            self.quietEndMinutes   = defaults.integer(forKey: Self.quietEndKey)
        } else {
            // First-run defaults per plan §4.4.
            self.depositOn    = true
            self.lowBalanceOn = true
            self.perksOn      = true
            self.recertOn     = true
            self.quietStartMinutes = Self.defaultQuietStartMinutes
            self.quietEndMinutes   = Self.defaultQuietEndMinutes
        }

        // Don't trigger backend sync from the initial assignment —
        // mark initialized AFTER the @Published vars are populated so
        // didSet hooks no-op on construction.
        defaults.set(true, forKey: Self.initializedKey)
    }

    // MARK: - Snapshot

    func snapshot() -> EBTNotificationPrefsPayload {
        EBTNotificationPrefsPayload(
            depositOn: depositOn,
            lowBalanceOn: lowBalanceOn,
            perksOn: perksOn,
            recertOn: recertOn,
            quietStartMinutes: quietStartMinutes,
            quietEndMinutes: quietEndMinutes
        )
    }

    // MARK: - Persistence + sync

    private func persistAndSync(key: String, value: Bool) {
        defaults.set(value, forKey: key)
        syncToBackend()
    }

    private func persistAndSyncInt(key: String, value: Int) {
        defaults.set(value, forKey: key)
        syncToBackend()
    }

    private func syncToBackend() {
        guard let api = apiClient else {
            // TODO: Lane C wires apiClient. Until then, prefs stay
            // local and the next launch with a wired client will push
            // them up.
            return
        }
        let payload = snapshot()
        Task { @MainActor in
            do {
                try await api.updateNotificationPrefs(payload)
            } catch {
                Self.logger.error("Pref sync failed: \(String(describing: error), privacy: .public)")
            }
        }
    }
}
