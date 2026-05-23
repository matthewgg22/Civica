import Foundation
import Testing
@testable import Civica

// Phase 2 / Lane G — EBTAnomalyDetector pure-function tests.
//
// Coverage per spec:
//   1. Velocity burst fires at >$50/2min
//   2. Transaction flood fires at >5 txns/10min
//   3. Cross-state merchant matches OXXO, H-E-B TX, WALMART FL
//   4. Payday suppression (day 3 of month): high→medium, medium→low
//   5. Travel-mute respected: cross-state txn during mute → no alert
//   6. Empty input → empty output
//   7. Single txn → no alert
//
// EBTAnomalyDetector has no nonisolated(unsafe) static state (the
// NSRegularExpression is initialized once via `try!` at declaration
// time, which is safe). No @Suite(.serialized) required.

@Suite("EBTAnomalyDetector")
struct EBTAnomalyDetectorTests {

    // MARK: - Helpers

    /// Build a purchase (negative amount) at a given date offset in seconds.
    private func purchase(
        merchant: String = "WALMART",
        amountCents: Int = 1000,
        offsetSeconds: TimeInterval = 0,
        anchor: Date = Date()
    ) -> EBTTransaction {
        EBTTransaction(
            id: UUID(),
            merchant: merchant,
            amount: -Decimal(amountCents) / 100,
            date: anchor.addingTimeInterval(offsetSeconds),
            category: .groceries
        )
    }

    /// A deposit (positive amount) — should be ignored by velocity/flood checks.
    private func deposit(amountCents: Int = 23200, anchor: Date = Date()) -> EBTTransaction {
        EBTTransaction(
            id: UUID(),
            merchant: "CALFRESH DEPOSIT",
            amount: Decimal(amountCents) / 100,
            date: anchor,
            category: .deposit
        )
    }

    /// Build a "now" date that is definitely NOT in the payday window (day 15).
    private func midMonthDate() -> Date {
        var comps = Calendar.current.dateComponents([.year, .month], from: Date())
        comps.day = 15
        comps.hour = 12
        return Calendar.current.date(from: comps) ?? Date()
    }

    /// Build a "now" date in the payday window (day 3).
    private func paydayDate() -> Date {
        var comps = Calendar.current.dateComponents([.year, .month], from: Date())
        comps.day = 3
        comps.hour = 10
        return Calendar.current.date(from: comps) ?? Date()
    }

    // MARK: - 6 & 7: Empty / single

    @Test("Empty transactions returns no alerts")
    func emptyInput() {
        let result = EBTAnomalyDetector.score(transactions: [], travelMuteUntil: nil)
        #expect(result.isEmpty)
    }

    @Test("Single transaction returns no alerts")
    func singleTransaction() {
        let now = midMonthDate()
        let txns = [purchase(merchant: "SAFEWAY", amountCents: 3000, anchor: now)]
        let result = EBTAnomalyDetector.score(transactions: txns, travelMuteUntil: nil, now: now)
        #expect(result.isEmpty)
    }

    // MARK: - 1: Velocity burst

    @Test("Velocity burst fires when >$50 in 2 minutes")
    func velocityBurstFires() {
        let now = midMonthDate()
        let txns = [
            purchase(merchant: "SAFEWAY", amountCents: 3000, offsetSeconds: 0, anchor: now),
            purchase(merchant: "TARGET",  amountCents: 2500, offsetSeconds: 30, anchor: now),
            purchase(merchant: "CVS",     amountCents: 1000, offsetSeconds: 60, anchor: now),
            // Total: $65 in 1 minute → exceeds $50 threshold
        ]
        let result = EBTAnomalyDetector.score(transactions: txns, travelMuteUntil: nil, now: now)
        let burst = result.first { $0.kind == .velocityBurst }
        #expect(burst != nil)
        #expect(burst?.severity == .high)
    }

    @Test("Velocity burst does NOT fire when $50 or less in 2 minutes")
    func velocityBurstBelow() {
        let now = midMonthDate()
        let txns = [
            purchase(merchant: "SAFEWAY", amountCents: 2500, offsetSeconds: 0, anchor: now),
            purchase(merchant: "TARGET",  amountCents: 2500, offsetSeconds: 60, anchor: now),
            // Total: exactly $50 — NOT >$50
        ]
        let result = EBTAnomalyDetector.score(transactions: txns, travelMuteUntil: nil, now: now)
        #expect(result.filter { $0.kind == .velocityBurst }.isEmpty)
    }

    @Test("Velocity burst ignores deposits")
    func velocityBurstIgnoresDeposits() {
        let now = midMonthDate()
        // A large deposit should not trigger velocity burst.
        let txns = [deposit(amountCents: 23200, anchor: now)]
        let result = EBTAnomalyDetector.score(transactions: txns, travelMuteUntil: nil, now: now)
        #expect(result.filter { $0.kind == .velocityBurst }.isEmpty)
    }

    // MARK: - 2: Transaction flood

    @Test("Transaction flood fires when >5 txns in 10 minutes")
    func transactionFloodFires() {
        let now = midMonthDate()
        let txns = (0..<6).map { i in
            purchase(
                merchant: "STORE \(i)",
                amountCents: 500,
                offsetSeconds: TimeInterval(i * 90), // every 90s → 6 txns in 7.5min
                anchor: now
            )
        }
        let result = EBTAnomalyDetector.score(transactions: txns, travelMuteUntil: nil, now: now)
        let flood = result.first { $0.kind == .transactionFlood }
        #expect(flood != nil)
        #expect(flood?.severity == .medium)
    }

    @Test("Transaction flood does NOT fire for exactly 5 txns in 10 minutes")
    func transactionFloodAtThreshold() {
        let now = midMonthDate()
        let txns = (0..<5).map { i in
            purchase(
                merchant: "STORE \(i)",
                amountCents: 500,
                offsetSeconds: TimeInterval(i * 60),
                anchor: now
            )
        }
        let result = EBTAnomalyDetector.score(transactions: txns, travelMuteUntil: nil, now: now)
        #expect(result.filter { $0.kind == .transactionFlood }.isEmpty)
    }

    // MARK: - 3: Cross-state

    @Test("Cross-state fires for OXXO merchant")
    func crossStateOXXO() {
        let now = midMonthDate()
        let txns = [purchase(merchant: "OXXO #3421", amountCents: 800, anchor: now)]
        let result = EBTAnomalyDetector.score(transactions: txns, travelMuteUntil: nil, now: now)
        let cs = result.first { $0.kind == .crossStateUse }
        #expect(cs != nil)
        #expect(cs?.severity == .high)
    }

    @Test("Cross-state fires for H-E-B TX merchant")
    func crossStateHEB() {
        let now = midMonthDate()
        let txns = [purchase(merchant: "H-E-B #1234 TX", amountCents: 4500, anchor: now)]
        let result = EBTAnomalyDetector.score(transactions: txns, travelMuteUntil: nil, now: now)
        #expect(result.contains { $0.kind == .crossStateUse })
    }

    @Test("Cross-state fires for WALMART FL merchant")
    func crossStateWalmartFL() {
        let now = midMonthDate()
        let txns = [purchase(merchant: "WALMART SUPERCENTER FL", amountCents: 6000, anchor: now)]
        let result = EBTAnomalyDetector.score(transactions: txns, travelMuteUntil: nil, now: now)
        #expect(result.contains { $0.kind == .crossStateUse })
    }

    @Test("CA merchant (SAFEWAY) does NOT fire cross-state")
    func noCrossStateCA() {
        let now = midMonthDate()
        let txns = [purchase(merchant: "SAFEWAY #0042", amountCents: 3200, anchor: now)]
        let result = EBTAnomalyDetector.score(transactions: txns, travelMuteUntil: nil, now: now)
        #expect(result.filter { $0.kind == .crossStateUse }.isEmpty)
    }

    // MARK: - 4: Payday suppression

    @Test("Payday suppression: velocity burst downgraded from high to medium on day 3")
    func paydaySuppressesVelocityBurst() {
        let now = paydayDate()
        let txns = [
            purchase(merchant: "RALPHS", amountCents: 3000, offsetSeconds: 0, anchor: now),
            purchase(merchant: "TARGET", amountCents: 2500, offsetSeconds: 30, anchor: now),
            purchase(merchant: "CVS",    amountCents: 1000, offsetSeconds: 60, anchor: now),
        ]
        let result = EBTAnomalyDetector.score(transactions: txns, travelMuteUntil: nil, now: now)
        let burst = result.first { $0.kind == .velocityBurst }
        #expect(burst != nil)
        #expect(burst?.severity == .medium, "Expected medium (downgraded) on payday, got \(String(describing: burst?.severity))")
    }

    @Test("Payday suppression: transaction flood downgraded from medium to low on day 3")
    func paydaySuppressesFlood() {
        let now = paydayDate()
        let txns = (0..<6).map { i in
            purchase(
                merchant: "STORE \(i)",
                amountCents: 500,
                offsetSeconds: TimeInterval(i * 90),
                anchor: now
            )
        }
        let result = EBTAnomalyDetector.score(transactions: txns, travelMuteUntil: nil, now: now)
        let flood = result.first { $0.kind == .transactionFlood }
        #expect(flood != nil)
        #expect(flood?.severity == .low, "Expected low (downgraded) on payday, got \(String(describing: flood?.severity))")
    }

    @Test("Payday suppression: cross-state alert is NOT suppressed (stays high)")
    func paydayDoesNotSuppressCrossState() {
        let now = paydayDate()
        let txns = [purchase(merchant: "OXXO STORE #5", amountCents: 1500, anchor: now)]
        let result = EBTAnomalyDetector.score(transactions: txns, travelMuteUntil: nil, now: now)
        let cs = result.first { $0.kind == .crossStateUse }
        // Cross-state uses fixed .high severity with no payday downgrade.
        #expect(cs?.severity == .high)
    }

    // MARK: - 5: Travel mute

    @Test("Travel mute suppresses cross-state alert when mute is active")
    func travelMuteSuppressesCrossState() {
        let now = midMonthDate()
        let muteUntil = now.addingTimeInterval(30 * 86_400) // 30 days in future
        let txns = [purchase(merchant: "OXXO STORE #5", amountCents: 1500, anchor: now)]
        let result = EBTAnomalyDetector.score(
            transactions: txns,
            travelMuteUntil: muteUntil,
            now: now
        )
        #expect(result.filter { $0.kind == .crossStateUse }.isEmpty)
    }

    @Test("Expired travel mute does NOT suppress cross-state alert")
    func expiredTravelMuteDoesNotSuppress() {
        let now = midMonthDate()
        let muteUntil = now.addingTimeInterval(-1) // one second in the past
        let txns = [purchase(merchant: "H-E-B TX", amountCents: 2000, anchor: now)]
        let result = EBTAnomalyDetector.score(
            transactions: txns,
            travelMuteUntil: muteUntil,
            now: now
        )
        #expect(result.contains { $0.kind == .crossStateUse })
    }

    // MARK: - Sort order

    @Test("Alerts are returned sorted by severity descending")
    func sortedBySeverityDescending() {
        let now = midMonthDate()
        // Trigger flood (medium) + cross-state (high) simultaneously.
        let floodTxns = (0..<6).map { i in
            purchase(merchant: "STORE \(i)", amountCents: 500,
                     offsetSeconds: TimeInterval(i * 90), anchor: now)
        }
        let crossStateTxn = purchase(merchant: "OXXO #9", amountCents: 1000,
                                     offsetSeconds: 1000, anchor: now)
        let result = EBTAnomalyDetector.score(
            transactions: floodTxns + [crossStateTxn],
            travelMuteUntil: nil,
            now: now
        )
        guard result.count >= 2 else {
            #expect(Bool(false), "Expected at least 2 alerts; got \(result.count)")
            return
        }
        // First alert must be >= second.
        #expect(result[0].severity >= result[1].severity)
    }
}
