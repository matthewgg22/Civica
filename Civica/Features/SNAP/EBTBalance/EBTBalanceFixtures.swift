import Foundation

// Seeded demo data for the Check EBT Balance feature. Civica does not
// connect to a real state EBT system; this fixture stands in for what
// a linked CalFresh account would return so the dashboard is fully
// walkable. Phase 1: a single static account. Later phases add
// transaction history and a refresh that re-stamps the timestamps.

enum EBTBalanceFixtures {
    /// The demo CalFresh account. Food-only (no cash aid), a recent
    /// "last updated" so the trust line reads fresh, and a next
    /// deposit a few days out.
    static var demoAccount: EBTAccount {
        let now = Date()
        return EBTAccount(
            foodBalance: Decimal(string: "76.12") ?? 0,
            cashBalance: nil,
            lastUpdated: now.addingTimeInterval(-120),
            nextDeposit: EBTDeposit(
                amount: 232,
                expectedDate: Calendar.current.date(byAdding: .day, value: 4, to: now) ?? now
            )
        )
    }
}
