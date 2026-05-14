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
