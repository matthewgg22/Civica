import Foundation

// ---------------------------------------------------------------------------
// Domain types for the student employer marketplace (T15–T18).
// These are display-layer models; the snap-qc-engine BenefitImpactPackage
// is the authoritative calculation result.
// ---------------------------------------------------------------------------

enum MarketplaceJobType: String, Codable {
    case fws          // Federal Work-Study — excluded from SNAP income (7 CFR 273.9(c)(3))
    case w2           // Standard wage employment
    case platformGig  // Gig/platform — counts toward OBBBA 80-hour requirement
}

struct MarketplaceJob: Identifiable, Codable {
    let id: String
    let title: String
    let employerName: String
    let type: MarketplaceJobType
    let scheduleDescription: String   // e.g. "16 hr/wk · $17/hr · T/Th evenings"
    let monthlyAmountUSD: Decimal
    let pillText: String
    let handshakeJobURL: URL?
    let fallbackCareerURL: URL?
    // Pre-computed from buildBenefitImpactPackage
    let projectedBenefitUSD: Decimal
    let currentBenefitUSD: Decimal
}

struct MarketplaceState {
    var canvasConnected: Bool
    var argyleConnected: Bool
    var currentBenefitUSD: Decimal?
    var jobs: [MarketplaceJob]
    var confirmedJobID: String?
    var confirmedPaycheckDate: Date?
    var obbbaHoursCompleted: Int
    var obbbaHoursRequired: Int
    var currentMonth: String

    static let empty = MarketplaceState(
        canvasConnected: false,
        argyleConnected: false,
        currentBenefitUSD: nil,
        jobs: [],
        confirmedJobID: nil,
        confirmedPaycheckDate: nil,
        obbbaHoursCompleted: 0,
        obbbaHoursRequired: 80,
        currentMonth: "—"
    )
}

// Sorted per DR3-1: FWS first, then W-2 by schedule fit, then gig.
extension Array where Element == MarketplaceJob {
    func sortedByBenefitRank() -> [MarketplaceJob] {
        sorted { a, b in
            func rank(_ t: MarketplaceJobType) -> Int {
                switch t { case .fws: return 0; case .w2: return 1; case .platformGig: return 2 }
            }
            if rank(a.type) != rank(b.type) { return rank(a.type) < rank(b.type) }
            return a.projectedBenefitUSD > b.projectedBenefitUSD
        }
    }
}
