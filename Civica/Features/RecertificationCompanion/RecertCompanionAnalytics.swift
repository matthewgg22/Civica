import Foundation
#if canImport(FirebaseAnalytics)
import FirebaseAnalytics
#if canImport(FirebaseCore)
import FirebaseCore
#endif
#endif

// Analytics for the Recertification Companion. Mirrors SNAPAnalytics —
// closed-set parameter allowlist, no PII, no eligibility answers, no
// recert dates. Coarse counts and document types only.

enum RecertCompanionAnalytics {
    /// Privacy boundary allowlist. Adding a new key here is a deliberate
    /// privacy review — do not extend without reading the SNAPAnalytics
    /// rationale at the top of that file.
    static let allowedParameterKeys: Set<String> = [
        "step_name",
        "step_index",
        "document_type",
        "state_code"
    ]

    enum Event {
        static let homeViewed = "recert_companion_home_viewed"

        // Phantom Recert
        static let phantomStarted = "phantom_recert_started"
        static let phantomCompleted = "phantom_recert_completed"
        static let phantomAbandoned = "phantom_recert_abandoned"

        // Expiration Calendar
        static let calendarViewed = "expiration_calendar_viewed"
        static let expirationActionTaken = "expiration_action_taken"

        // Reminders
        static let reminderScheduled = "reminder_scheduled"
        static let reminderOpened = "reminder_opened"
        static let reminderActedOn = "reminder_acted_on"

        // Appeal
        static let appealInitiated = "appeal_initiated"
        static let appealEdited = "appeal_edited"
        static let appealExported = "appeal_exported"
    }

    // MARK: - Surface-level helpers

    static func trackHomeViewed() {
        send(Event.homeViewed, parameters: [:])
    }

    static func trackPhantomStarted() {
        send(Event.phantomStarted, parameters: [:])
    }

    static func trackPhantomCompleted() {
        send(Event.phantomCompleted, parameters: [:])
    }

    static func trackPhantomAbandoned(lastStepName: String, stepIndex: Int) {
        send(Event.phantomAbandoned, parameters: [
            "step_name": lastStepName,
            "step_index": stepIndex
        ])
    }

    static func trackCalendarViewed() {
        send(Event.calendarViewed, parameters: [:])
    }

    static func trackExpirationActionTaken(documentType: String) {
        send(Event.expirationActionTaken, parameters: [
            "document_type": documentType
        ])
    }

    static func trackReminderScheduled(documentType: String) {
        send(Event.reminderScheduled, parameters: [
            "document_type": documentType
        ])
    }

    static func trackReminderOpened(documentType: String) {
        send(Event.reminderOpened, parameters: [
            "document_type": documentType
        ])
    }

    static func trackReminderActedOn(documentType: String) {
        send(Event.reminderActedOn, parameters: [
            "document_type": documentType
        ])
    }

    static func trackAppealInitiated(stateCode: String) {
        send(Event.appealInitiated, parameters: [
            "state_code": stateCode
        ])
    }

    static func trackAppealEdited(stateCode: String) {
        send(Event.appealEdited, parameters: [
            "state_code": stateCode
        ])
    }

    static func trackAppealExported(stateCode: String) {
        send(Event.appealExported, parameters: [
            "state_code": stateCode
        ])
    }

    // MARK: - Internal

    private static func send(_ event: String, parameters: [String: Any]) {
        // Guardrail: enforce allowlisted analytics keys only.
        let scrubbed = parameters.filter { allowedParameterKeys.contains($0.key) }

        #if canImport(FirebaseAnalytics)
        #if canImport(FirebaseCore)
        guard FirebaseApp.app() != nil else {
            return
        }
        #endif
        Analytics.logEvent(event, parameters: scrubbed.isEmpty ? nil : scrubbed)
        #else
        _ = event
        _ = scrubbed
        #endif
    }
}
