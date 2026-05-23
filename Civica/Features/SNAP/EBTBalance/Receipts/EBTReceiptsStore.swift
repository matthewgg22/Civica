import Foundation
import SwiftUI

// UI-state store for the receipt capture + list flow.
//
// Layering per Q1/D8: this store owns ONLY view-state. Data fetching +
// caching lives in EBTReceiptsRepository. Views observe this store and
// read `repository.receipts` for display data.

@MainActor
final class EBTReceiptsStore: ObservableObject {
    @Published var isShowingCamera = false
    /// Non-nil when OCR confidence < 0.7; receipt is held here until the
    /// user confirms/corrects it in EBTReceiptConfirmSheet.
    @Published var pendingConfirm: EBTReceipt?
    @Published var errorMessage: String?
    @Published var isUploading = false

    let repository: EBTReceiptsRepository

    init(repository: EBTReceiptsRepository) {
        self.repository = repository
    }

    // MARK: - Actions

    /// Open the camera sheet.
    func startCapture() {
        isShowingCamera = true
        errorMessage = nil
    }

    /// Called by EBTReceiptCaptureSheet once scan + OCR complete.
    ///
    /// If confidence < 0.7, the receipt is staged in `pendingConfirm` and
    /// the confirmation sheet appears. Otherwise, upload proceeds immediately.
    func handleScan(image: UIImage, ocr: EBTReceiptOCRResult) {
        isShowingCamera = false
        if ocr.confidence < 0.7 {
            // Stage for user confirmation. Build a placeholder receipt with
            // the OCR data so the confirm sheet can pre-fill its fields.
            pendingConfirm = EBTReceipt(
                id: UUID(),
                transactionId: nil,
                imageURL: URL(string: "placeholder://pending")!,
                ocrTotalCents: ocr.totalCents,
                ocrMerchant: ocr.merchant,
                capturedAt: Date(),
                matchStatus: .pendingMatch,
                userConfirmed: false
            )
        } else {
            Task { await upload(image: image, ocr: ocr) }
        }
    }

    /// Called after the user confirms OCR fields in EBTReceiptConfirmSheet.
    func confirmAndUpload(image: UIImage, merchant: String?, totalCents: Int?) async {
        let confirmed = EBTReceiptOCRResult(
            merchant: merchant,
            totalCents: totalCents,
            confidence: 1.0 // user-verified
        )
        pendingConfirm = nil
        await upload(image: image, ocr: confirmed)
    }

    /// Dismiss the confirm sheet without uploading.
    func cancelConfirm() {
        pendingConfirm = nil
    }

    // MARK: - Private

    private func upload(image: UIImage, ocr: EBTReceiptOCRResult) async {
        isUploading = true
        errorMessage = nil
        defer { isUploading = false }
        do {
            _ = try await repository.upload(image: image, ocr: ocr)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
