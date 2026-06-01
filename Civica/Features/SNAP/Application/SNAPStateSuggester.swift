import Foundation
import CoreLocation
import OSLog

// Soft geo-suggestion for the "Which state are you applying in?" screen.
// Uses CoreLocation while-using-only + CLGeocoder reverse-geocode to derive
// the user's state. The state question is the first decisive routing fork
// of the SNAP application (gates BBCE / shelter standards / deduction
// math), so a one-tap pre-fill removes a chunk of typing friction for the
// 99% of users in a state we already have a row for.
//
// Privacy: permission prompt is gated behind a Civica explainer (the
// suggestion token only renders if the user opts in). If permission is
// denied or the reverse-geocode fails, the screen quietly falls back to
// the plain picker — the suggester never blocks or hard-fails.
//
// Supported states match SNAPWhereApplyingStrings.stateOptionsOrdered:
// {MA, NY, CA}. Any other US state resolves to the "OTHER" sentinel so
// the token can still hint "Looks like you're in Vermont — choose
// 'Another US state'." The full English state name is preserved for
// display even when the code maps to OTHER.

@MainActor
final class SNAPStateSuggester: NSObject, ObservableObject {
    enum Phase: Equatable {
        case idle
        case askingPermission
        case resolving
        case suggested(code: String, name: String)
        case denied
        case unresolved
    }

    @Published private(set) var phase: Phase = .idle

    /// The two-letter state code resolved from the user's location.
    /// `nil` until a successful suggestion is available. Maps to one of
    /// the canonical `SNAPWhereApplyingStrings.StateOption.code` values
    /// (`"MA"`, `"NY"`, `"CA"`, or `"OTHER"`).
    var suggestedStateCode: String? {
        if case let .suggested(code, _) = phase { return code }
        return nil
    }

    /// The full English state name (e.g. "Massachusetts"). Used in the
    /// suggestion token copy. `nil` outside of `.suggested`.
    var suggestedStateName: String? {
        if case let .suggested(_, name) = phase { return name }
        return nil
    }

    private let locationManager = CLLocationManager()
    private let geocoder = CLGeocoder()
    private let logger = Logger(subsystem: "Civica", category: "SNAPStateSuggester")

    /// Two-letter codes the SNAP application has a tuned packet for.
    /// Keep in sync with `SNAPWhereApplyingStrings.stateOptionsOrdered`.
    private static let supportedStateCodes: Set<String> = ["MA", "NY", "CA"]

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    /// Kick off the suggestion. Safe to call on every `.onAppear` —
    /// becomes a no-op once a suggestion (or terminal denial) is in
    /// flight or already settled.
    func start() {
        switch phase {
        case .askingPermission, .resolving, .suggested, .denied:
            return
        case .idle, .unresolved:
            break
        }

        let status = locationManager.authorizationStatus
        switch status {
        case .notDetermined:
            phase = .askingPermission
            locationManager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            phase = .resolving
            locationManager.requestLocation()
        case .denied, .restricted:
            phase = .denied
        @unknown default:
            phase = .unresolved
        }
    }

    /// Reverse-geocode the location and resolve into a state code. The
    /// result is the canonical two-letter state code if the location
    /// is in one of our supported states (MA / NY / CA), or `"OTHER"`
    /// for any other US state. Failures and non-US locations leave the
    /// suggester at `.unresolved`.
    private func resolve(_ location: CLLocation) {
        Task { [geocoder] in
            do {
                let placemarks = try await geocoder.reverseGeocodeLocation(location)
                guard let place = placemarks.first else {
                    await MainActor.run { self.phase = .unresolved }
                    return
                }
                // The administrativeArea on a US placemark is the
                // two-letter postal code on iOS 16+; on older OSes it
                // may be the full name. Handle both.
                let raw = (place.administrativeArea ?? "").uppercased()
                let countryCode = (place.isoCountryCode ?? "").uppercased()
                let name = place.administrativeArea.flatMap { Self.fullStateName(for: $0) } ?? raw
                guard countryCode == "US" else {
                    await MainActor.run { self.phase = .unresolved }
                    return
                }
                let normalized = Self.normalize(raw)
                let code = Self.supportedStateCodes.contains(normalized) ? normalized : "OTHER"
                await MainActor.run {
                    self.phase = .suggested(code: code, name: name.isEmpty ? normalized : name)
                }
            } catch {
                self.logger.error("Reverse geocode failed: \(String(describing: error))")
                await MainActor.run { self.phase = .unresolved }
            }
        }
    }

    /// Normalize an `administrativeArea` value to a 2-letter postal
    /// code. iOS usually returns the code already; older devices and
    /// some locales return the full name (e.g. "Massachusetts").
    private static func normalize(_ raw: String) -> String {
        if raw.count == 2 { return raw }
        return fullStateNameToCode[raw.capitalized] ?? raw
    }

    /// Reverse lookup: 2-letter code → full English name (for display).
    private static func fullStateName(for code: String) -> String? {
        let key = code.uppercased()
        return codeToFullStateName[key]
    }

    private static let codeToFullStateName: [String: String] = [
        "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
        "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
        "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
        "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
        "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
        "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
        "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
        "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
        "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
        "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
        "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
        "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
        "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia"
    ]

    private static let fullStateNameToCode: [String: String] = Dictionary(
        uniqueKeysWithValues: codeToFullStateName.map { ($0.value, $0.key) }
    )
}

extension SNAPStateSuggester: CLLocationManagerDelegate {
    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didChangeAuthorization status: CLAuthorizationStatus
    ) {
        Task { @MainActor in
            switch status {
            case .authorizedWhenInUse, .authorizedAlways:
                self.phase = .resolving
                manager.requestLocation()
            case .denied, .restricted:
                self.phase = .denied
            case .notDetermined:
                // Stay in askingPermission until the user picks.
                break
            @unknown default:
                self.phase = .unresolved
            }
        }
    }

    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let location = locations.last else { return }
        Task { @MainActor in self.resolve(location) }
    }

    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {
        Task { @MainActor in
            self.logger.error("Location request failed: \(String(describing: error))")
            self.phase = .unresolved
        }
    }
}
