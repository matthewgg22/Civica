import Foundation
import OSLog

protocol FindHelpServiceProtocol {
    func searchNearby(
        lat: Double,
        lng: Double,
        radiusKm: Double,
        serviceType: FindHelpServiceType?,
        languageCode: String?,
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
        serviceType: FindHelpServiceType? = nil,
        languageCode: String? = nil,
        maxResults: Int = 25
    ) async throws -> [FindHelpLocation] {
        var body: [String: Any] = [
            "lat": lat,
            "lng": lng,
            "radius_km": radiusKm,
            "max_results": maxResults
        ]
        if let serviceType { body["service_type"] = serviceType.rawValue }
        if let languageCode { body["language_code"] = languageCode }

        return try await callRPC(name: "find_help_locations_nearby", body: body)
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
