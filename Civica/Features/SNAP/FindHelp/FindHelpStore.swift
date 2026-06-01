import Combine
import CoreLocation
import Foundation
import OSLog

/// Top-level layer the user is browsing. Drives which record_kind
/// rows render on the map and in the list. `.both` is the default
/// so first-time users see the full SNAP ecosystem (apply for help
/// plus where to spend benefits) without having to discover the
/// toggle. The toggle UI lives in FindHelpRootView; the filtering
/// is done in `filteredLocations` here.
enum FindHelpLayerSelection: String, CaseIterable, Identifiable {
    case findHelp
    case spend
    case both

    var id: String { rawValue }

    func matches(_ location: FindHelpLocation) -> Bool {
        switch self {
        case .findHelp: return location.resolvedRecordKind == .helpDirectory
        case .spend:    return location.resolvedRecordKind == .ebtRetailer
        case .both:     return true
        }
    }
}

@MainActor
final class FindHelpStore: ObservableObject {
    /// Default search radius — ~25 miles. Wide enough to fill the map
    /// with nearby results on first load without feeling overwhelming.
    static let defaultRadiusKm: Double = 40.0
    /// Empty-state "look farther" radius — ~75 miles.
    static let expandedRadiusKm: Double = 120.0
    /// Minimum movement before `requestSearch` reissues a query at the
    /// new coordinate. Stops a noisy CoreLocation stream from spamming
    /// the RPC while the user is stationary.
    static let researchThresholdMeters: CLLocationDistance = 250

    @Published private(set) var locations: [FindHelpLocation] = []
    @Published private(set) var sources: [FindHelpSourceAttribution] = []
    @Published var userLocation: CLLocation?
    @Published var selectedLocation: FindHelpLocation?
    @Published var filter: FindHelpFilterState = .none
    @Published private(set) var isLoading: Bool = false
    @Published var error: FindHelpError?
    /// Current search radius. Starts at `defaultRadiusKm`; the empty-
    /// state CTA bumps it to `expandedRadiusKm`. Exposed so view code
    /// can format it back into miles for user-facing copy.
    @Published private(set) var currentRadiusKm: Double = FindHelpStore.defaultRadiusKm

    /// Coordinate of the most recent successful (or attempted) RPC call.
    /// FindHelpRootView reads this to gate "Search this area" arming on
    /// a distance threshold so the pill doesn't flash on every micro-pan.
    private(set) var lastSearchedLocation: CLLocation?

    /// True iff the most recent successful `searchNearby` call returned
    /// bundled MA seed data because the live Supabase RPC was
    /// unreachable. The UI can surface a "Showing offline directory"
    /// banner off this flag; the transport-error view in
    /// FindHelpRootView keeps its role as the last-resort path when
    /// the fixture fallback also returns nothing.
    @Published private(set) var isUsingFallbackData: Bool = false

    /// Which layers of the SNAP ecosystem the user is browsing.
    /// Drives `filteredLocations` and the layer-toggle UI. Default
    /// is `.findHelp` because the on-ramp from Enroll is "where can
    /// I get application help" — `.both` was confusing first-time
    /// users by surfacing EBT-spend retailers before they have a
    /// card. Callers presenting the map for a different intent (e.g.
    /// post-approval EBT-spend) can flip this after init.
    @Published var layerSelection: FindHelpLayerSelection = .findHelp

    private let fixtures: FindHelpFallbackProviding

    private let service: FindHelpServiceProtocol
    private static let logger = Logger(subsystem: "Civica", category: "FindHelpStore")

    private var pendingSearch: Task<Void, Never>?

    init(
        service: FindHelpServiceProtocol = FindHelpService(),
        fixtures: FindHelpFallbackProviding = FindHelpFixtureLoader.shared
    ) {
        self.service = service
        self.fixtures = fixtures
    }

    var filteredLocations: [FindHelpLocation] {
        locations
            .filter(layerSelection.matches)
            .filter(filter.matches)
    }

    func searchNearby(
        lat: Double,
        lng: Double,
        radiusKm: Double = 40,
        precision: FindHelpLocationPrecision = .coarse,
        maxResults: Int = 50
    ) {
        pendingSearch?.cancel()
        isLoading = true
        error = nil

        let serviceType = filter.serviceType
        let languageCode = filter.languageCode

        FindHelpAnalytics.trackSearchPrecisionUsed(precision)

        pendingSearch = Task { [service] in
            do {
                let results = try await service.searchNearby(
                    lat: lat,
                    lng: lng,
                    radiusKm: radiusKm,
                    precision: precision,
                    serviceType: serviceType,
                    languageCode: languageCode,
                    maxResults: maxResults
                )
                if Task.isCancelled { return }
                if results.isEmpty {
                    // Empty live response (e.g. demo build where the
                    // active region has no rows in Supabase yet) falls
                    // through to the bundled fixture so the map is
                    // populated. The fixture loader applies the same
                    // region bbox gate, so this can't surface stale
                    // out-of-region data.
                    let fallback = self.fixtures.fallbackResults(
                        lat: lat,
                        lng: lng,
                        radiusKm: radiusKm,
                        serviceType: serviceType,
                        languageCode: languageCode,
                        maxResults: maxResults
                    )
                    self.locations = fallback
                    self.isUsingFallbackData = !fallback.isEmpty
                } else {
                    self.locations = results
                    self.isUsingFallbackData = false
                }
                self.isLoading = false
            } catch let error as FindHelpError {
                if Task.isCancelled { return }
                self.handleSearchFailure(
                    error,
                    lat: lat,
                    lng: lng,
                    radiusKm: radiusKm,
                    serviceType: serviceType,
                    languageCode: languageCode,
                    maxResults: maxResults
                )
            } catch {
                if Task.isCancelled { return }
                Self.logger.error("Unexpected FindHelp error: \(error.localizedDescription, privacy: .public)")
                self.handleSearchFailure(
                    .network(message: error.localizedDescription),
                    lat: lat,
                    lng: lng,
                    radiusKm: radiusKm,
                    serviceType: serviceType,
                    languageCode: languageCode,
                    maxResults: maxResults
                )
            }
        }
    }

    /// Centralizes the post-failure decision: transport errors get a
    /// soft fallback to bundled MA fixtures so the demo map keeps its
    /// pins; everything else surfaces the error to the UI as before.
    private func handleSearchFailure(
        _ error: FindHelpError,
        lat: Double,
        lng: Double,
        radiusKm: Double,
        serviceType: FindHelpServiceType?,
        languageCode: String?,
        maxResults: Int
    ) {
        if case .network = error {
            let fallback = fixtures.fallbackResults(
                lat: lat,
                lng: lng,
                radiusKm: radiusKm,
                serviceType: serviceType,
                languageCode: languageCode,
                maxResults: maxResults
            )
            if !fallback.isEmpty {
                self.locations = fallback
                self.isUsingFallbackData = true
                self.error = nil
                self.isLoading = false
                return
            }
        }
        self.error = error
        self.isLoading = false
    }

    func loadSources() {
        Task { [service] in
            do {
                let sources = try await service.loadSources()
                self.sources = sources
            } catch {
                Self.logger.error("FindHelp sources load failed: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    func selectLocation(_ location: FindHelpLocation?) {
        selectedLocation = location
    }

    func clearSelection() {
        selectedLocation = nil
    }

    func updateFilter(_ filter: FindHelpFilterState) {
        self.filter = filter
        guard let userLocation else { return }
        searchNearby(
            lat: userLocation.coordinate.latitude,
            lng: userLocation.coordinate.longitude,
            radiusKm: currentRadiusKm
        )
    }

    // MARK: - Location-driven search

    /// Reissue a nearby search at the supplied coordinate if the user
    /// has moved at least `researchThresholdMeters` since the last
    /// query. Called from the CoreLocation stream and the zip-fallback
    /// path so both paths share the same dedupe behavior.
    func requestSearch(
        for location: CLLocation,
        precision: FindHelpLocationPrecision = .coarse
    ) {
        if let last = lastSearchedLocation,
           last.distance(from: location) < Self.researchThresholdMeters {
            return
        }
        lastSearchedLocation = location
        searchNearby(
            lat: location.coordinate.latitude,
            lng: location.coordinate.longitude,
            radiusKm: currentRadiusKm,
            precision: precision
        )
    }

    /// Empty-state CTA: bump from the default ~5-mile radius to the
    /// expanded ~25-mile radius and re-search at the user's location.
    func expandRadiusAndResearch() {
        currentRadiusKm = Self.expandedRadiusKm
        guard let userLocation else { return }
        lastSearchedLocation = userLocation
        searchNearby(
            lat: userLocation.coordinate.latitude,
            lng: userLocation.coordinate.longitude,
            radiusKm: currentRadiusKm
        )
    }

    /// Re-issue the most recent search. Falls back to whatever
    /// location is currently in `userLocation` if no prior search
    /// has run yet.
    func retryLastSearch() {
        let location = lastSearchedLocation ?? userLocation
        guard let location else { return }
        searchNearby(
            lat: location.coordinate.latitude,
            lng: location.coordinate.longitude,
            radiusKm: currentRadiusKm
        )
    }
}
