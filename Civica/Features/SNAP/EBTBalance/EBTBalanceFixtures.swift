import Foundation

// Seeded demo data for the Check EBT Balance feature. Civica does not
// connect to a real state EBT system; this fixture stands in for what
// a linked CalFresh account would return so the dashboard is fully
// walkable.
//
// Timestamps are generated relative to "now" each time the account is
// built, so a pull-to-refresh naturally re-stamps the "last updated"
// line and the transaction dates — the illusion of live data without
// a backend.

enum EBTBalanceFixtures {
    /// The demo CalFresh account. Food-only (no cash aid), a next
    /// deposit a few days out, and a short transaction history.
    ///
    /// - Parameter updatedSecondsAgo: how long ago the balance was
    ///   "last read". Defaults to 2 minutes for a first load; a
    ///   refresh passes a few seconds so the trust line reads fresh.
    static func demoAccount(updatedSecondsAgo: TimeInterval = 120) -> EBTAccount {
        let now = Date()
        return EBTAccount(
            foodBalance: Decimal(string: "76.12") ?? 0,
            cashBalance: nil,
            lastUpdated: now.addingTimeInterval(-updatedSecondsAgo),
            nextDeposit: EBTDeposit(
                amount: 232,
                expectedDate: Calendar.current.date(byAdding: .day, value: 4, to: now) ?? now
            ),
            transactions: demoTransactions(now: now)
        )
    }

    /// Recent purchases + the last deposit, newest first. Dates are
    /// offsets from `now` so they re-stamp on refresh.
    private static func demoTransactions(now: Date) -> [EBTTransaction] {
        let calendar = Calendar.current
        func daysAgo(_ days: Int) -> Date {
            calendar.date(byAdding: .day, value: -days, to: now) ?? now
        }
        let entries: [(String, String, Int)] = [
            ("Walmart Supercenter", "-23.60", 0),
            ("Grocery Outlet", "-18.42", 1),
            ("Northgate Market", "-31.07", 3),
            ("Farmers Market — Alameda", "-12.00", 5),
            ("Target", "-9.18", 6),
            ("CalFresh deposit", "232.00", 9),
            ("Food 4 Less", "-27.85", 12),
        ]
        return entries.map { merchant, amount, days in
            EBTTransaction(
                id: UUID(),
                merchant: merchant,
                amount: Decimal(string: amount) ?? 0,
                date: daysAgo(days)
            )
        }
    }
}
