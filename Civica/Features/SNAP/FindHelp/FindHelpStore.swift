import Combine
import CoreLocation
import Foundation
import OSLog

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
        locations.filter(filter.matches)
    }

    func searchNearby(lat: Double, lng: Double, radiusKm: Double = 25, maxResults: Int = 50) {
        pendingSearch?.cancel()
        isLoading = true
        error = nil

        let serviceType = filter.serviceType
        let languageCode = filter.languageCode

        pendingSearch = Task { [service] in
            do {
                let results = try await service.searchNearby(
                    lat: lat,
                    lng: lng,
                    radiusKm: radiusKm,
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
