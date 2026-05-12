import XCTest
@testable import Civica

// Unit tests for DocumentReminderScheduler. The system layer
// (RecertNotificationService) talks to UNUserNotificationCenter and
// is not tested here; tests verify the pure planning function.

final class DocumentReminderSchedulerTests: XCTestCase {

    private let calendar = Calendar(identifier: .gregorian)

    private let now: Date = {
        var components = DateComponents()
        components.year = 2026
        components.month = 5
        components.day = 11
        components.timeZone = TimeZone(identifier: "UTC")
        return Calendar(identifier: .gregorian).date(from: components)!
    }()

    private func days(_ n: Int, from date: Date) -> Date {
        calendar.date(byAdding: .day, value: n, to: date)!
    }

    // MARK: - Identifier shape

    func test_identifier_isPrefixedAndComposesActionFields() {
        let action = DocumentExpirationAction(
            document: .proofOfIncome,
            action: .replace,
            dueBy: now,
            reason: .staleAtRecert
        )

        let id = DocumentReminderScheduler.identifier(for: action)
        XCTAssertTrue(id.hasPrefix(DocumentReminderScheduler.identifierPrefix))
        XCTAssertTrue(id.contains("proof_of_income"))
        XCTAssertTrue(id.contains("replace"))
        XCTAssertTrue(id.contains("staleAtRecert"))
    }

    // MARK: - Planning produces one notification per action

    func test_plan_producesOnePlannedNotificationPerAction() {
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

        XCTAssertEqual(planned.count, 2)
        XCTAssertEqual(Set(planned.map(\.documentTypeRaw)), ["proof_of_income", "utility_bill"])
    }

    // MARK: - Idempotency

    func test_plan_isIdempotent_acrossRuns() {
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

        XCTAssertEqual(first, second)
    }

    // MARK: - Fire time is 9am local

    func test_fireDate_isNineAMLocal_onDueByDate() {
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
        XCTAssertEqual(components.hour, 9)
        XCTAssertEqual(components.minute, 0)
    }

    // MARK: - Empty forecast

    func test_plan_emptyForecast_returnsEmptyArray() {
        let forecast = DocumentExpirationForecast(
            upcomingActions: [],
            nextRecertDate: days(60, from: now),
            documentsReadyForRecert: 9,
            documentsNeedingReplacement: 0,
            stateCode: "MA"
        )

        XCTAssertEqual(
            DocumentReminderScheduler.plan(forecast: forecast, language: .english),
            []
        )
    }

    // MARK: - Localization

    func test_plan_pickingSpanish_returnsSpanishCopy() {
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

        XCTAssertNotEqual(englishPlanned[0].title, spanishPlanned[0].title)
        XCTAssertNotEqual(englishPlanned[0].body, spanishPlanned[0].body)
        XCTAssertTrue(
            spanishPlanned[0].body.contains("recertificación"),
            "Spanish body should contain Spanish 'recertificación'"
        )
    }
}
