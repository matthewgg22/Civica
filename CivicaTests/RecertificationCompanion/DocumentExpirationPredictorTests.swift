import XCTest
@testable import Civica

// Unit tests for DocumentExpirationPredictor. Pure date math — no
// simulator dependencies, no I/O beyond the bundled fixture (which
// XCTest loads via the host app target).
//
// All tests use a fixed `now` so they're deterministic across CI runs.

final class DocumentExpirationPredictorTests: XCTestCase {

    private let calendar = Calendar(identifier: .gregorian)

    /// 2026-05-11 — same date as today's session, helpful when
    /// reading failures against the rules file.
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

    // MARK: - Missing document

    func test_missingProofOfIncome_inMA_emitsReplaceAction() {
        let recert = days(60, from: now)
        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: [:],
            stateCode: "MA"
        ))

        let incomeActions = forecast.upcomingActions.filter { $0.document == .proofOfIncome }
        XCTAssertEqual(incomeActions.count, 1)
        XCTAssertEqual(incomeActions.first?.reason, .missing)
        XCTAssertEqual(incomeActions.first?.action, .replace)
    }

    // MARK: - Stale at recert

    func test_proofOfIncomeCaptured45DaysAgo_inMA_marksStale() {
        // MA proof_of_income rule: maxAge 30 days at recert.
        // Captured 45 days ago, recert in 60 days → at recert the
        // document will be 105 days old, well over 30.
        let recert = days(60, from: now)
        let capturedAt = days(-45, from: now)

        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: [.proofOfIncome: capturedAt],
            stateCode: "MA"
        ))

        let incomeActions = forecast.upcomingActions.filter { $0.document == .proofOfIncome }
        XCTAssertEqual(incomeActions.count, 1)
        XCTAssertEqual(incomeActions.first?.reason, .staleAtRecert)
    }

    // MARK: - Fresh enough

    func test_recentlyCapturedLease_inMA_isReady() {
        // MA rent_or_housing_cost_proof rule: 365 days. Captured
        // today, recert 60 days out → easily fresh.
        let recert = days(60, from: now)
        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: [.rentOrHousingCostProof: now],
            stateCode: "MA"
        ))

        let leaseActions = forecast.upcomingActions.filter { $0.document == .rentOrHousingCostProof }
        XCTAssertTrue(leaseActions.isEmpty)
        XCTAssertGreaterThan(forecast.documentsReadyForRecert, 0)
    }

    // MARK: - Cadence-driven

    func test_proofOfIncomeWithBiweeklyFrequency_capturedRecently_butCadenceDue() {
        // MA pay stubs are biweekly. Captured 20 days ago — within
        // the 30-day max-age, so NOT stale-at-recert, but the
        // biweekly cadence flags this as due for a fresh capture.
        let recert = days(20, from: now)
        let capturedAt = days(-20, from: now)

        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: [.proofOfIncome: capturedAt],
            stateCode: "MA"
        ))

        let incomeActions = forecast.upcomingActions.filter { $0.document == .proofOfIncome }
        XCTAssertEqual(incomeActions.count, 1)
        XCTAssertEqual(incomeActions.first?.reason, .cadenceDue)
    }

    // MARK: - Unknown state

    func test_unknownState_returnsForecastFlaggedAsUnconfigured() {
        let recert = days(60, from: now)
        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: [:],
            stateCode: "ZZ"
        ))

        XCTAssertTrue(forecast.upcomingActions.isEmpty)
        XCTAssertEqual(forecast.documentsReadyForRecert, 0)
        XCTAssertTrue(forecast.isStateUnconfigured)
    }

    // MARK: - Sort order

    func test_actionsAreSortedByDueByAscending() {
        // Build a vault with several stale documents; the result
        // should be sorted ascending by dueBy.
        let recert = days(60, from: now)
        let vault: [SNAPDocumentType: Date] = [
            .proofOfIncome: days(-200, from: now),         // very stale
            .utilityBill: days(-200, from: now),           // very stale
            .rentOrHousingCostProof: days(-400, from: now) // stale (lease)
        ]

        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: vault,
            stateCode: "MA"
        ))

        XCTAssertGreaterThan(forecast.upcomingActions.count, 1)
        let dueDates = forecast.upcomingActions.map { $0.dueBy }
        XCTAssertEqual(dueDates, dueDates.sorted())
    }

    // MARK: - Recert in 1 day edge case

    func test_recertTomorrow_dueByCappedAtRecertDate() {
        let recert = days(1, from: now)
        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: [:],
            stateCode: "MA"
        ))

        for action in forecast.upcomingActions {
            XCTAssertLessThanOrEqual(action.dueBy, recert,
                "dueBy must never exceed the recert date")
        }
    }

    // MARK: - Capture older than 5 years

    func test_capturedFiveYearsAgo_isStaleEvenForLongLivedDocs() {
        // photo_id has maxAge 1825 days (5 years). Captured 6 years
        // ago should be flagged stale.
        let recert = days(60, from: now)
        let capturedAt = days(-365 * 6, from: now)

        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: [.photoID: capturedAt],
            stateCode: "MA"
        ))

        let idActions = forecast.upcomingActions.filter { $0.document == .photoID }
        XCTAssertEqual(idActions.first?.reason, .staleAtRecert)
    }
}
