import Foundation
import UserNotifications

// Schedules the +14d "did you hear back from CalFresh?" push and
// keeps it idempotent. Modeled on RecertNotificationService but with
// per-packet identifiers (one push per packetId) rather than the
// per-document fan-out the recert reminders need.
//
// Identifier convention:
//   co.civica.countyOutcome.{packetId}.ask
//
// Rescheduling for the same packetId replaces the existing pending
// request rather than enqueuing a duplicate.

@MainActor
final class CountyOutcomeNotificationService {
    static let shared = CountyOutcomeNotificationService()

    /// Prefix used to identify push requests owned by this module.
    /// Mirrors RecertNotificationService.identifierPrefix convention.
    static let identifierPrefix = "co.civica.countyOutcome."

    private let center: UserNotificationCenterProtocol

    init(center: UserNotificationCenterProtocol = UNUserNotificationCenter.current()) {
        self.center = center
    }

    /// Compose the push identifier for a packet. Stable per-packet so
    /// rescheduling replaces in-place.
    static func identifier(forPacketId packetId: String) -> String {
        "\(identifierPrefix)\(packetId).ask"
    }

    // MARK: - Permission

    /// Best-effort permission request. Caller (CountyOutcomePromptView's
    /// soft pre-prompt) should have shown the explainer first. Returns
    /// the user's decision; no-op if already authorized.
    @discardableResult
    func requestAuthorizationIfNeeded() async -> Bool {
        let status = await center.currentAuthorizationStatus()
        switch status {
        case .authorized, .provisional, .ephemeral:
            return true
        case .denied:
            return false
        case .notDetermined:
            fallthrough
        @unknown default:
            return await center.requestPushAuthorization(options: [.alert, .badge, .sound])
        }
    }

    // MARK: - Scheduling

    /// Schedule (or reschedule) the +interval push for a given packet.
    /// Replaces any existing pending request with the same identifier
    /// rather than duplicating. Strings are resolved here (vs at fire
    /// time) so the push body matches the language active when the
    /// status transitioned, not whatever the user later switched to.
    func scheduleAsk(
        packetId: String,
        in interval: TimeInterval,
        language: CivicaLanguage = .english,
        now: Date = Date()
    ) async {
        let identifier = Self.identifier(forPacketId: packetId)

        // Replace-in-place: removing first guarantees no duplicate, even
        // if the system added the prior request a moment ago.
        center.removePendingNotificationRequests(withIdentifiers: [identifier])

        let content = UNMutableNotificationContent()
        content.title = CountyOutcomeStrings.pushTitle.value(in: language)
        content.body = CountyOutcomeStrings.pushBody.value(in: language)
        content.userInfo = [
            "module": "county_outcome",
            "packetId": packetId,
            "action": "ask"
        ]

        let fireDate = now.addingTimeInterval(interval)
        let triggerComponents = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute],
            from: fireDate
        )
        let trigger = UNCalendarNotificationTrigger(
            dateMatching: triggerComponents,
            repeats: false
        )
        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: trigger
        )

        do {
            try await center.add(request)
        } catch {
            // Silent drop — a missed nudge is recoverable (the in-app
            // prompt can still surface on next launch) and we don't
            // want to surface UN errors the user can't act on. Matches
            // RecertNotificationService.reconcile's failure handling.
        }
    }

    /// Cancel the pending push for a packet (e.g. after the applicant
    /// submits a response in-app before the push fires).
    func cancelAsk(packetId: String) {
        let identifier = Self.identifier(forPacketId: packetId)
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
    }

    /// Pending county-outcome requests, for tests and debug surfaces.
    func pendingAsks() async -> [UNNotificationRequest] {
        let pending = await center.pendingNotificationRequests()
        return pending.filter { $0.identifier.hasPrefix(Self.identifierPrefix) }
    }
}

// MARK: - Test seam

/// Narrow protocol over UNUserNotificationCenter so unit tests can
/// substitute an in-memory fake. Method names are deliberately distinct
/// from UNUserNotificationCenter's own API so the adapter extension
/// below doesn't collide with the real methods.
protocol UserNotificationCenterProtocol {
    func currentAuthorizationStatus() async -> UNAuthorizationStatus
    func requestPushAuthorization(options: UNAuthorizationOptions) async -> Bool
    func add(_ request: UNNotificationRequest) async throws
    func removePendingNotificationRequests(withIdentifiers identifiers: [String])
    func pendingNotificationRequests() async -> [UNNotificationRequest]
}

extension UNUserNotificationCenter: UserNotificationCenterProtocol {
    func currentAuthorizationStatus() async -> UNAuthorizationStatus {
        await notificationSettings().authorizationStatus
    }

    func requestPushAuthorization(options: UNAuthorizationOptions) async -> Bool {
        (try? await requestAuthorization(options: options)) ?? false
    }
}
