import Foundation
import OSLog

// HTTP client for the offer-moment platform routes on the Civica gateway:
//   GET  /v1/enrollment/me/offers
//   GET  /v1/enrollment/me/offers/:id
//   POST /v1/enrollment/me/offers/events
//   POST /v1/enrollment/me/redemptions
//
// Mirrors the EBTBalanceAPIClient pattern: URLSession-backed, JWT from the
// Keychain session, typed errors. Tests substitute URLSession via a
// URLProtocol-stubbed session.

// MARK: - Errors

enum EBTOffersAPIError: LocalizedError, Equatable {
    case unauthenticated
    case invalidURL
    case http(status: Int, message: String)
    case decode(String)
    case offerExpired
    case offerSuppressedByDistress
    case rateLimited

    var errorDescription: String? {
        switch self {
        case .unauthenticated: return "Sign in to see offers."
        case .invalidURL: return "Could not reach the offers service."
        case .http(_, let msg): return msg
        case .decode(let msg): return "Could not read the offers response: \(msg)"
        case .offerExpired: return "This deal just ended."
        case .offerSuppressedByDistress: return "No offers available right now."
        case .rateLimited: return "Slow down — please try again in a moment."
        }
    }
}

// MARK: - Client interface

protocol EBTOffersAPIClient: Sendable {
    /// GET /me/offers?packet_county=&current_county=&state_code=&limit=
    /// Returns either an offers payload OR a free_resources payload (when
    /// the user is distress-flagged). Single response shape; iOS branches.
    func fetchOffers(
        packetCountyFips: String?,
        currentCountyFips: String?,
        stateCode: String,
        limit: Int
    ) async throws -> EBTOffersResponse

    /// GET /me/offers/:id — staleness verification on tap.
    /// Throws `.offerExpired` for 410 with status=OFFER_EXPIRED;
    /// `.offerSuppressedByDistress` for 410 with status=OFFER_SUPPRESSED.
    func fetchOffer(id: String) async throws -> EBTOffer

    /// POST /me/offers/events — emit impression / click. County-bucketed,
    /// no user_id retained per D12 privacy posture.
    func emitEvent(_ event: EBTOfferEvent) async throws

    /// POST /me/redemptions — self-attest. The atomic UPSERT happens
    /// server-side via the `record_redemption` PG function.
    func recordRedemption(
        offerId: String,
        savingsCents: Int
    ) async throws -> EBTRedemptionResponse
}

// MARK: - HTTP implementation

struct HTTPEBTOffersAPIClient: EBTOffersAPIClient {
    let baseURL: URL
    let session: URLSession
    let tokenProvider: @Sendable () async -> String?

    private static let logger = Logger(subsystem: "Civica", category: "EBTOffersAPIClient")

    init(
        baseURL: URL,
        session: URLSession = .shared,
        tokenProvider: @escaping @Sendable () async -> String?
    ) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider
    }

    func fetchOffers(
        packetCountyFips: String?,
        currentCountyFips: String?,
        stateCode: String,
        limit: Int
    ) async throws -> EBTOffersResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("me/offers"), resolvingAgainstBaseURL: false)
        var items: [URLQueryItem] = [
            URLQueryItem(name: "state_code", value: stateCode),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        if let p = packetCountyFips { items.append(URLQueryItem(name: "packet_county", value: p)) }
        if let c = currentCountyFips { items.append(URLQueryItem(name: "current_county", value: c)) }
        components?.queryItems = items
        guard let url = components?.url else { throw EBTOffersAPIError.invalidURL }
        return try await getJSON(url: url)
    }

    func fetchOffer(id: String) async throws -> EBTOffer {
        struct Envelope: Decodable {
            let status: String
            let offer: EBTOffer?
        }
        let url = baseURL.appendingPathComponent("me/offers/\(id)")
        do {
            let env: Envelope = try await getJSON(url: url)
            guard let offer = env.offer else {
                throw EBTOffersAPIError.offerExpired
            }
            return offer
        } catch let EBTOffersAPIError.http(status: 410, message: msg) {
            if msg.contains("OFFER_SUPPRESSED") {
                throw EBTOffersAPIError.offerSuppressedByDistress
            }
            throw EBTOffersAPIError.offerExpired
        }
    }

    func emitEvent(_ event: EBTOfferEvent) async throws {
        let url = baseURL.appendingPathComponent("me/offers/events")
        struct Empty: Decodable {}
        let _: Empty = try await post(url: url, body: event)
    }

    func recordRedemption(offerId: String, savingsCents: Int) async throws -> EBTRedemptionResponse {
        struct Body: Encodable {
            let offer_id: String
            let method: String
            let savings_cents: Int
        }
        let url = baseURL.appendingPathComponent("me/redemptions")
        return try await post(url: url, body: Body(
            offer_id: offerId,
            method: "self_attest",
            savings_cents: savingsCents
        ))
    }

    // MARK: - HTTP helpers

    private func getJSON<R: Decodable>(url: URL) async throws -> R {
        guard let token = await tokenProvider() else { throw EBTOffersAPIError.unauthenticated }
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: req)
        try validate(response: response, data: data)
        return try decode(data)
    }

    private func post<B: Encodable, R: Decodable>(url: URL, body: B) async throws -> R {
        guard let token = await tokenProvider() else { throw EBTOffersAPIError.unauthenticated }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONEncoder.civicaSnakeISO.encode(body)
        let (data, response) = try await session.data(for: req)
        try validate(response: response, data: data)
        if R.self == EmptyResponse.self {
            // POST /me/offers/events returns {status:"ok"} with no other
            // fields; we don't decode it.
            return EmptyResponse() as! R
        }
        return try decode(data)
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { return }
        if (200..<300).contains(http.statusCode) { return }
        if http.statusCode == 401 { throw EBTOffersAPIError.unauthenticated }
        if http.statusCode == 429 { throw EBTOffersAPIError.rateLimited }
        let msg = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
        throw EBTOffersAPIError.http(status: http.statusCode, message: msg)
    }

    private func decode<R: Decodable>(_ data: Data) throws -> R {
        do {
            return try JSONDecoder.civicaSnakeISO.decode(R.self, from: data)
        } catch {
            Self.logger.error("decode failed: \(String(describing: error))")
            throw EBTOffersAPIError.decode(String(describing: error))
        }
    }
}

private struct EmptyResponse: Decodable {}

// MARK: - Mock (previews + flag-OFF)

final class MockEBTOffersAPIClient: EBTOffersAPIClient, @unchecked Sendable {
    func fetchOffers(
        packetCountyFips: String?,
        currentCountyFips: String?,
        stateCode: String,
        limit: Int
    ) async throws -> EBTOffersResponse {
        EBTOffersResponse(
            offers: [],
            freeResources: nil,
            meta: .init(stateCode: stateCode, servedCount: 0, freeResourcesCount: 0, validUntilWindowMinutes: 5)
        )
    }

    func fetchOffer(id: String) async throws -> EBTOffer {
        throw EBTOffersAPIError.offerExpired
    }

    func emitEvent(_ event: EBTOfferEvent) async throws {}

    func recordRedemption(offerId: String, savingsCents: Int) async throws -> EBTRedemptionResponse {
        EBTRedemptionResponse(status: "ok", redemptionId: nil, savingsCents: savingsCents, totalSavingsCents: nil, capped: false)
    }
}

// MARK: - JSON helpers — snake_case keys with ISO-8601 dates

extension JSONDecoder {
    /// Decoder matching the gateway's wire format. Models use explicit
    /// `CodingKeys` for the snake → camel mapping (the gateway response
    /// is too irregular for the convertFromSnakeCase strategy alone), so
    /// this only configures dates.
    static let civicaSnakeISO: JSONDecoder = {
        let d = JSONDecoder()
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        d.dateDecodingStrategy = .custom { decoder in
            let c = try decoder.singleValueContainer()
            let s = try c.decode(String.self)
            if let date = iso.date(from: s) { return date }
            // Some PostgREST responses omit fractional seconds.
            iso.formatOptions = [.withInternetDateTime]
            defer { iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds] }
            if let date = iso.date(from: s) { return date }
            throw DecodingError.dataCorruptedError(
                in: c,
                debugDescription: "Could not parse ISO date: \(s)"
            )
        }
        return d
    }()
}

extension JSONEncoder {
    static let civicaSnakeISO: JSONEncoder = {
        let e = JSONEncoder()
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        e.dateEncodingStrategy = .custom { date, encoder in
            var c = encoder.singleValueContainer()
            try c.encode(iso.string(from: date))
        }
        return e
    }()
}
