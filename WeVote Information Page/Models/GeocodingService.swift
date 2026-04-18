import Foundation
import CoreLocation

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
