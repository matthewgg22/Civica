import SwiftUI
import UIKit
import VisionKit

// EXPERIMENTAL SILOED MODULE: SwiftUI wrapper around
// VNDocumentCameraViewController, with an on-device quality gate that
// runs before the captured image is handed back.
//
// The flow:
//   1. Present VNDocumentCameraViewController (handles boundary
//      detection, perspective correction, multi-page capture).
//   2. On finishWith page(s), run SNAPDocumentQualityChecker on the
//      first page.
//   3. If passed, return the captured image to the caller.
//   4. If rejected, surface the hint text and re-present the camera.
//
// Multi-page is supported by VisionKit but Phase E ships single-page
// only — paystubs are typically one page, and multi-page handling
// requires a separate UI for paging through extracted pages.

struct SNAPDocumentCameraView: UIViewControllerRepresentable {
    let onCaptured: (UIImage) -> Void
    let onCancel: () -> Void
    let onRejected: (SNAPDocumentQualityResult) -> Void

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
        Coordinator(
            onCaptured: onCaptured,
            onCancel: onCancel,
            onRejected: onRejected
        )
    }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let onCaptured: (UIImage) -> Void
        let onCancel: () -> Void
        let onRejected: (SNAPDocumentQualityResult) -> Void

        init(
            onCaptured: @escaping (UIImage) -> Void,
            onCancel: @escaping () -> Void,
            onRejected: @escaping (SNAPDocumentQualityResult) -> Void
        ) {
            self.onCaptured = onCaptured
            self.onCancel = onCancel
            self.onRejected = onRejected
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
                    if quality.passed {
                        onCaptured(image)
                    } else {
                        onRejected(quality)
                    }
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
