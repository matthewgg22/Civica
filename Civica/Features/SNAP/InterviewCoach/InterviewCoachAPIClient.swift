import Foundation
import os

// HTTP client for the Interview Coach (practice session) backend.
//
// This client targets the enrollment-api Cloudflare Workers project, which
// owns the Claude-Haiku-backed practice interview routes shipped in PR #181
// (T15). The legacy Supabase Edge Function (`/functions/v1/interview-coach-turn`)
// is no longer wired here — see git history if you need to recover it.
//
// Routes consumed:
//   POST /v1/enrollment/recert/:recertId/practice/start
//   POST /v1/enrollment/recert/:recertId/practice/:sessionId/respond
//   GET  /v1/enrollment/recert/:recertId/practice/:sessionId
//
// Auth: enrollment-api requires the user's Supabase JWT in the
// `Authorization: Bearer <jwt>` header. The token is pulled from the
// CivicaEnrollmentAuth session — same pattern as EnrollmentAPIClient.
//
// Routes consumed (additions in the practice-chatbot gap-closing pass):
//   POST /v1/enrollment/recert/:recertId/practice/:sessionId/score
//     — end-of-session scoring. Idempotent. Returns InterviewScoreResponseDTO.

final class InterviewCoachAPIClient {
    enum CoachAPIError: Error, LocalizedError, Equatable {
        case missingBaseURL(String)
        case notAuthenticated
        case notAuthorized         // 401
        case forbidden(String)     // 403 (e.g. navigator-required)
        case notFound              // 404
        case sessionLost           // 410 — session_id no longer in memory
        case serverError(status: Int, body: String)
        case decodingFailed(String)
        case emptyResponse

        var errorDescription: String? {
            switch self {
            case .missingBaseURL(let reason): return "Interview Coach base URL is invalid: \(reason)"
            case .notAuthenticated:           return NSLocalizedString("enrollment.api.error.unauthenticated", comment: "")
            case .notAuthorized:              return "Please sign in to use the practice interview."
            case .forbidden(let msg):         return msg.isEmpty ? "Not authorized for this resource." : msg
            case .notFound:                   return "Practice session not found."
            case .sessionLost:                return "Your practice session expired. Please start a new one."
            case .serverError(let status, let body): return "Server returned \(status): \(body)"
            case .decodingFailed(let msg):    return "Could not read server response: \(msg)"
            case .emptyResponse:              return "Interview Coach returned an empty response."
            }
        }
    }

    // Legacy UserDefaults key that previously held a stable cross-launch ID.
    // Retained as a constant so CivicaUserData's launch-time cleanup can find it
    // and delete it on existing installs. Do not write to this key from new code.
    static let legacyAnonymousIDKey = "co.civica.interview_coach.anonymous_id.v1"

    private let baseURL: URL
    private let tokenProvider: @Sendable () async -> String?
    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let logger = Logger(subsystem: "Civica", category: "InterviewCoachAPIClient")
    private let requestTimeout: TimeInterval = 65

    /// Default enrollment-api host. Mirrors the resolver in
    /// `HTTPEnrollmentAPIClient.resolveBaseURL()` — falls back to the
    /// production Workers URL when neither env nor Info.plist override
    /// is present. The Bundle/env lookup keys are shared with the
    /// EnrollmentAPIClient so a staging override only has to be set once.
    static func defaultBaseURL() -> URL {
        let env = ProcessInfo.processInfo.environment
        let raw = env["SNAP_ENROLLMENT_API_URL"]
            ?? (Bundle.main.object(forInfoDictionaryKey: "SNAP_ENROLLMENT_API_URL") as? String)
            ?? "https://civica-enrollment-api.civica-api.workers.dev"
        let root = URL(string: raw) ?? URL(string: "https://civica-enrollment-api.civica-api.workers.dev")!
        return root.appendingPathComponent("v1/enrollment")
    }

    init(
        baseURL: URL = InterviewCoachAPIClient.defaultBaseURL(),
        tokenProvider: @escaping @Sendable () async -> String? = { nil },
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.tokenProvider = tokenProvider
        self.session = session

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = encoder

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder = decoder
    }

    // MARK: - Public API (recert/practice/*)

    /// POST /v1/enrollment/recert/:recertId/practice/start
    /// The route currently derives the snapshot from packet_answers
    /// server-side, so the body is ignored — we still send an empty `{}`
    /// for forward-compatibility with future schema additions.
    func startPracticeSession(
        recertId: String,
        snapshot: PacketSnapshotDTO? = nil
    ) async throws -> StartPracticeResponseDTO {
        let path = "/recert/\(recertId)/practice/start"
        // Server ignores body today; pass snapshot when supplied so we're
        // ready when the route schema accepts it.
        if let snapshot {
            return try await postJSON(path: path, body: snapshot)
        } else {
            return try await postJSON(path: path, body: EmptyBody())
        }
    }

    /// POST /v1/enrollment/recert/:recertId/practice/:sessionId/respond
    /// `audioBytesDuration` is sent when the response was captured via
    /// SNAPVoiceIntakeService on-device — the orchestrator threads it
    /// into the AI coach prompt as a "stuck vs confident" signal.
    func sendPracticeResponse(
        recertId: String,
        sessionId: String,
        response: String,
        audioBytesDuration: Int? = nil
    ) async throws -> PracticeRespondResponseDTO {
        let path = "/recert/\(recertId)/practice/\(sessionId)/respond"
        let body = PracticeRespondRequestDTO(userMessage: response, audioBytesDuration: audioBytesDuration)
        return try await postJSON(path: path, body: body)
    }

    /// GET /v1/enrollment/recert/:recertId/practice/:sessionId
    func fetchPracticeSession(
        recertId: String,
        sessionId: String
    ) async throws -> PracticeSessionStateDTO {
        let path = "/recert/\(recertId)/practice/\(sessionId)"
        return try await getJSON(path: path)
    }

    /// POST /v1/enrollment/recert/:recertId/practice/:sessionId/score
    /// Generates (or returns cached) end-of-session score. Idempotent on
    /// the backend — repeated calls with the same sessionId return the
    /// same score row. Only callable when the session is `done`.
    func fetchScore(
        recertId: String,
        sessionId: String
    ) async throws -> InterviewScoreResponseDTO {
        let path = "/recert/\(recertId)/practice/\(sessionId)/score"
        return try await postJSON(path: path, body: EmptyBody())
    }

    // MARK: - HTTP plumbing

    private struct EmptyBody: Encodable {}

    private func postJSON<Request: Encodable, Response: Decodable>(
        path: String,
        body: Request
    ) async throws -> Response {
        guard let token = await tokenProvider() else { throw CoachAPIError.notAuthenticated }

        var request = URLRequest(url: endpoint(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = requestTimeout
        request.httpBody = try encoder.encode(body)

        let (data, urlResponse) = try await session.data(for: request)
        try validate(urlResponse, data: data)
        return try decode(data)
    }

    private func getJSON<Response: Decodable>(path: String) async throws -> Response {
        guard let token = await tokenProvider() else { throw CoachAPIError.notAuthenticated }

        var request = URLRequest(url: endpoint(path))
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = requestTimeout

        let (data, urlResponse) = try await session.data(for: request)
        try validate(urlResponse, data: data)
        return try decode(data)
    }

    private func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw CoachAPIError.emptyResponse
        }
        if (200..<300).contains(http.statusCode) { return }

        let body = String(data: data, encoding: .utf8) ?? ""
        switch http.statusCode {
        case 401: throw CoachAPIError.notAuthorized
        case 403: throw CoachAPIError.forbidden(body)
        case 404: throw CoachAPIError.notFound
        case 410: throw CoachAPIError.sessionLost
        default:  throw CoachAPIError.serverError(status: http.statusCode, body: body)
        }
    }

    private func decode<R: Decodable>(_ data: Data) throws -> R {
        if data.isEmpty { throw CoachAPIError.emptyResponse }
        do {
            return try decoder.decode(R.self, from: data)
        } catch {
            logger.error("InterviewCoach decode error: \(error.localizedDescription, privacy: .public)")
            throw CoachAPIError.decodingFailed(error.localizedDescription)
        }
    }

    private func endpoint(_ path: String) -> URL {
        baseURL.appendingPathComponent(path.hasPrefix("/") ? String(path.dropFirst()) : path)
    }
}
