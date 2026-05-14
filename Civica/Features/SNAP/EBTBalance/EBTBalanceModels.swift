import Foundation

// Data model for the Check EBT Balance feature.
//
// Demo scope: California, fixture-backed. These types mirror the shape
// a real state-EBT integration would return (balance + next deposit),
// but Civica does not connect to a live EBT system — see
// EBTBalanceFixtures for the seeded demo account.

/// A linked EBT account's current state. CalFresh (food) is always
/// present; cash aid is optional since not every household receives it.
struct EBTAccount: Equatable {
    /// CalFresh / SNAP food benefit balance.
    let foodBalance: Decimal
    /// Cash aid balance, when the household receives it. nil = food-only.
    let cashBalance: Decimal?
    /// When the balance was last read from the state EBT system. Drives
    /// the "Last updated …" trust line — a stale balance is worse than
    /// no balance, so this is always shown.
    let lastUpdated: Date
    /// The next scheduled deposit, when known.
    let nextDeposit: EBTDeposit?
}

/// A scheduled benefit deposit.
struct EBTDeposit: Equatable {
    let amount: Decimal
    let expectedDate: Date
}
