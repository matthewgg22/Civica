import Foundation
import OSLog

// HTTP client for the EBT routes on the Civica gateway
// (`apps/enrollment-api/src/routes/ebt/`). Mirrors the
// EnrollmentAPIClient pattern: URLSession-backed, JWT from the
// CivicaEnrollmentAuth Keychain session, typed errors.
//
// All scraper errors decode through EBTScrapeError; non-scrape HTTP
// failures decode through EBTBalanceAPIError. Tests substitute
// `URLSession` with a URLProtocol-stubbed session.

// MARK: - Client interface

protocol EBTBalanceAPIClient: Sendable {
    /// POST /ebt/link — hand the gateway the WKWebView-captured
    /// session cookie + (optional) remember-me cookie. Per plan D4:
    /// the PIN is never transmitted; the cookie is the only
    /// credential.
    func linkCard(
        cookie: String,
        rememberCookie: String?,
        expiresAt: Date
    ) async throws -> EBTLinkResponse

    /// GET /ebt/balance — fresh-or-cached balance read. Server may
    /// return `stale=true` per D14; the repository decides whether to
    /// kick off a refresh.
    func fetchBalance() async throws -> EBTBalanceResponse

    /// GET /ebt/transactions[?cursor=...] — cursor-paginated.
    func fetchTransactions(cursor: String?) async throws -> EBTTransactionsResponse

    /// POST /ebt/refresh — rate-limited 1/min/user on the gateway.
    /// Triggers a Fly scraper run; returns immediately. New balance
    /// arrives via a webhook → APNs push, OR the iOS app polls.
    func refresh() async throws -> EBTRefreshResponse

    /// POST /ebt/notifications/register — APNs device-token upsert.
    func registerPushToken(_ token: String) async throws

    /// POST /ebt/notifications/prefs — persist per-user notification
    /// preferences to the gateway. Called by EBTAnomalyStore when the
    /// travel-mute window changes, and by EBTNotificationPrefsStore on
    /// every toggle. Closes the C↔D bridge TODO in EBTPushWiring.swift.
    func updateNotificationPrefs(_ prefs: EBTNotificationPrefsPayload) async throws
}

// MARK: - Errors

enum EBTBalanceAPIError: Error, Equatable, LocalizedError {
    case unauthenticated
    case invalidURL
    case unexpectedStatus(Int, body: String)
    case decodingFailed(String)
    case scrape(EBTScrapeError)

    var errorDescription: String? {
        switch self {
        case .unauthenticated:
            return "You're signed out. Sign in to see your EBT balance."
        case .invalidURL:
            return "The EBT service URL is not configured."
        case .unexpectedStatus(let code, let body):
            return "Server returned \(code): \(body)"
        case .decodingFailed(let msg):
            return "Could not read server response: \(msg)"
        case .scrape(let inner):
            return inner.banner.en
        }
    }
}

// MARK: - DTOs

struct EBTLinkResponse: Decodable, Equatable, Sendable {
    let cardId: String
    let processor: String
    let sessionExpiresAt: Date

    enum CodingKeys: String, CodingKey {
        case cardId = "card_id"
        case processor
        case sessionExpiresAt = "session_expires_at"
    }
}

struct EBTBalanceResponse: Decodable, Equatable, Sendable {
    let foodBalanceCents: Int
    let cashBalanceCents: Int?
    let balanceAt: Date
    let stale: Bool
    let nextDepositAmountCents: Int?
    let nextDepositOn: Date?
    let depositDayOfMonth: Int?

    enum CodingKeys: String, CodingKey {
        case foodBalanceCents = "food_balance_cents"
        case cashBalanceCents = "cash_balance_cents"
        case balanceAt = "balance_at"
        case stale
        case nextDepositAmountCents = "next_deposit_amount_cents"
        case nextDepositOn = "next_deposit_on"
        case depositDayOfMonth = "deposit_day_of_month"
    }
}

struct EBTTransactionsResponse: Decodable, Equatable, Sendable {
    let transactions: [EBTTransactionDTO]
    let nextCursor: String?

    enum CodingKeys: String, CodingKey {
        case transactions
        case nextCursor = "next_cursor"
    }
}

struct EBTTransactionDTO: Decodable, Equatable, Sendable {
    let id: String
    let postedAt: Date
    let amountCents: Int
    let merchant: String
    let category: String
    let rawDescription: String?

    enum CodingKeys: String, CodingKey {
        case id
        case postedAt = "posted_at"
        case amountCents = "amount_cents"
        case merchant
        case category
        case rawDescription = "raw_description"
    }
}

struct EBTRefreshResponse: Decodable, Equatable, Sendable {
    /// Scraper job id — surfaced in logs, not the UI.
    let jobId: String
    /// Server's promise on how long the refresh should take. Drives
    /// the dashboard's loading spinner timeout.
    let estimatedSeconds: Int

    enum CodingKeys: String, CodingKey {
        case jobId = "job_id"
        case estimatedSeconds = "estimated_seconds"
    }
}

// MARK: - HTTP implementation

struct HTTPEBTBalanceAPIClient: EBTBalanceAPIClient {
    let baseURL: URL
    let session: URLSession
    let tokenProvider: @Sendable () async -> String?

    private static let logger = Logger(subsystem: "Civica", category: "EBTBalanceAPIClient")

    init(
        baseURL: URL,
        session: URLSession = .shared,
        tokenProvider: @escaping @Sendable () async -> String?
    ) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider
    }

    // MARK: Methods

    func linkCard(
        cookie: String,
        rememberCookie: String?,
        expiresAt: Date
    ) async throws -> EBTLinkResponse {
        struct Body: Encodable {
            let processor: String
            let session_cookie: String
            let remember_cookie: String?
            let session_expires_at: String
        }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let body = Body(
            processor: "ebt_ca",
            session_cookie: cookie,
            remember_cookie: rememberCookie,
            session_expires_at: iso.string(from: expiresAt)
        )
        return try await post(path: "link", body: body)
    }

    func fetchBalance() async throws -> EBTBalanceResponse {
        try await getJSON(path: "balance")
    }

    func fetchTransactions(cursor: String?) async throws -> EBTTransactionsResponse {
        var path = "transactions"
        if let cursor, !cursor.isEmpty {
            let encoded = cursor.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? cursor
            path += "?cursor=\(encoded)"
        }
        return try await getJSON(path: path)
    }

    func refresh() async throws -> EBTRefreshResponse {
        try await postEmpty(path: "refresh")
    }

    func registerPushToken(_ token: String) async throws {
        struct Body: Encodable {
            let apns_token: String
            let platform: String
        }
        let _: EmptyResponse = try await post(
            path: "notifications/register",
            body: Body(apns_token: token, platform: "ios")
        )
    }

    func updateNotificationPrefs(_ prefs: EBTNotificationPrefsPayload) async throws {
        let _: EmptyResponse = try await post(
            path: "notifications/prefs",
            body: prefs
        )
    }

    // MARK: Helpers

    private func getJSON<R: Decodable>(path: String) async throws -> R {
        guard let token = await tokenProvider() else { throw EBTBalanceAPIError.unauthenticated }
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw EBTBalanceAPIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: req)
        try validate(response: response, data: data)
        return try decode(data)
    }

    private func post<B: Encodable, R: Decodable>(path: String, body: B) async throws -> R {
        guard let token = await tokenProvider() else { throw EBTBalanceAPIError.unauthenticated }
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw EBTBalanceAPIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.data(for: req)
        try validate(response: response, data: data)
        return try decode(data)
    }

    private func postEmpty<R: Decodable>(path: String) async throws -> R {
        guard let token = await tokenProvider() else { throw EBTBalanceAPIError.unauthenticated }
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw EBTBalanceAPIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: req)
        try validate(response: response, data: data)
        return try decode(data)
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { return }
        if (200..<300).contains(http.statusCode) { return }

        // 4xx with an EBT scrape-error envelope → typed scrape error.
        if (400..<500).contains(http.statusCode) {
            if let scrape = try? JSONDecoder().decode(EBTScrapeError.self, from: data) {
                throw EBTBalanceAPIError.scrape(scrape)
            }
        }
        let body = String(data: data, encoding: .utf8) ?? ""
        throw EBTBalanceAPIError.unexpectedStatus(http.statusCode, body: body)
    }

    private func decode<R: Decodable>(_ data: Data) throws -> R {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        do {
            return try decoder.decode(R.self, from: data)
        } catch {
            Self.logger.error("EBT API decode error: \(error.localizedDescription, privacy: .public)")
            throw EBTBalanceAPIError.decodingFailed(error.localizedDescription)
        }
    }
}

private struct EmptyResponse: Decodable {}

// MARK: - Factory

extension HTTPEBTBalanceAPIClient {
    /// Resolves the EBT API base URL from the same env+plist source
    /// EnrollmentAPIClient uses, but mounts `/v1/ebt/` instead of
    /// `/v1/enrollment/` (per plan §4.2 — single gateway, EBT routes
    /// under `/ebt/*`).
    static func resolveBaseURL() -> URL? {
        let env = ProcessInfo.processInfo.environment
        let raw = env["SNAP_ENROLLMENT_API_URL"]
            ?? (Bundle.main.object(forInfoDictionaryKey: "SNAP_ENROLLMENT_API_URL") as? String)
        guard let raw, let url = URL(string: raw) else { return nil }
        // The relative-path helper expects a trailing slash to treat
        // the URL as a directory base; "v1/ebt/" gives us
        // "<base>/v1/ebt/balance" etc. at call sites.
        return url.appendingPathComponent("v1/ebt", isDirectory: true)
    }
}

// MARK: - Mock for previews + offline

final class MockEBTBalanceAPIClient: EBTBalanceAPIClient, @unchecked Sendable {
    var linkCalled = false
    var refreshCount = 0
    var balanceResponse: EBTBalanceResponse?
    var transactionsResponse: EBTTransactionsResponse?
    var registeredTokens: [String] = []
    var shouldFailNextWithScrape: EBTScrapeError?

    func linkCard(
        cookie: String,
        rememberCookie: String?,
        expiresAt: Date
    ) async throws -> EBTLinkResponse {
        if let s = shouldFailNextWithScrape {
            shouldFailNextWithScrape = nil
            throw EBTBalanceAPIError.scrape(s)
        }
        linkCalled = true
        return EBTLinkResponse(
            cardId: "mock-card-1",
            processor: "ebt_ca",
            sessionExpiresAt: expiresAt
        )
    }

    func fetchBalance() async throws -> EBTBalanceResponse {
        if let s = shouldFailNextWithScrape {
            shouldFailNextWithScrape = nil
            throw EBTBalanceAPIError.scrape(s)
        }
        return balanceResponse ?? EBTBalanceResponse(
            foodBalanceCents: 7612,
            cashBalanceCents: nil,
            balanceAt: Date(),
            stale: false,
            nextDepositAmountCents: 23200,
            nextDepositOn: Calendar.current.date(byAdding: .day, value: 4, to: Date()),
            depositDayOfMonth: 5
        )
    }

    func fetchTransactions(cursor: String?) async throws -> EBTTransactionsResponse {
        if let s = shouldFailNextWithScrape {
            shouldFailNextWithScrape = nil
            throw EBTBalanceAPIError.scrape(s)
        }
        return transactionsResponse ?? EBTTransactionsResponse(transactions: [], nextCursor: nil)
    }

    func refresh() async throws -> EBTRefreshResponse {
        if let s = shouldFailNextWithScrape {
            shouldFailNextWithScrape = nil
            throw EBTBalanceAPIError.scrape(s)
        }
        refreshCount += 1
        return EBTRefreshResponse(jobId: "mock-job-\(refreshCount)", estimatedSeconds: 12)
    }

    func registerPushToken(_ token: String) async throws {
        registeredTokens.append(token)
    }

    func updateNotificationPrefs(_ prefs: EBTNotificationPrefsPayload) async throws {
        // No-op stub for tests and previews.
    }
}
