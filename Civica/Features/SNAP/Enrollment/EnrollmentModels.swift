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

enum EnrollmentDocumentKind: String, Codable, CaseIterable {
    case paystub, photoId = "photo_id", lease, utilityBill = "utility_bill"
    case bankStatement = "bank_statement", taxReturn = "tax_return"
    case benefitLetter = "benefit_letter", other

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

enum EnrollmentDocumentProcessingStatus: String, Codable {
    case pending, processing, complete, failed
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
