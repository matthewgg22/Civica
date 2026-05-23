import CivicaDesignSystem

// Refer-a-friend copy for the Check EBT Balance feature. Populated by
// Phase 3 (T22) — referral code surface, payout-state strings, shared
// social copy, eligibility-rule disclosure.
//
// Every CivicaText added here MUST have both .en and .es. The
// EBTStringParityTests parity guard (plan §16.8) will fail in CI
// otherwise.

enum EBTReferralStrings {
    // Phase 3 (T22) populates this namespace.

    /// Curated list of every CivicaText in this namespace. Add new
    /// entries here so EBTStringParityTests catches EN/ES drift. See
    /// EBTBalanceStrings.all for the rationale.
    static let all: [CivicaText] = []
}
