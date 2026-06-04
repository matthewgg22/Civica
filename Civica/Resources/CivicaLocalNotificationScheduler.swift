import Foundation
import OSLog
import UserNotifications

// Civica-target local-notification scheduler. Mirrors the WeVote
// target's MAPV LocalNotificationScheduler (calendar reminders for
// election day), trimmed to what SNAP interview reminders need:
// one-shot UNCalendarNotificationTrigger by identifier, localized
// content via CivicaText, and silent failure when authorization
// isn't granted.
//
// Why a new file instead of reaching across targets: the WeVote
// scheduler is tied to MAPVCalendarPlanPayload + voting-day copy.
// Pulling the generic primitive into a Civica-owned API keeps both
// targets independent and lets SNAP add interview-specific
// identifiers without polluting election code.
//
// No push registration here — these are local notifications only.

enum CivicaLocalNotificationScheduler {

    private static let logger = Logger(subsystem: "Civica", category: "LocalNotificationScheduler")

    /// Current notification authorization status. Cheap to call; safe
    /// to await on the main actor before scheduling.
    static func authorizationStatus() async -> UNAuthorizationStatus {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        return settings.authorizationStatus
    }

    /// Request notification authorization. Returns true if granted
    /// (including provisional/ephemeral). Safe to call repeatedly;
    /// iOS no-ops after the first prompt.
    @discardableResult
    static func requestAuthorization() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            logger.error("Authorization request failed.")
            return false
        }
    }

    /// Schedule a one-shot local notification. Idempotent on identifier:
    /// any pending or delivered notification with the same id is
    /// removed first so callers can safely reschedule when the source
    /// date changes (e.g. user edits the interview date).
    ///
    /// Returns false if authorization isn't granted, the fire date is
    /// in the past, or the system rejects the request. Failures are
    /// logged but not thrown — callers should treat scheduling as
    /// best-effort.
    @discardableResult
    static func schedule(
        identifier: String,
        fireAt: Date,
        title: CivicaText,
        body: CivicaText,
        language: CivicaLanguage,
        userInfo: [String: Any] = [:]
    ) async -> Bool {
        let status = await authorizationStatus()
        guard [.authorized, .provisional, .ephemeral].contains(status) else { return false }
        guard fireAt > Date() else { return false }

        let center = UNUserNotificationCenter.current()
        cancel(identifier: identifier)

        let content = UNMutableNotificationContent()
        content.title = title.value(in: language)
        content.body = body.value(in: language)
        content.sound = .default
        if !userInfo.isEmpty {
            content.userInfo = userInfo
        }

        let components = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute],
            from: fireAt
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

        do {
            try await center.add(request)
            return true
        } catch {
            logger.error("Failed to schedule notification id=\(identifier, privacy: .public).")
            return false
        }
    }

    /// Cancel a pending or delivered notification by identifier.
    /// No-op if the identifier doesn't exist.
    static func cancel(identifier: String) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        center.removeDeliveredNotifications(withIdentifiers: [identifier])
    }
}

// MARK: - SNAP interview notification identifiers

enum SNAPInterviewNotification {
    /// Identifier for the "your interview is tomorrow" reminder
    /// scheduled 24 hours before the user's interview date. Single
    /// identifier per app install because v1 only tracks one in-flight
    /// SNAP application at a time.
    static let twentyFourHourReminderID = "co.civica.snap.interview.reminder.24h"

    static let twentyFourHourTitle = CivicaText(
        "Your SNAP interview is tomorrow",
        es: "Su entrevista de SNAP es mañana",
        zh: "你的 SNAP 面谈在明天",
        vi: "Buổi phỏng vấn SNAP của bạn là ngày mai",
        tl: "Bukas na ang iyong SNAP interview"
    )

    static let twentyFourHourBody = CivicaText(
        "Open Civica to review what they'll ask and what to have nearby.",
        es: "Abre Civica para repasar lo que te preguntarán y lo que debes tener cerca.",
        zh: "打开 Civica,看看他们会问什么,以及你需要准备好哪些东西。",
        vi: "Mở Civica để xem họ sẽ hỏi gì và bạn cần chuẩn bị sẵn những gì.",
        tl: "Buksan ang Civica para makita kung ano ang itatanong nila at ano ang dapat nakahanda malapit sa iyo."
    )
}
