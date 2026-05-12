import Foundation
import UIKit
import Vision

#if canImport(FoundationModels)
import FoundationModels
#endif

// On-device denial-letter parser. Vision OCR + Foundation Models
// `LanguageModelSession` with a denial-letter-specific @Generable
// struct.
//
// Gated behind the same iOS 26 + Apple Intelligence check
// SNAPOnDeviceExtractor uses. Callers must hide the "scan letter"
// affordance when SNAPOnDeviceExtractor.isAvailable is false and
// surface DenialLetterManualEntryView instead — the appeal
// generator works end-to-end without OCR.

@available(iOS 26, *)
@Generable
struct OnDeviceDenialLetterFields {
    @Guide(description: "Case number or applicant ID printed on the letter. Plain digits / alphanumeric, no labels.")
    let caseNumber: String?

    @Guide(description: "Date the denial was issued, in ISO 8601 (YYYY-MM-DD). Leave nil if no date is visible.")
    let denialDate: String?

    @Guide(description: "Full legal name of the applicant as printed on the letter.")
    let applicantName: String?

    @Guide(description: "USPS two-letter state code visible on the agency letterhead (e.g. 'MA', 'CA').")
    let stateCode: String?

    @Guide(description: "Primary denial reason as printed on the letter — copy the agency's wording verbatim, do not interpret.")
    let denialReasonText: String?

    @Guide(description: "Brief category of the denial: 'missed_interview' if the letter cites missing the interview, 'missing_documents' if it cites missing verifications or documents, 'no_response' if it cites failure to respond to the agency, or 'other' for anything else.")
    let denialReasonCategory: String?
}

/// Structured result of parsing a denial letter. Every field is
/// optional — the consuming UI must always offer a manual-entry
/// editor over the parsed values; OCR is a head-start, not a
/// source of truth.
struct DenialLetterFields: Equatable {
    let caseNumber: String?
    let denialDate: String?
    let applicantName: String?
    let stateCode: String?
    let denialReasonText: String?
    let denialReasonCategory: DenialReason?
}

enum DenialLetterParser {
    /// True iff the on-device extraction stack is usable. UI should
    /// hide the "scan denial letter" affordance when this is false.
    static var isAvailable: Bool {
        SNAPOnDeviceExtractor.isAvailable
    }

    @available(iOS 26, *)
    static func parse(image: UIImage) async throws -> DenialLetterFields {
        let ocrText = try await runOCR(on: image)
        let session = LanguageModelSession()

        let response = try await session.respond(
            to: denialLetterPrompt(ocrText: ocrText),
            generating: OnDeviceDenialLetterFields.self
        )

        return DenialLetterFields(
            caseNumber: trimmedOrNil(response.content.caseNumber),
            denialDate: trimmedOrNil(response.content.denialDate),
            applicantName: trimmedOrNil(response.content.applicantName),
            stateCode: trimmedOrNil(response.content.stateCode)?.uppercased(),
            denialReasonText: trimmedOrNil(response.content.denialReasonText),
            denialReasonCategory: classifyReason(response.content.denialReasonCategory)
        )
    }

    private static func denialLetterPrompt(ocrText: String) -> String {
        """
        You are extracting fields from a SNAP / CalFresh / state-benefits denial letter.
        Use ONLY the printed text. Do not infer anything that is not literally on the page.
        Do not translate or summarize the denial reason — copy it verbatim into denialReasonText.
        For denialReasonCategory, classify into one of: missed_interview, missing_documents, no_response, other.
        If a field is not visible on the letter, leave it nil.

        OCR text:
        \(ocrText)
        """
    }

    private static func classifyReason(_ raw: String?) -> DenialReason? {
        switch raw?.lowercased() {
        case "missed_interview": return .missedInterview
        case "missing_documents": return .missingDocuments
        case "no_response": return .noResponse
        case "other": return .otherProcedural
        default: return nil
        }
    }

    private static func trimmedOrNil(_ s: String?) -> String? {
        guard let s else { return nil }
        let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    /// OCR helper — mirrors SNAPOnDeviceExtractor.runOCR. Kept
    /// inline rather than reaching into the SNAP module so the
    /// Appeal feature is self-contained and the SNAP file stays
    /// untouched.
    private static func runOCR(on image: UIImage) async throws -> String {
        guard let cgImage = image.cgImage else { return "" }
        return try await withCheckedThrowingContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
                let lines = observations.compactMap { $0.topCandidates(1).first?.string }
                continuation.resume(returning: lines.joined(separator: "\n"))
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true

            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    try handler.perform([request])
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }
}
