import CivicaDesignSystem

// Receipt-capture copy for the Check EBT Balance feature. Populated
// by Phase 2 (T16/T17) — VisionKit capture sheet, OCR confirmation,
// match-status banner, ambiguous-match picker, standalone-receipt
// detail.
//
// Every CivicaText added here MUST have both .en and .es. The
// EBTStringParityTests parity guard (plan §16.8) will fail in CI
// otherwise.

enum EBTReceiptStrings {
    // Phase 2 (T16) populates this namespace.

    /// Curated list of every CivicaText in this namespace. Add new
    /// entries here so EBTStringParityTests catches EN/ES drift. See
    /// EBTBalanceStrings.all for the rationale.
    static let all: [CivicaText] = []
}
