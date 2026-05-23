import CivicaDesignSystem

// Marketplace / perks copy for the Check EBT Balance feature. Populated
// by Phase 3 (T21) — perk tile titles, claim-flow strings, partner
// disclosure copy, impression-tracking opt-in.
//
// Every CivicaText added here MUST have both .en and .es. The
// EBTStringParityTests parity guard (plan §16.8) will fail in CI
// otherwise.

enum EBTPerksStrings {
    // Phase 3 (T21) populates this namespace.

    /// Curated list of every CivicaText in this namespace. Add new
    /// entries here so EBTStringParityTests catches EN/ES drift. See
    /// EBTBalanceStrings.all for the rationale.
    static let all: [CivicaText] = []
}
