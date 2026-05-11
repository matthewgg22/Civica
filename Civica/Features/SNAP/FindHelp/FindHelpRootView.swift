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
    @StateObject private var store: FindHelpStore
    // Constructed with autoRequestPermission: false so the iOS dialog
    // only fires after the user taps "Share my location" on the
    // Civica explainer screen (HANDOFF map · B1).
    @StateObject private var locationManager = LocationManager(autoRequestPermission: false)
    @State private var zipFallback: String = ""
    @State private var hasTrackedEntry = false
    @State private var lastSearchedLocation: CLLocation?
    @State private var displayMode: FindHelpDisplayMode = .map
    /// User explicitly chose to use the zip-fallback path instead of
    /// sharing location. Sticky for the session — we don't re-prompt
    /// after they've made the call.
    @State private var preferZipFallback: Bool = false

    /// One-time first-launch onboarding card visibility. Persisted
    /// per-install via AppStorage so the card never resurfaces after
    /// the user dismisses it.
    @AppStorage("find_help.has_seen_onboarding")
    private var hasSeenOnboarding: Bool = false

    /// Current search radius in kilometers. Defaults to ~5 miles per
    /// HANDOFF board B3; the empty-state CTA bumps to ~25 miles.
    @State private var currentRadiusKm: Double = 8.0

    /// HANDOFF board A2 — after the peek sheet, this drives the full
    /// detail sheet. Kept separate from store.selectedLocation so the
    /// two sheets stack cleanly: peek dismisses, detail then mounts.
    @State private var detailLocation: FindHelpLocation?

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
        VStack(spacing: 0) {
            layerToggle
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.top, CivicaSpacing.md)

            FindHelpFilterBar(filter: $store.filter, layerSelection: store.layerSelection) {
                FindHelpAnalytics.trackFilterChanged(
                    serviceType: store.filter.serviceType?.rawValue,
                    languageCode: store.filter.languageCode
                )
                store.updateFilter(store.filter)
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.top, CivicaSpacing.sm)

            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            FindHelpDisclosureFooter()
        }
        .background(CivicaColors.surfaceSecondary.ignoresSafeArea())
        .overlay { onboardingOverlay }
        .navigationTitle("find_help.entry_card.title")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(CivicaColors.surfaceSecondary, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        // Two-stage sheet: tap a pin → peek (board A2). Peek's
        // "View details" CTA dismisses the peek, then the detail
        // sheet mounts. Splitting them lets users skim multiple
        // pins fast without re-mounting the dense detail every time.
        .sheet(item: $store.selectedLocation) { location in
            FindHelpPeekSheet(
                location: location,
                language: language,
                onViewDetails: {
                    detailLocation = location
                    store.clearSelection()
                }
            )
        }
        .sheet(item: $detailLocation) { location in
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
        // Sticky zip-fallback path overrides authorization branches:
        // once the user chooses "Use a zip code instead" on the
        // explainer, we don't bounce them through location states.
        if preferZipFallback {
            zipFallbackForm(messageKey: "find_help.zip_fallback.prompt")
        } else {
            switch locationManager.authorizationStatus {
            case .authorizedWhenInUse, .authorizedAlways:
                authorizedContent
            case .denied, .restricted:
                zipFallbackForm(messageKey: "find_help.zip_fallback.prompt")
            case .notDetermined:
                // HANDOFF map · B1 — the Civica explainer runs before
                // the iOS dialog, not as a wait-spinner after it.
                FindHelpPermissionExplainerView(
                    language: language,
                    onShareLocation: { locationManager.requestPermission() },
                    onUseZipInstead: { preferZipFallback = true }
                )
            @unknown default:
                zipFallbackForm(messageKey: "find_help.zip_fallback.prompt")
            }
        }
    }

    @ViewBuilder
    private var authorizedContent: some View {
        if store.isLoading && store.locations.isEmpty {
            loadingView
        } else if let error = store.error, store.locations.isEmpty {
            // Transport errors (DNS, no connection, etc.) get the
            // rich fallback view with retry + zip-code escape +
            // always-visible human path. Other errors fall through
            // to the plain message view.
            if case .network = error {
                transportErrorView
            } else {
                errorView(error.errorDescription ?? "Could not load results.")
            }
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

    /// Three-way pill at the top of the screen that selects which
    /// slice of the SNAP ecosystem renders: where to get help, where
    /// to spend benefits, or both together. Modeled on viewModeToggle
    /// so the two pills read as a matched pair when stacked.
    private var layerToggle: some View {
        HStack(spacing: 0) {
            ForEach(FindHelpLayerSelection.allCases) { layer in
                Button {
                    store.layerSelection = layer
                    FindHelpAnalytics.trackLayerChanged(layer.rawValue)
                } label: {
                    Text(layerLabel(for: layer))
                        .font(CivicaTypography.footnoteStrong)
                        .padding(.horizontal, CivicaSpacing.md)
                        .padding(.vertical, CivicaSpacing.sm)
                        .foregroundStyle(
                            layer == store.layerSelection
                                ? CivicaColors.onPrimaryText
                                : CivicaColors.brickPrimary
                        )
                        .frame(maxWidth: .infinity)
                        .background(
                            layer == store.layerSelection
                                ? CivicaColors.brickPrimary
                                : Color.clear
                        )
                }
            }
        }
        .background(CivicaColors.surfacePrimary)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(CivicaColors.brickPrimary.opacity(0.4), lineWidth: 1))
    }

    private func layerLabel(for layer: FindHelpLayerSelection) -> String {
        switch layer {
        case .findHelp: return FindHelpStrings.layerFindHelp.value(in: language)
        case .spend:    return FindHelpStrings.layerSpend.value(in: language)
        case .both:     return FindHelpStrings.layerBoth.value(in: language)
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
            lng: location.coordinate.longitude,
            radiusKm: currentRadiusKm
        )
    }

    /// Empty-state expand: bump the radius from ~5 miles to ~25
    /// miles and re-search at whatever location is current. Used
    /// by the HANDOFF board B3 empty-state CTA.
    private func expandRadiusAndResearch() {
        currentRadiusKm = 40.0  // ~25 miles
        guard let userLocation = store.userLocation else { return }
        lastSearchedLocation = userLocation
        store.searchNearby(
            lat: userLocation.coordinate.latitude,
            lng: userLocation.coordinate.longitude,
            radiusKm: currentRadiusKm
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

    /// HANDOFF board B4 — "Reading the local directory…" with a
    /// progress bar inside a paper card, not a plain spinner.
    /// Names the work being done so the wait feels concrete.
    private var loadingView: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(FindHelpStrings.loadingEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(FindHelpStrings.loadingTitle.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
            ProgressView()
                .progressViewStyle(.linear)
                .tint(CivicaColors.brickPrimary)
                .padding(.top, CivicaSpacing.sm)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    /// HANDOFF board B3 — "Nothing within 5 miles" + radius-expand
    /// CTA + always-visible human path (phone number). Empty state
    /// always offers a real next step, never a dead end.
    private var emptyView: some View {
        VStack(spacing: CivicaSpacing.lg) {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Image(systemName: "mappin.slash")
                    .font(.system(size: 28))
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
                Text(FindHelpStrings.emptyTitleFormatted(
                    miles: milesFromRadius(currentRadiusKm),
                    language: language
                ))
                .font(CivicaTypography.cardTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                Text(FindHelpStrings.emptyBody.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                if currentRadiusKm < 40.0 {
                    Button(action: expandRadiusAndResearch) {
                        Text(FindHelpStrings.emptyExpandCTA.value(in: language))
                            .font(CivicaTypography.subheadStrong)
                            .foregroundStyle(CivicaColors.onPrimaryText)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(
                                RoundedRectangle(cornerRadius: CivicaRadius.control)
                                    .fill(CivicaColors.brickPrimary)
                            )
                    }
                    .padding(.top, CivicaSpacing.sm)
                }
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )

            // Always-visible human path — phone number tappable
            // via tel: scheme. The spec calls this out as
            // mandatory on every empty state.
            humanPathRow
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var humanPathRow: some View {
        Button {
            if let url = URL(string: "tel:8773822363") {
                UIApplication.shared.open(url)
            }
        } label: {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "phone.fill")
                    .foregroundStyle(CivicaColors.brickPrimary)
                    .accessibilityHidden(true)
                Text(FindHelpStrings.emptyHumanLineLabel.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Spacer(minLength: CivicaSpacing.sm)
                Text(FindHelpStrings.emptyHumanLineNumber)
                    .font(CivicaTypography.subheadStrong.monospacedDigit())
                    .foregroundStyle(CivicaColors.brickPrimary)
                    .underline()
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(FindHelpStrings.emptyHumanLineLabel.value(in: language)). \(FindHelpStrings.emptyHumanLineNumber)")
    }

    /// Convert km to miles for user-facing copy. 8 km → 5 miles,
    /// 40 km → 25 miles. Rounded to the nearest whole mile.
    private func milesFromRadius(_ km: Double) -> Int {
        Int((km * 0.6213712).rounded())
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

    /// Rich fallback for transport-layer failures (DNS, no
    /// connection). Mirrors the empty-state skeleton — title, body,
    /// primary retry, zip-fallback escape hatch, always-visible
    /// human-path row — so the user always has a next step.
    private var transportErrorView: some View {
        VStack(spacing: CivicaSpacing.lg) {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Image(systemName: "wifi.slash")
                    .font(.system(size: 28))
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
                Text(FindHelpStrings.transportErrorTitle.value(in: language))
                    .font(CivicaTypography.cardTitle)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(FindHelpStrings.transportErrorBody.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)

                Button(action: retryLastSearch) {
                    Text(FindHelpStrings.transportErrorRetryCTA.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.onPrimaryText)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(
                            RoundedRectangle(cornerRadius: CivicaRadius.control)
                                .fill(CivicaColors.brickPrimary)
                        )
                }
                .padding(.top, CivicaSpacing.sm)

                Button {
                    preferZipFallback = true
                } label: {
                    Text(FindHelpStrings.permissionZipCTA.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.brickPrimary)
                        .underline()
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, CivicaSpacing.xs)
                }
                .buttonStyle(.plain)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )

            humanPathRow
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    /// Re-issue the most recent search. Falls back to whatever
    /// location the store last had if the user moved less than the
    /// triggerSearchIfNeeded threshold (which would otherwise no-op).
    private func retryLastSearch() {
        let location = lastSearchedLocation ?? store.userLocation
        guard let location else { return }
        store.searchNearby(
            lat: location.coordinate.latitude,
            lng: location.coordinate.longitude,
            radiusKm: currentRadiusKm
        )
    }
}
