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
            return "Enter a 5-digit U.S. ZIP or a full U.S. address."
        case .invalidInput:
            return "Enter a valid U.S. ZIP or full address."
        case .notFound:gib
}

enum USZipInputValidator {
    private static let zipRegex = try! NSRegularExpression(pattern: #"^\d{5}$"#)

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
        let range = NSRange(location: 0, length: trimmed.utf16.count)
        return zipRegex.firstMatch(in: trimmed, options: [], range: range) != nil
    }

    static func normalizedPrimaryZIP(from input: String) -> String? {
        let digits = String(input.filter(\.isNumber).prefix(5))
        guard isValidUSZipFormat(digits) else { return nil }
        return digits
    }
}

enum RepsLookupInputKind: Equatable {
    case zip(String)
    case address(String)
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

        guard looksLikeAddress(trimmed) else { return .invalid }
        return .address(trimmed)
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
        let hasAnyLetters = normalized.range(of: #"[a-z]"#, options: .regularExpression) != nil
        let hasMultiWordLetters = hasAnyLetters && words.count >= 2

        return (hasStreetNumber && (hasStreetToken || hasCommaPattern))
            || hasStateZipPattern
            || hasCommaPattern
            || hasMultiWordLetters
    }
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
    static let invalidInput = "Enter a valid U.S. ZIP or full U.S. address."
    static let invalidZip = "Enter a 5-digit U.S. ZIP code (e.g., 10001)."
    static let usOnly = "VoteNow only supports U.S. locations."
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

    private let registry: RepsProviderRegistry
    private let openStatesService = OpenStatesStateLegislativeService()
    private let geocoder = CLGeocoder()
    private let locationProvider = USCurrentLocationProvider()
    private var lookupToken = UUID()
    private var locationResolveTask: Task<Void, Never>?
    private var zipCoordinateCache: [String: RepsGeoCoordinate] = [:]
    private var zipLocalityCache: [String: String] = [:]
    private var zipRadiusCache: [String: CLLocationDistance] = [:]
    private let defaultZipRadiusMeters: CLLocationDistance = 8000
    private var lastTrackedLookupErrorCode: String?

    init(registry: RepsProviderRegistry = .defaultRegistry()) {
        self.registry = registry
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
            return
        }

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
        geocoder.cancelGeocode()
        isLoading = false
        errorMessage = nil
        zipMapLookupState = .idle
        clearReps()
        clearZipMapHighlight()
    }

    func centerOnCurrentLocation() {
        lookupToken = UUID()
        let token = lookupToken
        locationResolveTask?.cancel()
        geocoder.cancelGeocode()
        isLoading = true
        zipMapLookupState = .geocoding
        errorMessage = nil

        locationProvider.requestCurrentLocation { [weak self] result in
            guard let self else { return }
            DispatchQueue.main.async {
                switch result {
                case .success(let coordinate):
                    guard USGeoGuard.isAllowedUSCoordinate(coordinate) else {
                        self.isLoading = false
                        self.zipMapLookupState = .outsideUSBlocked
                        self.errorMessage = MyRepsTrustCopy.usOnly
                        self.clearReps()
                        self.trackNonSensitiveEvent("zip_outside_us_blocked")
                        return
                    }

                    Task { [weak self] in
                        guard let self else { return }
                        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)

                        do {
                            let placemarks = try await self.geocoder.reverseGeocodeLocation(location)
                            let resolvedPlacemark = self.bestUSPlacemark(from: placemarks, zip: nil) ?? placemarks.first

                            await MainActor.run {
                                guard token == self.lookupToken else { return }
                                guard let placemark = resolvedPlacemark else {
                                    self.isLoading = false
                                    self.zipMapLookupState = .error
                                    self.errorMessage = "Unable to resolve your current address."
                                    self.clearReps()
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
                            }
                        }
                    }
                case .failure:
                    self.isLoading = false
                    self.zipMapLookupState = .error
                    self.errorMessage = "Unable to use current location right now."
                    self.clearReps()
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
            case .address:
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

        let normalizedZIP = USZipInputValidator.normalizedPrimaryZIP(from: placemark.postalCode ?? "")
            ?? {
                if case .zip(let zip) = parsed { return zip }
                return nil
            }()

        guard let lookupZIP = normalizedZIP else {
            isLoading = false
            zipMapLookupState = .error
            errorMessage = RepsLocationResolverError.missingPostalCode.errorDescription
            clearReps()
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

        detectedStateCode = placemark.administrativeArea ?? registry.resolvedStateCode(for: lookupZIP)
        performLookup(zip: lookupZIP, coordinate: repsCoordinate, locality: locality, token: token)
    }

    private func performLookup(zip: String, coordinate: RepsGeoCoordinate?, locality: String?, token: UUID) {
        guard token == lookupToken else { return }

        do {
            let result = try registry.lookup(zip: zip, coordinate: coordinate, locality: locality)
            executiveReps = applyLevel(.federal, to: result.executive)
            federalReps = applyLevel(.federal, to: result.federal)
            stateReps = applyLevel(.state, to: result.state)
            cityReps = applyLevel(.local, to: result.city)
            if zipMapLookupState != .outsideUSBlocked {
                zipMapLookupState = .resolvedUSCoordinate
            }

            guard let coordinate else {
                isLoading = false
                return
            }

            let expectedStateCode = detectedStateCode ?? registry.resolvedStateCode(for: zip)
            Task { [weak self] in
                guard let self else { return }
                let openStatesOfficials = await self.openStatesService.lookupStateLegislators(
                    zip: zip,
                    coordinate: coordinate,
                    expectedStateCode: expectedStateCode
                )

                await MainActor.run {
                    guard token == self.lookupToken else { return }
                    self.stateReps = self.dedupedOfficials(
                        self.stateReps + self.applyLevel(.state, to: openStatesOfficials)
                    )
                    self.isLoading = false
                }
            }
        } catch let providerError as RepsProviderError {
            errorMessage = providerError.errorDescription
            if zipMapLookupState != .outsideUSBlocked {
                zipMapLookupState = .error
            }
            clearReps()
            isLoading = false
        } catch {
            errorMessage = "Unexpected error while loading representatives."
            if zipMapLookupState != .outsideUSBlocked {
                zipMapLookupState = .error
            }
            clearReps()
            isLoading = false
        }
    }

    private func dedupedOfficials(_ officials: [Official]) -> [Official] {
        var seen = Set<String>()
        var unique: [Official] = []

        for official in officials {
            let key: String
            if let url = official.url?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
               !url.isEmpty {
                var normalizedURL = url
                while normalizedURL.hasSuffix("/") {
                    normalizedURL.removeLast()
                }
                key = "url:\(normalizedURL)"
            } else {
                key = "\(official.name.lowercased())|\(official.divisionId?.lowercased() ?? "")"
            }

            guard !seen.contains(key) else { continue }
            seen.insert(key)
            unique.append(official)
        }

        return unique
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
        // TODO: Persist resolved location selection to Supabase once schema is finalized.
        // saveLocationSelectionToSupabase(
        //   input_string: selection.inputString,
        //   normalized_address: selection.normalizedAddress,
        //   postal_code: selection.postalCode,
        //   city: selection.city,
        //   administrative_area: selection.administrativeArea,
        //   country_code: selection.countryCode,
        //   latitude: selection.latitude,
        //   longitude: selection.longitude,
        //   source: selection.source.rawValue,
        //   timestamp: selection.timestamp
        // )
    }

    private func trackNonSensitiveEvent(_ name: String) {
        #if DEBUG
        print("[analytics] \(name)")
        #endif
    }

    private func applyTrackedLookupFailure(for input: String, errorCode: String?) {
        let code = errorCode ?? AddressLookupErrorCode.geocodeFailed
        switch code {
        case AddressLookupErrorCode.invalidZip:
            zipMapLookupState = .invalidInput
            errorMessage = MyRepsTrustCopy.invalidZip
            clearReps()
        case AddressLookupErrorCode.invalidAddress:
            zipMapLookupState = .error
            errorMessage = MyRepsTrustCopy.invalidInput
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
                errorMessage = "We couldn't find that ZIP in the U.S. Try another 5-digit ZIP."
            } else {
                zipMapLookupState = .error
                errorMessage = RepsLocationResolverError.notFound.errorDescription
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
                    print("[AddressLookupHarness] ✅ \(input) -> \(resolved.coordinate.latitude), \(resolved.coordinate.longitude)")
                } else {
                    print("[AddressLookupHarness] ❌ \(input) -> \(self.lastTrackedLookupErrorCode ?? "unknown_error")")
                }
            }
        }
    }
    #endif
}
