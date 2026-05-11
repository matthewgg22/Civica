import Foundation

// EXPERIMENTAL SILOED MODULE: Codable mirrors of the backend document
// pipeline schemas in backend/civic_api/snap/documents/schemas.py.
// Manual snapshot — keep in sync with the Python side. The eventual
// codegen pipeline (Phase E+1) will replace this file.

// MARK: - Document classification

enum SNAPExtractedDocumentType: String, Codable, Sendable {
    case unknown
    case paystub
    case photoID = "photo_id"
    case lease
    case utilityBill = "utility_bill"
    case benefitsLetter = "benefits_letter"
    case other
}

enum SNAPDocumentConfidenceBand: String, Codable, Sendable {
    case high
    case medium
    case low
}

struct SNAPDocumentClassification: Codable, Sendable, Equatable {
    let documentType: SNAPExtractedDocumentType
    let confidence: Double
    let confidenceBand: SNAPDocumentConfidenceBand
    let rationale: String

    enum CodingKeys: String, CodingKey {
        case documentType = "document_type"
        case confidence
        case confidenceBand = "confidence_band"
        case rationale
    }
}

// MARK: - Paystub

enum SNAPPaystubDeductionCategory: String, Codable, Sendable {
    case federalIncomeTax = "federal_income_tax"
    case stateIncomeTax = "state_income_tax"
    case localIncomeTax = "local_income_tax"
    case socialSecurity = "social_security"
    case medicare
    case healthInsurance = "health_insurance"
    case dentalInsurance = "dental_insurance"
    case visionInsurance = "vision_insurance"
    case retirement401k = "retirement_401k"
    case retirementIRA = "retirement_ira"
    case hsa
    case fsa
    case unionDues = "union_dues"
    case garnishment
    case other
}

struct SNAPPaystubDeduction: Codable, Sendable, Equatable {
    let category: SNAPPaystubDeductionCategory
    let labelAsPrinted: String
    let amount: Decimal

    enum CodingKeys: String, CodingKey {
        case category
        case labelAsPrinted = "label_as_printed"
        case amount
    }
}

struct SNAPPaystub: Codable, Sendable, Equatable {
    let employerName: String
    let employerAddress: String?
    let payPeriodStart: String   // ISO YYYY-MM-DD
    let payPeriodEnd: String
    let payDate: String?
    let hoursWorkedInPeriod: Decimal?
    let hourlyRate: Decimal?
    let isSalaried: Bool
    let grossPayPeriod: Decimal
    let netPayPeriod: Decimal
    let deductions: [SNAPPaystubDeduction]
    let grossPayYTD: Decimal?
    let netPayYTD: Decimal?
    let payFrequencyLabelAsPrinted: String?

    enum CodingKeys: String, CodingKey {
        case employerName = "employer_name"
        case employerAddress = "employer_address"
        case payPeriodStart = "pay_period_start"
        case payPeriodEnd = "pay_period_end"
        case payDate = "pay_date"
        case hoursWorkedInPeriod = "hours_worked_in_period"
        case hourlyRate = "hourly_rate"
        case isSalaried = "is_salaried"
        case grossPayPeriod = "gross_pay_period"
        case netPayPeriod = "net_pay_period"
        case deductions
        case grossPayYTD = "gross_pay_ytd"
        case netPayYTD = "net_pay_ytd"
        case payFrequencyLabelAsPrinted = "pay_frequency_label_as_printed"
    }
}

// MARK: - Validation flags + extraction wrapper

struct SNAPValidationFlag: Codable, Sendable, Identifiable, Equatable {
    let code: String
    let messageEn: String
    let messageEs: String
    let severity: String

    var id: String { code }

    enum CodingKeys: String, CodingKey {
        case code
        case messageEn = "message_en"
        case messageEs = "message_es"
        case severity
    }
}

struct SNAPExtractionResult: Codable, Sendable, Equatable {
    let classification: SNAPDocumentClassification
    let extractedPaystub: SNAPPaystub?
    let extractedOther: [String: String]?
    let validationFlags: [SNAPValidationFlag]
    let extractionConfidence: Double

    enum CodingKeys: String, CodingKey {
        case classification
        case extractedPaystub = "extracted_paystub"
        case extractedOther = "extracted_other"
        case validationFlags = "validation_flags"
        case extractionConfidence = "extraction_confidence"
    }
}

// MARK: - Wire bodies

struct SNAPDocumentUploadResponse: Codable, Sendable {
    let documentID: String
    let processingStatus: String

    enum CodingKeys: String, CodingKey {
        case documentID = "document_id"
        case processingStatus = "processing_status"
    }
}

struct SNAPDocumentStatusResponse: Codable, Sendable {
    let documentID: String
    let sessionID: String
    let documentType: SNAPExtractedDocumentType
    let onDeviceQualityPassed: Bool
    let userConfirmed: Bool
    let extraction: SNAPExtractionResult?

    enum CodingKeys: String, CodingKey {
        case documentID = "document_id"
        case sessionID = "session_id"
        case documentType = "document_type"
        case onDeviceQualityPassed = "on_device_quality_passed"
        case userConfirmed = "user_confirmed"
        case extraction
    }
}
