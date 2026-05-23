import Foundation

// Data model for the EBT anti-skimming alert surface (Phase 2, Lane G).
// Each alert wraps one or more triggering transactions, a pre-localized
// banner copy blob, and a primary CTA. The EBTAnomalyDetector (pure-fn)
// produces these; the EBTAnomalyStore owns the live collection.

enum EBTAnomalyKind: Equatable, Sendable {
    case velocityBurst
    case transactionFlood
    case crossStateUse
}

enum EBTAnomalySeverity: Int, Equatable, Sendable, Comparable {
    case low = 0
    case medium = 1
    case high = 2

    static func < (lhs: EBTAnomalySeverity, rhs: EBTAnomalySeverity) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

enum EBTAnomalyAlertCTA: Equatable, Sendable {
    case lockCard
    case reviewTransactions
    case dismissOrMute
}

struct EBTAnomalyAlert: Equatable, Identifiable, Sendable {
    let id: UUID
    let kind: EBTAnomalyKind
    let severity: EBTAnomalySeverity
    let transactions: [EBTTransaction]
    let bannerCopy: CivicaText
    let cta: EBTAnomalyAlertCTA

    init(id: UUID = UUID(), kind: EBTAnomalyKind, severity: EBTAnomalySeverity,
         transactions: [EBTTransaction], bannerCopy: CivicaText, cta: EBTAnomalyAlertCTA) {
        self.id = id; self.kind = kind; self.severity = severity
        self.transactions = transactions; self.bannerCopy = bannerCopy; self.cta = cta
    }
}
