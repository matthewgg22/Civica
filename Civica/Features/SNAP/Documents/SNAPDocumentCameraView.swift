import SwiftUI
import UIKit
import VisionKit

// SwiftUI wrapper around VNDocumentCameraViewController. Returns the
// captured UIImage alongside the on-device quality result so callers
// can decide whether to accept low-quality captures, show a hint and
// re-present, or block until quality passes.
//
// Single-page capture only at v1 — paystubs are typically one page,
// and multi-page UX needs a separate paging surface.

// MARK: - AccessibilityElement = parent
struct SNAPDocumentCameraView: UIViewControllerRepresentable {
    /// Called with the captured page image and the quality-check
    /// result. Caller decides whether to accept either way, accept
    /// only when `quality.passed`, or show `quality.hintMessage` as
    /// a retake prompt.
    let onCaptured: (UIImage, SNAPDocumentQualityResult) -> Void
    let onCancel: () -> Void

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(
        _ uiViewController: VNDocumentCameraViewController,
        context: Context
    ) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onCaptured: onCaptured, onCancel: onCancel)
    }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let onCaptured: (UIImage, SNAPDocumentQualityResult) -> Void
        let onCancel: () -> Void

        init(
            onCaptured: @escaping (UIImage, SNAPDocumentQualityResult) -> Void,
            onCancel: @escaping () -> Void
        ) {
            self.onCaptured = onCaptured
            self.onCancel = onCancel
        }

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFinishWith scan: VNDocumentCameraScan
        ) {
            guard scan.pageCount > 0 else {
                controller.dismiss(animated: true)
                return
            }
            let image = scan.imageOfPage(at: 0)
            Task {
                let quality = await SNAPDocumentQualityChecker.check(image)
                await MainActor.run {
                    onCaptured(image, quality)
                    controller.dismiss(animated: true)
                }
            }
        }

        func documentCameraViewControllerDidCancel(
            _ controller: VNDocumentCameraViewController
        ) {
            onCancel()
            controller.dismiss(animated: true)
        }

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFailWithError error: Error
        ) {
            onCancel()
            controller.dismiss(animated: true)
        }
    }
}
