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
    /// USDA SNAP Retailer Locator (ArcGIS feature service). Source
    /// for `record_kind = .ebtRetailer` rows. Currently populated
    /// from the seed JSON only; live ingest lands in a follow-up.
    case usdaRetailer = "usda_retailer"
}

/// Distinguishes the two stories the FindHelp map tells: where to
/// GET help applying / find free food (`helpDirectory`), and where
/// to SPEND EBT once you have it (`ebtRetailer`). Nullable on the
/// model so existing live RPC payloads that don't yet carry this
/// field decode unchanged - the computed `resolvedRecordKind`
/// defaults to `.helpDirectory` for back-compat.
enum FindHelpRecordKind: String, Codable, CaseIterable {
    case helpDirectory = "help_directory"
    case ebtRetailer = "ebt_retailer"
}

/// Retailer taxonomy used by `record_kind = .ebtRetailer` rows.
/// USDA's raw `Store_Type` has ~10 values that aren't useful to a
/// SNAP recipient ("Combination Grocery / Other", "Wholesaler with
/// Retail Sales"); this enum collapses those into the 5 categories
/// the map's category-colored pins + the "diversify revenue" filter
/// chips will actually expose.
enum SNAPRetailerCategory: String, Codable, CaseIterable, Identifiable {
    case supermarket
    case smallGrocer = "small_grocer"
    case farmersMarket = "farmers_market"
    case coOp = "co_op"
    case restaurantRMP = "restaurant_rmp"

    var id: String { rawValue }
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
    var distanceKm: Double?
    /// Nullable so live RPC payloads predating the discriminator
    /// decode unchanged. Use `resolvedRecordKind` everywhere a
    /// concrete value is needed.
    let recordKind: FindHelpRecordKind?
    /// Only populated on `record_kind = .ebtRetailer` rows.
    let retailerCategory: SNAPRetailerCategory?
    /// True when the retailer is also a WIC vendor. Nullable so live
    /// rows that don't yet carry this flag decode unchanged. Surfaced
    /// as a chip on the detail and peek sheets.
    let acceptsWic: Bool?
    /// True for retailers participating in the MA Healthy Incentives
    /// Program (HIP), which matches SNAP spent on fruits and vegetables
    /// up to a monthly cap. MA-specific today; the flag remains useful
    /// for future state expansions that adopt similar programs.
    let acceptsHip: Bool?

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
        case recordKind = "record_kind"
        case retailerCategory = "retailer_category"
        case acceptsWic = "accepts_wic"
        case acceptsHip = "accepts_hip"
    }

    /// Concrete record kind for routing decisions (pin color, filter
    /// chip matching, etc.). Live RPC rows without an explicit
    /// `record_kind` are treated as help-directory entries.
    var resolvedRecordKind: FindHelpRecordKind {
        recordKind ?? .helpDirectory
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
