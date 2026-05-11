import Foundation

// EXPERIMENTAL SILOED MODULE: SNAP conversational pipeline network boundary.
// All HTTP for the SNAP conversation flow goes through this protocol.
// Tests, previews, and offline modes use MockSNAPNetworkClient; production
// uses HTTPSNAPNetworkClient against the FastAPI backend.

protocol SNAPNetworkClient: Sendable {
    /// Open a new SNAP conversation session and fetch the opening assistant turn.
    func startSession(state: String, language: String) async throws -> SNAPStartSessionResponse

    /// Submit a user response and receive the next assistant turn.
    func sendTurn(sessionId: String, userText: String) async throws -> SNAPTurnResult

    /// Redeem a magic-link token to recover an existing session on a new device.
    func recoverSession(token: String) async throws -> SNAPStartSessionResponse

    /// Upload a captured document (already passed the on-device quality gate).
    /// Returns immediately; iOS polls `getDocumentStatus` for the extraction.
    func uploadDocument(
        sessionId: String,
        imageData: Data,
        mediaType: String,
        onDeviceQualityPassed: Bool
    ) async throws -> SNAPDocumentUploadResponse

    /// Poll for extraction status / extracted fields.
    func getDocumentStatus(documentId: String) async throws -> SNAPDocumentStatusResponse

    /// Mark the user's confirmation (with optional corrections diff).
    func confirmDocument(
        documentId: String,
        corrections: [String: String]?
    ) async throws -> SNAPDocumentStatusResponse

    /// Generate the application PDF for the session and return the bytes.
    /// The caller is responsible for writing to disk and presenting via
    /// share sheet — this method is just the network round trip.
    func generateApplicationPDF(sessionId: String) async throws -> Data
}

// MARK: - Production HTTPS client

enum SNAPNetworkError: Error {
    case invalidURL
    case unexpectedStatus(Int)
    case decodingFailed(underlying: Error)
}

struct HTTPSNAPNetworkClient: SNAPNetworkClient {
    let baseURL: URL
    let session: URLSession
    let authTokenProvider: @Sendable () -> String?

    init(
        baseURL: URL,
        session: URLSession = .shared,
        authTokenProvider: @escaping @Sendable () -> String? = { nil }
    ) {
        self.baseURL = baseURL
        self.session = session
        self.authTokenProvider = authTokenProvider
    }

    func startSession(state: String, language: String) async throws -> SNAPStartSessionResponse {
        try await post(
            path: "/snap/sessions",
            body: SNAPStartSessionRequest(state: state, language: language)
        )
    }

    func sendTurn(sessionId: String, userText: String) async throws -> SNAPTurnResult {
        try await post(
            path: "/snap/sessions/\(sessionId)/turns",
            body: SNAPSendTurnRequest(userText: userText)
        )
    }

    func recoverSession(token: String) async throws -> SNAPStartSessionResponse {
        try await post(
            path: "/snap/sessions/recover",
            body: SNAPRecoverSessionRequest(token: token)
        )
    }

    func uploadDocument(
        sessionId: String,
        imageData: Data,
        mediaType: String,
        onDeviceQualityPassed: Bool
    ) async throws -> SNAPDocumentUploadResponse {
        guard let url = URL(string: "/snap/sessions/\(sessionId)/documents", relativeTo: baseURL) else {
            throw SNAPNetworkError.invalidURL
        }
        let boundary = "civica.snap.\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        if let token = authTokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = makeMultipartBody(
            boundary: boundary,
            imageData: imageData,
            mediaType: mediaType,
            onDeviceQualityPassed: onDeviceQualityPassed
        )

        let (data, response) = try await session.data(for: request)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw SNAPNetworkError.unexpectedStatus(http.statusCode)
        }
        do {
            return try JSONDecoder().decode(SNAPDocumentUploadResponse.self, from: data)
        } catch {
            throw SNAPNetworkError.decodingFailed(underlying: error)
        }
    }

    func getDocumentStatus(documentId: String) async throws -> SNAPDocumentStatusResponse {
        try await getJSON(path: "/snap/documents/\(documentId)")
    }

    func confirmDocument(
        documentId: String,
        corrections: [String: String]?
    ) async throws -> SNAPDocumentStatusResponse {
        struct Body: Encodable {
            let corrections: [String: String]?
        }
        return try await post(
            path: "/snap/documents/\(documentId)/confirm",
            body: Body(corrections: corrections)
        )
    }

    func generateApplicationPDF(sessionId: String) async throws -> Data {
        guard let url = URL(string: "/snap/sessions/\(sessionId)/application/pdf", relativeTo: baseURL) else {
            throw SNAPNetworkError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        if let token = authTokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await session.data(for: request)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw SNAPNetworkError.unexpectedStatus(http.statusCode)
        }
        return data
    }

    private func makeMultipartBody(
        boundary: String,
        imageData: Data,
        mediaType: String,
        onDeviceQualityPassed: Bool
    ) -> Data {
        var body = Data()
        let lineBreak = "\r\n"
        body.append("--\(boundary)\(lineBreak)".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"on_device_quality_passed\"\(lineBreak)\(lineBreak)".data(using: .utf8)!)
        body.append("\(onDeviceQualityPassed ? "true" : "false")\(lineBreak)".data(using: .utf8)!)
        body.append("--\(boundary)\(lineBreak)".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"document.jpg\"\(lineBreak)".data(using: .utf8)!)
        body.append("Content-Type: \(mediaType)\(lineBreak)\(lineBreak)".data(using: .utf8)!)
        body.append(imageData)
        body.append("\(lineBreak)--\(boundary)--\(lineBreak)".data(using: .utf8)!)
        return body
    }

    private func getJSON<Response: Decodable>(path: String) async throws -> Response {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw SNAPNetworkError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = authTokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await session.data(for: request)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw SNAPNetworkError.unexpectedStatus(http.statusCode)
        }
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw SNAPNetworkError.decodingFailed(underlying: error)
        }
    }

    private func post<Body: Encodable, Response: Decodable>(
        path: String,
        body: Body
    ) async throws -> Response {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw SNAPNetworkError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authTokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw SNAPNetworkError.unexpectedStatus(http.statusCode)
        }
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw SNAPNetworkError.decodingFailed(underlying: error)
        }
    }
}

// MARK: - Mock client for previews, dev builds without backend, and tests
//
// The mock walks a canned conversation that exercises the canonical demo
// case from the verification plan: 1-person MA household, $1,800 wages,
// $1,400 rent, heating SUA. Driven by turn index — tests can swap in a
// custom `responder` to script other paths.

final class MockSNAPNetworkClient: SNAPNetworkClient, @unchecked Sendable {
    typealias Responder = (_ turnIndex: Int, _ userText: String) -> SNAPTurnResult

    private let responder: Responder
    private var sessionTurnCount: [String: Int] = [:]
    private let lock = NSLock()

    init(responder: @escaping Responder = MockSNAPNetworkClient.defaultResponder) {
        self.responder = responder
    }

    func startSession(state: String, language: String) async throws -> SNAPStartSessionResponse {
        let sessionId = "mock-\(UUID().uuidString.prefix(8))"
        let opening = SNAPTurnResult(
            sessionId: sessionId,
            turnIndex: 0,
            assistantQuestion: language == "es"
                ? "Hola — para empezar, ¿quién vive contigo?"
                : "Hi — to start, who's in your household with you?",
            helperText: nil,
            expectedInputType: .freeText,
            choiceOptions: nil,
            nextTopic: .householdComposition,
            eligibilityPreview: nil,
            isTerminal: false,
            needsClarification: false,
            clarificationText: nil,
            costTelemetry: [],
            confidence: 1.0
        )
        lock.lock(); sessionTurnCount[sessionId] = 1; lock.unlock()
        return SNAPStartSessionResponse(sessionId: sessionId, openingTurn: opening)
    }

    func sendTurn(sessionId: String, userText: String) async throws -> SNAPTurnResult {
        lock.lock()
        let turnIndex = sessionTurnCount[sessionId] ?? 0
        sessionTurnCount[sessionId] = turnIndex + 1
        lock.unlock()
        return responder(turnIndex, userText)
    }

    func recoverSession(token: String) async throws -> SNAPStartSessionResponse {
        try await startSession(state: "MA", language: "en")
    }

    // Documents — mock implementations for previews and tests.

    private var mockDocuments: [String: SNAPDocumentStatusResponse] = [:]

    func uploadDocument(
        sessionId: String,
        imageData: Data,
        mediaType: String,
        onDeviceQualityPassed: Bool
    ) async throws -> SNAPDocumentUploadResponse {
        let documentId = "mock-doc-\(UUID().uuidString.prefix(8))"
        let status = onDeviceQualityPassed ? "processing" : "rejected"

        if onDeviceQualityPassed {
            // Pretend extraction completes immediately. Real backend
            // would set this asynchronously; iOS polls.
            let mockExtraction = SNAPExtractionResult(
                classification: SNAPDocumentClassification(
                    documentType: .paystub,
                    confidence: 0.94,
                    confidenceBand: .high,
                    rationale: "Visible 'Pay Period' header and 'Net Pay' line."
                ),
                extractedPaystub: SNAPPaystub(
                    employerName: "Acme Retail",
                    employerAddress: nil,
                    payPeriodStart: "2025-04-01",
                    payPeriodEnd: "2025-04-14",
                    payDate: "2025-04-18",
                    hoursWorkedInPeriod: Decimal(80),
                    hourlyRate: Decimal(string: "22.50"),
                    isSalaried: false,
                    grossPayPeriod: Decimal(1800),
                    netPayPeriod: Decimal(1380),
                    deductions: [],
                    grossPayYTD: Decimal(14400),
                    netPayYTD: Decimal(11040),
                    payFrequencyLabelAsPrinted: "BI-WEEKLY"
                ),
                extractedOther: nil,
                validationFlags: [],
                extractionConfidence: 0.92
            )
            mockDocuments[documentId] = SNAPDocumentStatusResponse(
                documentID: documentId,
                sessionID: sessionId,
                documentType: .paystub,
                onDeviceQualityPassed: true,
                userConfirmed: false,
                extraction: mockExtraction
            )
        } else {
            mockDocuments[documentId] = SNAPDocumentStatusResponse(
                documentID: documentId,
                sessionID: sessionId,
                documentType: .unknown,
                onDeviceQualityPassed: false,
                userConfirmed: false,
                extraction: nil
            )
        }
        return SNAPDocumentUploadResponse(
            documentID: documentId,
            processingStatus: status
        )
    }

    func getDocumentStatus(documentId: String) async throws -> SNAPDocumentStatusResponse {
        guard let status = mockDocuments[documentId] else {
            throw SNAPNetworkError.unexpectedStatus(404)
        }
        return status
    }

    func confirmDocument(
        documentId: String,
        corrections: [String: String]?
    ) async throws -> SNAPDocumentStatusResponse {
        guard let existing = mockDocuments[documentId] else {
            throw SNAPNetworkError.unexpectedStatus(404)
        }
        let updated = SNAPDocumentStatusResponse(
            documentID: existing.documentID,
            sessionID: existing.sessionID,
            documentType: existing.documentType,
            onDeviceQualityPassed: existing.onDeviceQualityPassed,
            userConfirmed: true,
            extraction: existing.extraction
        )
        mockDocuments[documentId] = updated
        return updated
    }

    func generateApplicationPDF(sessionId: String) async throws -> Data {
        // Return a minimal valid PDF byte sequence for previews/tests.
        // Real renderer is exercised by the backend test suite.
        let header = Data([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A]) // %PDF-1.4\n
        return header
    }

    /// Default responder walks the canonical demo conversation. Returns a
    /// terminal eligibility result on the 4th send. Tests that want
    /// different behavior pass a custom responder to the initializer.
    static let defaultResponder: Responder = { turnIndex, _ in
        let sessionId = "mock-canonical"
        switch turnIndex {
        case 1:
            return SNAPTurnResult(
                sessionId: sessionId,
                turnIndex: turnIndex,
                assistantQuestion: "Do you receive TANF, SSI, or other cash assistance?",
                helperText: nil,
                expectedInputType: .yesNo,
                choiceOptions: nil,
                nextTopic: .cashProgramReceipt,
                eligibilityPreview: nil,
                isTerminal: false,
                needsClarification: false,
                clarificationText: nil,
                costTelemetry: [],
                confidence: 0.97
            )
        case 2:
            return SNAPTurnResult(
                sessionId: sessionId,
                turnIndex: turnIndex,
                assistantQuestion: "What's your gross monthly income from work?",
                helperText: "If your hours change a lot, give a typical month.",
                expectedInputType: .numericDollars,
                choiceOptions: nil,
                nextTopic: .earnedIncome,
                eligibilityPreview: nil,
                isTerminal: false,
                needsClarification: false,
                clarificationText: nil,
                costTelemetry: [],
                confidence: 0.98
            )
        case 3:
            return SNAPTurnResult(
                sessionId: sessionId,
                turnIndex: turnIndex,
                assistantQuestion: "How much do you pay in rent or mortgage each month?",
                helperText: nil,
                expectedInputType: .numericDollars,
                choiceOptions: nil,
                nextTopic: .housingCost,
                eligibilityPreview: nil,
                isTerminal: false,
                needsClarification: false,
                clarificationText: nil,
                costTelemetry: [],
                confidence: 0.96
            )
        default:
            let verdict = SNAPEligibilityResult(
                status: .eligible,
                monthlyBenefit: Decimal(135),
                expeditedEligible: false,
                contributingFactors: [
                    "ma_bbce_applied",
                    "earned_income_deduction_applied",
                    "excess_shelter_deduction_applied"
                ],
                requiredVerifications: [
                    SNAPRequiredVerification(
                        code: "identity_photo_id",
                        labelEn: "Photo ID",
                        labelEs: "Identificación con foto",
                        explanationEn: "A driver's license, state ID, passport, or similar.",
                        explanationEs: "Licencia de conducir, identificación estatal, pasaporte o similar.",
                        isRequiredForInitialApplication: true,
                        canBePostponedForExpedited: false
                    ),
                    SNAPRequiredVerification(
                        code: "income_paystub",
                        labelEn: "Recent paystub",
                        labelEs: "Recibo de pago reciente",
                        explanationEn: "Most recent paystub covering the last 30 days.",
                        explanationEs: "El recibo de pago más reciente que cubra los últimos 30 días.",
                        isRequiredForInitialApplication: true,
                        canBePostponedForExpedited: false
                    )
                ],
                benefitCalculation: SNAPBenefitCalculationDetail(
                    grossMonthlyIncome: Decimal(1800),
                    earnedIncomeDeduction: Decimal(360),
                    standardDeduction: Decimal(204),
                    dependentCareDeduction: Decimal(0),
                    medicalDeduction: Decimal(0),
                    childSupportDeduction: Decimal(0),
                    excessShelterDeduction: Decimal(712),
                    netMonthlyIncome: Decimal(524),
                    thirtyPercentOfNet: Decimal(157),
                    maxAllotmentForHouseholdSize: Decimal(292),
                    monthlyBenefit: Decimal(135)
                ),
                ineligibilityReason: nil,
                effectiveDate: "2025-05-10",
                rulesVersion: "federal-2025-05-10/MA-2025-05-10"
            )
            return SNAPTurnResult(
                sessionId: sessionId,
                turnIndex: turnIndex,
                assistantQuestion:
                    "Based on what you've shared, you appear likely eligible for about $135/month. I'll list the documents you'll need to submit.",
                helperText: nil,
                expectedInputType: .freeText,
                choiceOptions: nil,
                nextTopic: .done,
                eligibilityPreview: verdict,
                isTerminal: true,
                needsClarification: false,
                clarificationText: nil,
                costTelemetry: [],
                confidence: 0.96
            )
        }
    }
}
