import CoreImage
import UIKit
import Vision

// EXPERIMENTAL SILOED MODULE: on-device document quality gate.
//
// Why this matters: bad photos (blurry, rotated, low contrast, no
// detected document boundary) cost ~$0.005 in vision-LLM tokens per
// upload AND lead to "we couldn't read your paystub" friction. Both
// avoidable by checking on-device first, in milliseconds, with no
// network call.
//
// Rejected images don't leave the device. The user sees an immediate
// "let me try that again" and we save the budget for actually-readable
// documents.
//
// Quality criteria (each rejection has a stable reason code so iOS UI
// can show specific guidance):
//   - boundary_not_detected: VNDetectDocumentSegmentationRequest found
//     no document quadrilateral.
//   - too_blurry: variance-of-Laplacian below threshold.
//   - too_dark or too_bright: extreme overall luminance.
//
// Tolerances are intentionally lenient — we'd rather accept a marginal
// photo and let the backend classifier's LOW band catch it than reject
// a passable photo.

enum SNAPDocumentQualityRejection: String, Sendable {
    case boundaryNotDetected = "boundary_not_detected"
    case tooBlurry = "too_blurry"
    case tooDark = "too_dark"
    case tooBright = "too_bright"
}

struct SNAPDocumentQualityResult: Sendable {
    let passed: Bool
    let rejections: [SNAPDocumentQualityRejection]
    let blurScore: Double?       // higher = sharper. ~5+ usually passes
    let luminance: Double?       // 0-1 average

    /// English-only short hint for the UI. iOS surfaces this above the
    /// retake button.
    var hintText: String {
        if passed { return "" }
        if rejections.contains(.boundaryNotDetected) {
            return "We couldn't find the edges of the document. Try centering it on a contrasting surface."
        }
        if rejections.contains(.tooBlurry) {
            return "The photo looks blurry. Hold the phone steady and try again."
        }
        if rejections.contains(.tooDark) {
            return "The photo is too dark. Move to better light or turn on the flash."
        }
        if rejections.contains(.tooBright) {
            return "The photo is too bright. Avoid direct glare on the document."
        }
        return "Let's try that one more time."
    }
}

enum SNAPDocumentQualityChecker {
    private static let blurThreshold: Double = 5.0     // empirical
    private static let darkThreshold: Double = 0.10
    private static let brightThreshold: Double = 0.95

    /// Runs three independent checks. Returns a result describing every
    /// failure (so multi-rejection photos can show the most-actionable
    /// guidance).
    static func check(_ image: UIImage) async -> SNAPDocumentQualityResult {
        guard let cgImage = image.cgImage else {
            return SNAPDocumentQualityResult(
                passed: false,
                rejections: [.boundaryNotDetected],
                blurScore: nil,
                luminance: nil
            )
        }

        var rejections: [SNAPDocumentQualityRejection] = []

        // 1. Document boundary.
        if !(await detectDocumentBoundary(cgImage)) {
            rejections.append(.boundaryNotDetected)
        }

        // 2. Blur (variance of Laplacian via CIFilter approximation).
        let blur = approximateBlurScore(cgImage)
        if blur < blurThreshold {
            rejections.append(.tooBlurry)
        }

        // 3. Luminance.
        let lum = averageLuminance(cgImage)
        if lum < darkThreshold {
            rejections.append(.tooDark)
        } else if lum > brightThreshold {
            rejections.append(.tooBright)
        }

        return SNAPDocumentQualityResult(
            passed: rejections.isEmpty,
            rejections: rejections,
            blurScore: blur,
            luminance: lum
        )
    }

    // MARK: - Individual checks

    private static func detectDocumentBoundary(_ cgImage: CGImage) async -> Bool {
        await withCheckedContinuation { continuation in
            let request = VNDetectDocumentSegmentationRequest { request, _ in
                let observations = request.results as? [VNRectangleObservation] ?? []
                continuation.resume(returning: !observations.isEmpty)
            }
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([request])
            } catch {
                continuation.resume(returning: false)
            }
        }
    }

    /// Approximate blur score using a mean-then-variance pass over a
    /// downsampled grayscale rendering. Faster than running a full
    /// Laplacian convolution; close enough for a quality gate that
    /// only needs to distinguish "obviously blurry" from "passable."
    private static func approximateBlurScore(_ cgImage: CGImage) -> Double {
        let ciImage = CIImage(cgImage: cgImage)
        let grayscale = ciImage.applyingFilter("CIPhotoEffectMono")

        guard let edges = applyLaplacian(grayscale),
              let cgOut = CIContext().createCGImage(edges, from: edges.extent)
        else {
            return 0.0
        }
        return computePixelVariance(cgOut)
    }

    private static func applyLaplacian(_ input: CIImage) -> CIImage? {
        // CIConvolution3X3 with a Laplacian kernel highlights edges.
        let weights = CIVector(values: [0, 1, 0, 1, -4, 1, 0, 1, 0], count: 9)
        return input.applyingFilter(
            "CIConvolution3X3",
            parameters: [
                "inputWeights": weights,
                "inputBias": 0.5,
            ]
        )
    }

    private static func computePixelVariance(_ cgImage: CGImage) -> Double {
        // Read the grayscale channel; compute mean then variance.
        let width = cgImage.width
        let height = cgImage.height
        let bytesPerRow = width
        let totalBytes = bytesPerRow * height
        var pixelData = [UInt8](repeating: 0, count: totalBytes)

        let colorSpace = CGColorSpaceCreateDeviceGray()
        guard
            let context = CGContext(
                data: &pixelData,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: bytesPerRow,
                space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.none.rawValue
            )
        else {
            return 0
        }
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))

        let sample = stride(from: 0, to: totalBytes, by: max(1, totalBytes / 10000))
        var values: [Double] = []
        values.reserveCapacity(11000)
        for i in sample {
            values.append(Double(pixelData[i]))
        }
        guard values.count > 1 else { return 0 }
        let mean = values.reduce(0, +) / Double(values.count)
        let variance = values.map { ($0 - mean) * ($0 - mean) }.reduce(0, +) / Double(values.count)
        // Normalize so a typical "passable" photo lands around 5-20.
        return variance / 1000.0
    }

    private static func averageLuminance(_ cgImage: CGImage) -> Double {
        let ciImage = CIImage(cgImage: cgImage)
        let extentVector = CIVector(
            x: ciImage.extent.origin.x,
            y: ciImage.extent.origin.y,
            z: ciImage.extent.size.width,
            w: ciImage.extent.size.height
        )
        let filter = CIFilter(
            name: "CIAreaAverage",
            parameters: [kCIInputImageKey: ciImage, kCIInputExtentKey: extentVector]
        )
        guard let output = filter?.outputImage else { return 0.5 }
        var bitmap = [UInt8](repeating: 0, count: 4)
        let context = CIContext(options: [.workingColorSpace: kCFNull as Any])
        context.render(
            output,
            toBitmap: &bitmap,
            rowBytes: 4,
            bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
            format: .RGBA8,
            colorSpace: nil
        )
        // Standard luminance formula.
        let r = Double(bitmap[0]) / 255.0
        let g = Double(bitmap[1]) / 255.0
        let b = Double(bitmap[2]) / 255.0
        return 0.299 * r + 0.587 * g + 0.114 * b
    }
}
