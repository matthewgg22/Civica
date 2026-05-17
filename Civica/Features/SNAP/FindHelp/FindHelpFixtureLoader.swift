import Foundation
import OSLog

/// Source of fallback location data. Lets `FindHelpStore` swap in a
/// synthetic provider in tests; production always uses the bundled
/// JSON via `FindHelpFixtureLoader`.
protocol FindHelpFallbackProviding {
    func fallbackResults(
        lat: Double,
        lng: Double,
        radiusKm: Double,
        serviceType: FindHelpServiceType?,
        languageCode: String?,
        maxResults: Int
    ) -> [FindHelpLocation]
}

/// Loads the bundled regional fixtures and exposes a search API that
/// mirrors what the live Supabase RPC returns. Used by FindHelpStore
/// as a soft fallback when the live RPC fails or returns an empty
/// response so the map is never blank.
struct FindHelpFixtureLoader: FindHelpFallbackProviding {
    static let shared = FindHelpFixtureLoader(bundle: .main)

    private let bundle: Bundle
    private static let logger = Logger(subsystem: "Civica", category: "FindHelpFixtures")

    init(bundle: Bundle) {
        self.bundle = bundle
    }

    /// Returns locations within `radiusKm` of the given coordinate,
    /// after applying the same service-type / language filters the
    /// live RPC would, sorted by distance ascending and capped at
    /// `maxResults`. The returned objects' `distanceKm` is populated
    /// so the list view shows the same "X.X mi away" rows it would
    /// from a live response.
    func fallbackResults(
        lat: Double,
        lng: Double,
        radiusKm: Double,
        serviceType: FindHelpServiceType?,
        languageCode: String?,
        maxResults: Int
    ) -> [FindHelpLocation] {
        let all = loadAll()
        Self.logger.info("FindHelp fixture loaded \(all.count, privacy: .public) total rows; searching from (\(lat, privacy: .public),\(lng, privacy: .public)) radius=\(radiusKm, privacy: .public)km")
        // No region bbox gate here — the haversine distance filter is
        // sufficient. A CA user will never be within `radiusKm` of an
        // MA fixture row, and vice versa. Removing the region check
        // means this fallback works correctly regardless of which
        // FindHelpDemoRegion is set in Info.plist.
        let withDistance: [FindHelpLocation] = all.compactMap { location in
            guard let locLat = location.latitude, let locLng = location.longitude else { return nil }
            let distance = haversineKm(lat1: lat, lng1: lng, lat2: locLat, lng2: locLng)
            guard distance <= radiusKm else { return nil }
            if let serviceType, !matches(location, serviceType: serviceType) { return nil }
            if let languageCode, !(location.languagesJson ?? []).contains(languageCode) { return nil }
            var withDistance = location
            withDistance.distanceKm = distance
            return withDistance
        }
        Self.logger.info("FindHelp fixture matched \(withDistance.count, privacy: .public) within radius")
        return Array(withDistance.sorted { ($0.distanceKm ?? .infinity) < ($1.distanceKm ?? .infinity) }.prefix(maxResults))
    }

    /// All bundled/cached locations, unfiltered. Empty array on decode
    /// failure (logged). Exposed for tests / introspection.
    ///
    /// For each resource, checks the downloader's caches directory first
    /// (populated by `FindHelpFixtureDownloader.prefetchIfNeeded()`), then
    /// falls back to the bundle. Large files (ca_retailers) ship only a
    /// tiny stub in the bundle; the full dataset is cached after first launch.
    func loadAll() -> [FindHelpLocation] {
        let resources = Self.fixtureResources(for: FindHelpRegion.current)
        let decoder = Self.makeDecoder()
        var combined: [FindHelpLocation] = []
        for resource in resources {
            guard let url = Self.resolveURL(for: resource, bundle: bundle) else {
                Self.logger.error("FindHelp fixture missing: \(resource, privacy: .public)")
                continue
            }
            do {
                let data = try Data(contentsOf: url)
                let envelope = try decoder.decode(Envelope.self, from: data)
                combined.append(contentsOf: envelope.locations)
            } catch {
                Self.logger.error("FindHelp fixture \(resource, privacy: .public) decode failed: \(error.localizedDescription, privacy: .public)")
            }
        }
        return combined
    }

    /// Resolves the URL for a fixture resource. Caches directory wins over
    /// bundle so the downloaded full dataset replaces the bundled stub.
    private static func resolveURL(for resource: String, bundle: Bundle) -> URL? {
        let cached = FindHelpFixtureDownloader.cacheDirectory
            .appendingPathComponent("\(resource).json")
        if FileManager.default.fileExists(atPath: cached.path) {
            return cached
        }
        // Fall back to bundle. Large fixtures (ca_retailers) have a
        // ca_retailers_stub in the bundle; request the stub name if present.
        if let stubURL = bundle.url(forResource: "\(resource)_stub", withExtension: "json") {
            return stubURL
        }
        return bundle.url(forResource: resource, withExtension: "json")
    }

    private static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let str = try container.decode(String.self)
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = iso.date(from: str) { return date }
            iso.formatOptions = [.withInternetDateTime]
            if let date = iso.date(from: str) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot parse date: \(str)")
        }
        return decoder
    }

    private static func fixtureResources(for region: FindHelpRegion) -> [String] {
        // Always load every fixture. The haversine distance filter is the
        // region gate — a CA user is never within radiusKm of an MA row.
        // ca_retailers resolves to the cached full dataset (14 MB) or the
        // bundled 6-entry stub until the downloader has run.
        return ["ma_seed_locations", "ma_retailers", "ca_retailers"]
    }

    // MARK: - Filter parity with FindHelpFilterState.matches

    private func matches(_ location: FindHelpLocation, serviceType: FindHelpServiceType) -> Bool {
        switch serviceType {
        case .both:
            let types = Set(location.serviceTypes)
            return types.contains(.both) || (types.contains(.snapApplicationHelp) && types.contains(.foodAssistance))
        default:
            return location.serviceTypes.contains(serviceType)
        }
    }

    // MARK: - Haversine

    /// Great-circle distance in kilometers. Earth radius 6371 km.
    private func haversineKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double) -> Double {
        let r = 6371.0
        let dLat = (lat2 - lat1) * .pi / 180
        let dLng = (lng2 - lng1) * .pi / 180
        let a = sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180)
            * sin(dLng / 2) * sin(dLng / 2)
        return 2 * r * atan2(sqrt(a), sqrt(1 - a))
    }

    // MARK: - JSON envelope

    private struct Envelope: Decodable {
        let version: Int
        let scope: String
        let locations: [FindHelpLocation]
    }

}

/// Shared JSONDecoder for FindHelp payloads. Mirrors the date-decoding
/// strategy used by the live `FindHelpService` so bundled fixtures with
/// ISO timestamps (`civica_last_synced_at` etc.) decode identically.
enum FindHelpDecoder {
    static let shared: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            if let date = isoFractional.date(from: raw) { return date }
            if let date = iso.date(from: raw) { return date }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unrecognized date format: \(raw)"
            )
        }
        return decoder
    }()

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

