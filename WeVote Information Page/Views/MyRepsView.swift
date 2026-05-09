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
                                .font(.subheadline.weight(.semibold))
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
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
                .padding(.trailing, 10)
                .accessibilityLabel(l("app.reps.action.clear_location", "Clear location"))
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
                .font(.callout.weight(.semibold))
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
                    VStack(spacing: 4) {
                        matchedSummaryPill
                        Text(l("app.reps.coverage.pill_caption", "Your federal, state, and local representatives"))
                            .font(.caption2.weight(.medium))
                            .foregroundColor(VoteNowColors.mutedText)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.bottom, 8)
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
                title: l("app.reps.error_title", "We couldn't load your representatives"),
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

struct MyRepsView_Previews: PreviewProvider {
    static var previews: some View {
        MyRepsView()
            .environmentObject(PlanViewModel())
            .environmentObject(MyRepsViewModel())
    }
}
