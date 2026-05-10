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

    private let service: FindHelpServiceProtocol
    private static let logger = Logger(subsystem: "Civica", category: "FindHelpStore")

    private var pendingSearch: Task<Void, Never>?

    init(service: FindHelpServiceProtocol = FindHelpService()) {
        self.service = service
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
                self.isLoading = false
            } catch let error as FindHelpError {
                if Task.isCancelled { return }
                self.error = error
                self.isLoading = false
            } catch {
                if Task.isCancelled { return }
                Self.logger.error("Unexpected FindHelp error: \(error.localizedDescription, privacy: .public)")
                self.error = .network(message: error.localizedDescription)
                self.isLoading = false
            }
        }
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
