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
        value = max(value, nextValue())
    }
}

private struct VoterRegistrationCard: Identifiable {
    enum Action {
        case openURL(URL)
        case goToHowToVoteTab
        case shareReminder
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

// MARK: - VoterRegistrationView
struct VoterRegistrationView: View {
    @Environment(\.openURL) private var openURL
    @Environment(\.locale) private var locale
    @EnvironmentObject private var planVM: PlanViewModel
    @State private var shareItems: [Any] = []
    @State private var showingShareSheet = false
    @State private var showMailInBallotPage = false
    @State private var showingDeadlineActions = false
    @State private var selectedGuidePhase: VoterRegistrationCard.Phase = .preElection
    @State private var isRegisterChipVisible = false
    @State private var isRegisterChipTemporarilyPaused = false
    @State private var measuredStickyHeaderHeight: CGFloat = 0

    private let contextResolver = ElectionGuideContextResolver()
    private let contentProvider = RegistrationGuideContentProvider()
    private let stickyHeaderMinHeight: CGFloat = 84
    private let voteGovURL = URL(string: "https://www.vote.gov/") ?? URL(fileURLWithPath: "/")
    private let defaultProvisionalBallotURL = URL(string: "https://www.eac.gov/research-and-data/provisional-voting")
        ?? URL(fileURLWithPath: "/")
    private let howToVoteDeepLink = URL(string: "votenow://mapv")
        ?? URL(string: "https://www.vote.gov/")
        ?? URL(fileURLWithPath: "/")
    private static let stateVotingFeaturesByCode: [String: RegistrationPrimaryFeature] = {
        guard let url = Bundle.main.url(forResource: "USVotingFeaturesByJurisdiction", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([String: RegistrationPrimaryFeature].self, from: data) else {
            return [:]
        }
        return decoded
    }()
    private static let primaryTypeDataset: RegistrationPrimaryTypeDataset? = {
        guard let url = Bundle.main.url(forResource: "ElectionEligibilityDataset", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(RegistrationPrimaryTypeDataset.self, from: data) else {
            return nil
        }
        return decoded
    }()

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

    private var primaryTypeLabelForState: String? {
        guard let stateCode = registrationStateCode?.uppercased() else { return nil }

        if let feature = Self.stateVotingFeaturesByCode[stateCode] {
            let category = feature.primaryCategory.trimmingCharacters(in: .whitespacesAndNewlines)
            if !category.isEmpty {
                return category
            }
        }

        guard let summary = Self.primaryTypeDataset?.state_summary.first(where: {
            $0.state_abbr.uppercased() == stateCode
        }) else {
            return nil
        }

        if guideContext?.electionType == .presidential {
            let presidential = summary.presidential_primary_type_2026
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !presidential.isEmpty {
                return presidential
            }
        }

        let statePrimary = summary.state_primary_type_2026
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return statePrimary.isEmpty ? nil : statePrimary
    }

    private var isClosedPrimaryState: Bool {
        guard let label = primaryTypeLabelForState?.lowercased() else { return false }
        if label.contains("partially") { return false }
        if label.contains("open") { return false }
        return label.contains("closed")
    }

    private var closedPrimaryStateCodeLabel: String {
        registrationStateCode ?? l("app.registration.provisional.state_prefix", "State")
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
        lf("app.registration.phase.pre.header", "PRE: %@", formattedPhaseDate(prePhaseTargetDate))
    }

    private var duringPhaseHeaderText: String {
        if let startDate = nextUpcomingEarlyVotingDate,
           let endDate = nextUpcomingElectionDay {
            let start = formattedDuringPhaseStart(startDate, endDate)
            let end = formattedDuringPhaseEnd(endDate)
            return lf("app.registration.phase.during.header.range", "DURING (%@ - %@)", start, end)
        }

        let start = duringPhaseStartText
        let end = formattedPhaseDate(nextUpcomingElectionDay)
        return lf("app.registration.phase.during.header.range", "DURING (%@ - %@)", start, end)
    }

    private var postPhaseHeaderText: String {
        let postDate = nextUpcomingElectionDay.flatMap { Calendar.current.date(byAdding: .day, value: 1, to: $0) }
        return lf("app.registration.phase.post.header", "POST: %@", formattedPhaseDate(postDate))
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
        let parts = [
            planVM.userAddress.street.trimmingCharacters(in: .whitespacesAndNewlines),
            planVM.userAddress.city.trimmingCharacters(in: .whitespacesAndNewlines),
            planVM.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines),
            planVM.userAddress.zip.trimmingCharacters(in: .whitespacesAndNewlines)
        ].filter { !$0.isEmpty }

        if !parts.isEmpty {
            return parts.joined(separator: ", ")
        }

        let zip = String(planVM.zip.filter(\.isNumber).prefix(5))
        if zip.count == 5 {
            return zip
        }

        return l("app.registration.location.set_address", "Set your address in My Reps")
    }

    private var cards: [VoterRegistrationCard] {
        [
            VoterRegistrationCard(
                id: "step-1",
                kind: .whyRegister,
                phase: .preElection,
                stepLabel: "",
                title: l("app.registration.card.what_is.title", "What is Voter Registration?"),
                summary: l("app.registration.card.what_is.summary", "Voter registration is the process that puts you on your state’s voter rolls so you are eligible to vote."),
                bullets: [],
                primaryActionTitle: l("app.registration.action.start_registration", "Start registration"),
                primaryAction: .openURL(registrationPortalURL),
                isPrimaryActionCalloutPill: true,
                secondaryActionTitle: nil,
                secondaryAction: nil
            ),
            VoterRegistrationCard(
                id: "step-2",
                kind: .deadline,
                phase: .preElection,
                stepLabel: l("app.registration.step.1.reshuffle", "STEP 1"),
                title: l("app.registration.card.deadline.title", "Register before the deadline"),
                summary: l("app.registration.card.deadline.summary", "Each State has its own deadlines and requirements."),
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
                summary: l("app.registration.card.then_vote.summary", "Once your registration is set, move straight into your voting plan."),
                bullets: [
                    l("app.registration.card.then_vote.bullet_1", "Make a plan for when/where you vote"),
                    l("app.registration.card.then_vote.bullet_2.capitalized", "See what’s on your ballot in advance"),
                    l("app.registration.card.then_vote.bullet_3.no_period", "Confirm polling location and hours")
                ],
                primaryActionTitle: l("app.registration.action.go_how_to_vote", "Go to How to Vote"),
                primaryAction: .goToHowToVoteTab,
                isPrimaryActionCalloutPill: false,
                secondaryActionTitle: nil,
                secondaryAction: nil
            ),
            VoterRegistrationCard(
                id: "step-4",
                kind: .provisional,
                phase: .duringElection,
                stepLabel: l("app.registration.step.2_1.reshuffle", "STEP 2.1"),
                title: l("app.registration.card.provisional.title", "Request a provisional ballot if issues arise at the polling site"),
                summary: l(
                    "app.registration.card.provisional.summary",
                    "A provisional ballot is a ballot that’s set aside at the polls and reviewed later to determine if it can be counted."
                ),
                bullets: [
                    l(
                        "app.registration.card.provisional.bullet_3.updated",
                        "Complications happen, which is why every state is required to offer a provisional ballot if requested; they can help resolve:"
                    ),
                    l("app.registration.card.provisional.bullet_4", "A voter claims they are registered but their name does not appear on the voter roll."),
                    l("app.registration.card.provisional.bullet_5.updated", "A voter cannot provide the state's identification requirements immediately.")
                ],
                primaryActionTitle: provisionalBallotActionTitle,
                primaryAction: .openURL(stateProvisionalBallotURL),
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
                    l("app.registration.card.vote_count.bullet_1", "Use your state's official ballot tracker when available."),
                    l("app.registration.card.vote_count.bullet_2", "If there is an issue, follow cure steps before the deadline.")
                ],
                primaryActionTitle: l("app.registration.action.check_ballot_status", "Check ballot status"),
                primaryAction: .openURL(registrationPortalURL),
                isPrimaryActionCalloutPill: false,
                secondaryActionTitle: nil,
                secondaryAction: nil
            ),
            VoterRegistrationCard(
                id: "step-5",
                kind: .absenteeCure,
                phase: .postElection,
                stepLabel: l("app.registration.step.3_1.reshuffle", "STEP 3.1"),
                title: l("app.registration.card.ballot_cure.title.updated", "Absentee Ballot Cure Process"),
                summary: l(
                    "app.registration.card.ballot_cure.summary.updated",
                    "If your absentee ballot has an issue, your state may allow a cure process to fix and count it before the deadline."
                ),
                bullets: [
                    l("app.registration.card.ballot_cure.bullet_1", "Missing signature"),
                    l("app.registration.card.ballot_cure.bullet_2", "Signature mismatch"),
                    l("app.registration.card.ballot_cure.bullet_3", "Missing ID number")
                ],
                primaryActionTitle: "",
                primaryAction: .openURL(stateProvisionalBallotURL),
                isPrimaryActionCalloutPill: false,
                secondaryActionTitle: nil,
                secondaryAction: nil
            )
        ]
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
                l("app.registration.phase.pre.subtitle", "Confirm your registration details before voting starts"),
                preSectionBackgroundColor,
                VoteNowColors.primaryCTA.opacity(0.68)
            ),
            (
                .duringElection,
                duringPhaseHeaderText,
                l("app.registration.phase.during.subtitle", "Use your plan and show up ready to cast your ballot."),
                VoteNowColors.warningAmber.opacity(0.28),
                VoteNowColors.warningAmber.opacity(0.78)
            ),
            (
                .postElection,
                postPhaseHeaderText,
                l("app.registration.phase.post.subtitle", "Track and protect your vote if follow-up is needed."),
                postSectionBackgroundColor,
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

    var body: some View {
        NavigationStack {
            GeometryReader { _ in
                ScrollViewReader { proxy in
                    ZStack(alignment: .top) {
                        overscrollBackground

                        ScrollView(.vertical) {
                            LazyVStack(spacing: 0) {
                                VStack(spacing: 0) {
                                    registrationGuidePanel(proxy: proxy)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 8)
                                }
                                .frame(maxWidth: .infinity)
                                .background(preSectionBackgroundColor)

                                ForEach(groupedSections) { section in
                                    sectionTimeline(section)
                                        .id(section.phase)
                                }
                            }
                            .padding(.top, stickyHeaderOffset)
                            .padding(.bottom, 24)
                        }
                        .scrollIndicators(.hidden)

                        VStack(alignment: .leading, spacing: 0) {
                            PageHeader(title: Text("app.page.voter_registration", tableName: "AppShell"))
                            Text(locationSubtitle)
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(VoteNowColors.mutedText)
                                .padding(.leading, 72)
                                .padding(.top, -6)
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 16)
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
                    .onAppear {
                        selectedGuidePhase = phaseForNow
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
                Button(l("app.registration.action.share_reminder", "Share Reminder")) {
                    shareRegistrationReminder()
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
                    .font(.subheadline.weight(.bold))
                    .foregroundColor(VoteNowColors.primaryCTA)
                Text(section.subtitle)
                    .font(.callout.weight(.semibold))
                    .foregroundColor(VoteNowColors.mutedText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(spacing: 10) {
                ForEach(section.cards) { card in
                    registrationCard(card)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(section.backgroundTint)
    }

    @ViewBuilder
    private func registrationCard(_ card: VoterRegistrationCard) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            registrationCardHeading(card)

            Text(card.summary)
                .font(.body)
                .foregroundColor(VoteNowColors.mutedText)
                .fixedSize(horizontal: false, vertical: true)

            if card.kind == .whyRegister {
                primaryBallotGuidancePanel
            }

            if card.kind == .deadline {
                deadlinePanel
                deadlineDoubleCheckPanel
            }

            if card.kind == .thenVote {
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
                                .font(.callout)
                                .foregroundColor(VoteNowColors.primaryText)
                                .fixedSize(horizontal: false, vertical: true)
                                .padding(.top, 2)
                        } else {
                            HStack(alignment: .top, spacing: 8) {
                                Text("•")
                                    .font(.callout.weight(.semibold))
                                    .foregroundColor(VoteNowColors.primaryCTA)
                                Text(bullet)
                                    .font(.callout)
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
                .font(.callout)
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
            }

            // Step 2 "Go to How to Vote" CTA is parked for a future release.
            // See: WeVote Information Page/_FutureFeatures/Step2GoToHowToVoteCTA.md
            if card.kind != .whyRegister && card.kind != .absenteeCure && card.kind != .deadline && card.kind != .thenVote {
                if card.kind == .check {
                    if card.id == "step-3-post-check" {
                        ballotStatusPrimaryButton(
                            card.primaryActionTitle,
                            isEnabled: isCheckBallotStatusWindowActive
                        ) {
                            handleCardAction(card.primaryAction)
                        }
                        Text(checkBallotStatusDisclaimerText)
                            .font(.caption)
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
                    .font(.subheadline.weight(.semibold))
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
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(VoteNowColors.primaryCTA)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }

            if card.kind != .deadline && card.kind != .absenteeCure,
               let secondaryTitle = card.secondaryActionTitle,
               let secondaryAction = card.secondaryAction {
                Button(secondaryTitle) {
                    handleCardAction(secondaryAction)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryCTA)
            }
        }
        .padding(card.kind == .absenteeCure ? 12 : 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(VoteNowColors.surfaceWhite)
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.12), lineWidth: 1)
        )
        .shadow(color: VoteNowColors.primaryText.opacity(0.05), radius: 5, x: 0, y: 2)
    }

    @ViewBuilder
    private func registrationCardHeading(_ card: VoterRegistrationCard) -> some View {
        if card.kind == .whyRegister {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    stepHeaderBlock(stepLabel: card.stepLabel, title: card.title)
                    Text(locationSubtitle)
                        .font(.caption.weight(.semibold))
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
                deadlineShareIconButton
            }
        } else {
            stepHeaderBlock(stepLabel: card.stepLabel, title: card.title)
        }
    }

    private func stepHeaderBlock(stepLabel: String, title: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            if !stepLabel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(stepLabel)
                    .font(.callout.weight(.bold))
                    .foregroundColor(VoteNowColors.primaryCTA)
            }
            Text(title)
                .font(.title3.weight(.bold))
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func checkRegistrationPrimaryButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Text(title)
                    .font(.headline.weight(.semibold))
                    .foregroundColor(.white)
                Spacer(minLength: 8)
                ZStack {
                    Circle()
                        .fill(.white)
                    Circle()
                        .stroke(.white.opacity(0.86), lineWidth: 1)
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
        .voteNowPillDualOrbit(
            redColor: VoteNowColors.ctaRed.opacity(0.94),
            blueColor: VoteNowColors.ctaBlue.opacity(0.88),
            strokeThickness: 2.8,
            loopDuration: 4.95,
            glowIntensity: 0.28,
            idleOpacity: 0.24,
            borderInset: 0.65,
            segmentLength: 0.34,
            separatorThickness: 0.75
        )
    }

    private func ballotStatusPrimaryButton(
        _ title: String,
        isEnabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .foregroundColor(isEnabled ? .white : VoteNowColors.mutedText)
                .background(isEnabled ? VoteNowColors.primaryCTA : VoteNowColors.borderWarm.opacity(0.55))
                .clipShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .opacity(isEnabled ? 1 : 0.86)
    }

    private func deadlineActionRow(
        primaryTitle: String,
        primaryAction: VoterRegistrationCard.Action
    ) -> some View {
        HStack(spacing: 10) {
            Button(primaryTitle) {
                handleCardAction(primaryAction)
            }
            .font(.subheadline.weight(.semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .foregroundColor(VoteNowColors.primaryCTA)
            .background(VoteNowColors.primaryCTA.opacity(0.10))
            .overlay(
                Capsule()
                    .stroke(VoteNowColors.primaryCTA.opacity(0.34), lineWidth: 1)
            )
            .clipShape(Capsule())

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
        .accessibilityLabel(l("app.registration.action.share_reminder", "Share Reminder"))
    }

    private var deadlinePanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                registrationStateFlag

                VStack(alignment: .leading, spacing: 6) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(registrationDeadlineLabel)
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(VoteNowColors.primaryText)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(formattedElectionDay(guideContent?.registrationDeadline))
                            .font(.headline.weight(.bold))
                            .foregroundColor(VoteNowColors.primaryText)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            if !methodSpecificDeadlineRows.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(methodSpecificDeadlineRows.enumerated()), id: \.offset) { _, item in
                        Text("\(item.label): \(item.value)")
                            .font(.footnote.weight(.semibold))
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
                .font(.subheadline.weight(.bold))
                .foregroundColor(VoteNowColors.primaryText)

            Text(
                l(
                    "app.registration.card.check.summary",
                    "Use your state’s official voter lookup to verify your registration details are active and accurate."
                )
            )
            .font(.callout)
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

    private var thenVoteTimelinePanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            thenVoteTimelineRow(
                icon: "🕒",
                title: l("app.guide.voting.early_vote.label", "Early Vote"),
                body: lf("app.guide.voting.early_vote.body", "Starts %@. Vote in person before Election Day.", nextUpcomingEarlyVotingValue)
            )

            if let votingStartsText = votingStartsCountdownText {
                Text(votingStartsText)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryCTA)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(VoteNowColors.primaryCTA.opacity(0.10))
                    .clipShape(Capsule())
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            thenVoteTimelineRow(
                icon: "✉️",
                title: l("app.guide.voting.by_mail.label", "Vote by Mail"),
                body: l("app.guide.voting.by_mail.body", "Request and return your mail ballot by your state's deadlines.")
            )

            Button {
                openMailInBallotRequest()
            } label: {
                Text(l("app.guide.voting.by_mail.cta.more_info", "More Information on Mail in/Absentee Ballots"))
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(VoteNowColors.primaryCTA)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)

            thenVoteTimelineRow(
                icon: "📬",
                title: l("app.guide.voting.election_day.label", "Election Day"),
                body: lf("app.guide.voting.election_day.body", "Vote in person on %@.", formattedElectionDay(nextUpcomingElectionDay))
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

    private func thenVoteTimelineRow(icon: String, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(icon)
                .font(.title3)
                .frame(width: 24, alignment: .center)

            (
                Text(title).bold()
                + Text(": \(body)")
            )
            .font(.callout)
            .foregroundColor(VoteNowColors.primaryText)
            .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)
        }
    }

    private var nextUpcomingEarlyVotingValue: String {
        let fallback = l("app.registration.date_tbd", "Date TBD")
        guard let election = nextUpcomingElection else { return fallback }

        let earlyVotingText = election.earlyVotingText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !earlyVotingText.isEmpty {
            return earlyVotingText
        }

        let calendar = Calendar.current
        if !calendar.isDate(election.startDate, inSameDayAs: election.electionDay) {
            return formattedElectionDay(election.startDate)
        }

        return fallback
    }

    private func openMailInBallotRequest() {
        showMailInBallotPage = true
    }

    private func openDeadlineActions() {
        showingDeadlineActions = true
    }

    private func pauseRegisterChipAnimationTemporarily() {
        isRegisterChipTemporarilyPaused = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.75) {
            if isRegisterChipVisible {
                isRegisterChipTemporarilyPaused = false
            }
        }
    }

    private func registrationGuidePanel(proxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(
                l(
                    "app.registration.guide.topline",
                    "You Can Vote through three easy steps!"
                )
            )
            .font(.subheadline.weight(.bold))
            .foregroundColor(VoteNowColors.primaryText)

            HStack(spacing: 10) {
                guideStepChip(
                    number: "1",
                    title: l("app.registration.guide.step.register", "Register"),
                    emoji: "📝",
                    tint: preSectionBackgroundColor,
                    phase: .preElection,
                    proxy: proxy
                )
                guideStepChip(
                    number: "2",
                    title: l("app.registration.guide.step.vote", "Vote"),
                    emoji: "🗳️",
                    tint: VoteNowColors.warningAmber.opacity(0.28),
                    phase: .duringElection,
                    proxy: proxy
                )
                guideStepChip(
                    number: "3",
                    title: l("app.registration.guide.step.check", "Check"),
                    emoji: "✅",
                    tint: postSectionBackgroundColor,
                    phase: .postElection,
                    proxy: proxy
                )
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(VoteNowColors.surfaceWhite)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.12), lineWidth: 1)
        )
    }

    private func guideStepChip(
        number: String,
        title: String,
        emoji: String,
        tint: Color,
        phase: VoterRegistrationCard.Phase,
        proxy: ScrollViewProxy
    ) -> some View {
        let isRegisterChip = phase == .preElection
        let shouldAnimateRegisterChip =
            isRegisterChip
            && phaseForNow == .preElection
            && isRegisterChipVisible
            && !isRegisterChipTemporarilyPaused

        return Button {
            if isRegisterChip {
                pauseRegisterChipAnimationTemporarily()
            }
            selectedGuidePhase = phase
            withAnimation(.interactiveSpring(response: 0.72, dampingFraction: 0.9, blendDuration: 0.2)) {
                proxy.scrollTo(phase, anchor: .top)
            }
        } label: {
            VStack(spacing: 4) {
                guideStepChipBody(
                    number: number,
                    title: title,
                    emoji: emoji,
                    tint: tint,
                    phase: phase,
                    shouldAnimateRegisterIcon: shouldAnimateRegisterChip
                )

                Text(phase == phaseForNow ? l("app.registration.guide.now", "NOW") : " ")
                    .font(.caption2.weight(.bold))
                    .foregroundColor(phase == phaseForNow ? VoteNowColors.primaryCTA : .clear)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(
                                phase == phaseForNow
                                ? VoteNowColors.primaryCTA.opacity(0.12)
                                : Color.clear
                            )
                    )
            }
        }
        .buttonStyle(.plain)
        .onAppear {
            if isRegisterChip {
                isRegisterChipVisible = true
                isRegisterChipTemporarilyPaused = false
            }
        }
        .onDisappear {
            if isRegisterChip {
                isRegisterChipVisible = false
            }
        }
    }

    private func guideStepChipBody(
        number: String,
        title: String,
        emoji: String,
        tint: Color,
        phase: VoterRegistrationCard.Phase,
        shouldAnimateRegisterIcon: Bool
    ) -> some View {
        VStack(spacing: 6) {
            guideStepIcon(
                emoji: emoji,
                tint: tint,
                shouldAnimate: shouldAnimateRegisterIcon
            )

            Text("\(number). \(title)")
                .font(.caption.weight(.bold))
                .foregroundColor(VoteNowColors.primaryText)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.88)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity)
        .frame(minHeight: 66)
    }

    private func guideStepIcon(
        emoji: String,
        tint: Color,
        shouldAnimate: Bool
    ) -> some View {
        let iconInnerInset: CGFloat = shouldAnimate ? 3 : 0
        let iconCircle = ZStack {
            Circle()
                .fill(tint.opacity(0.95))
                .padding(iconInnerInset)
            Text(emoji)
                .font(.system(size: 20))
        }
        .frame(width: 34, height: 34)
        .overlay(
            Circle()
                .stroke(VoteNowColors.primaryCTA.opacity(0.16), lineWidth: 1)
                .padding(iconInnerInset)
        )

        let iconWithCallout: AnyView
        if shouldAnimate {
            iconWithCallout = AnyView(
                iconCircle.voteNowPillDualOrbit(
                    redColor: VoteNowColors.ctaRed.opacity(0.92),
                    blueColor: VoteNowColors.ctaBlue.opacity(0.92),
                    strokeThickness: 2.9,
                    loopDuration: 8.1,
                    glowIntensity: 0.22,
                    idleOpacity: 0.0,
                    borderInset: 0.0,
                    segmentLength: 0.82,
                    separatorThickness: 0.0,
                    sliceFadeFactor: 0.95,
                    speedVariance: 0.0
                )
            )
        } else {
            iconWithCallout = AnyView(iconCircle)
        }

        return iconWithCallout
            .frame(width: 50, height: 34)
    }

    private var preSectionBackgroundColor: Color {
        VoteNowColors.brandSoftBlue.opacity(0.58)
    }

    private var stickyHeaderOffset: CGFloat {
        max(stickyHeaderMinHeight, measuredStickyHeaderHeight + 4)
    }

    private var postSectionBackgroundColor: Color {
        VoteNowColors.infoSurfaceRed.opacity(0.40)
    }

    private var overscrollBackground: some View {
        ZStack {
            VoteNowColors.appBackground

            VStack(spacing: 0) {
                preSectionBackgroundColor
                    .frame(height: 160)
                Spacer(minLength: 0)
                postSectionBackgroundColor
                    .frame(height: 160)
            }
        }
        .ignoresSafeArea()
    }

    private var votingStartsCountdownText: String? {
        let target = nextUpcomingEarlyVotingDate ?? nextUpcomingElection?.startDate
        return votingStartsText(to: target)
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

    private func votingStartsText(to date: Date?) -> String? {
        guard let date else { return nil }

        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let start = calendar.startOfDay(for: date)
        let delta = calendar.dateComponents([.day], from: today, to: start).day ?? 0

        if delta > 1 { return "Voting starts in \(delta) days" }
        if delta == 1 { return "Voting starts in 1 day" }
        if delta == 0 { return "Voting starts today" }
        return "Voting has started"
    }

    @ViewBuilder
    private var registrationStateFlag: some View {
        if let asset = StateFlagCatalog.assetName(for: registrationStateCode),
           UIImage(named: asset) != nil {
            Image(asset)
                .resizable()
                .scaledToFill()
                .frame(width: 41, height: 29)
                .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                )
                .opensMyInfoPanelOnLongPress()
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(VoteNowColors.infoSurfaceBlue)
                Text(registrationStateCode ?? "US")
                    .font(.caption2.weight(.bold))
                    .foregroundColor(VoteNowColors.primaryCTA)
            }
            .frame(width: 41, height: 29)
        }
    }

    private var registrationStateCode: String? {
        if let code = guideContext?.stateCode.trimmingCharacters(in: .whitespacesAndNewlines),
           code.count == 2 {
            return code.uppercased()
        }
        let entered = planVM.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines)
        if entered.count == 2 {
            return entered.uppercased()
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
            .font(.callout)
            .foregroundColor(VoteNowColors.primaryText)
            .fixedSize(horizontal: false, vertical: true)
            .opensMyInfoPanelOnLongPress()

            if isClosedPrimaryState {
                (
                    Text(l("app.guide.card.party_affiliation.example_label", "Example: ")).bold()
                    + Text(
                        lf(
                            "app.registration.closed_primary.example.prefix",
                            "%@ holds a closed primary, whereby a voter registered as ",
                            closedPrimaryStateCodeLabel
                        )
                    )
                    + Text(l("app.registration.party.independent", "Independent")).fontWeight(.semibold)
                    + Text(l("app.registration.closed_primary.example.middle", " may not be able to vote in either the "))
                    + Text(l("app.guide.party.democrat", "Democratic"))
                        .foregroundColor(VoteNowColors.richBlue)
                        .fontWeight(.semibold)
                    + Text(l("app.registration.closed_primary.example.and", " or "))
                    + Text(l("app.guide.party.republican", "Republican"))
                        .foregroundColor(VoteNowColors.richRed)
                        .fontWeight(.semibold)
                    + Text(l("app.registration.closed_primary.example.suffix", " primary unless they change party registration before the state deadline."))
                )
                .font(.callout)
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
            }

            (
                Text(l("app.registration.current_setting.prefix", "Your current setting: "))
                + Text(currentPartyLabel).foregroundColor(currentPartyColor).fontWeight(.semibold)
            )
            .font(.callout)
            .foregroundColor(VoteNowColors.primaryText)
            .opensMyInfoPanelOnLongPress(
                when: planVM.selectedParty == .democrat || planVM.selectedParty == .republican
            )
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
        VStack(alignment: .leading, spacing: 8) {
            Text(l("app.registration.provisional.request.title", "How to request a provisional ballot"))
                .font(.subheadline.weight(.semibold))
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
                        "3. Ask for a receipt or tracking method and confirm any cure deadline before leaving."
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
            .font(.callout)
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
            openURL(howToVoteDeepLink)
        case .shareReminder:
            shareRegistrationReminder()
        }
    }

    private func shareRegistrationReminder() {
        let stateLabel = registrationStateCode ?? l("app.timeline.statewide", "Statewide")
        let deadline = guideContent?.registrationDeadline.map { Self.isoDateFormatter.string(from: $0) }
        let badge = "\(stateLabel) · \(formattedElectionDay(guideContent?.registrationDeadline))"
        var details: [URLQueryItem] = [
            URLQueryItem(name: "state", value: registrationStateCode),
            URLQueryItem(name: "mode", value: "check_update_register")
        ]
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
}

private struct RegistrationPrimaryFeature: Decodable {
    let primaryCategory: String
}

private struct RegistrationPrimaryTypeDataset: Decodable {
    let state_summary: [RegistrationPrimaryTypeStateSummary]
}

private struct RegistrationPrimaryTypeStateSummary: Decodable {
    let state_abbr: String
    let state_primary_type_2026: String
    let presidential_primary_type_2026: String
}

struct VoterRegistrationView_Previews: PreviewProvider {
    static var previews: some View {
        VoterRegistrationView()
            .environmentObject(PlanViewModel())
    }
}
