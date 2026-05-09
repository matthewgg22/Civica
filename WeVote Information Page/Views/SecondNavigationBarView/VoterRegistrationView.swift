//
//  VoterRegistrationView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/28/25.
//

import SwiftUI
import UIKit

private struct StickyHeaderHeightPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

private struct RegistrationGuideStripMinYPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = .greatestFiniteMagnitude

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = min(value, nextValue())
    }
}

private struct RegistrationSectionMinYPreferenceKey: PreferenceKey {
    static var defaultValue: [String: CGFloat] = [:]

    static func reduce(value: inout [String: CGFloat], nextValue: () -> [String: CGFloat]) {
        value.merge(nextValue(), uniquingKeysWith: { _, new in new })
    }
}

private struct StickyGuideStripHeightPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

private struct BottomRoundedRectangle: Shape {
    let radius: CGFloat

    func path(in rect: CGRect) -> Path {
        let bezier = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: [.bottomLeft, .bottomRight],
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(bezier.cgPath)
    }
}

private struct GuideStripTapFeedbackStyle: ButtonStyle {
    let accent: Color
    let isActive: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .contentShape(Capsule(style: .continuous))
            .shadow(
                color: (configuration.isPressed ? accent.opacity(0.35) : accent.opacity(isActive ? 0.18 : 0.0)),
                radius: configuration.isPressed ? 8 : (isActive ? 5 : 0),
                x: 0,
                y: configuration.isPressed ? 3 : (isActive ? 2 : 0)
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .animation(.easeOut(duration: 0.16), value: configuration.isPressed)
    }
}

private struct VoterRegistrationCard: Identifiable {
    enum Action {
        case openURL(URL)
        case goToHowToVoteTab
        case shareDeadline
    }

    enum Kind {
        case whyRegister
        case deadline
        case check
        case thenVote
        case provisional
        case absenteeCure
    }

    enum Phase {
        case preElection
        case duringElection
        case postElection
    }

    let id: String
    let kind: Kind
    let phase: Phase
    let stepLabel: String
    let title: String
    let summary: String
    let bullets: [String]
    let primaryActionTitle: String
    let primaryAction: Action
    let isPrimaryActionCalloutPill: Bool
    let secondaryActionTitle: String?
    let secondaryAction: Action?
}

private struct DemoElectionOverviewContest {
    let office: String
    let scopeOrDistrict: String
    let numberToNominate: Int
    let candidates: [String]
}

private struct DemoElectionOverviewPayload {
    let electionName: String
    let electionDateISO: String
    let earlyVotingStartISO: String
    let earlyVotingEndISO: String
    let status: String
    let sourcePrintedAt: String
    let state: String
    let district: String
    let county: String
    let primaryType: String
    let partyBallot: String
    let contests: [DemoElectionOverviewContest]
    let notes: [String]
}

// MARK: - VoterRegistrationView
struct VoterRegistrationView: View {
    @Environment(\.openURL) private var openURL
    @Environment(\.locale) private var locale
    @EnvironmentObject private var planVM: PlanViewModel
    @EnvironmentObject private var repsVM: MyRepsViewModel
    @State private var shareItems: [Any] = []
    @State private var showingShareSheet = false
    @State private var showMailInBallotPage = false
    @State private var showingDeadlineActions = false
    @State private var measuredStickyHeaderHeight: CGFloat = 0
    @State private var measuredStickyGuideStripHeight: CGFloat = 0
    @State private var registrationGuideStripMinY: CGFloat = .greatestFiniteMagnitude
    @State private var currentlyViewedPhase: VoterRegistrationCard.Phase?
    @State private var guidePhaseSelectionLock: VoterRegistrationCard.Phase?
    @State private var guidePhaseSelectionLockToken = UUID()
    @State private var showStepOneWhyRegisterDropdown = false
    @State private var showStepTwoPollIssuesDropdown = false
    @State private var showStepThreeBallotErrorDropdown = false
    @State private var pendingScrollTargetID: AnyHashable?

    private let contextResolver = ElectionGuideContextResolver()
    private let contentProvider = RegistrationGuideContentProvider()
    private let zipStateResolver = USZipStateResolver()
    private let stickyHeaderMinHeight: CGFloat = 84
    private let voteGovURL = URL(string: "https://www.vote.gov/") ?? URL(fileURLWithPath: "/")
    private let defaultProvisionalBallotURL = URL(string: "https://www.eac.gov/research-and-data/provisional-voting")
        ?? URL(fileURLWithPath: "/")
    private let unresolvedLocationMessage = "Enter a valid address to see your voting information."
    private let electionOverviewAnchorID = "registration-election-overview-anchor"
    // MAPV route is parked for this launch; keep Step 2 pointing to Voting Steps.
    private let howToVoteDeepLink = URL(string: "votenow://registration")
        ?? URL(string: "https://www.vote.gov/")
        ?? URL(fileURLWithPath: "/")
    private var dropdownRevealAnimation: Animation {
        .interactiveSpring(response: 0.34, dampingFraction: 0.9, blendDuration: 0.18)
    }

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

    private var guideContext: ElectionGuideContext? {
        contextResolver.resolve(for: planVM)
    }

    private var guideContent: RegistrationGuideContent? {
        guard let guideContext else { return nil }
        return contentProvider.content(for: guideContext)
    }

    private var nextUpcomingElectionDay: Date? {
        guideContext?.electionDate ?? nextUpcomingElection?.electionDay
    }

    private var nextUpcomingElection: Election? {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let sorted = planVM.upcomingElections.sorted { $0.electionDay < $1.electionDay }

        if let upcoming = sorted.first(where: { calendar.startOfDay(for: $0.electionDay) >= today }) {
            return upcoming
        }
        return sorted.first
    }

    private var nextUpcomingEarlyVotingDate: Date? {
        guard let election = nextUpcomingElection else { return nil }
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: election.startDate)
        let day = calendar.startOfDay(for: election.electionDay)
        return start < day ? election.startDate : nil
    }

    private var prePhaseTargetDate: Date? {
        let registration = guideContent?.registrationDeadline
        let earlyVoting = nextUpcomingEarlyVotingDate

        switch (registration, earlyVoting) {
        case let (r?, e?):
            return min(r, e)
        case let (r?, nil):
            return r
        case let (nil, e?):
            return e
        case (nil, nil):
            return nil
        }
    }

    private var prePhaseHeaderText: String {
        lf("app.registration.phase.registration.header", "REGISTRATION: %@", formattedPhaseDate(prePhaseTargetDate))
    }

    private var duringPhaseHeaderText: String {
        if let startDate = nextUpcomingEarlyVotingDate,
           let endDate = nextUpcomingElectionDay {
            let start = formattedDuringPhaseStart(startDate, endDate)
            let end = formattedDuringPhaseEnd(endDate)
            return lf("app.registration.phase.vote.header.range", "VOTE (%@ - %@)", start, end)
        }

        let start = duringPhaseStartText
        let end = formattedPhaseDate(nextUpcomingElectionDay)
        return lf("app.registration.phase.vote.header.range", "VOTE: (%@ - %@)", start, end)
    }

    private var postPhaseHeaderText: String {
        let postDate = nextUpcomingElectionDay.flatMap { Calendar.current.date(byAdding: .day, value: 1, to: $0) }
        return lf("app.registration.phase.confirm.header", "CONFIRM: %@", formattedPhaseDate(postDate))
    }

    private var duringPhaseStartText: String {
        if let earlyDate = nextUpcomingEarlyVotingDate {
            return formattedPhaseDate(earlyDate)
        }

        let earlyVotingText = nextUpcomingElection?.earlyVotingText?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !earlyVotingText.isEmpty {
            return earlyVotingText
        }

        return formattedPhaseDate(nil)
    }

    private var isCheckBallotStatusWindowActive: Bool {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        guard let electionDay = nextUpcomingElectionDay else { return false }

        let startDate = nextUpcomingEarlyVotingDate ?? electionDay
        guard let endDate = calendar.date(byAdding: .day, value: 15, to: electionDay) else {
            return false
        }

        let start = calendar.startOfDay(for: startDate)
        let end = calendar.startOfDay(for: endDate)
        return today >= start && today <= end
    }

    private var checkBallotStatusDisclaimerText: String {
        guard let electionDay = nextUpcomingElectionDay else {
            return l(
                "app.registration.card.vote_count.disclaimer.tbd",
                "Check ballot status turns on during early voting and stays available through 15 days after Election Day."
            )
        }

        let startDate = nextUpcomingEarlyVotingDate ?? electionDay
        let endDate = Calendar.current.date(byAdding: .day, value: 15, to: electionDay) ?? electionDay
        let startText = formattedElectionDay(startDate)
        let endText = formattedElectionDay(endDate)

        return lf(
            "app.registration.card.vote_count.disclaimer.window",
            "Check ballot status is available from %@ through %@.",
            startText,
            endText
        )
    }

    private func formattedDuringPhaseStart(_ start: Date, _ end: Date) -> String {
        let calendar = Calendar.current
        let sameYear = calendar.component(.year, from: start) == calendar.component(.year, from: end)
        return sameYear
            ? Self.monthDayDisplayFormatter.string(from: start)
            : Self.monthDayYearDisplayFormatter.string(from: start)
    }

    private func formattedDuringPhaseEnd(_ end: Date) -> String {
        return Self.monthDayYearDisplayFormatter.string(from: end)
    }

    private var registrationPortalURL: URL {
        guideContent?.checkStatusURL ?? voteGovURL
    }

    private var registrationDeadlineLabel: String {
        guideContent?.deadlineLabel ?? l("app.registration.deadline.default", "Registration Deadline")
    }

    private var methodSpecificDeadlineRows: [(label: String, value: String)] {
        parseMethodSpecificDeadlines(from: guideContent?.registrationNotes)
    }

    private var locationSubtitle: String {
        if let resolvedLocationSummary {
            return resolvedLocationSummary
        }

        return l("app.registration.location.set_address", "Set your address in My Reps")
    }

    private var demoElectionOverviewPayload: DemoElectionOverviewPayload {
        DemoElectionOverviewPayload(
            electionName: "Primary Election 2026",
            electionDateISO: "2026-06-23",
            earlyVotingStartISO: "2026-06-13",
            earlyVotingEndISO: "2026-06-21",
            status: "Tentative / subject to change",
            sourcePrintedAt: "2026-05-01T14:21:29",
            state: "NY",
            district: "NY-12",
            county: "New York",
            primaryType: "Closed primary",
            partyBallot: "Democratic",
            contests: [
                DemoElectionOverviewContest(
                    office: "State Comptroller",
                    scopeOrDistrict: "Citywide listing / statewide office",
                    numberToNominate: 1,
                    candidates: [
                        "Thomas P. DiNapoli",
                        "Drew Warshaw",
                        "Raj Goyle"
                    ]
                ),
                DemoElectionOverviewContest(
                    office: "Representative in Congress",
                    scopeOrDistrict: "12th Congressional District",
                    numberToNominate: 1,
                    candidates: [
                        "Nina Schwalbe",
                        "Patrick Timmins",
                        "Chris Diep",
                        "George Conway",
                        "Laura Dunn",
                        "Micah C. Lasher",
                        "Alex Bores",
                        "Jack Kennedy Schlossberg",
                        "Micah Bergdale"
                    ]
                )
            ],
            notes: [
                "Candidate list is tentative and subject to change.",
                "Exact voter ballots may include address-specific State Senate, Assembly, City Council District 3, State Committee, Judicial Convention delegate, alternate delegate, or county committee contests.",
                "The official NYC BOE primary contest list reviewed here shows the NY-12 congressional contest under the Democratic Party section."
            ]
        )
    }

    private var cards: [VoterRegistrationCard] {
        [
            VoterRegistrationCard(
                id: "step-2",
                kind: .deadline,
                phase: .preElection,
                stepLabel: l("app.registration.step.1.reshuffle", "STEP 1"),
                title: l("app.registration.card.deadline.title", "Register before the deadline"),
                summary: "",
                bullets: [],
                primaryActionTitle: l("app.registration.action.start_registration", "Start registration"),
                primaryAction: .openURL(registrationPortalURL),
                isPrimaryActionCalloutPill: true,
                secondaryActionTitle: nil,
                secondaryAction: nil
            ),
            VoterRegistrationCard(
                id: "step-3",
                kind: .thenVote,
                phase: .duringElection,
                stepLabel: l("app.registration.step.2.reshuffle", "STEP 2"),
                title: l("app.registration.card.then_vote.title.get_out.short", "Get Out to Vote!"),
                summary: "",
                bullets: [
                    l("app.registration.card.then_vote.bullet_1", "Make a plan for when/where you vote"),
                    l("app.registration.card.then_vote.bullet_2.capitalized", "See what’s on your ballot in advance"),
                    l("app.registration.card.then_vote.bullet_3.no_period", "Confirm polling location and hours")
                ],
                primaryActionTitle: l("app.registration.action.see_voting_options", "See Voting Options"),
                primaryAction: .goToHowToVoteTab,
                isPrimaryActionCalloutPill: false,
                secondaryActionTitle: nil,
                secondaryAction: nil
            ),
            VoterRegistrationCard(
                id: "step-3-post-check",
                kind: .check,
                phase: .postElection,
                stepLabel: l("app.registration.step.3.reshuffle", "STEP 3"),
                title: l("app.registration.card.vote_count.title", "Check if your vote is counted"),
                summary: l(
                    "app.registration.card.vote_count.summary",
                    "After voting, check your ballot status to confirm it was received and accepted."
                ),
                bullets: [
                    l("app.registration.card.vote_count.bullet_1", "Use your state's official ballot tracker when available.")
                ],
                primaryActionTitle: l("app.registration.action.check_ballot_status", "Check ballot status"),
                primaryAction: .openURL(registrationPortalURL),
                isPrimaryActionCalloutPill: false,
                secondaryActionTitle: nil,
                secondaryAction: nil
            )
        ]
    }

    private var whyRegisterSourceCard: VoterRegistrationCard? {
        cards.first(where: { $0.kind == .whyRegister })
    }

    private struct RegistrationSection: Identifiable {
        let id: String
        let phase: VoterRegistrationCard.Phase
        let title: String
        let subtitle: String
        let backgroundTint: Color
        let lineTint: Color
        let cards: [VoterRegistrationCard]
    }

    private var groupedSections: [RegistrationSection] {
        let sectionSpecs: [(VoterRegistrationCard.Phase, String, String, Color, Color)] = [
            (
                .preElection,
                prePhaseHeaderText,
                "",
                VoteNowColors.appBackground,
                VoteNowColors.primaryCTA.opacity(0.68)
            ),
            (
                .duringElection,
                duringPhaseHeaderText,
                "",
                VoteNowColors.appBackground,
                VoteNowColors.warningAmber.opacity(0.78)
            ),
            (
                .postElection,
                postPhaseHeaderText,
                "",
                VoteNowColors.appBackground,
                VoteNowColors.urgentCTA.opacity(0.72)
            )
        ]

        return sectionSpecs.compactMap { phase, title, subtitle, backgroundTint, lineTint in
            let sectionCards = cards.filter { $0.phase == phase }
            guard !sectionCards.isEmpty else { return nil }
            return RegistrationSection(
                id: "\(phase)",
                phase: phase,
                title: title,
                subtitle: subtitle,
                backgroundTint: backgroundTint,
                lineTint: lineTint,
                cards: sectionCards
            )
        }
    }

    private enum RegistrationLaunchState {
        case loading
        case success
        case setupNeeded
        case failure
    }

    private var registrationLaunchState: RegistrationLaunchState {
        let hasResolvedSelection = repsVM.resolvedLocationSelection != nil
        let hasResolvedRepsState = !(repsVM.resolvedStateCode?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
        let hasResolvedLocationContext = hasResolvedSelection || hasResolvedRepsState

        if repsVM.isLoading, !hasResolvedLocationContext {
            return .loading
        }

        guard hasResolvedLocationContext, registrationStateCode != nil else {
            return .setupNeeded
        }

        guard guideContext != nil || nextUpcomingElection != nil else {
            return .failure
        }

        return .success
    }

    @ViewBuilder
    private func registrationLaunchStateCard(for state: RegistrationLaunchState) -> some View {
        switch state {
        case .loading:
            LaunchFlowStateCard(
                state: .loading,
                title: l("app.registration.launch_state.loading.title", "Loading your voting guide"),
                message: l("app.registration.launch_state.loading.body", "Gathering election details for your location..."),
                primaryActionTitle: l("app.registration.launch_state.loading.action.primary", "Use Current Location"),
                primaryAction: {
                    repsVM.centerOnCurrentLocation()
                },
                secondaryActionTitle: l("app.reps.action.edit_location", "Change Location"),
                secondaryAction: {
                    openMyInfoPanel()
                }
            )
        case .success:
            EmptyView()
        case .setupNeeded:
            LaunchFlowStateCard(
                state: .empty,
                title: l("app.registration.launch_state.empty.title", "Set your location to continue"),
                message: l("app.registration.launch_state.empty.body.recoverable", unresolvedLocationMessage),
                primaryActionTitle: l("app.registration.launch_state.empty.action.primary", "Set My Address"),
                primaryAction: {
                    openMyInfoPanel()
                },
                secondaryActionTitle: l("app.registration.launch_state.empty.action.secondary", "Use Current Location"),
                secondaryAction: {
                    repsVM.centerOnCurrentLocation()
                }
            )
        case .failure:
            LaunchFlowStateCard(
                state: .error,
                title: l("app.registration.launch_state.error.title", "We couldn’t load your voting information"),
                message: l("app.registration.launch_state.error.body.recoverable", "Try again or edit your location."),
                primaryActionTitle: l("app.registration.launch_state.error.action.primary", "Retry"),
                primaryAction: {
                    retryRegistrationGuideLoad()
                },
                secondaryActionTitle: l("app.reps.action.edit_location", "Edit location"),
                secondaryAction: {
                    openMyInfoPanel()
                }
            )
        }
    }

    var body: some View {
        NavigationStack {
            GeometryReader { _ in
                ScrollViewReader { proxy in
                    ZStack(alignment: .top) {
                        overscrollBackground

                        ScrollView(.vertical) {
                            if registrationLaunchState != .success {
                                VStack(spacing: 0) {
                                    registrationLaunchStateCard(for: registrationLaunchState)
                                        .padding(.horizontal, 16)
                                        .padding(.top, 10)
                                        .padding(.bottom, 14)
                                    Spacer(minLength: 0)
                                }
                                .frame(maxWidth: .infinity)
                            } else {
                                LazyVStack(spacing: 0) {
                                    VStack(spacing: 0) {
                                        registrationReadinessPanel(proxy: proxy)
                                            .padding(.horizontal, 16)
                                            .padding(.top, 8)
                                            .padding(.bottom, 10)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .background(VoteNowColors.appBackground)

                                    ForEach(groupedSections) { section in
                                        sectionTimeline(section)
                                            .id(section.phase)
                                    }
                                }
                                .padding(.top, stickyHeaderOffset)
                                .padding(.bottom, 24)
                            }
                        }
                        .scrollIndicators(.hidden)
                        .coordinateSpace(name: "VoterRegistrationScroll")

                        if registrationLaunchState == .success {
                            stickyGuideStripDock(proxy: proxy)
                                .padding(.top, stickyHeaderOffset)
                                .frame(maxWidth: .infinity, alignment: .top)
                                .zIndex(4)
                                .opacity(shouldShowStickyGuideStrip ? 1 : 0)
                                .allowsHitTesting(shouldShowStickyGuideStrip)
                        }

                        VStack(alignment: .leading, spacing: 0) {
                            PageHeader(title: "Voting Guide")
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text(headerLocationSubtitle)
                                    .font(CivicaTypography.subheadStrong)
                                    .foregroundColor(VoteNowColors.mutedText)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.84)

                                Spacer(minLength: 8)

                                Button {
                                    openMyInfoPanel()
                                } label: {
                                    Text(l("app.reps.action.edit_location", "Change Location"))
                                        .font(CivicaTypography.supportStrong)
                                        .italic()
                                        .foregroundColor(VoteNowColors.primaryCTA)
                                        .lineLimit(1)
                                }
                                .buttonStyle(.plain)
                            }
                            .minimumScaleFactor(0.84)
                            .padding(.leading, 72)
                            .padding(.top, -6)
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(VoteNowColors.appBackground)
                        .background(
                            GeometryReader { geo in
                                Color.clear.preference(
                                    key: StickyHeaderHeightPreferenceKey.self,
                                    value: geo.size.height
                                )
                            }
                        )
                        .zIndex(5)
                    }
                    .onPreferenceChange(StickyHeaderHeightPreferenceKey.self) { height in
                        guard height > 0 else { return }
                        measuredStickyHeaderHeight = height
                    }
                    .onPreferenceChange(RegistrationGuideStripMinYPreferenceKey.self) { minY in
                        // LazyVStack can temporarily recycle the source view and emit an outlier value.
                        // Ignore those resets so the docked strip stays pinned once activated.
                        guard minY > -100_000, minY < 100_000 else { return }
                        registrationGuideStripMinY = minY
                    }
                    .onPreferenceChange(RegistrationSectionMinYPreferenceKey.self) { positions in
                        updateCurrentlyViewedPhase(with: positions)
                    }
                    .onPreferenceChange(StickyGuideStripHeightPreferenceKey.self) { height in
                        guard height > 0 else { return }
                        measuredStickyGuideStripHeight = height
                    }
                    .onChange(of: pendingScrollTargetID) { _, target in
                        guard let target else { return }
                        withAnimation(.easeInOut(duration: 0.26)) {
                            proxy.scrollTo(target, anchor: .top)
                        }
                        pendingScrollTargetID = nil
                    }
                }
            }
            .navigationBarHidden(true)
            .navigationDestination(isPresented: $showMailInBallotPage) {
                MailInBallotView()
                    .navigationBarTitleDisplayMode(.inline)
                    .navigationBarBackButtonHidden(false)
                    .toolbar(.visible, for: .navigationBar)
            }
            .confirmationDialog(
                l("app.registration.action.dialog.title", "Registration Actions"),
                isPresented: $showingDeadlineActions,
                titleVisibility: .hidden
            ) {
                if VoteNowLaunchFeatures.shareActionsEnabled {
                    Button(l("app.registration.action.share_deadline", "Share Deadline")) {
                        shareRegistrationDeadline()
                    }
                }
            }
        }
        .sheet(isPresented: $showingShareSheet, onDismiss: {
            shareItems.removeAll()
        }) {
            if !shareItems.isEmpty {
                ShareSheet(items: shareItems)
            }
        }
    }

    private func sectionTimeline(_ section: RegistrationSection) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                Text(section.title)
                    .font(CivicaTypography.subheadBold)
                    .foregroundColor(VoteNowColors.primaryCTA)
                if !section.subtitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(section.subtitle)
                        .font(CivicaTypography.supportStrong)
                        .foregroundColor(VoteNowColors.mutedText)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            VStack(spacing: 10) {
                ForEach(section.cards) { card in
                    registrationCard(card)
                        .id(card.id)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VoteNowColors.appBackground)
        .background(
            GeometryReader { geo in
                Color.clear.preference(
                    key: RegistrationSectionMinYPreferenceKey.self,
                    value: [section.id: geo.frame(in: .named("VoterRegistrationScroll")).minY]
                )
            }
        )
        .overlay(alignment: .top) {
            Color.clear
                .frame(height: 1)
                .id(sectionTopAnchorID(for: section.phase))
                .offset(y: -guideStripTapLandingOffset)
                .allowsHitTesting(false)
        }
    }

    @ViewBuilder
    private func registrationCard(_ card: VoterRegistrationCard) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            registrationCardHeading(card)

            if !card.summary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(card.summary)
                    .font(.body)
                    .foregroundColor(VoteNowColors.mutedText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if card.kind == .whyRegister {
                primaryBallotGuidancePanel
            }

            if card.kind == .deadline {
                deadlinePanel
                deadlineDoubleCheckPanel
            }

            if card.kind == .thenVote {
                preMapvElectionOverviewPanel
                    .id(electionOverviewAnchorID)
                thenVoteTimelinePanel
            }

            if card.kind == .provisional {
                provisionalRequestPanel
            }

            if !card.bullets.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(card.bullets, id: \.self) { bullet in
                        if card.kind == .provisional && isProvisionalLeadLine(bullet) {
                            Text(bullet)
                                .font(CivicaTypography.supportBold)
                                .foregroundColor(VoteNowColors.primaryText)
                                .fixedSize(horizontal: false, vertical: true)
                                .padding(.top, 2)
                        } else {
                            HStack(alignment: .top, spacing: 8) {
                                Text("•")
                                    .font(CivicaTypography.supportStrong)
                                    .foregroundColor(VoteNowColors.primaryCTA)
                                Text(bullet)
                                    .font(CivicaTypography.support)
                                    .foregroundColor(VoteNowColors.primaryText)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }
            }

            if card.kind == .absenteeCure {
                Text(
                    l(
                        "app.registration.card.ballot_cure.notice",
                        "Voters receive notification and can cure the ballot within a deadline."
                    )
                )
                .font(CivicaTypography.support)
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
            }

            // Step 2 CTA now jumps users to the election overview area in this flow.
            if card.kind != .whyRegister && card.kind != .absenteeCure && card.kind != .deadline {
                if card.kind == .check {
                    if card.id == "step-3-post-check" {
                        ballotStatusPrimaryButton(
                            card.primaryActionTitle,
                            isEnabled: isCheckBallotStatusWindowActive
                        ) {
                            handleCardAction(card.primaryAction)
                        }
                        Text(checkBallotStatusDisclaimerText)
                            .font(CivicaTypography.caption)
                            .foregroundColor(VoteNowColors.mutedText)
                            .fixedSize(horizontal: false, vertical: true)
                    } else {
                        checkRegistrationPrimaryButton(card.primaryActionTitle) {
                            handleCardAction(card.primaryAction)
                        }
                    }
                } else if card.isPrimaryActionCalloutPill {
                    Button(card.primaryActionTitle) {
                        handleCardAction(card.primaryAction)
                    }
                    .font(CivicaTypography.subheadStrong)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 9)
                    .foregroundColor(VoteNowColors.primaryCTA)
                    .background(VoteNowColors.primaryCTA.opacity(0.10))
                    .overlay(
                        Capsule()
                            .stroke(VoteNowColors.primaryCTA.opacity(0.34), lineWidth: 1)
                    )
                    .clipShape(Capsule())
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    Button(card.primaryActionTitle) {
                        handleCardAction(card.primaryAction)
                    }
                    .font(CivicaTypography.sectionHeader)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(VoteNowColors.primaryCTA)
                    .foregroundColor(VoteNowColors.onPrimaryText)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }

            if card.kind != .deadline && card.kind != .absenteeCure,
               let secondaryTitle = card.secondaryActionTitle,
               let secondaryAction = card.secondaryAction {
                Button(secondaryTitle) {
                    handleCardAction(secondaryAction)
                }
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(VoteNowColors.primaryCTA)
            }

            if card.kind == .deadline {
                stepOneWhyRegisterDropdown
            }

            if card.kind == .thenVote {
                stepTwoPollIssuesDropdown
            }

            if card.kind == .check && card.id == "step-3-post-check" {
                stepThreeBallotErrorDropdown
            }
        }
        .padding(card.kind == .absenteeCure ? 12 : 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: VoteNowColors.cardCornerRadius, style: .continuous)
                .fill(VoteNowColors.surfaceWhite)
        )
        .clipShape(RoundedRectangle(cornerRadius: VoteNowColors.cardCornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: VoteNowColors.cardCornerRadius, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.12), lineWidth: 1)
        )
        .shadow(color: VoteNowColors.primaryText.opacity(0.05), radius: 5, x: 0, y: 2)
    }

    private var stepOneWhyRegisterDropdown: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(dropdownRevealAnimation) {
                    showStepOneWhyRegisterDropdown.toggle()
                }
            } label: {
                HStack(spacing: 8) {
                    Text(
                        l(
                            "app.registration.step1.why_register.dropdown.title",
                            "Why do I need to Register?"
                        )
                    )
                        .font(CivicaTypography.supportStrong)
                        .foregroundColor(VoteNowColors.primaryCTA)

                    Spacer(minLength: 8)

                    Image(systemName: "chevron.down")
                        .font(CivicaTypography.captionBold)
                        .foregroundColor(VoteNowColors.primaryCTA)
                        .rotationEffect(.degrees(showStepOneWhyRegisterDropdown ? 180 : 0))
                        .animation(dropdownRevealAnimation, value: showStepOneWhyRegisterDropdown)
                }
            }
            .buttonStyle(.plain)
            .contentShape(Rectangle())

            if showStepOneWhyRegisterDropdown {
                VStack(alignment: .leading, spacing: 8) {
                    (
                        Text(l("app.registration.dropdown.why_register.intro.prefix", "The "))
                        + Text(l("app.guide.party.democrat", "Democrat"))
                            .foregroundColor(VoteNowColors.richBlue)
                            .fontWeight(.semibold)
                        + Text(l("app.registration.dropdown.why_register.intro.middle", " and "))
                        + Text(l("app.guide.party.republican", "Republican"))
                            .foregroundColor(VoteNowColors.richRed)
                            .fontWeight(.semibold)
                        + Text(
                            l(
                                "app.registration.dropdown.why_register.intro.suffix",
                                " parties are the two largest in the United States. In many states, primary ballot eligibility depends on your current party registration."
                            )
                        )
                    )
                    .font(CivicaTypography.support)
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)

                    Text(
                        l(
                            "app.registration.dropdown.why_register.example.p1",
                            "Example: In a closed primary, a voter registered as Independent may not be able to vote in either party primary."
                        )
                    )
                    .font(CivicaTypography.support)
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)

                }
                .padding(.top, 2)
                .transition(
                    .asymmetric(
                        insertion: .opacity
                            .combined(with: .move(edge: .top))
                            .combined(with: .scale(scale: 0.985, anchor: .top)),
                        removal: .opacity.combined(with: .scale(scale: 0.985, anchor: .top))
                    )
                )
            }
        }
        .padding(.top, 4)
        .animation(dropdownRevealAnimation, value: showStepOneWhyRegisterDropdown)
    }

    private var stepTwoPollIssuesDropdown: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(dropdownRevealAnimation) {
                    showStepTwoPollIssuesDropdown.toggle()
                }
            } label: {
                HStack(spacing: 8) {
                    Text(
                        l(
                            "app.registration.step2.poll_issues.dropdown.title",
                            "If Issues Emerge at the Polls"
                        )
                    )
                    .font(CivicaTypography.supportStrong)
                    .foregroundColor(VoteNowColors.primaryCTA)

                    Spacer(minLength: 8)

                    Image(systemName: "chevron.down")
                        .font(CivicaTypography.captionBold)
                        .foregroundColor(VoteNowColors.primaryCTA)
                        .rotationEffect(.degrees(showStepTwoPollIssuesDropdown ? 180 : 0))
                        .animation(dropdownRevealAnimation, value: showStepTwoPollIssuesDropdown)
                }
            }
            .buttonStyle(.plain)
            .contentShape(Rectangle())

            if showStepTwoPollIssuesDropdown {
                VStack(alignment: .leading, spacing: 10) {
                    Text(
                        l(
                            "app.registration.card.provisional.title",
                            "Request a provisional ballot if issues arise at the polling site"
                        )
                    )
                    .font(CivicaTypography.subheadBold)
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)

                    Text(
                        l(
                            "app.registration.card.provisional.summary",
                            "A provisional ballot is a ballot that’s set aside at the polls and reviewed later to determine if it can be counted."
                        )
                    )
                    .font(CivicaTypography.support)
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)

                    provisionalRequestPanel

                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(stepTwoPointOneBullets, id: \.self) { bullet in
                            if isProvisionalLeadLine(bullet) {
                                Text(bullet)
                                    .font(CivicaTypography.supportBold)
                                    .foregroundColor(VoteNowColors.primaryText)
                                    .fixedSize(horizontal: false, vertical: true)
                            } else {
                                HStack(alignment: .top, spacing: 8) {
                                    Text("•")
                                        .font(CivicaTypography.supportStrong)
                                        .foregroundColor(VoteNowColors.primaryCTA)
                                    Text(bullet)
                                        .font(CivicaTypography.support)
                                        .foregroundColor(VoteNowColors.primaryText)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                    }

                    Button(provisionalBallotActionTitle) {
                        handleCardAction(.openURL(stateProvisionalBallotURL))
                    }
                    .font(CivicaTypography.subheadStrong)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 9)
                    .foregroundColor(VoteNowColors.onPrimaryText)
                    .background(VoteNowColors.primaryCTA)
                    .clipShape(Capsule())
                    .frame(maxWidth: .infinity, alignment: .center)
                }
                .padding(.top, 2)
                .transition(
                    .asymmetric(
                        insertion: .opacity
                            .combined(with: .move(edge: .top))
                            .combined(with: .scale(scale: 0.985, anchor: .top)),
                        removal: .opacity.combined(with: .scale(scale: 0.985, anchor: .top))
                    )
                )
            }
        }
        .padding(.top, 6)
        .animation(dropdownRevealAnimation, value: showStepTwoPollIssuesDropdown)
    }

    private var stepThreeBallotErrorDropdown: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(.easeInOut(duration: 0.22)) {
                    showStepThreeBallotErrorDropdown.toggle()
                }
            } label: {
                HStack(spacing: 8) {
                    Text(
                        l(
                            "app.registration.step3.ballot_error.dropdown.title",
                            "How to Correct Error on a Ballot"
                        )
                    )
                    .font(CivicaTypography.supportStrong)
                    .foregroundColor(VoteNowColors.primaryCTA)

                    Spacer(minLength: 8)

                    Image(systemName: showStepThreeBallotErrorDropdown ? "chevron.up" : "chevron.down")
                        .font(CivicaTypography.captionBold)
                        .foregroundColor(VoteNowColors.primaryCTA)
                }
            }
            .buttonStyle(.plain)

            if showStepThreeBallotErrorDropdown {
                VStack(alignment: .leading, spacing: 10) {
                    Text(l("app.registration.card.ballot_cure.title.updated", "Absentee Ballot Cure Process"))
                        .font(CivicaTypography.subheadBold)
                        .foregroundColor(VoteNowColors.primaryText)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(
                        l(
                            "app.registration.card.ballot_cure.summary.updated",
                            "If your absentee ballot has an issue, your state may allow a cure process to fix and count it before the deadline."
                        )
                    )
                    .font(CivicaTypography.support)
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)

                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(stepThreePointOneBullets, id: \.self) { bullet in
                            HStack(alignment: .top, spacing: 8) {
                                Text("•")
                                    .font(CivicaTypography.supportStrong)
                                    .foregroundColor(VoteNowColors.primaryCTA)
                                Text(bullet)
                                    .font(CivicaTypography.support)
                                    .foregroundColor(VoteNowColors.primaryText)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }

                    Text(
                        l(
                            "app.registration.card.ballot_cure.notice",
                            "Voters receive notification and can cure the ballot within a deadline."
                        )
                    )
                    .font(CivicaTypography.support)
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.top, 6)
    }

    @ViewBuilder
    private func registrationCardHeading(_ card: VoterRegistrationCard) -> some View {
        if card.kind == .whyRegister {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    stepHeaderBlock(stepLabel: card.stepLabel, title: card.title)
                    Text(locationSubtitle)
                        .font(CivicaTypography.captionStrong)
                        .foregroundColor(VoteNowColors.mutedText)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 0)

                VoteNowLogoIcon(size: 38)
            }
        } else if card.kind == .deadline {
            HStack(alignment: .top, spacing: 10) {
                stepHeaderBlock(stepLabel: card.stepLabel, title: card.title)
                Spacer(minLength: 0)
                if VoteNowLaunchFeatures.shareActionsEnabled {
                    deadlineShareIconButton
                }
            }
        } else {
            stepHeaderBlock(stepLabel: card.stepLabel, title: card.title)
        }
    }

    private func stepHeaderBlock(stepLabel: String, title: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            if !stepLabel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(stepLabel)
                    .font(CivicaTypography.supportBold)
                    .foregroundColor(VoteNowColors.primaryCTA)
            }
            Text(title)
                .font(CivicaTypography.cardTitle)
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func checkRegistrationPrimaryButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Text(title)
                    .font(CivicaTypography.sectionHeader)
                    .foregroundColor(VoteNowColors.onPrimaryText)
                Spacer(minLength: 8)
                ZStack {
                    Circle()
                        .fill(VoteNowColors.iconOnPrimarySurface)
                    Circle()
                        .stroke(VoteNowColors.iconOnPrimaryBorder, lineWidth: 1)
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(VoteNowColors.primaryCTA)
                }
                .frame(width: 28, height: 28)
            }
            .padding(.horizontal, 15)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(VoteNowColors.primaryCTA)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func ballotStatusPrimaryButton(
        _ title: String,
        isEnabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: isEnabled ? "checkmark.circle" : "lock.fill")
                    .font(CivicaTypography.captionBold)
                Text(isEnabled ? title : "\(title) (Unavailable)")
                    .font(CivicaTypography.subheadStrong)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .foregroundColor(isEnabled ? VoteNowColors.onPrimaryText : VoteNowColors.mutedText)
            .background(isEnabled ? VoteNowColors.primaryCTA : VoteNowColors.secondaryButtonFillDisabled)
            .overlay(
                Capsule(style: .continuous)
                    .stroke(
                        isEnabled ? VoteNowColors.primaryCTA.opacity(0.25) : VoteNowColors.secondaryButtonDisabledBorder,
                        lineWidth: 1
                    )
            )
            .clipShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }

    private func deadlineActionRow(
        primaryTitle: String,
        primaryAction: VoterRegistrationCard.Action
    ) -> some View {
        HStack(spacing: 10) {
            Button(primaryTitle) {
                handleCardAction(primaryAction)
            }
            .font(CivicaTypography.subheadStrong)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .foregroundColor(VoteNowColors.primaryCTA)
            .background(VoteNowColors.primaryCTA.opacity(0.10))
            .overlay(
                Capsule()
                    .stroke(VoteNowColors.primaryCTA.opacity(0.34), lineWidth: 1)
            )
            .clipShape(Capsule())

            if VoteNowLaunchFeatures.shareActionsEnabled {
                Button {
                    openDeadlineActions()
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(VoteNowColors.primaryCTA)
                        .frame(width: 30, height: 30)
                        .background(
                            Circle()
                                .fill(VoteNowColors.infoSurfaceBlue)
                        )
                }
                .buttonStyle(.plain)
                .contentShape(Circle())
                .accessibilityLabel(l("app.registration.action.accessibility", "Registration actions"))
            }
        }
    }

    private var deadlineShareIconButton: some View {
        Button {
            openDeadlineActions()
        } label: {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(VoteNowColors.primaryCTA)
                .frame(width: 30, height: 30)
                .background(
                    Circle()
                        .fill(VoteNowColors.infoSurfaceBlue)
                )
        }
        .buttonStyle(.plain)
        .contentShape(Circle())
        .accessibilityLabel(l("app.registration.action.share_deadline", "Share Deadline"))
    }

    private var deadlinePanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                registrationStateFlag()

                VStack(alignment: .leading, spacing: 6) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(registrationDeadlineLabel)
                            .font(CivicaTypography.subheadStrong)
                            .foregroundColor(VoteNowColors.primaryText)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(formattedElectionDay(guideContent?.registrationDeadline))
                            .font(CivicaTypography.sectionHeaderBold)
                            .foregroundColor(VoteNowColors.primaryText)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            if !methodSpecificDeadlineRows.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(methodSpecificDeadlineRows.enumerated()), id: \.offset) { _, item in
                        Text("\(item.label): \(item.value)")
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundColor(VoteNowColors.mutedText)
                    }
                }
            }
        }
        .padding(12)
        .background(VoteNowColors.infoSurfaceBlue)
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.16), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var deadlineDoubleCheckPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(l("app.registration.card.check.subheader", "Double Check if you are Registered"))
                .font(CivicaTypography.subheadBold)
                .foregroundColor(VoteNowColors.primaryText)

            Text(
                l(
                    "app.registration.card.check.summary",
                    "Use your state’s official voter lookup to verify your registration details are active and accurate."
                )
            )
            .font(CivicaTypography.support)
            .foregroundColor(VoteNowColors.primaryText)
            .fixedSize(horizontal: false, vertical: true)

            checkRegistrationPrimaryButton(
                l("app.registration.action.check_registration", "Check my registration")
            ) {
                handleCardAction(.openURL(registrationPortalURL))
            }
            .padding(.top, 2)
        }
        .padding(12)
        .background(VoteNowColors.infoSurfaceBlue.opacity(0.72))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.18), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var preMapvElectionOverviewPanel: some View {
        let payload = demoElectionOverviewPayload

        return VStack(alignment: .leading, spacing: 10) {
            Text("Election Overview (Demo)")
                .font(CivicaTypography.subheadBold)
                .foregroundColor(VoteNowColors.primaryText)

            Text("Address on file: \(locationSubtitle)")
                .font(CivicaTypography.supportStrong)
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)

            Text("\(payload.electionName) • \(formattedOverviewDate(payload.electionDateISO))")
                .font(CivicaTypography.supportStrong)
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 4) {
                Text("Early voting: \(formattedOverviewDate(payload.earlyVotingStartISO)) to \(formattedOverviewDate(payload.earlyVotingEndISO))")
                Text("Status: \(payload.status)")
                Text("Party ballot: \(payload.partyBallot)")
                Text("Jurisdiction: \(payload.state), \(payload.county) County, \(payload.district)")
                Text("Primary type: \(payload.primaryType)")
            }
            .font(CivicaTypography.footnote)
            .foregroundColor(VoteNowColors.mutedText)
            .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 8) {
                Text("Contests")
                    .font(CivicaTypography.supportStrong)
                    .foregroundColor(VoteNowColors.primaryText)

                ForEach(Array(payload.contests.enumerated()), id: \.offset) { _, contest in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(contest.office)
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundColor(VoteNowColors.primaryText)
                        Text("\(contest.scopeOrDistrict) • Nominate \(contest.numberToNominate)")
                            .font(CivicaTypography.caption)
                            .foregroundColor(VoteNowColors.mutedText)
                        Text("Candidates: \(contest.candidates.joined(separator: ", "))")
                            .font(CivicaTypography.caption)
                            .foregroundColor(VoteNowColors.mutedText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.bottom, 2)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Notes")
                    .font(CivicaTypography.supportStrong)
                    .foregroundColor(VoteNowColors.primaryText)

                ForEach(payload.notes, id: \.self) { note in
                    HStack(alignment: .top, spacing: 6) {
                        Text("•")
                            .font(CivicaTypography.captionStrong)
                            .foregroundColor(VoteNowColors.primaryCTA)
                        Text(note)
                            .font(CivicaTypography.caption)
                            .foregroundColor(VoteNowColors.mutedText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }

            Text("Source printed at: \(payload.sourcePrintedAt)")
                .font(CivicaTypography.caption)
                .foregroundColor(VoteNowColors.mutedText)
        }
        .padding(12)
        .background(VoteNowColors.infoSurfaceBlue.opacity(0.62))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.16), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var thenVoteTimelinePanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            thenVoteTimelineRow(
                symbolName: "clock.fill",
                title: l("app.guide.voting.early_vote.label", "Early Vote"),
                body: earlyVoteTimelineValue
            )

            thenVoteTimelineRow(
                symbolName: "envelope.fill",
                title: l("app.guide.voting.by_mail.label", "Vote by Mail"),
                body: voteByMailDeadlineValue
            )

            Button {
                openMailInBallotRequest()
            } label: {
                Text(l("app.guide.voting.by_mail.cta.more_info", "Mail ballot rules"))
                    .font(CivicaTypography.captionStrong)
                    .foregroundColor(VoteNowColors.onPrimaryText)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(VoteNowColors.primaryCTA)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)

            thenVoteTimelineRow(
                symbolName: "calendar.circle.fill",
                title: l("app.guide.voting.election_day.label", "Election Day"),
                body: formattedElectionDay(nextUpcomingElectionDay)
            )
        }
        .padding(12)
        .background(VoteNowColors.infoSurfaceBlue)
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.16), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func formattedOverviewDate(_ isoDate: String) -> String {
        let value = isoDate.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return isoDate }
        guard let date = Self.isoDateFormatter.date(from: value) else {
            return isoDate
        }
        return Self.monthDayYearDisplayFormatter.string(from: date)
    }

    private func thenVoteTimelineRow(symbolName: String, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbolName)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(VoteNowColors.primaryCTA)
                .frame(width: 24, height: 24, alignment: .center)

            (
                Text(title).bold()
                + Text(": \(body)")
            )
            .font(CivicaTypography.support)
            .foregroundColor(VoteNowColors.primaryText)
            .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)
        }
    }

    private var earlyVoteTimelineValue: String {
        if let startDate = nextUpcomingEarlyVotingDate {
            return lf(
                "app.guide.voting.early_vote.starts_only",
                "Starts %@",
                Self.monthDayYearDisplayFormatter.string(from: startDate)
            )
        }

        let value = nextUpcomingEarlyVotingValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let tbd = l("app.registration.date_tbd", "Date TBD")
        guard !value.isEmpty else { return tbd }
        if value.caseInsensitiveCompare(tbd) == .orderedSame {
            return tbd
        }

        let normalizedValue = value.replacingOccurrences(
            of: #"(?i)^starts\s+"#,
            with: "",
            options: .regularExpression
        )
        return lf("app.guide.voting.early_vote.starts_only", "Starts %@", normalizedValue)
    }

    private var voteByMailDeadlineValue: String {
        for candidate in voteByMailDeadlineLookupCandidates {
            guard let record = MailBallotDeadlinesStore.deadlines(for: candidate) else { continue }
            let raw = [
                record.methods.byMail,
                record.methods.onlineEmail,
                record.methods.inPerson
            ]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty && $0.lowercased() != "n/a" }

            if let raw {
                return compactDeadlineText(raw)
            }
        }

        if let methodSpecific = methodSpecificDeadlineRows.first(where: {
            $0.label.lowercased().contains("mail")
        })?.value, !methodSpecific.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return compactDeadlineText(methodSpecific)
        }

        return l("app.guide.voting.by_mail.deadline.fallback", "See Mail/Absentee details")
    }

    private var voteByMailDeadlineLookupCandidates: [String] {
        [
            registrationStateCode,
            guideContext?.stateName,
            planVM.userAddress.state,
            registrationStateDisplayName
        ]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private func compactDeadlineText(_ raw: String) -> String {
        let collapsed = raw
            .replacingOccurrences(of: "\n", with: " ")
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let afterColon: String
        if let idx = collapsed.lastIndex(of: ":"), idx < collapsed.index(before: collapsed.endIndex) {
            afterColon = String(collapsed[collapsed.index(after: idx)...]).trimmingCharacters(in: .whitespacesAndNewlines)
        } else {
            afterColon = collapsed
        }

        let firstSentence = afterColon
            .split(separator: ".", maxSplits: 1, omittingEmptySubsequences: true)
            .first
            .map(String.init)?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let firstSentence, !firstSentence.isEmpty else {
            return collapsed
        }
        return firstSentence
    }

    private var nextUpcomingEarlyVotingValue: String {
        let fallback = l("app.registration.date_tbd", "Date TBD")
        guard let election = nextUpcomingElection else { return fallback }

        let earlyVotingText = election.earlyVotingText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !earlyVotingText.isEmpty {
            if let normalized = normalizedEarlyVoteDateText(from: earlyVotingText) {
                return normalized
            }
            return earlyVotingText
        }

        let calendar = Calendar.current
        if !calendar.isDate(election.startDate, inSameDayAs: election.electionDay) {
            return Self.monthDayYearDisplayFormatter.string(from: election.startDate)
        }

        return fallback
    }

    private func normalizedEarlyVoteDateText(from raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let withoutStarts = trimmed.replacingOccurrences(
            of: #"(?i)^starts\s+"#,
            with: "",
            options: .regularExpression
        )
        let candidate = withoutStarts.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !candidate.isEmpty else { return nil }

        if let directISO = Self.isoDateFormatter.date(from: candidate) {
            return Self.monthDayYearDisplayFormatter.string(from: directISO)
        }

        if let isoMatch = candidate.range(of: #"\b\d{4}-\d{2}-\d{2}\b"#, options: .regularExpression) {
            let isoToken = String(candidate[isoMatch])
            if let parsed = Self.isoDateFormatter.date(from: isoToken) {
                return Self.monthDayYearDisplayFormatter.string(from: parsed)
            }
        }

        for formatter in Self.earlyVoteInputFormatters {
            if let parsed = formatter.date(from: candidate) {
                return Self.monthDayYearDisplayFormatter.string(from: parsed)
            }
        }

        return nil
    }

    private func openMailInBallotRequest() {
        showMailInBallotPage = true
    }

    private func openDeadlineActions() {
        showingDeadlineActions = true
    }

    private func registrationReadinessPanel(proxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            upcomingElectionTimelinePreviewCard

            Divider()
                .overlay(VoteNowColors.primaryCTA.opacity(0.16))
                .padding(.top, 1)

            registrationGuideStripContent(proxy: proxy)
                .padding(.top, 0)
                .background(
                    GeometryReader { geo in
                        Color.clear.preference(
                            key: RegistrationGuideStripMinYPreferenceKey.self,
                            value: geo.frame(in: .named("VoterRegistrationScroll")).minY
                        )
                    }
                )
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: VoteNowColors.cardCornerRadius, style: .continuous)
                .fill(VoteNowColors.surfaceWhite)
        )
        .overlay(
            RoundedRectangle(cornerRadius: VoteNowColors.cardCornerRadius, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.12), lineWidth: 1)
        )
    }

    @ViewBuilder
    private var upcomingElectionTimelinePreviewCard: some View {
        if let election = nextUpcomingElection {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 10) {
                    registrationStateFlag(width: 64, height: 42, cornerRadius: 6)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(timelinePreviewTitle(for: election))
                            .font(CivicaTypography.sectionHeaderBold)
                            .foregroundColor(VoteNowColors.primaryText)
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)

                        Text(registrationStateDisplayName)
                            .font(CivicaTypography.subheadStrong)
                            .foregroundColor(VoteNowColors.mutedText)
                            .lineLimit(1)
                            .minimumScaleFactor(0.9)
                    }
                    Spacer(minLength: 8)
                }

                Text(
                    "\(l("app.registration.readiness.deadline", "Registration deadline")): \(formattedElectionDay(guideContent?.registrationDeadline))"
                )
                .font(CivicaTypography.captionStrong)
                .foregroundColor(VoteNowColors.primaryCTA)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(VoteNowColors.infoSurfaceBlue)
                .clipShape(Capsule())
                .lineLimit(1)
                .minimumScaleFactor(0.75)

                HStack(spacing: 8) {
                    readinessDatePill(
                        title: l("app.registration.readiness.early_vote", "Early Vote"),
                        value: nextUpcomingEarlyVotingValue
                    )
                    readinessDatePill(
                        title: l("app.registration.readiness.election_day", "Election Day"),
                        value: formattedElectionDay(nextUpcomingElectionDay)
                    )
                }
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.top, 1)
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Text(readinessTitleText)
                    .font(CivicaTypography.sectionHeaderBold)
                    .foregroundColor(VoteNowColors.primaryText)
                Text(l("app.guide.error.no_upcoming", "No upcoming elections found for your state."))
                    .font(CivicaTypography.subhead)
                    .foregroundColor(VoteNowColors.mutedText)
            }
        }
    }

    private func readinessLeftField(_ label: String, _ value: String, valueColor: Color = VoteNowColors.primaryText) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(CivicaTypography.captionStrong)
                .foregroundColor(VoteNowColors.mutedText)
            Text(value)
                .font(CivicaTypography.subheadBold)
                .foregroundColor(valueColor)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
        }
    }

    private func readinessDatePill(title: String, value: String) -> some View {
        VStack(alignment: .center, spacing: 2) {
            Text(title)
                .font(CivicaTypography.captionBold)
                .foregroundColor(VoteNowColors.primaryCTA)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            Text(value)
                .font(CivicaTypography.captionStrong)
                .foregroundColor(VoteNowColors.primaryText)
                .lineLimit(2)
                .minimumScaleFactor(0.82)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(VoteNowColors.infoSurfaceBlue.opacity(0.85))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.18), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func timelinePreviewTitle(for election: Election) -> String {
        let state = registrationStateDisplayName
        let base = election.name
            .replacingOccurrences(of: state, with: "", options: .caseInsensitive)
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
        if !base.isEmpty { return base }
        if !phase.isEmpty { return phase }
        return election.name
    }

    private func registrationGuideStripContent(proxy: ScrollViewProxy) -> some View {
        HStack(spacing: 10) {
            registrationGuideStripButton(
                title: l("app.registration.guide.step.register", "Register"),
                phase: .preElection,
                proxy: proxy
            )
            Text("|")
                .font(CivicaTypography.subheadBold)
                .foregroundColor(VoteNowColors.mutedText.opacity(0.75))
            registrationGuideStripButton(
                title: l("app.registration.guide.step.vote", "Vote"),
                phase: .duringElection,
                proxy: proxy
            )
            Text("|")
                .font(CivicaTypography.subheadBold)
                .foregroundColor(VoteNowColors.mutedText.opacity(0.75))
            registrationGuideStripButton(
                title: l("app.registration.guide.step.confirm", "Confirm"),
                phase: .postElection,
                proxy: proxy
            )
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.horizontal, 2)
        .padding(.vertical, 2)
    }

    @ViewBuilder
    private func stickyGuideStripDock(proxy: ScrollViewProxy) -> some View {
        registrationGuideStripContent(proxy: proxy)
            .padding(.horizontal, 12)
            .padding(.vertical, 5)
            .background(
                BottomRoundedRectangle(radius: 12)
                    .fill(VoteNowColors.surfaceWhite)
            )
            .overlay(
                BottomRoundedRectangle(radius: 12)
                    .stroke(VoteNowColors.primaryCTA.opacity(0.22), lineWidth: 2)
            )
            .clipShape(BottomRoundedRectangle(radius: 12))
            .shadow(color: VoteNowColors.primaryText.opacity(0.06), radius: 6, x: 0, y: 2)
            .padding(.horizontal, 16)
            .padding(.top, 0)
            .padding(.bottom, 4)
            .background(
                GeometryReader { geo in
                    Color.clear.preference(
                        key: StickyGuideStripHeightPreferenceKey.self,
                        value: geo.size.height
                    )
                }
            )
    }

    private func registrationGuideStripButton(
        title: String,
        phase: VoterRegistrationCard.Phase,
        proxy: ScrollViewProxy
    ) -> some View {
        let isActive = phase == activeGuidePhase
        let accent = guidePhaseHighlightColor(for: phase)
        return Button {
            jumpToGuidePhase(phase, proxy: proxy)
        } label: {
            Text(title)
                .font(.headline.weight(isActive ? .bold : .semibold))
                .foregroundColor(isActive ? .white : VoteNowColors.primaryText)
                .lineLimit(1)
                .minimumScaleFactor(0.86)
                .padding(.horizontal, 10)
                .padding(.vertical, 3)
                .background(
                    Capsule(style: .continuous)
                        .fill(isActive ? accent : .clear)
                )
        }
        .buttonStyle(GuideStripTapFeedbackStyle(accent: accent, isActive: isActive))
    }

    private struct GuideScrollJump {
        let firstTarget: AnyHashable
        let firstAnchor: UnitPoint
        let secondTarget: AnyHashable
        let secondAnchor: UnitPoint
    }

    private func jumpToGuidePhase(_ phase: VoterRegistrationCard.Phase, proxy: ScrollViewProxy) {
        currentlyViewedPhase = phase
        guidePhaseSelectionLock = phase
        let token = UUID()
        guidePhaseSelectionLockToken = token

        let jump = scrollJump(for: phase)

        withAnimation(.interactiveSpring(response: 0.72, dampingFraction: 0.9, blendDuration: 0.2)) {
            proxy.scrollTo(jump.firstTarget, anchor: jump.firstAnchor)
        }

        // Lazy stacks can occasionally miss a single jump while layout settles.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
            withAnimation(.easeInOut(duration: 0.26)) {
                proxy.scrollTo(jump.secondTarget, anchor: jump.secondAnchor)
            }
        }

        // Hold selection through animated travel to avoid transient middle-step highlights.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
            guard guidePhaseSelectionLockToken == token else { return }
            guidePhaseSelectionLock = nil
            currentlyViewedPhase = phase
        }
    }

    private func scrollJump(for phase: VoterRegistrationCard.Phase) -> GuideScrollJump {
        let sectionTarget = AnyHashable(phase)
        let fallbackTarget = preferredScrollTarget(for: phase)

        switch phase {
        case .preElection, .duringElection:
            let hasPhaseSection = groupedSections.contains(where: { $0.phase == phase })
            let bufferedTopTarget = hasPhaseSection
                ? AnyHashable(sectionTopAnchorID(for: phase))
                : fallbackTarget
            return GuideScrollJump(
                firstTarget: hasPhaseSection ? sectionTarget : fallbackTarget,
                firstAnchor: .top,
                secondTarget: bufferedTopTarget,
                secondAnchor: .top
            )
        case .postElection:
            let postSectionTarget = groupedSections.contains(where: { $0.phase == .postElection })
                ? sectionTarget
                : fallbackTarget
            let postCardTarget = cards.last(where: { $0.phase == .postElection })
                .map { AnyHashable($0.id) } ?? postSectionTarget
            return GuideScrollJump(
                firstTarget: postSectionTarget,
                firstAnchor: .top,
                secondTarget: postCardTarget,
                secondAnchor: .bottom
            )
        }
    }

    private func sectionTopAnchorID(for phase: VoterRegistrationCard.Phase) -> String {
        "guide-top-anchor-\(phase)"
    }

    private var guideStripTapLandingOffset: CGFloat {
        let stripHeight = measuredStickyGuideStripHeight > 0 ? measuredStickyGuideStripHeight : 42
        return stripHeight + 12
    }

    private func preferredScrollTarget(for phase: VoterRegistrationCard.Phase) -> AnyHashable {
        if groupedSections.contains(where: { $0.phase == phase }) {
            return AnyHashable(phase)
        }

        if let firstSection = groupedSections.first {
            return AnyHashable(firstSection.phase)
        }

        if let primaryCard = cards.first(where: { $0.phase == phase }) {
            return AnyHashable(primaryCard.id)
        }

        return AnyHashable(phase)
    }

    private func guidePhaseHighlightColor(for phase: VoterRegistrationCard.Phase) -> Color {
        switch phase {
        case .preElection:
            return VoteNowColors.primaryCTA
        case .duringElection:
            return VoteNowColors.timelineFocusGold
        case .postElection:
            return VoteNowColors.successGreen
        }
    }

    private var preSectionBackgroundColor: Color {
        VoteNowColors.appBackground
    }

    private var stickyHeaderOffset: CGFloat {
        let measured = measuredStickyHeaderHeight > 0 ? measuredStickyHeaderHeight : stickyHeaderMinHeight
        return max(stickyHeaderMinHeight, min(measured + 2, 132))
    }

    private var postSectionBackgroundColor: Color {
        VoteNowColors.appBackground
    }

    private var overscrollBackground: some View {
        VoteNowColors.appBackground.ignoresSafeArea()
    }

    private var registrationStateDisplayName: String {
        let contextName = guideContext?.stateName.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !contextName.isEmpty {
            return contextName
        }

        let enteredState = planVM.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines)
        if enteredState.count > 2 {
            return enteredState
        }

        return l("app.registration.readiness.state.fallback", "Your state")
    }

    private var headerLocationSubtitle: String {
        if let resolvedLocationSummary {
            return resolvedLocationSummary
        }
        return l("app.registration.location.setup_needed", unresolvedLocationMessage)
    }

    private var resolvedLocationCity: String? {
        let resolvedCity = repsVM.resolvedLocationSelection?.city?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !resolvedCity.isEmpty {
            return resolvedCity
        }

        let enteredCity = planVM.userAddress.city.trimmingCharacters(in: .whitespacesAndNewlines)
        return enteredCity.isEmpty ? nil : enteredCity
    }

    private var resolvedLocationSummary: String? {
        guard let state = registrationStateCode else { return nil }
        let zip = normalizedShareZip?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let city = resolvedLocationCity?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        if !city.isEmpty && !zip.isEmpty {
            return "\(city), \(state) (\(zip))"
        }
        if !city.isEmpty {
            return "\(city), \(state)"
        }
        if !zip.isEmpty {
            return "\(state) (\(zip))"
        }
        return state
    }

    private var readinessTitleText: String {
        "You're almost ready for the \(electionCycleLabel)"
    }

    private var electionCycleLabel: String {
        if let context = guideContext {
            return "\(context.electionType.displayName) \(context.phase.displayName)"
        }
        return l("app.registration.header.subtitle.fallback", "Midterm Primary")
    }

    private var phaseForNow: VoterRegistrationCard.Phase {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        guard let electionDayRaw = nextUpcomingElectionDay else { return .preElection }
        let electionDay = calendar.startOfDay(for: electionDayRaw)
        let duringStartRaw = nextUpcomingEarlyVotingDate ?? electionDayRaw
        let duringStart = calendar.startOfDay(for: duringStartRaw)

        if today < duringStart { return .preElection }
        if today <= electionDay { return .duringElection }
        return .postElection
    }

    private var shouldShowStickyGuideStrip: Bool {
        registrationGuideStripMinY <= stickyHeaderOffset + 2
    }

    private var activeGuidePhase: VoterRegistrationCard.Phase {
        guidePhaseSelectionLock ?? currentlyViewedPhase ?? phaseForNow
    }

    private func updateCurrentlyViewedPhase(with positions: [String: CGFloat]) {
        guard guidePhaseSelectionLock == nil else { return }

        let tracked = groupedSections.compactMap { section -> (phase: VoterRegistrationCard.Phase, minY: CGFloat)? in
            guard let minY = positions[section.id] else { return nil }
            return (phase: section.phase, minY: minY)
        }
        guard !tracked.isEmpty else { return }

        let targetY = stickyHeaderOffset + 8
        let sorted = tracked.sorted { $0.minY < $1.minY }
        let nextPhase: VoterRegistrationCard.Phase? = {
            if let post = sorted.first(where: { $0.phase == .postElection }),
               post.minY <= targetY + 260 {
                return .postElection
            }
            if let visible = sorted.last(where: { $0.minY <= targetY }) {
                return visible.phase
            }
            return sorted.first?.phase
        }()
        guard nextPhase != currentlyViewedPhase else { return }
        currentlyViewedPhase = nextPhase
    }

    private func openMyInfoPanel() {
        NotificationCenter.default.post(name: .openMyInfoPanel, object: nil)
    }

    private func retryRegistrationGuideLoad() {
        if let zip = normalizedShareZip, zip.count == 5 {
            repsVM.fetchReps(for: zip)
            return
        }
        repsVM.centerOnCurrentLocation()
    }

    @ViewBuilder
    private func registrationStateFlag(
        width: CGFloat = 41,
        height: CGFloat = 29,
        cornerRadius: CGFloat = 4
    ) -> some View {
        if let asset = StateFlagCatalog.assetName(for: registrationStateCode),
           UIImage(named: asset) != nil {
            Image(asset)
                .resizable()
                .scaledToFill()
                .frame(width: width, height: height)
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                )
                .opensMyInfoPanelOnLongPress()
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(VoteNowColors.infoSurfaceBlue)
                Text(registrationStateCode ?? "US")
                    .font(CivicaTypography.captionBold)
                    .foregroundColor(VoteNowColors.primaryCTA)
            }
            .frame(width: width, height: height)
        }
    }

    private var registrationStateCode: String? {
        if let code = guideContext?.stateCode.trimmingCharacters(in: .whitespacesAndNewlines),
           code.count == 2 {
            return code.uppercased()
        }

        if let resolved = normalizedUSStateCode(from: repsVM.resolvedStateCode) {
            return resolved
        }
        if let detected = normalizedUSStateCode(from: repsVM.detectedStateCode) {
            return detected
        }
        if let entered = normalizedUSStateCode(from: planVM.userAddress.state) {
            return entered
        }
        if let entered = normalizedUSStateCode(from: repsVM.resolvedLocationSelection?.administrativeArea) {
            return entered
        }

        if let zip = normalizedShareZip, zip.count == 5 {
            return zipStateResolver.stateCode(for: zip)
        }

        return nil
    }

    private var stateProvisionalBallotURL: URL {
        guard let code = registrationStateCode,
              let raw = Self.provisionalBallotURLsByStateCode[code],
              let url = URL(string: raw) else {
            return defaultProvisionalBallotURL
        }
        return url
    }

    private var provisionalBallotActionTitle: String {
        let prefix = registrationStateCode ?? l("app.registration.provisional.state_prefix", "State")
        return "\(prefix) \(l("app.registration.action.provisional_info", "Provisional ballot rights"))"
    }

    private var stepTwoPointOneBullets: [String] {
        [
            l(
                "app.registration.card.provisional.bullet_3.updated",
                "If complications arise, states must offer a provisional ballot upon request to address:"
            ),
            l(
                "app.registration.card.provisional.bullet_4",
                "A voter claims they are registered but their name does not appear on the voter roll."
            ),
            l(
                "app.registration.card.provisional.bullet_5.updated",
                "A voter cannot provide the state's identification requirements immediately."
            )
        ]
    }

    private var stepThreePointOneBullets: [String] {
        [
            l("app.registration.card.ballot_cure.bullet_1", "Missing signature"),
            l("app.registration.card.ballot_cure.bullet_2", "Signature mismatch"),
            l("app.registration.card.ballot_cure.bullet_3", "Missing ID number")
        ]
    }

    private var primaryBallotGuidancePanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            (
                Text(l("app.guide.card.party_affiliation.prefix", "The "))
                + Text(l("app.guide.party.democrat", "Democrat"))
                    .foregroundColor(VoteNowColors.richBlue)
                    .fontWeight(.semibold)
                + Text(l("app.guide.card.party_affiliation.middle", " and "))
                + Text(l("app.guide.party.republican", "Republican"))
                    .foregroundColor(VoteNowColors.richRed)
                    .fontWeight(.semibold)
                + Text(
                    l(
                        "app.guide.card.party_affiliation.suffix",
                        " parties are the two largest in the U.S. In many states, your registration determines which primary ballot you can use."
                    )
                )
            )
            .font(CivicaTypography.support)
            .foregroundColor(VoteNowColors.primaryText)
            .fixedSize(horizontal: false, vertical: true)
            .opensMyInfoPanelOnLongPress()
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            VoteNowColors.infoSurfaceBlue.opacity(0.78),
                            VoteNowColors.infoSurfaceBlue.opacity(0.56)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.24), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var provisionalRequestPanel: some View {
        return VStack(alignment: .leading, spacing: 8) {
            Text(l("app.registration.provisional.request.title", "How to request a provisional ballot"))
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(VoteNowColors.primaryText)

            VStack(alignment: .leading, spacing: 6) {
                requestStepLine(l("app.registration.provisional.request.step_1", "1. Tell the poll worker: “I want to vote by provisional ballot.”"))
                requestStepLine(
                    l(
                        "app.registration.provisional.request.step_2.reindexed",
                        "2. Complete the provisional ballot envelope carefully and provide any requested ID details."
                    )
                )
                requestStepLine(
                    l(
                        "app.registration.provisional.request.step_3.reindexed",
                        "3. Get a receipt or tracking and confirm cure deadlines before leaving."
                    )
                )
            }
        }
        .padding(12)
        .background(VoteNowColors.infoSurfaceBlue.opacity(0.72))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.18), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func requestStepLine(_ text: String) -> some View {
        Text(text)
            .font(CivicaTypography.support)
            .foregroundColor(VoteNowColors.primaryText)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var currentPartyLabel: String {
        switch planVM.selectedParty {
        case .democrat:
            return l("app.registration.party.democrat", "Democrat")
        case .republican:
            return l("app.registration.party.republican", "Republican")
        case .independent:
            return l("app.registration.party.independent", "Independent")
        }
    }

    private var currentPartyColor: Color {
        switch planVM.selectedParty {
        case .democrat:
            return VoteNowColors.richBlue
        case .republican:
            return VoteNowColors.richRed
        case .independent:
            return VoteNowColors.primaryText
        }
    }

    private func isProvisionalLeadLine(_ text: String) -> Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .hasPrefix("complications happen")
    }

    private func handleCardAction(_ action: VoterRegistrationCard.Action) {
        switch action {
        case .openURL(let url):
            openURL(url)
        case .goToHowToVoteTab:
            if case .success = registrationLaunchState {
                pendingScrollTargetID = AnyHashable(electionOverviewAnchorID)
            } else {
                openURL(howToVoteDeepLink)
            }
        case .shareDeadline:
            guard VoteNowLaunchFeatures.shareActionsEnabled else { return }
            shareRegistrationDeadline()
        }
    }

    private func shareRegistrationDeadline() {
        let stateLabel = registrationStateCode ?? l("app.timeline.statewide", "Statewide")
        let deadline = guideContent?.registrationDeadline.map { Self.isoDateFormatter.string(from: $0) }
        let badge = "\(stateLabel) · \(formattedElectionDay(guideContent?.registrationDeadline))"
        var details: [URLQueryItem] = [
            URLQueryItem(name: "state", value: registrationStateCode),
            URLQueryItem(name: "mode", value: "check_update_register")
        ]
        if let zip = normalizedShareZip {
            details.append(URLQueryItem(name: "zip", value: zip))
        }
        if let deadline {
            details.append(URLQueryItem(name: "deadline", value: deadline))
        }

        let payload = VoteNowShareCardPayload(
            cardType: .registration,
            target: .registration,
            title: l("app.registration.share.headline", "Check Your Registration"),
            subtitle: l(
                "app.registration.share.subtitle",
                "Register, update your address, or check your voter status."
            ),
            cta: l("app.registration.share.cta", "Check Registration"),
            badge: badge,
            campaign: "send-to-friend",
            details: details
        )

        shareItems = VoteNowShareComposer.activityItems(for: payload)
        showingShareSheet = true
    }

    private func formattedElectionDay(_ date: Date?) -> String {
        guard let date else { return l("app.registration.date_tbd", "Date TBD") }
        return Self.displayDateFormatter.string(from: date)
    }

    private func formattedPhaseDate(_ date: Date?) -> String {
        formattedElectionDay(date)
    }

    private func countdownText(to date: Date?) -> String {
        guard let date else { return l("app.registration.countdown.tbd", "Countdown TBD") }
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let electionDay = calendar.startOfDay(for: date)
        let delta = calendar.dateComponents([.day], from: today, to: electionDay).day ?? 0

        if delta == 0 { return l("app.registration.countdown.today", "Election day is today") }
        if delta > 0 {
            if delta == 1 {
                return l("app.registration.countdown.left.one", "1 day left")
            }
            return lf("app.registration.countdown.left.many", "%d days left", delta)
        }
        let ago = abs(delta)
        if ago == 1 {
            return l("app.registration.countdown.ago.one", "1 day ago")
        }
        return lf("app.registration.countdown.ago.many", "%d days ago", ago)
    }

    private var normalizedShareZip: String? {
        if let contextZip = guideContext?.zip {
            let normalized = String(contextZip.filter(\.isNumber).prefix(5))
            if normalized.count == 5 { return normalized }
        }

        let resolvedZip = String((repsVM.resolvedLocationSelection?.postalCode ?? "").filter(\.isNumber).prefix(5))
        if resolvedZip.count == 5 { return resolvedZip }

        let addressZip = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
        if addressZip.count == 5 { return addressZip }

        let planZip = String(planVM.zip.filter(\.isNumber).prefix(5))
        return planZip.count == 5 ? planZip : nil
    }

    private func parseMethodSpecificDeadlines(from notes: String?) -> [(label: String, value: String)] {
        guard let notes = notes?.trimmingCharacters(in: .whitespacesAndNewlines), !notes.isEmpty else {
            return []
        }

        let pattern = "(?i)(online|mail|by mail|in-person|in person)\\s*[:\\-]\\s*([^\\n;,.]+)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }

        let range = NSRange(notes.startIndex..<notes.endIndex, in: notes)
        let matches = regex.matches(in: notes, range: range)
        var rows: [(String, String)] = []
        var seen = Set<String>()

        for match in matches {
            guard match.numberOfRanges == 3,
                  let kindRange = Range(match.range(at: 1), in: notes),
                  let valueRange = Range(match.range(at: 2), in: notes) else {
                continue
            }

            let rawKind = notes[kindRange].trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let label: String
            switch rawKind {
            case "online":
                label = l("app.registration.deadline.online", "Online deadline")
            case "mail", "by mail":
                label = l("app.registration.deadline.mail", "Mail deadline")
            case "in-person", "in person":
                label = l("app.registration.deadline.in_person", "In-person deadline")
            default:
                label = l("app.registration.deadline.generic", "Deadline")
            }

            let value = notes[valueRange].trimmingCharacters(in: .whitespacesAndNewlines)
            let key = "\(label)|\(value)"
            if !value.isEmpty && !seen.contains(key) {
                rows.append((label, value))
                seen.insert(key)
            }
        }

        return rows
    }

    private static let provisionalBallotURLsByStateCode: [String: String] = [
        "AL": "https://www.sos.alabama.gov/sites/default/files/election-2022/2023_Provisional_Ballot_Guide.pdf",
        "AK": "https://www.elections.alaska.gov/doc/forms/A%26Q%20Ballot%20Processing%20Infographic.pdf",
        "AZ": "https://www.azleg.gov/ars/16/00584.htm",
        "AR": "https://www.sos.arkansas.gov/uploads/rulesRegs/Arkansas%20Register/2009/sep_2009/108.00.09-005.pdf",
        "CA": "https://www.sos.ca.gov/elections/voting-resources/provisional-voting",
        "CO": "https://www.sos.state.co.us/pubs/elections/FAQs/ProvisionalBallots.html",
        "CT": "https://portal.ct.gov/-/media/SOTS/ElectionServices/HAVA/HavaPDF/ProvisionalBallot3pdf.pdf",
        "DE": "https://elections.delaware.gov/voter/provisional.shtml",
        "FL": "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&Search_String=&URL=0100-0199%2F0101%2FSections%2F0101.048.html",
        "GA": "https://georgiapollworkers.sos.ga.gov/Shared%20Documents/SB%20202%20Impacts%20on%20Poll%20Officials.pdf",
        "HI": "https://elections.hawaii.gov/voting/provisional-voting/",
        "ID": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "IL": "https://www.ilga.gov/legislation/ilcs/ilcs4.asp?ActID=170&ChapterID=3&DocName=001000050HArt.+18A&SeqEnd=65750000&SeqStart=64700000",
        "IN": "https://www.in.gov/sos/elections/voter-information/ways-to-vote/provisional-ballots/",
        "IA": "https://sos.iowa.gov/voters/election-day-faq",
        "KS": "https://sos.ks.gov/Pubs/Elections/Guides/Provisional-Voting-Guide.pdf",
        "KY": "https://apps.legislature.ky.gov/law/kar/titles/031/006/020/",
        "LA": "https://www.sos.la.gov/ElectionsAndVoting/Vote/VoteProvisionally/Pages/default.aspx",
        "ME": "https://www.mainelegislature.org/legis/statutes/21-A/title21-Asec673.html",
        "MD": "https://elections.maryland.gov/voting/provisional_voting.html",
        "MA": "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVIII/Chapter54/Section76C",
        "MI": "https://www.legislature.mi.gov/Laws/MCL?objectName=MCL-168-813",
        "MN": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "MS": "https://www.sos.ms.gov/links/elections/elections_officials_center/tab2/2011%20Training/Affidavit%20Ballots%20Online%20Packet.pdf",
        "MO": "https://revisor.mo.gov/main/OneSection.aspx?section=115.430",
        "MT": "https://sosmt.gov/wpfd_file/provisional-ballot-instructions/",
        "NE": "https://nebraskalegislature.gov/laws/statutes.php?statute=32-1002",
        "NV": "https://www.nvsos.gov/sos/elections/voters/provisional-voting",
        "NH": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "NJ": "https://www.nj.gov/state/elections/vote-provisional-ballot.shtml",
        "NM": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "NY": "https://www.nysenate.gov/legislation/laws/ELN/9-209",
        "NC": "https://www.ncsbe.gov/voting/provisional-voting",
        "ND": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "OH": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "OK": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "OR": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "PA": "https://www.pa.gov/en/agencies/vote/voter-support/provisional-ballot.html",
        "RI": "https://elections.ri.gov/voter-resources/provisional-ballot",
        "SC": "https://scvotes.gov/wp-content/uploads/2023/09/scec_11854_10_Voting-in-SC_8.5x11_Web_2023_01.pdf",
        "SD": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "TN": "https://sos.tn.gov/node/149",
        "TX": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "UT": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "VT": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "VA": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "WA": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "WV": "https://www.ncsl.org/elections-and-campaigns/provisional-ballots",
        "WI": "https://myvote.wi.gov/en-us/Provisional-Ballots",
        "WY": "https://sos.wyo.gov/Elections/Docs/2024/Results/General/2024_General_Statewide_Provisional_Ballot_Summary.pdf"
    ]

    private static let displayDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    private static let isoDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let monthDayDisplayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "MMMM d"
        return formatter
    }()

    private static let monthDayYearDisplayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "MMMM d, yyyy"
        return formatter
    }()

    private static let earlyVoteInputFormatters: [DateFormatter] = {
        let patterns = [
            "MMMM d, yyyy",
            "MMM d, yyyy",
            "MMMM d yyyy",
            "MMM d yyyy",
            "M/d/yyyy",
            "MM/dd/yyyy"
        ]
        return patterns.map { pattern in
            let formatter = DateFormatter()
            formatter.calendar = Calendar(identifier: .gregorian)
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone.current
            formatter.dateFormat = pattern
            return formatter
        }
    }()
}

struct VoterRegistrationView_Previews: PreviewProvider {
    static var previews: some View {
        VoterRegistrationView()
            .environmentObject(PlanViewModel())
            .environmentObject(MyRepsViewModel())
    }
}
