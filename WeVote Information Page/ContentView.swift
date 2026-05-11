//
//
//
//  ContentView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 3/30/25.
//  Updated by ChatGPT on 05/23/25 (expanded TabView & added repsVM injection)
//

import CivicaDesignSystem
import CoreLocation
import OSLog
import StoreKit
import SwiftUI
import UIKit

// MARK: – Safe-Indexing Helper
extension Collection {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

// MARK: – Date Helper
extension Date {
    static func from(_ string: String, format: String = "yyyy-MM-dd") -> Date? {
        let fmt = DateFormatter()
        fmt.dateFormat = format
        fmt.timeZone   = .current
        return fmt.date(from: string)
    }
}

struct MidtermElectionBundleRecord: Decodable {
    let state_name: String
    let state_code: String
    let primary_date: String?
    let primary_runoff_date: String?
    let general_election_date: String?
    let registration_deadline_primary: String?
    let registration_deadline_general: String?
    let registration_notes: String?
    let early_voting_primary: String?
    let early_voting_primary_runoff: String?
    let early_voting_general: String?
    let primary_source: String?
}

final class MidtermElectionBundleStore {
    static let shared = MidtermElectionBundleStore()

    private let queue = DispatchQueue(label: "com.civica.midtermElectionBundleStore", qos: .userInitiated)
    private var cachedRecords: [MidtermElectionBundleRecord]?
    private var isLoading = false
    private var pendingCompletions: [([MidtermElectionBundleRecord]) -> Void] = []

    private static let logger = Logger(subsystem: "Civica", category: "MidtermElectionBundleStore")

    private init() {}

    func loadRecordsIfNeeded(completion: @escaping ([MidtermElectionBundleRecord]) -> Void) {
        queue.async {
            if let cachedRecords = self.cachedRecords {
                DispatchQueue.main.async {
                    completion(cachedRecords)
                }
                return
            }

            self.pendingCompletions.append(completion)
            guard !self.isLoading else { return }
            self.isLoading = true

            let loadedRecords = Self.loadRecordsFromBundle()
            self.cachedRecords = loadedRecords
            self.isLoading = false
            let completions = self.pendingCompletions
            self.pendingCompletions.removeAll()

            DispatchQueue.main.async {
                completions.forEach { completion in
                    completion(loadedRecords)
                }
            }
        }
    }

    func records() async -> [MidtermElectionBundleRecord] {
        await withCheckedContinuation { continuation in
            loadRecordsIfNeeded { records in
                continuation.resume(returning: records)
            }
        }
    }

    private static func loadRecordsFromBundle() -> [MidtermElectionBundleRecord] {
        guard let url = Bundle.main.url(forResource: "USMidterm2026ElectionDates", withExtension: "json") else {
            logger.error("USMidterm2026ElectionDates.json missing from bundle.")
            #if DEBUG
            assertionFailure("USMidterm2026ElectionDates.json missing from bundle.")
            #endif
            return []
        }
        guard let data = try? Data(contentsOf: url) else {
            logger.error("Unable to read USMidterm2026ElectionDates.json from bundle.")
            return []
        }
        guard let records = try? JSONDecoder().decode([MidtermElectionBundleRecord].self, from: data) else {
            logger.error("Unable to decode USMidterm2026ElectionDates.json.")
            return []
        }
        return records
    }
}

// MARK: – Bottom-Tab Enum
enum Tab: CaseIterable {
    case myReps
    case callYourReps
    case electionTimeline
    case registration

    var iconName: String {
        switch self {
        case .myReps:             return "person.3.fill"
        case .callYourReps:       return "phone.fill"
        case .electionTimeline:   return "calendar"
        case .registration:       return "person.badge.plus"
        }
    }
}

// MARK: – Root Content View
struct ContentView: View {
    private enum ElectionDeepLinkResolution {
        case found(Election)
        case notFound
    }

    @Environment(\.requestReview) private var requestReview
    @EnvironmentObject private var planVM: PlanViewModel
    @EnvironmentObject private var repsVM: MyRepsViewModel
    @EnvironmentObject private var authStore: AuthStore
    @StateObject private var mapvPlanStore = MAPVPlanStore.shared
    @StateObject private var reviewPromptManager = ReviewPromptManager.shared
    @Environment(\.scenePhase) private var scenePhase
    private let zipStateResolver = USZipStateResolver()
    private let launchOverlayMinimumDuration: TimeInterval = 1.0
    private let launchOverlayMaximumDurationNoTap: TimeInterval = 6.0

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

    @State private var selectedTab        = Tab.myReps
    @State private var showCivicScorecard = false
    @State private var showRegReminder    = false
    @State private var showMyInfoPanel    = false
    @State private var myInfoFocusLanguageSection = false
    @State private var selectedElection: Election?
    @State private var showLaunchOverlay  = true
    @State private var showWhyVoteOverlay = false
    @State private var whyVoteTapOriginInSpreadSpace: CGPoint?
    @State private var launchOverlayStartedAt = Date()
    @State private var launchOverlayTimeoutTask: Task<Void, Never>?
    @State private var isMidtermBundleReady = false
    @State private var launchReadinessTimedOut = false
    @State private var deepLinkAlertMessage: String?

    private var loadingZip: String? {
        let primary = String(planVM.zip.filter(\.isNumber).prefix(5))
        if primary.count == 5 { return primary }
        let fallback = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
        return fallback.count == 5 ? fallback : nil
    }

    private var loadingStateName: String? {
        let enteredState = planVM.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines)
        if !enteredState.isEmpty {
            if enteredState.count == 2 {
                let code = enteredState.uppercased()
                return Self.stateCodeToName[code] ?? code
            }
            return enteredState
        }

        if let zip = loadingZip,
           let stateCode = zipStateResolver.stateCode(for: zip) {
            return Self.stateCodeToName[stateCode] ?? stateCode
        }
        return nil
    }

    private var launchOverlayStatusMessage: String? {
        guard launchReadinessTimedOut, !isLaunchReadyForDismissal else { return nil }
        return "Still loading your secure session and election data..."
    }

    private func handleElectionDeepLink(_ url: URL) {
        selectedTab = .electionTimeline
        Task { @MainActor in
            switch await resolveElectionFromDeepLink(url) {
            case .found(let election):
                selectedElection = election
            case .notFound:
                selectedElection = nil
                deepLinkAlertMessage = "Couldn’t find this shared election. Please refresh your timeline and try again."
            }
        }
    }

    private var isLaunchReadyForDismissal: Bool {
        !authStore.isLoading && isMidtermBundleReady
    }

    private func dismissLaunchOverlayIfNeeded(force: Bool = false) {
        guard showLaunchOverlay else { return }
        let elapsed = Date().timeIntervalSince(launchOverlayStartedAt)
        let minimumElapsed = elapsed >= launchOverlayMinimumDuration
        guard force || (minimumElapsed && isLaunchReadyForDismissal) else { return }

        launchOverlayTimeoutTask?.cancel()
        launchOverlayTimeoutTask = nil
        withAnimation(.easeOut(duration: 0.3)) {
            showLaunchOverlay = false
        }
    }

    private func scheduleLaunchOverlayFallbackTimeout() {
        launchOverlayTimeoutTask?.cancel()
        launchOverlayTimeoutTask = Task { @MainActor in
            let nanoseconds = UInt64(launchOverlayMaximumDurationNoTap * 1_000_000_000)
            try? await Task.sleep(nanoseconds: nanoseconds)
            launchReadinessTimedOut = true
            dismissLaunchOverlayIfNeeded()
        }
    }

    private func resolveElectionFromDeepLink(_ url: URL) async -> ElectionDeepLinkResolution {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return .notFound
        }

        var query: [String: String] = [:]
        for item in components.queryItems ?? [] {
            if let value = item.value {
                query[item.name] = value
            }
        }

        let targetElectionID = query["eid"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        let targetStateCode = query["state"]?.uppercased()
        let targetType = query["type"]?.uppercased()
        let targetDay = Self.deepLinkDateFormatter.date(from: query["day"] ?? "")
        let hasSearchFilters = (targetElectionID?.isEmpty == false) || (targetStateCode?.isEmpty == false) || (targetType?.isEmpty == false) || targetDay != nil

        var candidates: [Election] = planVM.upcomingElections
        if let targetStateCode, !targetStateCode.isEmpty {
            let records = await MidtermElectionBundleStore.shared.records()
            let bundled = buildTimelineElections(for: targetStateCode, records: records)
            candidates = mergedElections(candidates, bundled)
        }

        if let targetElectionID, !targetElectionID.isEmpty,
           let exact = candidates.first(where: { $0.id == targetElectionID }) {
            return .found(exact)
        }

        var filtered = candidates
        if let targetStateCode, !targetStateCode.isEmpty {
            filtered = filtered.filter { election in
                stateCode(for: election)?.uppercased() == targetStateCode
            }
        }

        if let targetType, !targetType.isEmpty, let targetDay {
            if let exactMatch = filtered.first(where: { election in
                electionTypeToken(for: election) == targetType &&
                    Calendar.current.isDate(election.electionDay, inSameDayAs: targetDay)
            }) {
                return .found(exactMatch)
            }
        }

        if let targetDay {
            if let dayMatch = filtered.first(where: { election in
                Calendar.current.isDate(election.electionDay, inSameDayAs: targetDay)
            }) {
                return .found(dayMatch)
            }
        }

        if let targetType, !targetType.isEmpty {
            if let typeMatch = filtered.first(where: { electionTypeToken(for: $0) == targetType }) {
                return .found(typeMatch)
            }
        }

        guard hasSearchFilters else { return .notFound }
        return .notFound
    }

    private func mergedElections(_ lhs: [Election], _ rhs: [Election]) -> [Election] {
        var byID: [String: Election] = [:]
        for election in lhs + rhs {
            byID[election.id] = election
        }
        return Array(byID.values)
    }

    private func stateCode(for election: Election) -> String? {
        election.flags.first(where: { $0.hasPrefix("STATE_CODE:") })?
            .replacingOccurrences(of: "STATE_CODE:", with: "")
    }

    private func electionTypeToken(for election: Election) -> String {
        if let raw = election.flags
            .first(where: { $0.hasPrefix("ELECTION_TYPE:") })?
            .replacingOccurrences(of: "ELECTION_TYPE:", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !raw.isEmpty {
            return raw.uppercased()
        }

        let subtitle = election.subtitle.lowercased()
        if subtitle.contains("runoff") { return "PRIMARY_RUNOFF" }
        if subtitle.contains("primary") { return "PRIMARY" }
        if subtitle.contains("general") { return "GENERAL" }
        return "ELECTION"
    }

    private func buildTimelineElections(for stateCode: String, records: [MidtermElectionBundleRecord]) -> [Election] {
        guard let record = records.first(where: { $0.state_code.uppercased() == stateCode.uppercased() }) else {
            return []
        }

        let stateName = record.state_name
        let midtermName = "\(stateName) 2026 Midterm"
        let presidentialName = "\(stateName) 2028 Presidential"
        var built: [Election] = []

        func appendElection(
            electionName: String,
            electionType: String,
            subtitle: String,
            electionDateISO: String?,
            registrationISO: String?,
            earlyVotingISO: String?
        ) {
            guard let electionDate = Self.deepLinkDateFormatter.date(from: electionDateISO ?? "") else { return }
            let registrationDate = Self.deepLinkDateFormatter.date(from: registrationISO ?? "") ?? electionDate
            let earlyVotingDate = Self.deepLinkDateFormatter.date(from: earlyVotingISO ?? "")
            let earlyVotingText = timelineDisplayText(from: earlyVotingISO, fallbackDate: earlyVotingDate)
            let registrationText = timelineDisplayText(from: registrationISO, fallbackDate: registrationDate)

            built.append(
                Election(
                    name: electionName,
                    subtitle: subtitle,
                    registrationDeadline: registrationDate,
                    startDate: earlyVotingDate ?? electionDate,
                    electionDay: electionDate,
                    earlyVotingText: earlyVotingText,
                    registrationNotes: record.registration_notes,
                    jurisdictionLevel: "statewide",
                    jurisdictionName: stateName,
                    visibility: "public",
                    flags: [
                        "STATE_CODE:\(stateCode.uppercased())",
                        "ELECTION_TYPE:\(electionType)",
                        "REGISTRATION_DEADLINE_TEXT:\(registrationText)"
                    ],
                    matchConfidence: nil,
                    sourceUrl: record.primary_source
                )
            )
        }

        appendElection(
            electionName: midtermName,
            electionType: "PRIMARY",
            subtitle: "Primary Election",
            electionDateISO: record.primary_date,
            registrationISO: record.registration_deadline_primary,
            earlyVotingISO: record.early_voting_primary
        )

        appendElection(
            electionName: midtermName,
            electionType: "PRIMARY_RUNOFF",
            subtitle: "Primary Runoff Election",
            electionDateISO: record.primary_runoff_date,
            registrationISO: record.registration_deadline_primary,
            earlyVotingISO: record.early_voting_primary_runoff ?? record.early_voting_primary
        )

        appendElection(
            electionName: midtermName,
            electionType: "GENERAL",
            subtitle: "General Election",
            electionDateISO: record.general_election_date,
            registrationISO: record.registration_deadline_general,
            earlyVotingISO: record.early_voting_general
        )

        appendElection(
            electionName: presidentialName,
            electionType: "PRESIDENTIAL_PRIMARY",
            subtitle: "Presidential Primary Election",
            electionDateISO: Self.shiftedISOYear(from: record.primary_date, toYear: 2028) ?? Self.fallbackPresidentialPrimaryISO,
            registrationISO: "TBD for 2028 cycle",
            earlyVotingISO: "TBD for 2028 cycle"
        )

        appendElection(
            electionName: presidentialName,
            electionType: "PRESIDENTIAL_GENERAL",
            subtitle: "Presidential General Election",
            electionDateISO: "2028-11-07",
            registrationISO: "TBD for 2028 cycle",
            earlyVotingISO: "TBD for 2028 cycle"
        )

        return built
    }

    private func timelineDisplayText(from rawISO: String?, fallbackDate: Date?) -> String {
        let trimmed = rawISO?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if Self.deepLinkDateFormatter.date(from: trimmed) != nil {
            return trimmed
        }
        if !trimmed.isEmpty {
            return trimmed
        }
        if let fallbackDate {
            return Self.deepLinkDateFormatter.string(from: fallbackDate)
        }
        return "Not listed"
    }

    private static let deepLinkDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let fallbackPresidentialPrimaryISO = "2028-03-07"

    private static func shiftedISOYear(from sourceISO: String?, toYear: Int) -> String? {
        guard let sourceDate = deepLinkDateFormatter.date(from: sourceISO ?? "") else { return nil }
        let calendar = Calendar(identifier: .gregorian)
        var components = calendar.dateComponents(in: TimeZone(secondsFromGMT: 0) ?? .current, from: sourceDate)
        components.year = toYear
        guard let shiftedDate = calendar.date(from: components) else { return nil }
        return deepLinkDateFormatter.string(from: shiftedDate)
    }

    private func handleIncomingLink(_ url: URL) {
        let scheme = url.scheme?.lowercased() ?? ""
        if scheme == "civica" || scheme == "votenow" {
            handleAppDeepLink(url)
            return
        }

        if scheme == "https" || scheme == "http" {
            handleWebShareLink(url)
        }
    }

    private func handleAppDeepLink(_ url: URL) {
        let host = url.host?.lowercased() ?? ""
        let path = url.path.lowercased()

        if host == "mapv" || path.contains("mapv") {
            // MAPV deep links are parked for this launch; route to Voting Steps instead.
            selectedTab = .registration
        } else if host == "directions" || path.contains("directions") {
            // Parking directions MAPV entry alongside other MAPV routes for now.
            selectedTab = .registration
        } else if host == "election" || path.contains("election") {
            handleElectionDeepLink(url)
        } else if host == "registration" || path.contains("registration") {
            selectedTab = .registration
        } else if host == "civic" || path.contains("civic") {
            selectedTab = .myReps
        }
    }

    private func handleWebShareLink(_ url: URL) {
        guard let host = url.host?.lowercased(), host == "votenow.app" || host == "www.votenow.app" else {
            return
        }

        let path = url.path.lowercased()
        guard path.hasPrefix("/share") else { return }

        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let target = components?.queryItems?.first(where: { $0.name == "target" })?.value?.lowercased()
        let pathParts = path.split(separator: "/").map(String.init)
        let cardType = pathParts.count >= 2 ? pathParts[1] : nil
        let resolvedTarget = target ?? cardType

        switch resolvedTarget {
        case "election":
            handleElectionDeepLink(url)
        case "registration":
            selectedTab = .registration
        case "mapv":
            // MAPV share links are parked for this launch.
            selectedTab = .registration
        case "civic":
            selectedTab = .myReps
        default:
            selectedTab = .myReps
        }
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            // 1. My Reps
            MyRepsView()
                .tabItem {
                    Label {
                        Text("app.tab.my_reps", tableName: "AppShell")
                    } icon: {
                        Image(systemName: Tab.myReps.iconName)
                    }
                }
                .tag(Tab.myReps)

            // 2. Call Your Reps
            CallYourRepsTabView()
                .tabItem {
                    Image(uiImage: CivicaLogoIcon.tabBarBarsUIImage)
                        .renderingMode(.original)
                    Text("Call Your Reps")
                }
                .tag(Tab.callYourReps)

            // 3. Election Timeline
            ElectionTimelineView()
                .tabItem {
                    Label {
                        Text("app.tab.election_timeline", tableName: "AppShell")
                    } icon: {
                        Image(systemName: Tab.electionTimeline.iconName)
                    }
                }
                .tag(Tab.electionTimeline)

            // 4. Registration
            VoterRegistrationView()
                .tabItem {
                    Label {
                        Text("app.tab.registration", tableName: "AppShell")
                    } icon: {
                        Image(systemName: Tab.registration.iconName)
                    }
                }
                .tag(Tab.registration)
        }
        .environmentObject(mapvPlanStore)
        .coordinateSpace(name: "SpreadSpace")
        .tint(CivicaColors.brickPrimary)
        .overlay {
            if showWhyVoteOverlay {
                WhyVoteFloodOverlay(
                    isPresented: $showWhyVoteOverlay,
                    originInSpreadSpace: whyVoteTapOriginInSpreadSpace
                )
                    .environmentObject(planVM)
                    .environmentObject(repsVM)
                    .zIndex(900)
            }
        }
        .overlay {
            if showLaunchOverlay {
                LoadingView(
                    selectedStateName: loadingStateName,
                    selectedZip: loadingZip,
                    statusMessage: launchOverlayStatusMessage,
                    onTapDismiss: {
                        dismissLaunchOverlayIfNeeded()
                    }
                )
                    .transition(.opacity)
                    .zIndex(1000)
            }
        }
        .ignoresSafeArea(edges: .bottom)
        .onAppear {
            DispatchQueue.main.async {
                mapvPlanStore.bootstrapFromLegacyPlanViewModel(planVM)
                mapvPlanStore.refreshLiveActivity()

                launchOverlayStartedAt = Date()
                launchReadinessTimedOut = false
                scheduleLaunchOverlayFallbackTimeout()
                MidtermElectionBundleStore.shared.loadRecordsIfNeeded { _ in
                    isMidtermBundleReady = true
                    dismissLaunchOverlayIfNeeded()
                }
            }
        }
        .onDisappear {
            launchOverlayTimeoutTask?.cancel()
            launchOverlayTimeoutTask = nil
        }
        .onChange(of: authStore.isLoading) { _, _ in
            dismissLaunchOverlayIfNeeded()
        }
        .onChange(of: isMidtermBundleReady) { _, _ in
            dismissLaunchOverlayIfNeeded()
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            DispatchQueue.main.async {
                mapvPlanStore.bootstrapFromLegacyPlanViewModel(planVM)
                mapvPlanStore.refreshLiveActivity()
            }
        }
        .onOpenURL { url in
            handleIncomingLink(url)
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleWhyVoteOverlay)) { notification in
            DispatchQueue.main.async {
                let userInfo = notification.userInfo
                if let x = userInfo?["originX"] as? CGFloat,
                   let y = userInfo?["originY"] as? CGFloat {
                    whyVoteTapOriginInSpreadSpace = CGPoint(x: x, y: y)
                } else if let x = userInfo?["originX"] as? Double,
                          let y = userInfo?["originY"] as? Double {
                    whyVoteTapOriginInSpreadSpace = CGPoint(x: x, y: y)
                }

                guard !showWhyVoteOverlay else { return }
                showWhyVoteOverlay = true
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .openHowToVoteMailInBallot)) { _ in
            DispatchQueue.main.async {
                selectedTab = .registration
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .openVotingStepsTab)) { _ in
            DispatchQueue.main.async {
                selectedTab = .registration
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .openMyInfoPanel)) { notification in
            DispatchQueue.main.async {
                let requestedSection = (notification.userInfo?["section"] as? String)?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .lowercased()
                myInfoFocusLanguageSection = requestedSection == "language"
                showMyInfoPanel = true
            }
        }

        .sheet(isPresented: $showMyInfoPanel, onDismiss: {
            myInfoFocusLanguageSection = false
        }) {
            MyInfoPanelView(focusLanguageSection: myInfoFocusLanguageSection)
                .environmentObject(planVM)
                .environmentObject(repsVM)
        }
        // Civic Scorecard sheet
        .sheet(isPresented: $showCivicScorecard) {
            CivicScorecardView()
                .environmentObject(planVM)
        }

        // Registration reminder sheet
        .sheet(isPresented: $showRegReminder) {
            VoterRegistrationReminderView(selectedTab: $selectedTab)
                .environmentObject(planVM)
        }

        // Election detail sheet
        .sheet(item: $selectedElection) { election in
            ElectionTabView(election: election)
                .environmentObject(planVM)
        }
        .sheet(
            isPresented: Binding(
                get: { reviewPromptManager.isPrePromptPresented },
                set: { isPresented in
                    if !isPresented, reviewPromptManager.isPrePromptPresented {
                        reviewPromptManager.handleNotNowTapped()
                    }
                }
            )
        ) {
            ReviewPromptView(
                onRateApp: {
                    reviewPromptManager.handleRateTapped()
                    requestReview()
                },
                onNotNow: {
                    reviewPromptManager.handleNotNowTapped()
                }
            )
        }
        .alert(
            "Election Link Unavailable",
            isPresented: Binding(
                get: { deepLinkAlertMessage != nil },
                set: { presented in
                    if !presented { deepLinkAlertMessage = nil }
                }
            )
        ) {
            Button("OK", role: .cancel) {
                deepLinkAlertMessage = nil
            }
        } message: {
            Text(deepLinkAlertMessage ?? "")
        }

    }
}
private struct CallYourRepsTabView: View {
    @EnvironmentObject private var planVM: PlanViewModel
    @EnvironmentObject private var repsVM: MyRepsViewModel
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var locationProbe = CallTabLocationProbe()
    private let zipStateResolver = USZipStateResolver()

    private var normalizedZip: String {
        // Prioritize ZIP derived from the explicit address fields.
        let addressZip = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
        if addressZip.count == 5 { return addressZip }

        // Next prefer ZIP resolved from geocoded address selection.
        let resolvedAddressZip = String((repsVM.resolvedLocationSelection?.postalCode ?? "").filter(\.isNumber).prefix(5))
        if resolvedAddressZip.count == 5 { return resolvedAddressZip }

        let fallback = String(planVM.zip.filter(\.isNumber).prefix(5))
        return fallback.count == 5 ? fallback : ""
    }

    private var issueCallAddressLine: String {
        let city = issueCallLocationCity
        let state = issueCallLocationStateCode
        let zip = normalizedZip

        if !city.isEmpty, let state, !zip.isEmpty {
            return "\(city), \(state) (\(zip))"
        }
        if !city.isEmpty, let state {
            return "\(city), \(state)"
        }
        if let state, !zip.isEmpty {
            return "\(state) (\(zip))"
        }
        if !zip.isEmpty {
            return zip
        }
        if let state {
            return state
        }

        return planVM.homeAddress.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var issueCallLocationCity: String {
        let resolvedCity = repsVM.resolvedLocationSelection?.city?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !resolvedCity.isEmpty { return resolvedCity }
        return planVM.userAddress.city.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var issueCallLocationStateCode: String? {
        if let resolved = normalizedUSStateCode(from: repsVM.resolvedStateCode) {
            return resolved
        }
        if let detected = normalizedUSStateCode(from: repsVM.detectedStateCode) {
            return detected
        }
        if let entered = normalizedUSStateCode(from: planVM.userAddress.state) {
            return entered
        }
        if !normalizedZip.isEmpty {
            return zipStateResolver.stateCode(for: normalizedZip)
        }
        return nil
    }

    private var residencyNotice: String {
        guard let deviceCoordinate = locationProbe.coordinate else {
            return ""
        }

        let selectedCoordinate: CLLocationCoordinate2D?
        if let selection = repsVM.resolvedLocationSelection {
            selectedCoordinate = CLLocationCoordinate2D(latitude: selection.latitude, longitude: selection.longitude)
        } else {
            selectedCoordinate = repsVM.resolvedCoordinate
        }

        guard let selectedCoordinate else {
            return ""
        }

        let selected = CLLocation(latitude: selectedCoordinate.latitude, longitude: selectedCoordinate.longitude)
        let current = CLLocation(latitude: deviceCoordinate.latitude, longitude: deviceCoordinate.longitude)
        let miles = current.distance(from: selected) / 1609.344
        guard miles.isFinite, miles >= 50 else { return "" }

        let roundedMiles = Int(miles.rounded())
        return "You appear to be ~\(roundedMiles) miles from your selected address. Representation is based on your residence."
    }

    private var callRepsContextKey: String {
        let stateCode = repsVM.resolvedStateCode?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased() ?? "NA"
        let repSignature = repsVM.federalReps
            .map { officialContextKey(for: $0) }
            .joined(separator: "|")
        return "\(stateCode)#\(repSignature)"
    }

    private func officialContextKey(for official: Official) -> String {
        let name = official.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let division = (official.divisionId ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let officeTitle = (official.officeTitle ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        return "\(name)::\(division)::\(officeTitle)"
    }

    var body: some View {
        NavigationStack {
            IssueCallCenterView(
                federalReps: repsVM.federalReps,
                userZip: normalizedZip,
                userAddressLine: issueCallAddressLine,
                residencyNotice: residencyNotice,
                initialTab: .examples,
                showsReturnHomeButton: false,
                hidesTabBar: false
            )
            .id(callRepsContextKey)
        }
        .onAppear {
            locationProbe.requestLocationIfNeeded()
            if repsVM.federalReps.isEmpty, !normalizedZip.isEmpty {
                repsVM.fetchReps(for: normalizedZip)
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard newPhase == .active else { return }
            locationProbe.requestLocationIfNeeded(force: true)
        }
    }
}

private final class CallTabLocationProbe: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var coordinate: CLLocationCoordinate2D?

    private let manager = CLLocationManager()
    private var didRequest = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyThreeKilometers
    }

    func requestLocationIfNeeded(force: Bool = false) {
        if coordinate == nil, let lastKnown = manager.location?.coordinate {
            coordinate = lastKnown
        }

        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            guard force || !didRequest || coordinate == nil else { return }
            didRequest = true
            manager.requestLocation()
        case .notDetermined:
            guard !didRequest else { return }
            didRequest = true
            manager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            break
        @unknown default:
            break
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            manager.requestLocation()
        default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        coordinate = locations.last?.coordinate
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError _: Error) {}
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(PlanViewModel())
            .environmentObject(MyRepsViewModel())
            .environmentObject(AuthStore(startListening: false))
    }
}
