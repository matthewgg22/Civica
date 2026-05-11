import Foundation
import Testing
@testable import VoteNow

@MainActor
struct FindHelpStoreTests {
    @Test func filterMatchesByServiceType() {
        let snapOffice = makeLocation(externalId: "a", serviceTypes: [.snapApplicationHelp])
        let pantry = makeLocation(externalId: "b", serviceTypes: [.foodAssistance])

        var filter = FindHelpFilterState.none
        #expect(filter.matches(snapOffice))
        #expect(filter.matches(pantry))

        filter.serviceType = .snapApplicationHelp
        #expect(filter.matches(snapOffice))
        #expect(!filter.matches(pantry))

        filter.serviceType = .foodAssistance
        #expect(!filter.matches(snapOffice))
        #expect(filter.matches(pantry))
    }

    @Test func filterBothMatchesBoth() {
        let snapOnly = makeLocation(externalId: "snap", serviceTypes: [.snapApplicationHelp])
        let foodOnly = makeLocation(externalId: "food", serviceTypes: [.foodAssistance])
        let mixed = makeLocation(externalId: "mix", serviceTypes: [.snapApplicationHelp, .foodAssistance])
        let bothFlag = makeLocation(externalId: "both", serviceTypes: [.both])

        let filter = FindHelpFilterState(serviceType: .both, languageCode: nil)
        #expect(!filter.matches(snapOnly))
        #expect(!filter.matches(foodOnly))
        #expect(filter.matches(mixed))
        #expect(filter.matches(bothFlag))
    }

    @Test func filterByLanguage() {
        let spanish = makeLocation(externalId: "es", serviceTypes: [.foodAssistance], languages: ["en", "es"])
        let english = makeLocation(externalId: "en", serviceTypes: [.foodAssistance], languages: ["en"])

        let filter = FindHelpFilterState(serviceType: nil, languageCode: "es")
        #expect(filter.matches(spanish))
        #expect(!filter.matches(english))
    }

    @Test func searchNearbyLoadsResultsAndClearsLoading() async {
        let stub = StubService(results: [makeLocation(externalId: "x", serviceTypes: [.foodAssistance])])
        let store = FindHelpStore(service: stub)

        store.searchNearby(lat: 42.36, lng: -71.06)
        await waitForLoadingToClear(store)

        #expect(store.locations.count == 1)
        #expect(store.isLoading == false)
        #expect(store.error == nil)
    }

    @Test func searchNearbySurfacesErrors() async {
        let stub = StubService(error: .network(message: "offline"))
        let store = FindHelpStore(service: stub)

        store.searchNearby(lat: 42.36, lng: -71.06)
        await waitForLoadingToClear(store)

        #expect(store.locations.isEmpty)
        #expect(store.error == .network(message: "offline"))
    }

    @Test func selectAndClearSelection() {
        let store = FindHelpStore(service: StubService(results: []))
        let pin = makeLocation(externalId: "pin", serviceTypes: [.snapApplicationHelp])

        store.selectLocation(pin)
        #expect(store.selectedLocation == pin)

        store.clearSelection()
        #expect(store.selectedLocation == nil)
    }

    @Test func updateFilterTriggersResearchWhenUserLocationAvailable() async {
        let stub = StubService(results: [makeLocation(externalId: "y", serviceTypes: [.snapApplicationHelp])])
        let store = FindHelpStore(service: stub)
        store.userLocation = CLLocation(latitude: 42.36, longitude: -71.06)

        store.updateFilter(FindHelpFilterState(serviceType: .snapApplicationHelp, languageCode: nil))
        await waitForLoadingToClear(store)

        #expect(stub.callCount == 1)
        #expect(stub.lastServiceType == .snapApplicationHelp)
    }

    // MARK: - Helpers

    private func makeLocation(
        externalId: String,
        serviceTypes: [FindHelpServiceType],
        languages: [String] = []
    ) -> FindHelpLocation {
        FindHelpLocation(
            id: UUID(),
            externalId: externalId,
            source: .stateMaDta,
            name: "Test \(externalId)",
            addressLine1: nil,
            addressLine2: nil,
            city: "Boston",
            state: "MA",
            zip: nil,
            latitude: 42.36,
            longitude: -71.06,
            phone: nil,
            email: nil,
            websiteUrl: nil,
            hoursJson: nil,
            languagesJson: languages,
            serviceTypes: serviceTypes,
            notes: nil,
            sourceLastUpdatedAt: nil,
            civicaLastSyncedAt: nil,
            distanceKm: nil,
            recordKind: nil,
            retailerCategory: nil
        )
    }

    private func waitForLoadingToClear(_ store: FindHelpStore) async {
        for _ in 0..<200 {
            if !store.isLoading { return }
            try? await Task.sleep(nanoseconds: 5_000_000) // 5ms
        }
    }
}

import CoreLocation

private final class StubService: FindHelpServiceProtocol, @unchecked Sendable {
    var results: [FindHelpLocation]
    var error: FindHelpError?
    private(set) var callCount = 0
    private(set) var lastServiceType: FindHelpServiceType?
    private(set) var lastLanguageCode: String?

    init(results: [FindHelpLocation] = [], error: FindHelpError? = nil) {
        self.results = results
        self.error = error
    }

    func searchNearby(
        lat: Double,
        lng: Double,
        radiusKm: Double,
        serviceType: FindHelpServiceType?,
        languageCode: String?,
        maxResults: Int
    ) async throws -> [FindHelpLocation] {
        callCount += 1
        lastServiceType = serviceType
        lastLanguageCode = languageCode
        if let error { throw error }
        return results
    }

    func loadSources() async throws -> [FindHelpSourceAttribution] {
        []
    }
}
