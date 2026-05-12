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
    @Published private(set) var locations: [FindHelpLocation] = []
    @Published private(set) var sources: [FindHelpSourceAttribution] = []
    @Published var userLocation: CLLocation?
    @Published var selectedLocation: FindHelpLocation?
    @Published var filter: FindHelpFilterState = .none
    @Published private(set) var isLoading: Bool = false
    @Published var error: FindHelpError?

    /// True iff the most recent successful `searchNearby` call returned
    /// bundled MA seed data because the live Supabase RPC was
    /// unreachable. The UI can surface a "Showing offline directory"
    /// banner off this flag; the transport-error view in
    /// FindHelpRootView keeps its role as the last-resort path when
    /// the fixture fallback also returns nothing.
    @Published private(set) var isUsingFallbackData: Bool = false

    /// Which layers of the SNAP ecosystem the user is browsing.
    /// Drives `filteredLocations` and the layer-toggle UI. Default
    /// is `.both` — first-time users see help directory + EBT
    /// retailers together so the "full ecosystem" pitch lands.
    @Published var layerSelection: FindHelpLayerSelection = .both

    private let fixtures: FindHelpFixtureLoader

    private let service: FindHelpServiceProtocol
    private static let logger = Logger(subsystem: "Civica", category: "FindHelpStore")

    private var pendingSearch: Task<Void, Never>?

    init(
        service: FindHelpServiceProtocol = FindHelpService(),
        fixtures: FindHelpFixtureLoader = .shared
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
        radiusKm: Double = 25,
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
                self.locations = results
                self.isUsingFallbackData = false
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
        searchNearby(lat: userLocation.coordinate.latitude, lng: userLocation.coordinate.longitude)
    }
}
