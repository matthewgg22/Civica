import Foundation
import OSLog

// HTTP client for the re-entry routes on the Civica gateway
// (`apps/enrollment-api/src/routes/me.ts` — GET /me/re-entry-suggestion
// and POST /me/re-enroll-from/:packet_id).
//
// Mirrors the EBTBalanceAPIClient / EnrollmentAPIClient pattern:
// protocol + production HTTP impl + Mock impl for tests and previews.
// Auth lives in tokenProvider — shared with EnrollmentAPIClient at the
// composition root.

// MARK: - Errors

enum ReEntryAPIError: Error, Equatable {
    case unauthenticated
    case invalidURL
    case http(status: Int, message: String?)
    case decoding(String)
    case transport(String)
}

// MARK: - Protocol

protocol ReEntryAPIClient: Sendable {
    /// GET /me/re-entry-suggestion — returns whether the signed-in applicant
    /// has a recently-Closed packet eligible for the re-entry path.
    func fetchSuggestion() async throws -> ReEntrySuggestionResponse

    /// POST /me/re-enroll-from/:packet_id — creates a new Draft hydrated
    /// from the source packet's answers. Idempotent: returns an existing
    /// active packet if the applicant already has one.
    func reEnroll(fromPacketId packetId: String) async throws -> ReEnrollResponse

    /// GET /me/packets/:packetId/retention-risk — returns the Unrath-
    /// calibrated retention score for any packet owned by the applicant.
    /// G2 doesn't consume this (defaults dominate for closed packets);
    /// surfaced here so G4 (PhantomRecert hero on active packets) can
    /// share the same client + auth path.
    func fetchRetentionRisk(packetId: String) async throws -> RetentionRiskResult
}

// MARK: - HTTP implementation

struct HTTPReEntryAPIClient: ReEntryAPIClient {
    let baseURL: URL
    let session: URLSession
    let tokenProvider: @Sendable () async -> String?

    private static let logger = Logger(subsystem: "Civica", category: "ReEntryAPIClient")

    init(
        baseURL: URL,
        session: URLSession = .shared,
        tokenProvider: @escaping @Sendable () async -> String?
    ) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider
    }

    func fetchSuggestion() async throws -> ReEntrySuggestionResponse {
        try await getJSON(path: "/me/re-entry-suggestion")
    }

    func fetchRetentionRisk(packetId: String) async throws -> RetentionRiskResult {
        try await getJSON(path: "/me/packets/\(packetId)/retention-risk")
    }

    func reEnroll(fromPacketId packetId: String) async throws -> ReEnrollResponse {
        // The gateway accepts an empty POST body; the path carries the source
        // packet id. We send a zero-byte body with explicit Content-Length so
        // some HTTP intermediaries don't reject the request.
        guard let token = await tokenProvider() else { throw ReEntryAPIError.unauthenticated }
        guard let url = URL(string: "/me/re-enroll-from/\(packetId)", relativeTo: baseURL) else {
            throw ReEntryAPIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = Data()

        let (data, response) = try await session.data(for: req)
        try validate(response, body: data)
        return try decode(data)
    }

    // MARK: - HTTP helpers

    private func getJSON<T: Decodable>(path: String) async throws -> T {
        guard let token = await tokenProvider() else { throw ReEntryAPIError.unauthenticated }
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw ReEntryAPIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: req)
        try validate(response, body: data)
        return try decode(data)
    }

    private func validate(_ response: URLResponse, body: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw ReEntryAPIError.transport("Non-HTTP response")
        }
        guard (200..<300).contains(http.statusCode) else {
            let text = String(data: body, encoding: .utf8)
            throw ReEntryAPIError.http(status: http.statusCode, message: text)
        }
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw ReEntryAPIError.decoding(String(describing: error))
        }
    }
}

// MARK: - Mock

/// In-memory mock for tests and previews. Each method returns the
/// pre-configured response or throws the pre-configured error.
final class MockReEntryAPIClient: ReEntryAPIClient, @unchecked Sendable {
    var suggestionResponse: ReEntrySuggestionResponse?
    var suggestionError: Error?
    var reEnrollResponse: ReEnrollResponse?
    var reEnrollError: Error?
    var retentionRiskResponse: RetentionRiskResult?
    var retentionRiskError: Error?

    private(set) var fetchSuggestionCallCount = 0
    private(set) var lastReEnrollPacketId: String?
    private(set) var lastRetentionRiskPacketId: String?

    init(
        suggestion: ReEntrySuggestionResponse? = nil,
        reEnroll: ReEnrollResponse? = nil,
        retentionRisk: RetentionRiskResult? = nil
    ) {
        self.suggestionResponse = suggestion
        self.reEnrollResponse = reEnroll
        self.retentionRiskResponse = retentionRisk
    }

    func fetchSuggestion() async throws -> ReEntrySuggestionResponse {
        fetchSuggestionCallCount += 1
        if let err = suggestionError { throw err }
        guard let r = suggestionResponse else {
            throw ReEntryAPIError.transport("MockReEntryAPIClient.suggestionResponse not set")
        }
        return r
    }

    func reEnroll(fromPacketId packetId: String) async throws -> ReEnrollResponse {
        lastReEnrollPacketId = packetId
        if let err = reEnrollError { throw err }
        guard let r = reEnrollResponse else {
            throw ReEntryAPIError.transport("MockReEntryAPIClient.reEnrollResponse not set")
        }
        return r
    }

    func fetchRetentionRisk(packetId: String) async throws -> RetentionRiskResult {
        lastRetentionRiskPacketId = packetId
        if let err = retentionRiskError { throw err }
        guard let r = retentionRiskResponse else {
            throw ReEntryAPIError.transport("MockReEntryAPIClient.retentionRiskResponse not set")
        }
        return r
    }
}
