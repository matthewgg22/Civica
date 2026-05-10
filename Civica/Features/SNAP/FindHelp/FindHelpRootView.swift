import CivicaDesignSystem
import CoreLocation
import SwiftUI

// EXPERIMENTAL SILOED MODULE: top-level entry for the Find Help directory.
// Step 10 ships the list view + permission flow; the map view lands in Step 11.

enum FindHelpDisplayMode: String, CaseIterable, Identifiable {
    case map
    case list
    var id: String { rawValue }
}

struct FindHelpRootView: View {
    @StateObject private var store = FindHelpStore()
    @StateObject private var locationManager = LocationManager()
    @State private var zipFallback: String = ""
    @State private var hasTrackedEntry = false
    @State private var lastSearchedLocation: CLLocation?
    @State private var displayMode: FindHelpDisplayMode = .map

    var body: some View {
        VStack(spacing: 0) {
            FindHelpFilterBar(filter: $store.filter) {
                FindHelpAnalytics.trackFilterChanged(
                    serviceType: store.filter.serviceType?.rawValue,
                    languageCode: store.filter.languageCode
                )
                store.updateFilter(store.filter)
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.top, CivicaSpacing.md)

            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            FindHelpDisclosureFooter()
        }
        .background(CivicaColors.surfaceSecondary.ignoresSafeArea())
        .navigationTitle("find_help.entry_card.title")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(CivicaColors.surfaceSecondary, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .sheet(item: $store.selectedLocation) { location in
            FindHelpLocationDetailSheet(location: location, sources: store.sources)
        }
        .onAppear {
            if !hasTrackedEntry {
                hasTrackedEntry = true
                FindHelpAnalytics.trackEntryViewed()
            }
            store.loadSources()
        }
        .onReceive(locationManager.$location.compactMap { $0 }) { location in
            store.userLocation = location
            triggerSearchIfNeeded(for: location)
        }
        .onReceive(locationManager.$authorizationStatus) { status in
            FindHelpAnalytics.trackPermissionResult(String(describing: status))
        }
    }

    @ViewBuilder
    private var content: some View {
        switch locationManager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            authorizedContent
        case .denied, .restricted:
            zipFallbackForm(messageKey: "find_help.zip_fallback.prompt")
        case .notDetermined:
            VStack(spacing: CivicaSpacing.md) {
                ProgressView()
                Text("find_help.permission.rationale")
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, CivicaSpacing.lg)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        @unknown default:
            zipFallbackForm(messageKey: "find_help.zip_fallback.prompt")
        }
    }

    @ViewBuilder
    private var authorizedContent: some View {
        if store.isLoading && store.locations.isEmpty {
            VStack(spacing: CivicaSpacing.md) {
                ProgressView()
                Text("find_help.loading")
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.graphite)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let error = store.error, store.locations.isEmpty {
            errorView(error.errorDescription ?? "Could not load results.")
        } else if store.filteredLocations.isEmpty {
            emptyView
        } else {
            ZStack(alignment: .bottom) {
                Group {
                    switch displayMode {
                    case .map:
                        FindHelpMapView(
                            locations: store.filteredLocations,
                            userLocation: store.userLocation,
                            onSelect: { store.selectLocation($0) }
                        )
                        .ignoresSafeArea(edges: .bottom)
                    case .list:
                        FindHelpListView(
                            locations: store.filteredLocations,
                            onSelect: { store.selectLocation($0) }
                        )
                    }
                }
                viewModeToggle
                    .padding(.bottom, CivicaSpacing.md)
            }
        }
    }

    private var viewModeToggle: some View {
        HStack(spacing: 0) {
            ForEach(FindHelpDisplayMode.allCases) { mode in
                Button {
                    displayMode = mode
                    FindHelpAnalytics.trackViewModeChanged(mode.rawValue)
                } label: {
                    Text(mode == .map ? "find_help.view_mode.map" : "find_help.view_mode.list")
                        .font(CivicaTypography.footnoteStrong)
                        .padding(.horizontal, CivicaSpacing.lg)
                        .padding(.vertical, CivicaSpacing.sm)
                        .foregroundStyle(mode == displayMode ? CivicaColors.onPrimaryText : CivicaColors.brickPrimary)
                        .background(mode == displayMode ? CivicaColors.brickPrimary : Color.clear)
                }
            }
        }
        .background(CivicaColors.surfacePrimary)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(CivicaColors.brickPrimary.opacity(0.4), lineWidth: 1))
        .shadow(color: CivicaColors.shadowSoft, radius: 6, x: 0, y: 2)
    }

    private func triggerSearchIfNeeded(for location: CLLocation) {
        if let last = lastSearchedLocation,
           last.distance(from: location) < 250 { // re-search only when user moves >250m
            return
        }
        lastSearchedLocation = location
        store.searchNearby(
            lat: location.coordinate.latitude,
            lng: location.coordinate.longitude
        )
    }

    private func zipFallbackForm(messageKey: LocalizedStringKey) -> some View {
        VStack(spacing: CivicaSpacing.lg) {
            Text(messageKey)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.graphite)
                .multilineTextAlignment(.center)

            HStack(spacing: CivicaSpacing.sm) {
                TextField("ZIP code", text: $zipFallback)
                    .keyboardType(.numberPad)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 160)

                Button {
                    submitZipFallback()
                } label: {
                    Text("find_help.zip_fallback.cta")
                }
                .buttonStyle(.borderedProminent)
                .disabled(zipFallback.count < 5)
            }

            if let error = store.error {
                Text(error.errorDescription ?? "Search failed.")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.destructive)
                    .multilineTextAlignment(.center)
            }

            if !store.filteredLocations.isEmpty {
                FindHelpListView(
                    locations: store.filteredLocations,
                    onSelect: { store.selectLocation($0) }
                )
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func submitZipFallback() {
        let zip = zipFallback.trimmingCharacters(in: .whitespaces)
        guard zip.count == 5 else { return }
        FindHelpAnalytics.trackZipFallbackUsed()
        Task {
            let geocoder = GeocodingService()
            do {
                let coordinate = try await geocoder.geocodeZipOrCity(zip)
                let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
                await MainActor.run {
                    store.userLocation = location
                    lastSearchedLocation = location
                    store.searchNearby(lat: coordinate.latitude, lng: coordinate.longitude)
                }
            } catch {
                await MainActor.run {
                    store.error = .locationUnavailable
                }
            }
        }
    }

    private var emptyView: some View {
        VStack(spacing: CivicaSpacing.md) {
            Image(systemName: "mappin.slash")
                .font(.system(size: 36))
                .foregroundStyle(CivicaColors.graphite)
            Text("find_help.empty_state")
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.graphite)
                .multilineTextAlignment(.center)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: CivicaSpacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 36))
                .foregroundStyle(CivicaColors.destructive)
            Text(message)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.graphite)
                .multilineTextAlignment(.center)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
