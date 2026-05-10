import Foundation

// EXPERIMENTAL SILOED MODULE: read-only directory of SNAP and food-assistance
// locations rendered inside the SNAP feature. Mirrors the find_help_locations
// table and find_help_locations_nearby RPC.

enum FindHelpServiceType: String, Codable, CaseIterable, Identifiable {
    case snapApplicationHelp = "snap_application_help"
    case foodAssistance = "food_assistance"
    case both

    var id: String { rawValue }
}

enum FindHelpSourceId: String, Codable {
    case usda
    case stateMaDta = "state_ma_dta"
    case maPantries = "ma_pantries"
    case feedingAmerica = "feeding_america"
    case twoOneOne = "two_one_one"
}

struct FindHelpLocation: Codable, Identifiable, Equatable {
    let id: UUID
    let externalId: String
    let source: FindHelpSourceId
    let name: String
    let addressLine1: String?
    let addressLine2: String?
    let city: String?
    let state: String
    let zip: String?
    let latitude: Double?
    let longitude: Double?
    let phone: String?
    let email: String?
    let websiteUrl: String?
    let hoursJson: [String: String]?
    let languagesJson: [String]?
    let serviceTypes: [FindHelpServiceType]
    let notes: String?
    let sourceLastUpdatedAt: Date?
    let civicaLastSyncedAt: Date?
    let distanceKm: Double?

    enum CodingKeys: String, CodingKey {
        case id
        case externalId = "external_id"
        case source
        case name
        case addressLine1 = "address_line_1"
        case addressLine2 = "address_line_2"
        case city
        case state
        case zip
        case latitude
        case longitude
        case phone
        case email
        case websiteUrl = "website_url"
        case hoursJson = "hours_json"
        case languagesJson = "languages_json"
        case serviceTypes = "service_types"
        case notes
        case sourceLastUpdatedAt = "source_last_updated_at"
        case civicaLastSyncedAt = "civica_last_synced_at"
        case distanceKm = "distance_km"
    }

    var primaryServiceType: FindHelpServiceType {
        if serviceTypes.contains(.both) { return .both }
        if serviceTypes.contains(.snapApplicationHelp) && serviceTypes.contains(.foodAssistance) {
            return .both
        }
        return serviceTypes.first ?? .snapApplicationHelp
    }

    var hasCoordinates: Bool {
        guard let latitude, let longitude else { return false }
        return abs(latitude) > 0.000001 || abs(longitude) > 0.000001
    }
}

struct FindHelpSourceAttribution: Codable, Identifiable, Equatable {
    var id: String { source }
    let source: String
    let displayName: String
    let attributionUrl: String?
    let lastSyncedAt: Date?
    let lastSucceededAt: Date?
    let lastError: String?

    enum CodingKeys: String, CodingKey {
        case source
        case displayName = "display_name"
        case attributionUrl = "attribution_url"
        case lastSyncedAt = "last_synced_at"
        case lastSucceededAt = "last_succeeded_at"
        case lastError = "last_error"
    }
}

struct FindHelpFilterState: Equatable {
    var serviceType: FindHelpServiceType?
    var languageCode: String?

    static let none = FindHelpFilterState(serviceType: nil, languageCode: nil)

    func matches(_ location: FindHelpLocation) -> Bool {
        if let serviceType {
            switch serviceType {
            case .both:
                let types = Set(location.serviceTypes)
                if !(types.contains(.both) || (types.contains(.snapApplicationHelp) && types.contains(.foodAssistance))) {
                    return false
                }
            default:
                if !location.serviceTypes.contains(serviceType) {
                    return false
                }
            }
        }
        if let languageCode {
            if !(location.languagesJson ?? []).contains(languageCode) {
                return false
            }
        }
        return true
    }
}

enum FindHelpError: LocalizedError, Equatable {
    case invalidResponse
    case network(message: String)
    case locationUnavailable

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "We could not read the directory response. Try again."
        case .network(let message):
            return message.isEmpty ? "Network request failed." : message
        case .locationUnavailable:
            return "We need a location or zip code to find help near you."
        }
    }
}
