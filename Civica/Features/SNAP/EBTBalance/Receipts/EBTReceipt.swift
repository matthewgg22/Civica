import Foundation

// Model types for Phase 2 Lane F: receipt capture + OCR + match.
//
// Design note per D6: a receipt is linked to at most one transaction.
// `matchStatus` progresses:
//   pendingMatch → matched (auto, if unambiguous)
//              → ambiguous (user must pick)
//              → standalone (≥7d, no match found)
// `userConfirmed` is set true once a low-confidence OCR result has been
// reviewed and accepted by the recipient (EBTReceiptConfirmSheet).

// MARK: - Receipt model

struct EBTReceipt: Codable, Equatable, Identifiable, Sendable {
    let id: UUID
    /// Nil until the async match job resolves a transaction_id.
    var transactionId: String?
    /// Supabase Storage signed URL (90-day TTL per plan D6).
    let imageURL: URL
    /// Total purchase amount in cents, as parsed by on-device OCR.
    var ocrTotalCents: Int?
    /// Merchant string extracted from the top of the receipt.
    var ocrMerchant: String?
    /// When the receipt was captured on-device.
    let capturedAt: Date
    var matchStatus: EBTReceiptMatchStatus
    /// True once the recipient has reviewed and confirmed a low-confidence
    /// OCR result (confidence < 0.7).
    var userConfirmed: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case transactionId = "transaction_id"
        case imageURL = "image_url"
        case ocrTotalCents = "ocr_total_cents"
        case ocrMerchant = "ocr_merchant"
        case capturedAt = "captured_at"
        case matchStatus = "match_status"
        case userConfirmed = "user_confirmed"
    }
}

// MARK: - Match status

enum EBTReceiptMatchStatus: String, Codable, Sendable {
    /// Just uploaded; the match job hasn't run yet.
    case pendingMatch = "pending_match"
    /// Exactly one transaction matched within ±$0.50 + fuzzy merchant + 72h.
    case matched
    /// Multiple candidate transactions found; recipient must pick.
    case ambiguous
    /// ≥7 days old with no matching transaction found; treated as a standalone
    /// paper receipt (e.g. WIC, cash, or a card not linked to this account).
    case standalone
}
