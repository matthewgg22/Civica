import Foundation

// Pure planning layer between the expiration forecast and the
// notification service. Takes a forecast in, returns a list of
// PlannedNotification values out — no UNUserNotificationCenter, no
// UI, no I/O. This is the unit-tested core; the service layer is
// the thin wrapper that translates planned values into system calls.

struct PlannedNotification: Equatable, Hashable {
    /// Stable per-(documentType + action-kind + reason) so re-running
    /// the planner produces the same identifier and the service layer
    /// can reconcile (replace stale, leave equivalent alone).
    let identifier: String

    /// Display title — short, matter-of-fact. Localized at planning
    /// time because the planner has both the document type and the
    /// language available. Avoid lazy-loaded strings here so the test
    /// can assert exact wire content.
    let title: String

    /// Body — the matter-of-fact "30 seconds to upload a fresh one"
    /// micro-copy from the product brief.
    let body: String

    /// When to fire. Day-precision: the scheduler picks 9am local on
    /// the dueBy date so the prompt arrives during waking hours.
    let fireDate: Date

    /// Document type the notification will deep-link to once the
    /// user taps. Stored in userInfo so the app's notification
    /// delegate can route on tap.
    let documentTypeRaw: String

    /// Reason code from the forecast — recorded in userInfo for the
    /// analytics callback when the user opens the notification.
    let reasonRaw: String
}

enum DocumentReminderScheduler {
    /// Identifier prefix scoped to this module. The service layer
    /// uses this to know which pending notifications to compare
    /// against the planned set during reconciliation — only those
    /// with this prefix are owned by us.
    static let identifierPrefix = "co.civica.recert."

    /// Convert a forecast into a planned-notifications list. Pure.
    /// Sorted ascending by fireDate so callers can render the list
    /// in user-friendly order without re-sorting.
    static func plan(
        forecast: DocumentExpirationForecast,
        language: CivicaLanguage,
        calendar: Calendar = Calendar(identifier: .gregorian)
    ) -> [PlannedNotification] {
        forecast.upcomingActions.map { action in
            PlannedNotification(
                identifier: identifier(for: action),
                title: title(for: action, language: language),
                body: body(for: action, recertDate: forecast.nextRecertDate, language: language),
                fireDate: fireDate(for: action.dueBy, calendar: calendar),
                documentTypeRaw: action.document.rawValue,
                reasonRaw: action.reason.rawValue
            )
        }
    }

    // MARK: - Identifier

    static func identifier(for action: DocumentExpirationAction) -> String {
        "\(identifierPrefix)\(action.document.rawValue).\(action.action.rawValue).\(action.reason.rawValue)"
    }

    // MARK: - Date conversion

    private static func fireDate(for dueBy: Date, calendar: Calendar) -> Date {
        var components = calendar.dateComponents([.year, .month, .day], from: dueBy)
        components.hour = 9
        components.minute = 0
        components.timeZone = TimeZone.current
        return calendar.date(from: components) ?? dueBy
    }

    // MARK: - Copy

    /// Title and body are CivicaText-backed but resolved here so the
    /// PlannedNotification carries finished strings. Keeps the test
    /// assertions simple.
    private static func title(for action: DocumentExpirationAction, language: CivicaLanguage) -> String {
        switch action.reason {
        case .missing:
            return DocumentReminderStrings.titleMissing(documentLabel: action.document.label).value(in: language)
        case .staleAtRecert:
            return DocumentReminderStrings.titleStale(documentLabel: action.document.label).value(in: language)
        case .cadenceDue:
            return DocumentReminderStrings.titleCadence(documentLabel: action.document.label).value(in: language)
        }
    }

    private static func body(
        for action: DocumentExpirationAction,
        recertDate: Date,
        language: CivicaLanguage
    ) -> String {
        let monthFormatter = DateFormatter()
        monthFormatter.dateFormat = "MMMM"
        let month = monthFormatter.string(from: recertDate)
        return DocumentReminderStrings.body(
            documentLabel: action.document.label,
            recertMonth: month
        ).value(in: language)
    }
}

// User-visible copy for reminder titles and bodies. Kept in this file
// because it's structurally tied to the planner — separating into a
// sibling Strings file would force a circular dependency between the
// planner test and the strings module.

enum DocumentReminderStrings {
    static func titleMissing(documentLabel: String) -> CivicaText {
        CivicaText(
            "\(documentLabel): not yet uploaded",
            es: "\(documentLabel): aún no subido"
        )
    }

    static func titleStale(documentLabel: String) -> CivicaText {
        CivicaText(
            "\(documentLabel): time for a fresh copy",
            es: "\(documentLabel): hora de una nueva copia"
        )
    }

    static func titleCadence(documentLabel: String) -> CivicaText {
        CivicaText(
            "\(documentLabel): due for a fresh copy",
            es: "\(documentLabel): necesita una nueva copia"
        )
    }

    static func body(documentLabel: String, recertMonth: String) -> CivicaText {
        CivicaText(
            "Your \(documentLabel.lowercased()) is about to age out for your \(recertMonth) recert. Take 30 seconds to upload a fresh one.",
            es: "Tu \(documentLabel.lowercased()) está por vencer para tu recertificación de \(recertMonth). Toma 30 segundos para subir una nueva."
        )
    }
}
