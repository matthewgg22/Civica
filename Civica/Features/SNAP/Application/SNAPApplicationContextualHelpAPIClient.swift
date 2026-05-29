import Foundation
import os

// HTTP client for the SNAP intake contextual-help endpoint, per
// office-hours design 2026-05-29 (GSTACK REVIEW REPORT D2 / T8).
//
// Endpoint contract (from the backend lane — must match exactly):
//   POST {baseURL}/v1/intake/help
//   Auth:  anonymous via `x-anonymous-id` header (NO JWT)
//   Rate:  30/min per anonymous-id (strict tier) via
//          apps/enrollment-api/src/lib/rate-limit.ts
//   Body:  { question_title: string, locale: "en" | "es" }
//   200:   { explainer_text: string, was_filtered: boolean }
//   400:   missing title
//   429:   rate limit
//   500:   LLM fail
//
// This is the simpler twin of InterviewCoachAPIClient — same Workers
// host, same JSON conventions, but NO Supabase JWT plumbing because
// the intake-help endpoint accepts anonymous traffic (the marker
// renders on every question, including before sign-in).
//
// Timeout: 3s per the design doc (loading state must fail fast so
// the sheet can swap to the safe fallback before the user wonders
// what's happening — see D6 / sheet view).
//
// Anonymous-id storage: a per-install UUID kept in UserDefaults under
// `co.civica.intake_help.anonymous_id.v1`. Mirrors the CivicCallService
// stableAnonymousRequestID() pattern (WeVote target). Wiped by
// CivicaUserData.deleteEverything() through the same UserDefaults
// sweep when the user opts out — the legacy-key list in
// CivicaUserData covers cross-version migrations the day this key
// gets rotated.

final class SNAPApplicationContextualHelpAPIClient {

    /// Typed errors surfaced to the sheet view. The view decides which
    /// path each one routes to (today all of them route to the safe
    /// fallback per D6; the typed cases let us telemeter the failure
    /// reason later without changing the call site).
    enum IntakeHelpError: Error, LocalizedError, Equatable {
        case missingBaseURL(String)
        case networkError(String)
        case rateLimited
        case serverError(status: Int, body: String)
        case decodingFailed(String)
        case timeout
        case emptyResponse

        var errorDescription: String? {
            switch self {
            case .missingBaseURL(let reason): return "Intake-help base URL is invalid: \(reason)"
            case .networkError(let msg):      return "Network error: \(msg)"
            case .rateLimited:                return "Too many help requests in a short window. Try again in a minute."
            case .serverError(let status, let body): return "Server returned \(status): \(body)"
            case .decodingFailed(let msg):    return "Could not read server response: \(msg)"
            case .timeout:                    return "The assistant did not respond in time."
            case .emptyResponse:              return "Intake-help returned an empty response."
            }
        }
    }

    /// Wire-format response. snake_case decoded via
    /// `keyDecodingStrategy = .convertFromSnakeCase`, so the Swift
    /// names are explainerText / wasFiltered.
    struct HelpResponse: Decodable, Equatable {
        let explainerText: String
        let wasFiltered: Bool
    }

    /// Wire-format request body. Same snake-case strategy on the
    /// encoder side; properties get serialized as `question_title`
    /// and `locale`.
    private struct HelpRequest: Encodable {
        let questionTitle: String
        let locale: String
    }

    /// UserDefaults key for the stable per-install anonymous ID sent
    /// in the `x-anonymous-id` header. Versioned in case we rotate
    /// the schema later — CivicaUserData.legacyUserDefaultsKeys
    /// should pick up retired versions on launch.
    static let anonymousIDDefaultsKey = "co.civica.intake_help.anonymous_id.v1"

    private let baseURL: URL
    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let logger = Logger(subsystem: "Civica", category: "SNAPApplicationContextualHelpAPIClient")

    /// Hard 3s ceiling per design D6 — the sheet must fail fast and
    /// fall back to the navigator-nudge copy before the user
    /// disengages. Cold-start risk noted in the design doc; we
    /// accept that risk and own the fallback UX.
    private let requestTimeout: TimeInterval = 3

    /// Default enrollment-api host. Mirrors InterviewCoachAPIClient's
    /// resolver: env var → Info.plist → production fallback. Keeping
    /// the resolution rule identical means a staging override set
    /// once (e.g. via `SNAP_ENROLLMENT_API_URL`) flips both clients
    /// at the same time.
    static func defaultBaseURL() -> URL {
        let env = ProcessInfo.processInfo.environment
        let raw = env["SNAP_ENROLLMENT_API_URL"]
            ?? (Bundle.main.object(forInfoDictionaryKey: "SNAP_ENROLLMENT_API_URL") as? String)
            ?? "https://civica-enrollment-api.civica-api.workers.dev"
        return URL(string: raw) ?? URL(string: "https://civica-enrollment-api.civica-api.workers.dev")!
    }

    init(
        baseURL: URL = SNAPApplicationContextualHelpAPIClient.defaultBaseURL(),
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.session = session

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = encoder

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder = decoder
    }

    // MARK: - Public API

    /// POST /v1/intake/help with the user's question title and locale.
    /// Surfaces typed errors per `IntakeHelpError` so the sheet can
    /// route each one to the safe fallback.
    func fetchHelp(
        questionTitle: String,
        language: CivicaLanguage
    ) async throws -> HelpResponse {
        var request = URLRequest(url: endpoint("v1/intake/help"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(stableAnonymousID(), forHTTPHeaderField: "x-anonymous-id")
        request.timeoutInterval = requestTimeout

        let body = HelpRequest(
            questionTitle: questionTitle,
            locale: language.rawValue
        )
        request.httpBody = try encoder.encode(body)

        let data: Data
        let urlResponse: URLResponse
        do {
            (data, urlResponse) = try await session.data(for: request)
        } catch let urlError as URLError where urlError.code == .timedOut {
            throw IntakeHelpError.timeout
        } catch let urlError as URLError {
            throw IntakeHelpError.networkError(urlError.localizedDescription)
        } catch {
            throw IntakeHelpError.networkError(error.localizedDescription)
        }

        try validate(urlResponse, data: data)
        return try decode(data)
    }

    // MARK: - HTTP plumbing

    private func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw IntakeHelpError.emptyResponse
        }
        if (200..<300).contains(http.statusCode) { return }

        let body = String(data: data, encoding: .utf8) ?? ""
        switch http.statusCode {
        case 429: throw IntakeHelpError.rateLimited
        default:  throw IntakeHelpError.serverError(status: http.statusCode, body: body)
        }
    }

    private func decode(_ data: Data) throws -> HelpResponse {
        if data.isEmpty { throw IntakeHelpError.emptyResponse }
        do {
            return try decoder.decode(HelpResponse.self, from: data)
        } catch {
            logger.error("Intake-help decode error: \(error.localizedDescription, privacy: .public)")
            throw IntakeHelpError.decodingFailed(error.localizedDescription)
        }
    }

    private func endpoint(_ path: String) -> URL {
        baseURL.appendingPathComponent(path.hasPrefix("/") ? String(path.dropFirst()) : path)
    }

    // MARK: - Anonymous identity

    /// Returns the per-install anonymous ID, minting + storing a
    /// fresh UUID the first time. Stable across launches, scoped to
    /// the install (nothing PII-bound). Wiped alongside other
    /// Civica-owned UserDefaults keys via
    /// CivicaUserData.deleteEverything().
    private func stableAnonymousID() -> String {
        let defaults = UserDefaults.standard
        let existing = defaults.string(forKey: Self.anonymousIDDefaultsKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !existing.isEmpty {
            return existing
        }
        let generated = UUID().uuidString.lowercased()
        defaults.set(generated, forKey: Self.anonymousIDDefaultsKey)
        return generated
    }
}
