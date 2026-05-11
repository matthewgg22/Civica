import Foundation
import os

// EXPERIMENTAL SILOED MODULE: HTTP client for the Interview Coach backend.
//
// Civica adaptation: this is a rewrite of VoteNow's CIVIC_API_BASE_URL +
// SupabaseManager-token version. Civica routes coach traffic through
// Supabase Edge Functions and does not stand up the Supabase auth
// singletons VoteNow uses, so this client reads SUPABASE_URL +
// SUPABASE_ANON_KEY from SupabaseConfig.current and sends the anon key
// as both the `apikey` header and a Bearer token. An anonymous-ID
// header lets backend metrics correlate sessions without user sign-in.
//
// Edge Function slugs (`interview-coach-turn`, `interview-coach-score`)
// are placeholders. Until those functions ship to the Civica Supabase
// project, calls will fail with 404 -- PracticeSessionViewModel surfaces
// that as `.failed`, so the UI is exercisable in SNAP_DEV builds
// without a working backend.
final class InterviewCoachAPIClient {
    enum CoachAPIError: Error, LocalizedError {
        case missingBaseURL(String)
        case http(status: Int, body: String)
        case emptyResponse

        var errorDescription: String? {
            switch self {
            case .missingBaseURL(let reason): return "Coach API base URL is invalid: \(reason)"
            case .http(let status, let body): return "Coach API HTTP \(status): \(body)"
            case .emptyResponse: return "Coach API returned an empty response."
            }
        }
    }

    private let baseURL: URL
    private let anonKey: String
    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let logger = Logger(subsystem: "Civica", category: "InterviewCoachAPIClient")
    private let requestTimeout: TimeInterval = 65

    init(
        baseURL: URL = SupabaseConfig.current.url,
        anonKey: String = SupabaseConfig.current.anonKey,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.anonKey = anonKey
        self.session = session

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = encoder

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder = decoder
    }

    func postTurn(_ payload: InterviewTurnRequestDTO) async throws -> InterviewTurnResponseDTO {
        try await postJSON(path: "/functions/v1/interview-coach-turn", payload: payload)
    }

    func postScore(_ payload: InterviewScoreRequestDTO) async throws -> InterviewScoreResponseDTO {
        try await postJSON(path: "/functions/v1/interview-coach-score", payload: payload)
    }

    private func postJSON<Request: Encodable, Response: Decodable>(
        path: String,
        payload: Request
    ) async throws -> Response {
        var request = URLRequest(url: endpoint(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = requestTimeout
        request.httpBody = try encoder.encode(payload)

        attachAuthorization(to: &request)

        let (data, urlResponse) = try await session.data(for: request)
        guard let http = urlResponse as? HTTPURLResponse else {
            throw CoachAPIError.emptyResponse
        }
        if !(200..<300).contains(http.statusCode) {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw CoachAPIError.http(status: http.statusCode, body: body)
        }
        if data.isEmpty {
            throw CoachAPIError.emptyResponse
        }
        return try decoder.decode(Response.self, from: data)
    }

    private func endpoint(_ path: String) -> URL {
        baseURL.appendingPathComponent(path.hasPrefix("/") ? String(path.dropFirst()) : path)
    }

    // Supabase Edge Functions accept the project anon key as both the
    // `apikey` header and a Bearer token. No per-user JWT here -- the
    // Civica core flow is on-device and Coach is opt-in / SNAP_DEV-only.
    // X-Anonymous-ID keeps cross-session correlation in the absence of
    // sign-in.
    private func attachAuthorization(to request: inout URLRequest) {
        request.setValue(Self.stableAnonymousRequestID(), forHTTPHeaderField: "X-Anonymous-ID")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
    }

    private static func stableAnonymousRequestID() -> String {
        let key = "co.civica.interview_coach.anonymous_id.v1"
        let defaults = UserDefaults.standard
        if let existing = defaults.string(forKey: key), !existing.isEmpty {
            return existing
        }
        let fresh = UUID().uuidString
        defaults.set(fresh, forKey: key)
        return fresh
    }
}
