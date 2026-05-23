import CivicaDesignSystem
import SwiftUI

// Sheet that presents the VNDocumentCameraViewController wrapped by
// EBTReceiptCaptureView. Shows a full-screen spinner overlay while the
// upload is in progress.

struct EBTReceiptCaptureSheet: View {
    @ObservedObject var store: EBTReceiptsStore
    let language: CivicaLanguage

    // Held across the sheet lifetime so confirmAndUpload can reference it.
    @State private var capturedImage: UIImage?

    var body: some View {
        ZStack {
            EBTReceiptCaptureView { image, ocr in
                capturedImage = image
                if let img = image {
                    store.handleScan(image: img, ocr: ocr)
                } else {
                    store.isShowingCamera = false
                }
            }
            .ignoresSafeArea()

            if store.isUploading {
                uploadingOverlay
            }
        }
        .sheet(item: $store.pendingConfirm) { pending in
            if let img = capturedImage {
                EBTReceiptConfirmSheet(
                    image: img,
                    pending: pending,
                    store: store,
                    language: language
                )
            }
        }
    }

    private var uploadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.5).ignoresSafeArea()
            VStack(spacing: CivicaSpacing.md) {
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(.white)
                    .scaleEffect(1.5)
                Text(EBTReceiptStrings.uploading.value(in: language))
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(.white)
            }
        }
    }
}
