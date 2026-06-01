import Foundation

// MARK: - Packet

/// Mirror of the 8 safe status labels in enrollment-api/src/routes/packets.ts.
/// Never use "approved", "denied", or "eligible" — those are state agency determinations.
enum EnrollmentPacketStatus: String, Codable, Equatable {
    case draft = "Draft"
    case submittedForReview = "Submitted for Review"
    case needsDocuments = "Needs Documents"
    case needsApplicantClarification = "Needs Applicant Clarification"
    case inNavigatorReview = "In Navigator Review"
    case readyForHandoff = "Ready for Handoff"
    case handedOff = "Handed Off"
    case closed = "Closed"

    var displayLabel: String { rawValue }

    var isActionable: Bool {
        switch self {
        case .needsDocuments, .needsApplicantClarification: return true
        default: return false
        }
    }
}

struct EnrollmentPacket: Codable, Identifiable, Equatable {
    let id: String
    let status: EnrollmentPacketStatus
    let stateCode: String
    let createdAt: Date
    let updatedAt: Date
    let submittedAt: Date?
    let notesForApplicant: String?

    enum CodingKeys: String, CodingKey {
        case id, status
        case stateCode = "state_code"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case submittedAt = "submitted_at"
        case notesForApplicant = "notes_for_applicant"
    }
}

// MARK: - Document

/// Wave 6 — BenefitsCal APDMC document-upload taxonomy. The state
/// portal organizes uploaded docs into six buckets; Civica maps each
/// `EnrollmentDocumentKind` to one of these so the autofill extension
/// can drop the file into the right portal slot. Exposed via
/// `EnrollmentDocumentKind.benefitsCalCategory` below.
enum BenefitsCalDocumentCategory: String, Codable, CaseIterable {
    case identityProof
    case releaseOfInformation
    case income
    case rentOrLease
    case expenses
    case addressProof

    func displayLabel(in language: CivicaLanguage) -> String {
        switch (self, language) {
        case (.identityProof, .english), (.identityProof, .mandarin), (.identityProof, .vietnamese), (.identityProof, .tagalog): return "Identity proof"
        case (.identityProof,        .spanish): return "Comprobante de identidad"
        case (.releaseOfInformation, .english), (.releaseOfInformation, .mandarin), (.releaseOfInformation, .vietnamese), (.releaseOfInformation, .tagalog): return "Release of information"
        case (.releaseOfInformation, .spanish): return "Liberación de información"
        case (.income, .english), (.income, .mandarin), (.income, .vietnamese), (.income, .tagalog): return "Income / employment"
        case (.income,               .spanish): return "Ingresos / empleo"
        case (.rentOrLease, .english), (.rentOrLease, .mandarin), (.rentOrLease, .vietnamese), (.rentOrLease, .tagalog): return "Rent, lease, or mortgage"
        case (.rentOrLease,          .spanish): return "Renta, contrato o hipoteca"
        case (.expenses, .english), (.expenses, .mandarin), (.expenses, .vietnamese), (.expenses, .tagalog): return "Expenses"
        case (.expenses,             .spanish): return "Gastos"
        case (.addressProof, .english), (.addressProof, .mandarin), (.addressProof, .vietnamese), (.addressProof, .tagalog): return "Address proof"
        case (.addressProof,         .spanish): return "Comprobante de domicilio"
        }
    }
}

enum EnrollmentDocumentKind: String, Codable, CaseIterable {
    case paystub, photoId = "photo_id", lease, utilityBill = "utility_bill"
    case bankStatement = "bank_statement", taxReturn = "tax_return"
    case benefitLetter = "benefit_letter", other

    /// Wave 6 — Maps each Civica document kind to BenefitsCal's six
    /// portal-side categories so the extension drops the file in the
    /// right slot during autofill.
    var benefitsCalCategory: BenefitsCalDocumentCategory {
        switch self {
        case .photoId:       return .identityProof
        case .paystub:       return .income
        case .taxReturn:     return .income
        case .benefitLetter: return .income
        case .lease:         return .rentOrLease
        case .utilityBill:   return .expenses
        case .bankStatement: return .expenses
        case .other:         return .addressProof
        }
    }

    /// UI display order — most-requested categories first.
    static let orderedCases: [EnrollmentDocumentKind] = [
        .photoId, .paystub, .utilityBill, .lease,
        .bankStatement, .taxReturn, .benefitLetter, .other
    ]

    func displayLabel(in language: CivicaLanguage) -> String {
        switch language {
        case .spanish:
            switch self {
            case .photoId:       return "Identificación con foto"
            case .paystub:       return "Talón de pago"
            case .utilityBill:   return "Factura de servicios"
            case .lease:         return "Contrato de arrendamiento"
            case .bankStatement: return "Estado de cuenta bancario"
            case .taxReturn:     return "Declaración de impuestos"
            case .benefitLetter: return "Carta de beneficios"
            case .other:         return "Otro"
            }
        default:
            switch self {
            case .photoId:       return "Photo ID"
            case .paystub:       return "Pay stub"
            case .utilityBill:   return "Utility bill"
            case .lease:         return "Lease"
            case .bankStatement: return "Bank statement"
            case .taxReturn:     return "Tax return"
            case .benefitLetter: return "Benefit letter"
            case .other:         return "Other"
            }
        }
    }
}

/// Mirrors the canonical `DocumentStatus` Zod schema in `@civica/snap-enums`,
/// which mirrors the DB `processing_status` CHECK constraint:
///   uploaded → classifying → extracting → awaiting_confirmation
///     → confirmed (navigator approved) OR rejected (navigator rejected)
///
/// IMPORTANT: prior values (`pending`/`processing`/`complete`/`failed`) never
/// matched the DB, so the JSON decoder would throw on any live response. If
/// you add a case here, update `documentEnums.ts` and the SQL migration too.
enum EnrollmentDocumentProcessingStatus: String, Codable {
    case uploaded
    case classifying
    case extracting
    case awaitingConfirmation = "awaiting_confirmation"
    case confirmed
    case rejected
}

struct EnrollmentDocument: Codable, Identifiable, Equatable {
    let id: String
    let packetId: String
    let applicantId: String
    let storagePath: String
    let originalFilename: String?
    let documentKind: EnrollmentDocumentKind?
    let processingStatus: EnrollmentDocumentProcessingStatus
    let onDeviceQualityPassed: Bool
    let uploadedAt: Date

    enum CodingKeys: String, CodingKey {
        case id = "document_id"
        case packetId = "packet_id"
        case applicantId = "applicant_id"
        case storagePath = "storage_path"
        case originalFilename = "original_filename"
        case documentKind = "document_kind"
        case processingStatus = "processing_status"
        case onDeviceQualityPassed = "on_device_quality_passed"
        case uploadedAt = "uploaded_at"
    }
}

// MARK: - Inbox item

struct EnrollmentInboxItem: Codable, Identifiable, Equatable {
    let id: String
    let packetId: String
    let prompt: String
    let createdAt: Date
    let resolved: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case packetId = "packet_id"
        case prompt
        case createdAt = "created_at"
        case resolved
    }
}

// MARK: - Error Risk

enum ErrorRiskTier: String, Codable, Equatable {
    case high, medium, low, incomplete
}

struct ErrorRiskResult: Decodable, Equatable {
    let tier: ErrorRiskTier
    let score: Int?
    let factors: [String]
    let engineVersion: String

    enum CodingKeys: String, CodingKey {
        case tier, score, factors
        case engineVersion = "engine_version"
    }
}

// MARK: - Shared decoder

extension JSONDecoder {
    static let enrollmentDecoder: JSONDecoder = {
        let d = JSONDecoder()
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let isoPlain = ISO8601DateFormatter()
        isoPlain.formatOptions = [.withInternetDateTime]
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            if let date = iso.date(from: raw) { return date }
            if let date = isoPlain.date(from: raw) { return date }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unrecognized ISO-8601 date: \(raw)"
            )
        }
        return d
    }()
}
