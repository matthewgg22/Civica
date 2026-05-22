import Foundation
import OSLog

/// How much locational precision leaves the device on a Find Help
/// search. `.coarse` is the only mode wired today: lat/lng are
/// rounded at the egress boundary so the server never sees Apple's
/// "Precise Location" threshold (3+ decimals, ~110 m). `.precise`
/// is reserved for a future explicit opt-in path ("Use precise
/// location for closest-distance sorting") — adding the case here
/// keeps the boundary stable so the opt-in can land later without
/// changing every call site.
enum FindHelpLocationPrecision {
    case coarse
    case precise
}

protocol FindHelpServiceProtocol {
    func searchNearby(
        lat: Double,
        lng: Double,
        radiusKm: Double,
        precision: FindHelpLocationPrecision,
        serviceType: FindHelpServiceType?,
        languageCode: String?,
        maxResults: Int
    ) async throws -> [FindHelpLocation]

    /// Retailer-specific query — same row shape as searchNearby, but
    /// scoped to records the SNAP ecosystem treats as places to SPEND
    /// EBT (`service_types` contains `ebt_retailer`). Backed by the
    /// `find_retailers_nearby` Postgres function, which is a thin
    /// specialization of `find_help_locations_nearby` so the haversine
    /// + bbox math has one source of truth.
    func searchRetailersNearby(
        lat: Double,
        lng: Double,
        radiusKm: Double,
        precision: FindHelpLocationPrecision,
        maxResults: Int
    ) async throws -> [FindHelpLocation]

    func loadSources() async throws -> [FindHelpSourceAttribution]
}

struct FindHelpService: FindHelpServiceProtocol {
    private let baseURL: URL
    private let anonKey: String
    private let session: URLSession
    private let decoder: JSONDecoder
    private static let logger = Logger(subsystem: "Civica", category: "FindHelpService")

    init(
        baseURL: URL = SupabaseConfig.current.url,
        anonKey: String = SupabaseConfig.current.anonKey,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.anonKey = anonKey
        self.session = session

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            if let date = FindHelpService.isoFractional.date(from: raw) {
                return date
            }
            if let date = FindHelpService.iso.date(from: raw) {
                return date
            }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unrecognized date format: \(raw)"
            )
        }
        self.decoder = decoder
    }

    func searchNearby(
        lat: Double,
        lng: Double,
        radiusKm: Double = 25,
        precision: FindHelpLocationPrecision = .coarse,
        serviceType: FindHelpServiceType? = nil,
        languageCode: String? = nil,
        maxResults: Int = 25
    ) async throws -> [FindHelpLocation] {
        // Coarsen at the egress boundary. Apple's App Privacy guidance
        // treats lat/lng at 3 or more decimals as Precise Location;
        // rounding to 2 decimals yields ~1.1 km resolution, which is
        // well inside the Coarse Location category and is fine-grained
        // enough for a 5+ mile "what's near me" radius search.
        let (outLat, outLng) = Self.coordinatesForEgress(lat: lat, lng: lng, precision: precision)

        var body: [String: Any] = [
            "lat": outLat,
            "lng": outLng,
            "radius_km": radiusKm,
            "max_results": maxResults
        ]
        if let serviceType { body["service_type"] = serviceType.rawValue }
        if let languageCode { body["language_code"] = languageCode }

        return try await callRPC(name: "find_help_locations_nearby", body: body)
    }

    /// Round lat/lng to 2 decimals for `.coarse` egress. Exposed
    /// internally for unit tests that prove the default path doesn't
    /// transmit raw 6-decimal coordinates.
    static func coordinatesForEgress(
        lat: Double,
        lng: Double,
        precision: FindHelpLocationPrecision
    ) -> (lat: Double, lng: Double) {
        switch precision {
        case .precise:
            return (lat, lng)
        case .coarse:
            let factor = 100.0  // 2 decimals
            return (
                (lat * factor).rounded() / factor,
                (lng * factor).rounded() / factor
            )
        }
    }

    func searchRetailersNearby(
        lat: Double,
        lng: Double,
        radiusKm: Double = 25,
        precision: FindHelpLocationPrecision = .coarse,
        maxResults: Int = 50
    ) async throws -> [FindHelpLocation] {
        let (outLat, outLng) = Self.coordinatesForEgress(lat: lat, lng: lng, precision: precision)
        let body: [String: Any] = [
            "lat": outLat,
            "lng": outLng,
            "radius_km": radiusKm,
            "max_results": maxResults,
        ]
        return try await callRPC(name: "find_retailers_nearby", body: body)
    }

    func loadSources() async throws -> [FindHelpSourceAttribution] {
        try await callRPC(name: "find_help_location_sources", body: [:])
    }

    private func callRPC<T: Decodable>(name: String, body: [String: Any]) async throws -> [T] {
        let url = baseURL.appendingPathComponent("rest/v1/rpc/\(name)")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])

        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? -1
        guard (200...299).contains(status) else {
            let message = String(data: data, encoding: .utf8) ?? ""
            FindHelpService.logger.error("FindHelp RPC \(name, privacy: .public) failed status=\(status, privacy: .public)")
            throw FindHelpError.network(message: "Request failed (\(status)). \(message)")
        }
        do {
            return try decoder.decode([T].self, from: data)
        } catch {
            FindHelpService.logger.error("FindHelp RPC \(name, privacy: .public) decode failed: \(error.localizedDescription, privacy: .public)")
            throw FindHelpError.invalidResponse
        }
    }

    private static let isoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}
