//
//
//
//
//  PollingLocationsView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/22/25.
//  Updated on 05/27/25 — row highlighting, Maps integration, compiler-friendly
//

import SwiftUI
import MapKit
import CoreLocation

struct PollingLocationsView: View {
    private static let fallbackCenter = CLLocationCoordinate2D(latitude: 40.7128, longitude: -74.0060)
    private static let fallbackSpan = MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)

    @Environment(\.locale) private var locale
    @Binding var selectedPlace: PollingPlace?
    var isActive: Bool = true
    var showArchiveDisclaimer: Bool = false
    
    @StateObject private var locationManager = LocationManager()
    @State private var pollingLocations     = pollingPlaces
    @State private var showFullMap          = false
    @State private var isGeocoding          = false
    @State private var hasTrackedPollingLookupSuccess = false
    @State private var pendingSortTask: Task<Void, Never>?
    @State private var geocodeTask: Task<Void, Never>?
    
    @State private var region = MKCoordinateRegion(
        center: pollingPlaces.first?.coordinate
            ?? Self.fallbackCenter,
        span: Self.fallbackSpan
    )
    @State private var mapPosition = MapCameraPosition.region(
        MKCoordinateRegion(
            center: pollingPlaces.first?.coordinate
                ?? Self.fallbackCenter,
            span: Self.fallbackSpan
        )
    )
    
    private let geocodeCacheKey = "PollingLocations.GeocodeCache.v1"
    private let maxConcurrentGeocodes = 4
    private let interBatchDelayNanos: UInt64 = 120_000_000
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if showArchiveDisclaimer {
                    archiveDisclaimerCard
                }
                mapButton
                miniMap
                placeList
            }
            .padding(.vertical)
        }
        .onAppear {
            guard isActive else { return }
            deferToNextRunLoop {
                hydrateCoordinatesFromCache()
                startGeocodingMissingAddressesIfNeeded()
                trackPollingLookupSuccessIfNeeded()
            }
        }
        .onChange(of: isActive) { _, active in
            if active {
                deferToNextRunLoop {
                    hydrateCoordinatesFromCache()
                    startGeocodingMissingAddressesIfNeeded()
                    trackPollingLookupSuccessIfNeeded()
                }
            } else {
                pendingSortTask?.cancel()
                pendingSortTask = nil
                geocodeTask?.cancel()
                geocodeTask = nil
                isGeocoding = false
            }
        }
        .onChange(of: locationManager.location) { _, newLoc in
            guard isActive else { return }
            guard let user = newLoc else { return }
            pendingSortTask?.cancel()
            pendingSortTask = Task { @MainActor in
                try? await Task.sleep(nanoseconds: 120_000_000)
                guard !Task.isCancelled else { return }
                sortAndFit(userLocation: user)
            }
        }
        .onDisappear {
            pendingSortTask?.cancel()
            pendingSortTask = nil
            geocodeTask?.cancel()
            geocodeTask = nil
            isGeocoding = false
        }
        .fullScreenCover(isPresented: $showFullMap) {
            FullScreenMapView(
                initialRegion: region,
                places: pollingLocations,
                selectedPlace: $selectedPlace,
                onDoneRegion: { nextRegion in
                    deferToNextRunLoop {
                        region = nextRegion
                    }
                }
            )
        }
    }
    
    // MARK: — Subviews
    
    private var mapButton: some View {
        Button {
            showFullMap = true
        } label: {
            Label(l("app.polling_locations.action.show_full_map", "Show Full Map"), systemImage: "map")
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
        }
        .foregroundColor(.white)
        .background(
            LinearGradient(
                colors: [Color.blue.opacity(0.85), Color.blue.opacity(0.65)],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .shadow(color: .blue.opacity(0.18), radius: 6, x: 0, y: 3)
        .padding(.horizontal)
    }

    private var archiveDisclaimerCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(
                l(
                    "app.polling_locations.archive.title",
                    "Archived Example: NYC 2025 Polling Locations"
                )
            )
            .font(.subheadline.weight(.bold))
            .foregroundColor(CivicaColors.primaryText)

            Text(
                l(
                    "app.polling_locations.archive.body",
                    "This list is a fixed historical example and may not match your current polling place."
                )
            )
            .font(.footnote)
            .foregroundColor(CivicaColors.mutedText)
            .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.infoSurfaceBlue)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(CivicaColors.primaryCTA.opacity(0.16), lineWidth: 1)
        )
        .padding(.horizontal)
    }
    
    private var miniMap: some View {
        Map(position: $mapPosition, interactionModes: .all) {
            UserAnnotation()
            ForEach(pollingLocations) { place in
                Annotation("", coordinate: place.coordinate) {
                Button {
                    deferToNextRunLoop {
                        selectedPlace = place
                    }
                } label: {
                    PollingLocationPinView(
                        isSelected: selectedPlace?.id == place.id
                    )
                }
                .buttonStyle(.plain)
            }
        }
        }
        .onMapCameraChange { context in
            region = context.region
        }
        .frame(height: 250)
        .cornerRadius(12)
        .padding(.horizontal)
    }
    
    private var placeList: some View {
        VStack(spacing: 10) {
            ForEach(pollingLocations) { place in
                placeRow(place)
            }
        }
        .padding(.horizontal)
    }
    
    @ViewBuilder
    private func placeRow(_ place: PollingPlace) -> some View {
        HStack(alignment: .top, spacing: 12) {
            PollingLocationPinView(isSelected: selectedPlace?.id == place.id)
                .scaleEffect(0.9)

            VStack(alignment: .leading, spacing: 6) {
                Text(place.name)
                    .font(.subheadline.weight(selectedPlace?.id == place.id ? .bold : .semibold))
                    .lineLimit(1)

                Text(place.address)
                    .font(.caption)
                    .foregroundColor(CivicaColors.mutedText)
                    .lineLimit(1)

                HStack(spacing: 10) {
                    Label(
                        place.distance == "--" ? l("app.polling_locations.distance.updating", "Distance updating...") : place.distance,
                        systemImage: "location"
                    )
                    .font(.caption)
                    .foregroundColor(CivicaColors.mutedText)

                    if place.hours != "--" {
                        Label(place.hours, systemImage: "clock")
                            .font(.caption)
                            .foregroundColor(CivicaColors.mutedText)
                    }
                }
            }

            Spacer(minLength: 8)

            Button {
                let item = MKMapItem(placemark: MKPlacemark(coordinate: place.coordinate))
                item.name = place.name.isEmpty ? place.address : place.name
                item.openInMaps(launchOptions: nil)
            } label: {
                Image(systemName: "arrow.triangle.turn.up.right.diamond.fill")
                    .font(.title3)
                    .foregroundColor(CivicaColors.richBlue)
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .contentShape(Rectangle())
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(
                    selectedPlace?.id == place.id
                    ? CivicaColors.richBlue.opacity(0.14)
                    : CivicaColors.infoSurfaceBlue
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(
                    selectedPlace?.id == place.id
                    ? CivicaColors.richBlue.opacity(0.45)
                    : CivicaColors.primaryText.opacity(0.05),
                    lineWidth: 1
                )
        )
        .shadow(color: .black.opacity(0.05), radius: 3, x: 0, y: 2)
        .onTapGesture {
            deferToNextRunLoop {
                selectedPlace = place
            }
        }
    }

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }
    
    
    // MARK: — Cached Geocoding

    private struct CachedCoordinate: Codable {
        let lat: Double
        let lon: Double
    }

    private func loadCache() -> [String: CachedCoordinate] {
        guard let data = UserDefaults.standard.data(forKey: geocodeCacheKey),
              let decoded = try? JSONDecoder().decode([String: CachedCoordinate].self, from: data) else {
            return [:]
        }
        return decoded
    }

    private func saveCache(_ cache: [String: CachedCoordinate]) {
        guard let data = try? JSONEncoder().encode(cache) else { return }
        UserDefaults.standard.set(data, forKey: geocodeCacheKey)
    }

    private func hydrateCoordinatesFromCache() {
        let cache = loadCache()

        for i in pollingLocations.indices {
            let address = pollingLocations[i].address
            guard let hit = cache[address] else { continue }
            pollingLocations[i].coordinate = CLLocationCoordinate2D(
                latitude: hit.lat,
                longitude: hit.lon
            )
        }

        if let userLoc = locationManager.location {
            sortAndFit(userLocation: userLoc)
        } else {
            fitAllPins()
        }
    }

    private func startGeocodingMissingAddressesIfNeeded() {
        guard isActive else { return }
        guard !isGeocoding else { return }

        let cache = loadCache()
        let missing = Array(
            Set(
                pollingLocations
                    .map(\.address)
                    .filter { cache[$0] == nil }
            )
        )

        guard !missing.isEmpty else { return }
        isGeocoding = true
        geocodeTask = Task {
            await geocodeAddressesInBatches(missing)
        }
    }

    @MainActor
    private func geocodeAddressesInBatches(_ addresses: [String]) async {
        var cache = loadCache()

        for batch in chunked(addresses, size: maxConcurrentGeocodes) {
            if Task.isCancelled || !isActive {
                isGeocoding = false
                return
            }
            let resolved = await withTaskGroup(of: (String, CLLocationCoordinate2D?).self) { group in
                for address in batch {
                    group.addTask {
                        let coord = await geocodeAddress(address)
                        return (address, coord)
                    }
                }

                var results: [(String, CLLocationCoordinate2D?)] = []
                for await result in group {
                    results.append(result)
                }
                return results
            }

            var didUpdateAny = false
            for (address, coord) in resolved {
                guard let coord else { continue }
                cache[address] = CachedCoordinate(lat: coord.latitude, lon: coord.longitude)
                for i in pollingLocations.indices where pollingLocations[i].address == address {
                    pollingLocations[i].coordinate = coord
                }
                didUpdateAny = true
            }

            if didUpdateAny {
                saveCache(cache)
            }

            try? await Task.sleep(nanoseconds: interBatchDelayNanos)
        }

        isGeocoding = false
        geocodeTask = nil
        if let userLoc = locationManager.location {
            sortAndFit(userLocation: userLoc)
        } else {
            fitAllPins()
        }
    }

    private func geocodeAddress(_ address: String) async -> CLLocationCoordinate2D? {
        await withCheckedContinuation { continuation in
            CLGeocoder().geocodeAddressString(address) { results, _ in
                continuation.resume(returning: results?.first?.location?.coordinate)
            }
        }
    }

    private func chunked(_ addresses: [String], size: Int) -> [[String]] {
        guard size > 0, !addresses.isEmpty else { return [] }
        var out: [[String]] = []
        var start = 0
        while start < addresses.count {
            let end = min(start + size, addresses.count)
            out.append(Array(addresses[start..<end]))
            start = end
        }
        return out
    }
    
    // MARK: — Compute Distances, Sort & Zoom
    
    private func sortAndFit(userLocation: CLLocation) {
        // 1) Compute & assign distances
        for i in pollingLocations.indices {
            let c = pollingLocations[i].coordinate
            let distMi = CLLocation(latitude: c.latitude,
                                     longitude: c.longitude)
                .distance(from: userLocation) / 1609.344
            pollingLocations[i].distance = String(format: "%.1f mi", distMi)
        }
        // 2) Sort nearest first
        pollingLocations.sort {
            let a = CLLocation(latitude: $0.coordinate.latitude,
                               longitude: $0.coordinate.longitude)
            let b = CLLocation(latitude: $1.coordinate.latitude,
                               longitude: $1.coordinate.longitude)
            return userLocation.distance(from: a)
                 < userLocation.distance(from: b)
        }
        // 3) Build a map rect covering user + pins
        var rect = MKMapRect.null
        let userPoint = MKMapPoint(userLocation.coordinate)
        rect = rect.union(
            MKMapRect(
                origin: userPoint,
                size: MKMapSize(width: 0, height: 0)
            )
        )
        for p in pollingLocations {
            let pt = MKMapPoint(p.coordinate)
            rect = rect.union(
                MKMapRect(
                    origin: pt,
                    size: MKMapSize(width: 0, height: 0)
                )
            )
        }
        let nextRegion = MKCoordinateRegion(rect)
        updateRegionIfNeeded(nextRegion)
    }
    
    // MARK: — Fit Map if No User Location
    
    private func fitAllPins() {
        guard !pollingLocations.isEmpty else { return }
        var rect = MKMapRect.null
        for p in pollingLocations {
            let pt = MKMapPoint(p.coordinate)
            rect = rect.union(
                MKMapRect(
                    origin: pt,
                    size: MKMapSize(width: 0, height: 0)
                )
            )
        }
        let nextRegion = MKCoordinateRegion(rect)
        updateRegionIfNeeded(nextRegion)
    }

    private func updateRegionIfNeeded(_ nextRegion: MKCoordinateRegion) {
        guard isActive else { return }
        // Avoid tiny feedback updates from MapKit bindings.
        let epsilon = 0.000_001
        let centerChanged =
            abs(region.center.latitude - nextRegion.center.latitude) > epsilon ||
            abs(region.center.longitude - nextRegion.center.longitude) > epsilon
        let spanChanged =
            abs(region.span.latitudeDelta - nextRegion.span.latitudeDelta) > epsilon ||
            abs(region.span.longitudeDelta - nextRegion.span.longitudeDelta) > epsilon
        guard centerChanged || spanChanged else { return }
        deferToNextRunLoop {
            withAnimation {
                region = nextRegion
                mapPosition = .region(nextRegion)
            }
        }
    }

    private func deferToNextRunLoop(_ action: @escaping () -> Void) {
        DispatchQueue.main.async(execute: action)
    }

    private func trackPollingLookupSuccessIfNeeded() {
        guard isActive else { return }
        guard !hasTrackedPollingLookupSuccess else { return }
        guard !pollingLocations.isEmpty else { return }
        hasTrackedPollingLookupSuccess = true

        // Secondary review signal: successful polling-place lookup.
        ReviewPromptManager.shared.markPollingPlaceLookupSuccess(
            isInErrorState: false,
            isFlowInterrupted: false,
            hasLocationSet: locationManager.location != nil || selectedPlace != nil
        )
    }
}

private struct PollingLocationPinView: View {
    let isSelected: Bool

    var body: some View {
        ZStack {
            Circle()
                .fill(isSelected ? Color(red: 0.87, green: 0.35, blue: 0.27) : CivicaColors.richBlue)
                .frame(width: 24, height: 24)
            Image(systemName: "mappin")
                .font(.caption.bold())
                .foregroundColor(.white)
        }
        .overlay(
            Circle()
                .stroke(CivicaColors.surfaceWhite, lineWidth: 2)
        )
        .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)
    }
}


struct PollingLocationsView_Previews: PreviewProvider {
    static var previews: some View {
        PollingLocationsView(selectedPlace: .constant(nil))
    }
}
