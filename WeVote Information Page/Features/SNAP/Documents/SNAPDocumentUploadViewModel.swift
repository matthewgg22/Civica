import Foundation
import UIKit

// EXPERIMENTAL SILOED MODULE: orchestrates one document upload from
// captured image -> server upload -> polling for extraction ->
// surfacing the result for confirmation.
//
// Single-document scope: this view model is created per upload. Don't
// reuse the same instance across captures — each capture spawns a
// fresh state machine.

@MainActor
final class SNAPDocumentUploadViewModel: ObservableObject {
    enum Phase: Equatable {
        case idle
        case uploading
        case processing
        case awaitingConfirmation(SNAPExtractionResult)
        case rejected(SNAPDocumentQualityResult)
        case error(String)
    }

    @Published private(set) var phase: Phase = .idle
    @Published private(set) var documentID: String?

    private let client: SNAPNetworkClient
    private let sessionID: String
    private let pollInterval: UInt64
    private let maxPollAttempts: Int

    init(
        client: SNAPNetworkClient,
        sessionID: String,
        pollInterval: UInt64 = 1_500_000_000, // 1.5s in nanoseconds
        maxPollAttempts: Int = 40              // ~60s upper bound
    ) {
        self.client = client
        self.sessionID = sessionID
        self.pollInterval = pollInterval
        self.maxPollAttempts = maxPollAttempts
    }

    /// Upload a captured image. The image is pre-checked on-device by
    /// SNAPDocumentQualityChecker; rejections never call this method.
    func upload(image: UIImage) async {
        guard let imageData = image.jpegData(compressionQuality: 0.85) else {
            phase = .error("Couldn't prepare the photo for upload.")
            return
        }
        phase = .uploading
        do {
            let response = try await client.uploadDocument(
                sessionId: sessionID,
                imageData: imageData,
                mediaType: "image/jpeg",
                onDeviceQualityPassed: true
            )
            documentID = response.documentID
            if response.processingStatus == "rejected" {
                // Server rejected (e.g. malformed image). Surface as error.
                phase = .error("The server couldn't process this photo. Please try again.")
                return
            }
            phase = .processing
            await pollForExtraction(documentID: response.documentID)
        } catch {
            phase = .error(humanizedError(error))
        }
    }

    /// Confirm the extracted paystub (optionally with corrections).
    func confirm(corrections: [String: String]? = nil) async {
        guard let documentID else { return }
        guard case .awaitingConfirmation = phase else { return }
        do {
            _ = try await client.confirmDocument(
                documentId: documentID,
                corrections: corrections
            )
            // After confirm, the document is locked in. We don't change
            // phase — the parent view dismisses and moves on.
        } catch {
            phase = .error(humanizedError(error))
        }
    }

    func recordOnDeviceRejection(_ rejection: SNAPDocumentQualityResult) {
        phase = .rejected(rejection)
    }

    func reset() {
        phase = .idle
        documentID = nil
    }

    // MARK: - Polling

    private func pollForExtraction(documentID: String) async {
        for _ in 0..<maxPollAttempts {
            try? await Task.sleep(nanoseconds: pollInterval)
            do {
                let status = try await client.getDocumentStatus(documentId: documentID)
                if let extraction = status.extraction {
                    phase = .awaitingConfirmation(extraction)
                    return
                }
            } catch {
                phase = .error(humanizedError(error))
                return
            }
        }
        phase = .error("Extraction is taking longer than expected. You can try again or skip this for now.")
    }

    private func humanizedError(_ error: Error) -> String {
        switch error {
        case SNAPNetworkError.invalidURL:
            return "We couldn't reach the server."
        case SNAPNetworkError.unexpectedStatus(let code):
            return "The server returned an unexpected status (\(code))."
        case SNAPNetworkError.decodingFailed:
            return "We received an unexpected response from the server."
        default:
            return "Something went wrong uploading your document."
        }
    }
}
