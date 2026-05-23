import Foundation

// Derived spending math for the Check EBT Balance dashboard. Pure
// computation over an EBTAccount — no state, no I/O. Drives the
// spending-insights card and the transaction detail sheet's
// running-balance line.
//
// Demo scope: the projection is a simple average-daily-spend estimate
// over the fixture's transaction window. A real product would lean on
// a longer history and the household's deposit cadence.

struct EBTBalanceInsights {
    let account: EBTAccount

    /// Threshold below which the dashboard surfaces a low-balance
    /// banner.
    static let lowBalanceThreshold: Decimal = 20

    private var purchases: [EBTTransaction] {
        account.transactions.filter { !$0.isDeposit }
    }

    /// True when the food balance has dropped into low-balance
    /// territory.
    var isLowBalance: Bool {
        account.foodBalance < Self.lowBalanceThreshold
    }

    /// Total spent on purchases dated within the current calendar
    /// month.
    var spentThisMonth: Decimal {
        let calendar = Calendar.current
        let now = Date()
        return purchases
            .filter { calendar.isDate($0.date, equalTo: now, toGranularity: .month) }
            .reduce(Decimal(0)) { $0 + abs($1.amount) }
    }

    /// Fraction of the estimated starting balance spent so far this month.
    /// Drives the hero card velocity bar. Approximates the starting balance
    /// as (current balance + spent this month); returns 0 when there's been
    /// no spend yet (avoids division-by-zero on a fresh deposit day).
    var spentPercent: Double {
        let spent   = (spentThisMonth as NSDecimalNumber).doubleValue
        let balance = (account.foodBalance as NSDecimalNumber).doubleValue
        let total   = spent + balance
        guard total > 0 else { return 0 }
        return min(1.0, spent / total)
    }

    /// Estimated date the balance runs out at the current average
    /// daily spend. nil when there isn't enough history to project.
    /// Math runs in Double — the projection is an estimate, so Decimal
    /// exactness buys nothing and the bridging is fiddly.
    var projectedRunOutDate: Date? {
        let calendar = Calendar.current
        guard let oldest = purchases.map(\.date).min() else { return nil }
        let spanDays = max(calendar.dateComponents([.day], from: oldest, to: Date()).day ?? 1, 1)
        let totalSpent = purchases.reduce(0.0) { $0 + abs(($1.amount as NSDecimalNumber).doubleValue) }
        guard totalSpent > 0 else { return nil }
        let avgDaily = totalSpent / Double(spanDays)
        guard avgDaily > 0 else { return nil }
        let balance = (account.foodBalance as NSDecimalNumber).doubleValue
        let daysLeft = Int((balance / avgDaily).rounded())
        return calendar.date(byAdding: .day, value: daysLeft, to: Date())
    }

    /// Date the current balance would be expunged if the card goes
    /// completely unused. Federal SNAP rule: an EBT account with no
    /// activity for 274 days is aged off. Counted from the most recent
    /// transaction (or last sync if there's no history).
    var benefitsGoodThrough: Date {
        let lastActivity = account.transactions.map(\.date).max() ?? account.lastUpdated
        return Calendar.current.date(byAdding: .day, value: 274, to: lastActivity) ?? lastActivity
    }

    /// The balance immediately after the transaction at `index` posted
    /// (transactions are newest-first, so this subtracts every newer
    /// transaction from the current balance).
    func runningBalanceAfter(index: Int) -> Decimal {
        let newer = account.transactions.prefix(index)
        let sumNewer = newer.reduce(Decimal(0)) { $0 + $1.amount }
        return account.foodBalance - sumNewer
    }
}

// MARK: - "Will it last?" projection
//
// Turns the household's balance + recent spend rate into a concrete
// "balance lasts through <date>" story for the dashboard projection
// card. Distinct from `projectedRunOutDate` above — that helper is
// lifetime-averaged from the oldest known purchase, this one uses a
// fixed 30-day trailing window and exposes whether the projected
// zero-date falls before the next scheduled deposit.

/// Concrete "will it last?" projection for the EBT balance dashboard.
/// All fields are non-nil because this struct is only ever produced
/// when there's enough signal — the producing function returns
/// `nil` when input data is insufficient.
struct EBTBalanceProjection: Equatable {
    /// Average dollars-per-day spent over the last 30 days of
    /// purchases (deposits excluded).
    let dailySpendRate: Double
    /// `floor(balance / dailySpendRate)`, capped at 365 for sanity.
    let daysRemaining: Int
    /// `now + daysRemaining`, normalized to start-of-day so date
    /// formatting reads cleanly.
    let projectedZeroDate: Date
    /// True when a next deposit is on file AND the projected zero
    /// date falls before that deposit — i.e. the household is on
    /// track to run out before the next benefit lands.
    let isTightUntilDeposit: Bool
}

extension EBTBalanceInsights {
    /// 30-day window used for the projection's spend rate. Long
    /// enough to smooth out a single big grocery run; short enough
    /// to reflect a real change in spending habits.
    static let projectionWindowDays: Int = 30

    /// Minimum number of purchase rows inside the window required to
    /// project anything. Fewer than this and we silently render no
    /// card — a projection from one or two purchases would be noise.
    static let projectionMinPurchases: Int = 3

    /// Sanity cap on `daysRemaining`. A fresh deposit on a card the
    /// household barely uses can imply hundreds of days of runway;
    /// past about a year, the number stops being informational.
    static let projectionMaxDays: Int = 365

    /// Compute a "will it last?" projection for an EBT account.
    ///
    /// - Parameters:
    ///   - balance: current food balance, in dollars.
    ///   - transactions: full transaction history. Deposits are
    ///     filtered out internally; only purchases in the last 30
    ///     days contribute to the spend rate.
    ///   - nextDeposit: the next scheduled deposit, when known.
    ///     Drives `isTightUntilDeposit`.
    ///   - now: current time. Defaults to `Date()`; tests inject a
    ///     fixed instant so window math is deterministic.
    /// - Returns: a projection, or `nil` when there isn't enough
    ///   signal (balance ≤ 0, fewer than 3 purchases in the window,
    ///   or computed spend rate ≤ 0).
    static func projection(
        balance: Double,
        transactions: [EBTTransaction],
        nextDeposit: EBTDeposit?,
        now: Date = Date()
    ) -> EBTBalanceProjection? {
        guard balance > 0 else { return nil }

        let calendar = Calendar.current
        guard let windowStart = calendar.date(
            byAdding: .day,
            value: -projectionWindowDays,
            to: now
        ) else { return nil }

        let recentPurchases = transactions.filter { txn in
            !txn.isDeposit && txn.date >= windowStart && txn.date <= now
        }
        guard recentPurchases.count >= projectionMinPurchases else { return nil }

        let totalSpent = recentPurchases.reduce(0.0) { sum, txn in
            sum + abs((txn.amount as NSDecimalNumber).doubleValue)
        }
        let dailySpendRate = totalSpent / Double(projectionWindowDays)
        guard dailySpendRate > 0 else { return nil }

        let rawDays = Int((balance / dailySpendRate).rounded(.down))
        let daysRemaining = min(max(rawDays, 0), projectionMaxDays)

        let today = calendar.startOfDay(for: now)
        guard let projectedZeroDate = calendar.date(
            byAdding: .day,
            value: daysRemaining,
            to: today
        ) else { return nil }

        let isTightUntilDeposit: Bool = {
            guard let deposit = nextDeposit else { return false }
            return projectedZeroDate < calendar.startOfDay(for: deposit.expectedDate)
        }()

        return EBTBalanceProjection(
            dailySpendRate: dailySpendRate,
            daysRemaining: daysRemaining,
            projectedZeroDate: projectedZeroDate,
            isTightUntilDeposit: isTightUntilDeposit
        )
    }

    /// Convenience: project from this insights instance's own account.
    var projection: EBTBalanceProjection? {
        Self.projection(
            balance: (account.foodBalance as NSDecimalNumber).doubleValue,
            transactions: account.transactions,
            nextDeposit: account.nextDeposit
        )
    }
}
