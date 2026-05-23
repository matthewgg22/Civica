import SwiftUI
import VisionKit
import Vision

// UIViewControllerRepresentable that wraps VNDocumentCameraViewController.
//
// Flow:
//   1. User taps "Scan receipt" → EBTReceiptCaptureSheet presents this view.
//   2. Camera captures one or more pages.
//   3. For each page, VNRecognizeTextRequest extracts text lines.
//   4. EBTReceiptOCR.parse(lines:) derives merchant + total + confidence.
//   5. onCompletion is called with the first-page image + merged OCR result.
//
// Only Foundation + VisionKit + Vision are imported — no network calls here.

// MARK: - Representable

struct EBTReceiptCaptureView: UIViewControllerRepresentable {
    /// Called once the scan completes and OCR finishes. Always on the main
    /// thread. Pass (nil, .init(nil, nil, 0.0)) on cancellation.
    var onCompletion: @MainActor (UIImage?, EBTReceiptOCRResult) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onCompletion: onCompletion)
    }

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let vc = VNDocumentCameraViewController()
        vc.delegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {}
}

// MARK: - Coordinator

extension EBTReceiptCaptureView {
    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        private let onCompletion: @MainActor (UIImage?, EBTReceiptOCRResult) -> Void

        init(onCompletion: @escaping @MainActor (UIImage?, EBTReceiptOCRResult) -> Void) {
            self.onCompletion = onCompletion
        }

        // MARK: Delegate

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFinishWith scan: VNDocumentCameraScan
        ) {
            controller.dismiss(animated: true)
            guard scan.pageCount > 0 else {
                Task { @MainActor in
                    self.onCompletion(nil, EBTReceiptOCRResult(merchant: nil, totalCents: nil, confidence: 0.0))
                }
                return
            }

            // Grab the first page image for upload; run OCR across all pages
            // so multi-page receipts can find the total on page 2+.
            let firstImage = scan.imageOfPage(at: 0)
            var allImages: [UIImage] = []
            for i in 0..<scan.pageCount {
                allImages.append(scan.imageOfPage(at: i))
            }

            Task {
                let ocrResult = await self.runOCR(on: allImages)
                await MainActor.run {
                    self.onCompletion(firstImage, ocrResult)
                }
            }
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            controller.dismiss(animated: true)
            Task { @MainActor in
                self.onCompletion(nil, EBTReceiptOCRResult(merchant: nil, totalCents: nil, confidence: 0.0))
            }
        }

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFailWithError error: Error
        ) {
            controller.dismiss(animated: true)
            Task { @MainActor in
                self.onCompletion(nil, EBTReceiptOCRResult(merchant: nil, totalCents: nil, confidence: 0.0))
            }
        }

        // MARK: OCR

        private func runOCR(on images: [UIImage]) async -> EBTReceiptOCRResult {
            var allLines: [String] = []
            for image in images {
                let lines = await recognizeText(in: image)
                allLines.append(contentsOf: lines)
            }
            return EBTReceiptOCR.parse(lines: allLines)
        }

        private func recognizeText(in image: UIImage) async -> [String] {
            guard let cgImage = image.cgImage else { return [] }
            return await withCheckedContinuation { continuation in
                let request = VNRecognizeTextRequest { request, error in
                    guard error == nil,
                          let observations = request.results as? [VNRecognizedTextObservation]
                    else {
                        continuation.resume(returning: [])
                        return
                    }
                    let lines = observations.compactMap {
                        $0.topCandidates(1).first?.string
                    }
                    continuation.resume(returning: lines)
                }
                request.recognitionLevel = .accurate
                request.usesLanguageCorrection = false // raw receipt text; correction hurts

                let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
                do {
                    try handler.perform([request])
                } catch {
                    continuation.resume(returning: [])
                }
            }
        }
    }
}
