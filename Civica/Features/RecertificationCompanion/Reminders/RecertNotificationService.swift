import Foundation
import UserNotifications

// Thin wrapper around UNUserNotificationCenter for the Recertification
// Companion's reminders. The interesting logic — what to schedule — is
// in DocumentReminderScheduler. This file owns permission handshake
// + reconciliation against the system's pending-requests list.
//
// Idempotency contract:
//   reconcile(planned:) — replaces stale, leaves equivalent alone,
//   adds new. Running it twice in a row with the same input results
//   in zero system writes the second time (modulo the system's own
//   ID comparison cost).

@MainActor
final class RecertNotificationService {
    static let shared = RecertNotificationService()

    private let center = UNUserNotificationCenter.current()

    private init() {}

    /// Ask for notification permission. Returns the user's decision.
    /// Caller is expected to have shown the soft pre-prompt first —
    /// see RecertNotificationPermissionView.
    @discardableResult
    func requestAuthorization() async -> Bool {
        do {
            return try await center.requestAuthorization(options: [.alert, .badge, .sound])
        } catch {
            return false
        }
    }

    /// Current authorization status. Cheap to read; safe to call from
    /// view onAppear.
    func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    /// Replace the user's currently-scheduled recert reminders with
    /// the planned set. Idempotent — re-running with the same input
    /// is a no-op.
    func reconcile(planned: [PlannedNotification]) async {
        let pending = await center.pendingNotificationRequests()
        let owned = pending.filter { $0.identifier.hasPrefix(DocumentReminderScheduler.identifierPrefix) }

        let desiredIDs = Set(planned.map(\.identifier))
        let pendingIDs = Set(owned.map(\.identifier))

        let toCancel = pendingIDs.subtracting(desiredIDs)
        let toAdd = planned.filter { !pendingIDs.contains($0.identifier) }

        if !toCancel.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: Array(toCancel))
        }

        for plan in toAdd {
            let content = UNMutableNotificationContent()
            content.title = plan.title
            content.body = plan.body
            content.userInfo = [
                "documentType": plan.documentTypeRaw,
                "reason": plan.reasonRaw,
                "module": "recert_companion"
            ]

            let triggerDate = Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute],
                from: plan.fireDate
            )
            let trigger = UNCalendarNotificationTrigger(
                dateMatching: triggerDate,
                repeats: false
            )
            let request = UNNotificationRequest(
                identifier: plan.identifier,
                content: content,
                trigger: trigger
            )

            do {
                try await center.add(request)
                RecertCompanionAnalytics.trackReminderScheduled(documentType: plan.documentTypeRaw)
            } catch {
                // Logged via the analytics path on success; on failure
                // we silently drop — a missed reminder is recoverable
                // (user still sees the calendar) and we don't want to
                // surface system errors that the user can't act on.
                continue
            }
        }
    }

    /// Cancel every owned reminder. Used when the user turns off the
    /// feature or completes their recertification.
    func cancelAll() async {
        let pending = await center.pendingNotificationRequests()
        let ownedIDs = pending
            .map(\.identifier)
            .filter { $0.hasPrefix(DocumentReminderScheduler.identifierPrefix) }
        if !ownedIDs.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: ownedIDs)
        }
    }

    /// List of currently-owned pending requests, for debug surfaces.
    func owned() async -> [UNNotificationRequest] {
        let pending = await center.pendingNotificationRequests()
        return pending.filter { $0.identifier.hasPrefix(DocumentReminderScheduler.identifierPrefix) }
    }
}
