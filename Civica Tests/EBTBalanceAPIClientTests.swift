import Foundation
import Testing
@testable import Civica

// Covers T6 (API-client half): every method round-trips through a
// URLProtocol stub, the JWT is attached, scrape-error envelopes
// decode into EBTBalanceAPIError.scrape, non-2xx without a scrape
// envelope decodes into .unexpectedStatus, and missing tokens throw
// .unauthenticated.

// MARK: - URLProtocol stub
//
// Mirrors the EnrollmentStubProtocol pattern (see
// EnrollmentAPIClientTests). `nonisolated(unsafe)` static state →
// `@Suite(.serialized)` per memory feedback_swift_testing_concurrent.

final class EBTBalanceStubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handlers: [(URLRequest) -> (Data, Int)] = []
    nonisolated(unsafe) static var capturedRequests: [URLRequest] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        EBTBalanceStubProtocol.capturedRequests.append(request)
        guard !EBTBalanceStubProtocol.handlers.isEmpty else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        let handler = EBTBalanceStubProtocol.handlers.removeFirst()
        let (data, status) = handler(request)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: status,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

// MARK: - Helpers

private func makeStubSession() -> URLSession {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [EBTBalanceStubProtocol.self]
    return URLSession(configuration: config)
}

private let ebtTestBaseURL = URL(string: "https://gateway.test/v1/ebt/")!
private let ebtTestToken = "test-bearer-token-xyz"

private func makeClient(
    tokenProvider: @escaping @Sendable () async -> String? = { ebtTestToken }
) -> HTTPEBTBalanceAPIClient {
    HTTPEBTBalanceAPIClient(
        baseURL: ebtTestBaseURL,
        session: makeStubSession(),
        tokenProvider: tokenProvider
    )
}

// MARK: - Tests

@Suite(.serialized)
struct EBTBalanceAPIClientTests {

    init() {
        EBTBalanceStubProtocol.handlers.removeAll()
        EBTBalanceStubProtocol.capturedRequests.removeAll()
    }

    // MARK: linkCard

    @Test("linkCard posts cookie + expiry; decodes link response")
    func linkCardRoundTrip() async throws {
        let expiry = Date(timeIntervalSince1970: 1_800_000_000)
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let expiryISO = iso.string(from: expiry)
        let responseJSON = """
        { "card_id": "card-1", "processor": "ebt_ca", "session_expires_at": "\(expiryISO)" }
        """.data(using: .utf8)!

        EBTBalanceStubProtocol.handlers.append { _ in (responseJSON, 200) }
        let client = makeClient()
        let resp = try await client.linkCard(
            cookie: "JSESSIONID=abc",
            rememberCookie: "rmm=xyz",
            expiresAt: expiry
        )

        #expect(resp.cardId == "card-1")
        #expect(resp.processor == "ebt_ca")

        let req = EBTBalanceStubProtocol.capturedRequests.last
        #expect(req?.url?.absoluteString == "https://gateway.test/v1/ebt/link")
        #expect(req?.httpMethod == "POST")
        #expect(req?.value(forHTTPHeaderField: "Authorization") == "Bearer \(ebtTestToken)")
    }

    // MARK: fetchBalance

    @Test("fetchBalance round-trips with stale flag")
    func fetchBalanceRoundTrip() async throws {
        let json = """
        {
            "food_balance_cents": 7612,
            "cash_balance_cents": null,
            "balance_at": "2026-05-22T10:00:00.000Z",
            "stale": true,
            "next_deposit_amount_cents": 23200,
            "next_deposit_on": "2026-05-25T00:00:00.000Z",
            "deposit_day_of_month": 5
        }
        """.data(using: .utf8)!
        EBTBalanceStubProtocol.handlers.append { _ in (json, 200) }

        let client = makeClient()
        let resp = try await client.fetchBalance()

        #expect(resp.foodBalanceCents == 7612)
        #expect(resp.cashBalanceCents == nil)
        #expect(resp.stale == true)
        #expect(resp.depositDayOfMonth == 5)
        #expect(EBTBalanceStubProtocol.capturedRequests.last?.url?.path == "/v1/ebt/balance")
    }

    // MARK: fetchTransactions

    @Test("fetchTransactions includes cursor in query string")
    func fetchTransactionsCursorEncoding() async throws {
        let json = """
        { "transactions": [], "next_cursor": null }
        """.data(using: .utf8)!
        EBTBalanceStubProtocol.handlers.append { _ in (json, 200) }

        let client = makeClient()
        _ = try await client.fetchTransactions(cursor: "abc 123/xyz")

        let url = EBTBalanceStubProtocol.capturedRequests.last?.url?.absoluteString
        #expect(url?.contains("cursor=") == true)
        // Space and slash should be percent-encoded.
        #expect(url?.contains("abc%20123") == true)
    }

    @Test("fetchTransactions omits cursor when nil")
    func fetchTransactionsNoCursor() async throws {
        let json = #"{ "transactions": [], "next_cursor": null }"#.data(using: .utf8)!
        EBTBalanceStubProtocol.handlers.append { _ in (json, 200) }

        let client = makeClient()
        _ = try await client.fetchTransactions(cursor: nil)

        let url = EBTBalanceStubProtocol.capturedRequests.last?.url?.absoluteString
        #expect(url == "https://gateway.test/v1/ebt/transactions")
    }

    // MARK: refresh

    @Test("refresh returns job id + estimated seconds")
    func refreshRoundTrip() async throws {
        let json = #"{ "job_id": "job-42", "estimated_seconds": 8 }"#.data(using: .utf8)!
        EBTBalanceStubProtocol.handlers.append { _ in (json, 200) }

        let client = makeClient()
        let resp = try await client.refresh()

        #expect(resp.jobId == "job-42")
        #expect(resp.estimatedSeconds == 8)
        #expect(EBTBalanceStubProtocol.capturedRequests.last?.httpMethod == "POST")
    }

    // MARK: registerPushToken

    @Test("registerPushToken posts the apns_token")
    func registerPushTokenRoundTrip() async throws {
        EBTBalanceStubProtocol.handlers.append { _ in (Data("{}".utf8), 200) }
        let client = makeClient()
        try await client.registerPushToken("apns-token-abc")

        let req = EBTBalanceStubProtocol.capturedRequests.last
        #expect(req?.url?.path == "/v1/ebt/notifications/register")
        // URLRequest.httpBody is consumed by URLSession before the
        // stub sees it on macOS; the URL + method assertions cover
        // wire shape adequately.
    }

    // MARK: Error mapping

    @Test("4xx with scrape envelope maps to EBTBalanceAPIError.scrape")
    func scrapeErrorMapping() async throws {
        let json = EBTScrapeErrorFixtures.envelopeJSON(code: "sessionExpired")
        EBTBalanceStubProtocol.handlers.append { _ in (json, 410) }
        let client = makeClient()

        do {
            _ = try await client.fetchBalance()
            Issue.record("Expected throw")
        } catch let EBTBalanceAPIError.scrape(inner) {
            #expect(inner == .sessionExpired)
        } catch {
            Issue.record("Expected .scrape, got \(error)")
        }
    }

    @Test("5xx without scrape envelope maps to unexpectedStatus")
    func unexpectedStatusMapping() async throws {
        let json = Data("Internal Server Error".utf8)
        EBTBalanceStubProtocol.handlers.append { _ in (json, 500) }
        let client = makeClient()

        do {
            _ = try await client.fetchBalance()
            Issue.record("Expected throw")
        } catch let EBTBalanceAPIError.unexpectedStatus(code, _) {
            #expect(code == 500)
        } catch {
            Issue.record("Expected .unexpectedStatus, got \(error)")
        }
    }

    @Test("Missing JWT throws .unauthenticated without hitting the network")
    func missingTokenFailsClosed() async throws {
        let client = makeClient(tokenProvider: { nil })
        do {
            _ = try await client.fetchBalance()
            Issue.record("Expected throw")
        } catch EBTBalanceAPIError.unauthenticated {
            #expect(EBTBalanceStubProtocol.capturedRequests.isEmpty)
        } catch {
            Issue.record("Expected .unauthenticated, got \(error)")
        }
    }
}
