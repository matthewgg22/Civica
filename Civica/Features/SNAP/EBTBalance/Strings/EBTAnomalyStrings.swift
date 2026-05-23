import CivicaDesignSystem

// Anomaly / skimming-alert copy for the Check EBT Balance feature.
// Populated by Phase 2 (T18) — velocity-burst banner, out-of-state
// merchant warning, travel-mute confirmation, escalation-to-county
// CTA.
//
// Every CivicaText added here MUST have both .en and .es. The
// EBTStringParityTests parity guard (plan §16.8) will fail in CI
// otherwise.

enum EBTAnomalyStrings {
    // Phase 2 (T18) populates this namespace.

    /// Curated list of every CivicaText in this namespace. Add new
    /// entries here so EBTStringParityTests catches EN/ES drift. See
    /// EBTBalanceStrings.all for the rationale.
    static let all: [CivicaText] = []
}
