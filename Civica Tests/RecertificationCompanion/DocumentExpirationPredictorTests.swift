import Foundation
import Testing
@testable import Civica

// Pure date math — no simulator, no I/O beyond the bundled fixture
// loaded by DocumentExpirationRules. Fixed `now` so tests are
// deterministic across CI runs.

struct DocumentExpirationPredictorTests {

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

    @Test func missingProofOfIncome_inMA_emitsReplaceAction() {
        let recert = days(60, from: now)
        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: [:],
            stateCode: "MA"
        ))

        let incomeActions = forecast.upcomingActions.filter { $0.document == .proofOfIncome }
        #expect(incomeActions.count == 1)
        #expect(incomeActions.first?.reason == .missing)
        #expect(incomeActions.first?.action == .replace)
    }

    @Test func proofOfIncomeCaptured45DaysAgo_inMA_marksStale() {
        let recert = days(60, from: now)
        let capturedAt = days(-45, from: now)

        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: [.proofOfIncome: capturedAt],
            stateCode: "MA"
        ))

        let incomeActions = forecast.upcomingActions.filter { $0.document == .proofOfIncome }
        #expect(incomeActions.count == 1)
        #expect(incomeActions.first?.reason == .staleAtRecert)
    }

    @Test func recentlyCapturedLease_inMA_isReady() {
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
        #expect(leaseActions.isEmpty)
        #expect(forecast.documentsReadyForRecert > 0)
    }

    @Test func proofOfIncomeWithBiweeklyFrequency_capturedRecently_butCadenceDue() {
        // Within max-age but past biweekly cadence.
        let recert = days(20, from: now)
        let capturedAt = days(-20, from: now)

        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: [.proofOfIncome: capturedAt],
            stateCode: "MA"
        ))

        let incomeActions = forecast.upcomingActions.filter { $0.document == .proofOfIncome }
        #expect(incomeActions.count == 1)
        #expect(incomeActions.first?.reason == .cadenceDue)
    }

    @Test func unknownState_returnsForecastFlaggedAsUnconfigured() {
        let recert = days(60, from: now)
        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: [:],
            stateCode: "ZZ"
        ))

        #expect(forecast.upcomingActions.isEmpty)
        #expect(forecast.documentsReadyForRecert == 0)
        #expect(forecast.isStateUnconfigured)
    }

    @Test func actionsAreSortedByDueByAscending() {
        let recert = days(60, from: now)
        let vault: [SNAPDocumentType: Date] = [
            .proofOfIncome: days(-200, from: now),
            .utilityBill: days(-200, from: now),
            .rentOrHousingCostProof: days(-400, from: now)
        ]

        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: vault,
            stateCode: "MA"
        ))

        #expect(forecast.upcomingActions.count > 1)
        let dueDates = forecast.upcomingActions.map { $0.dueBy }
        #expect(dueDates == dueDates.sorted())
    }

    @Test func recertTomorrow_dueByCappedAtRecertDate() {
        let recert = days(1, from: now)
        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: [:],
            stateCode: "MA"
        ))

        for action in forecast.upcomingActions {
            #expect(action.dueBy <= recert)
        }
    }

    @Test func capturedFiveYearsAgo_isStaleEvenForLongLivedDocs() {
        // photo_id has maxAge 1825 (5 yrs). 6 yrs old → stale.
        let recert = days(60, from: now)
        let capturedAt = days(-365 * 6, from: now)

        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: now,
            nextRecertDate: recert,
            vault: [.photoID: capturedAt],
            stateCode: "MA"
        ))

        let idActions = forecast.upcomingActions.filter { $0.document == .photoID }
        #expect(idActions.first?.reason == .staleAtRecert)
    }
}
