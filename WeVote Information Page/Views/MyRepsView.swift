import SwiftUI
import MapKit
import UIKit
import QuartzCore

struct MyRepsView: View {
    @EnvironmentObject private var planVM: PlanViewModel
    @EnvironmentObject private var repsVM: MyRepsViewModel
    @Environment(\.locale) private var locale

    @FocusState private var locationFieldFocused: Bool
    @State private var locationInput: String = ""
    @State private var suppressLocationInputTypingHandler = false
    @State private var showMyInfoSheet = false
    @State private var showGovHelpChat = false
    @State private var showFullScreenMap = false
    @State private var matchedCountAnimationRevision = 0
    private let isGovHelpChatEnabled = false

    private static let stateCodeToName: [String: String] = [
        "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
        "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
        "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
        "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
        "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
        "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
        "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
        "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
        "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
        "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
        "DC": "District of Columbia", "AS": "American Samoa", "GU": "Guam",
        "MP": "Northern Mariana Islands", "PR": "Puerto Rico", "VI": "U.S. Virgin Islands"
    ]

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }

    private struct RepsSection: Identifiable {
        let id: String
        let title: String
        let level: OfficialLevel
        let officials: [Official]
    }

    private var sections: [RepsSection] {
        [
            RepsSection(id: "federal-exec", title: "Federal Executive", level: .federal, officials: repsVM.executiveReps),
            RepsSection(id: "federal-leg", title: "Federal Legislative", level: .federal, officials: repsVM.federalReps),
            RepsSection(id: "state", title: "State", level: .state, officials: repsVM.stateReps),
            RepsSection(id: "local", title: "Local", level: .local, officials: repsVM.cityReps)
        ].filter { !$0.officials.isEmpty }
    }

    private var matchedFederalCount: Int {
        repsVM.executiveReps.count + repsVM.federalReps.count
    }

    private var matchedStateCount: Int {
        repsVM.stateReps.count
    }

    private var matchedLocalCount: Int {
        repsVM.cityReps.count
    }

    private var chatContexts: [RepCardContext] {
        sections.flatMap { section in
            section.officials.map { official in
                RepCardContext(sectionTitle: section.title, level: section.level, official: official)
            }
        }
    }

    private var normalizedZip: String {
        String(planVM.zip.filter(\.isNumber).prefix(5))
    }

    private var headerLocationSubtitle: String {
        let city = headerLocationCity
        let state = headerLocationStateCode
        let zip = headerLocationZip

        if !city.isEmpty, let state, let zip {
            return "\(city), \(state) (\(zip))"
        }
        if !city.isEmpty, let state {
            return "\(city), \(state)"
        }
        if let state, let zip {
            return "\(state) (\(zip))"
        }
        if let zip {
            return zip
        }
        if let state {
            return state
        }

        return l("app.timeline.location.set_address", "Set your address in My Reps")
    }

    private var headerLocationCity: String {
        let resolvedCity = repsVM.resolvedLocationSelection?.city?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !resolvedCity.isEmpty { return resolvedCity }
        return planVM.userAddress.city.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var headerLocationStateCode: String? {
        if let resolved = normalizedUSStateCode(from: repsVM.resolvedStateCode) {
            return resolved
        }
        if let detected = normalizedUSStateCode(from: repsVM.detectedStateCode) {
            return detected
        }
        if let entered = normalizedUSStateCode(from: planVM.userAddress.state) {
            return entered
        }
        if let zip = headerLocationZip {
            return USZipStateResolver().stateCode(for: zip)
        }
        return nil
    }

    private var headerLocationZip: String? {
        let addressZip = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
        if addressZip.count == 5 { return addressZip }

        let resolvedZip = String((repsVM.resolvedLocationSelection?.postalCode ?? "").filter(\.isNumber).prefix(5))
        if resolvedZip.count == 5 { return resolvedZip }

        return normalizedZip.count == 5 ? normalizedZip : nil
    }

    private enum RepsLaunchState {
        case loading
        case empty
        case error
    }

    private var hasLookupError: Bool {
        let trimmed = repsVM.errorMessage?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return !trimmed.isEmpty
    }

    private var repsLaunchState: RepsLaunchState? {
        if repsVM.isLoading { return .loading }
        if hasLookupError { return .error }
        if sections.isEmpty { return .empty }
        return nil
    }

    private var isStateOnlyInput: Bool {
        let trimmed = locationInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }

        let upper = trimmed.uppercased()
        if Self.stateCodeToName.keys.contains(upper) { return true }
        if Self.stateCodeToName.values.contains(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame }) {
            return true
        }
        return Self.stateCodeToName.keys.contains(where: { trimmed.uppercased().hasPrefix("\($0) - ") })
    }

    var body: some View {
        NavigationStack {
            ZStack {
                VoteNowColors.appBackground.ignoresSafeArea()

                VStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 0) {
                        PageHeader(title: Text("app.page.my_reps", tableName: "AppShell"))
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(headerLocationSubtitle)
                                .font(CivicaTypography.subheadStrong)
                                .foregroundColor(VoteNowColors.mutedText)
                                .lineLimit(1)
                                .minimumScaleFactor(0.84)

                            Spacer(minLength: 8)
                            myInfoQuickAction
                        }
                        .padding(.leading, 72)
                        .padding(.top, -6)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 8)
                    .background(VoteNowColors.appBackground)

                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            searchCard

                            locationCoverageCard()

                            if let launchState = repsLaunchState {
                                launchStateCard(for: launchState)
                            }

                            if !sections.isEmpty {
                                ForEach(sections) { section in
                                    RepresentativeSection(
                                        title: section.title,
                                        officials: section.officials
                                    )
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 16)
                    }
                    .scrollDismissesKeyboard(.interactively)
                }
            }
            .safeAreaInset(edge: .bottom) {
                if isGovHelpChatEnabled {
                    HStack(spacing: 10) {
                        Spacer(minLength: 0)
                        chatButton
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 8)
                }
            }
            .onAppear {
                seedLookupInputIfNeeded()
                if !normalizedZip.isEmpty {
                    repsVM.fetchReps(for: normalizedZip)
                }
            }
            .onTapGesture {
                locationFieldFocused = false
            }
            .onChange(of: repsVM.resolvedLocationSelection?.timestamp) { _, _ in
                guard let selection = repsVM.resolvedLocationSelection else { return }
                if let zip = selection.postalCode {
                    planVM.zip = zip
                    planVM.userAddress.zip = zip
                }
                if let state = selection.administrativeArea {
                    planVM.userAddress.state = state
                }
                let display = displayAddressInput(for: selection)
                if !display.isEmpty {
                    setLocationInputSilently(display)
                }
                // Only animate matched counts when the user resolves a new address/location.
                matchedCountAnimationRevision += 1
            }
        }
        .sheet(isPresented: $showMyInfoSheet) {
            MyInfoPanelView()
                .environmentObject(planVM)
                .environmentObject(repsVM)
        }
        .sheet(isPresented: $showGovHelpChat) {
            if isGovHelpChatEnabled {
                GovHelpChatSheetView(
                    reps: chatContexts,
                    currentZip: normalizedZip
                )
            }
        }
        .fullScreenCover(isPresented: $showFullScreenMap) {
            MyRepsFullScreenMapView(
                mapMode: repsVM.mapMode,
                resolvedCoordinate: repsVM.resolvedCoordinate,
                resolvedStateCode: repsVM.resolvedStateCode,
                politicalGeography: repsVM.politicalGeography,
                mapViewportResetID: repsVM.mapViewportResetID,
                onStateTapped: { stateCode in
                    handleStateSelection(stateCode)
                },
                onResetMap: {
                    repsVM.resetMapToNationalView()
                },
                onClose: {
                    showFullScreenMap = false
                }
            )
        }
    }

    private var matchedSummaryPill: some View {
        HStack(spacing: 6) {
            Text("Matched")
                .foregroundColor(VoteNowColors.primaryText)

            ForEach(Array(matchedSegments.enumerated()), id: \.element.id) { index, segment in
                if index > 0 {
                    Text("·")
                        .foregroundColor(VoteNowColors.borderWarm)
                }

                Text("\(segment.count)")
                    .foregroundColor(segment.countColor)
                    .contentTransition(.numericText())
                    .animation(.spring(response: 0.28, dampingFraction: 0.86), value: matchedCountAnimationRevision)
                Text(segment.title)
                    .foregroundColor(VoteNowColors.mutedText)
            }
        }
        .font(.system(size: 13, weight: .semibold, design: .rounded))
        .lineLimit(1)
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(VoteNowColors.surfaceWhite.opacity(0.96))
        .overlay(
            Capsule()
                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
        )
        .clipShape(Capsule())
        .shadow(color: VoteNowColors.primaryText.opacity(0.08), radius: 3, x: 0, y: 1)
    }

    private struct MatchedSegment: Identifiable {
        let id: String
        let title: String
        let count: Int
        let countColor: Color
    }

    private var matchedSegments: [MatchedSegment] {
        [
            MatchedSegment(id: "federal", title: "Federal", count: matchedFederalCount, countColor: VoteNowColors.richBlue),
            MatchedSegment(id: "state", title: "State", count: matchedStateCount, countColor: VoteNowColors.successGreen),
            MatchedSegment(id: "local", title: "Local", count: matchedLocalCount, countColor: VoteNowColors.warningAmber)
        ]
        .filter { $0.count > 0 }
    }

    private var chatButton: some View {
        Button {
            showGovHelpChat = true
        } label: {
            Label(l("app.reps.action.chat", "Chat"), systemImage: "message.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(VoteNowColors.primaryCTA)
                .clipShape(Capsule())
                .shadow(color: VoteNowColors.primaryText.opacity(0.18), radius: 4, x: 0, y: 2)
        }
        .buttonStyle(.plain)
    }

    private var searchCard: some View {
        HStack(spacing: 10) {
            ZStack(alignment: .trailing) {
                TextField(
                    "",
                    text: $locationInput,
                    prompt: Text("app.reps.search.placeholder", tableName: "AppShell")
                )
                    .font(.system(size: 18))
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .focused($locationFieldFocused)
                    .padding(.leading, 12)
                    .padding(.trailing, 44)
                    .padding(.vertical, 12)
                    .background(VoteNowColors.surfaceWhite)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                    )
                    .onChange(of: locationInput) { _, newValue in
                        if suppressLocationInputTypingHandler {
                            suppressLocationInputTypingHandler = false
                            return
                        }
                        repsVM.handleLocationInputTyping(newValue)
                    }
                    .onSubmit {
                        submitLookupOrFallback()
                    }
                    .toolbar {
                        ToolbarItemGroup(placement: .keyboard) {
                            Spacer()
                            Button(l("app.reps.action.done", "Done")) {
                                locationFieldFocused = false
                            }
                        }
                    }

                Button {
                    locationInput = ""
                    planVM.zip = ""
                    planVM.userAddress.zip = ""
                    repsVM.resetZipEntryState()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 22, height: 22)
                        .background(Color.gray.opacity(0.60))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .padding(.trailing, 10)
                .opacity(locationInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.45 : 1.0)
                .disabled(locationInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .frame(maxWidth: .infinity)

            Button {
                locationFieldFocused = false
                repsVM.centerOnCurrentLocation()
            } label: {
                Image(systemName: "location.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 32, height: 32)
                    .background(VoteNowColors.primaryCTA)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(l("app.reps.action.use_location", "Use my location"))
            .disabled(repsVM.isLoading)
        }
    }

    private var myInfoQuickAction: some View {
        Button {
            locationFieldFocused = false
            showMyInfoSheet = true
        } label: {
            Text(l("app.reps.action.edit_location", "Change Location"))
                .font(CivicaTypography.supportStrong)
                .italic()
                .foregroundColor(VoteNowColors.primaryCTA)
                .lineLimit(1)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func locationCoverageCard() -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(
                repsVM.resolvedCoordinate == nil
                ? l("app.reps.coverage.find_district", "Find your district by entering your address")
                : l("app.reps.coverage.matched", "Your address matches you to your district")
            )
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(VoteNowColors.primaryText)

            MyRepsCoverageMapView(
                mapMode: repsVM.mapMode,
                resolvedCoordinate: repsVM.resolvedCoordinate,
                resolvedStateCode: repsVM.resolvedStateCode,
                politicalGeography: repsVM.politicalGeography,
                mapViewportResetID: repsVM.mapViewportResetID,
                onStateTapped: { stateCode in
                    handleStateSelection(stateCode)
                }
            )
            .frame(height: 215)
            .overlay(alignment: .bottom) {
                if !sections.isEmpty {
                    matchedSummaryPill
                        .padding(.bottom, 10)
                        .zIndex(2)
                }
            }
            .overlay(alignment: .topTrailing) {
                Button {
                    showFullScreenMap = true
                } label: {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(VoteNowColors.primaryCTA)
                        .padding(10)
                        .background(VoteNowColors.surfaceWhite.opacity(0.96))
                        .overlay(
                            Circle()
                                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                        )
                        .shadow(color: VoteNowColors.primaryText.opacity(0.08), radius: 3, x: 0, y: 1)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .padding(10)
                .accessibilityLabel(l("app.reps.coverage.open_full_map", "Open full map"))
            }
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            Text(
                isStateOnlyInput
                ? l(
                    "app.reps.coverage.precision_missing_banner",
                    "We found your state, but not your exact congressional district yet. Enter your full street address to load your full representative list."
                )
                : repsVM.isGeneralLocationSearchResult
                ? l(
                    "app.reps.coverage.statewide_only_note",
                    "Showing statewide officials for this general location search. Enter your full street address to load all reps."
                )
                : l(
                    "app.reps.coverage.full_address_note",
                    "Enter your full street address to load all reps."
                )
            )
            .font(.system(size: 13, weight: .medium))
            .foregroundColor(VoteNowColors.mutedText)
            .frame(maxWidth: .infinity, alignment: .leading)

            if case .focused = repsVM.mapMode {
                Button(l("app.reps.coverage.reset_map", "Reset map view")) {
                    repsVM.resetMapToNationalView()
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(VoteNowColors.primaryCTA)
                .buttonStyle(.plain)
            }
        }
    }

    private func seedLookupInputIfNeeded() {
        guard locationInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        if let selection = repsVM.resolvedLocationSelection,
           let normalized = selection.normalizedAddress,
           !normalized.isEmpty {
            setLocationInputSilently(normalized)
            return
        }

        let address = [
            planVM.userAddress.street,
            planVM.userAddress.city,
            planVM.userAddress.state,
            planVM.userAddress.zip
        ]
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
        .joined(separator: ", ")

        if !address.isEmpty {
            setLocationInputSilently(address)
            return
        }

        if !normalizedZip.isEmpty {
            setLocationInputSilently(normalizedZip)
        }
    }

    @ViewBuilder
    private func launchStateCard(for state: RepsLaunchState) -> some View {
        switch state {
        case .loading:
            LaunchFlowStateCard(
                state: .loading,
                title: l("app.reps.loading_title", "Finding your representatives"),
                message: l("app.reps.loading", "Looking up your reps..."),
                primaryActionTitle: l("app.reps.action.use_location", "Use my location"),
                primaryAction: {
                    locationFieldFocused = false
                    repsVM.centerOnCurrentLocation()
                }
            )
        case .empty:
            LaunchFlowStateCard(
                state: .empty,
                title: l("app.reps.empty_title", "No representatives loaded yet"),
                message: l("app.reps.empty_prompt", "Enter your ZIP, city/state, or full U.S. address to load your representatives."),
                primaryActionTitle: l("app.reps.action.find_my_reps", "Find My Reps"),
                primaryAction: {
                    submitLookupOrFallback()
                },
                secondaryActionTitle: l("app.reps.action.use_location", "Use my location"),
                secondaryAction: {
                    locationFieldFocused = false
                    repsVM.centerOnCurrentLocation()
                }
            )
        case .error:
            let trimmedErrorMessage = repsVM.errorMessage?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let resolvedErrorMessage: String? = {
                guard let trimmedErrorMessage, !trimmedErrorMessage.isEmpty else { return nil }
                return trimmedErrorMessage
            }()
            LaunchFlowStateCard(
                state: .error,
                title: l("app.reps.error_title", "We couldn’t load your representatives"),
                message: resolvedErrorMessage
                    ?? l("app.reps.error_retry_hint", "Try again or use your current location."),
                primaryActionTitle: l("app.reps.action.retry", "Retry"),
                primaryAction: {
                    submitLookupOrFallback()
                },
                secondaryActionTitle: l("app.reps.action.use_location", "Use my location"),
                secondaryAction: {
                    locationFieldFocused = false
                    repsVM.centerOnCurrentLocation()
                }
            )
        }
    }

    private func submitLookup() {
        let trimmed = locationInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        locationFieldFocused = false
        repsVM.resolveLocationInput(trimmed)
    }

    private func submitLookupOrFallback() {
        let trimmed = locationInput.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            locationFieldFocused = false
            repsVM.centerOnCurrentLocation()
            return
        }
        submitLookup()
    }

    private func displayAddressInput(for selection: RepsLocationSelection) -> String {
        if let normalized = selection.normalizedAddress?.trimmingCharacters(in: .whitespacesAndNewlines),
           !normalized.isEmpty {
            return normalized
        }

        let assembled = [
            selection.city,
            selection.administrativeArea,
            selection.postalCode
        ]
        .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
        .joined(separator: ", ")

        return assembled
    }

    private func handleStateSelection(_ stateCode: String) {
        let tappedCode = stateCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard tappedCode.count == 2 else { return }

        let displayName = Self.stateCodeToName[tappedCode] ?? tappedCode
        setLocationInputSilently("\(tappedCode) - \(displayName)")
        locationFieldFocused = false

        repsVM.focusMapStateFromTap(tappedCode)
    }

    private func setLocationInputSilently(_ value: String) {
        guard locationInput != value else { return }
        suppressLocationInputTypingHandler = true
        locationInput = value
    }
}

private struct MyRepsFullScreenMapView: View {
    let mapMode: MapMode
    let resolvedCoordinate: CLLocationCoordinate2D?
    let resolvedStateCode: String?
    let politicalGeography: PoliticalGeography?
    let mapViewportResetID: UUID
    let onStateTapped: (String) -> Void
    let onResetMap: () -> Void
    let onClose: () -> Void

    var body: some View {
        ZStack(alignment: .top) {
            VoteNowColors.appBackground
                .ignoresSafeArea()

            MyRepsCoverageMapView(
                mapMode: mapMode,
                resolvedCoordinate: resolvedCoordinate,
                resolvedStateCode: resolvedStateCode,
                politicalGeography: politicalGeography,
                mapViewportResetID: mapViewportResetID,
                onStateTapped: onStateTapped
            )
            .ignoresSafeArea()

            HStack(spacing: 10) {
                Button {
                    onClose()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(VoteNowColors.primaryCTA)
                        .frame(width: 34, height: 34)
                        .background(VoteNowColors.surfaceWhite.opacity(0.96))
                        .overlay(
                            Circle()
                                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                        )
                        .shadow(color: VoteNowColors.primaryText.opacity(0.08), radius: 3, x: 0, y: 1)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)

                Spacer(minLength: 0)

                if case .focused = mapMode {
                    Button("Reset map") {
                        onResetMap()
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(VoteNowColors.primaryCTA)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(VoteNowColors.surfaceWhite.opacity(0.96))
                    .overlay(
                        Capsule()
                            .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                    )
                    .shadow(color: VoteNowColors.primaryText.opacity(0.08), radius: 3, x: 0, y: 1)
                    .clipShape(Capsule())
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 10)
        }
    }
}

struct MyRepsView_Previews: PreviewProvider {
    static var previews: some View {
        MyRepsView()
            .environmentObject(PlanViewModel())
            .environmentObject(MyRepsViewModel())
    }
}

private struct MyRepsCoverageMapView: UIViewRepresentable {
    let mapMode: MapMode
    let resolvedCoordinate: CLLocationCoordinate2D?
    let resolvedStateCode: String?
    let politicalGeography: PoliticalGeography?
    let mapViewportResetID: UUID
    let onStateTapped: (String) -> Void

    private final class BrandedLocationAnnotation: NSObject, MKAnnotation {
        let coordinate: CLLocationCoordinate2D
        let title: String?
        let subtitle: String?

        init(coordinate: CLLocationCoordinate2D, title: String?, subtitle: String?) {
            self.coordinate = coordinate
            self.title = title
            self.subtitle = subtitle
        }
    }

    private final class StateFlagAnnotation: NSObject, MKAnnotation {
        let coordinate: CLLocationCoordinate2D
        let stateCode: String
        let title: String?
        let shouldFadeInOnAdd: Bool

        init(
            coordinate: CLLocationCoordinate2D,
            stateCode: String,
            title: String?,
            shouldFadeInOnAdd: Bool = false
        ) {
            self.coordinate = coordinate
            self.stateCode = stateCode
            self.title = title
            self.shouldFadeInOnAdd = shouldFadeInOnAdd
        }
    }

    private enum OverlayRole {
        case worldLand
        case nationalState
        case backgroundStateBorder
        case focusedState
    }

    private static let nonContinentalStateCodes: Set<String> = [
        "AK", "HI", "AS", "GU", "MP", "PR", "VI"
    ]

    private static let usOverviewRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 38.5, longitude: -97.0),
        span: MKCoordinateSpan(latitudeDelta: 30.0, longitudeDelta: 58.0)
    )

    private static let contiguousUSMapRect: MKMapRect = {
        let topLeft = MKMapPoint(CLLocationCoordinate2D(latitude: 49.6, longitude: -125.2))
        let bottomRight = MKMapPoint(CLLocationCoordinate2D(latitude: 24.3, longitude: -66.8))
        return MKMapRect(
            x: min(topLeft.x, bottomRight.x),
            y: min(topLeft.y, bottomRight.y),
            width: abs(bottomRight.x - topLeft.x),
            height: abs(bottomRight.y - topLeft.y)
        )
    }()

    // Constrain world landmass rendering to the Americas and skip oversized polygons that
    // tend to create antimeridian seam lines in the Pacific.
    private static let americasMapRect: MKMapRect = {
        let topLeft = MKMapPoint(CLLocationCoordinate2D(latitude: 84.0, longitude: -170.0))
        let bottomRight = MKMapPoint(CLLocationCoordinate2D(latitude: -60.0, longitude: -20.0))
        return MKMapRect(
            x: min(topLeft.x, bottomRight.x),
            y: min(topLeft.y, bottomRight.y),
            width: abs(bottomRight.x - topLeft.x),
            height: abs(bottomRight.y - topLeft.y)
        )
    }()

    private static let nearbyUSForeignLandMapRect: MKMapRect = {
        let dx = contiguousUSMapRect.size.width * 0.55
        let dy = contiguousUSMapRect.size.height * 0.70
        return contiguousUSMapRect.insetBy(dx: -dx, dy: -dy)
    }()

    private struct InsetProxyLayout {
        let anchorX: Double
        let anchorY: Double
        let scale: Double
    }

    private static let insetProxyLayoutsByStateCode: [String: InsetProxyLayout] = [
        "AK": InsetProxyLayout(anchorX: 0.12, anchorY: 0.86, scale: 2.31),
        "HI": InsetProxyLayout(anchorX: 0.33, anchorY: 0.91, scale: 1.87),
        "PR": InsetProxyLayout(anchorX: 0.84, anchorY: 0.90, scale: 0.73),
        "GU": InsetProxyLayout(anchorX: 0.03, anchorY: 0.74, scale: 0.59),
        "VI": InsetProxyLayout(anchorX: 0.10, anchorY: 0.77, scale: 0.48),
        "AS": InsetProxyLayout(anchorX: 0.005, anchorY: 0.44, scale: 0.57),
        "MP": InsetProxyLayout(anchorX: 0.018, anchorY: 0.52, scale: 0.66)
    ]

    private var focusedStateCode: String? {
        switch mapMode {
        case .national:
            return nil
        case .focused(let stateCode):
            let primary = normalizedStateCode(from: stateCode)
            let fallback = normalizedStateCode(from: resolvedStateCode)
            guard let normalized = primary ?? fallback else { return nil }
            return normalized
        }
    }

    private func normalizedStateCode(from value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
              value.count == 2 else {
            return nil
        }
        return value
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView(frame: .zero)
        mapView.delegate = context.coordinator
        context.coordinator.onStateTapped = onStateTapped
        context.coordinator.installTapInteractionIfNeeded(on: mapView)
        mapView.backgroundColor = USStateOverlayStyle.oceanNavy
        mapView.isOpaque = true
        mapView.showsCompass = false
        mapView.showsScale = false
        mapView.isPitchEnabled = false
        mapView.isRotateEnabled = false
        mapView.showsBuildings = false
        mapView.showsTraffic = false
        mapView.pointOfInterestFilter = .excludingAll
        mapView.tintColor = USStateOverlayStyle.brandRed

        if #available(iOS 16.0, *) {
            let config = MKStandardMapConfiguration(elevationStyle: .flat, emphasisStyle: .muted)
            config.pointOfInterestFilter = .excludingAll
            config.showsTraffic = false
            mapView.preferredConfiguration = config
        } else {
            mapView.mapType = .mutedStandard
        }

        mapView.setRegion(Self.usOverviewRegion, animated: false)
        context.coordinator.render(
            mapView: mapView,
            mapMode: mapMode,
            focusedStateCode: focusedStateCode,
            resolvedCoordinate: resolvedCoordinate,
            politicalGeography: politicalGeography,
            viewportResetID: mapViewportResetID,
            animated: false
        )
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        context.coordinator.onStateTapped = onStateTapped
        context.coordinator.render(
            mapView: mapView,
            mapMode: mapMode,
            focusedStateCode: focusedStateCode,
            resolvedCoordinate: resolvedCoordinate,
            politicalGeography: politicalGeography,
            viewportResetID: mapViewportResetID,
            animated: true
        )
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        private let backdrop = BrandBackdropOverlay.worldBounds()
        private var overlayRoles: [ObjectIdentifier: OverlayRole] = [:]
        private var overlayStateCodes: [ObjectIdentifier: String] = [:]
        private var lastMode: MapMode?
        private var lastFocusedStateCode: String?
        private var lastCoordinate: CLLocationCoordinate2D?
        private var lastViewportResetID: UUID?
        private var geometryBundle: MapGeometryStore.GeometryBundle?
        private var cameraAnimationGeneration = 0
        private var tapRecognizer: UITapGestureRecognizer?
        private var currentLocationAnnotation: BrandedLocationAnnotation?
        private var currentStateFlagAnnotation: StateFlagAnnotation?
        private var focusedFillProgress: CGFloat = 1.0
        private var pendingFocusedFillFade = false
        private var focusedFillFadeToken = 0
        private var focusedRenderers: [ObjectIdentifier: MKOverlayPathRenderer] = [:]
        var onStateTapped: ((String) -> Void)?

        override init() {
            super.init()
            geometryBundle = MapGeometryStore.shared.loadIfNeeded()
        }

        func render(
            mapView: MKMapView,
            mapMode: MapMode,
            focusedStateCode: String?,
            resolvedCoordinate: CLLocationCoordinate2D?,
            politicalGeography: PoliticalGeography?,
            viewportResetID: UUID,
            animated: Bool
        ) {
            if geometryBundle == nil {
                geometryBundle = MapGeometryStore.shared.loadIfNeeded()
            }

            let modeChanged = mapMode != lastMode || focusedStateCode != lastFocusedStateCode
            let shouldAnimateFocusedFill: Bool = {
                guard case .focused = mapMode else { return false }
                guard let focusedStateCode else { return false }
                return focusedStateCode != lastFocusedStateCode
            }()
            let viewportResetChanged = lastViewportResetID != viewportResetID
            if modeChanged {
                installOverlays(
                    on: mapView,
                    mapMode: mapMode,
                    focusedStateCode: focusedStateCode,
                    animateFocusedFill: shouldAnimateFocusedFill
                )
            }
            if modeChanged || viewportResetChanged {
                updateCamera(on: mapView, mapMode: mapMode, focusedStateCode: focusedStateCode, animated: animated)
            }

            let coordinateChanged = !approximatelyEqual(lastCoordinate, resolvedCoordinate)
            if modeChanged || coordinateChanged {
                updateAnnotations(
                    on: mapView,
                    mapMode: mapMode,
                    focusedStateCode: focusedStateCode,
                    resolvedCoordinate: resolvedCoordinate,
                    politicalGeography: politicalGeography
                )
            }

            lastMode = mapMode
            lastFocusedStateCode = focusedStateCode
            lastCoordinate = resolvedCoordinate
            lastViewportResetID = viewportResetID
        }

        private func installOverlays(
            on mapView: MKMapView,
            mapMode: MapMode,
            focusedStateCode: String?,
            animateFocusedFill: Bool
        ) {
            let removableOverlays = mapView.overlays.filter { !($0 is BrandBackdropOverlay) }
            if !removableOverlays.isEmpty {
                mapView.removeOverlays(removableOverlays)
            }
            overlayRoles.removeAll()
            overlayStateCodes.removeAll()
            focusedRenderers.removeAll()
            focusedFillFadeToken += 1
            pendingFocusedFillFade = false
            focusedFillProgress = 1.0

            // Overlay ordering: opaque backdrop first, then world land, then U.S. state polygons.
            ensureBackdropInstalled(on: mapView)

            guard let bundle = geometryBundle else { return }

            switch mapMode {
            case .national:
                // Keep foreign landmass only in national mode. In focused mode, these polygons
                // can create projection artifacts that look like misplaced wedges.
                for overlay in bundle.worldLand {
                    let bounds = overlay.boundingMapRect
                    if bounds.size.width > MKMapRect.world.size.width * 0.30 {
                        continue
                    }
                    if bounds.size.height > MKMapRect.world.size.height * 0.45 {
                        continue
                    }
                    if !bounds.intersects(MyRepsCoverageMapView.americasMapRect) {
                        continue
                    }
                    if !bounds.intersects(MyRepsCoverageMapView.nearbyUSForeignLandMapRect) {
                        continue
                    }
                    register(overlay: overlay, role: .worldLand, stateCode: nil)
                    mapView.addOverlay(overlay, level: .aboveLabels)
                }

                for stateGeometry in bundle.nationalStates where !MyRepsCoverageMapView.nonContinentalStateCodes.contains(stateGeometry.stateCode) {
                    for overlay in stateGeometry.overlays {
                        register(overlay: overlay, role: .nationalState, stateCode: stateGeometry.stateCode)
                        mapView.addOverlay(overlay, level: .aboveLabels)
                    }
                }

                addInsetProxyOverlays(
                    on: mapView,
                    bundle: bundle,
                    selectedStateCode: nil,
                    focusedMode: false
                )
            case .focused:
                focusedFillProgress = animateFocusedFill ? 0.0 : 1.0
                pendingFocusedFillFade = animateFocusedFill

                for stateGeometry in bundle.nationalStates where
                    !MyRepsCoverageMapView.nonContinentalStateCodes.contains(stateGeometry.stateCode) &&
                    stateGeometry.stateCode != focusedStateCode
                {
                    for overlay in stateGeometry.overlays {
                        register(overlay: overlay, role: .backgroundStateBorder, stateCode: stateGeometry.stateCode)
                        mapView.addOverlay(overlay, level: .aboveLabels)
                    }
                }

                addInsetProxyOverlays(
                    on: mapView,
                    bundle: bundle,
                    selectedStateCode: focusedStateCode,
                    focusedMode: true
                )

                guard
                    let focusedStateCode,
                    !MyRepsCoverageMapView.nonContinentalStateCodes.contains(focusedStateCode),
                    let focusedGeometry = bundle.focusStatesByCode[focusedStateCode]
                else {
                    scheduleFocusedFillFadeIfNeeded()
                    return
                }
                for overlay in focusedGeometry.overlays {
                    register(overlay: overlay, role: .focusedState, stateCode: focusedGeometry.stateCode)
                    mapView.addOverlay(overlay, level: .aboveLabels)
                }
                scheduleFocusedFillFadeIfNeeded()
            }
        }

        private func ensureBackdropInstalled(on mapView: MKMapView) {
            let hasBackdrop = mapView.overlays.contains { overlay in
                guard let object = overlay as? NSObject else { return false }
                return object === backdrop
            }
            guard !hasBackdrop else { return }
            mapView.insertOverlay(backdrop, at: 0, level: .aboveLabels)
        }

        private func addInsetProxyOverlays(
            on mapView: MKMapView,
            bundle: MapGeometryStore.GeometryBundle,
            selectedStateCode: String?,
            focusedMode: Bool
        ) {
            let normalizedSelected = selectedStateCode?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            for (stateCode, layout) in MyRepsCoverageMapView.insetProxyLayoutsByStateCode {
                guard let sourceGeometry = bundle.focusStatesByCode[stateCode] else { continue }
                let proxyOverlays = insetProxyOverlays(for: sourceGeometry, layout: layout)
                for overlay in proxyOverlays {
                    let role: OverlayRole
                    if focusedMode {
                        role = (stateCode == normalizedSelected) ? .focusedState : .backgroundStateBorder
                    } else {
                        role = .nationalState
                    }
                    register(overlay: overlay, role: role, stateCode: stateCode)
                    mapView.addOverlay(overlay, level: .aboveLabels)
                }
            }
        }

        private func insetProxyOverlays(
            for stateGeometry: MapGeometryStore.StateGeometry,
            layout: MyRepsCoverageMapView.InsetProxyLayout
        ) -> [MKOverlay] {
            guard let source = effectiveInsetSource(for: stateGeometry) else { return [] }
            let sourceRect = source.mapRect
            guard sourceRect.size.width > 0, sourceRect.size.height > 0 else { return [] }
            let targetRect = insetProxyTargetRect(for: sourceRect, layout: layout)
            return transformedOverlays(
                source.overlays,
                from: sourceRect,
                to: targetRect
            )
        }

        private func insetProxyTargetRect(
            for sourceRect: MKMapRect,
            layout: MyRepsCoverageMapView.InsetProxyLayout
        ) -> MKMapRect {
            let container = MyRepsCoverageMapView.contiguousUSMapRect
            let baseUnit = min(container.size.width, container.size.height) * 0.12
            let longestDimension = max(baseUnit * layout.scale, min(container.size.width, container.size.height) * 0.03)
            let sourceAspect = sourceRect.size.width / sourceRect.size.height

            let targetWidth: Double
            let targetHeight: Double
            if sourceAspect >= 1 {
                targetWidth = longestDimension
                targetHeight = longestDimension / max(sourceAspect, 0.001)
            } else {
                targetHeight = longestDimension
                targetWidth = longestDimension * sourceAspect
            }

            let centerX = container.origin.x + container.size.width * layout.anchorX
            let centerY = container.origin.y + container.size.height * layout.anchorY
            return MKMapRect(
                x: centerX - (targetWidth / 2),
                y: centerY - (targetHeight / 2),
                width: targetWidth,
                height: targetHeight
            )
        }

        private func transformedOverlays(
            _ overlays: [MKOverlay],
            from sourceRect: MKMapRect,
            to targetRect: MKMapRect
        ) -> [MKOverlay] {
            var transformed: [MKOverlay] = []
            for overlay in overlays {
                if let polygon = overlay as? MKPolygon {
                    transformed.append(transformedPolygon(polygon, from: sourceRect, to: targetRect))
                } else if let multiPolygon = overlay as? MKMultiPolygon {
                    let polygons = multiPolygon.polygons.map { transformedPolygon($0, from: sourceRect, to: targetRect) }
                    transformed.append(MKMultiPolygon(polygons))
                }
            }
            return transformed
        }

        private func insetProxyCenterCoordinate(for stateCode: String) -> CLLocationCoordinate2D? {
            guard
                let layout = MyRepsCoverageMapView.insetProxyLayoutsByStateCode[stateCode],
                let sourceGeometry = geometryBundle?.focusStatesByCode[stateCode]
            else {
                return nil
            }
            guard let source = effectiveInsetSource(for: sourceGeometry) else { return nil }
            let targetRect = insetProxyTargetRect(for: source.mapRect, layout: layout)
            return MKMapPoint(x: targetRect.midX, y: targetRect.midY).coordinate
        }

        private func effectiveInsetSource(
            for stateGeometry: MapGeometryStore.StateGeometry
        ) -> (overlays: [MKOverlay], mapRect: MKMapRect)? {
            var overlays = stateGeometry.overlays

            // Alaska's Aleutian chain and distant islands can heavily skew inset scaling.
            // Use the primary mainland polygon for inset rendering.
            if stateGeometry.stateCode == "AK",
               let primaryPolygon = largestPolygon(from: stateGeometry.overlays) {
                overlays = [primaryPolygon]
            }

            guard let first = overlays.first else { return nil }
            var combinedRect = first.boundingMapRect
            for overlay in overlays.dropFirst() {
                combinedRect = combinedRect.union(overlay.boundingMapRect)
            }
            return (overlays: overlays, mapRect: combinedRect)
        }

        private func largestPolygon(from overlays: [MKOverlay]) -> MKPolygon? {
            var largest: MKPolygon?
            var largestArea = -Double.greatestFiniteMagnitude

            for overlay in overlays {
                if let polygon = overlay as? MKPolygon {
                    let area = polygonArea(polygon)
                    if area > largestArea {
                        largestArea = area
                        largest = polygon
                    }
                } else if let multi = overlay as? MKMultiPolygon {
                    for polygon in multi.polygons {
                        let area = polygonArea(polygon)
                        if area > largestArea {
                            largestArea = area
                            largest = polygon
                        }
                    }
                }
            }

            return largest
        }

        private func transformedPolygon(
            _ polygon: MKPolygon,
            from sourceRect: MKMapRect,
            to targetRect: MKMapRect
        ) -> MKPolygon {
            let transformedCoords = transformedCoordinates(
                points: polygon.points(),
                count: polygon.pointCount,
                from: sourceRect,
                to: targetRect
            )
            let transformedHoles: [MKPolygon]? = polygon.interiorPolygons?.map { hole in
                let holeCoords = transformedCoordinates(
                    points: hole.points(),
                    count: hole.pointCount,
                    from: sourceRect,
                    to: targetRect
                )
                return MKPolygon(coordinates: holeCoords, count: holeCoords.count)
            }
            return MKPolygon(
                coordinates: transformedCoords,
                count: transformedCoords.count,
                interiorPolygons: transformedHoles
            )
        }

        private func transformedCoordinates(
            points: UnsafeMutablePointer<MKMapPoint>,
            count: Int,
            from sourceRect: MKMapRect,
            to targetRect: MKMapRect
        ) -> [CLLocationCoordinate2D] {
            guard count > 0, sourceRect.size.width > 0, sourceRect.size.height > 0 else { return [] }
            return (0..<count).map { index in
                let original = points[index]
                let xRatio = (original.x - sourceRect.origin.x) / sourceRect.size.width
                let yRatio = (original.y - sourceRect.origin.y) / sourceRect.size.height
                let transformedPoint = MKMapPoint(
                    x: targetRect.origin.x + (xRatio * targetRect.size.width),
                    y: targetRect.origin.y + (yRatio * targetRect.size.height)
                )
                return transformedPoint.coordinate
            }
        }

        private func updateCamera(on mapView: MKMapView, mapMode: MapMode, focusedStateCode: String?, animated: Bool) {
            cameraAnimationGeneration += 1
            let generation = cameraAnimationGeneration

            switch mapMode {
            case .national:
                let boundedRect = paddedMapRect(
                    for: MyRepsCoverageMapView.contiguousUSMapRect,
                    expansion: 0.14,
                    minimumPadding: 1_200_000
                )
                setVisibleMapRect(
                    boundedRect,
                    on: mapView,
                    edgePadding: nationalEdgePadding(for: mapView),
                    animated: animated,
                    duration: 0.45
                )
                mapView.cameraBoundary = MKMapView.CameraBoundary(mapRect: boundedRect)
                mapView.cameraZoomRange = zoomRange(for: boundedRect)
            case .focused:
                guard
                    let focusedStateCode,
                    let stateRect = mapRectForFocusedState(stateCode: focusedStateCode)
                else {
                    let fallbackRect = paddedMapRect(
                        for: MyRepsCoverageMapView.contiguousUSMapRect,
                        expansion: 0.14,
                        minimumPadding: 1_200_000
                    )
                    setVisibleMapRect(
                        fallbackRect,
                        on: mapView,
                        edgePadding: nationalEdgePadding(for: mapView),
                        animated: animated,
                        duration: 0.45
                    )
                    mapView.cameraBoundary = MKMapView.CameraBoundary(mapRect: fallbackRect)
                    mapView.cameraZoomRange = zoomRange(for: fallbackRect)
                    return
                }

                let focusedRect = paddedMapRect(
                    for: stateRect,
                    expansion: 0.36,
                    minimumPadding: 200_000
                )

                // Focus mode should remain freely pannable/zoomable.
                mapView.cameraBoundary = nil
                mapView.cameraZoomRange = nil

                let edgePadding = focusedEdgePadding(for: mapView)
                if animated {
                    animatePanAndZoomToFocusedState(
                        on: mapView,
                        focusedRect: focusedRect,
                        edgePadding: edgePadding,
                        generation: generation
                    )
                } else {
                    mapView.setVisibleMapRect(focusedRect, edgePadding: edgePadding, animated: false)
                }
            }
        }

        private func mapRectForFocusedState(stateCode: String) -> MKMapRect? {
            guard let bundle = geometryBundle else { return nil }

            if let layout = MyRepsCoverageMapView.insetProxyLayoutsByStateCode[stateCode],
               let sourceGeometry = bundle.focusStatesByCode[stateCode],
               let source = effectiveInsetSource(for: sourceGeometry) {
                return insetProxyTargetRect(for: source.mapRect, layout: layout)
            }

            if let focusedGeometry = bundle.focusStatesByCode[stateCode] {
                return focusedGeometry.mapRect
            }

            return bundle.nationalStates.first(where: { $0.stateCode == stateCode })?.mapRect
        }

        private func nationalEdgePadding(for mapView: MKMapView) -> UIEdgeInsets {
            let height = max(mapView.bounds.height, 1)
            let top = max(6, height * 0.03)
            let bottom = max(32, height * 0.17)
            return UIEdgeInsets(top: top, left: 20, bottom: bottom, right: 20)
        }

        private func focusedEdgePadding(for mapView: MKMapView) -> UIEdgeInsets {
            let height = max(mapView.bounds.height, 1)
            let verticalBase = max(18, height * 0.08)
            return UIEdgeInsets(
                top: verticalBase + 10,
                left: 16,
                bottom: max(18, verticalBase * 0.65),
                right: 16
            )
        }

        private func paddedMapRect(
            for mapRect: MKMapRect,
            expansion: Double,
            minimumPadding: Double
        ) -> MKMapRect {
            let dx = max(mapRect.size.width * expansion, minimumPadding)
            let dy = max(mapRect.size.height * expansion, minimumPadding)
            return mapRect.insetBy(dx: -dx, dy: -dy)
        }

        private func setVisibleMapRect(
            _ mapRect: MKMapRect,
            on mapView: MKMapView,
            edgePadding: UIEdgeInsets,
            animated: Bool,
            duration: CFTimeInterval
        ) {
            guard animated else {
                mapView.setVisibleMapRect(mapRect, edgePadding: edgePadding, animated: false)
                return
            }

            CATransaction.begin()
            CATransaction.setAnimationDuration(duration)
            mapView.setVisibleMapRect(mapRect, edgePadding: edgePadding, animated: true)
            CATransaction.commit()
        }

        private func animatePanAndZoomToFocusedState(
            on mapView: MKMapView,
            focusedRect: MKMapRect,
            edgePadding: UIEdgeInsets,
            generation: Int
        ) {
            let center = centerCoordinate(for: focusedRect)
            let targetDistance = max(95_000, maxDimensionMeters(for: focusedRect) * 1.18)
            let currentDistance = mapView.camera.centerCoordinateDistance > 0
                ? mapView.camera.centerCoordinateDistance
                : 2_800_000
            let panDistance = max(currentDistance, targetDistance * 2.45)

            let panCamera = MKMapCamera(
                lookingAtCenter: center,
                fromDistance: panDistance,
                pitch: 0,
                heading: 0
            )

            mapView.cameraBoundary = nil
            mapView.cameraZoomRange = nil

            CATransaction.begin()
            CATransaction.setAnimationDuration(0.85)
            CATransaction.setAnimationTimingFunction(CAMediaTimingFunction(name: .easeInEaseOut))
            CATransaction.setCompletionBlock { [weak self, weak mapView] in
                guard let self, let mapView else { return }
                guard generation == self.cameraAnimationGeneration else { return }

                CATransaction.begin()
                CATransaction.setAnimationDuration(1.0)
                CATransaction.setAnimationTimingFunction(CAMediaTimingFunction(name: .easeInEaseOut))
                mapView.setVisibleMapRect(focusedRect, edgePadding: edgePadding, animated: true)
                CATransaction.commit()
            }
            mapView.setCamera(panCamera, animated: true)
            CATransaction.commit()
        }

        private func centerCoordinate(for mapRect: MKMapRect) -> CLLocationCoordinate2D {
            MKMapPoint(x: mapRect.midX, y: mapRect.midY).coordinate
        }

        private func maxDimensionMeters(for mapRect: MKMapRect) -> CLLocationDistance {
            let center = centerCoordinate(for: mapRect)
            let metersPerMapPoint = MKMetersPerMapPointAtLatitude(center.latitude)
            return max(mapRect.size.width, mapRect.size.height) * metersPerMapPoint
        }

        private func zoomRange(for mapRect: MKMapRect) -> MKMapView.CameraZoomRange? {
            let centerPoint = MKMapPoint(x: mapRect.midX, y: mapRect.midY)
            let centerCoordinate = centerPoint.coordinate
            let metersPerMapPoint = MKMetersPerMapPointAtLatitude(centerCoordinate.latitude)
            let maxDimensionMeters = max(mapRect.size.width, mapRect.size.height) * metersPerMapPoint
            let maxDistance = max(200_000, maxDimensionMeters * 3.0)
            return MKMapView.CameraZoomRange(
                minCenterCoordinateDistance: 9_000,
                maxCenterCoordinateDistance: maxDistance
            )
        }

        private func updateAnnotations(
            on mapView: MKMapView,
            mapMode: MapMode,
            focusedStateCode: String?,
            resolvedCoordinate: CLLocationCoordinate2D?,
            politicalGeography: PoliticalGeography?
        ) {
            guard case .focused = mapMode else {
                removeLocationAnnotation(on: mapView)
                removeAllStateFlags(on: mapView)
                return
            }

            syncLocationAnnotation(
                on: mapView,
                resolvedCoordinate: resolvedCoordinate,
                politicalGeography: politicalGeography
            )

            syncStateFlagAnnotation(
                on: mapView,
                focusedStateCode: focusedStateCode
            )
        }

        private func syncLocationAnnotation(
            on mapView: MKMapView,
            resolvedCoordinate: CLLocationCoordinate2D?,
            politicalGeography: PoliticalGeography?
        ) {
            guard let resolvedCoordinate else {
                removeLocationAnnotation(on: mapView)
                return
            }

            let metadata = politicalGeography?.pinSubtitle.trimmingCharacters(in: .whitespacesAndNewlines)
            let pinTitle = metadata?.isEmpty == false ? metadata : nil

            if let current = currentLocationAnnotation,
               approximatelyEqual(current.coordinate, resolvedCoordinate),
               current.title == pinTitle {
                return
            }

            removeLocationAnnotation(on: mapView)

            let locationAnnotation = BrandedLocationAnnotation(
                coordinate: resolvedCoordinate,
                title: pinTitle,
                subtitle: nil
            )
            currentLocationAnnotation = locationAnnotation
            mapView.addAnnotation(locationAnnotation)
        }

        private func syncStateFlagAnnotation(
            on mapView: MKMapView,
            focusedStateCode: String?
        ) {
            guard
                let focusedStateCode,
                let stateGeometry = geometryBundle?.focusStatesByCode[focusedStateCode],
                let stateFlagAsset = StateFlagCatalog.assetName(for: focusedStateCode),
                UIImage(named: stateFlagAsset) != nil
            else {
                removeAllStateFlags(on: mapView)
                return
            }

            let targetCoordinate = insetProxyCenterCoordinate(for: focusedStateCode) ?? flagCoordinate(for: stateGeometry)

            if let current = currentStateFlagAnnotation,
               current.stateCode == focusedStateCode,
               approximatelyEqual(current.coordinate, targetCoordinate) {
                return
            }

            // Keep exactly one state flag visible to prevent stale flags from prior taps.
            removeAllStateFlags(on: mapView)

            let newFlagAnnotation = StateFlagAnnotation(
                coordinate: targetCoordinate,
                stateCode: focusedStateCode,
                title: focusedStateCode,
                shouldFadeInOnAdd: false
            )

            currentStateFlagAnnotation = newFlagAnnotation
            mapView.addAnnotation(newFlagAnnotation)
        }

        private func removeLocationAnnotation(on mapView: MKMapView) {
            if let currentLocationAnnotation {
                mapView.removeAnnotation(currentLocationAnnotation)
                self.currentLocationAnnotation = nil
                return
            }

            let fallback = mapView.annotations.compactMap { $0 as? BrandedLocationAnnotation }
            if !fallback.isEmpty {
                mapView.removeAnnotations(fallback)
            }
        }

        private func removeAllStateFlags(on mapView: MKMapView) {
            if let currentStateFlagAnnotation {
                mapView.removeAnnotation(currentStateFlagAnnotation)
                self.currentStateFlagAnnotation = nil
            }

            let extras = mapView.annotations.compactMap { $0 as? StateFlagAnnotation }
            if !extras.isEmpty {
                mapView.removeAnnotations(extras)
            }
        }

        private func fadeOutAndRemoveStateFlag(_ annotation: StateFlagAnnotation, on mapView: MKMapView) {
            guard let view = mapView.view(for: annotation) else {
                mapView.removeAnnotation(annotation)
                return
            }

            UIView.animate(
                withDuration: 0.32,
                delay: 0,
                options: [.beginFromCurrentState, .curveEaseInOut],
                animations: {
                    view.alpha = 0
                },
                completion: { _ in
                    mapView.removeAnnotation(annotation)
                }
            )
        }

        private func register(overlay: MKOverlay, role: OverlayRole, stateCode: String?) {
            overlayRoles[ObjectIdentifier(overlay as AnyObject)] = role
            if let stateCode {
                overlayStateCodes[ObjectIdentifier(overlay as AnyObject)] = stateCode
            }
        }

        func installTapInteractionIfNeeded(on mapView: MKMapView) {
            guard tapRecognizer == nil else { return }
            let recognizer = UITapGestureRecognizer(target: self, action: #selector(handleMapTap(_:)))
            // Prevent MapKit's default tap-selection pipeline from also handling
            // state taps, which can produce an audible click on some devices.
            recognizer.cancelsTouchesInView = true
            mapView.addGestureRecognizer(recognizer)
            tapRecognizer = recognizer
        }

        @objc
        private func handleMapTap(_ recognizer: UITapGestureRecognizer) {
            guard recognizer.state == .ended else { return }
            guard let mapView = recognizer.view as? MKMapView else { return }

            if let selected = mapView.selectedAnnotations.first {
                mapView.deselectAnnotation(selected, animated: false)
            }

            let tapPoint = recognizer.location(in: mapView)
            let coordinate = mapView.convert(tapPoint, toCoordinateFrom: mapView)
            let mapPoint = MKMapPoint(coordinate)

            guard let tappedStateCode = hitTestStateCode(at: mapPoint, in: mapView) else { return }
            onStateTapped?(tappedStateCode)
        }

        private func hitTestStateCode(at mapPoint: MKMapPoint, in mapView: MKMapView) -> String? {
            for overlay in mapView.overlays.reversed() {
                let id = ObjectIdentifier(overlay as AnyObject)
                guard let role = overlayRoles[id], role != .worldLand else { continue }
                guard let stateCode = overlayStateCodes[id] else { continue }

                if let polygon = overlay as? MKPolygon, polygonContains(mapPoint, polygon: polygon) {
                    return stateCode
                }

                if let multiPolygon = overlay as? MKMultiPolygon {
                    for polygon in multiPolygon.polygons where polygonContains(mapPoint, polygon: polygon) {
                        return stateCode
                    }
                }
            }
            return nil
        }

        private func polygonContains(_ point: MKMapPoint, polygon: MKPolygon) -> Bool {
            let outerPoints = polygon.points()
            let outerCount = polygon.pointCount
            guard containsInRing(point, points: outerPoints, count: outerCount) else { return false }

            for hole in polygon.interiorPolygons ?? [] {
                if containsInRing(point, points: hole.points(), count: hole.pointCount) {
                    return false
                }
            }

            return true
        }

        private func containsInRing(
            _ point: MKMapPoint,
            points: UnsafeMutablePointer<MKMapPoint>,
            count: Int
        ) -> Bool {
            guard count > 2 else { return false }

            var isInside = false
            var j = count - 1

            for i in 0..<count {
                let yi = points[i].y
                let yj = points[j].y
                let xi = points[i].x
                let xj = points[j].x

                let yCrosses = (yi > point.y) != (yj > point.y)
                if yCrosses {
                    let denominator = (yj - yi) == 0 ? Double.leastNonzeroMagnitude : (yj - yi)
                    let xIntersection = ((xj - xi) * (point.y - yi) / denominator) + xi
                    if point.x < xIntersection {
                        isInside.toggle()
                    }
                }
                j = i
            }

            return isInside
        }

        private func flagCoordinate(for stateGeometry: MapGeometryStore.StateGeometry) -> CLLocationCoordinate2D {
            let fallback = MKMapPoint(
                x: stateGeometry.mapRect.midX,
                y: stateGeometry.mapRect.midY
            ).coordinate

            let polygons = polygons(from: stateGeometry.overlays)
            guard let targetPolygon = polygons.max(by: { polygonArea($0) < polygonArea($1) }) else {
                return fallback
            }

            if let interior = bestInteriorPoint(in: targetPolygon) {
                return interior.coordinate
            }

            let centroid = polygonCentroid(targetPolygon)
            if polygonContains(centroid, polygon: targetPolygon) {
                return centroid.coordinate
            }

            return fallback
        }

        private func polygons(from overlays: [MKOverlay]) -> [MKPolygon] {
            var polygons: [MKPolygon] = []
            for overlay in overlays {
                if let polygon = overlay as? MKPolygon {
                    polygons.append(polygon)
                } else if let multi = overlay as? MKMultiPolygon {
                    polygons.append(contentsOf: multi.polygons)
                }
            }
            return polygons
        }

        private func bestInteriorPoint(in polygon: MKPolygon) -> MKMapPoint? {
            let bounds = polygon.boundingMapRect
            guard bounds.size.width > 0, bounds.size.height > 0 else { return nil }

            var bestPoint: MKMapPoint?
            var bestScore = -Double.greatestFiniteMagnitude
            let gridSizes = [11, 15, 21]

            for gridSize in gridSizes {
                let stepX = bounds.size.width / Double(gridSize)
                let stepY = bounds.size.height / Double(gridSize)
                guard stepX > 0, stepY > 0 else { continue }

                for row in 0..<gridSize {
                    for column in 0..<gridSize {
                        let candidate = MKMapPoint(
                            x: bounds.origin.x + (Double(column) + 0.5) * stepX,
                            y: bounds.origin.y + (Double(row) + 0.5) * stepY
                        )

                        guard polygonContains(candidate, polygon: polygon) else { continue }
                        let edgeDistance = minDistanceToPolygonEdges(candidate, polygon: polygon)
                        if edgeDistance > bestScore {
                            bestScore = edgeDistance
                            bestPoint = candidate
                        }
                    }
                }
            }

            return bestPoint
        }

        private func polygonArea(_ polygon: MKPolygon) -> Double {
            abs(ringArea(points: polygon.points(), count: polygon.pointCount))
        }

        private func polygonCentroid(_ polygon: MKPolygon) -> MKMapPoint {
            let points = polygon.points()
            let count = polygon.pointCount
            guard count > 2 else {
                return MKMapPoint(
                    x: polygon.boundingMapRect.midX,
                    y: polygon.boundingMapRect.midY
                )
            }

            var signedArea = 0.0
            var centroidX = 0.0
            var centroidY = 0.0
            var j = count - 1

            for i in 0..<count {
                let x0 = points[j].x
                let y0 = points[j].y
                let x1 = points[i].x
                let y1 = points[i].y

                let cross = (x0 * y1) - (x1 * y0)
                signedArea += cross
                centroidX += (x0 + x1) * cross
                centroidY += (y0 + y1) * cross
                j = i
            }

            let areaFactor = signedArea * 0.5
            guard abs(areaFactor) > 1e-8 else {
                return MKMapPoint(
                    x: polygon.boundingMapRect.midX,
                    y: polygon.boundingMapRect.midY
                )
            }

            let factor = 1.0 / (6.0 * areaFactor)
            return MKMapPoint(x: centroidX * factor, y: centroidY * factor)
        }

        private func ringArea(points: UnsafeMutablePointer<MKMapPoint>, count: Int) -> Double {
            guard count > 2 else { return 0 }
            var total = 0.0
            var j = count - 1
            for i in 0..<count {
                total += (points[j].x * points[i].y) - (points[i].x * points[j].y)
                j = i
            }
            return total * 0.5
        }

        private func minDistanceToPolygonEdges(_ point: MKMapPoint, polygon: MKPolygon) -> Double {
            var minDistanceSquared = minDistanceSquaredToRingEdges(
                point,
                points: polygon.points(),
                count: polygon.pointCount
            )

            for hole in polygon.interiorPolygons ?? [] {
                let holeDistanceSquared = minDistanceSquaredToRingEdges(
                    point,
                    points: hole.points(),
                    count: hole.pointCount
                )
                minDistanceSquared = min(minDistanceSquared, holeDistanceSquared)
            }

            return sqrt(minDistanceSquared)
        }

        private func minDistanceSquaredToRingEdges(
            _ point: MKMapPoint,
            points: UnsafeMutablePointer<MKMapPoint>,
            count: Int
        ) -> Double {
            guard count > 1 else { return Double.greatestFiniteMagnitude }

            var minDistanceSquared = Double.greatestFiniteMagnitude
            var j = count - 1

            for i in 0..<count {
                let start = points[j]
                let end = points[i]
                let distanceSquared = distanceSquaredFrom(point, toSegmentStart: start, end: end)
                minDistanceSquared = min(minDistanceSquared, distanceSquared)
                j = i
            }

            return minDistanceSquared
        }

        private func distanceSquaredFrom(
            _ point: MKMapPoint,
            toSegmentStart start: MKMapPoint,
            end: MKMapPoint
        ) -> Double {
            let dx = end.x - start.x
            let dy = end.y - start.y
            if abs(dx) < 1e-10, abs(dy) < 1e-10 {
                let px = point.x - start.x
                let py = point.y - start.y
                return (px * px) + (py * py)
            }

            let tNumerator = ((point.x - start.x) * dx) + ((point.y - start.y) * dy)
            let tDenominator = (dx * dx) + (dy * dy)
            let t = max(0.0, min(1.0, tNumerator / tDenominator))
            let projectionX = start.x + (t * dx)
            let projectionY = start.y + (t * dy)
            let deltaX = point.x - projectionX
            let deltaY = point.y - projectionY
            return (deltaX * deltaX) + (deltaY * deltaY)
        }

        private func approximatelyEqual(_ lhs: CLLocationCoordinate2D?, _ rhs: CLLocationCoordinate2D?) -> Bool {
            switch (lhs, rhs) {
            case (nil, nil):
                return true
            case let (left?, right?):
                return abs(left.latitude - right.latitude) < 0.000001 &&
                    abs(left.longitude - right.longitude) < 0.000001
            default:
                return false
            }
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if overlay is BrandBackdropOverlay {
                return BrandBackdropRenderer(overlay: overlay)
            }

            let role = overlayRoles[ObjectIdentifier(overlay as AnyObject)]
            if let polygon = overlay as? MKPolygon {
                let renderer = MKPolygonRenderer(polygon: polygon)
                applyStyle(role: role, renderer: renderer)
                if role == .focusedState {
                    focusedRenderers[ObjectIdentifier(overlay as AnyObject)] = renderer
                }
                return renderer
            }
            if let multiPolygon = overlay as? MKMultiPolygon {
                let renderer = MKMultiPolygonRenderer(multiPolygon: multiPolygon)
                applyStyle(role: role, renderer: renderer)
                if role == .focusedState {
                    focusedRenderers[ObjectIdentifier(overlay as AnyObject)] = renderer
                }
                return renderer
            }
            if let polyline = overlay as? MKPolyline {
                let renderer = MKPolylineRenderer(polyline: polyline)
                applyStyle(role: role, renderer: renderer)
                return renderer
            }

            return MKOverlayRenderer(overlay: overlay)
        }

        private func applyStyle(role: OverlayRole?, renderer: MKOverlayPathRenderer) {
            switch role {
            case .worldLand:
                renderer.fillColor = USStateOverlayStyle.foreignLandFill
                renderer.strokeColor = USStateOverlayStyle.foreignLandFill
                renderer.lineWidth = 1.6
                renderer.lineJoin = .round
                renderer.lineCap = .round
            case .nationalState:
                renderer.fillColor = USStateOverlayStyle.nationalStateFill
                renderer.strokeColor = USStateOverlayStyle.nationalStateBorder.withAlphaComponent(0.92)
                renderer.lineWidth = 1.15
            case .backgroundStateBorder:
                renderer.fillColor = USStateOverlayStyle.nationalStateFill.withAlphaComponent(0.95)
                renderer.strokeColor = USStateOverlayStyle.mutedStateBorder.withAlphaComponent(0.96)
                renderer.lineWidth = 1.45
            case .focusedState:
                let progress = max(0.0, min(1.0, focusedFillProgress))
                renderer.fillColor = USStateOverlayStyle.brandBlue.withAlphaComponent(progress)
                renderer.strokeColor = USStateOverlayStyle.brandRed.withAlphaComponent(progress)
                renderer.lineWidth = 2.8
            case .none:
                renderer.fillColor = .clear
                renderer.strokeColor = .clear
                renderer.lineWidth = 0
            }
        }

        private func scheduleFocusedFillFadeIfNeeded() {
            guard pendingFocusedFillFade else { return }
            pendingFocusedFillFade = false

            focusedFillFadeToken += 1
            let token = focusedFillFadeToken
            let duration: Double = 0.55
            let steps = 14

            updateFocusedRendererStyles()

            for step in 1...steps {
                let delay = duration * Double(step) / Double(steps)
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                    guard let self, self.focusedFillFadeToken == token else { return }
                    self.focusedFillProgress = CGFloat(step) / CGFloat(steps)
                    self.updateFocusedRendererStyles()
                }
            }
        }

        private func updateFocusedRendererStyles() {
            for renderer in focusedRenderers.values {
                applyStyle(role: .focusedState, renderer: renderer)
                renderer.setNeedsDisplay()
            }
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard !(annotation is MKUserLocation) else { return nil }

            if let flag = annotation as? StateFlagAnnotation {
                // Use a state-specific reuse identifier so a previous state's flag image
                // is never reused for a newly selected state.
                let identifier = "myRepsStateFlag-\(flag.stateCode)"
                let annotationView: MKAnnotationView
                if let reused = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) {
                    annotationView = reused
                    annotationView.annotation = annotation
                } else {
                    annotationView = MKAnnotationView(annotation: annotation, reuseIdentifier: identifier)
                    annotationView.canShowCallout = false
                    annotationView.displayPriority = .required
                    annotationView.centerOffset = CGPoint(x: 0, y: -12)
                }

                if let asset = StateFlagCatalog.assetName(for: flag.stateCode),
                   let flagImage = UIImage(named: asset) {
                    annotationView.image = plainFlagImage(from: flagImage)
                } else {
                    annotationView.image = nil
                }
                annotationView.alpha = 1
                annotationView.layer.shadowOpacity = 0
                return annotationView
            }

            if annotation is BrandedLocationAnnotation {
                let identifier = "myRepsBrandedPin"
                let annotationView: MKAnnotationView
                if let reused = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) {
                    annotationView = reused
                    annotationView.annotation = annotation
                } else {
                    annotationView = MKAnnotationView(annotation: annotation, reuseIdentifier: identifier)
                    // Avoid callout activation sound when tapping around state overlays.
                    annotationView.canShowCallout = false
                    annotationView.displayPriority = .required
                    annotationView.centerOffset = CGPoint(x: 0, y: -16)
                    annotationView.image = brandedPinImage()
                }
                return annotationView
            }

            return nil
        }

        func mapView(_ mapView: MKMapView, didAdd views: [MKAnnotationView]) {
            for annotationView in views {
                guard let flag = annotationView.annotation as? StateFlagAnnotation else { continue }
                guard flag.shouldFadeInOnAdd else { continue }
                annotationView.alpha = 0
                UIView.animate(
                    withDuration: 0.32,
                    delay: 0.05,
                    options: [.beginFromCurrentState, .curveEaseInOut],
                    animations: {
                        annotationView.alpha = 1
                    }
                )
            }
        }

        private func brandedPinImage() -> UIImage {
            let size = CGSize(width: 28, height: 38)
            let format = UIGraphicsImageRendererFormat.default()
            format.opaque = false
            format.scale = UIScreen.main.scale
            let renderer = UIGraphicsImageRenderer(size: size, format: format)

            return renderer.image { _ in
                let circleRect = CGRect(x: 4, y: 2, width: 20, height: 20)
                let circlePath = UIBezierPath(ovalIn: circleRect)
                USStateOverlayStyle.brandRed.setFill()
                circlePath.fill()

                USStateOverlayStyle.darkNavy.setStroke()
                circlePath.lineWidth = 2
                circlePath.stroke()

                let centerDot = UIBezierPath(ovalIn: CGRect(x: 11, y: 9, width: 6, height: 6))
                UIColor.white.setFill()
                centerDot.fill()

                let pointerPath = UIBezierPath()
                pointerPath.move(to: CGPoint(x: 11, y: 21))
                pointerPath.addLine(to: CGPoint(x: size.width / 2, y: 35))
                pointerPath.addLine(to: CGPoint(x: 17, y: 21))
                pointerPath.close()
                USStateOverlayStyle.brandRed.setFill()
                pointerPath.fill()

                let pointerStroke = UIBezierPath()
                pointerStroke.move(to: CGPoint(x: 11, y: 21))
                pointerStroke.addLine(to: CGPoint(x: size.width / 2, y: 35))
                pointerStroke.addLine(to: CGPoint(x: 17, y: 21))
                pointerStroke.lineWidth = 1.5
                pointerStroke.lineJoinStyle = .round
                USStateOverlayStyle.darkNavy.setStroke()
                pointerStroke.stroke()
            }
        }

        private func plainFlagImage(from image: UIImage) -> UIImage {
            let flagSize = CGSize(width: 40, height: 26)
            let format = UIGraphicsImageRendererFormat.default()
            format.opaque = false
            format.scale = UIScreen.main.scale
            let renderer = UIGraphicsImageRenderer(size: flagSize, format: format)
            return renderer.image { _ in
                let flagRect = CGRect(origin: .zero, size: flagSize)
                let cornerRadius: CGFloat = 3.5

                let flagPath = UIBezierPath(roundedRect: flagRect, cornerRadius: cornerRadius)
                flagPath.addClip()
                image.draw(in: flagRect)
            }
        }
    }
}
