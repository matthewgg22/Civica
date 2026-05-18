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
// are implemented in supabase/functions/ and require ANTHROPIC_API_KEY
// to be set on the Supabase project before calls succeed.

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

    // Legacy UserDefaults key that previously held a stable cross-launch ID.
    // Retained as a constant so CivicaUserData's launch-time cleanup can find it
    // and delete it on existing installs. Do not write to this key from new code.
    static let legacyAnonymousIDKey = "co.civica.interview_coach.anonymous_id.v1"

    private let baseURL: URL
    private let anonKey: String
    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let requestID: String
    private let logger = Logger(subsystem: "Civica", category: "InterviewCoachAPIClient")
    private let requestTimeout: TimeInterval = 65
    private let maxRetries = 2
    // Retry on these HTTP status codes (transient server/gateway errors only).
    private let retryableStatuses: Set<Int> = [429, 500, 502, 503, 504]

    init(
        baseURL: URL = SupabaseConfig.current.url,
        anonKey: String = SupabaseConfig.current.anonKey,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.anonKey = anonKey
        self.session = session
        self.requestID = UUID().uuidString

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

    // Streaming variant — yields CoachTurnEvents as the edge function sends SSE.
    // Callers iterate the returned AsyncThrowingStream; the stream ends after
    // a .completed event or throws on network/parse error.
    func streamTurn(_ payload: InterviewTurnRequestDTO) -> AsyncThrowingStream<CoachTurnEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    var request = URLRequest(url: endpoint("/functions/v1/interview-coach-turn"))
                    request.httpMethod = "POST"
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                    request.timeoutInterval = requestTimeout
                    request.httpBody = try encoder.encode(payload)
                    attachAuthorization(to: &request)

                    let (bytes, urlResponse) = try await session.bytes(for: request)
                    guard let http = urlResponse as? HTTPURLResponse,
                          (200..<300).contains(http.statusCode) else {
                        continuation.finish(throwing: CoachAPIError.emptyResponse)
                        return
                    }

                    for try await line in bytes.lines {
                        guard line.hasPrefix("data: ") else { continue }
                        let jsonString = String(line.dropFirst(6))

                        guard let data = jsonString.data(using: .utf8),
                              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                        else { continue }

                        if let delta = obj["delta"] as? String {
                            continuation.yield(.delta(delta))
                        } else if let done = obj["done"] as? Bool, done {
                            let text = obj["caseworker_text"] as? String ?? ""
                            let eoi = obj["end_of_interview"] as? Bool ?? false
                            continuation.yield(.completed(caseworkerText: text, endOfInterview: eoi))
                            continuation.finish()
                            return
                        } else if let errorMsg = obj["error"] as? String {
                            continuation.finish(throwing: CoachAPIError.http(status: 502, body: errorMsg))
                            return
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
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

        var lastError: Error = CoachAPIError.emptyResponse
        for attempt in 0...maxRetries {
            if attempt > 0 {
                let backoffNs = UInt64(pow(2.0, Double(attempt - 1))) * 1_000_000_000
                try? await Task.sleep(nanoseconds: backoffNs)
                logger.info("Retrying \(path) attempt \(attempt)/\(self.maxRetries)")
            }

            let data: Data
            let urlResponse: URLResponse
            do {
                (data, urlResponse) = try await session.data(for: request)
            } catch {
                lastError = error
                logger.warning("Network error on \(path) attempt \(attempt): \(error.localizedDescription)")
                continue
            }

            guard let http = urlResponse as? HTTPURLResponse else {
                lastError = CoachAPIError.emptyResponse
                continue
            }

            if retryableStatuses.contains(http.statusCode) {
                let body = String(data: data, encoding: .utf8) ?? ""
                lastError = CoachAPIError.http(status: http.statusCode, body: body)
                logger.warning("Retryable HTTP \(http.statusCode) on \(path) attempt \(attempt)")
                continue
            }

            if !(200..<300).contains(http.statusCode) {
                let body = String(data: data, encoding: .utf8) ?? ""
                throw CoachAPIError.http(status: http.statusCode, body: body)
            }

            if data.isEmpty { throw CoachAPIError.emptyResponse }

            let decoded = try decoder.decode(Response.self, from: data)
            if attempt > 0 {
                logger.info("Recovered on attempt \(attempt) for \(path)")
            }
            return decoded
        }

        throw lastError
    }

    private func endpoint(_ path: String) -> URL {
        baseURL.appendingPathComponent(path.hasPrefix("/") ? String(path.dropFirst()) : path)
    }

    // Supabase Edge Functions accept the project anon key as both the
    // `apikey` header and a Bearer token. No per-user JWT here -- the
    // Civica core flow is on-device and Coach is opt-in.
    // X-Anonymous-ID is a per-client UUID generated at init. It does NOT
    // persist across launches or across practice sessions -- a new
    // InterviewCoachAPIClient (typically one per PracticeSessionViewModel)
    // gets a fresh ID, so the backend cannot link two sessions from the
    // same device through this header alone.
    private func attachAuthorization(to request: inout URLRequest) {
        request.setValue(requestID, forHTTPHeaderField: "X-Anonymous-ID")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
    }
}
