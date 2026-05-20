import Foundation
import OSLog

// All enrollment persistence calls go through this protocol.
// Tests and previews use MockEnrollmentAPIClient.
// Production uses HTTPEnrollmentAPIClient against the Cloudflare Workers API.

protocol EnrollmentAPIClient: Sendable {
    /// Create a new Draft packet for the authenticated applicant.
    func createPacket(stateCode: String) async throws -> EnrollmentPacket

    /// Record all three consent kinds for a packet, then advance status to Submitted for Review.
    /// Consent is recorded first; if it fails, submit is not called.
    func submitPacket(packetId: String) async throws -> EnrollmentPacket

    /// Withdraw (close) a packet on behalf of the applicant.
    /// Sends PATCH with X-Transition-Reason header so the navigator audit log captures context.
    func withdrawPacket(packetId: String, reason: String) async throws -> EnrollmentPacket

    /// Fetch all packets the authenticated applicant has ever created.
    func fetchMyPackets() async throws -> [EnrollmentPacket]

    /// Upload a document file to the enrollment gateway via multipart/form-data.
    /// The gateway stores the file to Supabase Storage and registers the document record.
    func uploadDocument(
        packetId: String,
        imageData: Data,
        mediaType: String,
        documentKind: EnrollmentDocumentKind?,
        onDeviceQualityPassed: Bool
    ) async throws -> EnrollmentDocument

    /// Fetch all documents uploaded to a specific packet.
    func fetchDocuments(packetId: String) async throws -> [EnrollmentDocument]

    /// Fetch pending missing-item requests from the navigator for the applicant's packets.
    func fetchInbox() async throws -> [EnrollmentInboxItem]

    /// POST /v1/enrollment/work-requirements/:packetId/evaluate
    /// Navigator-only. Returns OBBBA compliance determination for the household.
    func evaluateWorkRequirements(
        packetId: String,
        members: [WorkRequirementsHouseholdMember]
    ) async throws -> WorkRequirementsEvaluation

    // MARK: Error risk

    /// POST /v1/enrollment/me/packets/:packetId/error-risk
    /// Returns the pre-submission QC error risk score for this packet.
    func fetchErrorRisk(packetId: String) async throws -> ErrorRiskResult

    // MARK: Argyle connection (T-DR3-8)

    /// GET /v1/enrollment/me/argyle/connect
    /// Returns current Argyle link status for the authenticated applicant.
    func fetchArgyleConnectionStatus() async throws -> ArgyleConnectionStatus

    /// POST /v1/enrollment/me/argyle/connect
    /// Register the Argyle user ID obtained from the iOS Argyle SDK after a
    /// successful link. Idempotent — revokes prior connection automatically.
    func connectArgyle(argyleUserId: String, packetId: String?) async throws -> ArgyleConnectionStatus

    /// DELETE /v1/enrollment/me/argyle/connect
    /// Revoke the active Argyle connection.
    func disconnectArgyle() async throws
}

// MARK: - Errors

enum EnrollmentAPIError: Error, LocalizedError {
    case unauthenticated
    case invalidURL
    case unexpectedStatus(Int, body: String)
    case decodingFailed(underlying: Error)
    case storageFailed(underlying: Error)

    var errorDescription: String? {
        switch self {
        case .unauthenticated:
            return NSLocalizedString("enrollment.api.error.unauthenticated", comment: "")
        case .invalidURL:
            return "The enrollment service URL is not configured."
        case .unexpectedStatus(let code, let body):
            return "Server returned \(code): \(body)"
        case .decodingFailed(let e):
            return "Could not read server response: \(e.localizedDescription)"
        case .storageFailed:
            return NSLocalizedString("enrollment.api.error.storage_failed", comment: "")
        }
    }
}

// MARK: - HTTP implementation

struct HTTPEnrollmentAPIClient: EnrollmentAPIClient {
    let baseURL: URL
    let session: URLSession
    let tokenProvider: @Sendable () async -> String?
    /// Supabase project URL for direct Storage uploads (no Workers hop for binary data).
    let supabaseURL: URL
    let supabaseAnonKey: String

    private static let logger = Logger(subsystem: "Civica", category: "EnrollmentAPIClient")

    init(
        baseURL: URL,
        supabaseURL: URL = SupabaseConfig.current.url,
        supabaseAnonKey: String = SupabaseConfig.current.anonKey,
        session: URLSession = .shared,
        tokenProvider: @escaping @Sendable () async -> String?
    ) {
        self.baseURL = baseURL
        self.supabaseURL = supabaseURL
        self.supabaseAnonKey = supabaseAnonKey
        self.session = session
        self.tokenProvider = tokenProvider
    }

    func createPacket(stateCode: String) async throws -> EnrollmentPacket {
        struct Body: Encodable { let state_code: String }
        return try await post(path: "/me/packets", body: Body(state_code: stateCode))
    }

    func submitPacket(packetId: String) async throws -> EnrollmentPacket {
        // 1. Record consent inline (privacy_notice, data_sharing, terms_of_service).
        try await recordConsent(packetId: packetId)
        // 2. Advance status Draft → Submitted for Review.
        return try await postEmpty(path: "/me/packets/\(packetId)/submit")
    }

    func withdrawPacket(packetId: String, reason: String) async throws -> EnrollmentPacket {
        guard let token = await tokenProvider() else { throw EnrollmentAPIError.unauthenticated }
        guard let url = URL(string: "/me/packets/\(packetId)", relativeTo: baseURL) else {
            throw EnrollmentAPIError.invalidURL
        }
        struct Body: Encodable { let status: String }
        var req = URLRequest(url: url)
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue(reason, forHTTPHeaderField: "X-Transition-Reason")
        req.httpBody = try JSONEncoder().encode(Body(status: EnrollmentPacketStatus.closed.rawValue))
        let (data, response) = try await session.data(for: req)
        try validate(response)
        return try decode(data)
    }

    func fetchMyPackets() async throws -> [EnrollmentPacket] {
        try await getJSON(path: "/me/packets")
    }

    func uploadDocument(
        packetId: String,
        imageData: Data,
        mediaType: String,
        documentKind: EnrollmentDocumentKind?,
        onDeviceQualityPassed: Bool
    ) async throws -> EnrollmentDocument {
        guard let token = await tokenProvider() else { throw EnrollmentAPIError.unauthenticated }
        guard let url = URL(string: "/me/packets/\(packetId)/documents", relativeTo: baseURL) else {
            throw EnrollmentAPIError.invalidURL
        }

        let boundary = "Boundary-\(UUID().uuidString)"
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        req.httpBody = buildMultipartBody(
            boundary: boundary,
            imageData: imageData,
            mediaType: mediaType,
            documentKind: documentKind,
            onDeviceQualityPassed: onDeviceQualityPassed
        )

        let (data, response) = try await session.data(for: req)
        try validate(response)
        return try decode(data)
    }

    func fetchDocuments(packetId: String) async throws -> [EnrollmentDocument] {
        try await getJSON(path: "/me/packets/\(packetId)/documents")
    }

    func fetchInbox() async throws -> [EnrollmentInboxItem] {
        try await getJSON(path: "/me/inbox")
    }

    func evaluateWorkRequirements(
        packetId: String,
        members: [WorkRequirementsHouseholdMember]
    ) async throws -> WorkRequirementsEvaluation {
        struct Body: Encodable { let householdMembers: [WorkRequirementsHouseholdMember] }
        return try await post(
            path: "/work-requirements/\(packetId)/evaluate",
            body: Body(householdMembers: members)
        )
    }

    // MARK: Argyle connection (T-DR3-8)

    func fetchArgyleConnectionStatus() async throws -> ArgyleConnectionStatus {
        try await getJSON(path: "/me/argyle/connect")
    }

    func connectArgyle(argyleUserId: String, packetId: String?) async throws -> ArgyleConnectionStatus {
        struct Body: Encodable {
            let argyle_user_id: String
            let packet_id: String?
        }
        return try await post(
            path: "/me/argyle/connect",
            body: Body(argyle_user_id: argyleUserId, packet_id: packetId)
        )
    }

    func fetchErrorRisk(packetId: String) async throws -> ErrorRiskResult {
        return try await postEmpty(path: "/navigator/packets/\(packetId)/error-risk")
    }

    func disconnectArgyle() async throws {
        guard let token = await tokenProvider() else { throw EnrollmentAPIError.unauthenticated }
        guard let url = URL(string: "/me/argyle/connect", relativeTo: baseURL) else {
            throw EnrollmentAPIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "DELETE"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (_, response) = try await session.data(for: req)
        try validate(response)
    }

    // MARK: - Private helpers

    private func buildMultipartBody(
        boundary: String,
        imageData: Data,
        mediaType: String,
        documentKind: EnrollmentDocumentKind?,
        onDeviceQualityPassed: Bool
    ) -> Data {
        var body = Data()
        let ext = fileExtension(for: mediaType)

        body.appendASCII("--\(boundary)\r\n")
        body.appendASCII("Content-Disposition: form-data; name=\"file\"; filename=\"document.\(ext)\"\r\n")
        body.appendASCII("Content-Type: \(mediaType)\r\n\r\n")
        body.append(imageData)
        body.appendASCII("\r\n")

        if let kind = documentKind {
            body.appendASCII("--\(boundary)\r\n")
            body.appendASCII("Content-Disposition: form-data; name=\"document_kind\"\r\n\r\n")
            body.appendASCII(kind.rawValue)
            body.appendASCII("\r\n")
        }

        body.appendASCII("--\(boundary)\r\n")
        body.appendASCII("Content-Disposition: form-data; name=\"on_device_quality_passed\"\r\n\r\n")
        body.appendASCII(onDeviceQualityPassed ? "true" : "false")
        body.appendASCII("\r\n")
        body.appendASCII("--\(boundary)--\r\n")

        return body
    }

    private func fileExtension(for mediaType: String) -> String {
        switch mediaType {
        case "image/jpeg": return "jpg"
        case "image/png":  return "png"
        case "image/heic": return "heic"
        case "application/pdf": return "pdf"
        default: return "bin"
        }
    }

    private func recordConsent(packetId: String) async throws {
        struct Body: Encodable {
            let signature: String
            let consented_at: String
        }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let body = Body(
            signature: "applicant",
            consented_at: iso.string(from: Date())
        )
        let _: EmptyResponse = try await post(path: "/me/packets/\(packetId)/consent", body: body)
    }

    private func getJSON<R: Decodable>(path: String) async throws -> R {
        guard let token = await tokenProvider() else { throw EnrollmentAPIError.unauthenticated }
        guard let url = URL(string: path, relativeTo: baseURL) else { throw EnrollmentAPIError.invalidURL }
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: req)
        try validate(response)
        return try decode(data)
    }

    private func post<B: Encodable, R: Decodable>(path: String, body: B) async throws -> R {
        guard let token = await tokenProvider() else { throw EnrollmentAPIError.unauthenticated }
        guard let url = URL(string: path, relativeTo: baseURL) else { throw EnrollmentAPIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.data(for: req)
        try validate(response)
        return try decode(data)
    }

    /// POST that expects a 204 No Content or 200 with a body, returning the decoded body.
    private func postEmpty<R: Decodable>(path: String) async throws -> R {
        guard let token = await tokenProvider() else { throw EnrollmentAPIError.unauthenticated }
        guard let url = URL(string: path, relativeTo: baseURL) else { throw EnrollmentAPIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: req)
        try validate(response)
        return try decode(data)
    }

    private func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            throw EnrollmentAPIError.unexpectedStatus(http.statusCode, body: "")
        }
    }

    private func decode<R: Decodable>(_ data: Data) throws -> R {
        do {
            return try JSONDecoder.enrollmentDecoder.decode(R.self, from: data)
        } catch {
            Self.logger.error("Enrollment decode error: \(error.localizedDescription, privacy: .public)")
            throw EnrollmentAPIError.decodingFailed(underlying: error)
        }
    }
}

// Sentinel used when a POST returns 204 No Content.
private struct EmptyResponse: Decodable {}

// MARK: - Argyle response models

struct ArgyleConnectionStatus: Decodable, Sendable {
    let linked: Bool
    let connection: ArgyleConnection?
}

struct ArgyleConnection: Decodable, Sendable {
    let connectionId: String
    let argyleUserId: String
    let linkedAt: Date

    enum CodingKeys: String, CodingKey {
        case connectionId = "connection_id"
        case argyleUserId = "argyle_user_id"
        case linkedAt = "linked_at"
    }
}

private extension Data {
    mutating func appendASCII(_ string: String) {
        if let d = string.data(using: .utf8) { append(d) }
    }
}

// MARK: - Mock for previews, tests, offline mode

final class MockEnrollmentAPIClient: EnrollmentAPIClient, @unchecked Sendable {
    private(set) var createdPackets: [EnrollmentPacket] = []
    private(set) var uploadedDocuments: [EnrollmentDocument] = []
    private(set) var submittedPacketIds: [String] = []

    var inboxItems: [EnrollmentInboxItem] = []
    var shouldFailNext = false

    func createPacket(stateCode: String) async throws -> EnrollmentPacket {
        if shouldFailNext { shouldFailNext = false; throw EnrollmentAPIError.unexpectedStatus(500, body: "mock error") }
        let packet = EnrollmentPacket(
            id: "mock-\(UUID().uuidString.prefix(8))",
            status: .draft,
            stateCode: stateCode,
            createdAt: Date(),
            updatedAt: Date(),
            submittedAt: nil,
            notesForApplicant: nil
        )
        createdPackets.append(packet)
        return packet
    }

    func submitPacket(packetId: String) async throws -> EnrollmentPacket {
        if shouldFailNext { shouldFailNext = false; throw EnrollmentAPIError.unexpectedStatus(409, body: "mock conflict") }
        guard let existing = createdPackets.first(where: { $0.id == packetId }) else {
            throw EnrollmentAPIError.unexpectedStatus(404, body: "packet not found")
        }
        let submitted = EnrollmentPacket(
            id: existing.id,
            status: .submittedForReview,
            stateCode: existing.stateCode,
            createdAt: existing.createdAt,
            updatedAt: Date(),
            submittedAt: Date(),
            notesForApplicant: nil
        )
        if let idx = createdPackets.firstIndex(where: { $0.id == packetId }) {
            createdPackets[idx] = submitted
        }
        submittedPacketIds.append(packetId)
        return submitted
    }

    func uploadDocument(
        packetId: String,
        imageData: Data,
        mediaType: String,
        documentKind: EnrollmentDocumentKind?,
        onDeviceQualityPassed: Bool
    ) async throws -> EnrollmentDocument {
        if shouldFailNext { shouldFailNext = false; throw EnrollmentAPIError.storageFailed(underlying: URLError(.unknown)) }
        let doc = EnrollmentDocument(
            id: "mock-doc-\(UUID().uuidString.prefix(8))",
            packetId: packetId,
            applicantId: "mock-applicant",
            storagePath: "handoffs/\(packetId)/mock.jpg",
            originalFilename: "document.jpg",
            documentKind: documentKind,
            processingStatus: .uploaded,
            onDeviceQualityPassed: onDeviceQualityPassed,
            uploadedAt: Date()
        )
        uploadedDocuments.append(doc)
        return doc
    }

    func withdrawPacket(packetId: String, reason: String) async throws -> EnrollmentPacket {
        if shouldFailNext { shouldFailNext = false; throw EnrollmentAPIError.unexpectedStatus(409, body: "mock conflict") }
        guard let existing = createdPackets.first(where: { $0.id == packetId }) else {
            throw EnrollmentAPIError.unexpectedStatus(404, body: "packet not found")
        }
        let closed = EnrollmentPacket(
            id: existing.id,
            status: .closed,
            stateCode: existing.stateCode,
            createdAt: existing.createdAt,
            updatedAt: Date(),
            submittedAt: existing.submittedAt,
            notesForApplicant: nil
        )
        if let idx = createdPackets.firstIndex(where: { $0.id == packetId }) {
            createdPackets[idx] = closed
        }
        return closed
    }

    func fetchMyPackets() async throws -> [EnrollmentPacket] {
        createdPackets
    }

    func fetchDocuments(packetId: String) async throws -> [EnrollmentDocument] {
        uploadedDocuments.filter { $0.packetId == packetId }
    }

    func fetchInbox() async throws -> [EnrollmentInboxItem] {
        inboxItems
    }

    func evaluateWorkRequirements(
        packetId: String,
        members: [WorkRequirementsHouseholdMember]
    ) async throws -> WorkRequirementsEvaluation {
        if shouldFailNext { shouldFailNext = false; throw EnrollmentAPIError.unexpectedStatus(500, body: "mock error") }
        return WorkRequirementsEvaluation(
            isSubject: true,
            subjectMemberIds: members.prefix(1).map { $0.id },
            timeLimitApplicable: true,
            citations: [WRCitation(section: "OBBBA §10102", title: "Work Requirements", url: nil)],
            exemptionType: nil,
            complianceStatus: "unknown"
        )
    }

    // MARK: Error risk

    func fetchErrorRisk(packetId: String) async throws -> ErrorRiskResult {
        ErrorRiskResult(tier: .low, score: 5, factors: [], engineVersion: "0.2.0")
    }

    // MARK: Argyle connection (T-DR3-8)

    func fetchArgyleConnectionStatus() async throws -> ArgyleConnectionStatus {
        .init(linked: false, connection: nil)
    }

    func connectArgyle(argyleUserId: String, packetId: String?) async throws -> ArgyleConnectionStatus {
        .init(linked: true, connection: ArgyleConnection(
            connectionId: "mock-connection",
            argyleUserId: argyleUserId,
            linkedAt: Date()
        ))
    }

    func disconnectArgyle() async throws {
        // no-op in mock
    }
}

// MARK: - Factory

extension HTTPEnrollmentAPIClient {
    /// Resolves the enrollment API base URL from:
    /// 1. SNAP_ENROLLMENT_API_URL process env (Xcode scheme override for staging)
    /// 2. SNAP_ENROLLMENT_API_URL Info.plist key (production)
    static func resolveBaseURL() -> URL? {
        let env = ProcessInfo.processInfo.environment
        let raw = env["SNAP_ENROLLMENT_API_URL"]
            ?? (Bundle.main.object(forInfoDictionaryKey: "SNAP_ENROLLMENT_API_URL") as? String)
        guard let raw, let url = URL(string: raw) else { return nil }
        // Append the versioned prefix so call sites use short paths like "/me/packets".
        return url.appendingPathComponent("v1/enrollment")
    }
}
