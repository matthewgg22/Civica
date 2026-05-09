//
//  MobilizationView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/1/25.
//

import SwiftUI
import UIKit
import OSLog

struct MobilizationView: View {
    @EnvironmentObject var planVM: PlanViewModel
    @EnvironmentObject var mapvPlanStore: MAPVPlanStore
    @Environment(\.locale) private var locale
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selectedPlace: PollingPlace?
    @State private var showPlanSheet = false
    @State private var shareItems: [Any] = []
    @State private var showingShare = false
    @State private var showMailInBallotRequest = false
    @StateObject private var waterfallController = EmojiWaterfallController()
    @State private var planCardOffset: CGFloat = 0
    @State private var planCardShadowBoost = false
    @State private var lastRenderedPlanID: UUID?
    private let stateResolver = USZipStateResolver()

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }

    private var nextUpcomingElection: Election? {
        guard let code = resolvedStateCode() else { return nil }
        let today = Calendar.current.startOfDay(for: Date())
        return loadElectionsFromBundle(for: code)
            .filter { Calendar.current.startOfDay(for: $0.electionDay) >= today }
            .sorted {
                if $0.electionDay != $1.electionDay { return $0.electionDay < $1.electionDay }
                return displayElectionTitle(for: $0) < displayElectionTitle(for: $1)
            }
            .first
    }

    private var electionSubtitleText: String {
        guard let election = nextUpcomingElection else {
            return l("app.how_to_vote.subtitle.none", "No upcoming election loaded")
        }
        return displayElectionTitle(for: election)
    }

    private func displayElectionTitle(for election: Election) -> String {
        let state = election.jurisdictionName
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

        if !base.isEmpty { return base }
        if !phase.isEmpty { return phase }
        return election.name
    }

    private func resolvedStateCode() -> String? {
        let directZip = String(planVM.zip.filter(\.isNumber).prefix(5))
        if directZip.count == 5, let code = stateResolver.stateCode(for: directZip) {
            return code
        }

        let addressZip = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
        if addressZip.count == 5, let code = stateResolver.stateCode(for: addressZip) {
            return code
        }

        let rawState = planVM.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !rawState.isEmpty else { return nil }
        if rawState.count == 2 { return rawState.uppercased() }
        return Self.stateCodeByName[rawState.lowercased()]
    }

    private func loadElectionsFromBundle(for stateCode: String) -> [Election] {
        guard let url = Bundle.main.url(forResource: "USMidterm2026ElectionDates", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let records = try? JSONDecoder().decode([TimelineStateRecord].self, from: data),
              let record = records.first(where: { $0.state_code == stateCode }) else {
            return []
        }

        let stateName = record.state_name
        let midtermName = "\(stateName) 2026 Midterm"
        let presidentialName = "\(stateName) 2028 Presidential"
        var built: [Election] = []

        func appendElection(
            electionName: String,
            subtitle: String,
            electionDateISO: String?,
            registrationISO: String?,
            earlyVotingISO: String?
        ) {
            guard let electionDate = Self.isoDate(from: electionDateISO) else { return }
            let registrationDate = Self.isoDate(from: registrationISO) ?? electionDate
            let earlyVotingDate = Self.isoDate(from: earlyVotingISO)

            built.append(
                Election(
                    name: electionName,
                    subtitle: subtitle,
                    registrationDeadline: registrationDate,
                    startDate: earlyVotingDate ?? electionDate,
                    electionDay: electionDate,
                    earlyVotingText: nil,
                    registrationNotes: record.registration_notes,
                    jurisdictionLevel: "statewide",
                    jurisdictionName: stateName,
                    visibility: "public",
                    flags: [],
                    matchConfidence: nil,
                    sourceUrl: record.primary_source
                )
            )
        }

        appendElection(
            electionName: midtermName,
            subtitle: "Primary Election",
            electionDateISO: record.primary_date,
            registrationISO: record.registration_deadline_primary,
            earlyVotingISO: record.early_voting_primary
        )

        appendElection(
            electionName: midtermName,
            subtitle: "Primary Runoff Election",
            electionDateISO: record.primary_runoff_date,
            registrationISO: record.registration_deadline_primary,
            earlyVotingISO: record.early_voting_primary_runoff ?? record.early_voting_primary
        )

        appendElection(
            electionName: midtermName,
            subtitle: "General Election",
            electionDateISO: record.general_election_date,
            registrationISO: record.registration_deadline_general,
            earlyVotingISO: record.early_voting_general
        )

        appendElection(
            electionName: presidentialName,
            subtitle: "Presidential Primary Election",
            electionDateISO: Self.shiftedISOYear(from: record.primary_date, toYear: 2028) ?? "2028-03-07",
            registrationISO: "2028-03-01",
            earlyVotingISO: nil
        )

        appendElection(
            electionName: presidentialName,
            subtitle: "Presidential General Election",
            electionDateISO: "2028-11-07",
            registrationISO: "2028-10-30",
            earlyVotingISO: nil
        )

        return built
    }

    private var visibleSectionTypes: [SectionType] {
        SectionType.allCases.filter { section in
            !section.requiresNYC2025Archive || shouldShowNYC2025ArchiveResources
        }
    }

    private var shouldShowNYC2025ArchiveResources: Bool {
        guard isNYCJurisdiction else { return false }
        let years = Set(planVM.upcomingElections.map { Calendar.current.component(.year, from: $0.electionDay) })
        if years.isEmpty { return true }
        return years.contains(2025)
    }

    private var isNYCJurisdiction: Bool {
        guard let stateCode = resolvedStateCode(), stateCode == "NY" else { return false }
        let city = planVM.userAddress.city.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if city.contains("new york") { return true }
        let zip = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
        let prefix = String(zip.prefix(3))
        return ["100", "101", "102", "103", "104", "111", "112", "113", "114", "116"].contains(prefix)
    }

    var body: some View {
        ZStack {
            CivicaColors.canvasBackground.ignoresSafeArea()

            NavigationStack {
                ScrollView {
                    VStack(spacing: 20) {
                        VStack(alignment: .leading, spacing: 0) {
                            PageHeader(title: Text("app.page.how_to_vote", tableName: "AppShell"))
                            Text(electionSubtitleText)
                                .font(CivicaTypography.subheadStrong)
                                .foregroundColor(CivicaColors.textSecondary)
                                .padding(.leading, 72)
                                .padding(.top, -6)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)

                        if planVM.plan.voteTime != nil {
                            VStack(spacing: 10) {
                                PlanCardView(waterfallController: waterfallController)
                                    .padding(.horizontal)
                                    .offset(x: planCardOffset)
                                    .shadow(
                                        color: .black.opacity(planCardShadowBoost ? 0.18 : 0.08),
                                        radius: planCardShadowBoost ? 14 : 6,
                                        x: 0,
                                        y: planCardShadowBoost ? 8 : 3
                                    )

                                if CivicaLaunchFeatures.shareActionsEnabled {
                                    Button {
                                        shareMapvCard()
                                    } label: {
                                        Label(l("app.how_to_vote.action.share_plan", "Share My Plan"), systemImage: "square.and.arrow.up")
                                            .font(CivicaTypography.subheadStrong)
                                            .lineLimit(1)
                                            .minimumScaleFactor(0.7)
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 11)
                                    }
                                    .buttonStyle(MAPVUtilityButtonStyle(
                                        fill: CivicaColors.ctaBlue,
                                        foreground: .white,
                                        border: CivicaColors.ctaBlue.opacity(0.85)
                                    ))
                                    .padding(.horizontal)
                                }
                            }
                        } else {
                            Button(l("app.how_to_vote.action.make_plan", "Make a Plan to Vote")) {
                                showPlanSheet = true
                            }
                            .font(CivicaTypography.sectionHeader)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, CivicaSpacing.md)
                            .padding(.horizontal, CivicaSpacing.lg)
                            .background(CivicaColors.ctaBlue)
                            .foregroundColor(.white)
                            .clipShape(Capsule(style: .continuous))
                            .voteNowPillDualOrbit(
                                redColor: CivicaColors.ctaRed.opacity(0.86),
                                blueColor: CivicaColors.ctaRed.opacity(0.58),
                                strokeThickness: 3.0,
                                loopDuration: 4.95,
                                glowIntensity: 0.30,
                                idleOpacity: 0.26,
                                borderInset: 0.0,
                                segmentLength: 0.34,
                                separatorThickness: 0.75
                            )
                            .padding(.horizontal)
                        }

                        Divider()

                        VStack(spacing: 0) {
                            ForEach(visibleSectionTypes, id: \.self) { section in
                                NavigationLink(destination: section.destination(selectedPlace: $selectedPlace)) {
                                    HStack(spacing: 10) {
                                        if section == .supportAmericansVote {
                                            CivicaLogoIcon(size: 28)
                                                .frame(width: 30, height: 30, alignment: .center)
                                                .fixedSize(horizontal: true, vertical: true)
                                        } else if section == .feedback {
                                            Image(systemName: "bubble.left.and.bubble.right.fill")
                                                .foregroundColor(CivicaColors.ctaBlue)
                                                .frame(width: 30, alignment: .center)
                                        }
                                        Text(section.localizedTitle(locale: locale))
                                            .foregroundColor(CivicaColors.textPrimary)
                                            .lineLimit(1)
                                            .minimumScaleFactor(0.9)
                                        Spacer()
                                    }
                                }
                                .padding()
                                Divider()
                            }
                        }
                        .background(CivicaColors.canvasBackground)
                        .cornerRadius(CivicaRadius.sm)
                        .padding(.horizontal)
                    }
                    .padding(.vertical)
                }
                .background(CivicaColors.canvasBackground)
                .navigationBarTitleDisplayMode(.inline)
                .navigationDestination(isPresented: $showMailInBallotRequest) {
                    MailInBallotView()
                }
            }

            EmojiWaterfallView(controller: waterfallController)
                .ignoresSafeArea()
                .zIndex(999)
                .allowsHitTesting(false)
        }
        .sheet(isPresented: $showPlanSheet) {
            MultiStepFormView()
                .environmentObject(planVM)
        }
        .sheet(item: $selectedPlace) { place in
            PollingPlaceDetailView(place: place)
        }
        .sheet(isPresented: $showingShare, onDismiss: {
            shareItems.removeAll()
        }) {
            if !shareItems.isEmpty {
                ShareSheet(items: shareItems)
            }
        }
        .onAppear {
            synchronizePlanElectionHeaderIfNeeded()
            deferToNextRunLoop {
                lastRenderedPlanID = mapvPlanStore.plan?.id
            }
        }
        .onChange(of: planVM.zip) { _, _ in
            synchronizePlanElectionHeaderIfNeeded()
        }
        .onChange(of: planVM.userAddress.state) { _, _ in
            synchronizePlanElectionHeaderIfNeeded()
        }
        .onChange(of: planVM.userAddress.zip) { _, _ in
            synchronizePlanElectionHeaderIfNeeded()
        }
        .onChange(of: mapvPlanStore.plan?.id) { _, newID in
            guard let newID else { return }
            guard newID != lastRenderedPlanID else { return }
            deferToNextRunLoop {
                synchronizePlanElectionHeaderIfNeeded()
                lastRenderedPlanID = newID
                runPlanCardAssemblyAnimation()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .openMailInBallotRequest)) { _ in
            deferToNextRunLoop {
                showMailInBallotRequest = true
            }
        }
    }

    private func runPlanCardAssemblyAnimation() {
        planCardOffset = -UIScreen.main.bounds.width * 0.95
        planCardShadowBoost = true

        if reduceMotion {
            withAnimation(.easeOut(duration: 0.14)) {
                planCardOffset = 0
                planCardShadowBoost = false
            }
            return
        }

        withAnimation(.easeInOut(duration: 0.46)) {
            planCardOffset = 14
        }
        withAnimation(.spring(response: 0.42, dampingFraction: 0.84).delay(0.46)) {
            planCardOffset = 0
            planCardShadowBoost = false
        }
    }

    private func synchronizePlanElectionHeaderIfNeeded() {
        guard var currentPlan = mapvPlanStore.plan else { return }
        let resolved = mapvPlanStore.resolvedElectionForMAPV(
            planVM: planVM,
            chosenVotingTime: currentPlan.plannedArrival
        )
        let normalizedArrival = mapvPlanStore.normalizePlannedArrivalForMAPV(
            chosenVotingTime: currentPlan.plannedArrival,
            electionDate: resolved.date
        )
        let normalizedOpen = mapvPlanStore.normalizePlannedArrivalForMAPV(
            chosenVotingTime: currentPlan.pollingOpen,
            electionDate: resolved.date
        )
        let normalizedClose = mapvPlanStore.normalizePlannedArrivalForMAPV(
            chosenVotingTime: currentPlan.pollingClose,
            electionDate: resolved.date
        )

        guard currentPlan.electionTitle != resolved.title ||
              currentPlan.electionDate != resolved.date ||
              currentPlan.plannedArrival != normalizedArrival ||
              currentPlan.pollingOpen != normalizedOpen ||
              currentPlan.pollingClose != normalizedClose else { return }
        currentPlan.electionTitle = resolved.title
        currentPlan.electionDate = resolved.date
        currentPlan.plannedArrival = normalizedArrival
        currentPlan.pollingOpen = normalizedOpen
        currentPlan.pollingClose = normalizedClose
        mapvPlanStore.save(currentPlan, shouldSyncLiveActivity: true, shouldSyncSupabase: false)
    }

    private func shareMapvCard() {
        let mappedPlan = mapvPlanStore.plan
        let electionDate = mappedPlan?.electionDate ?? nextUpcomingElection?.electionDay
        let badgeDate = electionDate.map { Self.dateFormatter.string(from: $0) } ?? l("app.registration.date_tbd", "Date TBD")
        let stateCode = resolvedStateCode()
        let badgeState = stateCode ?? l("app.timeline.statewide", "Statewide")
        let methodLabel = shareMethodLabel()

        var details: [URLQueryItem] = [
            URLQueryItem(name: "method", value: methodLabel),
            URLQueryItem(name: "state", value: stateCode)
        ]
        if let electionDate {
            details.append(URLQueryItem(name: "day", value: Self.isoFormatter.string(from: electionDate)))
        }
        if let electionTitle = mappedPlan?.electionTitle ?? nextUpcomingElection?.name,
           !electionTitle.isEmpty {
            details.append(URLQueryItem(name: "election", value: electionTitle))
        }

        let payload = CivicaShareCardPayload(
            cardType: .mapv,
            target: .mapv,
            title: l("app.mapv.share.headline.plan_now", "Make Your Plan to Vote"),
            subtitle: l(
                "app.mapv.share.subtitle.plan_now",
                "Pick your voting method, review deadlines, and get ready now."
            ),
            cta: l("app.mapv.share.cta.plan_now", "Make a Voting Plan"),
            badge: "\(badgeState) · \(badgeDate)",
            campaign: "send-to-friend",
            details: details
        )

        shareItems = CivicaShareComposer.activityItems(for: payload)
        showingShare = true
    }

    private func shareMethodLabel() -> String {
        if let method = mapvPlanStore.plan?.votingMethodRawValue {
            switch method {
            case "vote_by_mail":
                return "Mail ballot"
            case "early_vote":
                return "Early vote"
            case "election_day":
                return "Election Day"
            default:
                break
            }
        }
        if let method = planVM.plan.method?.trimmingCharacters(in: .whitespacesAndNewlines),
           !method.isEmpty {
            return method
        }
        return "Plan to vote"
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

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

    private static let isoFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static func isoDate(from iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        return isoFormatter.date(from: iso)
    }

    private static func shiftedISOYear(from sourceISO: String?, toYear: Int) -> String? {
        guard let sourceDate = isoDate(from: sourceISO) else { return nil }
        let calendar = Calendar(identifier: .gregorian)
        var components = calendar.dateComponents(in: TimeZone(secondsFromGMT: 0) ?? .current, from: sourceDate)
        components.year = toYear
        guard let shiftedDate = calendar.date(from: components) else { return nil }
        return isoFormatter.string(from: shiftedDate)
    }

    private func deferToNextRunLoop(_ action: @escaping () -> Void) {
        DispatchQueue.main.async(execute: action)
    }
}

private struct TimelineStateRecord: Decodable {
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

enum SectionType: CaseIterable {
    case raceCandidates, pollingLocations, sampleBallot, mailInBallot, electionHotlines, feedback, supportAmericansVote

    var title: String {
        switch self {
        case .raceCandidates:   return "Candidates in this race (NYC 2025 archive)"
        case .pollingLocations: return "Polling locations (NYC 2025 archive)"
        case .sampleBallot:     return "Example ballot (NYC 2025 archive)"
        case .mailInBallot:     return "Request Mail-in Ballot"
        case .electionHotlines: return "Election Hotlines"
        case .feedback:         return "Feedback"
        case .supportAmericansVote: return "Support Americans Vote!"
        }
    }

    func localizedTitle(locale: Locale) -> String {
        switch self {
        case .raceCandidates:
            return localizedCatalogString(
                "app.how_to_vote.section.race_candidates.archive",
                tableName: "AppShell",
                locale: locale,
                fallback: title
            )
        case .pollingLocations:
            return localizedCatalogString(
                "app.how_to_vote.section.polling_locations.archive",
                tableName: "AppShell",
                locale: locale,
                fallback: title
            )
        case .sampleBallot:
            return localizedCatalogString(
                "app.how_to_vote.section.sample_ballot.archive",
                tableName: "AppShell",
                locale: locale,
                fallback: title
            )
        case .mailInBallot:
            return localizedCatalogString(
                "app.how_to_vote.section.mail_in_ballot",
                tableName: "AppShell",
                locale: locale,
                fallback: title
            )
        case .electionHotlines:
            return localizedCatalogString(
                "app.how_to_vote.section.hotlines",
                tableName: "AppShell",
                locale: locale,
                fallback: title
            )
        case .feedback:
            return localizedCatalogString(
                "app.how_to_vote.section.feedback",
                tableName: "AppShell",
                locale: locale,
                fallback: title
            )
        case .supportAmericansVote:
            return localizedCatalogString(
                "app.how_to_vote.section.support",
                tableName: "AppShell",
                locale: locale,
                fallback: title
            )
        }
    }

    var requiresNYC2025Archive: Bool {
        switch self {
        case .raceCandidates, .pollingLocations, .sampleBallot:
            return true
        default:
            return false
        }
    }

    @ViewBuilder
    func destination(selectedPlace: Binding<PollingPlace?>) -> some View {
        switch self {
        case .raceCandidates:
            RaceCandidatesView(showArchiveDisclaimer: true)
        case .pollingLocations:
            PollingLocationsView(selectedPlace: selectedPlace, showArchiveDisclaimer: true)
        case .sampleBallot:
            SampleBallotView(showArchiveDisclaimer: true)
        case .mailInBallot:
            MailInBallotView()
        case .electionHotlines:
            ElectionHotlinesView()
        case .feedback:
            FeedbackView()
        case .supportAmericansVote:
            SupportVoteView()
        }
    }
}

struct FeedbackView: View {
    @Environment(\.locale) private var locale
    @Environment(\.dismiss) private var dismiss
    private let logger = Logger(subsystem: "Civica", category: "FeedbackView")

    private enum FeedbackCategory: String, CaseIterable, Identifiable {
        case idea
        case bug
        case question

        var id: String { rawValue }

        var title: String {
            switch self {
            case .idea: return "app.feedback.category.idea"
            case .bug: return "app.feedback.category.bug"
            case .question: return "app.feedback.category.question"
            }
        }
    }

    @State private var feedbackText: String
    @State private var email: String = ""
    @State private var selectedCategory: FeedbackCategory
    @State private var isSending = false
    @State private var isShowingSubmissionConfirmation = false
    @State private var errorMessage: String?
    @FocusState private var isFeedbackFocused: Bool

    init(preselectedCategoryRawValue: String? = nil, prefilledMessage: String? = nil) {
        let initialCategory = FeedbackCategory(rawValue: preselectedCategoryRawValue ?? "") ?? .idea
        _selectedCategory = State(initialValue: initialCategory)
        _feedbackText = State(initialValue: prefilledMessage ?? "")
    }

    private var trimmedMessage: String {
        feedbackText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var boundedMessage: String {
        String(trimmedMessage.prefix(2000))
    }

    private var normalizedEmail: String? {
        let value = email.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }

    private var canSend: Bool {
        !boundedMessage.isEmpty && !isSending
    }

    private var appVersion: String? {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    }

    private var buildNumber: String? {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                PageHeader(title: Text(l("app.feedback.title", "Feedback")))

                VStack(alignment: .leading, spacing: 10) {
                    Text(l("app.feedback.college_endeavor.title", "We Want to Hear From You!"))
                        .font(CivicaTypography.cardTitle)

                    Text(l("app.feedback.college_endeavor.body", "Civica is an endeavor built to support all Americans vote by reducing logistical friction. As a college student endeavor, we want to learn from you and your experience voting. Your feedback is invaluable to improve the app and the voter experience."))
                        .font(.body)
                        .foregroundColor(CivicaColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(CivicaColors.infoSurfaceBlue)
                )

                VStack(alignment: .leading, spacing: 10) {
                    Text(l("app.feedback.share.title", "Share your feedback"))
                        .font(CivicaTypography.sectionHeader)

                    Picker(l("app.feedback.category.label", "Category"), selection: $selectedCategory) {
                        ForEach(FeedbackCategory.allCases) { item in
                            Text(l(item.title, fallbackCategoryTitle(for: item))).tag(item)
                        }
                    }
                    .pickerStyle(.segmented)

                    TextField(l("app.feedback.email.placeholder", "Email (optional)"), text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled(true)
                        .padding(.horizontal, CivicaSpacing.md)
                        .padding(.vertical, 10)
                        .background(CivicaColors.surfacePrimary)
                        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                        )

                    ZStack(alignment: .topLeading) {
                        RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                            .fill(CivicaColors.surfacePrimary)
                            .frame(minHeight: 170)
                            .overlay(
                                RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                                    .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                            )

                        if feedbackText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            Text(l("app.feedback.message.placeholder", "Tell us what felt confusing, frustrating, or helpful."))
                                .font(CivicaTypography.subhead)
                                .foregroundColor(CivicaColors.textSecondary)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 14)
                                .allowsHitTesting(false)
                        }

                        TextEditor(text: $feedbackText)
                            .font(.body)
                            .scrollContentBackground(.hidden)
                            .padding(.horizontal, 10)
                            .padding(.vertical, CivicaSpacing.sm)
                            .frame(minHeight: 170)
                            .focused($isFeedbackFocused)
                    }

                    Button {
                        Task {
                            await sendFeedback()
                        }
                    } label: {
                        Group {
                            if isSending {
                                HStack(spacing: CivicaSpacing.sm) {
                                    ProgressView()
                                        .tint(.white)
                                    Text(l("app.feedback.action.sending", "Sending..."))
                                        .font(CivicaTypography.sectionHeader)
                                }
                            } else {
                                Text(l("app.feedback.action.send", "Send Feedback"))
                                    .font(CivicaTypography.sectionHeader)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, CivicaSpacing.md)
                        .background(canSend ? CivicaColors.ctaBlue : CivicaColors.borderSubtle.opacity(0.6))
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(!canSend)

                    if let errorMessage {
                        Text(errorMessage)
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundColor(.red)
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(CivicaColors.canvasBackground)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                )
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: $isShowingSubmissionConfirmation) {
            FeedbackSubmissionConfirmationView(locale: locale) {
                completeSubmissionFlow()
            }
        }
        .background(CivicaColors.canvasBackground)
        .onChange(of: feedbackText) { _, _ in
            if errorMessage != nil { errorMessage = nil }
        }
        .onChange(of: email) { _, _ in
            if errorMessage != nil { errorMessage = nil }
        }
    }

    private func sendFeedback() async {
        guard canSend else { return }
        isSending = true
        errorMessage = nil

        let userID = await SupabaseManager.shared.currentUserIDIfAvailable()
        let payload = FeedbackInsert(
            userID: userID,
            email: normalizedEmail,
            message: boundedMessage,
            category: selectedCategory.rawValue,
            rating: nil,
            appVersion: appVersion,
            buildNumber: buildNumber,
            platform: "iOS",
            deviceModel: nil,
            osVersion: nil,
            locale: Locale.current.identifier
        )

        do {
            try await SupabaseManager.shared.submitFeedback(payload)
            feedbackText = ""
            email = ""
            selectedCategory = .idea
            isFeedbackFocused = false
            isShowingSubmissionConfirmation = true
        } catch {
            #if DEBUG
            logger.error("Feedback submit failed.")
            #endif
            errorMessage = l("app.feedback.error.send_failed", "Could not send feedback. Please try again.")
        }

        isSending = false
    }

    private func fallbackCategoryTitle(for category: FeedbackCategory) -> String {
        switch category {
        case .idea: return "Idea"
        case .bug: return "Bug"
        case .question: return "Question"
        }
    }

    private func completeSubmissionFlow() {
        guard isShowingSubmissionConfirmation else { return }
        isShowingSubmissionConfirmation = false
        DispatchQueue.main.async {
            dismiss()
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
}

private struct FeedbackSubmissionConfirmationView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let locale: Locale
    let onContinue: () -> Void
    @State private var hasTriggeredAutoReturn = false

    var body: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 16)

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 68, weight: .semibold))
                .foregroundColor(CivicaColors.successGreen)

            Text(l("app.feedback.success.screen.title", "Feedback Sent"))
                .font(.title2.weight(.bold))
                .multilineTextAlignment(.center)

            Text(l("app.feedback.success.screen.body", "Thank you for sharing your experience. Returning you now."))
                .font(.body)
                .foregroundColor(CivicaColors.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            Button(l("app.feedback.success.screen.action", "Return")) {
                onContinue()
            }
            .font(CivicaTypography.sectionHeader)
            .frame(maxWidth: .infinity)
            .padding(.vertical, CivicaSpacing.md)
            .background(CivicaColors.ctaBlue)
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
            .buttonStyle(.plain)
            .padding(.top, 6)

            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, CivicaSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(CivicaColors.canvasBackground)
        .navigationBarBackButtonHidden(true)
        .task {
            guard !hasTriggeredAutoReturn else { return }
            hasTriggeredAutoReturn = true
            try? await Task.sleep(nanoseconds: reduceMotion ? 650_000_000 : 1_350_000_000)
            onContinue()
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
}

struct MobilizationView_Previews: PreviewProvider {
    static var previews: some View {
        MobilizationView()
            .environmentObject(PlanViewModel())
            .environmentObject(MAPVPlanStore.shared)
    }
}

private struct MAPVUtilityButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    let fill: Color
    let foreground: Color
    let border: Color

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(foreground.opacity(isEnabled ? 1 : 0.6))
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .fill(fill.opacity(isEnabled ? (configuration.isPressed ? 0.86 : 1.0) : 0.55))
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .stroke(border.opacity(isEnabled ? 1 : 0.5), lineWidth: 1)
            )
    }
}
