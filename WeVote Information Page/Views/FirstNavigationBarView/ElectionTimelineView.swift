import SwiftUI
import UIKit
import OSLog

private struct MidtermStateElectionRecord: Decodable {
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
    let registration_source: String?
}

private struct ElectionEligibilityStateSummary: Decodable {
    let state: String
    let state_abbr: String
    let state_primary_type_2026: String
    let presidential_primary_type_2026: String
    let independent_primary_note: String?
}

private struct ElectionEligibilityTimelineRow: Decodable {
    let dataset_key: String
    let state: String
    let state_abbr: String
    let office_family: String
    let election_stage: String
    let party: String
    let dropdown_label: String
    let eligibility_summary: String
    let primary_type_applied: String
    let on_ballot_in_2026_cycle: String
    let on_ballot_in_2028_cycle: String
    let cycle_rule: String?
}

private struct ElectionEligibilityDataset: Decodable {
    let state_summary: [ElectionEligibilityStateSummary]
    let timeline_dataset: [ElectionEligibilityTimelineRow]
}

private struct TopCityMayoralCycleRecord: Decodable {
    let rank: Int?
    let city: String
    let state_name: String
    let census_geographic_area: String?
    let population_est_2024: Int?
    let next_election_year: Int?
    let next_primary_date_iso: String?
    let next_general_date_iso: String?
    let next_runoff_date_iso: String?
    let date_status: String?
    let cycle_notes: String?
    let sources: [String]
}

private struct TimelineCardFramesPreferenceKey: PreferenceKey {
    static var defaultValue: [String: CGRect] = [:]

    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        value.merge(nextValue(), uniquingKeysWith: { _, new in new })
    }
}

private struct TimelineViewportPreferenceKey: PreferenceKey {
    static var defaultValue: CGRect = .zero

    static func reduce(value: inout CGRect, nextValue: () -> CGRect) {
        value = nextValue()
    }
}

enum ElectionTimelineDataDiagnostics {
    static var onLoadFailure: ((_ resource: String, _ reason: String) -> Void)?
    private static let logger = Logger(subsystem: "Civica", category: "ElectionTimelineData")

    static func reportLoadFailure(resource: String, reason: String) {
        logger.error("Bundle fallback triggered for \(resource, privacy: .public): \(reason, privacy: .public)")
        #if DEBUG
        assertionFailure("ElectionTimeline data load fallback for \(resource): \(reason)")
        #endif
        onLoadFailure?(resource, reason)
    }
}

private final class ElectionTimelineBundleLoader {
    static let shared = ElectionTimelineBundleLoader()

    private let queue = DispatchQueue(
        label: "com.civica.electionTimeline.bundleLoader",
        qos: .userInitiated
    )
    private var cachedEligibilityDataset: ElectionEligibilityDataset?
    private var didLoadEligibilityDataset = false
    private var cachedMidtermElections: [Election]?
    private var cachedTopCityMayoralRecords: [TopCityMayoralCycleRecord]?
    private var eligibilityLoadFailureReason: String?
    private var topCityLoadFailureReason: String?
    private var midtermLoadFailureReason: String?

    private init() {}

    func loadInitialData(
        completion: @escaping (
            _ eligibilityDataset: ElectionEligibilityDataset?,
            _ elections: [Election],
            _ loadFailureMessage: String?
        ) -> Void
    ) {
        queue.async {
            self.resetLoadFailuresOnQueue()
            let dataset = self.loadEligibilityDatasetOnQueue()
            let topCityMayoralRecords = self.loadTopCityMayoralCycleRecordsOnQueue()
            let elections = self.loadMidtermElectionsOnQueue(topCityMayoralRecords: topCityMayoralRecords)
            let loadFailureMessage = self.currentFailureMessageOnQueue()
            DispatchQueue.main.async {
                completion(dataset, elections, loadFailureMessage)
            }
        }
    }

    private func resetLoadFailuresOnQueue() {
        eligibilityLoadFailureReason = nil
        topCityLoadFailureReason = nil
        midtermLoadFailureReason = nil
    }

    private func currentFailureMessageOnQueue() -> String? {
        if midtermLoadFailureReason != nil {
            return "We couldn’t load election dates right now. Please retry."
        }
        if topCityLoadFailureReason != nil {
            return "We couldn’t load mayor election data right now. Please retry."
        }
        if eligibilityLoadFailureReason != nil {
            return "We couldn’t load voter eligibility details right now. Please retry."
        }
        return nil
    }

    private func loadEligibilityDatasetOnQueue() -> ElectionEligibilityDataset? {
        if didLoadEligibilityDataset {
            return cachedEligibilityDataset
        }
        didLoadEligibilityDataset = true

        guard let url = Bundle.main.url(forResource: "ElectionEligibilityDataset", withExtension: "json") else {
            ElectionTimelineDataDiagnostics.reportLoadFailure(
                resource: "ElectionEligibilityDataset.json",
                reason: "missing bundle resource"
            )
            eligibilityLoadFailureReason = "missing bundle resource"
            cachedEligibilityDataset = nil
            return nil
        }
        guard let data = try? Data(contentsOf: url) else {
            ElectionTimelineDataDiagnostics.reportLoadFailure(
                resource: "ElectionEligibilityDataset.json",
                reason: "unable to read bundle data"
            )
            eligibilityLoadFailureReason = "unable to read bundle data"
            cachedEligibilityDataset = nil
            return nil
        }
        guard let decoded = try? JSONDecoder().decode(ElectionEligibilityDataset.self, from: data) else {
            ElectionTimelineDataDiagnostics.reportLoadFailure(
                resource: "ElectionEligibilityDataset.json",
                reason: "decode failure"
            )
            eligibilityLoadFailureReason = "decode failure"
            cachedEligibilityDataset = nil
            return nil
        }

        cachedEligibilityDataset = decoded
        return decoded
    }

    private func loadTopCityMayoralCycleRecordsOnQueue() -> [TopCityMayoralCycleRecord] {
        if let cachedTopCityMayoralRecords {
            return cachedTopCityMayoralRecords
        }

        guard let url = Bundle.main.url(forResource: "USTop150MayoralElectionCycles", withExtension: "json") else {
            ElectionTimelineDataDiagnostics.reportLoadFailure(
                resource: "USTop150MayoralElectionCycles.json",
                reason: "missing bundle resource"
            )
            topCityLoadFailureReason = "missing bundle resource"
            cachedTopCityMayoralRecords = []
            return []
        }
        guard let data = try? Data(contentsOf: url) else {
            ElectionTimelineDataDiagnostics.reportLoadFailure(
                resource: "USTop150MayoralElectionCycles.json",
                reason: "unable to read bundle data"
            )
            topCityLoadFailureReason = "unable to read bundle data"
            cachedTopCityMayoralRecords = []
            return []
        }
        guard let records = try? JSONDecoder().decode([TopCityMayoralCycleRecord].self, from: data) else {
            ElectionTimelineDataDiagnostics.reportLoadFailure(
                resource: "USTop150MayoralElectionCycles.json",
                reason: "decode failure"
            )
            topCityLoadFailureReason = "decode failure"
            cachedTopCityMayoralRecords = []
            return []
        }

        cachedTopCityMayoralRecords = records
        return records
    }

    private func loadMidtermElectionsOnQueue(topCityMayoralRecords: [TopCityMayoralCycleRecord]) -> [Election] {
        if let cachedMidtermElections {
            return cachedMidtermElections
        }

        guard let url = Bundle.main.url(forResource: "USMidterm2026ElectionDates", withExtension: "json") else {
            ElectionTimelineDataDiagnostics.reportLoadFailure(
                resource: "USMidterm2026ElectionDates.json",
                reason: "missing bundle resource"
            )
            midtermLoadFailureReason = "missing bundle resource"
            cachedMidtermElections = []
            return []
        }
        guard let data = try? Data(contentsOf: url) else {
            ElectionTimelineDataDiagnostics.reportLoadFailure(
                resource: "USMidterm2026ElectionDates.json",
                reason: "unable to read bundle data"
            )
            midtermLoadFailureReason = "unable to read bundle data"
            cachedMidtermElections = []
            return []
        }
        guard let records = try? JSONDecoder().decode([MidtermStateElectionRecord].self, from: data) else {
            ElectionTimelineDataDiagnostics.reportLoadFailure(
                resource: "USMidterm2026ElectionDates.json",
                reason: "decode failure"
            )
            midtermLoadFailureReason = "decode failure"
            cachedMidtermElections = []
            return []
        }

        let elections = ElectionTimelineView.buildMidtermElections(
            from: records,
            topCityMayoralRecords: topCityMayoralRecords
        )
        cachedMidtermElections = elections
        return elections
    }
}

struct ElectionTimelineView: View {
    @EnvironmentObject private var planVM: PlanViewModel
    @EnvironmentObject private var repsVM: MyRepsViewModel
    @Environment(\.locale) private var locale

    @State private var allElections: [Election] = []
    @State private var visibleElections: [Election] = []
    @State private var errorMessage: String?
    @State private var pendingFlagElection: Election?
    @State private var shareItems: [Any] = []
    @State private var showingShareSheet = false
    @State private var showingFeedbackComposer = false
    @State private var feedbackPrefillMessage = ""
    @State private var expandedCardIDs: Set<String> = []
    @State private var focusedTimelineElectionID: String?
    @State private var manualFocusedElectionID: String?
    @State private var manualFocusExpiresAt: Date = .distantPast
    @State private var timelineCardFrames: [String: CGRect] = [:]
    @State private var timelineViewportFrame: CGRect = .zero
    @State private var eligibilityDataset: ElectionEligibilityDataset?
    @State private var didLoadBundleData = false
    @State private var timelineLoadState: TimelineLoadState = .loading

    private let stateResolver = USZipStateResolver()
    private let logger = Logger(subsystem: "Civica", category: "ElectionTimeline")
    private let dataLoadFailureMessage = "We couldn’t load election data."
    private let unresolvedLocationMessage = "Enter a valid address to see your elections."
    private static let independentPrimaryTerritoryNotesByCode: [String: String] = [
        "AS": "Primary type: Nonpartisan / No standard party-primary system verified. Independent voter rule: This is not a normal state-style Dem/GOP primary system in the official materials reviewed. Can choose Democrat or Republican primary ballot: N/A. Note: American Samoa's Election Office describes itself as nonpartisan; a standard territorywide partisan primary access rule for independents was not verified.",
        "GU": "Primary type: Party-column primary. Independent voter rule: Independent voter chooses one party column or the non-affiliated column; not multiple parties. Can choose Democrat or Republican primary ballot: Usually one choice only. Note: Guam law provides separate party columns and a non-affiliated column if needed.",
        "MP": "Primary type: Party-rule-driven / Varies. Independent voter rule: No single simple open/closed rule verified for independents; party nomination rules and independent petition access both exist. Can choose Democrat or Republican primary ballot: Varies. Note: Official CNMI election law shows primaries exist and independent candidates can access the general ballot by petition.",
        "PR": "Primary type: Open or affiliated primary, depending on party format. Independent voter rule: In an open primary, any active voter may vote; in an affiliated primary, voter must affiliate with the party, including immediate affiliation before voting. Can choose Democrat or Republican primary ballot: Sometimes / Depends on party format. Note: Puerto Rico law explicitly distinguishes open and affiliated primaries.",
        "VI": "Primary type: Closed. Independent voter rule: Non-party affiliates cannot vote in the primary. Can choose Democrat or Republican primary ballot: No. Note: VI VOTE FAQ indicates primary elections are for party members only."
    ]
    private let timelineScrollCoordinateSpace = "ElectionTimelineScrollCoordinateSpace"

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }

    private func lf(_ key: String, _ fallback: String, _ args: CVarArg...) -> String {
        let format = l(key, fallback)
        return String(format: format, locale: locale, arguments: args)
    }

    private enum TimelineLoadState {
        case loading
        case success
        case failure
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                PageHeader(title: Text("app.page.election_timeline", tableName: "AppShell"))
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(timelineAddressSubtitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(VoteNowColors.mutedText)
                        .lineLimit(1)
                        .minimumScaleFactor(0.84)

                    Spacer(minLength: 8)

                    Button {
                        openMyInfoPanel()
                    } label: {
                        Text(l("app.reps.action.edit_location", "Change Location"))
                            .font(.callout.weight(.semibold))
                            .italic()
                            .foregroundColor(VoteNowColors.primaryCTA)
                            .lineLimit(1)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.leading, 72)
                .padding(.top, -6)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 8)
            .background(VoteNowColors.appBackground)

            ScrollViewReader { scrollProxy in
                let selectElectionFromTimeline: (String) -> Void = { electionID in
                    manualFocusedElectionID = electionID
                    manualFocusExpiresAt = Date().addingTimeInterval(0.55)
                    focusedTimelineElectionID = electionID
                    withAnimation(.easeInOut(duration: 0.28)) {
                        scrollProxy.scrollTo(electionID, anchor: .top)
                    }

                    // A quick follow-up pass makes dot taps resilient while card frames are still updating.
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            scrollProxy.scrollTo(electionID, anchor: .top)
                        }
                    }
                }

                if !visibleElections.isEmpty {
                    timelineOverviewSection(for: visibleElections, onElectionTap: selectElectionFromTimeline)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
                    .background(VoteNowColors.appBackground)
                    .zIndex(1)
                }

                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if timelineLoadState == .loading {
                            LaunchFlowStateCard(
                                state: .loading,
                                title: l("app.timeline.loading_title", "Loading election timeline"),
                                message: l("app.timeline.loading_body", "Gathering election details for your location..."),
                                primaryActionTitle: l("app.reps.action.use_location", "Use my location"),
                                primaryAction: {
                                    repsVM.centerOnCurrentLocation()
                                },
                                secondaryActionTitle: l("app.reps.action.edit_location", "Change Location"),
                                secondaryAction: {
                                    openMyInfoPanel()
                                }
                            )
                        } else if timelineLoadState == .failure {
                            LaunchFlowStateCard(
                                state: .error,
                                title: l("app.timeline.error.title", "We couldn’t load the election timeline"),
                                message: errorMessage ?? dataLoadFailureMessage,
                                primaryActionTitle: l("app.timeline.error.retry", "Retry"),
                                primaryAction: {
                                    retryTimelineLoad()
                                },
                                secondaryActionTitle: l("app.reps.action.edit_location", "Change Location"),
                                secondaryAction: {
                                    openMyInfoPanel()
                                }
                            )
                        } else {
                            if let errorMessage {
                                Text(errorMessage)
                                    .font(.subheadline)
                                    .foregroundColor(VoteNowColors.urgentCTA)
                            }

                            if visibleElections.isEmpty, errorMessage == nil {
                                Text(l("app.timeline.empty.none_for_state", "No upcoming elections found for that state yet."))
                                    .font(.subheadline)
                                    .foregroundColor(VoteNowColors.mutedText)
                            }
                        }

                        VStack(alignment: .leading, spacing: 0) {
                            ForEach(Array(visibleElections.enumerated()), id: \.element.id) { index, election in
                                let currentYear = calendarYear(for: election.electionDay)
                                let priorYear = index > 0
                                    ? calendarYear(for: visibleElections[index - 1].electionDay)
                                    : nil
                                timelineCardRow(
                                    election,
                                    index: index,
                                    totalCount: visibleElections.count,
                                    showYearLabel: priorYear != currentYear,
                                    onCardTap: {
                                        _ = withAnimation(.easeInOut(duration: 0.2)) {
                                            if expandedCardIDs.contains(election.id) {
                                                expandedCardIDs.remove(election.id)
                                            } else {
                                                expandedCardIDs.insert(election.id)
                                            }
                                        }
                                        selectElectionFromTimeline(election.id)
                                    }
                                )
                                .id(election.id)
                                .background(
                                    GeometryReader { proxy in
                                        Color.clear.preference(
                                            key: TimelineCardFramesPreferenceKey.self,
                                            value: [election.id: proxy.frame(in: .named(timelineScrollCoordinateSpace))]
                                        )
                                    }
                                )
                                .scaleEffect(cardScale(for: election.id), anchor: .center)
                                .rotation3DEffect(
                                    .degrees(cardTiltAngle(for: election.id)),
                                    axis: (x: 1, y: 0, z: 0),
                                    anchor: .center,
                                    perspective: 0.6
                                )
                                .offset(x: cardHorizontalOffset(for: election.id))
                                .opacity(cardOpacity(for: election.id))
                                .zIndex(cardZIndex(for: election.id))
                                .animation(.easeInOut(duration: 0.2), value: focusedTimelineElectionID)
                                .padding(.bottom, index == visibleElections.count - 1 ? 0 : 14)
                            }

                            if let trailingYearLabel {
                                timelineYearBookmark(trailingYearLabel)
                                    .padding(.top, 10)
                                    .padding(.leading, 1)
                            }

                            // Allow the final card to scroll far enough to become the focused timeline item.
                            Color.clear
                                .frame(height: 170)
                                .accessibilityHidden(true)
                        }
                    }
                    .padding(.leading, 10)
                    .padding(.trailing, 16)
                    .padding(.bottom, 16)
                }
                .coordinateSpace(name: timelineScrollCoordinateSpace)
                .background(
                    GeometryReader { proxy in
                        Color.clear.preference(
                            key: TimelineViewportPreferenceKey.self,
                            value: proxy.frame(in: .named(timelineScrollCoordinateSpace))
                        )
                    }
                )
                .onPreferenceChange(TimelineCardFramesPreferenceKey.self) { frames in
                    timelineCardFrames = frames
                    updateFocusedTimelineElection()
                }
                .onPreferenceChange(TimelineViewportPreferenceKey.self) { frame in
                    timelineViewportFrame = frame
                    updateFocusedTimelineElection()
                }
            }
        }
        .background(VoteNowColors.appBackground.ignoresSafeArea())
        .navigationTitle(Text("app.page.election_timeline", tableName: "AppShell"))
        .sheet(isPresented: $showingShareSheet) {
            shareItems.removeAll()
        } content: {
            if !shareItems.isEmpty {
                ShareSheet(items: shareItems)
            }
        }
        .sheet(isPresented: $showingFeedbackComposer) {
            NavigationStack {
                FeedbackView(
                    preselectedCategoryRawValue: "bug",
                    prefilledMessage: feedbackPrefillMessage
                )
            }
        }
        .confirmationDialog(
            l("app.timeline.action.dialog.title", "Election Actions"),
            isPresented: Binding(
                get: { pendingFlagElection != nil },
                set: { isPresented in
                    if !isPresented {
                        pendingFlagElection = nil
                    }
                }
            ),
            titleVisibility: .hidden
        ) {
            if VoteNowLaunchFeatures.shareActionsEnabled {
                Button(l("app.timeline.action.dialog.share", "Share with friend")) {
                    if let election = pendingFlagElection {
                        shareElectionCard(for: election)
                    }
                    pendingFlagElection = nil
                }
            }
            Button(l("app.timeline.action.dialog.report", "Report problem")) {
                if let election = pendingFlagElection {
                    openFeedbackComposer(for: election)
                }
                pendingFlagElection = nil
            }
        }
        .onAppear {
            loadElectionsIfNeeded()
            applyFilter()
        }
        .onChange(of: planVM.zip) { _, _ in
            applyFilter()
        }
        .onChange(of: planVM.userAddress.street) { _, _ in
            applyFilter()
        }
        .onChange(of: planVM.userAddress.city) { _, _ in
            applyFilter()
        }
        .onChange(of: planVM.userAddress.state) { _, _ in
            applyFilter()
        }
        .onChange(of: planVM.userAddress.zip) { _, _ in
            applyFilter()
        }
        .onChange(of: repsVM.resolvedLocationSelection?.timestamp) { _, _ in
            applyFilter()
        }
    }

    private var timelineAddressSubtitle: String {
        let city = timelineLocationCity
        let state = timelineLocationStateCode
        let zip = timelineLocationZip

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

    private var timelineLocationCity: String {
        let resolvedCity = repsVM.resolvedLocationSelection?.city?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !resolvedCity.isEmpty { return resolvedCity }
        return planVM.userAddress.city.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var timelineLocationStateCode: String? {
        if let resolved = normalizedUSStateCode(from: repsVM.resolvedStateCode) {
            return resolved
        }
        if let detected = normalizedUSStateCode(from: repsVM.detectedStateCode) {
            return detected
        }
        if let entered = normalizedUSStateCode(from: planVM.userAddress.state) {
            return entered
        }
        if let zip = timelineLocationZip {
            return stateResolver.stateCode(for: zip)
        }
        return nil
    }

    private var timelineLocationZip: String? {
        let addressZip = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
        if addressZip.count == 5 { return addressZip }

        let resolvedZip = String((repsVM.resolvedLocationSelection?.postalCode ?? "").filter(\.isNumber).prefix(5))
        if resolvedZip.count == 5 { return resolvedZip }

        let fallback = String(planVM.zip.filter(\.isNumber).prefix(5))
        return fallback.count == 5 ? fallback : nil
    }

    @ViewBuilder
    private func timelineOverviewSection(
        for elections: [Election],
        onElectionTap: @escaping (String) -> Void
    ) -> some View {
        let sorted = elections.sorted { lhs, rhs in
            if lhs.electionDay != rhs.electionDay { return lhs.electionDay < rhs.electionDay }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
        let focusedID = focusedTimelineElectionID ?? sorted.first?.id
        let focusedIndex = sorted.firstIndex(where: { $0.id == focusedID }) ?? 0

        VStack(alignment: .leading, spacing: 2) {
            GeometryReader { proxy in
                let chartHeight: CGFloat = 84
                let lineY: CGFloat = 34
                let xPadding: CGFloat = 24
                let calendar = Calendar.current
                let nowDay = Calendar.current.startOfDay(for: Date())
                let maxElectionDay = Calendar.current.startOfDay(for: sorted.map(\.electionDay).max() ?? nowDay)
                let baseline2029 = calendar.date(from: DateComponents(year: 2029, month: 1, day: 1))
                    .map { calendar.startOfDay(for: $0) } ?? maxElectionDay
                let maxDay = max(maxElectionDay, baseline2029)
                let totalSpanDays = max(
                    1,
                    Calendar.current.dateComponents([.day], from: nowDay, to: maxDay).day ?? 1
                )

                let contentWidth = proxy.size.width
                let usableWidth = max(1, contentWidth - (xPadding * 2))
                let plotPoints = timelinePlotPoints(
                    for: sorted,
                    minDay: nowDay,
                    totalSpanDays: totalSpanDays,
                    usableWidth: usableWidth,
                    xPadding: xPadding
                )
                let yearMarkers = timelineYearMarkers(minDay: nowDay, maxDay: maxDay)

                ZStack(alignment: .topLeading) {
                    Path { path in
                        path.move(to: CGPoint(x: xPadding, y: lineY))
                        path.addLine(to: CGPoint(x: contentWidth - xPadding, y: lineY))
                    }
                    .stroke(VoteNowColors.richRed.opacity(0.82), style: StrokeStyle(lineWidth: 2, lineCap: .round))

                    if let nextElection = sorted.first {
                        let startX = timelineXPosition(
                            for: nextElection.startDate,
                            minDay: nowDay,
                            totalSpanDays: totalSpanDays,
                            usableWidth: usableWidth,
                            xPadding: xPadding
                        )
                        let electionX = timelineXPosition(
                            for: nextElection.electionDay,
                            minDay: nowDay,
                            totalSpanDays: totalSpanDays,
                            usableWidth: usableWidth,
                            xPadding: xPadding
                        )
                        let shadeWidth = max(2, electionX - startX)

                        if shadeWidth > 1 {
                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                .fill(VoteNowColors.primaryCTA.opacity(0.2))
                                .frame(width: shadeWidth, height: 14)
                                .position(x: startX + (shadeWidth / 2), y: lineY)
                        }
                    }

                    Path { path in
                        path.move(to: CGPoint(x: xPadding, y: lineY - 6))
                        path.addLine(to: CGPoint(x: xPadding, y: lineY + 6))
                    }
                    .stroke(
                        VoteNowColors.richRed.opacity(0.78),
                        style: StrokeStyle(lineWidth: 1.6, lineCap: .round)
                    )

                    Text("TODAY")
                        .font(.caption.weight(.bold))
                        .foregroundColor(VoteNowColors.mutedText)
                        .position(x: xPadding + 10, y: lineY + 18)

                    ForEach(yearMarkers) { marker in
                        let markerX = timelineXPosition(
                            for: marker.markerDay,
                            minDay: nowDay,
                            totalSpanDays: totalSpanDays,
                            usableWidth: usableWidth,
                            xPadding: xPadding
                        )

                        Path { path in
                            path.move(to: CGPoint(x: markerX, y: lineY - 6))
                            path.addLine(to: CGPoint(x: markerX, y: lineY + 6))
                        }
                        .stroke(
                            VoteNowColors.richRed.opacity(0.72),
                            style: StrokeStyle(lineWidth: 1.6, lineCap: .round)
                        )

                        Text(marker.label)
                            .font(.caption.weight(.semibold))
                            .foregroundColor(VoteNowColors.mutedText.opacity(0.9))
                            .position(x: markerX, y: lineY + 18)
                    }

                    ForEach(plotPoints) { point in
                        let distance = abs(point.sequenceIndex - focusedIndex)
                        let dotOpacity = timelineDotOpacity(distance: distance)
                        let isFocused = point.sequenceIndex == focusedIndex
                        let showPointDetail = isFocused
                        let detailOpacity = showPointDetail ? 1.0 : 0.0
                        let detailScale: CGFloat = showPointDetail ? 1.0 : 0.97
                        let pointX = point.electionX + point.pointOffsetX
                        let edgePadding: CGFloat = 6
                        let titleHalfSpan = max(56, min(pointX - edgePadding, (contentWidth - edgePadding) - pointX))
                        let dateHalfSpan = max(34, min(pointX - edgePadding, (contentWidth - edgePadding) - pointX))
                        let titleWidth = min(220, titleHalfSpan * 2)
                        let dateWidth = min(96, dateHalfSpan * 2)
                        let clampedTitleX = min(
                            max(pointX, edgePadding + (titleWidth / 2)),
                            contentWidth - edgePadding - (titleWidth / 2)
                        )
                        let clampedDateX = min(
                            max(pointX, edgePadding + (dateWidth / 2)),
                            contentWidth - edgePadding - (dateWidth / 2)
                        )
                        let topY = lineY - 24
                        let bottomY = lineY + 36

                        timelineOverviewTitleLabel(
                            text: timelineTopTitle(for: point.election),
                            width: titleWidth,
                            x: clampedTitleX,
                            y: topY,
                            opacity: detailOpacity,
                            scale: detailScale,
                            showPointDetail: showPointDetail
                        ) {
                            onElectionTap(point.election.id)
                        }
                        .animation(.easeInOut(duration: 0.14), value: focusedTimelineElectionID)

                        Button {
                            onElectionTap(point.election.id)
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(isFocused ? VoteNowColors.timelineFocusGold : VoteNowColors.primaryCTA)
                                Circle()
                                    .stroke(Color.white, lineWidth: 2)
                                if isFocused {
                                    Circle()
                                        .stroke(VoteNowColors.timelineFocusGold.opacity(0.62), lineWidth: 3)
                                        .scaleEffect(1.55)
                                }
                            }
                            .frame(width: isFocused ? 15 : 12, height: isFocused ? 15 : 12)
                        }
                        .buttonStyle(.plain)
                        .frame(width: 24, height: 24)
                        .opacity(dotOpacity)
                        .position(x: pointX, y: lineY)
                        .contentShape(Rectangle())
                        .animation(.easeInOut(duration: 0.2), value: isFocused)
                        .animation(.easeInOut(duration: 0.22), value: focusedTimelineElectionID)

                        Text(Self.timelineMonthDayFormatter.string(from: point.election.electionDay))
                            .font(.footnote.weight(.semibold))
                            .foregroundColor(VoteNowColors.timelineFocusGold)
                            .shadow(color: VoteNowColors.warningAmber.opacity(0.28), radius: 0.8, x: 0, y: 0.4)
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                            .allowsTightening(true)
                            .frame(width: dateWidth, alignment: .center)
                            .padding(.vertical, 1)
                            .position(x: clampedDateX, y: bottomY)
                            .opacity(detailOpacity)
                            .scaleEffect(detailScale)
                            .allowsHitTesting(showPointDetail)
                            .onTapGesture {
                                onElectionTap(point.election.id)
                            }
                            .animation(.easeInOut(duration: 0.14), value: focusedTimelineElectionID)
                    }

                }
                .contentShape(Rectangle())
                .highPriorityGesture(
                    SpatialTapGesture().onEnded { tap in
                        let tapY = tap.location.y
                        guard abs(tapY - lineY) <= 38 else { return }
                        guard let nearest = plotPoints.min(by: { lhs, rhs in
                            let lhsX = lhs.electionX + lhs.pointOffsetX
                            let rhsX = rhs.electionX + rhs.pointOffsetX
                            return abs(lhsX - tap.location.x) < abs(rhsX - tap.location.x)
                        }) else { return }
                        onElectionTap(nearest.election.id)
                    }
                )
                .frame(width: contentWidth, height: chartHeight, alignment: .topLeading)
            }
            .frame(height: 84)

            Text(
                lf(
                    "app.timeline.chances.before_presidential",
                    "%d Chances to Vote before the next Presidential Election!",
                    chancesToVoteUntilNextPresident(in: sorted)
                )
            )
                .font(.footnote.weight(.semibold))
                .italic()
                .foregroundColor(VoteNowColors.primaryText)
                .lineLimit(1)
                .minimumScaleFactor(0.55)
                .allowsTightening(true)
                .padding(.top, -2)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 6)
        .padding(.bottom, 6)
        .padding(.top, 2)
        .background(
            RoundedRectangle(cornerRadius: VoteNowColors.cardCornerRadius, style: .continuous)
                .fill(VoteNowColors.infoSurfaceBlue)
        )
        .overlay(
            RoundedRectangle(cornerRadius: VoteNowColors.cardCornerRadius, style: .continuous)
                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
        )
    }

    private func timelineOverviewTitleLabel(
        text: String,
        width: CGFloat,
        x: CGFloat,
        y: CGFloat,
        opacity: Double,
        scale: CGFloat,
        showPointDetail: Bool,
        onTap: @escaping () -> Void
    ) -> some View {
        Text(text)
            .font(.footnote.weight(.semibold))
            .foregroundColor(VoteNowColors.timelineFocusGold)
            .shadow(color: VoteNowColors.warningAmber.opacity(0.28), radius: 0.8, x: 0, y: 0.4)
            .lineLimit(1)
            .truncationMode(.tail)
            .multilineTextAlignment(.center)
            .minimumScaleFactor(0.55)
            .allowsTightening(true)
            .frame(width: width, alignment: .center)
            .padding(.horizontal, 4)
            .padding(.vertical, 1)
            .position(x: x, y: y)
            .opacity(opacity)
            .scaleEffect(scale)
            .allowsHitTesting(showPointDetail)
            .onTapGesture(perform: onTap)
    }

    @ViewBuilder
    private func timelineCardRow(
        _ election: Election,
        index: Int,
        totalCount: Int,
        showYearLabel: Bool,
        onCardTap: @escaping () -> Void
    ) -> some View {
        HStack(alignment: .top, spacing: 0) {
            timelineCardYearRail(
                for: election,
                showYearLabel: showYearLabel,
                isLast: index == totalCount - 1
            )
            electionCard(election, index: index)
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onCardTap)
        .padding(.top, showYearLabel ? (index == 0 ? 24 : 10) : 0)
        .overlay(alignment: .topLeading) {
            if showYearLabel {
                timelineYearBookmark(Self.timelineYearFormatter.string(from: election.electionDay))
                    .offset(x: 1, y: index == 0 ? -2 : -14)
                    .zIndex(3)
            }
        }
        .zIndex(showYearLabel ? 2 : 1)
    }

    @ViewBuilder
    private func timelineCardYearRail(
        for _: Election,
        showYearLabel _: Bool,
        isLast _: Bool
    ) -> some View {
        Color.clear
            .frame(width: 0, height: 0)
    }

    @ViewBuilder
    private func timelineYearBookmark(_ year: String) -> some View {
        Text(year)
            .font(.callout.weight(.bold))
            .foregroundColor(VoteNowColors.richRed)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
    }

    private func calendarYear(for date: Date) -> Int {
        Calendar.current.component(.year, from: date)
    }

    private var trailingYearLabel: String? {
        guard let lastElection = visibleElections.last else { return nil }
        let lastYear = calendarYear(for: lastElection.electionDay)
        return lastYear < 2029 ? "2029" : nil
    }

    @ViewBuilder
    private func electionCard(_ election: Election, index: Int) -> some View {
        let selectedID = focusedTimelineElectionID ?? visibleElections.first?.id
        let isSelected = selectedID == election.id
        let isMostUpcoming = election.id == mostUpcomingElectionID
        let advisoryLines = advisoryMessages(for: election)

        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 10) {
                stateFlagView(for: election)

                VStack(alignment: .leading, spacing: 6) {
                    Text(headerTitle(for: election))
                        .font(.headline)
                        .foregroundColor(VoteNowColors.primaryText)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack(spacing: 8) {
                        Text(stateName(for: election))
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(VoteNowColors.mutedText)
                            .lineLimit(1)
                    }

                    if let subtitleText = displaySubtitleText(for: election), !subtitleText.isEmpty {
                        Text(subtitleText)
                            .font(.subheadline)
                            .foregroundColor(VoteNowColors.mutedText)
                            .lineLimit(2)
                    }
                }

                Spacer(minLength: 8)

                Button(action: { handleFlagTap(for: election) }) {
                    Image(systemName: "arrowshape.turn.up.right.circle.fill")
                        .font(.system(size: 26, weight: .regular))
                        .foregroundColor(VoteNowColors.primaryCTA)
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.plain)
                .contentShape(Circle())
                .accessibilityLabel(l("app.timeline.action.accessibility", "Election actions"))
            }

            if isMostUpcoming {
                HStack(alignment: .center, spacing: 8) {
                    Text(registrationDeadlinePillText(for: election))
                        .font(.caption.weight(.semibold))
                        .foregroundColor(countdownForegroundColor(for: election))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(countdownBackgroundColor(for: election))
                        .clipShape(Capsule())
                        .lineLimit(1)
                        .minimumScaleFactor(0.74)
                        .allowsTightening(true)

                    Spacer(minLength: 8)
                }
            }

            HStack(alignment: .top, spacing: 10) {
                keyDateTile(
                    title: l("app.timeline.date_tile.early_voting", "Early Voting"),
                    value: earlyVotingText(for: election),
                    icon: "clock",
                    useTintedBackground: index != 0
                )

                keyDateTile(
                    title: l("app.timeline.date_tile.election_day", "Election Day"),
                    value: formattedDateText(election.electionDay),
                    icon: "calendar",
                    useTintedBackground: index != 0
                )
            }

            HStack(alignment: .center, spacing: 8) {
                Text(electionCountdownAndDeadlineText(for: election))
                    .font(.caption.weight(.semibold))
                    .foregroundColor(countdownForegroundColor(for: election))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(countdownBackgroundColor(for: election))
                    .clipShape(Capsule())

                if let partyBadge = primaryPartyBadge(for: election) {
                    Text(partyBadge.title)
                        .font(.caption.weight(.semibold))
                        .foregroundColor(partyBadge.foreground)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(partyBadge.background)
                        .clipShape(Capsule())
                        .lineLimit(1)
                        .opensMyInfoPanelOnLongPress(
                            when: planVM.selectedParty == .democrat || planVM.selectedParty == .republican
                        )
                }
                Spacer(minLength: 8)
            }

            if isMostUpcoming {
                Button {
                    openVotingStepsTab()
                } label: {
                    Label(l("app.timeline.action.open_voting_guide", "Open Voting Guide"), systemImage: "list.bullet.clipboard.fill")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                .buttonStyle(VoteNowPrimaryCTAButtonStyle())
                .accessibilityLabel(l("app.timeline.action.open_voting_guide", "Open Voting Guide"))
            }

            if let ballotContent = ballotDisclosureContent(for: election) {
                DisclosureGroup(
                    isExpanded: Binding(
                        get: { expandedCardIDs.contains(election.id) },
                        set: { isExpanded in
                            if isExpanded {
                                expandedCardIDs.insert(election.id)
                            } else {
                                expandedCardIDs.remove(election.id)
                            }
                        }
                    )
                ) {
                    VStack(alignment: .leading, spacing: 10) {
                        if let intro = ballotContent.introText, !intro.isEmpty {
                            ballotIntroView(intro)
                        }

                        ForEach(ballotContent.items) { item in
                            ballotItemLineView(item)
                        }

                    }
                    .padding(.top, 6)
                } label: {
                    Text(l("app.timeline.disclosure.preliminary", "What's on your ballot"))
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(VoteNowColors.primaryText)
                }
                .tint(VoteNowColors.primaryCTA)
            }

            if !advisoryLines.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(advisoryLines.enumerated()), id: \.offset) { _, advisory in
                        HStack(alignment: .top, spacing: 6) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.caption2.weight(.semibold))
                                .foregroundColor(VoteNowColors.warningAmber)
                                .padding(.top, 1)
                            Text(advisory)
                                .font(.caption)
                                .foregroundColor(VoteNowColors.mutedText)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: VoteNowColors.cardCornerRadius, style: .continuous)
                .fill(VoteNowColors.surfaceWhite)
                .overlay(
                    RoundedRectangle(cornerRadius: VoteNowColors.cardCornerRadius, style: .continuous)
                        .fill(
                            isSelected
                                ? VoteNowColors.warningAmber.opacity(0.07)
                                : (index == 0 ? VoteNowColors.warningAmber.opacity(0.08) : .clear)
                        )
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: VoteNowColors.cardCornerRadius, style: .continuous)
                .stroke(
                    isSelected
                        ? VoteNowColors.warningAmber.opacity(0.82)
                        : (index == 0 ? VoteNowColors.warningAmber.opacity(0.34) : VoteNowColors.borderWarm),
                    lineWidth: isSelected ? 1.8 : 1
                )
        )
        .shadow(
            color: (isSelected ? VoteNowColors.warningAmber : VoteNowColors.primaryText).opacity(isSelected ? 0.22 : 0.06),
            radius: isSelected ? 6 : 3,
            x: 0,
            y: isSelected ? 3 : 1
        )
        .animation(.easeInOut(duration: 0.18), value: isSelected)
    }

    @ViewBuilder
    private func stateFlagView(for election: Election) -> some View {
        let code = stateCode(for: election)
        let flagSize = CGSize(width: 64, height: 42)

        if let assetName = StateFlagCatalog.assetName(for: code),
           UIImage(named: assetName) != nil {
            Image(assetName)
                .resizable()
                .scaledToFill()
                .frame(width: flagSize.width, height: flagSize.height)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                )
                .opensMyInfoPanelOnLongPress()
        } else if let remoteURL = stateFlagURL(for: election) {
            AsyncImage(url: remoteURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                default:
                    stateFlagFallback(for: code)
                }
            }
            .frame(width: flagSize.width, height: flagSize.height)
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .stroke(VoteNowColors.borderWarm, lineWidth: 1)
            )
            .opensMyInfoPanelOnLongPress()
        } else {
            stateFlagFallback(for: code)
                .frame(width: flagSize.width, height: flagSize.height)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                )
                .opensMyInfoPanelOnLongPress()
        }
    }

    private func stateFlagFallback(for code: String?) -> some View {
        ZStack {
            Rectangle()
                .fill(VoteNowColors.infoSurfaceBlue)
            Text(code ?? "US")
                .font(.caption2.weight(.bold))
                .foregroundColor(VoteNowColors.primaryCTA)
        }
    }

    private func stateFlagURL(for election: Election) -> URL? {
        guard let code = stateCode(for: election)?.uppercased() else { return nil }
        let state = stateName(for: election)
        let fileName = Self.wikimediaFlagFileNameByCode[code]
            ?? "Flag_of_\(state.replacingOccurrences(of: " ", with: "_")).svg"
        let encoded = fileName.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? fileName
        return URL(string: "https://commons.wikimedia.org/wiki/Special:FilePath/\(encoded)")
    }

    private func headerTitle(for election: Election) -> String {
        if let mayoralTitle = mayoralHeaderTitle(for: election) {
            return mayoralTitle
        }

        let state = stateName(for: election)
        let base = election.name
            .replacingOccurrences(of: state, with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let phase = election.subtitle
            .replacingOccurrences(of: "Election", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if !base.isEmpty, !phase.isEmpty {
            let phaseWords = phase.split(separator: " ").map(String.init)
            if let lastBaseWord = base.split(separator: " ").last?.lowercased(),
               let firstPhaseWord = phaseWords.first?.lowercased(),
               lastBaseWord == firstPhaseWord {
                let dedupedPhase = phaseWords.dropFirst().joined(separator: " ")
                if !dedupedPhase.isEmpty {
                    return "\(base) \(dedupedPhase)"
                }
            }
            return "\(base) \(phase)"
        }
        if !base.isEmpty {
            return base
        }
        if !phase.isEmpty {
            return phase
        }
        return cardTitle(for: election)
    }

    private func mayoralHeaderTitle(for election: Election) -> String? {
        guard isMayoralTimelineCard(election) else { return nil }

        let city = mayoralCityName(election) ?? election.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let year = Calendar.current.component(.year, from: election.electionDay)
        let stageTitle = mayoralBallotTitle(forStage: mayoralStageName(election))
            .replacingOccurrences(of: "Mayor ", with: "")
        return "\(year) Mayoral \(city) \(stageTitle)"
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    @ViewBuilder
    private func keyDateTile(title: String, value: String, icon: String, useTintedBackground: Bool) -> some View {
        VStack(alignment: .center, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryCTA)
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(VoteNowColors.mutedText)
            }
            .frame(maxWidth: .infinity, alignment: .center)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryText)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(useTintedBackground ? VoteNowColors.infoSurfaceBlue.opacity(0.42) : VoteNowColors.surfaceWhite)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(VoteNowColors.borderWarm.opacity(useTintedBackground ? 0.55 : 0.85), lineWidth: 1)
        )
    }

    private func displaySubtitleText(for election: Election) -> String? {
        if isMayoralTimelineCard(election) {
            return nil
        }
        guard let subtitle = cardSecondaryText(for: election)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !subtitle.isEmpty else { return nil }
        let lower = subtitle.lowercased()
        let generic = [
            "primary election",
            "general election",
            "presidential primary election",
            "presidential general election"
        ]
        if generic.contains(lower) {
            return nil
        }
        return subtitle
    }

    private struct PartyBadgeStyle {
        let title: String
        let foreground: Color
        let background: Color
    }

    private enum BallotParty {
        case democrat
        case republican
        case other
    }

    private enum BallotOfficeIcon {
        case whiteHouse
        case congress
    }

    private struct BallotDisclosureItem: Identifiable {
        let id: String
        let title: String
        let detail: String
        let party: BallotParty?
        let officeIcon: BallotOfficeIcon?
        let incumbent: String?
    }

    private struct BallotDisclosureContent {
        let introText: String?
        let items: [BallotDisclosureItem]
    }

    private enum BallotStageContext {
        case primary
        case runoff
        case general
    }

    private enum TimelineLocationPrecision {
        case stateOnly
        case zipOrCity
        case fullAddress
    }

    private struct TimelinePlotPoint: Identifiable {
        let id: String
        let election: Election
        let sequenceIndex: Int
        let electionX: CGFloat
        let pointOffsetX: CGFloat
        let titleOffsetX: CGFloat
        let bottomOffsetX: CGFloat
        let titleLane: Int
        let bottomLane: Int
    }

    private struct TimelineYearMarker: Identifiable {
        let year: Int
        let markerDay: Date

        var id: Int { year }
        var label: String { "Jan \(year)" }
    }

    @ViewBuilder
    private func ballotIntroView(_ intro: String) -> some View {
        let lines = intro
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)

        VStack(alignment: .leading, spacing: 4) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                ballotIntroLineView(line)
            }
        }
    }

    @ViewBuilder
    private func ballotIntroLineView(_ line: String) -> some View {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            EmptyView()
        } else {
            let isPrimaryType = trimmed.lowercased().hasPrefix("primary type:")
            ballotIntroLineText(trimmed)
                .font(.caption)
                .foregroundColor(isPrimaryType ? VoteNowColors.primaryText : VoteNowColors.mutedText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func ballotIntroLineText(_ line: String) -> Text {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return Text("") }

        let normalized = trimmed.lowercased()
        let prefix = "primary type:"
        if normalized.hasPrefix(prefix) {
            let start = trimmed.index(trimmed.startIndex, offsetBy: prefix.count)
            let remainder = trimmed[start...].trimmingCharacters(in: .whitespacesAndNewlines)
            let localizedPrefix = l("app.timeline.ballot.primary_type.label", "Primary Type")
            return Text("\(localizedPrefix): ").bold() + Text(remainder)
        }

        return Text(trimmed)
    }

    private func ballotItemLineView(_ item: BallotDisclosureItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                if let officeIcon = item.officeIcon {
                    ballotOfficeIconView(for: officeIcon)
                        .frame(width: 18, height: 18)
                }

                (
                    Text(item.title)
                        .font(.caption.weight(.semibold))
                        .foregroundColor(ballotPartyColor(for: item.party))
                    + Text(": ")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(VoteNowColors.primaryText)
                    + Text(item.detail)
                        .font(.caption)
                        .foregroundColor(VoteNowColors.mutedText)
                )
                .opensMyInfoPanelOnLongPress(when: shouldOpenMyInfoFromPartyItem(item.party))
            }

            if let incumbent = item.incumbent, !incumbent.isEmpty {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("◦")
                        .font(.caption2.weight(.semibold))
                        .foregroundColor(VoteNowColors.mutedText)
                        .frame(width: 10, alignment: .leading)

                    styledIncumbentText(incumbent)
                        .font(.caption2.weight(.semibold))
                        .opensMyInfoPanelOnLongPress()
                }
                .padding(.leading, 16)
            }
        }
    }

    @ViewBuilder
    private func ballotOfficeIconView(for icon: BallotOfficeIcon) -> some View {
        switch icon {
        case .whiteHouse:
            Image("WhiteHouseIcon")
                .resizable()
                .scaledToFit()
                .frame(width: 18, height: 18)
        case .congress:
            if UIImage(named: "CapitolIcon") != nil {
                Image("CapitolIcon")
                    .renderingMode(.original)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 18, height: 18)
            } else {
                Image(systemName: "building.columns.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(VoteNowColors.primaryCTA)
            }
        }
    }

    private func ballotPartyColor(for party: BallotParty?) -> Color {
        switch party {
        case .democrat:
            return VoteNowColors.richBlue
        case .republican:
            return VoteNowColors.richRed
        default:
            return VoteNowColors.primaryText
        }
    }

    private func shouldOpenMyInfoFromPartyItem(_ party: BallotParty?) -> Bool {
        switch party {
        case .democrat?, .republican?:
            return true
        default:
            return false
        }
    }

    private func styledIncumbentText(_ incumbent: String) -> Text {
        guard let regex = try? NSRegularExpression(pattern: #"\(([DRI])(?:-[A-Za-z0-9]+)?\)"#) else {
            return Text(incumbent).foregroundColor(VoteNowColors.primaryText)
        }

        let source = incumbent as NSString
        let range = NSRange(location: 0, length: source.length)
        let matches = regex.matches(in: incumbent, range: range)
        guard !matches.isEmpty else {
            return Text(incumbent).foregroundColor(VoteNowColors.primaryText)
        }

        var cursor = 0
        var styled = Text("")

        for match in matches {
            if match.range.location > cursor {
                let prefixRange = NSRange(location: cursor, length: match.range.location - cursor)
                let prefix = source.substring(with: prefixRange)
                styled = styled + Text(prefix).foregroundColor(VoteNowColors.primaryText)
            }

            let token = source.substring(with: match.range)
            let partyToken = match.range(at: 1).location != NSNotFound
                ? source.substring(with: match.range(at: 1))
                : ""
            let color: Color
            if partyToken == "D" {
                color = VoteNowColors.richBlue
            } else if partyToken == "R" {
                color = VoteNowColors.richRed
            } else {
                color = VoteNowColors.primaryText
            }
            styled = styled + Text(token).foregroundColor(color)

            cursor = match.range.location + match.range.length
        }

        if cursor < source.length {
            let suffix = source.substring(from: cursor)
            styled = styled + Text(suffix).foregroundColor(VoteNowColors.primaryText)
        }

        return styled
    }

    private func primaryPartyBadge(for election: Election) -> PartyBadgeStyle? {
        guard isPrimaryElection(election) else { return nil }

        switch planVM.selectedParty {
        case .democrat:
            return PartyBadgeStyle(
                title: l("app.timeline.party.democrat", "Democrat"),
                foreground: VoteNowColors.richBlue,
                background: VoteNowColors.infoSurfaceBlue
            )
        case .republican:
            return PartyBadgeStyle(
                title: l("app.timeline.party.republican", "Republican"),
                foreground: VoteNowColors.richRed,
                background: VoteNowColors.infoSurfaceBlue
            )
        case .independent:
            return PartyBadgeStyle(
                title: l("app.timeline.party.independent", "Independent"),
                foreground: VoteNowColors.primaryText,
                background: VoteNowColors.infoSurfaceBlue
            )
        }
    }

    private func ballotDisclosureContent(for election: Election) -> BallotDisclosureContent? {
        let baseContent = datasetBackedBallotDisclosureContent(for: election)
            ?? supplementalBallotDisclosureContent(for: election)
        let mayoralItems = mayoralBallotDisclosureItems(for: election)
        guard baseContent != nil || !mayoralItems.isEmpty else { return nil }

        var content = baseContent ?? BallotDisclosureContent(introText: nil, items: [])

        let stage = ballotStageContext(for: election)
        let stateCode = stateCode(for: election)?.uppercased() ?? ""
        if !isMayoralTimelineCard(election) {
            let stateLegislativeItems = inferredStateLegislativeItems(
                stateCode: stateCode,
                stage: stage,
                existingItems: content.items
            )
            if !stateLegislativeItems.isEmpty {
                content = BallotDisclosureContent(
                    introText: content.introText,
                    items: content.items + stateLegislativeItems
                )
            }
        }

        if !mayoralItems.isEmpty {
            content = BallotDisclosureContent(
                introText: content.introText,
                items: content.items + mayoralItems
            )
        }

        return content
    }

    private struct MayoralBallotMatch {
        let city: String
        let stage: String
        let dateStatus: String
    }

    private func mayoralBallotDisclosureItems(for election: Election) -> [BallotDisclosureItem] {
        var items: [BallotDisclosureItem] = []
        let precision = timelineLocationPrecision()
        let zip = timelinePrimaryZIP()

        let matches = election.flags.compactMap(parseMayoralBallotMatch)
        if !matches.isEmpty {
            let allStages = Array(Set(matches.map(\.stage))).sorted { lhs, rhs in
                mayoralStageSortOrder(lhs) < mayoralStageSortOrder(rhs)
            }

            switch precision {
            case .stateOnly:
                for stage in allStages {
                    items.append(
                        BallotDisclosureItem(
                            id: "mayor-state-only-\(election.id)-\(stage.lowercased())",
                            title: mayoralBallotTitle(forStage: stage),
                            detail: "Mayoral races are city-specific. Enter your full street address to confirm your exact city race eligibility.",
                            party: nil,
                            officeIcon: nil,
                            incumbent: nil
                        )
                    )
                }

            case .zipOrCity, .fullAddress:
                let focus = focusedMayoralCity(from: matches)
                let scopedMatches: [MayoralBallotMatch]
                if let focus {
                    scopedMatches = matches.filter { citiesLooselyMatch($0.city, focus.city) }
                } else {
                    scopedMatches = matches
                }

                let scopedStages = Array(Set(scopedMatches.map(\.stage))).sorted { lhs, rhs in
                    mayoralStageSortOrder(lhs) < mayoralStageSortOrder(rhs)
                }
                let displayStages = scopedStages.isEmpty ? allStages : scopedStages

                for stage in displayStages {
                    var detail: String
                    let stageProjected = scopedMatches.contains {
                        $0.stage == stage && !isScheduledMayoralDateStatus($0.dateStatus)
                    }
                    let projectedSuffix = stageProjected ? " Some city schedules are projected." : ""

                    if let focus {
                        switch precision {
                        case .fullAddress:
                            detail = "\(focus.city) mayor race is shown for your location. Verify city boundary details with your local election office.\(projectedSuffix)"
                        case .zipOrCity:
                            if focus.matchedByHint {
                                if zip.isEmpty {
                                    detail = "Likely mayoral city match: \(focus.city). ZIP and city boundaries can differ, so double-check your exact eligibility with your local election office.\(projectedSuffix)"
                                } else {
                                    detail = "Likely mayoral city match for ZIP \(zip): \(focus.city). ZIP and city boundaries can differ, so double-check your exact eligibility with your local election office.\(projectedSuffix)"
                                }
                            } else {
                                if zip.isEmpty {
                                    detail = "Closest major-city match: \(focus.city). If you are near a city edge, double-check eligibility with your local election office.\(projectedSuffix)"
                                } else {
                                    detail = "Closest major-city match for ZIP \(zip): \(focus.city). If you are near a city edge, double-check eligibility with your local election office.\(projectedSuffix)"
                                }
                            }
                        case .stateOnly:
                            detail = "Mayoral races are city-specific. Enter your full street address to confirm your exact city race eligibility.\(projectedSuffix)"
                        }
                    } else {
                        let cities = Array(Set(matches.map(\.city))).sorted {
                            $0.localizedCaseInsensitiveCompare($1) == .orderedAscending
                        }
                        let preview = cityListPreview(cities, maxVisible: 4)
                        if precision == .zipOrCity, !zip.isEmpty {
                            detail = "Mayoral races near ZIP \(zip) may include \(preview). If you are near a city edge, double-check eligibility with your local election office.\(projectedSuffix)"
                        } else {
                            detail = "City mayor races in \(preview). Verify your city eligibility with your local election office.\(projectedSuffix)"
                        }
                    }

                    items.append(
                        BallotDisclosureItem(
                            id: "mayor-match-\(election.id)-\(stage.lowercased())",
                            title: mayoralBallotTitle(forStage: stage),
                            detail: detail,
                            party: nil,
                            officeIcon: nil,
                            incumbent: nil
                        )
                    )
                }
            }
        }

        if isMayoralTimelineCard(election) {
            let city = election.flags
                .first(where: { $0.hasPrefix("MAYOR_CITY:") })?
                .replacingOccurrences(of: "MAYOR_CITY:", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
                ?? election.name
            let stage = election.flags
                .first(where: { $0.hasPrefix("MAYOR_STAGE:") })?
                .replacingOccurrences(of: "MAYOR_STAGE:", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
                ?? "GENERAL"
            let dateStatus = election.flags
                .first(where: { $0.hasPrefix("MAYOR_DATE_STATUS:") })?
                .replacingOccurrences(of: "MAYOR_DATE_STATUS:", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
                ?? ""

            var detail = "\(city) citywide mayor election."
            switch precision {
            case .stateOnly:
                detail = "Mayoral races are city-specific. Enter your full street address to confirm your exact city race eligibility."
            case .zipOrCity:
                if zip.isEmpty {
                    detail += " ZIP/city lookups are approximate. If you are near a city edge, double-check eligibility with your local election office."
                } else {
                    detail += " ZIP \(zip) is an approximate city match. If you are near a city edge, double-check eligibility with your local election office."
                }
            case .fullAddress:
                detail += " Verify city boundary details with your local election office."
            }
            if !dateStatus.isEmpty && dateStatus.caseInsensitiveCompare("Scheduled") != .orderedSame {
                detail += " Date status: \(dateStatus)."
            }

            items.append(
                BallotDisclosureItem(
                    id: "mayor-city-card-\(election.id)",
                    title: mayoralBallotTitle(forStage: stage),
                    detail: detail,
                    party: nil,
                    officeIcon: nil,
                    incumbent: nil
                )
            )
        }

        return items
    }

    private func parseMayoralBallotMatch(_ flag: String) -> MayoralBallotMatch? {
        guard flag.hasPrefix("MAYOR_MATCH:") else { return nil }

        let payload = flag.replacingOccurrences(of: "MAYOR_MATCH:", with: "")
        let parts = payload.split(separator: "|", omittingEmptySubsequences: false).map(String.init)
        guard !parts.isEmpty else { return nil }

        let city = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
        if city.isEmpty { return nil }

        let stage = parts.count > 1
            ? parts[1].trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            : "GENERAL"
        let dateStatus = parts.count > 2
            ? parts[2].trimmingCharacters(in: .whitespacesAndNewlines)
            : ""

        return MayoralBallotMatch(city: city, stage: stage, dateStatus: dateStatus)
    }

    private func mayoralBallotTitle(forStage stage: String) -> String {
        switch stage.uppercased() {
        case "PRIMARY":
            return l("app.timeline.mayoral.stage.primary", "Mayor Primary")
        case "RUNOFF":
            return l("app.timeline.mayoral.stage.runoff", "Mayor Runoff")
        default:
            return l("app.timeline.mayoral.stage.general", "Mayor General")
        }
    }

    private func mayoralStageSortOrder(_ stage: String) -> Int {
        switch stage.uppercased() {
        case "PRIMARY":
            return 0
        case "RUNOFF":
            return 1
        default:
            return 2
        }
    }

    private func cityListPreview(_ cities: [String], maxVisible: Int) -> String {
        if cities.count <= maxVisible {
            return cities.joined(separator: ", ")
        }

        let visible = cities.prefix(maxVisible).joined(separator: ", ")
        let remaining = cities.count - maxVisible
        return "\(visible), and \(remaining) more"
    }

    private func timelinePrimaryZIP() -> String {
        let fromAddress = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
        if fromAddress.count == 5 {
            return fromAddress
        }

        let fromPlan = String(planVM.zip.filter(\.isNumber).prefix(5))
        if fromPlan.count == 5 {
            return fromPlan
        }

        return ""
    }

    private func timelineCityHint() -> String {
        let fromSelection = repsVM.resolvedLocationSelection?.city?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !fromSelection.isEmpty {
            return fromSelection
        }

        return planVM.userAddress.city.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func timelineLocationPrecision() -> TimelineLocationPrecision {
        let street = planVM.userAddress.street.trimmingCharacters(in: .whitespacesAndNewlines)
        if !street.isEmpty {
            return .fullAddress
        }

        if let selection = repsVM.resolvedLocationSelection,
           selection.source == .address {
            let normalizedAddress = selection.normalizedAddress?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if normalizedAddress.range(of: #"\d"#, options: .regularExpression) != nil {
                return .fullAddress
            }
        }

        if !timelinePrimaryZIP().isEmpty || !timelineCityHint().isEmpty {
            return .zipOrCity
        }

        return .stateOnly
    }

    private func normalizedCityKey(_ raw: String) -> String {
        raw.lowercased()
            .replacingOccurrences(of: #"\bcity\b"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"[^a-z0-9]"#, with: "", options: .regularExpression)
    }

    private func citiesLooselyMatch(_ lhs: String, _ rhs: String) -> Bool {
        let left = normalizedCityKey(lhs)
        let right = normalizedCityKey(rhs)
        guard !left.isEmpty, !right.isEmpty else { return false }
        return left == right || left.contains(right) || right.contains(left)
    }

    private func focusedMayoralCity(from matches: [MayoralBallotMatch]) -> (city: String, matchedByHint: Bool)? {
        let uniqueCities = Array(Set(matches.map(\.city))).sorted {
            $0.localizedCaseInsensitiveCompare($1) == .orderedAscending
        }
        guard !uniqueCities.isEmpty else { return nil }

        let hint = timelineCityHint()
        if !hint.isEmpty,
           let matched = uniqueCities.first(where: { citiesLooselyMatch($0, hint) }) {
            return (city: matched, matchedByHint: true)
        }

        return (city: uniqueCities[0], matchedByHint: false)
    }

    private func isScheduledMayoralDateStatus(_ status: String) -> Bool {
        let normalized = status.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return normalized.isEmpty || normalized == "scheduled"
    }

    private func advisoryMessages(for election: Election) -> [String] {
        var messages: [String] = []
        var seen = Set<String>()

        let closeDateFlags = election.flags.filter { $0.hasPrefix("MAYOR_CLOSE_TO_STATEWIDE:") }
        for flag in closeDateFlags {
            let iso = flag.replacingOccurrences(of: "MAYOR_CLOSE_TO_STATEWIDE:", with: "")
            let message: String
            if let date = Self.isoDate(from: iso) {
                message = "Close to another statewide election window (within \(Self.mayoralCloseWindowDays) days of \(formattedDateText(date)))."
            } else {
                message = "Close to another statewide election window (within \(Self.mayoralCloseWindowDays) days)."
            }

            if seen.insert(message).inserted {
                messages.append(message)
            }
        }

        return messages
    }

    private func isMayoralTimelineCard(_ election: Election) -> Bool {
        election.flags.contains("MAYOR_TIMELINE_CARD")
    }

    private func datasetBackedBallotDisclosureContent(for election: Election) -> BallotDisclosureContent? {
        guard let dataset = eligibilityDataset,
              let state = stateCode(for: election)?.uppercased(),
              let stage = ballotStageContext(for: election),
              let cycleYear = supportedCycleYear(for: election) else {
            return nil
        }

        let applicableStage = stage == .general ? "general" : "primary"
        let candidateRows = dataset.timeline_dataset.filter { row in
            row.state_abbr.uppercased() == state &&
                row.office_family.lowercased() != "mayor" &&
                row.election_stage.lowercased() == applicableStage &&
                rowIsOnBallot(row, forCycleYear: cycleYear) &&
                rowMatchesSelectedParty(row, for: stage)
        }

        if candidateRows.isEmpty {
            return nil
        }

        let sortedRows = candidateRows.sorted { lhs, rhs in
            let leftOffice = officeSortOrder(lhs.office_family)
            let rightOffice = officeSortOrder(rhs.office_family)
            if leftOffice != rightOffice { return leftOffice < rightOffice }

            let leftParty = partySortOrder(lhs.party)
            let rightParty = partySortOrder(rhs.party)
            if leftParty != rightParty { return leftParty < rightParty }

            return lhs.dropdown_label.localizedCaseInsensitiveCompare(rhs.dropdown_label) == .orderedAscending
        }

        let shouldCollapsePartyLabelsForIndependent =
            planVM.selectedParty == .independent && (stage == .primary || stage == .runoff)

        var seenIndependentOfficeFamilies = Set<String>()
        let items = sortedRows.compactMap { row -> BallotDisclosureItem? in
            let item = BallotDisclosureItem(
                id: row.dataset_key,
                title: datasetBallotTitle(
                    for: row,
                    stage: stage,
                    includeParty: !shouldCollapsePartyLabelsForIndependent
                ),
                detail: datasetBallotDetail(
                    for: row,
                    stage: stage,
                    isIndependentView: shouldCollapsePartyLabelsForIndependent
                ),
                party: shouldCollapsePartyLabelsForIndependent ? nil : ballotParty(from: row.party),
                officeIcon: ballotOfficeIcon(for: row.office_family),
                incumbent: incumbentSummary(
                    for: row,
                    stateCode: state,
                    electionYear: Calendar.current.component(.year, from: election.electionDay)
                )
            )

            guard shouldCollapsePartyLabelsForIndependent else {
                return item
            }

            let dedupeKey = row.office_family
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            if seenIndependentOfficeFamilies.contains(dedupeKey) {
                return nil
            }
            seenIndependentOfficeFamilies.insert(dedupeKey)
            return item
        }

        let intro = ballotIntroText(
            for: election,
            stage: stage,
            stateCode: state,
            dataset: dataset
        )

        return BallotDisclosureContent(introText: intro, items: items)
    }

    private func supplementalBallotDisclosureContent(for election: Election) -> BallotDisclosureContent? {
        guard let state = stateCode(for: election)?.uppercased() else { return nil }
        let name = election.name.lowercased()
        let subtitle = election.subtitle.lowercased()
        let intro = supplementalBallotIntroText(for: election, stateCode: state)

        switch state {
        case "AS":
            return BallotDisclosureContent(
                introText: intro,
                items: [
                    supplementalItem(stateCode: state, slug: "gov", title: "Governor and Lieutenant Governor", detail: "Territorywide executive ticket in gubernatorial cycles."),
                    supplementalItem(stateCode: state, slug: "delegate", title: "Delegate to the U.S. House", detail: "Non-voting delegate seat."),
                    supplementalItem(stateCode: state, slug: "fono", title: "American Samoa House (Fono)", detail: "Territorial legislature races.")
                ]
            )
        case "GU":
            return BallotDisclosureContent(
                introText: intro,
                items: [
                    supplementalItem(stateCode: state, slug: "gov", title: "Governor and Lieutenant Governor", detail: "Included in gubernatorial cycles."),
                    supplementalItem(stateCode: state, slug: "delegate", title: "Delegate to the U.S. House", detail: "Non-voting delegate seat."),
                    supplementalItem(stateCode: state, slug: "legislature", title: "Guam Legislature and Territorial Offices", detail: "Can include Legislature, Attorney General, Education Board, and Consolidated Commission on Utilities depending on cycle.")
                ]
            )
        case "MP":
            return BallotDisclosureContent(
                introText: intro,
                items: [
                    supplementalItem(stateCode: state, slug: "executive", title: "Governor, Lieutenant Governor, and Delegate", detail: "Territorywide executive offices and U.S. House delegate."),
                    supplementalItem(stateCode: state, slug: "legislative", title: "CNMI Legislature and Local Offices", detail: "Can include Senate, House, Mayor, Municipal Council, and Board of Education."),
                    supplementalItem(stateCode: state, slug: "judicial", title: "Attorney General and Judicial Retention", detail: "May include attorney general and justice/judge retention races; gubernatorial runoff may occur when required.")
                ]
            )
        case "PR":
            return BallotDisclosureContent(
                introText: intro,
                items: [
                    supplementalItem(stateCode: state, slug: "state", title: "State Ballot", detail: "Governor and Resident Commissioner."),
                    supplementalItem(stateCode: state, slug: "legislative", title: "Legislative Ballot", detail: "1 district representative, 2 district senators, 1 at-large representative, and 1 at-large senator."),
                    supplementalItem(stateCode: state, slug: "municipal", title: "Municipal Ballot", detail: "Mayor and municipal legislators.")
                ]
            )
        case "VI":
            return BallotDisclosureContent(
                introText: intro,
                items: [
                    supplementalItem(stateCode: state, slug: "delegate", title: "Delegate to Congress", detail: "Non-voting delegate seat."),
                    supplementalItem(stateCode: state, slug: "legislature", title: "Legislature and Board Seats", detail: "Can include Legislature/Senate, Board of Education, and Board of Elections seats."),
                    supplementalItem(stateCode: state, slug: "executive", title: "Governor and Lieutenant Governor", detail: "Included in gubernatorial years.")
                ]
            )
        case "KY" where name.contains("2027 gubernatorial"):
            return BallotDisclosureContent(
                introText: intro,
                items: [
                    supplementalItem(stateCode: state, slug: "statewide_exec", title: "Governor Slate and Statewide Executive Offices", detail: "Governor/Lieutenant Governor ticket plus Secretary of State, Attorney General, Auditor, Treasurer, and Commissioner of Agriculture."),
                    supplementalItem(stateCode: state, slug: "state_leg", title: "State Legislature", detail: "All State House seats and odd-numbered State Senate seats."),
                    supplementalItem(stateCode: state, slug: "general_note", title: "Primary vs General", detail: "General election uses the same office set as the primary.")
                ]
            )
        case "LA" where name.contains("2027 gubernatorial"):
            if subtitle.contains("primary") {
                return BallotDisclosureContent(
                    introText: intro,
                    items: [
                        supplementalItem(stateCode: state, slug: "statewide_exec", title: "Statewide Executive Offices", detail: "Governor, Lieutenant Governor, Secretary of State, Attorney General, Treasurer, Commissioner of Agriculture and Forestry, and Commissioner of Insurance."),
                        supplementalItem(stateCode: state, slug: "state_leg", title: "State Legislature", detail: "State Senate and State House races."),
                        supplementalItem(stateCode: state, slug: "bese", title: "BESE General Races", detail: "Board of Elementary and Secondary Education (BESE) general races are on the primary date.")
                    ]
                )
            }

            if subtitle.contains("runoff") || subtitle.contains("general") {
                return BallotDisclosureContent(
                    introText: intro,
                    items: [
                        supplementalItem(stateCode: state, slug: "runoff_scope", title: "Runoff Ballot Scope", detail: "Follow-on ballot for gubernatorial-cycle offices advancing from the primary."),
                        supplementalItem(stateCode: state, slug: "statewide_exec", title: "Included Office Families", detail: "Statewide executive offices and state legislative seats that require a runoff."),
                        supplementalItem(stateCode: state, slug: "bese_note", title: "BESE Timing", detail: "BESE general races are on the primary date, not the runoff date.")
                    ]
                )
            }
            return nil
        case "MS" where name.contains("2027 gubernatorial"):
            return BallotDisclosureContent(
                introText: intro,
                items: [
                    supplementalItem(stateCode: state, slug: "statewide_exec", title: "Statewide Executive Offices", detail: "Governor, Lieutenant Governor, Secretary of State, Attorney General, Auditor, Treasurer, Insurance Commissioner, and Commissioner of Agriculture and Commerce."),
                    supplementalItem(stateCode: state, slug: "state_leg", title: "Legislative and District Offices", detail: "State Senate, State House, Public Service Commissioner district seat, and Transportation Commissioner district seat."),
                    supplementalItem(stateCode: state, slug: "county_local", title: "County and District Offices", detail: "Local ballot can include sheriff, clerks, assessor/collector, coroner, county attorney, surveyor, supervisors, justice court judges, constables, and election commissioners depending on locality.")
                ]
            )
        default:
            return nil
        }
    }

    private func supplementalBallotIntroText(for election: Election, stateCode: String) -> String {
        var notes = [
            "Condensed office list for planning. Final ballot can vary by cycle and locality."
        ]

        if let stage = ballotStageContext(for: election),
           let dataset = eligibilityDataset,
           let supplementalNote = ballotIntroText(
               for: election,
               stage: stage,
               stateCode: stateCode,
               dataset: dataset
           ),
           !supplementalNote.isEmpty {
            notes.append(supplementalNote)
        }

        return notes.joined(separator: "\n")
    }

    private enum StateLegislativeChamber {
        case upper
        case lower
    }

    private func inferredStateLegislativeItems(
        stateCode: String,
        stage: BallotStageContext?,
        existingItems: [BallotDisclosureItem]
    ) -> [BallotDisclosureItem] {
        guard !stateCode.isEmpty else { return [] }
        if ["AS", "GU", "MP", "PR", "VI", "DC"].contains(stateCode) { return [] }
        if hasStateLegislativeItem(existingItems) { return [] }

        let legislativeOfficials = repsVM.stateReps
            .filter { official($0, matches: stateCode) }
            .filter { stateLegislativeChamber(for: $0) != nil }

        if legislativeOfficials.isEmpty {
            return [
                BallotDisclosureItem(
                    id: "state-leg-\(stateCode.lowercased())-\(stageID(stage))",
                    title: stageAwareStateLegislativeTitle(
                        base: l("app.timeline.office.state_legislature", "State Legislature"),
                        stage: stage
                    ),
                    detail: l(
                        "app.timeline.ballot.state_legislature.detail",
                        "District-based State Senate and State House/Assembly races when scheduled."
                    ),
                    party: nil,
                    officeIcon: nil,
                    incumbent: nil
                )
            ]
        }

        let sorted = legislativeOfficials.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        let upper = sorted.first(where: { stateLegislativeChamber(for: $0) == .upper })
        let lower = sorted.first(where: { stateLegislativeChamber(for: $0) == .lower })

        var items: [BallotDisclosureItem] = []

        if let upper {
            items.append(
                BallotDisclosureItem(
                    id: "state-senate-\(stateCode.lowercased())-\(stageID(stage))",
                    title: stageAwareStateLegislativeTitle(
                        base: l("app.timeline.office.state_senate", "State Senate"),
                        stage: stage
                    ),
                    detail: stateLegislativeDetail(
                        for: upper,
                        fallback: l("app.timeline.ballot.state_senate.detail", "State Senate district race.")
                    ),
                    party: nil,
                    officeIcon: nil,
                    incumbent: "\(l("app.timeline.ballot.incumbent.label", "Incumbent")): \(incumbentName(upper))\(incumbentPartySuffix(upper))"
                )
            )
        }

        if let lower {
            items.append(
                BallotDisclosureItem(
                    id: "state-lower-\(stateCode.lowercased())-\(stageID(stage))",
                    title: stageAwareStateLegislativeTitle(
                        base: stateLegislativeLowerChamberLabel(for: lower),
                        stage: stage
                    ),
                    detail: stateLegislativeDetail(
                        for: lower,
                        fallback: l("app.timeline.ballot.state_house_assembly.detail", "State House/Assembly district race.")
                    ),
                    party: nil,
                    officeIcon: nil,
                    incumbent: "\(l("app.timeline.ballot.incumbent.label", "Incumbent")): \(incumbentName(lower))\(incumbentPartySuffix(lower))"
                )
            )
        }

        if items.isEmpty {
            return [
                BallotDisclosureItem(
                    id: "state-leg-\(stateCode.lowercased())-\(stageID(stage))",
                    title: stageAwareStateLegislativeTitle(
                        base: l("app.timeline.office.state_legislature", "State Legislature"),
                        stage: stage
                    ),
                    detail: l(
                        "app.timeline.ballot.state_legislature.detail",
                        "District-based State Senate and State House/Assembly races when scheduled."
                    ),
                    party: nil,
                    officeIcon: nil,
                    incumbent: nil
                )
            ]
        }

        return items
    }

    private func hasStateLegislativeItem(_ items: [BallotDisclosureItem]) -> Bool {
        if items.contains(where: { item in
            item.id.contains("state-leg") || item.id.contains("state-senate") || item.id.contains("state-lower")
        }) {
            return true
        }

        let keywords = [
            "state senate",
            "state house",
            "state assembly",
            "state legislature",
            "house of delegates"
        ]
        return items.contains { item in
            let lower = item.title.lowercased()
            return keywords.contains(where: { lower.contains($0) })
        }
    }

    private func stateLegislativeChamber(for official: Official) -> StateLegislativeChamber? {
        let division = (official.divisionId ?? "").lowercased()
        if division.contains("/sldu:") { return .upper }
        if division.contains("/sldl:") { return .lower }

        let title = (official.officeTitle ?? "").lowercased()
        if title.contains("senate") || title.contains("senator") {
            return .upper
        }
        if title.contains("assembly")
            || title.contains("house of delegates")
            || title.contains("state representative")
            || title.contains("delegate")
            || title.contains("state house")
            || title.contains("assemblymember")
            || title.contains("assembly member") {
            return .lower
        }
        return nil
    }

    private func stateLegislativeLowerChamberLabel(for official: Official) -> String {
        let title = (official.officeTitle ?? "").lowercased()
        if title.contains("house of delegates") || title.contains("delegate") {
            return l("app.timeline.office.state_house_of_delegates", "State House of Delegates")
        }
        if title.contains("assembly") {
            return l("app.timeline.office.state_assembly", "State Assembly")
        }
        return l("app.timeline.office.state_house", "State House")
    }

    private func stateLegislativeDetail(for official: Official, fallback: String) -> String {
        let district = official.district?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !district.isEmpty {
            return district
        }
        return fallback
    }

    private func stageAwareStateLegislativeTitle(base: String, stage: BallotStageContext?) -> String {
        guard let stage else { return base }
        return "\(base) \(stageLabel(for: stage))"
    }

    private func stageID(_ stage: BallotStageContext?) -> String {
        switch stage {
        case .primary:
            return "primary"
        case .runoff:
            return "runoff"
        case .general:
            return "general"
        case .none:
            return "unknown"
        }
    }

    private func supplementalItem(
        stateCode: String,
        slug: String,
        title: String,
        detail: String
    ) -> BallotDisclosureItem {
        BallotDisclosureItem(
            id: "supplemental-\(stateCode.lowercased())-\(slug)",
            title: title,
            detail: detail,
            party: nil,
            officeIcon: nil,
            incumbent: nil
        )
    }

    private func ballotIntroText(
        for election: Election,
        stage: BallotStageContext,
        stateCode: String,
        dataset: ElectionEligibilityDataset
    ) -> String? {
        var notes: [String] = []

        if stage == .runoff {
            notes.append(
                l(
                    "app.timeline.ballot.runoff_intro",
                    "Runoff elections are held when no candidate reaches the required threshold in the primary."
                )
            )
        }

        if (stage == .primary || stage == .runoff), planVM.selectedParty == .independent {
            if let summary = dataset.state_summary.first(where: { $0.state_abbr.uppercased() == stateCode }) {
                let customNote = summary.independent_primary_note?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if !customNote.isEmpty {
                    notes.append(simplifiedIndependentPrimaryNote(customNote))
                } else {
                    let typeText = primaryTypeSummary(for: summary, election: election)
                    if !typeText.isEmpty {
                        notes.append(
                            lf(
                                "app.timeline.ballot.independent.note.with_type",
                                "Independent voters in %@ should expect %@ primary rules. Final primary ballot access can still vary by party rules, so verify with your state election office.",
                                summary.state,
                                typeText
                            )
                        )
                    }
                    notes.append(
                        l(
                            "app.timeline.ballot.independent.note.generic_verify",
                            "Always verify current ballot access rules with your state election office before the primary."
                        )
                    )
                }
            } else if let territoryNote = Self.independentPrimaryTerritoryNotesByCode[stateCode] {
                notes.append(simplifiedIndependentPrimaryNote(territoryNote))
            } else {
                notes.append(
                    l(
                        "app.timeline.ballot.independent.note.generic",
                        "Independent voters should verify current state and party primary ballot rules before voting."
                    )
                )
            }
        }

        let trimmed = notes
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        if trimmed.isEmpty {
            return nil
        }
        return trimmed.joined(separator: "\n")
    }

    private func simplifiedIndependentPrimaryNote(_ raw: String) -> String {
        let chunks = raw
            .split(separator: ".")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        var primaryType: String?
        var independentRule: String?
        var note: String?

        for chunk in chunks {
            let lower = chunk.lowercased()
            if lower.hasPrefix("primary type:") || lower.hasPrefix("primary type :") || lower.hasPrefix("primary type") {
                primaryType = chunk.replacingOccurrences(of: "(?i)^primary\\s*type\\s*:\\s*", with: "", options: .regularExpression)
            } else if lower.hasPrefix("independent voter rule:") {
                independentRule = chunk.replacingOccurrences(of: "(?i)^independent\\s+voter\\s+rule\\s*:\\s*", with: "", options: .regularExpression)
            } else if lower.hasPrefix("note:") {
                note = chunk.replacingOccurrences(of: "(?i)^note\\s*:\\s*", with: "", options: .regularExpression)
            }
        }

        var parts: [String] = []
        if let primaryType, !primaryType.isEmpty {
            parts.append(
                "\(l("app.timeline.ballot.primary_type.label", "Primary Type")): \(normalizedPartyWording(in: primaryType))."
            )
        }
        if let independentRule, !independentRule.isEmpty {
            parts.append(
                "\(l("app.timeline.ballot.independent_rule.label", "Independent voter rule")): \(normalizedPartyWording(in: independentRule))."
            )
        }
        if let note, !note.isEmpty {
            let normalizedNote = normalizedPartyWording(in: note)
            if !shouldSuppressIndependentPrimaryClosingNote(normalizedNote) {
                parts.append("\(l("app.timeline.ballot.note.label", "Note")): \(normalizedNote).")
            }
        }

        if parts.isEmpty {
            let primaryTypeLabel = l("app.timeline.ballot.primary_type.label", "Primary Type")
            let independentRuleLabel = l("app.timeline.ballot.independent_rule.label", "Independent voter rule")
            let noteLabel = l("app.timeline.ballot.note.label", "Note")
            let localized = raw
                .replacingOccurrences(
                    of: "(?i)primary\\s*type\\s*:",
                    with: "\(primaryTypeLabel):",
                    options: .regularExpression
                )
                .replacingOccurrences(
                    of: "(?i)independent\\s+voter\\s+rule\\s*:",
                    with: "\(independentRuleLabel):",
                    options: .regularExpression
                )
                .replacingOccurrences(
                    of: "(?i)note\\s*:",
                    with: "\(noteLabel):",
                    options: .regularExpression
                )
            return normalizedPartyWording(in: localized)
        }

        return parts.joined(separator: " ")
    }

    private func shouldSuppressIndependentPrimaryClosingNote(_ note: String) -> Bool {
        let normalized = note
            .lowercased()
            .replacingOccurrences(of: "\\.", with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if normalized.contains("not fully private like a classic open primary") {
            return true
        }
        if normalized == "closed primary" || normalized.contains("closed primary") {
            return true
        }
        if normalized.contains("one party ballot only") {
            return true
        }
        return false
    }

    private func primaryTypeSummary(for summary: ElectionEligibilityStateSummary, election: Election) -> String {
        let typeFromElection = election.flags
            .first(where: { $0.hasPrefix("ELECTION_TYPE:") })?
            .replacingOccurrences(of: "ELECTION_TYPE:", with: "")
            .uppercased()

        if typeFromElection == "PRESIDENTIAL_PRIMARY" {
            let presidential = summary.presidential_primary_type_2026.trimmingCharacters(in: .whitespacesAndNewlines)
            if !presidential.isEmpty {
                return presidential
            }
        }

        return summary.state_primary_type_2026.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func supportedCycleYear(for election: Election) -> Int? {
        let year = Calendar.current.component(.year, from: election.electionDay)
        if year == 2026 || year == 2028 {
            return year
        }
        return nil
    }

    private func ballotStageContext(for election: Election) -> BallotStageContext? {
        if let rawType = election.flags
            .first(where: { $0.hasPrefix("ELECTION_TYPE:") })?
            .replacingOccurrences(of: "ELECTION_TYPE:", with: "")
            .uppercased() {
            switch rawType {
            case "PRIMARY", "PRESIDENTIAL_PRIMARY":
                return .primary
            case "PRIMARY_RUNOFF", "GENERAL_RUNOFF":
                return .runoff
            case "GENERAL", "PRESIDENTIAL_GENERAL":
                return .general
            default:
                break
            }
        }

        let subtitle = election.subtitle.lowercased()
        if subtitle.contains("runoff") { return .runoff }
        if subtitle.contains("primary") { return .primary }
        if subtitle.contains("general") { return .general }
        return nil
    }

    private func rowIsOnBallot(_ row: ElectionEligibilityTimelineRow, forCycleYear year: Int) -> Bool {
        let flag = year == 2026 ? row.on_ballot_in_2026_cycle : row.on_ballot_in_2028_cycle
        return flag.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "yes"
    }

    private func rowMatchesSelectedParty(_ row: ElectionEligibilityTimelineRow, for stage: BallotStageContext) -> Bool {
        if stage == .general {
            return row.party.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() == "N/A"
        }

        let normalizedParty = row.party.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch planVM.selectedParty {
        case .democrat:
            return normalizedParty == "democratic"
        case .republican:
            return normalizedParty == "republican"
        case .independent:
            return normalizedParty == "democratic" || normalizedParty == "republican"
        }
    }

    private func datasetBallotTitle(
        for row: ElectionEligibilityTimelineRow,
        stage: BallotStageContext,
        includeParty: Bool
    ) -> String {
        let office = officeTitleWithContextEmoji(for: row.office_family)
        let stageLabel = stageLabel(for: stage)
        let partyLabel = normalizedPartyLabel(row.party)

        if includeParty, !partyLabel.isEmpty, stage != .general {
            return "\(office) \(partyLabel) \(stageLabel)"
        }

        return "\(office) \(stageLabel)"
    }

    private func datasetBallotDetail(
        for row: ElectionEligibilityTimelineRow,
        stage _: BallotStageContext,
        isIndependentView _: Bool
    ) -> String {
        if let localized = localizedKnownEligibilitySummary(row.eligibility_summary) {
            return localized
        }
        return normalizedPartyWording(in: normalizeGeneralElectionAbbreviation(in: row.eligibility_summary))
    }

    private func localizedKnownEligibilitySummary(_ raw: String) -> String? {
        let normalized = raw
            .replacingOccurrences(of: "’", with: "'")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !normalized.isEmpty else { return nil }

        if normalized.range(
            of: "(?i)^any eligible registered voter in the state may vote in the (?:gen\\.?|general) election\\.?$",
            options: .regularExpression
        ) != nil {
            return l(
                "app.timeline.ballot.general.eligible_voter_state",
                "Any eligible registered voter in the state may vote in the general election."
            )
        }

        if normalized.range(
            of: "(?i)^any eligible registered voter in the state may vote in the u\\.s\\. senate general election when a senate seat is on that state's ballot\\.?$",
            options: .regularExpression
        ) != nil {
            return l(
                "app.timeline.ballot.general.eligible_voter_state_senate",
                "Any eligible registered voter in the state may vote in the U.S. Senate general election when a Senate seat is on that state's ballot."
            )
        }

        if normalized.range(
            of: "(?i)^any eligible registered voter in the voter's u\\.s\\. house district may vote when that district's seat is on the ballot\\.?$",
            options: .regularExpression
        ) != nil {
            return l(
                "app.timeline.ballot.general.eligible_voter_house_district",
                "Any eligible registered voter in the voter's U.S. House district may vote when that district's seat is on the ballot."
            )
        }

        if normalized.range(
            of: "(?i)^this is an at-large u\\.s\\. house state; any eligible registered voter in the state may vote when the seat is on the ballot\\.?$",
            options: .regularExpression
        ) != nil {
            return l(
                "app.timeline.ballot.general.eligible_voter_house_at_large",
                "This is an at-large U.S. House state; any eligible registered voter in the state may vote when the seat is on the ballot."
            )
        }

        if normalized.range(
            of: "(?i)^only eligible registered voters who reside in the municipality may vote in a mayoral election\\.?$",
            options: .regularExpression
        ) != nil {
            return l(
                "app.timeline.ballot.general.eligible_voter_municipal_mayor",
                "Only eligible registered voters who reside in the municipality may vote in a mayoral election."
            )
        }

        return nil
    }

    private func normalizeGeneralElectionAbbreviation(in text: String) -> String {
        text.replacingOccurrences(
            of: "(?i)\\bgen\\.\\s+election\\b",
            with: l("app.timeline.ballot.general_election.term", "general election"),
            options: .regularExpression
        )
    }

    private func ballotParty(from rawParty: String) -> BallotParty? {
        switch rawParty.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "democratic":
            return .democrat
        case "republican":
            return .republican
        case "n/a":
            return nil
        default:
            return .other
        }
    }

    private func normalizedPartyLabel(_ rawParty: String) -> String {
        switch rawParty.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "democratic":
            return l("app.timeline.party.democrat", "Democrat")
        case "republican":
            return l("app.timeline.party.republican", "Republican")
        default:
            return ""
        }
    }

    private func stageLabel(for stage: BallotStageContext) -> String {
        switch stage {
        case .primary:
            return l("app.timeline.stage.primary", "Primary")
        case .runoff:
            return l("app.timeline.stage.runoff", "Runoff")
        case .general:
            return l("app.timeline.stage.general", "General")
        }
    }

    private func officeTitleWithContextEmoji(for officeFamily: String) -> String {
        switch officeFamily.lowercased() {
        case "president":
            return l("app.timeline.office.presidential.white_house", "Presidential (White House)")
        case "governor":
            return l("app.timeline.office.governor", "Governor")
        case "us_senate":
            return l("app.timeline.office.us_senate.congress", "U.S. Senate (Congress)")
        case "us_house":
            return l("app.timeline.office.us_house.congress", "U.S. House (Congress)")
        case "state_legislature":
            return l("app.timeline.office.state_legislature", "State Legislature")
        case "statewide_exec":
            return l("app.guide.office.statewide_exec", "Statewide Executive Offices")
        case "judicial":
            return l("app.guide.office.judicial", "Judicial Offices")
        case "local":
            return l("app.guide.office.local", "Local Offices")
        case "ballot_measures":
            return l("app.guide.office.ballot_measures", "Ballot Measures")
        default:
            return l("app.timeline.office.election", "Election")
        }
    }

    private func ballotOfficeIcon(for officeFamily: String) -> BallotOfficeIcon? {
        switch officeFamily.lowercased() {
        case "president":
            return .whiteHouse
        case "us_senate", "us_house":
            return .congress
        default:
            return nil
        }
    }

    private func normalizedPartyWording(in text: String) -> String {
        text
            .replacingOccurrences(of: "(?i)\\bdemocratic\\b", with: "Democrat", options: .regularExpression)
            .replacingOccurrences(of: "(?i)\\brepublican\\b", with: "Republican", options: .regularExpression)
            .replacingOccurrences(of: "(?i)\\busually\\s+", with: "", options: .regularExpression)
            .replacingOccurrences(of: "\\s{2,}", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+([,.])", with: "$1", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func incumbentSummary(for row: ElectionEligibilityTimelineRow, stateCode: String, electionYear: Int) -> String? {
        let normalizedOffice = row.office_family.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch normalizedOffice {
        case "president":
            guard let official = incumbentPresident() else { return nil }
            return "\(l("app.timeline.ballot.incumbent.label", "Incumbent")): \(incumbentName(official))\(incumbentPartySuffix(official))"
        case "governor":
            guard let official = incumbentGovernor(for: stateCode) else { return nil }
            return "\(l("app.timeline.ballot.incumbent.label", "Incumbent")): \(incumbentName(official))\(incumbentPartySuffix(official))"
        case "us_house":
            guard let official = incumbentUSHouse(for: stateCode) else { return nil }
            return "\(l("app.timeline.ballot.incumbent.label", "Incumbent")): \(incumbentName(official))\(incumbentUSHousePartyDistrictSuffix(official))"
        case "us_senate":
            let officials = incumbentUSSenators(for: stateCode)
            guard !officials.isEmpty else { return nil }
            let targetClass = senateClass(from: row.cycle_rule) ?? senateClass(forElectionYear: electionYear)
            if let targetClass,
               let matched = officials.first(where: { senateClass(from: $0) == targetClass }) {
                return "\(l("app.timeline.ballot.incumbent.label", "Incumbent")): \(incumbentName(matched))\(incumbentPartySuffix(matched))"
            }

            let fallback = officials.sorted(by: senateIncumbentSort).first
            guard let fallback else { return nil }
            return "\(l("app.timeline.ballot.incumbent.label", "Incumbent")): \(incumbentName(fallback))\(incumbentPartySuffix(fallback))"
        default:
            return nil
        }
    }

    private func senateClass(forElectionYear electionYear: Int) -> Int? {
        let normalizedRemainder = ((electionYear % 6) + 6) % 6
        switch normalizedRemainder {
        case 2: return 1
        case 4: return 2
        case 0: return 3
        default: return nil
        }
    }

    private func senateClass(from text: String?) -> Int? {
        let normalized = text?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased() ?? ""
        guard !normalized.isEmpty else { return nil }

        if normalized.contains("class iii") || normalized.contains("class 3") {
            return 3
        }
        if normalized.contains("class ii") || normalized.contains("class 2") {
            return 2
        }
        if normalized.contains("class i") || normalized.contains("class 1") {
            return 1
        }
        return nil
    }

    private func senateIncumbentSort(_ lhs: Official, _ rhs: Official) -> Bool {
        let leftClass = senateClass(from: lhs)
        let rightClass = senateClass(from: rhs)
        if leftClass != rightClass {
            return (leftClass ?? .max) < (rightClass ?? .max)
        }
        return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
    }

    private func senateClass(from official: Official) -> Int? {
        senateClass(from: official.officeTitle)
    }

    private func incumbentPresident() -> Official? {
        if let explicit = repsVM.executiveReps.first(where: isPresidentOfficial) {
            return explicit
        }
        return repsVM.executiveReps.first
    }

    private func incumbentGovernor(for stateCode: String) -> Official? {
        if let explicit = repsVM.stateReps.first(where: { isGovernorOfficial($0) && official($0, matches: stateCode) }) {
            return explicit
        }
        return repsVM.stateReps.first(where: { isGovernorOfficial($0) })
    }

    private func incumbentUSHouse(for stateCode: String) -> Official? {
        if let explicit = repsVM.federalReps.first(where: { isUSHouseOfficial($0) && official($0, matches: stateCode) }) {
            return explicit
        }
        return repsVM.federalReps.first(where: isUSHouseOfficial)
    }

    private func incumbentUSSenators(for stateCode: String) -> [Official] {
        let stateSpecific = repsVM.federalReps.filter { isUSSenateOfficial($0) && official($0, matches: stateCode) }
        if !stateSpecific.isEmpty {
            return stateSpecific.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        }
        return repsVM.federalReps
            .filter(isUSSenateOfficial)
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private func isPresidentOfficial(_ official: Official) -> Bool {
        let title = (official.officeTitle ?? "").lowercased()
        if title.contains("vice") { return false }
        if title.contains("president") { return true }
        let name = official.name.lowercased()
        return name.contains("president") && !name.contains("vice")
    }

    private func isGovernorOfficial(_ official: Official) -> Bool {
        let title = (official.officeTitle ?? "").lowercased()
        if title.contains("lieutenant") && title.contains("governor") { return false }
        return title.contains("governor")
    }

    private func isUSHouseOfficial(_ official: Official) -> Bool {
        let division = (official.divisionId ?? "").lowercased()
        if division.contains("/cd:") {
            return true
        }
        let title = (official.officeTitle ?? "").lowercased()
        return title.contains("representative") || title.contains("delegate")
    }

    private func isUSSenateOfficial(_ official: Official) -> Bool {
        let division = (official.divisionId ?? "").lowercased()
        if division.contains("/cd:") {
            return false
        }
        if division.contains("/state:") {
            return true
        }
        let title = (official.officeTitle ?? "").lowercased()
        return title.contains("senate") || title.contains("senator")
    }

    private func official(_ official: Official, matches stateCode: String) -> Bool {
        guard let officialState = stateCodeFromDivisionID(official.divisionId) else { return true }
        return officialState == stateCode.uppercased()
    }

    private func stateCodeFromDivisionID(_ divisionID: String?) -> String? {
        guard let lower = divisionID?.lowercased(),
              let range = lower.range(of: "/state:") else {
            return nil
        }

        let suffix = lower[range.upperBound...]
        let code = suffix.prefix { $0.isLetter }
        guard code.count == 2 else { return nil }
        return String(code).uppercased()
    }

    private func incumbentName(_ official: Official) -> String {
        let trimmed = official.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return official.name }
        return official.assetName
    }

    private func incumbentPartySuffix(_ official: Official) -> String {
        guard let party = partyAbbreviation(from: official.party) else { return "" }
        return " (\(party))"
    }

    private func incumbentUSHousePartyDistrictSuffix(_ official: Official) -> String {
        guard let party = partyAbbreviation(from: official.party) else { return "" }
        guard let district = usHouseDistrictLabel(from: official.divisionId) else {
            return " (\(party))"
        }
        return " (\(party)-\(district))"
    }

    private func usHouseDistrictLabel(from divisionID: String?) -> String? {
        guard let lower = divisionID?.lowercased(),
              let range = lower.range(of: "/cd:") else {
            return nil
        }

        let suffix = lower[range.upperBound...]
        let rawDistrict = suffix.prefix { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }
        guard !rawDistrict.isEmpty else { return nil }

        let normalized = String(rawDistrict)
            .replacingOccurrences(of: "_", with: "")
            .replacingOccurrences(of: "-", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
        guard !normalized.isEmpty else { return nil }

        if normalized == "ATLARGE" {
            return "AL"
        }

        let numericOnly = normalized.filter(\.isNumber)
        if let districtNumber = Int(numericOnly), !numericOnly.isEmpty {
            return String(districtNumber)
        }

        return normalized
    }

    private func partyAbbreviation(from rawParty: String?) -> String? {
        let normalized = rawParty?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased() ?? ""

        if normalized.contains("democrat") {
            return "D"
        }
        if normalized.contains("republican") {
            return "R"
        }
        if normalized.contains("independent") {
            return "I"
        }
        return nil
    }

    private func officeSortOrder(_ officeFamily: String) -> Int {
        switch officeFamily.lowercased() {
        case "president":
            return 0
        case "governor":
            return 1
        case "us_senate":
            return 2
        case "us_house":
            return 3
        default:
            return 99
        }
    }

    private func partySortOrder(_ party: String) -> Int {
        switch party.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "democratic":
            return 0
        case "republican":
            return 1
        default:
            return 2
        }
    }

    private func detailRow(label: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundColor(VoteNowColors.mutedText)
            Spacer(minLength: 8)
            Text(value)
                .font(.caption)
                .foregroundColor(VoteNowColors.primaryText)
                .multilineTextAlignment(.trailing)
        }
    }

    private func handleFlagTap(for election: Election) {
        pendingFlagElection = election
    }

    private func openFeedbackComposer(for election: Election) {
        feedbackPrefillMessage = [
            "Election timeline report:",
            "Election: \(cardTitle(for: election))",
            "State: \(stateName(for: election))",
            "Election Day: \(formattedDateText(election.electionDay))",
            "Issue:"
        ].joined(separator: "\n")
        showingFeedbackComposer = true
    }

    private func shareElectionCard(for election: Election) {
        guard let shareDay = Self.deepLinkDateFormatter.date(from: Self.deepLinkDateFormatter.string(from: election.electionDay)) else {
            logger.error("Failed to build election share payload.")
            return
        }

        let dayText = Self.shareCardDateFormatter.string(from: election.electionDay)
        let badgeDayText = formattedDateText(election.electionDay)
        let stateText = stateName(for: election)
        let electionTypeText = electionTypeToken(for: election)
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
        let registrationText = registrationDeadlineText(for: election)
        let earlyVoting = earlyVotingText(for: election)

        var details: [URLQueryItem] = [
            URLQueryItem(name: "eid", value: election.id),
            URLQueryItem(name: "type", value: electionTypeToken(for: election)),
            URLQueryItem(name: "day", value: Self.deepLinkDateFormatter.string(from: shareDay)),
            URLQueryItem(name: "election", value: headerTitle(for: election)),
            URLQueryItem(name: "registration", value: registrationText),
            URLQueryItem(name: "early_voting", value: earlyVoting)
        ]
        if let code = stateCode(for: election), !code.isEmpty {
            details.append(URLQueryItem(name: "state", value: code.uppercased()))
        }
        details.append(URLQueryItem(name: "state_name", value: stateText))

        let payload = VoteNowShareCardPayload(
            cardType: .election,
            target: .election,
            title: "Upcoming Election: \(headerTitle(for: election))",
            subtitle: "Election Day is \(dayText). \(electionTypeText). Registration deadline: \(registrationText).",
            cta: "View Election Details",
            badge: "\(stateText) · \(badgeDayText)",
            campaign: "send-to-friend",
            details: details
        )

        shareItems = VoteNowShareComposer.activityItems(for: payload)
        showingShareSheet = true
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
        if subtitle.contains("runoff") {
            return "PRIMARY_RUNOFF"
        }
        if subtitle.contains("primary") {
            return "PRIMARY"
        }
        if subtitle.contains("general") {
            return "GENERAL"
        }
        return "ELECTION"
    }

    private static let deepLinkDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let shareCardDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale.current
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "EEEE, MMM d, yyyy"
        return formatter
    }()

    private static let timelineYearFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale.current
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy"
        return formatter
    }()

    private static let timelineMonthDayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale.current
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "MMM d"
        return formatter
    }()

    private func stateName(for election: Election) -> String {
        let explicit = election.jurisdictionName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !explicit.isEmpty {
            return explicit
        }

        if let code = stateCode(for: election),
           let resolved = Self.stateNameByCode[code] {
            return resolved
        }

        return l("app.timeline.statewide", "Statewide")
    }

    private func cardTitle(for election: Election) -> String {
        let name = election.name.trimmingCharacters(in: .whitespacesAndNewlines)
        if !name.isEmpty {
            return name
        }
        return election.subtitle
    }

    private func cardSecondaryText(for election: Election) -> String? {
        let level = humanReadableJurisdictionLevel(election.jurisdictionLevel)
        let subtitle = localizedMayoralTimelineSubtitleIfNeeded(
            election.subtitle.trimmingCharacters(in: .whitespacesAndNewlines)
        )

        var parts: [String] = []
        if !subtitle.isEmpty, subtitle.caseInsensitiveCompare(cardTitle(for: election)) != .orderedSame {
            parts.append(subtitle)
        }
        if let level, level.lowercased() != "statewide" {
            parts.append(level)
        }

        return parts.isEmpty ? nil : parts.joined(separator: " - ")
    }

    private func badgeText(for election: Election) -> String? {
        let subtitle = election.subtitle.lowercased()
        if subtitle.contains("runoff") { return "Runoff" }
        if subtitle.contains("special") { return "Special" }
        if subtitle.contains("local") { return "Local" }
        if subtitle.contains("primary") { return "Primary" }
        if subtitle.contains("general") { return "General" }

        let level = election.jurisdictionLevel.lowercased()
        if level.contains("local") || level.contains("city") || level.contains("district") {
            return "Local"
        }

        return nil
    }

    private func humanReadableJurisdictionLevel(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return trimmed
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
    }

    private func chancesToVoteUntilNextPresident(in elections: [Election]) -> Int {
        guard !elections.isEmpty else { return 0 }

        if let nextPresidentialGeneral = elections.first(where: isPresidentialGeneralElection) {
            return elections.filter { $0.electionDay <= nextPresidentialGeneral.electionDay }.count
        }
        return elections.count
    }

    private func isPresidentialGeneralElection(_ election: Election) -> Bool {
        if let type = election.flags
            .first(where: { $0.hasPrefix("ELECTION_TYPE:") })?
            .replacingOccurrences(of: "ELECTION_TYPE:", with: "")
            .uppercased(),
           type == "PRESIDENTIAL_GENERAL" {
            return true
        }

        let combined = "\(election.name) \(election.subtitle)".lowercased()
        return combined.contains("presidential") && combined.contains("general")
    }

    private func timelineTopTitle(for election: Election) -> String {
        let raw = headerTitle(for: election)
        return raw
            .replacingOccurrences(of: "\n", with: " ")
            .replacingOccurrences(of: "\\b20\\d{2}\\b", with: "", options: .regularExpression)
            .replacingOccurrences(of: "\\s{2,}", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func timelinePlotPoints(
        for sorted: [Election],
        minDay: Date,
        totalSpanDays: Int,
        usableWidth: CGFloat,
        xPadding: CGFloat
    ) -> [TimelinePlotPoint] {
        var points: [TimelinePlotPoint] = []
        var lastPlacedX: CGFloat = -.greatestFiniteMagnitude
        var lastPointOffsetX: CGFloat = 0
        var titleLaneLastX = Array(repeating: -CGFloat.greatestFiniteMagnitude, count: 5)
        var bottomLaneLastX = Array(repeating: -CGFloat.greatestFiniteMagnitude, count: 3)
        let pointMinSeparation: CGFloat = 24
        let minPointX = xPadding + 3
        let maxPointX = xPadding + usableWidth - 3
        let titleMinSeparation: CGFloat = 56
        let bottomMinSeparation: CGFloat = 48
        let titleLaneOffsets: [CGFloat] = [0, 10, -10, 16, -16]
        let bottomLaneOffsets: [CGFloat] = [0, 8, -8]

        for (sequenceIndex, election) in sorted.enumerated() {
            let baseX = timelineXPosition(
                for: election.electionDay,
                minDay: minDay,
                totalSpanDays: totalSpanDays,
                usableWidth: usableWidth,
                xPadding: xPadding
            )

            var pointX = baseX
            if abs(pointX - lastPlacedX) < pointMinSeparation {
                let direction: CGFloat = lastPointOffsetX <= 0 ? 1 : -1
                pointX = lastPlacedX + (direction * pointMinSeparation)
            }
            pointX = min(max(pointX, minPointX), maxPointX)
            let pointOffsetX = pointX - baseX

            let titleLane = selectLane(
                for: pointX,
                laneLastX: titleLaneLastX,
                minSeparation: titleMinSeparation
            )
            let titleOffsetX = titleLaneOffsets[titleLane]
            titleLaneLastX[titleLane] = pointX + titleOffsetX

            let bottomLane = selectLane(
                for: pointX,
                laneLastX: bottomLaneLastX,
                minSeparation: bottomMinSeparation
            )
            let bottomOffsetX = bottomLaneOffsets[bottomLane]
            bottomLaneLastX[bottomLane] = pointX + bottomOffsetX

            points.append(
                TimelinePlotPoint(
                    id: election.id,
                    election: election,
                    sequenceIndex: sequenceIndex,
                    electionX: baseX,
                    pointOffsetX: pointOffsetX,
                    titleOffsetX: titleOffsetX,
                    bottomOffsetX: bottomOffsetX,
                    titleLane: titleLane,
                    bottomLane: bottomLane
                )
            )

            lastPlacedX = pointX
            lastPointOffsetX = pointOffsetX
        }

        return points
    }

    private func selectLane(
        for x: CGFloat,
        laneLastX: [CGFloat],
        minSeparation: CGFloat
    ) -> Int {
        if let lane = laneLastX.firstIndex(where: { (x - $0) >= minSeparation }) {
            return lane
        }
        return laneLastX.enumerated().min(by: { lhs, rhs in lhs.element < rhs.element })?.offset ?? 0
    }

    private func timelineXPosition(
        for date: Date,
        minDay: Date,
        totalSpanDays: Int,
        usableWidth: CGFloat,
        xPadding: CGFloat
    ) -> CGFloat {
        let day = Calendar.current.startOfDay(for: date)
        let delta = Calendar.current.dateComponents([.day], from: minDay, to: day).day ?? 0
        let clamped = max(0, min(totalSpanDays, delta))
        let fraction = CGFloat(clamped) / CGFloat(max(1, totalSpanDays))
        return xPadding + (fraction * usableWidth)
    }

    private func timelineYearMarkers(minDay: Date, maxDay: Date) -> [TimelineYearMarker] {
        let calendar = Calendar.current
        let startYear = calendar.component(.year, from: minDay)
        let endYear = calendar.component(.year, from: maxDay)
        guard endYear > startYear else { return [] }

        var markers: [TimelineYearMarker] = []
        for year in (startYear + 1)...endYear {
            guard let janStart = calendar.date(from: DateComponents(year: year, month: 1, day: 1)) else {
                continue
            }
            markers.append(TimelineYearMarker(year: year, markerDay: janStart))
        }
        return markers
    }

    private func timelineDotOpacity(distance: Int) -> Double {
        max(0.88, 1 - (Double(distance) * 0.06))
    }

    private func updateFocusedTimelineElection() {
        guard !visibleElections.isEmpty else {
            focusedTimelineElectionID = nil
            return
        }

        if Date() < manualFocusExpiresAt,
           let manualID = manualFocusedElectionID,
           visibleElections.contains(where: { $0.id == manualID }) {
            focusedTimelineElectionID = manualID
            return
        }
        manualFocusedElectionID = nil

        let orderedFrames: [(id: String, frame: CGRect)] = visibleElections.compactMap { election in
            guard let frame = timelineCardFrames[election.id] else { return nil }
            return (id: election.id, frame: frame)
        }

        if !orderedFrames.isEmpty {
            if let lastElectionID = visibleElections.last?.id,
               let lastFrame = timelineCardFrames[lastElectionID] {
                let trailingGap = timelineViewportFrame.maxY - lastFrame.maxY
                if trailingGap >= 8 {
                    focusedTimelineElectionID = lastElectionID
                    return
                }
            }

            let contentTop = orderedFrames.map(\.frame.minY).min() ?? timelineViewportFrame.minY
            let contentBottom = orderedFrames.map(\.frame.maxY).max() ?? timelineViewportFrame.maxY
            let edgeThreshold: CGFloat = 28

            if let last = orderedFrames.last {
                let lastVisibleHeight = max(0, timelineViewportFrame.maxY - max(last.frame.minY, timelineViewportFrame.minY))
                let lastVisibleRatio = lastVisibleHeight / max(1, last.frame.height)
                if timelineViewportFrame.maxY >= (contentBottom - edgeThreshold) || lastVisibleRatio >= 0.52 {
                    focusedTimelineElectionID = last.id
                    return
                }
            }

            if let first = orderedFrames.first {
                let firstVisibleHeight = max(0, min(first.frame.maxY, timelineViewportFrame.maxY) - timelineViewportFrame.minY)
                let firstVisibleRatio = firstVisibleHeight / max(1, first.frame.height)
                if timelineViewportFrame.minY <= (contentTop + edgeThreshold) || firstVisibleRatio >= 0.52 {
                    focusedTimelineElectionID = first.id
                    return
                }
            }

            let viewportFrames = orderedFrames.filter { entry in
                entry.frame.maxY >= timelineViewportFrame.minY && entry.frame.minY <= timelineViewportFrame.maxY
            }
            let candidateFrames = viewportFrames.isEmpty ? orderedFrames : viewportFrames

            let targetY = timelineViewportFrame.midY
            if let closest = candidateFrames.min(by: { lhs, rhs in
                abs(lhs.frame.midY - targetY) < abs(rhs.frame.midY - targetY)
            }) {
                focusedTimelineElectionID = closest.id
                return
            }
        }

        let validIDs = Set(visibleElections.map(\.id))
        if focusedTimelineElectionID == nil || !validIDs.contains(focusedTimelineElectionID ?? "") {
            focusedTimelineElectionID = visibleElections.first?.id
        }
    }

    private func cardScale(for electionID: String) -> CGFloat {
        let progress = abs(cardCarouselProgress(for: electionID))
        return max(0.91, 1 - (progress * 0.09))
    }

    private func cardTiltAngle(for electionID: String) -> Double {
        Double(cardCarouselProgress(for: electionID) * 12.0)
    }

    private func cardHorizontalOffset(for electionID: String) -> CGFloat {
        -cardCarouselProgress(for: electionID) * 12
    }

    private func cardOpacity(for electionID: String) -> Double {
        max(0.78, 1 - (Double(abs(cardCarouselProgress(for: electionID))) * 0.22))
    }

    private func cardZIndex(for electionID: String) -> Double {
        20 - Double(abs(cardCarouselProgress(for: electionID)) * 20)
    }

    private func cardCarouselProgress(for electionID: String) -> CGFloat {
        guard let frame = timelineCardFrames[electionID], timelineViewportFrame.height > 1 else {
            return 0
        }

        let focusY = timelineViewportFrame.midY
        let maxDistance = max(1, timelineViewportFrame.height * 0.7)
        let progress = (frame.midY - focusY) / maxDistance
        return min(1, max(-1, progress))
    }

    private func openMyInfoPanel() {
        NotificationCenter.default.post(name: .openMyInfoPanel, object: nil)
    }

    private func loadElectionsIfNeeded() {
        guard !didLoadBundleData else { return }
        didLoadBundleData = true
        timelineLoadState = .loading
        errorMessage = nil

        ElectionTimelineBundleLoader.shared.loadInitialData { loadedEligibilityDataset, loadedElections, loadFailureMessage in
            eligibilityDataset = loadedEligibilityDataset
            allElections = loadedElections
            if let loadFailureMessage {
                timelineLoadState = .failure
                visibleElections = []
                focusedTimelineElectionID = nil
                timelineCardFrames.removeAll()
                errorMessage = loadFailureMessage
                return
            }
            guard !loadedElections.isEmpty else {
                timelineLoadState = .failure
                visibleElections = []
                focusedTimelineElectionID = nil
                timelineCardFrames.removeAll()
                errorMessage = dataLoadFailureMessage
                return
            }
            timelineLoadState = .success
            applyFilter()
        }
    }

    private func retryTimelineLoad() {
        allElections = []
        visibleElections = []
        focusedTimelineElectionID = nil
        timelineCardFrames.removeAll()
        errorMessage = nil
        didLoadBundleData = false
        loadElectionsIfNeeded()
    }

    private func applyFilter() {
        guard timelineLoadState == .success else { return }

        guard !allElections.isEmpty else {
            timelineLoadState = .failure
            errorMessage = dataLoadFailureMessage
            visibleElections = []
            focusedTimelineElectionID = nil
            timelineCardFrames.removeAll()
            return
        }

        errorMessage = nil

        let targetStateCodes = resolveStateCodes(from: "")

        guard !targetStateCodes.isEmpty else {
            visibleElections = []
            focusedTimelineElectionID = nil
            timelineCardFrames.removeAll()
            errorMessage = unresolvedLocationMessage
            return
        }

        let today = Calendar.current.startOfDay(for: Date())
        let filtered = allElections.filter { election in
            guard let stateCode = stateCode(for: election) else { return false }
            return targetStateCodes.contains(stateCode) && election.electionDay >= today
        }
        .sorted { lhs, rhs in
            if lhs.electionDay != rhs.electionDay { return lhs.electionDay < rhs.electionDay }
            return lhs.name < rhs.name
        }

        let streamlined = streamlineMayoralCards(in: filtered)
        visibleElections = streamlined
        planVM.upcomingElections = streamlined
        timelineCardFrames.removeAll()
        if !streamlined.contains(where: { $0.id == focusedTimelineElectionID }) {
            focusedTimelineElectionID = streamlined.first?.id
        }
    }

    private func streamlineMayoralCards(in elections: [Election]) -> [Election] {
        let precision = timelineLocationPrecision()
        let mayoralCards = elections.filter { isMayoralTimelineCard($0) }
        guard !mayoralCards.isEmpty else { return elections }

        let hint = timelineCityHint()
        let focusCity: String? = {
            if !hint.isEmpty,
               let matched = mayoralCards
               .compactMap(mayoralCityName)
               .first(where: { citiesLooselyMatch($0, hint) }) {
                return matched
            }

            return mayoralCards
                .sorted { lhs, rhs in
                    if lhs.electionDay != rhs.electionDay { return lhs.electionDay < rhs.electionDay }
                    return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
                }
                .compactMap(mayoralCityName)
                .first
        }()

        var seenMayoralKeys = Set<String>()
        var keptFallbackMayoral = false
        var output: [Election] = []

        for election in elections {
            guard isMayoralTimelineCard(election) else {
                output.append(election)
                continue
            }

            if precision == .stateOnly {
                continue
            }

            if let focusCity {
                guard let city = mayoralCityName(election),
                      citiesLooselyMatch(city, focusCity) else {
                    continue
                }
            } else if precision == .zipOrCity {
                if keptFallbackMayoral {
                    continue
                }
                keptFallbackMayoral = true
            }

            let dedupeKey = mayoralTimelineDedupKey(for: election)
            if seenMayoralKeys.contains(dedupeKey) {
                continue
            }
            seenMayoralKeys.insert(dedupeKey)
            output.append(election)
        }

        return output
    }

    private func mayoralCityName(_ election: Election) -> String? {
        let city = election.flags
            .first(where: { $0.hasPrefix("MAYOR_CITY:") })?
            .replacingOccurrences(of: "MAYOR_CITY:", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return city.isEmpty ? nil : city
    }

    private func mayoralStageName(_ election: Election) -> String {
        election.flags
            .first(where: { $0.hasPrefix("MAYOR_STAGE:") })?
            .replacingOccurrences(of: "MAYOR_STAGE:", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased() ?? "GENERAL"
    }

    private func mayoralTimelineDedupKey(for election: Election) -> String {
        let state = stateCode(for: election)?.uppercased() ?? ""
        let day = Self.deepLinkDateFormatter.string(from: election.electionDay)
        let stage = mayoralStageName(election)
        let city = mayoralCityName(election)?.lowercased() ?? ""
        return "\(state)|\(day)|\(stage)|\(city)"
    }

    private func resolveStateCodes(from query: String) -> Set<String> {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)

        if trimmed.isEmpty {
            if let stateFromZip = stateResolver.stateCode(for: planVM.zip) {
                return [stateFromZip]
            }
            let entered = planVM.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !entered.isEmpty else {
                return []
            }
            return resolveStateCodes(from: entered)
        }

        if let zipState = stateResolver.stateCode(for: trimmed) {
            return [zipState]
        }

        if trimmed.count == 2 {
            let code = trimmed.uppercased()
            if Self.knownStateOrTerritoryCodes.contains(code) {
                return [code]
            }
            return []
        }

        let lower = trimmed.lowercased()
        if let exact = Self.stateCodeByName[lower] {
            return [exact]
        }

        if let territoryCode = Self.territoryCodeByName[lower] {
            return [territoryCode]
        }

        return []
    }

    private func stateCode(for election: Election) -> String? {
        election.flags.first(where: { $0.hasPrefix("STATE_CODE:") })?
            .replacingOccurrences(of: "STATE_CODE:", with: "")
    }

    fileprivate static func buildMidtermElections(
        from records: [MidtermStateElectionRecord],
        topCityMayoralRecords: [TopCityMayoralCycleRecord]
    ) -> [Election] {
        var elections: [Election] = []

        for record in records {
            let stateName = record.state_name
            let stateCode = record.state_code
            let midtermName = "\(stateName) 2026 Midterm"
            let presidentialName = "\(stateName) 2028 Presidential"

            func appendElection(
                electionName: String,
                electionType: String,
                subtitle: String,
                electionDateISO: String?,
                registrationISO: String?,
                earlyVotingISO: String?,
                sourceURL: String?,
                notesOverride: String? = nil
            ) {
                guard let electionDate = isoDate(from: electionDateISO) else { return }

                let registrationDate = isoDate(from: registrationISO) ?? electionDate
                let registrationText = displayText(from: registrationISO, fallbackDate: registrationDate)
                let earlyVotingDate = isoDate(from: earlyVotingISO)
                let earlyVotingText = displayText(from: earlyVotingISO, fallbackDate: earlyVotingDate)
                let notes = notesOverride ?? record.registration_notes

                elections.append(
                    Election(
                        name: electionName,
                        subtitle: subtitle,
                        registrationDeadline: registrationDate,
                        startDate: earlyVotingDate ?? electionDate,
                        electionDay: electionDate,
                        earlyVotingText: earlyVotingText,
                        registrationNotes: notes,
                        jurisdictionLevel: "statewide",
                        jurisdictionName: stateName,
                        visibility: "public",
                        flags: [
                            "STATE_CODE:\(stateCode)",
                            "ELECTION_TYPE:\(electionType)",
                            "REGISTRATION_DEADLINE_TEXT:\(registrationText)"
                        ],
                        matchConfidence: nil,
                        sourceUrl: sourceURL
                    )
                )
            }

            appendElection(
                electionName: midtermName,
                electionType: "PRIMARY",
                subtitle: "Primary Election",
                electionDateISO: record.primary_date,
                registrationISO: record.registration_deadline_primary,
                earlyVotingISO: record.early_voting_primary,
                sourceURL: record.primary_source
            )

            appendElection(
                electionName: midtermName,
                electionType: "PRIMARY_RUNOFF",
                subtitle: "Primary Runoff Election",
                electionDateISO: record.primary_runoff_date,
                registrationISO: record.registration_deadline_primary,
                earlyVotingISO: record.early_voting_primary_runoff ?? record.early_voting_primary,
                sourceURL: record.primary_source
            )

            appendElection(
                electionName: midtermName,
                electionType: "GENERAL",
                subtitle: "General Election",
                electionDateISO: record.general_election_date,
                registrationISO: record.registration_deadline_general,
                earlyVotingISO: record.early_voting_general,
                sourceURL: record.registration_source
            )

            appendElection(
                electionName: presidentialName,
                electionType: "PRESIDENTIAL_PRIMARY",
                subtitle: "Presidential Primary Election",
                electionDateISO: projectedPresidentialPrimaryISO(from: record.primary_date),
                registrationISO: presidentialCycleTBDText,
                earlyVotingISO: presidentialCycleTBDText,
                sourceURL: record.primary_source,
                notesOverride: presidentialProjectionNote
            )

            appendElection(
                electionName: presidentialName,
                electionType: "PRESIDENTIAL_GENERAL",
                subtitle: "Presidential General Election",
                electionDateISO: presidentialGeneralElectionISO,
                registrationISO: presidentialCycleTBDText,
                earlyVotingISO: presidentialCycleTBDText,
                sourceURL: record.registration_source,
                notesOverride: presidentialProjectionNote
            )
        }

        appendSupplementalGubernatorialElections(to: &elections)
        appendSupplementalTerritorialElections(to: &elections)
        appendCurrentAppCompatibleSpecialElections(to: &elections)
        appendTopCityMayoralElections(to: &elections, records: topCityMayoralRecords)

        return elections
    }

    private struct SupplementalGubernatorialElection {
        let stateName: String
        let stateCode: String
        let electionName: String
        let subtitle: String
        let electionDateISO: String
        let electionType: String
    }

    private static func appendSupplementalGubernatorialElections(to elections: inout [Election]) {
        let supplemental: [SupplementalGubernatorialElection] = [
            SupplementalGubernatorialElection(
                stateName: "Kentucky",
                stateCode: "KY",
                electionName: "Kentucky 2027 Gubernatorial",
                subtitle: "Primary Election",
                electionDateISO: "2027-05-18",
                electionType: "PRIMARY"
            ),
            SupplementalGubernatorialElection(
                stateName: "Kentucky",
                stateCode: "KY",
                electionName: "Kentucky 2027 Gubernatorial",
                subtitle: "General Election",
                electionDateISO: "2027-11-02",
                electionType: "GENERAL"
            ),
            SupplementalGubernatorialElection(
                stateName: "Louisiana",
                stateCode: "LA",
                electionName: "Louisiana 2027 Gubernatorial",
                subtitle: "Primary Election",
                electionDateISO: "2027-10-09",
                electionType: "PRIMARY"
            ),
            SupplementalGubernatorialElection(
                stateName: "Louisiana",
                stateCode: "LA",
                electionName: "Louisiana 2027 Gubernatorial",
                subtitle: "General / Runoff Election",
                electionDateISO: "2027-11-20",
                electionType: "GENERAL_RUNOFF"
            ),
            SupplementalGubernatorialElection(
                stateName: "Mississippi",
                stateCode: "MS",
                electionName: "Mississippi 2027 Gubernatorial",
                subtitle: "Primary Election",
                electionDateISO: "2027-08-03",
                electionType: "PRIMARY"
            ),
            SupplementalGubernatorialElection(
                stateName: "Mississippi",
                stateCode: "MS",
                electionName: "Mississippi 2027 Gubernatorial",
                subtitle: "General Election",
                electionDateISO: "2027-11-02",
                electionType: "GENERAL"
            )
        ]

        for item in supplemental {
            guard let electionDate = isoDate(from: item.electionDateISO) else { continue }

            elections.append(
                Election(
                    name: item.electionName,
                    subtitle: item.subtitle,
                    registrationDeadline: electionDate,
                    startDate: electionDate,
                    electionDay: electionDate,
                    earlyVotingText: supplementalGubernatorialInfoText,
                    registrationNotes: supplementalGubernatorialNote,
                    jurisdictionLevel: "statewide",
                    jurisdictionName: item.stateName,
                    visibility: "public",
                    flags: [
                        "STATE_CODE:\(item.stateCode)",
                        "ELECTION_TYPE:\(item.electionType)",
                        "REGISTRATION_DEADLINE_TEXT:\(supplementalGubernatorialInfoText)"
                    ],
                    matchConfidence: nil,
                    sourceUrl: nil
                )
            )
        }
    }

    private struct SupplementalTerritorialElection {
        let stateName: String
        let stateCode: String
        let electionName: String
        let subtitle: String
        let electionDateISO: String
        let electionType: String
    }

    private static func appendSupplementalTerritorialElections(to elections: inout [Election]) {
        let supplemental: [SupplementalTerritorialElection] = [
            SupplementalTerritorialElection(
                stateName: "Guam",
                stateCode: "GU",
                electionName: "Guam 2026 Territorial",
                subtitle: "Primary Election",
                electionDateISO: "2026-08-01",
                electionType: "PRIMARY"
            ),
            SupplementalTerritorialElection(
                stateName: "Guam",
                stateCode: "GU",
                electionName: "Guam 2026 Territorial",
                subtitle: "General Election",
                electionDateISO: "2026-11-03",
                electionType: "GENERAL"
            ),
            SupplementalTerritorialElection(
                stateName: "Guam",
                stateCode: "GU",
                electionName: "Guam 2028 Territorial",
                subtitle: "Primary Election",
                electionDateISO: "2028-08-05",
                electionType: "PRIMARY"
            ),
            SupplementalTerritorialElection(
                stateName: "Guam",
                stateCode: "GU",
                electionName: "Guam 2028 Territorial",
                subtitle: "General Election",
                electionDateISO: "2028-11-07",
                electionType: "GENERAL"
            ),
            SupplementalTerritorialElection(
                stateName: "Puerto Rico",
                stateCode: "PR",
                electionName: "Puerto Rico 2028 Territorial",
                subtitle: "Primary Election",
                electionDateISO: "2028-06-04",
                electionType: "PRIMARY"
            ),
            SupplementalTerritorialElection(
                stateName: "Puerto Rico",
                stateCode: "PR",
                electionName: "Puerto Rico 2028 Territorial",
                subtitle: "General Election",
                electionDateISO: "2028-11-07",
                electionType: "GENERAL"
            ),
            SupplementalTerritorialElection(
                stateName: "U.S. Virgin Islands",
                stateCode: "VI",
                electionName: "U.S. Virgin Islands 2026 Territorial",
                subtitle: "General Election",
                electionDateISO: "2026-11-03",
                electionType: "GENERAL"
            ),
            SupplementalTerritorialElection(
                stateName: "U.S. Virgin Islands",
                stateCode: "VI",
                electionName: "U.S. Virgin Islands 2028 Territorial",
                subtitle: "General Election",
                electionDateISO: "2028-11-07",
                electionType: "GENERAL"
            ),
            SupplementalTerritorialElection(
                stateName: "American Samoa",
                stateCode: "AS",
                electionName: "American Samoa 2026 Territorial",
                subtitle: "General Election",
                electionDateISO: "2026-11-03",
                electionType: "GENERAL"
            ),
            SupplementalTerritorialElection(
                stateName: "American Samoa",
                stateCode: "AS",
                electionName: "American Samoa 2028 Territorial",
                subtitle: "General Election",
                electionDateISO: "2028-11-07",
                electionType: "GENERAL"
            ),
            SupplementalTerritorialElection(
                stateName: "Northern Mariana Islands",
                stateCode: "MP",
                electionName: "Northern Mariana Islands 2026 Territorial",
                subtitle: "General Election",
                electionDateISO: "2026-11-03",
                electionType: "GENERAL"
            ),
            SupplementalTerritorialElection(
                stateName: "Northern Mariana Islands",
                stateCode: "MP",
                electionName: "Northern Mariana Islands 2028 Territorial",
                subtitle: "General Election",
                electionDateISO: "2028-11-07",
                electionType: "GENERAL"
            )
        ]

        for item in supplemental {
            guard let electionDate = isoDate(from: item.electionDateISO) else { continue }
            let stateFlag = "STATE_CODE:\(item.stateCode)"
            let typeFlag = "ELECTION_TYPE:\(item.electionType)"

            let alreadyExists = elections.contains { existing in
                existing.electionDay == electionDate
                    && existing.flags.contains(stateFlag)
                    && existing.flags.contains(typeFlag)
            }
            if alreadyExists { continue }

            elections.append(
                Election(
                    name: item.electionName,
                    subtitle: item.subtitle,
                    registrationDeadline: electionDate,
                    startDate: electionDate,
                    electionDay: electionDate,
                    earlyVotingText: supplementalTerritorialInfoText,
                    registrationNotes: supplementalTerritorialNote,
                    jurisdictionLevel: "statewide",
                    jurisdictionName: item.stateName,
                    visibility: "public",
                    flags: [
                        stateFlag,
                        typeFlag,
                        "REGISTRATION_DEADLINE_TEXT:\(supplementalTerritorialInfoText)"
                    ],
                    matchConfidence: nil,
                    sourceUrl: nil
                )
            )
        }
    }

    private struct CurrentAppCompatibleSpecialElection {
        let stateName: String
        let stateCode: String
        let electionName: String
        let subtitle: String
        let electionDateISO: String
        let sourceURL: String
    }

    private static func appendCurrentAppCompatibleSpecialElections(to elections: inout [Election]) {
        let compatible: [CurrentAppCompatibleSpecialElection] = [
            CurrentAppCompatibleSpecialElection(
                stateName: "District of Columbia",
                stateCode: "DC",
                electionName: "District of Columbia 2026 Special",
                subtitle: "Special General Election",
                electionDateISO: "2026-06-16",
                sourceURL: "https://ballotpedia.org/Elections_calendar"
            ),
            CurrentAppCompatibleSpecialElection(
                stateName: "Virginia",
                stateCode: "VA",
                electionName: "Virginia 2026 Special",
                subtitle: "Special Ballot Measure Election",
                electionDateISO: "2026-04-21",
                sourceURL: "https://ballotpedia.org/Elections_calendar"
            )
        ]

        for item in compatible {
            guard let electionDate = isoDate(from: item.electionDateISO) else { continue }
            let stateFlag = "STATE_CODE:\(item.stateCode)"
            let typeFlag = "ELECTION_TYPE:SPECIAL"
            let normalizedName = item.electionName.lowercased()
            let normalizedSubtitle = item.subtitle.lowercased()

            let alreadyExists = elections.contains { existing in
                existing.electionDay == electionDate
                    && existing.flags.contains(stateFlag)
                    && existing.name.lowercased() == normalizedName
                    && existing.subtitle.lowercased() == normalizedSubtitle
            }
            if alreadyExists { continue }

            elections.append(
                Election(
                    name: item.electionName,
                    subtitle: item.subtitle,
                    registrationDeadline: electionDate,
                    startDate: electionDate,
                    electionDay: electionDate,
                    earlyVotingText: supplementalSpecialInfoText,
                    registrationNotes: supplementalSpecialNote,
                    jurisdictionLevel: "statewide",
                    jurisdictionName: item.stateName,
                    visibility: "public",
                    flags: [
                        stateFlag,
                        typeFlag,
                        "REGISTRATION_DEADLINE_TEXT:\(supplementalSpecialInfoText)"
                    ],
                    matchConfidence: nil,
                    sourceUrl: item.sourceURL
                )
            )
        }
    }

    private struct MayoralElectionEvent {
        let city: String
        let stateName: String
        let stateCode: String
        let stage: String
        let date: Date
        let dateStatus: String
        let cycleNotes: String?
        let sourceURL: String?
    }

    private static func appendTopCityMayoralElections(
        to elections: inout [Election],
        records: [TopCityMayoralCycleRecord]
    ) {
        guard !records.isEmpty else { return }

        var alignableIndexesByStateAndDay: [String: [String: [Int]]] = [:]
        var baselineDatesByState: [String: [Date]] = [:]

        for (index, election) in elections.enumerated() {
            guard let stateCode = stateCode(from: election) else { continue }

            baselineDatesByState[stateCode, default: []].append(election.electionDay)

            guard isMidtermOrPresidentialCycleElection(election) else { continue }
            let dayKey = deepLinkDateFormatter.string(from: election.electionDay)
            alignableIndexesByStateAndDay[stateCode, default: [:]][dayKey, default: []].append(index)
        }

        for record in records {
            for event in mayoralEvents(from: record) {
                let dayKey = deepLinkDateFormatter.string(from: event.date)
                if let indexes = alignableIndexesByStateAndDay[event.stateCode]?[dayKey], !indexes.isEmpty {
                    for index in indexes {
                        var flags = elections[index].flags
                        appendUniqueFlag("MAYOR_MATCH:\(event.city)|\(event.stage)|\(event.dateStatus)", to: &flags)
                        elections[index] = electionByReplacingFlags(elections[index], flags: flags)
                    }
                    continue
                }

                let mayoralCycleTBDText = cycleTBDText(for: event.date)
                var flags = [
                    "STATE_CODE:\(event.stateCode)",
                    "ELECTION_TYPE:MAYOR_\(event.stage)",
                    "REGISTRATION_DEADLINE_TEXT:\(mayoralCycleTBDText)",
                    "MAYOR_TIMELINE_CARD",
                    "MAYOR_CITY:\(event.city)",
                    "MAYOR_STAGE:\(event.stage)",
                    "MAYOR_DATE_STATUS:\(event.dateStatus)"
                ]

                if let nearestDate = nearestBaselineDate(to: event.date, from: baselineDatesByState[event.stateCode]),
                   isWithinCloseWindow(event.date, comparedTo: nearestDate, days: mayoralCloseWindowDays) {
                    let nearestISO = deepLinkDateFormatter.string(from: nearestDate)
                    appendUniqueFlag("MAYOR_CLOSE_TO_STATEWIDE:\(nearestISO)", to: &flags)
                }

                let year = Calendar(identifier: .gregorian).component(.year, from: event.date)
                let notes = mayoralTimelineNotes(for: event)

                elections.append(
                    Election(
                        name: "\(event.city) \(year) Mayoral",
                        subtitle: mayoralTimelineSubtitle(for: event.stage),
                        registrationDeadline: event.date,
                        startDate: event.date,
                        electionDay: event.date,
                        earlyVotingText: mayoralCycleTBDText,
                        registrationNotes: notes,
                        jurisdictionLevel: "city",
                        jurisdictionName: event.stateName,
                        visibility: "public",
                        flags: flags,
                        matchConfidence: nil,
                        sourceUrl: event.sourceURL
                    )
                )
            }
        }
    }

    private static func cycleTBDText(for date: Date) -> String {
        let year = Calendar(identifier: .gregorian).component(.year, from: date)
        return "TBD for \(year) cycle"
    }

    private static func mayoralEvents(from record: TopCityMayoralCycleRecord) -> [MayoralElectionEvent] {
        let stateLookupKey = record.state_name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard let stateCode = stateCodeByName[stateLookupKey] else { return [] }

        let city = record.city.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !city.isEmpty else { return [] }

        let status = record.date_status?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let normalizedStatus = status.isEmpty ? "Scheduled" : status
        guard shouldIntegrateMayoralRecord(withStatus: normalizedStatus) else { return [] }
        let sourceURL = record.sources.first(where: {
            !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        })

        let dateTuples: [(stage: String, iso: String?)] = [
            ("PRIMARY", record.next_primary_date_iso),
            ("GENERAL", record.next_general_date_iso),
            ("RUNOFF", record.next_runoff_date_iso)
        ]

        var events: [MayoralElectionEvent] = []
        for tuple in dateTuples {
            guard let date = isoDate(from: tuple.iso) else { continue }
            events.append(
                MayoralElectionEvent(
                    city: city,
                    stateName: record.state_name,
                    stateCode: stateCode,
                    stage: tuple.stage,
                    date: date,
                    dateStatus: normalizedStatus,
                    cycleNotes: record.cycle_notes,
                    sourceURL: sourceURL
                )
            )
        }

        return events
    }

    private static func shouldIntegrateMayoralRecord(withStatus status: String) -> Bool {
        let normalized = status.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalized.isEmpty {
            return true
        }

        let excludedStatuses: Set<String> = [
            "no separate mayoral ballot",
            "projected / tbd",
            "past / needs update"
        ]
        return !excludedStatuses.contains(normalized)
    }

    private static func electionByReplacingFlags(_ election: Election, flags: [String]) -> Election {
        Election(
            name: election.name,
            subtitle: election.subtitle,
            registrationDeadline: election.registrationDeadline,
            startDate: election.startDate,
            electionDay: election.electionDay,
            earlyVotingText: election.earlyVotingText,
            registrationNotes: election.registrationNotes,
            jurisdictionLevel: election.jurisdictionLevel,
            jurisdictionName: election.jurisdictionName,
            visibility: election.visibility,
            flags: flags,
            matchConfidence: election.matchConfidence,
            sourceUrl: election.sourceUrl
        )
    }

    private static func appendUniqueFlag(_ flag: String, to flags: inout [String]) {
        guard !flag.isEmpty else { return }
        if !flags.contains(flag) {
            flags.append(flag)
        }
    }

    private static func stateCode(from election: Election) -> String? {
        election.flags
            .first(where: { $0.hasPrefix("STATE_CODE:") })?
            .replacingOccurrences(of: "STATE_CODE:", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
    }

    private static func isMidtermOrPresidentialCycleElection(_ election: Election) -> Bool {
        let year = Calendar(identifier: .gregorian).component(.year, from: election.electionDay)
        guard year == 2026 || year == 2028 else { return false }

        guard let type = election.flags
            .first(where: { $0.hasPrefix("ELECTION_TYPE:") })?
            .replacingOccurrences(of: "ELECTION_TYPE:", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased() else {
            return false
        }

        return [
            "PRIMARY",
            "PRIMARY_RUNOFF",
            "GENERAL",
            "PRESIDENTIAL_PRIMARY",
            "PRESIDENTIAL_GENERAL"
        ].contains(type)
    }

    private static func nearestBaselineDate(to target: Date, from candidates: [Date]?) -> Date? {
        guard let candidates, !candidates.isEmpty else { return nil }

        var bestDate: Date?
        var bestDistance = Int.max
        let calendar = Calendar(identifier: .gregorian)
        let targetDay = calendar.startOfDay(for: target)

        for candidate in candidates {
            let candidateDay = calendar.startOfDay(for: candidate)
            let distance = abs(calendar.dateComponents([.day], from: targetDay, to: candidateDay).day ?? Int.max)
            if distance < bestDistance {
                bestDistance = distance
                bestDate = candidateDay
            }
        }

        return bestDate
    }

    private static func isWithinCloseWindow(_ lhs: Date, comparedTo rhs: Date, days: Int) -> Bool {
        let calendar = Calendar(identifier: .gregorian)
        let lhsDay = calendar.startOfDay(for: lhs)
        let rhsDay = calendar.startOfDay(for: rhs)
        let delta = abs(calendar.dateComponents([.day], from: lhsDay, to: rhsDay).day ?? Int.max)
        return delta <= days
    }

    private func localizedMayoralTimelineSubtitleIfNeeded(_ subtitle: String) -> String {
        switch subtitle.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() {
        case "MAYORAL PRIMARY ELECTION":
            return l("app.timeline.mayoral.subtitle.primary", "Mayoral Primary Election")
        case "MAYORAL RUNOFF ELECTION":
            return l("app.timeline.mayoral.subtitle.runoff", "Mayoral Runoff Election")
        case "MAYORAL GENERAL ELECTION":
            return l("app.timeline.mayoral.subtitle.general", "Mayoral General Election")
        default:
            return subtitle
        }
    }

    private static func mayoralTimelineSubtitle(for stage: String) -> String {
        switch stage.uppercased() {
        case "PRIMARY":
            return "Mayoral Primary Election"
        case "RUNOFF":
            return "Mayoral Runoff Election"
        default:
            return "Mayoral General Election"
        }
    }

    private static func mayoralTimelineNotes(for event: MayoralElectionEvent) -> String? {
        var notes: [String] = []

        if let cycleNotes = event.cycleNotes?.trimmingCharacters(in: .whitespacesAndNewlines),
           !cycleNotes.isEmpty {
            notes.append(cycleNotes)
        }

        if !event.dateStatus.isEmpty {
            notes.append("Date status: \(event.dateStatus).")
        }

        if notes.isEmpty {
            return nil
        }
        return notes.joined(separator: " ")
    }

    private static let presidentialProjectionNote =
        "2028 presidential dates are projected for planning and will be updated when states certify final calendars."

    private static let presidentialCycleTBDText = "TBD for 2028 cycle"
    private static let supplementalGubernatorialInfoText = "Check state election office for deadlines"
    private static let supplementalGubernatorialNote =
        "2027 gubernatorial dates are included for planning. Verify registration and early-voting windows with your state election office."
    private static let supplementalTerritorialInfoText = "Check territory election office for deadlines"
    private static let supplementalTerritorialNote =
        "Territorial election dates are included for planning. Verify registration and early-voting windows with local election officials."
    private static let supplementalSpecialInfoText = "Check state election office for deadlines"
    private static let supplementalSpecialNote =
        "Additional statewide-compatible special election rows are included for planning. Verify final details with your state election office."
    private static let mayoralCloseWindowDays = 30
    private static let fallbackPresidentialPrimaryISO = "2028-03-07"
    private static let presidentialGeneralElectionISO = "2028-11-07"

    private static func projectedPresidentialPrimaryISO(from midtermPrimaryISO: String?) -> String {
        shiftedISOYear(from: midtermPrimaryISO, toYear: 2028) ?? fallbackPresidentialPrimaryISO
    }

    private static func shiftedISOYear(from iso: String?, toYear year: Int) -> String? {
        guard let iso else { return nil }
        let parts = iso.split(separator: "-")
        guard parts.count == 3 else { return nil }

        let shifted = String(format: "%04d-%@-%@", year, String(parts[1]), String(parts[2]))
        return isoDate(from: shifted) == nil ? nil : shifted
    }

    private static func displayText(from rawValue: String?, fallbackDate: Date?) -> String {
        let trimmed = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if let parsedDate = isoDate(from: trimmed) {
            return formatCardDate(parsedDate)
        }
        if !trimmed.isEmpty {
            return trimmed
        }
        if let fallbackDate {
            return formatCardDate(fallbackDate)
        }
        return "Not listed in dataset"
    }

    private static func isoDate(from iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        return isoFormatter.date(from: iso)
    }

    private static let isoFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let cardDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "MMM d, yyyy"
        return formatter
    }()

    private static let fallbackDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static func formatCardDate(_ date: Date) -> String {
        let localized = cardDateFormatter.string(from: date).trimmingCharacters(in: .whitespacesAndNewlines)
        if !localized.isEmpty { return localized }
        return fallbackDateFormatter.string(from: date)
    }

    private static let stateCodeByName: [String: String] = [
        "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
        "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
        "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
        "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
        "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
        "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
        "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
        "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
        "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
        "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
        "district of columbia": "DC"
    ]

    private static let territoryCodeByName: [String: String] = [
        "american samoa": "AS",
        "guam": "GU",
        "northern mariana islands": "MP",
        "puerto rico": "PR",
        "virgin islands": "VI",
        "u.s. virgin islands": "VI",
        "us virgin islands": "VI"
    ]

    private static let territoryCodes: Set<String> = ["AS", "GU", "MP", "PR", "VI"]

    private static let knownStateOrTerritoryCodes: Set<String> = {
        Set(stateCodeByName.values).union(territoryCodeByName.values)
    }()

    private static let wikimediaFlagFileNameByCode: [String: String] = [
        "DC": "Flag_of_Washington,_D.C..svg"
    ]

    private static let stateNameByCode: [String: String] = {
        var mapping: [String: String] = [:]
        for (name, code) in stateCodeByName {
            let titleCased = name
                .split(separator: " ")
                .map { $0.capitalized }
                .joined(separator: " ")
            mapping[code] = titleCased
        }
        return mapping
    }()

    private var mostUpcomingElectionID: String? {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        if let upcoming = visibleElections.first(where: {
            calendar.startOfDay(for: $0.electionDay) >= today
        }) {
            return upcoming.id
        }
        return visibleElections.first?.id
    }

    private func registrationDeadlineText(for election: Election) -> String {
        election.flags
            .first(where: { $0.hasPrefix("REGISTRATION_DEADLINE_TEXT:") })?
            .replacingOccurrences(of: "REGISTRATION_DEADLINE_TEXT:", with: "")
            ?? Self.formatCardDate(election.registrationDeadline)
    }

    private func registrationDeadlinePillText(for election: Election) -> String {
        lf(
            "app.timeline.registration_deadline.pill",
            "Voter Registration Deadline: %@",
            registrationDeadlineText(for: election)
        )
    }

    private func earlyVotingText(for election: Election) -> String {
        let text = election.earlyVotingText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !text.isEmpty {
            return text
        }
        return Self.formatCardDate(election.startDate)
    }

    private func formattedDateText(_ date: Date) -> String {
        Self.formatCardDate(date)
    }

    private func electionCountdownAndDeadlineText(for election: Election) -> String {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let votingStart = calendar.startOfDay(for: election.startDate)
        let dayDelta = calendar.dateComponents([.day], from: today, to: votingStart).day ?? 0

        if dayDelta < 0 { return l("app.timeline.countdown.started", "Voting Started") }
        if dayDelta == 0 { return l("app.timeline.countdown.starts_today", "Voting Starts Today") }
        if dayDelta == 1 { return l("app.timeline.countdown.starts_one_day", "Voting Starts in 1 day") }
        return lf("app.timeline.countdown.starts_many_days", "Voting Starts in %d days", dayDelta)
    }

    private func countdownBackgroundColor(for election: Election) -> Color {
        VoteNowColors.primaryCTA
    }

    private func countdownForegroundColor(for election: Election) -> Color {
        .white
    }

    private func openVotingStepsTab() {
        NotificationCenter.default.post(name: .openVotingStepsTab, object: nil)
    }

    private func isPrimaryElection(_ election: Election) -> Bool {
        if let type = election.flags
            .first(where: { $0.hasPrefix("ELECTION_TYPE:") })?
            .replacingOccurrences(of: "ELECTION_TYPE:", with: "") {
            return type == "PRIMARY" || type == "PRIMARY_RUNOFF" || type == "PRESIDENTIAL_PRIMARY"
        }
        return election.subtitle.lowercased().contains("primary")
    }

}

struct ElectionTimelineView_Previews: PreviewProvider {
    static var previews: some View {
        ElectionTimelineView()
            .environmentObject(PlanViewModel())
            .environmentObject(MyRepsViewModel())
    }
}
