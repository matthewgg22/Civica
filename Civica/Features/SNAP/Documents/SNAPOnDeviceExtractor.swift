import Foundation
import UIKit
import Vision

#if canImport(FoundationModels)
import FoundationModels
#endif

// EXPERIMENTAL SILOED MODULE:
// On-device document extraction for the SNAP demo. Runs Vision OCR on the
// captured image, hands the recognized text to a Foundation Models
// LanguageModelSession with the matching @Generable shape, and converts
// the result into the existing SNAPExtractionResult wire-shape so the
// existing SNAPDocumentConfirmationView renders it without modification.
//
// Pay stubs map to the rich SNAPPaystub shape. Other document types fill
// the generic extractedOther dictionary that the confirmation view's
// non-paystub fallback already understands.

@available(iOS 26, *)
@Generable
struct OnDevicePaystubFields {
    @Guide(description: "Employer or company name as printed on the stub.")
    let employerName: String?
    @Guide(description: "Pay period start date in ISO 8601 (YYYY-MM-DD). Leave nil if ambiguous.")
    let payPeriodStart: String?
    @Guide(description: "Pay period end date in ISO 8601 (YYYY-MM-DD). Leave nil if ambiguous.")
    let payPeriodEnd: String?
    @Guide(description: "Pay date in ISO 8601 (YYYY-MM-DD). Leave nil if not printed.")
    let payDate: String?
    @Guide(description: "Gross pay for this period as plain digits with decimal point (e.g. '1247.50'). No dollar sign, no commas.")
    let grossPayPeriod: String?
    @Guide(description: "Net pay for this period as plain digits with decimal point.")
    let netPayPeriod: String?
    @Guide(description: "Hours worked in this pay period as plain digits with decimal point.")
    let hoursWorkedInPeriod: String?
    @Guide(description: "Hourly rate in dollars per hour as plain digits with decimal point. Leave nil if salaried.")
    let hourlyRate: String?
    @Guide(description: "True if salaried, false if hourly. Leave nil if unclear from the stub.")
    let isSalaried: Bool?
    @Guide(description: "Pay frequency exactly as printed (e.g. 'Bi-Weekly', 'Weekly', 'Semi-Monthly').")
    let payFrequencyLabelAsPrinted: String?
    @Guide(description: "Gross pay year-to-date as plain digits with decimal point.")
    let grossPayYTD: String?
    @Guide(description: "Net pay year-to-date as plain digits with decimal point.")
    let netPayYTD: String?
}

@available(iOS 26, *)
@Generable
struct OnDeviceGenericDocumentFields {
    @Guide(description: "Primary monetary amount printed on the document (rent, bill total, monthly benefit) as plain digits with decimal point.")
    let primaryAmount: String?
    @Guide(description: "Service or residential address printed on the document.")
    let address: String?
    @Guide(description: "Full legal name printed on the document.")
    let fullName: String?
    @Guide(description: "Date of birth in ISO 8601 (YYYY-MM-DD) if visible.")
    let dateOfBirth: String?
    @Guide(description: "Five-digit ZIP code printed on the document.")
    let zipCode: String?
}

enum SNAPOnDeviceExtractor {
    /// True only when the on-device extraction stack is actually usable:
    /// the OS is iOS 26+ and SystemLanguageModel reports available
    /// (i.e., Apple Intelligence is supported and enabled on this
    /// device). Callers should hide the extraction step otherwise so
    /// users on older devices still get the existing capture flow with
    /// no confusing dead-end UI.
    static var isAvailable: Bool {
        #if canImport(FoundationModels)
        if #available(iOS 26, *) {
            if case .available = SystemLanguageModel.default.availability {
                return true
            }
        }
        #endif
        return false
    }

    @available(iOS 26, *)
    static func extract(image: UIImage, capturedAs documentType: SNAPDocumentType) async throws -> SNAPExtractionResult {
        let ocrText = try await runOCR(on: image)
        let classification = makeClassification(for: documentType)
        let session = LanguageModelSession()

        switch documentType {
        case .proofOfIncome:
            let response = try await session.respond(
                to: paystubPrompt(ocrText: ocrText),
                generating: OnDevicePaystubFields.self
            )
            let paystub = makePaystub(from: response.content)
            return SNAPExtractionResult(
                classification: classification,
                extractedPaystub: paystub,
                extractedOther: nil,
                validationFlags: validationFlags(for: paystub),
                extractionConfidence: paystub == nil ? 0.5 : 0.85
            )
        default:
            let response = try await session.respond(
                to: genericPrompt(documentType: documentType, ocrText: ocrText),
                generating: OnDeviceGenericDocumentFields.self
            )
            let extractedOther = makeExtractedOther(from: response.content)
            return SNAPExtractionResult(
                classification: classification,
                extractedPaystub: nil,
                extractedOther: extractedOther,
                validationFlags: [],
                extractionConfidence: extractedOther == nil ? 0.5 : 0.75
            )
        }
    }

    // MARK: - OCR

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
            do {
                let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
                try handler.perform([request])
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }

    // MARK: - Prompts

    private static func paystubPrompt(ocrText: String) -> String {
        """
        Extract structured fields from this pay stub. Never extract Social Security numbers, bank account numbers, or routing numbers — leave any such field nil even if visible in the OCR text.
        Return monetary amounts as plain digits with a decimal point (for example '1247.50'), without dollar signs or commas.

        OCR text from the pay stub, in reading order top-to-bottom:
        \(ocrText)
        """
    }

    private static func genericPrompt(documentType: SNAPDocumentType, ocrText: String) -> String {
        let label = documentType.rawValue.replacingOccurrences(of: "_", with: " ")
        return """
        Extract structured fields from this \(label). Never extract Social Security numbers, driver license numbers, bank account or routing numbers, or full immigration status — leave any such field nil even if visible.
        Return monetary amounts as plain digits with a decimal point (for example '142.18'), without dollar signs or commas.

        OCR text from the document, in reading order top-to-bottom:
        \(ocrText)
        """
    }

    // MARK: - Mapping into SNAPExtractionResult / SNAPPaystub

    private static func makeClassification(for snapType: SNAPDocumentType) -> SNAPDocumentClassification {
        let extracted: SNAPExtractedDocumentType
        switch snapType {
        case .proofOfIncome: extracted = .paystub
        case .photoID: extracted = .photoID
        case .rentOrHousingCostProof: extracted = .lease
        case .utilityBill: extracted = .utilityBill
        default: extracted = .other
        }
        return SNAPDocumentClassification(
            documentType: extracted,
            confidence: 0.9,
            confidenceBand: .high,
            rationale: "User selected this document type from the checklist before capture."
        )
    }

    @available(iOS 26, *)
    private static func makePaystub(from fields: OnDevicePaystubFields) -> SNAPPaystub? {
        guard
            let employer = fields.employerName, !employer.isEmpty,
            let start = fields.payPeriodStart,
            let end = fields.payPeriodEnd,
            let gross = parseDecimal(fields.grossPayPeriod),
            let net = parseDecimal(fields.netPayPeriod)
        else { return nil }

        return SNAPPaystub(
            employerName: employer,
            employerAddress: nil,
            payPeriodStart: start,
            payPeriodEnd: end,
            payDate: fields.payDate,
            hoursWorkedInPeriod: parseDecimal(fields.hoursWorkedInPeriod),
            hourlyRate: parseDecimal(fields.hourlyRate),
            isSalaried: fields.isSalaried ?? false,
            grossPayPeriod: gross,
            netPayPeriod: net,
            deductions: [],
            grossPayYTD: parseDecimal(fields.grossPayYTD),
            netPayYTD: parseDecimal(fields.netPayYTD),
            payFrequencyLabelAsPrinted: fields.payFrequencyLabelAsPrinted
        )
    }

    private static func validationFlags(for paystub: SNAPPaystub?) -> [SNAPValidationFlag] {
        guard paystub == nil else { return [] }
        return [SNAPValidationFlag(
            code: "incomplete_paystub_fields",
            messageEn: "Some pay stub fields couldn't be read confidently. Tap \"Fix something\" to fill in the missing values.",
            messageEs: "Algunos campos del talón de pago no se pudieron leer con seguridad. Toca \"Corregir\" para completar los valores que faltan.",
            severity: "warning"
        )]
    }

    @available(iOS 26, *)
    private static func makeExtractedOther(from fields: OnDeviceGenericDocumentFields) -> [String: String]? {
        var result: [String: String] = [:]
        if let value = fields.primaryAmount, !value.isEmpty { result["amount"] = value }
        if let value = fields.address, !value.isEmpty { result["address"] = value }
        if let value = fields.fullName, !value.isEmpty { result["name"] = value }
        if let value = fields.dateOfBirth, !value.isEmpty { result["date_of_birth"] = value }
        if let value = fields.zipCode, !value.isEmpty { result["zip"] = value }
        return result.isEmpty ? nil : result
    }

    private static func parseDecimal(_ raw: String?) -> Decimal? {
        guard let raw, !raw.isEmpty else { return nil }
        let cleaned = raw
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return Decimal(string: cleaned)
    }
}
