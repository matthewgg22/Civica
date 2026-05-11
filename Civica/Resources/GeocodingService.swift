import Foundation
import CoreLocation

// Local US-coordinate guard. The legacy USGeoGuard lives in
// WeVote Information Page/ and isn't on the Civica target's source.
// Civica is MA-only at v1 so a small filebox-of-rules check covers
// the same intent: country code US, coordinate within the bounding
// box of the contiguous US + Alaska + Hawaii + territories.
private enum USGeoGuard {
    static func isAllowedUSCountryCode(_ code: String?) -> Bool {
        guard let code = code?.uppercased() else { return false }
        return code == "US"
    }

    static func isAllowedUSCoordinate(_ coordinate: CLLocationCoordinate2D) -> Bool {
        // Coarse bounding box: contiguous US (24°N-50°N, 125°W-66°W)
        // plus Alaska (50°N-72°N, 172°E-130°W) and Hawaii (18°N-23°N,
        // 161°W-154°W). Edge cases handled by the country-code check.
        let lat = coordinate.latitude
        let lon = coordinate.longitude
        if lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66 { return true }
        if lat >= 50 && lat <= 72 && (lon >= 172 || lon <= -130) { return true }
        if lat >= 18 && lat <= 23 && lon >= -161 && lon <= -154 { return true }
        return false
    }
}

protocol ElectionGeocoding {
    func geocodeAddress(_ text: String) async throws -> CLLocationCoordinate2D
    func geocodeZipOrCity(_ text: String) async throws -> CLLocationCoordinate2D
}

enum GeocodingServiceError: LocalizedError {
    case emptyInput
    case noResult
    case outsideUS
    case missingCoordinate

    var errorDescription: String? {
        switch self {
        case .emptyInput:
            return "Enter a location before searching."
        case .noResult:
            return "Location not found. Try adding more detail."
        case .outsideUS:
            return "Civica currently supports U.S. election lookups."
        case .missingCoordinate:
            return "Location found, but coordinates were unavailable."
        }
    }
}

struct GeocodingService: ElectionGeocoding {
    private let geocoder = CLGeocoder()

    func geocodeAddress(_ text: String) async throws -> CLLocationCoordinate2D {
        try await geocode(text)
    }

    func geocodeZipOrCity(_ text: String) async throws -> CLLocationCoordinate2D {
        try await geocode(text)
    }

    private func geocode(_ input: String) async throws -> CLLocationCoordinate2D {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw GeocodingServiceError.emptyInput }

        let query: String
        if trimmed.lowercased().contains("usa") || trimmed.lowercased().contains("united states") {
            query = trimmed
        } else {
            query = "\(trimmed), USA"
        }

        let placemarks = try await geocoder.geocodeAddressString(query)
        guard let placemark = bestUSPlacemark(from: placemarks) ?? placemarks.first else {
            throw GeocodingServiceError.noResult
        }
        guard let coordinate = placemark.location?.coordinate else {
            throw GeocodingServiceError.missingCoordinate
        }
        guard USGeoGuard.isAllowedUSCountryCode(placemark.isoCountryCode),
              USGeoGuard.isAllowedUSCoordinate(coordinate) else {
            throw GeocodingServiceError.outsideUS
        }
        return coordinate
    }

    private func bestUSPlacemark(from placemarks: [CLPlacemark]) -> CLPlacemark? {
        placemarks.first {
            USGeoGuard.isAllowedUSCountryCode($0.isoCountryCode) &&
            ($0.location?.coordinate).map(USGeoGuard.isAllowedUSCoordinate) == true
        }
    }
}
