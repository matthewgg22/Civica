import CivicaDesignSystem
import CoreLocation
import SwiftUI

/// Top-level entry for the Find Help directory. Owns permission state,
/// the two-stage sheet stack (peek → detail), and the onboarding
/// overlay. Search state and the loading/empty/transport-error views
/// live in `FindHelpStore` and `FindHelpStatusViews` respectively, so
/// this file stays focused on orchestration.
struct FindHelpRootView: View {
    @StateObject private var store: FindHelpStore
    // Constructed with autoRequestPermission: false so the iOS dialog
    // only fires after the user taps "Share my location" on the
    // Civica explainer screen (HANDOFF map · B1).
    @StateObject private var locationManager = LocationManager(autoRequestPermission: false)
    @State private var hasTrackedEntry = false
    /// User explicitly chose to use the zip-fallback path instead of
    /// sharing location. Sticky for the session — we don't re-prompt
    /// after they've made the call.
    @State private var preferZipFallback: Bool = false
    /// Shown after a user-initiated map pan. Tapping re-searches at
    /// the new map center instead of the device location. Visibility is
    /// derived from `searchAreaCenter != nil`; arming is gated against
    /// no-op re-arms on continued panning and on micro-pans below
    /// `searchAreaArmThresholdKm` from the last query center.
    @State private var searchAreaCenter: CLLocationCoordinate2D?

    /// Distance (km) the user must pan from the last query center before
    /// "Search this area" arms. Empirically, ~3 km is the smallest pan
    /// that meaningfully changes which retailers appear; below that the
    /// pill is noise.
    private static let searchAreaArmThresholdKm: Double = 3.0

    /// One-time first-launch onboarding card visibility. Persisted
    /// per-install via AppStorage so the card never resurfaces after
    /// the user dismisses it.
    (CivicaAppStorageKeys.findHelpHasSeenOnboarding)
    private var hasSeenOnboarding: Bool = false

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    /// Optional filter to apply on mount. Callers like the denial /
    /// waiting / recert surfaces pre-narrow to "food assistance" or
    /// "SNAP application help" so the map opens already focused on
    /// the right kind of resource.
    init(initialFilter: FindHelpFilterState? = nil) {
        let store = FindHelpStore()
        if let initialFilter {
            store.filter = initialFilter
        }
        _store = StateObject(wrappedValue: store)
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(CivicaColors.surfaceSecondary.ignoresSafeArea())
            .overlay { onboardingOverlay }
            .navigationTitle("find_help.entry_card.title")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(CivicaColors.surfaceSecondary, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .onAppear {
                if !hasTrackedEntry {
                    hasTrackedEntry = true
                    FindHelpAnalytics.trackEntryViewed()
                }
                store.loadSources()
            }
            .onReceive(locationManager.$location.compactMap { $0 }) { location in
                store.userLocation = location
                store.requestSearch(for: location)
            }
            .onReceive(locationManager.$authorizationStatus) { status in
                FindHelpAnalytics.trackPermissionResult(String(describing: status))
            }
    }

    @ViewBuilder
    private var content: some View {
        // Sticky zip-fallback path overrides authorization branches:
        // once the user chooses "Use a zip code instead" on the
        // explainer, we don't bounce them through location states.
        // Once a zip search returns results (or starts loading), hand
        // off to authorizedContent so the map appears — the zip input
        // is just the entry point for seeding the store's coordinate.
        if preferZipFallback {
            if store.isLoading || !store.locations.isEmpty {
                authorizedContent
            } else {
                FindHelpZipFallbackView(store: store, messageKey: "find_help.zip_fallback.prompt")
            }
        } else {
            switch locationManager.authorizationStatus {
            case .authorizedWhenInUse, .authorizedAlways:
                authorizedContent
            case .denied, .restricted:
                FindHelpZipFallbackView(store: store, messageKey: "find_help.zip_fallback.prompt")
            case .notDetermined:
                // HANDOFF map · B1 — the Civica explainer runs before
                // the iOS dialog, not as a wait-spinner after it.
                FindHelpPermissionExplainerView(
                    language: language,
                    onShareLocation: { locationManager.requestPermission() },
                    onUseZipInstead: { preferZipFallback = true }
                )
            @unknown default:
                FindHelpZipFallbackView(store: store, messageKey: "find_help.zip_fallback.prompt")
            }
        }
    }

    @ViewBuilder
    private var authorizedContent: some View {
        if store.isLoading && store.locations.isEmpty {
            FindHelpLoadingView(language: language)
        } else if let error = store.error, store.locations.isEmpty {
            // Transport errors (DNS, no connection, etc.) get the rich
            // fallback view with retry + zip-fallback escape + always-
            // visible human path. Other errors fall through to the
            // plain message view.
            if case .network = error {
                FindHelpTransportErrorView(
                    language: language,
                    onRetry: { store.retryLastSearch() },
                    onUseZipInstead: { preferZipFallback = true }
                )
            } else {
                FindHelpErrorMessageView(message: error.errorDescription ?? "Could not load results.")
            }
        } else if store.filteredLocations.isEmpty {
            FindHelpEmptyView(
                language: language,
                currentRadiusKm: store.currentRadiusKm,
                onExpandRadius: { store.expandRadiusAndResearch() }
            )
        } else {
            // Map + bottom drawer in a ZStack so both are part of the
            // same view hierarchy. Using a ZStack (not .sheet) means
            // the drawer exits in sync with the navigation-pop
            // transition — no independent dismiss animation lag.
            ZStack(alignment: .bottom) {
                FindHelpMapView(
                    locations: store.filteredLocations,
                    userLocation: store.userLocation,
                    selectedLocationId: store.selectedLocation?.id,
                    onSelect: { store.selectLocation($0) },
                    onRegionChanged: { center in
                        // Already armed → keep tracking the latest center
                        // silently so the eventual tap re-queries where
                        // the user actually is, not where they first
                        // started panning.
                        guard searchAreaCenter == nil else {
                            searchAreaCenter = center
                            return
                        }
                        // Gate first-arm on a meaningful distance from
                        // the last query center. Without an anchor we
                        // can't compute distance, so we fall through to
                        // arming (matches prior behavior on cold-start).
                        if let anchor = store.lastSearchedLocation {
                            let panned = CLLocation(latitude: center.latitude, longitude: center.longitude)
                            let meters = panned.distance(from: anchor)
                            guard meters >= Self.searchAreaArmThresholdKm * 1_000 else { return }
                        }
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                            searchAreaCenter = center
                        }
                    }
                )
                .ignoresSafeArea(edges: .all)
                .overlay(alignment: .top) {
                    if let center = searchAreaCenter {
                        Button {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                searchAreaCenter = nil
                            }
                            store.searchNearby(
                                lat: center.latitude,
                                lng: center.longitude,
                                radiusKm: store.currentRadiusKm
                            )
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "arrow.clockwise")
                                    .font(.system(size: 13, weight: .semibold))
                                    .accessibilityHidden(true)
                                Text(SNAPGenericStrings.searchThisArea.value(in: language))
                                    .font(CivicaTypography.footnoteStrong)
                            }
                            .foregroundStyle(CivicaColors.ink)
                            .padding(.horizontal, CivicaSpacing.md)
                            .padding(.vertical, CivicaSpacing.sm)
                            .background(
                                Capsule().fill(CivicaColors.surfacePrimary)
                                    .shadow(color: .black.opacity(0.15), radius: 6, y: 2)
                            )
                        }
                        .padding(.top, CivicaSpacing.lg)
                        .transition(.move(edge: .top).combined(with: .opacity))
                    }
                }

                FindHelpBottomSheet(
                    store: store,
                    language: language,
                    onLayerChanged: { layer in
                        FindHelpAnalytics.trackLayerChanged(layer.rawValue)
                    },
                    onFilterChanged: {
                        FindHelpAnalytics.trackFilterChanged(
                            serviceType: store.filter.serviceType?.rawValue,
                            languageCode: store.filter.languageCode
                        )
                        store.updateFilter(store.filter)
                    }
                )
            }
        }
    }

    /// One-time first-launch onboarding card. Centered above a dimmed
    /// black backdrop; the only dismissal path is the "Got it" CTA so
    /// the user reads the thesis line ("SNAP works at more places than
    /// you think") before the map becomes interactive. Once dismissed,
    /// the @AppStorage flag flips and the overlay is gone for good.
    @ViewBuilder
    private var onboardingOverlay: some View {
        if !hasSeenOnboarding {
            ZStack {
                Color.black.opacity(0.35)
                    .ignoresSafeArea()
                FindHelpOnboardingCard(
                    language: language,
                    onDismiss: {
                        withAnimation(.easeOut(duration: 0.2)) {
                            hasSeenOnboarding = true
                        }
                        FindHelpAnalytics.trackOnboardingDismissed()
                    }
                )
            }
            .transition(.opacity)
        }
    }
}
