import Foundation
import Testing
@testable import Civica

// The system layer (RecertNotificationService) talks to
// UNUserNotificationCenter and isn't covered here; tests verify the
// pure planning function only.

struct DocumentReminderSchedulerTests {

    private let calendar = Calendar(identifier: .gregorian)

    private var now: Date {
        var components = DateComponents()
        components.year = 2026
        components.month = 5
        components.day = 11
        components.timeZone = TimeZone(identifier: "UTC")
        return Calendar(identifier: .gregorian).date(from: components)!
    }

    private func days(_ n: Int, from date: Date) -> Date {
        calendar.date(byAdding: .day, value: n, to: date)!
    }

    @Test func identifier_isPrefixedAndComposesActionFields() {
        let action = DocumentExpirationAction(
            document: .proofOfIncome,
            action: .replace,
            dueBy: now,
            reason: .staleAtRecert
        )

        let id = DocumentReminderScheduler.identifier(for: action)
        #expect(id.hasPrefix(DocumentReminderScheduler.identifierPrefix))
        #expect(id.contains("proof_of_income"))
        #expect(id.contains("replace"))
        #expect(id.contains("staleAtRecert"))
    }

    @Test func plan_producesOnePlannedNotificationPerAction() {
        let actions: [DocumentExpirationAction] = [
            DocumentExpirationAction(
                document: .proofOfIncome,
                action: .replace,
                dueBy: days(7, from: now),
                reason: .staleAtRecert
            ),
            DocumentExpirationAction(
                document: .utilityBill,
                action: .replace,
                dueBy: days(14, from: now),
                reason: .missing
            )
        ]
        let forecast = DocumentExpirationForecast(
            upcomingActions: actions,
            nextRecertDate: days(60, from: now),
            documentsReadyForRecert: 3,
            documentsNeedingReplacement: 2,
            stateCode: "MA"
        )

        let planned = DocumentReminderScheduler.plan(forecast: forecast, language: .english)

        #expect(planned.count == 2)
        #expect(Set(planned.map(\.documentTypeRaw)) == ["proof_of_income", "utility_bill"])
    }

    @Test func plan_isIdempotent_acrossRuns() {
        let actions: [DocumentExpirationAction] = [
            DocumentExpirationAction(
                document: .proofOfIncome,
                action: .replace,
                dueBy: days(7, from: now),
                reason: .staleAtRecert
            )
        ]
        let forecast = DocumentExpirationForecast(
            upcomingActions: actions,
            nextRecertDate: days(60, from: now),
            documentsReadyForRecert: 0,
            documentsNeedingReplacement: 1,
            stateCode: "MA"
        )

        let first = DocumentReminderScheduler.plan(forecast: forecast, language: .english)
        let second = DocumentReminderScheduler.plan(forecast: forecast, language: .english)

        #expect(first == second)
    }

    @Test func fireDate_isNineAMLocal_onDueByDate() {
        let dueBy = days(7, from: now)
        let action = DocumentExpirationAction(
            document: .proofOfIncome,
            action: .replace,
            dueBy: dueBy,
            reason: .staleAtRecert
        )
        let forecast = DocumentExpirationForecast(
            upcomingActions: [action],
            nextRecertDate: days(60, from: now),
            documentsReadyForRecert: 0,
            documentsNeedingReplacement: 1,
            stateCode: "MA"
        )

        let planned = DocumentReminderScheduler.plan(
            forecast: forecast,
            language: .english,
            calendar: calendar
        )

        let components = calendar.dateComponents([.hour, .minute], from: planned[0].fireDate)
        #expect(components.hour == 9)
        #expect(components.minute == 0)
    }

    @Test func plan_emptyForecast_returnsEmptyArray() {
        let forecast = DocumentExpirationForecast(
            upcomingActions: [],
            nextRecertDate: days(60, from: now),
            documentsReadyForRecert: 9,
            documentsNeedingReplacement: 0,
            stateCode: "MA"
        )

        #expect(DocumentReminderScheduler.plan(forecast: forecast, language: .english) == [])
    }

    @Test func plan_pickingSpanish_returnsSpanishCopy() {
        let action = DocumentExpirationAction(
            document: .proofOfIncome,
            action: .replace,
            dueBy: days(7, from: now),
            reason: .staleAtRecert
        )
        let forecast = DocumentExpirationForecast(
            upcomingActions: [action],
            nextRecertDate: days(60, from: now),
            documentsReadyForRecert: 0,
            documentsNeedingReplacement: 1,
            stateCode: "MA"
        )

        let englishPlanned = DocumentReminderScheduler.plan(forecast: forecast, language: .english)
        let spanishPlanned = DocumentReminderScheduler.plan(forecast: forecast, language: .spanish)

        #expect(englishPlanned[0].title != spanishPlanned[0].title)
        #expect(englishPlanned[0].body != spanishPlanned[0].body)
        #expect(spanishPlanned[0].body.contains("recertificación"))
    }
}
