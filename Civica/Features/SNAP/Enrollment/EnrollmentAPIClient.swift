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

    /// Upload image data to Supabase Storage and register the document record.
    /// Returns the created document; caller can use `document.storagePath` for receipts.
    func uploadDocument(
        packetId: String,
        imageData: Data,
        mediaType: String,
        documentKind: EnrollmentDocumentKind?,
        onDeviceQualityPassed: Bool
    ) async throws -> EnrollmentDocument

    /// Fetch pending missing-item requests from the navigator for the applicant's packets.
    func fetchInbox() async throws -> [EnrollmentInboxItem]
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

    func uploadDocument(
        packetId: String,
        imageData: Data,
        mediaType: String,
        documentKind: EnrollmentDocumentKind?,
        onDeviceQualityPassed: Bool
    ) async throws -> EnrollmentDocument {
        guard let token = await tokenProvider() else { throw EnrollmentAPIError.unauthenticated }

        // 1. Upload raw bytes to Supabase Storage ("handoffs" bucket).
        let filename = "\(packetId)/\(UUID().uuidString).jpg"
        let storagePath = try await uploadToStorage(
            bucket: "handoffs",
            path: filename,
            data: imageData,
            contentType: mediaType,
            token: token
        )

        // 2. Register the document record in the enrollment API.
        struct Body: Encodable {
            let packet_id: String
            let applicant_id: String?   // resolved server-side when nil
            let storage_path: String
            let document_kind: String?
            let on_device_quality_passed: Bool
        }
        let body = Body(
            packet_id: packetId,
            applicant_id: nil,
            storage_path: storagePath,
            document_kind: documentKind?.rawValue,
            on_device_quality_passed: onDeviceQualityPassed
        )
        return try await post(path: "/documents", body: body)
    }

    func fetchInbox() async throws -> [EnrollmentInboxItem] {
        try await getJSON(path: "/me/inbox")
    }

    // MARK: - Private helpers

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

    private func uploadToStorage(
        bucket: String,
        path: String,
        data: Data,
        contentType: String,
        token: String
    ) async throws -> String {
        guard let url = URL(string: "/storage/v1/object/\(bucket)/\(path)", relativeTo: supabaseURL) else {
            throw EnrollmentAPIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.httpBody = data

        let (_, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw EnrollmentAPIError.unexpectedStatus(http.statusCode, body: "storage upload")
        }
        // Return the logical path (bucket/filename) stored in uploaded_documents.storage_path.
        return "\(bucket)/\(path)"
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
            processingStatus: .pending,
            onDeviceQualityPassed: onDeviceQualityPassed,
            uploadedAt: Date()
        )
        uploadedDocuments.append(doc)
        return doc
    }

    func fetchInbox() async throws -> [EnrollmentInboxItem] {
        inboxItems
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
