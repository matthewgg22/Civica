import Foundation

// Pure-function anomaly detector for EBT anti-skimming alerts.
// Plan D5 / Phase 2 / Lane G.
//
// Signal model:
//   1. Velocity burst    — >$50 spent in any 2-minute window → .high
//   2. Transaction flood — >5 txns in any 10-minute window   → .medium
//   3. Cross-state use   — merchant matches non-CA heuristic  → .high
//
// Payday suppression (day 1–10 of month): velocity + flood severity
// downgraded by one level (high→medium, medium→low) because recipients
// spend heavily on issuance day.
//
// Travel mute: if travelMuteUntil is non-nil and in the future the
// cross-state signal is suppressed entirely.
//
// No async, no @MainActor, no side effects — fully testable.

enum EBTAnomalyDetector {

    // Regex for merchant strings that indicate non-CA transactions.
    // Matches Texas, Florida, Mexico, New York, Nevada, Arizona,
    // Oregon, Washington, Georgia, plus common non-CA EBT chains
    // (OXXO = Mexican convenience, H-E-B = Texas/South grocery).
    // Case-insensitive; word-boundary anchored to prevent partial
    // matches (e.g. "MAXWELL" matching "MX" without \b).
    private static let crossStatePattern = try! NSRegularExpression(
        pattern: #"\b(TX|FL|MX|MEX|NY|NV|AZ|OR|WA|GA|OXXO|H-E-B)\b"#,
        options: .caseInsensitive
    )

    /// Produce alerts sorted by severity descending.
    ///
    /// - Parameters:
    ///   - transactions: All known transactions. Includes purchases
    ///     (negative amount) and deposits (positive). Cross-state and
    ///     velocity checks skip deposits since the portal formats
    ///     deposit descriptions differently.
    ///   - travelMuteUntil: When non-nil and in the future, cross-state
    ///     alerts are suppressed (the recipient is traveling on purpose).
    ///   - now: Injectable for tests; defaults to the real clock.
    static func score(
        transactions: [EBTTransaction],
        travelMuteUntil: Date?,
        now: Date = Date()
    ) -> [EBTAnomalyAlert] {
        guard !transactions.isEmpty else { return [] }

        let isPayday = isPaydaySuppression(now: now)
        let purchases = transactions.filter { !$0.isDeposit }

        var alerts: [EBTAnomalyAlert] = []

        // 1. Velocity burst
        if let burst = velocityBurst(purchases: purchases) {
            let rawSeverity = EBTAnomalySeverity.high
            let severity = isPayday ? downgrade(rawSeverity) : rawSeverity
            if let sev = severity {
                alerts.append(EBTAnomalyAlert(
                    kind: .velocityBurst,
                    severity: sev,
                    transactions: burst,
                    bannerCopy: EBTAnomalyStrings.velocityBannerCopy,
                    cta: .lockCard
                ))
            }
        }

        // 2. Transaction flood
        if let flood = transactionFlood(purchases: purchases) {
            let rawSeverity = EBTAnomalySeverity.medium
            let severity = isPayday ? downgrade(rawSeverity) : rawSeverity
            if let sev = severity {
                alerts.append(EBTAnomalyAlert(
                    kind: .transactionFlood,
                    severity: sev,
                    transactions: flood,
                    bannerCopy: EBTAnomalyStrings.floodBannerCopy,
                    cta: .reviewTransactions
                ))
            }
        }

        // 3. Cross-state use (skip if travel muted)
        let travelMuted = travelMuteUntil.map { $0 > now } ?? false
        if !travelMuted {
            let crossState = crossStateTransactions(purchases: purchases)
            if !crossState.isEmpty {
                alerts.append(EBTAnomalyAlert(
                    kind: .crossStateUse,
                    severity: .high,
                    transactions: crossState,
                    bannerCopy: EBTAnomalyStrings.crossStateBannerCopy,
                    cta: .lockCard
                ))
            }
        }

        return alerts.sorted { $0.severity > $1.severity }
    }

    // MARK: - Private helpers

    /// True when today's day-of-month is 1–10 (CA benefit issuance window).
    private static func isPaydaySuppression(now: Date) -> Bool {
        let day = Calendar.current.component(.day, from: now)
        return (1...10).contains(day)
    }

    /// Downgrade severity by one level. Returns nil if already .low —
    /// a fully-suppressed alert is omitted from results.
    private static func downgrade(_ s: EBTAnomalySeverity) -> EBTAnomalySeverity? {
        switch s {
        case .high:   return .medium
        case .medium: return .low
        case .low:    return nil
        }
    }

    /// Check for >$50 spent (absolute value of negative amounts) in any
    /// 2-minute window. Returns the triggering transactions or nil.
    private static func velocityBurst(purchases: [EBTTransaction]) -> [EBTTransaction]? {
        let windowSeconds: TimeInterval = 2 * 60
        let threshold: Decimal = 50

        let sorted = purchases.sorted { $0.date < $1.date }
        for (i, anchor) in sorted.enumerated() {
            let window = sorted.dropFirst(i).prefix(while: {
                $0.date.timeIntervalSince(anchor.date) <= windowSeconds
            })
            let spent = window.reduce(Decimal(0)) { $0 + abs($1.amount) }
            if spent > threshold {
                return Array(window)
            }
        }
        return nil
    }

    /// Check for >5 transactions in any 10-minute window.
    private static func transactionFlood(purchases: [EBTTransaction]) -> [EBTTransaction]? {
        let windowSeconds: TimeInterval = 10 * 60
        let threshold = 5

        let sorted = purchases.sorted { $0.date < $1.date }
        for (i, anchor) in sorted.enumerated() {
            let window = sorted.dropFirst(i).prefix(while: {
                $0.date.timeIntervalSince(anchor.date) <= windowSeconds
            })
            if window.count > threshold {
                return Array(window)
            }
        }
        return nil
    }

    /// Filter purchases whose merchant string contains a non-CA state/chain
    /// marker.
    private static func crossStateTransactions(purchases: [EBTTransaction]) -> [EBTTransaction] {
        purchases.filter { txn in
            let range = NSRange(txn.merchant.startIndex..., in: txn.merchant)
            return crossStatePattern.firstMatch(in: txn.merchant, range: range) != nil
        }
    }
}
