//
//  MyRepsViewModel.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/17/25.
//

import Foundation
import SwiftUI
import CoreLocation
import MapKit
import Contacts
import OSLog

enum ZipMapLookupState: Equatable {
    case idle
    case typing
    case validating
    case invalidInput
    case geocoding
    case outsideUSBlocked
    case resolvedUSCoordinate
    case error
}

enum RepsLookupSource: String, Codable, Sendable {
    case zip
    case address
}

struct RepsLocationSelection: Codable, Equatable, Sendable {
    let inputString: String
    let normalizedAddress: String?
    let postalCode: String?
    let city: String?
    let administrativeArea: String?
    let countryCode: String
    let latitude: Double
    let longitude: Double
    let source: RepsLookupSource
    let timestamp: Date

    enum CodingKeys: String, CodingKey {
        case inputString = "input_string"
        case normalizedAddress = "normalized_address"
        case postalCode = "postal_code"
        case city
        case administrativeArea = "administrative_area"
        case countryCode = "country_code"
        case latitude
        case longitude
        case source
        case timestamp
    }
}

struct ResolvedLocation: Sendable {
    let coordinate: CLLocationCoordinate2D
    let region: MKCoordinateRegion
    let placemark: CLPlacemark
    let source: RepsLookupSource
}

private struct ScheduledReminderElection {
    let electionID: String
    let electionName: String
    let electionDay: Date
    let earlyVotingStart: Date?
}

private struct TimelineStateElectionRecord: Decodable {
    let state_name: String
    let state_code: String
    let primary_date: String?
    let primary_runoff_date: String?
    let general_election_date: String?
    let registration_deadline_primary: String?
    let registration_deadline_general: String?
    let early_voting_primary: String?
    let early_voting_primary_runoff: String?
    let early_voting_general: String?
}

enum RepsLocationResolverError: LocalizedError {
    case emptyInput
    case invalidInput
    case notFound
    case outsideUS
    case missingCoordinate
    case missingPostalCode

    var errorDescription: String? {
        switch self {
        case .emptyInput:
            return "Enter a 5-digit U.S. ZIP, full U.S. address, city, or state."
        case .invalidInput:
            return "Enter a valid U.S. ZIP, full U.S. address, city, or state."
        case .notFound:
            return "We couldn't find that U.S. location. Try a full address with city and state."
        case .outsideUS:
            return "Civica currently supports U.S. addresses only."
        case .missingCoordinate:
            return "We couldn't determine a map coordinate for that location."
        case .missingPostalCode:
            return "We couldn't determine a valid U.S. ZIP code for that location."
        }
    }
}

enum USZipInputValidator {
    static func sanitizedInput(_ input: String) -> String {
        // Only sanitize when the user is clearly entering a ZIP-like value.
        // This preserves spaces while typing addresses like "877 Siesta Key ...".
        let withoutNewlines = input.trimmingCharacters(in: .newlines)
        let isZipLike = withoutNewlines.range(of: #"^[\d-]*$"#, options: .regularExpression) != nil
        guard isZipLike else { return input }
        return String(withoutNewlines.filter(\.isNumber).prefix(5))
    }

    static func isValidUSZipFormat(_ input: String) -> Bool {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        return trimmed.range(of: #"^\d{5}$"#, options: .regularExpression) != nil
    }

    static func normalizedPrimaryZIP(from input: String) -> String? {
        let digits = String(input.filter(\.isNumber).prefix(5))
        guard isValidUSZipFormat(digits) else { return nil }
        return digits
    }
}

private let usStateNameToCodeMap: [String: String] = [
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
    "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
    "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
    "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
    "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
    "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
    "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
    "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
    "district of columbia": "DC", "american samoa": "AS", "guam": "GU",
    "mariana islands": "MP", "northern marianas": "MP", "cnmi": "MP",
    "northern mariana islands": "MP", "commonwealth of the northern mariana islands": "MP",
    "puerto rico": "PR", "us virgin islands": "VI", "u s virgin islands": "VI", "virgin islands": "VI"
]

private let usStateAndTerritoryCodes: Set<String> = Set(usStateNameToCodeMap.values)
private let usTerritoryCodes: Set<String> = ["AS", "GU", "MP", "PR", "VI"]

func normalizedUSStateCode(from raw: String?) -> String? {
    guard let raw = raw?
        .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        .lowercased()
        .trimmingCharacters(in: .whitespacesAndNewlines),
          !raw.isEmpty else {
        return nil
    }

    let stripped = raw
        .replacingOccurrences(of: #"[^\p{L}\p{N}]+"#, with: " ", options: .regularExpression)
        .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)

    if stripped.count == 2 {
        let code = stripped.uppercased()
        return usStateAndTerritoryCodes.contains(code) ? code : nil
    }

    if let code = usStateNameToCodeMap[stripped] {
        return code
    }

    return nil
}

private func isTransientReminderNetworkError(_ error: Error) -> Bool {
    let nsError = error as NSError
    if nsError.domain == NSURLErrorDomain {
        switch nsError.code {
        case NSURLErrorTimedOut,
             NSURLErrorNetworkConnectionLost,
             NSURLErrorNotConnectedToInternet,
             NSURLErrorCannotFindHost,
             NSURLErrorCannotConnectToHost,
             NSURLErrorDNSLookupFailed:
            return true
        default:
            break
        }
    }
    let combined = "\(String(describing: error)) \(error.localizedDescription)".lowercased()
    return combined.contains("operation timed out")
        || combined.contains("network connection was lost")
        || combined.contains("timed out")
}

private func isReminderNoSessionError(_ error: Error) -> Bool {
    guard let supabaseError = error as? SupabaseManagerError else { return false }
    switch supabaseError {
    case .noSession:
        return true
    case .invalidLimit, .dateCalculationFailed:
        return false
    }
}

enum RepsLookupInputKind: Equatable {
    case zip(String)
    case address(String)
    case generalLocation(String)
    case invalid
}

enum RepsLookupInputParser {
    private static let streetTokens: Set<String> = [
        "st", "street", "ave", "avenue", "rd", "road", "blvd", "boulevard", "dr", "drive",
        "ln", "lane", "ct", "court", "cir", "circle", "way", "hwy", "highway", "pkwy", "parkway"
    ]

    static func parse(_ rawInput: String) -> RepsLookupInputKind {
        let trimmed = rawInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .invalid }

        if let normalizedZIP = USZipInputValidator.normalizedPrimaryZIP(from: trimmed) {
            return .zip(normalizedZIP)
        }

        if looksLikeAddress(trimmed) {
            return .address(trimmed)
        }
        if let normalizedStateInput = normalizedStateLookupInput(from: trimmed) {
            return .generalLocation(normalizedStateInput)
        }
        if looksLikeGeneralLocation(trimmed) {
            return .generalLocation(trimmed)
        }
        return .invalid
    }

    static func looksLikeAddress(_ input: String) -> Bool {
        let normalized = input.lowercased()
        let words = normalized
            .split(whereSeparator: { $0 == " " || $0 == "," || $0 == "\n" || $0 == "\t" })
            .map(String.init)

        let hasStreetNumber = normalized.range(of: #"\b\d{1,6}\b"#, options: .regularExpression) != nil
        let hasStreetToken = words.contains { streetTokens.contains($0.trimmingCharacters(in: .punctuationCharacters)) }
        let hasCommaPattern = input.contains(",") && words.count >= 2
        let hasStateZipPattern = normalized.range(of: #"\b[a-z]{2}\b\s+\d{5}\b"#, options: .regularExpression) != nil

        return hasStateZipPattern
            || (hasStreetNumber && hasStreetToken)
            || (hasStreetNumber && hasCommaPattern)
    }

    static func looksLikeGeneralLocation(_ input: String) -> Bool {
        let normalized = input
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return false }

        if normalizedUSStateCode(from: normalized) != nil {
            return true
        }

        let hasDigits = normalized.range(of: #"\d"#, options: .regularExpression) != nil
        guard !hasDigits else { return false }

        let cleaned = normalized
            .replacingOccurrences(of: #"[^\p{L}\s\.\-']+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return false }

        let words = cleaned.split(separator: " ")
        guard !words.isEmpty else { return false }
        guard words.count <= 4 else { return false }

        return true
    }

    private static func normalizedStateLookupInput(from input: String) -> String? {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        if let direct = normalizedUSStateCode(from: trimmed) {
            return direct
        }

        let splitCandidates = trimmed
            .split(separator: "-", maxSplits: 1, omittingEmptySubsequences: true)
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
        if let first = splitCandidates.first,
           let normalized = normalizedUSStateCode(from: first) {
            return normalized
        }
        if splitCandidates.count > 1,
           let normalized = normalizedUSStateCode(from: splitCandidates[1]) {
            return normalized
        }

        for token in trimmed.split(separator: ",") {
            let candidate = String(token).trimmingCharacters(in: .whitespacesAndNewlines)
            if let normalized = normalizedUSStateCode(from: candidate) {
                return normalized
            }
        }

        return nil
    }
}

private enum RepsLookupResultScope {
    case allReps
    case stateLevelOnly
}

enum USGeoGuard {
    private struct Bounds {
        let minLat: Double
        let maxLat: Double
        let minLon: Double
        let maxLon: Double

        func contains(_ coordinate: CLLocationCoordinate2D) -> Bool {
            coordinate.latitude >= minLat &&
            coordinate.latitude <= maxLat &&
            coordinate.longitude >= minLon &&
            coordinate.longitude <= maxLon
        }
    }

    private static let allowedBounds: [Bounds] = [
        Bounds(minLat: 24.396308, maxLat: 49.384358, minLon: -124.848974, maxLon: -66.885444),
        Bounds(minLat: 51.214183, maxLat: 71.365162, minLon: -179.148909, maxLon: -129.979500),
        Bounds(minLat: 18.910361, maxLat: 22.235600, minLon: -160.247100, maxLon: -154.806600),
        Bounds(minLat: 17.846000, maxLat: 18.549900, minLon: -67.270000, maxLon: -65.220000),
        Bounds(minLat: 13.182300, maxLat: 13.706200, minLon: 144.563400, maxLon: 144.956700),
        Bounds(minLat: 17.623500, maxLat: 17.810000, minLon: -64.896300, maxLon: -64.560300),
        Bounds(minLat: -14.382400, maxLat: -14.188000, minLon: -170.879000, maxLon: -169.273000),
        Bounds(minLat: 14.036600, maxLat: 20.616600, minLon: 144.813300, maxLon: 146.154400)
    ]

    private static let allowedCountryCodes: Set<String> = [
        "US", "AS", "GU", "MP", "PR", "VI"
    ]

    static func isAllowedUSCountryCode(_ code: String?) -> Bool {
        guard let normalized = code?.uppercased() else { return false }
        return allowedCountryCodes.contains(normalized)
    }

    static func isAllowedUSCoordinate(_ coordinate: CLLocationCoordinate2D) -> Bool {
        allowedBounds.contains { $0.contains(coordinate) }
    }
}

private enum MyRepsTrustCopy {
    static let invalidZip = "Invalid ZIP code"
    static let unresolvedState = "We couldn't determine your state"
    static let usOnly = "Location outside the U.S."
}

private enum AddressLookupErrorCode {
    static let invalidZip = "invalid_zip"
    static let invalidAddress = "invalid_address"
    static let notUS = "not_us"
    static let geocodeFailed = "geocode_failed"
    static let noResults = "no_results"
}

private final class USCurrentLocationProvider: NSObject, CLLocationManagerDelegate {
    enum LocationError: Error {
        case denied
        case unavailable
    }

    private let manager = CLLocationManager()
    private var completion: ((Result<CLLocationCoordinate2D, Error>) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func requestCurrentLocation(completion: @escaping (Result<CLLocationCoordinate2D, Error>) -> Void) {
        self.completion = completion

        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            manager.requestLocation()
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .restricted, .denied:
            completion(.failure(LocationError.denied))
            self.completion = nil
        @unknown default:
            completion(.failure(LocationError.unavailable))
            self.completion = nil
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard let completion else { return }

        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            manager.requestLocation()
        case .restricted, .denied:
            completion(.failure(LocationError.denied))
            self.completion = nil
        case .notDetermined:
            break
        @unknown default:
            completion(.failure(LocationError.unavailable))
            self.completion = nil
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let completion else { return }
        if let coordinate = locations.first?.coordinate {
            completion(.success(coordinate))
        } else {
            completion(.failure(LocationError.unavailable))
        }
        self.completion = nil
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        completion?(.failure(error))
        completion = nil
    }
}

@MainActor
final class MyRepsViewModel: ObservableObject {
    @Published var isLoading = false
    @Published var executiveReps: [Official] = []
    @Published var federalReps: [Official] = []
    @Published var stateReps: [Official] = []
    @Published var cityReps: [Official] = []
    @Published var errorMessage: String?
    @Published var detectedStateCode: String?
    @Published var zipMapCenter: CLLocationCoordinate2D?
    @Published var zipMapRadiusMeters: CLLocationDistance?
    @Published var zipMapRegion: MKCoordinateRegion?
    @Published var zipMapLastUpdated: Date?
    @Published var zipMapUpdateID = UUID()
    @Published var zipMapLookupState: ZipMapLookupState = .idle
    @Published var resolvedLocationSelection: RepsLocationSelection?
    @Published var isGeneralLocationSearchResult = false
    @Published var mapMode: MapMode = .national
    @Published var resolvedCoordinate: CLLocationCoordinate2D?
    @Published var resolvedStateCode: String?
    @Published var politicalGeography: PoliticalGeography?
    @Published var mapViewportResetID = UUID()
    @Published var timelineDataErrorMessage: String?

    private let registry: RepsProviderRegistry
    private let openStatesService = OpenStatesStateLegislativeService()
    private let geocoder = CLGeocoder()
    private let politicalGeographyService = PoliticalGeographyService()
    private let locationProvider = USCurrentLocationProvider()
    private let logger = Logger(subsystem: "Civica", category: "MyRepsViewModel")
    private var lookupToken = UUID()
    private let registryLookupQueue = DispatchQueue(
        label: "com.civica.myreps.registry-lookup",
        qos: .userInitiated
    )
    private var locationResolveTask: Task<Void, Never>?
    private var zipCoordinateCache: [String: RepsGeoCoordinate] = [:]
    private var zipLocalityCache: [String: String] = [:]
    private var zipRadiusCache: [String: CLLocationDistance] = [:]
    private let defaultZipRadiusMeters: CLLocationDistance = 8000
    private var lastTrackedLookupErrorCode: String?
    private var reminderSchedulingTask: Task<Void, Never>?
    private var reminderSchedulingInFlightElectionIDs: Set<String> = []
    private var reminderScheduledElectionIDsThisSession: Set<String> = []
    private static let fallbackPresidentialPrimaryISO = "2028-03-07"
    private static let presidentialGeneralElectionISO = "2028-11-07"
    private static let nonContinentalMapFocusCodes: Set<String> = ["AK", "HI", "AS", "GU", "MP", "PR", "VI"]

    private static let isoDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private struct TimelineRecordsLoadResult {
        let recordsByState: [String: TimelineStateElectionRecord]
        let errorMessage: String?
    }

    private let timelineRecordsByState: [String: TimelineStateElectionRecord]

    private static let timelineRecordsLoadResult: TimelineRecordsLoadResult = {
        let logger = Logger(subsystem: "Civica", category: "MyRepsViewModel")
        guard
            let url = Bundle.main.url(forResource: "USMidterm2026ElectionDates", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let records = try? JSONDecoder().decode([TimelineStateElectionRecord].self, from: data)
        else {
            let message = "Election reminder data is unavailable right now. Try again after restarting the app."
            logger.error("Failed to load USMidterm2026ElectionDates.json for reminder timeline.")
            return TimelineRecordsLoadResult(recordsByState: [:], errorMessage: message)
        }
        return TimelineRecordsLoadResult(
            recordsByState: Dictionary(uniqueKeysWithValues: records.map { ($0.state_code.uppercased(), $0) }),
            errorMessage: nil
        )
    }()

    init(registry: RepsProviderRegistry = .defaultRegistry()) {
        self.registry = registry
        self.timelineRecordsByState = Self.timelineRecordsLoadResult.recordsByState
        self.timelineDataErrorMessage = Self.timelineRecordsLoadResult.errorMessage
    }

    deinit {
        locationResolveTask?.cancel()
        reminderSchedulingTask?.cancel()
        geocoder.cancelGeocode()
    }

    func handleLocationInputTyping(_ rawInput: String) {
        let trimmed = rawInput.trimmingCharacters(in: .whitespacesAndNewlines)
        lookupToken = UUID()
        locationResolveTask?.cancel()
        geocoder.cancelGeocode()
        isLoading = false

        if trimmed.isEmpty {
            zipMapLookupState = .idle
            errorMessage = nil
            clearReps()
            clearZipMapHighlight()
            resetMapToNationalView()
            return
        }

        isGeneralLocationSearchResult = false
        zipMapLookupState = .typing
        errorMessage = nil
    }

    func handleZipInputTyping(_ rawInput: String) {
        handleLocationInputTyping(rawInput)
    }

    func resolveLocationInput(_ rawInput: String) {
        let trimmed = rawInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            resetZipEntryState()
            return
        }

        zipMapLookupState = .validating
        beginResolve(input: trimmed)
    }

    func resolveZipInput(_ rawInput: String) {
        resolveLocationInput(rawInput)
    }

    func resetZipEntryState() {
        lookupToken = UUID()
        locationResolveTask?.cancel()
        reminderSchedulingTask?.cancel()
        geocoder.cancelGeocode()
        isLoading = false
        errorMessage = nil
        zipMapLookupState = .idle
        isGeneralLocationSearchResult = false
        detectedStateCode = nil
        resolvedLocationSelection = nil
        lastTrackedLookupErrorCode = nil
        clearReps()
        clearZipMapHighlight()
        resetMapToNationalView()
    }

    func resetMapToNationalView() {
        mapMode = .national
        resolvedCoordinate = nil
        resolvedStateCode = nil
        politicalGeography = nil
        mapViewportResetID = UUID()
    }

    func focusMapStateFromTap(_ rawStateCode: String) {
        guard let normalizedCode = normalizedUSStateCode(from: rawStateCode) else { return }

        let previousStateCode = resolvedStateCode?.uppercased()
        if previousStateCode == normalizedCode {
            // Keep current pin/state context when re-tapping the same state.
            mapMode = .focused(stateCode: normalizedCode)
            return
        }

        lookupToken = UUID()
        let token = lookupToken
        locationResolveTask?.cancel()
        geocoder.cancelGeocode()
        isLoading = true
        errorMessage = nil
        zipMapLookupState = .geocoding

        mapMode = .focused(stateCode: normalizedCode)
        resolvedStateCode = normalizedCode
        detectedStateCode = normalizedCode

        // State taps intentionally clear prior address-pin context and load statewide-only reps.
        resolvedCoordinate = nil
        politicalGeography = PoliticalGeography(
            stateCode: normalizedCode,
            countyName: nil,
            congressionalDistrict: nil
        )
        clearZipMapHighlight()

        guard let lookupZIP = registry.representativeZIP(for: normalizedCode) else {
            clearReps()
            isLoading = false
            zipMapLookupState = .error
            errorMessage = "We couldn't determine a representative ZIP for \(normalizedCode)."
            return
        }

        let coordinateForLookup = zipCoordinateCache[lookupZIP]
        performLookup(
            zip: lookupZIP,
            coordinate: coordinateForLookup,
            locality: nil,
            scope: .stateLevelOnly,
            token: token
        )

        if coordinateForLookup == nil {
            loadStateLegislatorsForStateTap(
                zip: lookupZIP,
                stateCode: normalizedCode,
                token: token
            )
        }
    }

    func representativeZIP(for stateCode: String) -> String? {
        guard let normalizedCode = normalizedUSStateCode(from: stateCode) else { return nil }
        return registry.representativeZIP(for: normalizedCode)
    }

    func centerOnCurrentLocation() {
        lookupToken = UUID()
        let token = lookupToken
        locationResolveTask?.cancel()
        geocoder.cancelGeocode()
        isLoading = true
        isGeneralLocationSearchResult = false
        zipMapLookupState = .geocoding
        errorMessage = nil

        locationProvider.requestCurrentLocation { [weak self] result in
            Task { [weak self] in
                guard let self else { return }
                await MainActor.run {
                    switch result {
                    case .success(let coordinate):
                        guard USGeoGuard.isAllowedUSCoordinate(coordinate) else {
                            self.isLoading = false
                            self.zipMapLookupState = .outsideUSBlocked
                            self.errorMessage = MyRepsTrustCopy.usOnly
                            self.clearReps()
                            self.resetMapToNationalView()
                            self.trackNonSensitiveEvent("zip_outside_us_blocked")
                            return
                        }

                        Task { [weak self] in
                            guard let self else { return }
                            let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)

                            do {
                                let placemarks = try await self.geocoder.reverseGeocodeLocation(location)
                                if Task.isCancelled { return }
                                let resolvedPlacemark = self.bestUSPlacemark(from: placemarks, zip: nil) ?? placemarks.first

                                await MainActor.run {
                                    guard token == self.lookupToken else { return }
                                    guard let placemark = resolvedPlacemark else {
                                        self.isLoading = false
                                        self.zipMapLookupState = .error
                                        self.errorMessage = "Unable to resolve your current address."
                                        self.clearReps()
                                        self.resetMapToNationalView()
                                        return
                                    }

                                    let region = self.buildRegion(
                                        for: placemark,
                                        coordinate: coordinate,
                                        fallbackMeters: 3500
                                    )

                                    self.handleResolvedLocation(
                                        userInput: placemark.postalCode ?? "Current Location",
                                        source: .address,
                                        coordinate: coordinate,
                                        region: region,
                                        placemark: placemark,
                                        token: token
                                    )
                                }
                            } catch {
                                await MainActor.run {
                                    guard token == self.lookupToken else { return }
                                    self.isLoading = false
                                    self.zipMapLookupState = .error
                                    self.errorMessage = "Unable to use current location right now."
                                    self.clearReps()
                                    self.resetMapToNationalView()
                                }
                            }
                        }
                    case .failure:
                        self.isLoading = false
                        self.zipMapLookupState = .error
                        self.errorMessage = "Unable to use current location right now."
                        self.clearReps()
                        self.resetMapToNationalView()
                    }
                }
            }
        }
    }

    func fetchReps(for zip: String, zipInputValidated: Bool = false) {
        let normalizedZIP: String
        if zipInputValidated {
            normalizedZIP = registry.normalizedZIP(zip)
        } else {
            guard let validated = USZipInputValidator.normalizedPrimaryZIP(from: zip) else {
                lookupToken = UUID()
                locationResolveTask?.cancel()
                geocoder.cancelGeocode()
                isLoading = false
                errorMessage = MyRepsTrustCopy.invalidZip
                zipMapLookupState = .invalidInput
                clearReps()
                return
            }
            normalizedZIP = validated
        }

        resolveLocationInput(normalizedZIP)
    }

    func resolveLocation(from userInput: String) async throws -> (coordinate: CLLocationCoordinate2D, region: MKCoordinateRegion, placemark: CLPlacemark) {
        let parsed = RepsLookupInputParser.parse(userInput)

        let placemark: CLPlacemark
        let fallbackMeters: CLLocationDistance

        switch parsed {
        case .zip(let zip):
            fallbackMeters = 9000
            placemark = try await resolvePlacemarkForZIP(zip)
        case .address(let address):
            fallbackMeters = 1800
            placemark = try await resolvePlacemarkForAddress(address)
        case .generalLocation(let location):
            fallbackMeters = 48_000
            placemark = try await resolvePlacemarkForGeneralLocation(location)
        case .invalid:
            throw RepsLocationResolverError.invalidInput
        }

        guard let coordinate = placemark.location?.coordinate else {
            throw RepsLocationResolverError.missingCoordinate
        }

        guard USGeoGuard.isAllowedUSCountryCode(placemark.isoCountryCode) &&
              USGeoGuard.isAllowedUSCoordinate(coordinate) else {
            throw RepsLocationResolverError.outsideUS
        }

        let region = buildRegion(for: placemark, coordinate: coordinate, fallbackMeters: fallbackMeters)
        return (coordinate, region, placemark)
    }

    func resolveAndTrackAddress(input: String, context: String) async -> ResolvedLocation? {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        let parsed = RepsLookupInputParser.parse(trimmed)

        let inputType: AddressSearchEvent.InputType = {
            switch parsed {
            case .zip:
                return .zip
            case .address, .generalLocation:
                return .fullAddress
            case .invalid:
                let digitsOnly = String(trimmed.filter(\.isNumber))
                let isZipLikeAttempt = trimmed.range(of: #"^[\d\s-]+$"#, options: .regularExpression) != nil
                return (isZipLikeAttempt || !digitsOnly.isEmpty) ? .zip : .fullAddress
            }
        }()

        if case .invalid = parsed {
            let digitsOnly = String(trimmed.filter(\.isNumber))
            let isZipLikeAttempt = trimmed.range(of: #"^[\d\s-]+$"#, options: .regularExpression) != nil
            let errorCode = (isZipLikeAttempt && (!digitsOnly.isEmpty && digitsOnly.count != 5))
                ? AddressLookupErrorCode.invalidZip
                : AddressLookupErrorCode.invalidAddress
            await MainActor.run {
                self.lastTrackedLookupErrorCode = errorCode
            }
            await SupabaseManager.shared.logAddressSearchEvent(
                AddressSearchEvent(
                    userID: nil,
                    context: context,
                    rawInput: trimmed,
                    inputType: inputType,
                    success: false,
                    errorCode: errorCode,
                    resolvedDisplay: nil,
                    postalCode: nil,
                    city: nil,
                    state: nil,
                    countryCode: nil,
                    lat: nil,
                    lng: nil,
                    placeSource: .clGeocoder,
                    sessionID: nil
                )
            )
            return nil
        }

        do {
            let resolved = try await resolveLocation(from: trimmed)
            if Task.isCancelled {
                await MainActor.run {
                    self.lastTrackedLookupErrorCode = nil
                }
                return nil
            }

            let source: RepsLookupSource = {
                if case .zip = parsed { return .zip }
                return .address
            }()

            let normalizedZIP = USZipInputValidator.normalizedPrimaryZIP(from: resolved.placemark.postalCode ?? "")
            let resolvedDisplay = [
                resolved.placemark.name,
                resolved.placemark.locality,
                resolved.placemark.administrativeArea,
                normalizedZIP
            ]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")

            await MainActor.run {
                self.lastTrackedLookupErrorCode = nil
            }
            await SupabaseManager.shared.logAddressSearchEvent(
                AddressSearchEvent(
                    userID: nil,
                    context: context,
                    rawInput: trimmed,
                    inputType: inputType,
                    success: true,
                    errorCode: nil,
                    resolvedDisplay: resolvedDisplay.isEmpty ? nil : resolvedDisplay,
                    postalCode: normalizedZIP,
                    city: resolved.placemark.locality,
                    state: resolved.placemark.administrativeArea,
                    countryCode: resolved.placemark.isoCountryCode?.uppercased(),
                    lat: resolved.coordinate.latitude,
                    lng: resolved.coordinate.longitude,
                    placeSource: .clGeocoder,
                    sessionID: nil
                )
            )

            return ResolvedLocation(
                coordinate: resolved.coordinate,
                region: resolved.region,
                placemark: resolved.placemark,
                source: source
            )
        } catch is CancellationError {
            await MainActor.run {
                self.lastTrackedLookupErrorCode = nil
            }
            return nil
        } catch let geocodeError as CLError where geocodeError.code == .geocodeCanceled {
            await MainActor.run {
                self.lastTrackedLookupErrorCode = nil
            }
            return nil
        } catch {
            let errorCode: String
            if let resolverError = error as? RepsLocationResolverError {
                switch resolverError {
                case .outsideUS:
                    errorCode = AddressLookupErrorCode.notUS
                case .notFound:
                    errorCode = AddressLookupErrorCode.noResults
                case .invalidInput:
                    errorCode = AddressLookupErrorCode.invalidAddress
                case .emptyInput:
                    errorCode = AddressLookupErrorCode.invalidAddress
                case .missingCoordinate, .missingPostalCode:
                    errorCode = AddressLookupErrorCode.geocodeFailed
                }
            } else {
                errorCode = AddressLookupErrorCode.geocodeFailed
            }

            await MainActor.run {
                self.lastTrackedLookupErrorCode = errorCode
            }
            await SupabaseManager.shared.logAddressSearchEvent(
                AddressSearchEvent(
                    userID: nil,
                    context: context,
                    rawInput: trimmed,
                    inputType: inputType,
                    success: false,
                    errorCode: errorCode,
                    resolvedDisplay: nil,
                    postalCode: nil,
                    city: nil,
                    state: nil,
                    countryCode: nil,
                    lat: nil,
                    lng: nil,
                    placeSource: .clGeocoder,
                    sessionID: nil
                )
            )
            return nil
        }
    }

    private func beginResolve(input: String) {
        lookupToken = UUID()
        let token = lookupToken

        locationResolveTask?.cancel()
        geocoder.cancelGeocode()

        isLoading = true
        isGeneralLocationSearchResult = false
        errorMessage = nil
        zipMapLookupState = .geocoding

        locationResolveTask = Task { [weak self] in
            guard let self else { return }
            let resolved = await self.resolveAndTrackAddress(input: input, context: "my_reps")
            if Task.isCancelled {
                await MainActor.run {
                    if token == self.lookupToken {
                        self.isLoading = false
                    }
                }
                return
            }

            await MainActor.run {
                guard token == self.lookupToken else { return }
                if let resolved {
                    self.handleResolvedLocation(
                        userInput: input,
                        source: resolved.source,
                        coordinate: resolved.coordinate,
                        region: resolved.region,
                        placemark: resolved.placemark,
                        token: token
                    )
                } else {
                    self.isLoading = false
                    self.applyTrackedLookupFailure(for: input, errorCode: self.lastTrackedLookupErrorCode)
                }
            }
        }
    }

    private func handleResolvedLocation(
        userInput: String,
        source: RepsLookupSource,
        coordinate: CLLocationCoordinate2D,
        region: MKCoordinateRegion,
        placemark: CLPlacemark,
        token: UUID
    ) {
        guard token == lookupToken else { return }

        let parsed = RepsLookupInputParser.parse(userInput)
        let isGeneralLocationLookup: Bool = {
            if case .generalLocation = parsed { return true }
            return false
        }()
        let inputStateCode = normalizedUSStateCode(from: userInput)

        let normalizedZIP = USZipInputValidator.normalizedPrimaryZIP(from: placemark.postalCode ?? "")
            ?? {
                if case .zip(let zip) = parsed { return zip }
                return nil
            }()

        let normalizedStateCode = (isGeneralLocationLookup ? inputStateCode : nil)
            ?? normalizedUSStateCode(from: placemark.administrativeArea)
            ?? normalizedUSStateCode(from: placemark.postalAddress?.state)
            ?? normalizedZIP.flatMap { registry.resolvedStateCode(for: $0) }

        let lookupZIP: String?
        if let normalizedZIP {
            lookupZIP = normalizedZIP
        } else if isGeneralLocationLookup, let normalizedStateCode {
            lookupZIP = registry.representativeZIP(for: normalizedStateCode)
        } else {
            lookupZIP = nil
        }

        guard let lookupZIP else {
            isLoading = false
            zipMapLookupState = .error
            if case .zip = parsed {
                errorMessage = MyRepsTrustCopy.invalidZip
                zipMapLookupState = .invalidInput
            } else {
                errorMessage = MyRepsTrustCopy.unresolvedState
            }
            clearReps()
            resetMapToNationalView()
            return
        }

        let locality = placemark.locality ?? placemark.subAdministrativeArea ?? placemark.name
        let repsCoordinate = RepsGeoCoordinate(latitude: coordinate.latitude, longitude: coordinate.longitude)

        zipCoordinateCache[lookupZIP] = repsCoordinate
        zipLocalityCache[lookupZIP] = locality

        let radiusFromRegion = approximateRadius(from: region, center: coordinate)
        zipRadiusCache[lookupZIP] = radiusFromRegion

        updateZipMapHighlight(with: repsCoordinate, region: region, radiusMeters: radiusFromRegion)

        let normalizedAddress = [
            placemark.name,
            placemark.locality,
            placemark.administrativeArea,
            normalizedZIP
        ]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")

        let selection = RepsLocationSelection(
            inputString: userInput,
            normalizedAddress: normalizedAddress.isEmpty ? nil : normalizedAddress,
            postalCode: normalizedZIP,
            city: placemark.locality,
            administrativeArea: placemark.administrativeArea,
            countryCode: placemark.isoCountryCode?.uppercased() ?? "US",
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            source: source,
            timestamp: Date()
        )

        resolvedLocationSelection = selection
        saveLocationSelectionToSupabase(selection)

        let finalStateCode = normalizedStateCode ?? registry.resolvedStateCode(for: lookupZIP)
        detectedStateCode = finalStateCode
        resolvedStateCode = finalStateCode
        resolvedCoordinate = coordinate
        politicalGeography = finalStateCode.map {
            PoliticalGeography(
                stateCode: $0,
                countyName: nil,
                congressionalDistrict: nil
            )
        }
        if let finalStateCode {
            mapMode = .focused(stateCode: finalStateCode)
        } else {
            mapMode = .national
        }

        let resolvedLatitude = coordinate.latitude
        let resolvedLongitude = coordinate.longitude
        Task { [weak self] in
            guard let self else { return }
            let enriched = await self.politicalGeographyService.enrich(
                coordinate: coordinate,
                stateCode: finalStateCode
            )
            await MainActor.run {
                guard token == self.lookupToken else { return }
                guard
                    let current = self.resolvedCoordinate,
                    abs(current.latitude - resolvedLatitude) < 0.000001,
                    abs(current.longitude - resolvedLongitude) < 0.000001
                else {
                    return
                }
                self.politicalGeography = enriched
            }
        }

        performLookup(
            zip: lookupZIP,
            coordinate: repsCoordinate,
            locality: locality,
            scope: isGeneralLocationLookup ? .stateLevelOnly : .allReps,
            token: token
        )
        isGeneralLocationSearchResult = isGeneralLocationLookup

        logger.info("Address search resolved from source \(source.rawValue, privacy: .public).")
        if !isGeneralLocationLookup {
            scheduleElectionRemindersAfterAddressResolution(
                zip: lookupZIP,
                stateCode: detectedStateCode
            )
        }
    }

    private func scheduleElectionRemindersAfterAddressResolution(zip: String, stateCode: String?) {
        reminderSchedulingTask?.cancel()
        reminderSchedulingTask = Task { [weak self] in
            guard let self else { return }
            guard await SupabaseManager.shared.currentUserIDIfAvailable() != nil else {
                logger.debug("Skipping scheduled reminder insert because no authenticated user exists.")
                return
            }

            if Task.isCancelled { return }

            let normalizedStateCode = stateCode?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
                ?? self.registry.resolvedStateCode(for: zip)

            guard let normalizedStateCode else {
                logger.warning("Scheduled reminder insert skipped: unable to determine state code.")
                return
            }

            guard let nextElection = self.nextUpcomingTimelineElection(for: normalizedStateCode) else {
                logger.debug("Scheduled reminder insert skipped: no upcoming election found for state \(normalizedStateCode, privacy: .public).")
                return
            }

            guard ReminderSchedulingDeduper.begin(
                key: nextElection.electionID,
                inFlight: &self.reminderSchedulingInFlightElectionIDs,
                scheduledThisSession: &self.reminderScheduledElectionIDsThisSession
            ) else {
                logger.debug("Skipping duplicate reminder scheduling for electionID \(nextElection.electionID, privacy: .public).")
                return
            }

            var created = false
            defer {
                ReminderSchedulingDeduper.finish(
                    key: nextElection.electionID,
                    markScheduled: created,
                    inFlight: &self.reminderSchedulingInFlightElectionIDs,
                    scheduledThisSession: &self.reminderScheduledElectionIDsThisSession
                )
            }

            do {
                try await SupabaseManager.shared.scheduleElectionRemindersForResolvedAddress(
                    ElectionReminderSchedule(
                        electionID: nextElection.electionID,
                        electionDay: nextElection.electionDay,
                        earlyVotingStart: nextElection.earlyVotingStart,
                        stateCode: normalizedStateCode,
                        latitude: self.resolvedCoordinate?.latitude,
                        longitude: self.resolvedCoordinate?.longitude
                    )
                )
                created = true
                logger.info("Election reminders scheduled for electionID \(nextElection.electionID, privacy: .public).")
                // Secondary review signal: successful reminder creation.
                let hasLocationContext = self.resolvedCoordinate != nil
                    || self.resolvedLocationSelection != nil
                    || !(self.resolvedStateCode?.isEmpty ?? true)
                    || zip.count == 5
                ReviewPromptManager.shared.markReminderCreated(
                    isInErrorState: self.errorMessage != nil,
                    isFlowInterrupted: false,
                    hasLocationSet: hasLocationContext
                )
            } catch {
                if Task.isCancelled {
                    return
                }
                if isReminderNoSessionError(error) {
                    logger.debug("Scheduled reminder insert skipped: no active Supabase session.")
                    return
                }
                if isTransientReminderNetworkError(error) {
                    logger.warning("Scheduled reminder insert deferred due to transient network conditions.")
                    return
                }
                logger.error("Scheduled reminder insert failed after address resolution.")
            }
        }
    }

    private func nextUpcomingTimelineElection(for stateCode: String, now: Date = Date()) -> ScheduledReminderElection? {
        guard let record = loadTimelineRecord(for: stateCode) else {
            return nil
        }

        let midtermName = "\(record.state_name) 2026 Midterm"
        let presidentialName = "\(record.state_name) 2028 Presidential"
        var candidates: [ScheduledReminderElection] = []

        appendReminderElection(
            to: &candidates,
            electionName: midtermName,
            subtitle: "Primary Election",
            electionDateISO: record.primary_date,
            registrationDateISO: record.registration_deadline_primary,
            earlyVotingDateISO: record.early_voting_primary
        )

        appendReminderElection(
            to: &candidates,
            electionName: midtermName,
            subtitle: "Primary Runoff Election",
            electionDateISO: record.primary_runoff_date,
            registrationDateISO: record.registration_deadline_primary,
            earlyVotingDateISO: record.early_voting_primary_runoff ?? record.early_voting_primary
        )

        appendReminderElection(
            to: &candidates,
            electionName: midtermName,
            subtitle: "General Election",
            electionDateISO: record.general_election_date,
            registrationDateISO: record.registration_deadline_general,
            earlyVotingDateISO: record.early_voting_general
        )

        appendReminderElection(
            to: &candidates,
            electionName: presidentialName,
            subtitle: "Presidential Primary Election",
            electionDateISO: projectedPresidentialPrimaryISO(from: record.primary_date),
            registrationDateISO: projectedPresidentialPrimaryISO(from: record.primary_date),
            earlyVotingDateISO: nil
        )

        appendReminderElection(
            to: &candidates,
            electionName: presidentialName,
            subtitle: "Presidential General Election",
            electionDateISO: Self.presidentialGeneralElectionISO,
            registrationDateISO: Self.presidentialGeneralElectionISO,
            earlyVotingDateISO: nil
        )

        guard !candidates.isEmpty else { return nil }

        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: now)
        let sorted = candidates.sorted { $0.electionDay < $1.electionDay }

        if let upcoming = sorted.first(where: { calendar.startOfDay(for: $0.electionDay) >= startOfToday }) {
            return upcoming
        }
        return sorted.last
    }

    private func appendReminderElection(
        to candidates: inout [ScheduledReminderElection],
        electionName: String,
        subtitle: String,
        electionDateISO: String?,
        registrationDateISO: String?,
        earlyVotingDateISO: String?
    ) {
        guard let electionDay = Self.isoDateFormatter.date(from: electionDateISO ?? "") else {
            return
        }

        let registrationDeadline = Self.isoDateFormatter.date(from: registrationDateISO ?? "") ?? electionDay
        let earlyVotingStart = Self.isoDateFormatter.date(from: earlyVotingDateISO ?? "")
        let startDate = earlyVotingStart ?? electionDay
        let election = Election(
            name: electionName,
            subtitle: subtitle,
            registrationDeadline: registrationDeadline,
            startDate: startDate,
            electionDay: electionDay
        )

        candidates.append(
            ScheduledReminderElection(
                electionID: election.id,
                electionName: "\(electionName) • \(subtitle)",
                electionDay: electionDay,
                earlyVotingStart: earlyVotingStart
            )
        )
    }

    private func loadTimelineRecord(for stateCode: String) -> TimelineStateElectionRecord? {
        timelineRecordsByState[stateCode.uppercased()]
    }

    private func projectedPresidentialPrimaryISO(from midtermPrimaryISO: String?) -> String {
        guard
            let iso = midtermPrimaryISO,
            !iso.isEmpty
        else {
            return Self.fallbackPresidentialPrimaryISO
        }

        let parts = iso.split(separator: "-")
        guard parts.count == 3 else {
            return Self.fallbackPresidentialPrimaryISO
        }

        let shifted = String(format: "%04d-%@-%@", 2028, String(parts[1]), String(parts[2]))
        if Self.isoDateFormatter.date(from: shifted) != nil {
            return shifted
        }

        return Self.fallbackPresidentialPrimaryISO
    }

    private func performLookup(
        zip: String,
        coordinate: RepsGeoCoordinate?,
        locality: String?,
        scope: RepsLookupResultScope,
        token: UUID
    ) {
        guard token == lookupToken else { return }

        Task { [weak self] in
            guard let self else { return }

            do {
                let result = try await self.lookupRepresentativesOffMain(
                    zip: zip,
                    coordinate: coordinate,
                    locality: locality
                )
                guard token == self.lookupToken else { return }

                switch scope {
                case .allReps:
                    executiveReps = applyLevel(.federal, to: result.executive)
                    federalReps = dedupedOfficials(applyLevel(.federal, to: result.federal))
                    stateReps = applyLevel(.state, to: result.state)
                    cityReps = applyLevel(.local, to: result.city)
                    isGeneralLocationSearchResult = false
                case .stateLevelOnly:
                    executiveReps = applyLevel(.federal, to: result.executive)
                    federalReps = dedupedOfficials(
                        applyLevel(.federal, to: result.federal).filter(isStatewideFederalOfficial)
                    )
                    stateReps = applyLevel(.state, to: result.state).filter(isStatewideStateOfficial)
                    cityReps = []
                    isGeneralLocationSearchResult = true
                }

                if zipMapLookupState != .outsideUSBlocked {
                    zipMapLookupState = .resolvedUSCoordinate
                }

                let didResolveAnyReps = !executiveReps.isEmpty
                    || !federalReps.isEmpty
                    || !stateReps.isEmpty
                    || !cityReps.isEmpty
                if didResolveAnyReps {
                    // Secondary review signal: successful representative lookup.
                    Task {
                        let hasLocationContext = self.resolvedLocationSelection != nil
                            || coordinate != nil
                            || zip.count == 5
                        ReviewPromptManager.shared.markRepLookupSuccess(
                            isInErrorState: self.errorMessage != nil,
                            isFlowInterrupted: self.isLoading,
                            hasLocationSet: hasLocationContext
                        )
                    }
                }

                guard let coordinate else {
                    isLoading = false
                    return
                }

                let expectedStateCode = detectedStateCode ?? registry.resolvedStateCode(for: zip)
                let openStatesOfficials = await self.openStatesService.lookupStateLegislators(
                    zip: zip,
                    coordinate: coordinate,
                    expectedStateCode: expectedStateCode
                )
                if Task.isCancelled { return }
                guard token == self.lookupToken else { return }

                stateReps = dedupedOfficials(
                    stateReps + applyLevel(.state, to: openStatesOfficials)
                )
                isLoading = false
            } catch let providerError as RepsProviderError {
                guard token == self.lookupToken else { return }
                errorMessage = providerError.errorDescription
                if zipMapLookupState != .outsideUSBlocked {
                    zipMapLookupState = .error
                }
                clearReps()
                isLoading = false
            } catch {
                guard token == self.lookupToken else { return }
                errorMessage = "Unexpected error while loading representatives."
                if zipMapLookupState != .outsideUSBlocked {
                    zipMapLookupState = .error
                }
                clearReps()
                isLoading = false
            }
        }
    }

    private func lookupRepresentativesOffMain(
        zip: String,
        coordinate: RepsGeoCoordinate?,
        locality: String?
    ) async throws -> RepsLookupResult {
        let lookupQueue = registryLookupQueue
        let registry = self.registry
        return try await withCheckedThrowingContinuation { continuation in
            lookupQueue.async {
                do {
                    let result = try registry.lookup(zip: zip, coordinate: coordinate, locality: locality)
                    continuation.resume(returning: result)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func loadStateLegislatorsForStateTap(
        zip: String,
        stateCode: String,
        token: UUID
    ) {
        Task { [weak self] in
            guard let self else { return }
            if Task.isCancelled { return }

            let coordinate: RepsGeoCoordinate?
            if let cached = await MainActor.run(resultType: RepsGeoCoordinate?.self, body: { self.zipCoordinateCache[zip] }) {
                coordinate = cached
            } else {
                do {
                    let placemark = try await self.resolvePlacemarkForZIP(zip)
                    guard let clCoordinate = placemark.location?.coordinate else {
                        await MainActor.run {
                            guard token == self.lookupToken else { return }
                            self.isLoading = false
                        }
                        return
                    }

                    let resolvedCoordinate = RepsGeoCoordinate(
                        latitude: clCoordinate.latitude,
                        longitude: clCoordinate.longitude
                    )
                    await MainActor.run {
                        self.zipCoordinateCache[zip] = resolvedCoordinate
                    }
                    coordinate = resolvedCoordinate
                } catch {
                    await MainActor.run {
                        guard token == self.lookupToken else { return }
                        self.isLoading = false
                    }
                    return
                }
            }

            guard let coordinate else {
                await MainActor.run {
                    guard token == self.lookupToken else { return }
                    self.isLoading = false
                }
                return
            }

            let officials = await self.openStatesService.lookupStateLegislators(
                zip: zip,
                coordinate: coordinate,
                expectedStateCode: stateCode
            )
            if Task.isCancelled { return }

            await MainActor.run {
                guard token == self.lookupToken else { return }
                self.stateReps = self.dedupedOfficials(
                    self.stateReps + self.applyLevel(.state, to: officials)
                )
                self.isLoading = false
            }
        }
    }

    private func isStatewideFederalOfficial(_ official: Official) -> Bool {
        let division = (official.divisionId ?? "").lowercased()
        guard division.contains("/state:") else { return false }
        if !division.contains("/cd:") { return true }

        guard let stateCode = stateCodeFromDivisionID(division),
              usTerritoryCodes.contains(stateCode) else {
            return false
        }

        return division.contains("/cd:at_large")
            || division.contains("/cd:delegate")
            || division.contains("/cd:resident_commissioner")
    }

    private func isStatewideStateOfficial(_ official: Official) -> Bool {
        let division = (official.divisionId ?? "").lowercased()
        guard division.contains("/state:") else { return false }
        return !division.contains("/sldu:") && !division.contains("/sldl:")
    }

    private func stateCodeFromDivisionID(_ divisionID: String) -> String? {
        guard let stateRange = divisionID.range(of: "/state:") else {
            return nil
        }
        let suffix = divisionID[stateRange.upperBound...]
        let code = suffix.prefix { $0.isLetter }
        guard code.count == 2 else { return nil }
        return String(code).uppercased()
    }

    private func dedupedOfficials(_ officials: [Official]) -> [Official] {
        var indicesByKey: [String: Int] = [:]
        var unique: [Official] = []

        for official in officials {
            let keys = dedupeKeys(for: official)
            if let existingIndex = keys.compactMap({ indicesByKey[$0] }).first {
                let merged = mergedOfficial(preferred: unique[existingIndex], fallback: official)
                unique[existingIndex] = merged

                for key in Set(keys + dedupeKeys(for: merged)) {
                    indicesByKey[key] = existingIndex
                }
            } else {
                let index = unique.count
                unique.append(official)
                for key in Set(keys) {
                    indicesByKey[key] = index
                }
            }
        }

        return unique
    }

    private func dedupeKeys(for official: Official) -> [String] {
        var keys: [String] = []
        let normalizedName = normalizedDedupeText(official.name)
        let normalizedDivision = normalizedDedupeText(official.divisionId)
        let normalizedOfficeTitle = normalizedDedupeText(official.officeTitle)

        if !normalizedName.isEmpty && !normalizedDivision.isEmpty {
            keys.append("name+division|\(normalizedName)|\(normalizedDivision)")
        }

        if !normalizedDivision.isEmpty && (
            normalizedDivision.contains("/sldu:")
            || normalizedDivision.contains("/sldl:")
            || normalizedDivision.contains("/cd:")
        ) {
            keys.append("seat|\(normalizedDivision)")
        }

        // Some lookup providers can return duplicate statewide senator records with
        // slightly different division/url metadata; collapse those to one person/state.
        if normalizedOfficeTitle.contains("senator"),
           !normalizedName.isEmpty,
           let stateCode = stateCodeFromDivisionID((official.divisionId ?? "").lowercased()) {
            keys.append("senator+state+name|\(stateCode.lowercased())|\(normalizedName)")
        }

        if let normalizedURL = normalizedDedupeURL(official.url) {
            keys.append("url|\(normalizedURL)")
        }
        if let normalizedWebsite = normalizedDedupeURL(official.websiteURL) {
            keys.append("website|\(normalizedWebsite)")
        }
        if let normalizedContact = normalizedDedupeURL(official.contactFormURL) {
            keys.append("contact|\(normalizedContact)")
        }

        if keys.isEmpty && !normalizedName.isEmpty {
            keys.append("name|\(normalizedName)")
        }

        return keys
    }

    private func mergedOfficial(preferred: Official, fallback: Official) -> Official {
        Official(
            id: preferred.id,
            name: preferred.name,
            divisionId: preferred.divisionId ?? fallback.divisionId,
            party: preferred.party ?? fallback.party,
            officeTitle: preferred.officeTitle ?? fallback.officeTitle,
            photoURL: preferred.photoURL ?? fallback.photoURL,
            url: preferred.url ?? fallback.url,
            officialPhone: preferred.officialPhone ?? fallback.officialPhone,
            websiteURL: preferred.websiteURL ?? fallback.websiteURL,
            contactFormURL: preferred.contactFormURL ?? fallback.contactFormURL,
            committeeAssignments: preferred.committeeAssignments.isEmpty
                ? fallback.committeeAssignments
                : preferred.committeeAssignments,
            level: preferred.level ?? fallback.level
        )
    }

    private func normalizedDedupeText(_ raw: String?) -> String {
        (raw ?? "")
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .lowercased()
            .replacingOccurrences(of: #"[^\p{L}\p{N}]+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func normalizedDedupeURL(_ raw: String?) -> String? {
        guard var normalized = raw?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased(),
            !normalized.isEmpty else {
            return nil
        }

        while normalized.hasSuffix("/") {
            normalized.removeLast()
        }

        return normalized
    }

    private func applyLevel(_ level: OfficialLevel, to officials: [Official]) -> [Official] {
        officials.map { official in
            if official.level == nil {
                return official.withLevel(level)
            }
            return official
        }
    }

    private func resolvePlacemarkForZIP(_ zip: String) async throws -> CLPlacemark {
        let address = CNMutablePostalAddress()
        address.postalCode = zip
        address.isoCountryCode = "US"

        let placemarks = try await geocoder.geocodePostalAddress(address)
        guard !placemarks.isEmpty else { throw RepsLocationResolverError.notFound }

        if let best = bestUSPlacemark(from: placemarks, zip: zip) {
            return best
        }

        throw RepsLocationResolverError.notFound
    }

    private func resolvePlacemarkForAddress(_ address: String) async throws -> CLPlacemark {
        let initialPlacemarks = try await geocoder.geocodeAddressString(address)
        if !initialPlacemarks.isEmpty {
            if let best = bestUSPlacemark(from: initialPlacemarks, zip: nil) {
                return best
            }
            throw RepsLocationResolverError.outsideUS
        }

        let queryWithUSHint = addUSHintIfNeeded(to: address)
        guard queryWithUSHint != address else {
            throw RepsLocationResolverError.notFound
        }

        let hintedPlacemarks = try await geocoder.geocodeAddressString(queryWithUSHint)
        guard !hintedPlacemarks.isEmpty else { throw RepsLocationResolverError.notFound }

        if let best = bestUSPlacemark(from: hintedPlacemarks, zip: nil) {
            return best
        }

        throw RepsLocationResolverError.outsideUS
    }

    private func resolvePlacemarkForGeneralLocation(_ location: String) async throws -> CLPlacemark {
        let intendedStateCode = normalizedUSStateCode(from: location)
        let query = addUSHintIfNeeded(to: location)
        let placemarks = try await geocoder.geocodeAddressString(query)
        guard !placemarks.isEmpty else {
            throw RepsLocationResolverError.notFound
        }

        if let intendedStateCode {
            if let exactStateMatch = placemarks.first(where: {
                USGeoGuard.isAllowedUSCountryCode($0.isoCountryCode) &&
                    placemarkStateCode($0) == intendedStateCode
            }) {
                return exactStateMatch
            }

            // When the user explicitly enters a state/territory name, prefer that
            // jurisdiction's representative ZIP centroid over ambiguous geocoder hits.
            if let representativeZIP = registry.representativeZIP(for: intendedStateCode),
               let statePlacemark = try? await resolvePlacemarkForZIP(representativeZIP) {
                return statePlacemark
            }
        }

        if let best = bestUSPlacemark(from: placemarks, zip: nil) {
            return best
        }

        throw RepsLocationResolverError.outsideUS
    }

    private func placemarkStateCode(_ placemark: CLPlacemark) -> String? {
        if let direct = normalizedUSStateCode(from: placemark.administrativeArea)
            ?? normalizedUSStateCode(from: placemark.postalAddress?.state) {
            return direct
        }

        if let normalizedZIP = USZipInputValidator.normalizedPrimaryZIP(from: placemark.postalCode ?? "") {
            return registry.resolvedStateCode(for: normalizedZIP)
        }

        return nil
    }

    private func bestUSPlacemark(from placemarks: [CLPlacemark], zip: String?) -> CLPlacemark? {
        let usPlacemarks = placemarks.filter { USGeoGuard.isAllowedUSCountryCode($0.isoCountryCode) }
        guard !usPlacemarks.isEmpty else { return nil }

        if let zip {
            if let exact = usPlacemarks.first(where: {
                let candidate = USZipInputValidator.normalizedPrimaryZIP(from: $0.postalCode ?? "")
                return candidate == zip
            }) {
                return exact
            }

            if let near = usPlacemarks.first(where: { ($0.postalCode ?? "").hasPrefix(zip) }) {
                return near
            }
        }

        if let withPostal = usPlacemarks.first(where: { USZipInputValidator.normalizedPrimaryZIP(from: $0.postalCode ?? "") != nil }) {
            return withPostal
        }

        return usPlacemarks.first
    }

    private func buildRegion(
        for placemark: CLPlacemark,
        coordinate: CLLocationCoordinate2D,
        fallbackMeters: CLLocationDistance
    ) -> MKCoordinateRegion {
        if let circular = placemark.region as? CLCircularRegion,
           circular.radius >= 500,
           circular.radius <= 50_000 {
            let meters = min(max(circular.radius * 2.4, 1800), 45_000)
            return MKCoordinateRegion(
                center: coordinate,
                latitudinalMeters: meters,
                longitudinalMeters: meters
            )
        }

        return MKCoordinateRegion(
            center: coordinate,
            latitudinalMeters: fallbackMeters,
            longitudinalMeters: fallbackMeters
        )
    }

    private func approximateRadius(from region: MKCoordinateRegion, center: CLLocationCoordinate2D) -> CLLocationDistance {
        let latMeters = region.span.latitudeDelta * 111_000
        let lonScale = max(cos(center.latitude * .pi / 180.0), 0.25)
        let lonMeters = region.span.longitudeDelta * 111_000 * lonScale
        let base = max(latMeters, lonMeters) / 2.0
        return min(max(base, 1500), 25_000)
    }

    private func addUSHintIfNeeded(to query: String) -> String {
        let lower = query.lowercased()
        if lower.contains(" usa") || lower.contains(" united states") || lower.contains(" us") {
            return query
        }
        return query + ", USA"
    }

    private func clearReps() {
        isGeneralLocationSearchResult = false
        executiveReps = []
        federalReps = []
        stateReps = []
        cityReps = []
    }

    private func updateZipMapHighlight(with coordinate: RepsGeoCoordinate, region: MKCoordinateRegion, radiusMeters: CLLocationDistance) {
        let clCoordinate = CLLocationCoordinate2D(latitude: coordinate.latitude, longitude: coordinate.longitude)
        guard USGeoGuard.isAllowedUSCoordinate(clCoordinate) else {
            zipMapLookupState = .outsideUSBlocked
            errorMessage = MyRepsTrustCopy.usOnly
            resetMapToNationalView()
            trackNonSensitiveEvent("zip_outside_us_blocked")
            return
        }

        zipMapCenter = clCoordinate
        zipMapRegion = region
        zipMapRadiusMeters = min(max(radiusMeters, 1000), 30_000)
        zipMapLastUpdated = Date()
        zipMapUpdateID = UUID()
        zipMapLookupState = .resolvedUSCoordinate
    }

    private func clearZipMapHighlight() {
        zipMapCenter = nil
        zipMapRegion = nil
        zipMapRadiusMeters = nil
        zipMapLastUpdated = nil
        zipMapUpdateID = UUID()
    }

    private func saveLocationSelectionToSupabase(_ selection: RepsLocationSelection) {
        _ = selection
        // Intentionally disabled until schema + retention policy are finalized.
    }

    private func trackNonSensitiveEvent(_ name: String) {
        #if DEBUG
        logger.debug("[analytics] \(name, privacy: .public)")
        #endif
    }

    private func applyTrackedLookupFailure(for input: String, errorCode: String?) {
        let code = errorCode ?? AddressLookupErrorCode.geocodeFailed
        resetMapToNationalView()
        switch code {
        case AddressLookupErrorCode.invalidZip:
            zipMapLookupState = .invalidInput
            errorMessage = MyRepsTrustCopy.invalidZip
            clearReps()
        case AddressLookupErrorCode.invalidAddress:
            zipMapLookupState = .error
            errorMessage = MyRepsTrustCopy.unresolvedState
            clearReps()
        case AddressLookupErrorCode.notUS:
            zipMapLookupState = .outsideUSBlocked
            errorMessage = MyRepsTrustCopy.usOnly
            clearReps()
            trackNonSensitiveEvent("zip_outside_us_blocked")
        case AddressLookupErrorCode.noResults:
            let digitsOnly = String(input.filter(\.isNumber))
            if digitsOnly.count == 5 {
                zipMapLookupState = .invalidInput
                errorMessage = MyRepsTrustCopy.invalidZip
            } else {
                zipMapLookupState = .error
                errorMessage = MyRepsTrustCopy.unresolvedState
            }
            clearReps()
        default:
            zipMapLookupState = .error
            errorMessage = "Unexpected error while resolving location."
            clearReps()
        }
    }

    #if DEBUG
    func runAddressLookupHarness() {
        let testInputs = [
            "34242",
            "34000",
            "877 Siesta Key Cir, Sarasota, FL 34242",
            "Moscow, Russia"
        ]

        Task { [weak self] in
            guard let self else { return }
            for input in testInputs {
                let resolved = await self.resolveAndTrackAddress(input: input, context: "my_reps_harness")
                if let resolved {
                    _ = resolved
                    self.logger.debug("[AddressLookupHarness] lookup resolved.")
                } else {
                    _ = input
                    self.logger.debug("[AddressLookupHarness] lookup failed.")
                }
            }
        }
    }
    #endif
}
