import Foundation
import Testing
@testable import Civica

// Pure-math tests for the "Will it last?" projection on the EBT
// Balance dashboard. The projection helper turns a balance + recent
// purchase history into a concrete zero-date — and flags when that
// zero-date falls before the next scheduled deposit.
//
// Tests inject a fixed `now` so the 30-day trailing window is
// deterministic regardless of when CI runs.

struct EBTBalanceProjectionTests {

    /// Anchor "now" used by every test. Fixed so window math doesn't
    /// drift between CI runs. Wednesday, May 20 2026, noon UTC.
    private static let now: Date = {
        var components = DateComponents()
        components.timeZone = TimeZone(identifier: "UTC")
        components.year = 2026
        components.month = 5
        components.day = 20
        components.hour = 12
        return Calendar(identifier: .gregorian).date(from: components) ?? Date()
    }()

    /// Build a purchase transaction `daysAgo` before the test anchor.
    private static func purchase(_ amount: Double, daysAgo: Int) -> EBTTransaction {
        let date = Calendar.current.date(byAdding: .day, value: -daysAgo, to: now) ?? now
        return EBTTransaction(
            id: UUID(),
            merchant: "Test Grocer",
            amount: Decimal(-amount),
            date: date,
            category: .groceries
        )
    }

    /// Build a deposit transaction `daysAgo` before the test anchor.
    /// Deposits should be ignored by the spend-rate calculation.
    private static func deposit(_ amount: Double, daysAgo: Int) -> EBTTransaction {
        let date = Calendar.current.date(byAdding: .day, value: -daysAgo, to: now) ?? now
        return EBTTransaction(
            id: UUID(),
            merchant: "CalFresh deposit",
            amount: Decimal(amount),
            date: date,
            category: .deposit
        )
    }

    private static func deposit(amount: Double, daysFromNow: Int) -> EBTDeposit {
        let date = Calendar.current.date(byAdding: .day, value: daysFromNow, to: now) ?? now
        return EBTDeposit(amount: Decimal(amount), expectedDate: date)
    }

    // MARK: - Insufficient-signal cases (return nil)

    @Test
    func emptyTransactionsReturnsNil() {
        let result = EBTBalanceInsights.projection(
            balance: 100,
            transactions: [],
            nextDeposit: nil,
            now: Self.now
        )
        #expect(result == nil)
    }

    @Test
    func belowMinPurchaseCountReturnsNil() {
        let transactions = [
            Self.purchase(20, daysAgo: 1),
            Self.purchase(15, daysAgo: 3),
        ]
        let result = EBTBalanceInsights.projection(
            balance: 100,
            transactions: transactions,
            nextDeposit: nil,
            now: Self.now
        )
        #expect(result == nil)
    }

    @Test
    func zeroBalanceReturnsNil() {
        let transactions = (1...5).map { Self.purchase(10, daysAgo: $0) }
        let result = EBTBalanceInsights.projection(
            balance: 0,
            transactions: transactions,
            nextDeposit: nil,
            now: Self.now
        )
        #expect(result == nil)
    }

    @Test
    func negativeBalanceReturnsNil() {
        let transactions = (1...5).map { Self.purchase(10, daysAgo: $0) }
        let result = EBTBalanceInsights.projection(
            balance: -5,
            transactions: transactions,
            nextDeposit: nil,
            now: Self.now
        )
        #expect(result == nil)
    }

    @Test
    func depositsAloneDontCount() {
        // Five deposits, zero purchases — there's no spending signal
        // to derive a rate from, so the projection should be nil.
        let transactions = (1...5).map { Self.deposit(50, daysAgo: $0) }
        let result = EBTBalanceInsights.projection(
            balance: 200,
            transactions: transactions,
            nextDeposit: nil,
            now: Self.now
        )
        #expect(result == nil)
    }

    @Test
    func purchasesOutsideWindowDontCount() {
        // Five purchases, but all >30 days ago. Outside the window
        // means nothing to project from.
        let transactions = (1...5).map { Self.purchase(10, daysAgo: 60 + $0) }
        let result = EBTBalanceInsights.projection(
            balance: 100,
            transactions: transactions,
            nextDeposit: nil,
            now: Self.now
        )
        #expect(result == nil)
    }

    // MARK: - Healthy projection

    @Test
    func fivePurchasesProducesReasonableDaysRemaining() {
        // Five $14 purchases over the last 14 days = $70 total spend
        // / 30-day window = $2.33/day. $100 / $2.33 ≈ 42 days remaining.
        let transactions = (1...5).map { Self.purchase(14, daysAgo: $0 * 2 + 1) }
        let result = EBTBalanceInsights.projection(
            balance: 100,
            transactions: transactions,
            nextDeposit: nil,
            now: Self.now
        )

        guard let projection = result else {
            Issue.record("Expected a projection, got nil")
            return
        }
        #expect(projection.dailySpendRate > 0)
        #expect(projection.daysRemaining > 20)
        #expect(projection.daysRemaining < 90)
        // No deposit on file → never flagged as tight.
        #expect(projection.isTightUntilDeposit == false)
    }

    // MARK: - Good case (zero-date past next deposit)

    @Test
    func goodCaseZeroDateAfterNextDeposit() {
        // High balance + low burn = runway extends well past the
        // upcoming deposit. isTightUntilDeposit should be false.
        let transactions = (1...5).map { Self.purchase(5, daysAgo: $0 * 2) }
        let upcomingDeposit = Self.deposit(amount: 200, daysFromNow: 4)
        let result = EBTBalanceInsights.projection(
            balance: 200,
            transactions: transactions,
            nextDeposit: upcomingDeposit,
            now: Self.now
        )

        guard let projection = result else {
            Issue.record("Expected a projection, got nil")
            return
        }
        #expect(projection.isTightUntilDeposit == false)
        // Zero-date should be at or past the next deposit.
        let depositStart = Calendar.current.startOfDay(for: upcomingDeposit.expectedDate)
        #expect(projection.projectedZeroDate >= depositStart)
    }

    // MARK: - Tight case (zero-date before next deposit)

    @Test
    func tightCaseZeroDateBeforeNextDeposit() {
        // Low balance + heavy burn = runway runs out before the next
        // deposit lands. isTightUntilDeposit should be true.
        // Ten $30 purchases in 30 days = $300 / 30 = $10/day. $20
        // balance → 2 days remaining. Deposit is 10 days out.
        let transactions = (1...10).map { Self.purchase(30, daysAgo: $0 * 2) }
        let upcomingDeposit = Self.deposit(amount: 250, daysFromNow: 10)
        let result = EBTBalanceInsights.projection(
            balance: 20,
            transactions: transactions,
            nextDeposit: upcomingDeposit,
            now: Self.now
        )

        guard let projection = result else {
            Issue.record("Expected a projection, got nil")
            return
        }
        #expect(projection.isTightUntilDeposit == true)
        let depositStart = Calendar.current.startOfDay(for: upcomingDeposit.expectedDate)
        #expect(projection.projectedZeroDate < depositStart)
    }

    // MARK: - Sanity cap

    @Test
    func daysRemainingCapsAt365() {
        // Big balance, tiny burn — without the cap this would compute
        // to thousands of days. Three tiny purchases barely move the
        // 30-day average, but enough to cross the min-count gate.
        let transactions = (1...3).map { Self.purchase(0.10, daysAgo: $0) }
        let result = EBTBalanceInsights.projection(
            balance: 10_000,
            transactions: transactions,
            nextDeposit: nil,
            now: Self.now
        )

        guard let projection = result else {
            Issue.record("Expected a projection, got nil")
            return
        }
        #expect(projection.daysRemaining == 365)
    }

    // MARK: - Deposit-on-file but projection covers it

    @Test
    func depositTimingDoesNotFlagWhenRunwayCovers() {
        // Five $4 purchases / 30-day window ≈ $0.67/day. $200 balance
        // → ~300 days runway. Deposit 5 days out — easily covered.
        let transactions = (1...5).map { Self.purchase(4, daysAgo: $0) }
        let upcomingDeposit = Self.deposit(amount: 200, daysFromNow: 5)
        let result = EBTBalanceInsights.projection(
            balance: 200,
            transactions: transactions,
            nextDeposit: upcomingDeposit,
            now: Self.now
        )

        guard let projection = result else {
            Issue.record("Expected a projection, got nil")
            return
        }
        #expect(projection.isTightUntilDeposit == false)
    }

    // MARK: - Mixed deposits + purchases inside window

    @Test
    func depositsInsideWindowAreIgnored() {
        // Three small purchases plus a fat deposit, all within the
        // window. The projection rate must come only from the
        // purchases — a deposit shouldn't inflate or deflate it.
        let transactions: [EBTTransaction] = [
            Self.purchase(10, daysAgo: 2),
            Self.purchase(10, daysAgo: 6),
            Self.purchase(10, daysAgo: 12),
            Self.deposit(500, daysAgo: 9),
        ]
        let result = EBTBalanceInsights.projection(
            balance: 60,
            transactions: transactions,
            nextDeposit: nil,
            now: Self.now
        )

        guard let projection = result else {
            Issue.record("Expected a projection, got nil")
            return
        }
        // $30 spent over 30-day window = $1/day. $60 / $1/day = 60 days.
        #expect(projection.daysRemaining == 60)
    }
}
