import Foundation
import OSLog

/// Loads the bundled per-state seed directory matching
/// `FindHelpRegion.current` and exposes a search API that mirrors
/// what the live Supabase RPC returns. Used by FindHelpStore as a
/// soft fallback when the network call fails so the demo map
/// always has pins instead of an empty-state or hostname-not-found
/// screen. When the live RPC is healthy these fixtures are unused.
/// For `.nationwide` and `.bbox` regions, all known seed files are
/// concatenated and the per-location bbox filter handles geographic
/// scoping at query time.
struct FindHelpFixtureLoader {
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
        let region = FindHelpRegion.current

        // First pass: pins within the active region's bbox AND
        // within the requested radius of the user. This is the
        // intended behavior — matches what the live RPC would do.
        let strict: [FindHelpLocation] = all.compactMap { location in
            guard let locLat = location.latitude, let locLng = location.longitude else { return nil }
            guard region.contains(lat: locLat, lng: locLng) else { return nil }
            let distance = haversineKm(lat1: lat, lng1: lng, lat2: locLat, lng2: locLng)
            guard distance <= radiusKm else { return nil }
            if let serviceType, !matches(location, serviceType: serviceType) { return nil }
            if let languageCode, !(location.languagesJson ?? []).contains(languageCode) { return nil }
            return location.copyingDistance(distance)
        }
        if !strict.isEmpty {
            return Array(strict.sorted { ($0.distanceKm ?? .infinity) < ($1.distanceKm ?? .infinity) }.prefix(maxResults))
        }

        // Second pass: the strict filter returned nothing — usually
        // because the user is physically far from every bundled
        // seed (e.g. someone in a non-CA state offline-testing the
        // CA launch build). Rather than surface a transport error
        // with no useful next step, return all bundled in-region
        // pins sorted by distance with no radius cap. The list
        // view's "X mi away" labels still tell the user these are
        // far — but at least the directory has content.
        let regional: [FindHelpLocation] = all.compactMap { location in
            guard let locLat = location.latitude, let locLng = location.longitude else { return nil }
            guard region.contains(lat: locLat, lng: locLng) else { return nil }
            if let serviceType, !matches(location, serviceType: serviceType) { return nil }
            if let languageCode, !(location.languagesJson ?? []).contains(languageCode) { return nil }
            let distance = haversineKm(lat1: lat, lng1: lng, lat2: locLat, lng2: locLng)
            return location.copyingDistance(distance)
        }
        return Array(regional.sorted { ($0.distanceKm ?? .infinity) < ($1.distanceKm ?? .infinity) }.prefix(maxResults))
    }

    /// All bundled locations matching the active `FindHelpRegion`,
    /// unfiltered by service type or language. Empty array on decode
    /// failure (logged). Exposed for tests / introspection.
    func loadAll() -> [FindHelpLocation] {
        loadAll(for: FindHelpRegion.current)
    }

    /// All bundled locations matching a specific region. Concrete
    /// regions load their state seed; `.nationwide` and `.bbox`
    /// concatenate every known seed.
    func loadAll(for region: FindHelpRegion) -> [FindHelpLocation] {
        let resourceNames: [String]
        switch region {
        case .california:    resourceNames = ["ca_seed_locations"]
        case .massachusetts: resourceNames = ["ma_seed_locations"]
        case .nationwide, .bbox:
            resourceNames = ["ca_seed_locations", "ma_seed_locations"]
        }
        return resourceNames.flatMap(loadSeedFile)
    }

    private func loadSeedFile(_ resourceName: String) -> [FindHelpLocation] {
        guard let url = bundle.url(forResource: resourceName, withExtension: "json") else {
            Self.logger.error("FindHelp fixture \(resourceName, privacy: .public).json missing from bundle")
            return []
        }
        do {
            let data = try Data(contentsOf: url)
            let envelope = try Self.decoder.decode(Envelope.self, from: data)
            return envelope.locations
        } catch {
            Self.logger.error("FindHelp fixture \(resourceName, privacy: .public).json decode failed: \(error.localizedDescription, privacy: .public)")
            return []
        }
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

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            if let date = isoFractional.date(from: raw) { return date }
            if let date = iso.date(from: raw) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unrecognized date format: \(raw)")
        }
        return decoder
    }()

    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}

private extension FindHelpLocation {
    /// Returns a copy with `distanceKm` set; FindHelpLocation has no
    /// `mutating` API because every field is `let`.
    func copyingDistance(_ km: Double) -> FindHelpLocation {
        FindHelpLocation(
            id: id,
            externalId: externalId,
            source: source,
            name: name,
            addressLine1: addressLine1,
            addressLine2: addressLine2,
            city: city,
            state: state,
            zip: zip,
            latitude: latitude,
            longitude: longitude,
            phone: phone,
            email: email,
            websiteUrl: websiteUrl,
            hoursJson: hoursJson,
            languagesJson: languagesJson,
            serviceTypes: serviceTypes,
            notes: notes,
            sourceLastUpdatedAt: sourceLastUpdatedAt,
            civicaLastSyncedAt: civicaLastSyncedAt,
            distanceKm: km,
            recordKind: recordKind,
            retailerCategory: retailerCategory,
            acceptsWic: acceptsWic,
            acceptsHip: acceptsHip
        )
    }
}
