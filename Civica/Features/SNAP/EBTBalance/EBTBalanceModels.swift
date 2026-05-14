import Foundation

// Data model for the Check EBT Balance feature.
//
// Demo scope: California, fixture-backed. These types mirror the shape
// a real state-EBT integration would return (balance, deposits,
// transactions), but Civica does not connect to a live EBT system —
// see EBTBalanceFixtures for the seeded demo account.

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
    /// Day of the month CalFresh loads the card. California staggers
    /// this by case number; the demo account uses a fixed day.
    let depositDayOfMonth: Int
    /// Recent purchases and deposits, newest first.
    let transactions: [EBTTransaction]
}

/// A scheduled benefit deposit.
struct EBTDeposit: Equatable {
    let amount: Decimal
    let expectedDate: Date
}

/// Spending categories for posted transactions. Drives the category
/// glyph on each transaction row and the spending-insights grouping.
enum EBTTransactionCategory: String, CaseIterable, Equatable {
    case groceries
    case restaurant
    case farmersMarket
    case other
    case deposit

    /// SF Symbol shown in the transaction row's category chip.
    var iconName: String {
        switch self {
        case .groceries:     return "cart.fill"
        case .restaurant:    return "fork.knife"
        case .farmersMarket: return "leaf.fill"
        case .other:         return "bag.fill"
        case .deposit:       return "arrow.down.circle.fill"
        }
    }
}

/// A single posted transaction — a purchase or a deposit. `amount` is
/// signed: negative for purchases, positive for deposits.
struct EBTTransaction: Equatable, Identifiable {
    let id: UUID
    let merchant: String
    let amount: Decimal
    let date: Date
    let category: EBTTransactionCategory

    var isDeposit: Bool { amount > 0 }
}

/// A "free or discounted with EBT" perk surfaced on the dashboard.
/// Pure informational content — no in-app destination in the demo.
struct EBTPerk: Equatable, Identifiable {
    let id: UUID
    let iconName: String
    let title: CivicaText
    let detail: CivicaText
}

/// A benefit-news / policy-update card surfaced on the dashboard.
struct EBTNewsItem: Equatable, Identifiable {
    let id: UUID
    let iconName: String
    let title: CivicaText
    let detail: CivicaText
}
