//
//  MobilizationView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/1/25.
//

import SwiftUI
import UIKit

struct MobilizationView: View {
    @EnvironmentObject var planVM: PlanViewModel
    @EnvironmentObject var mapvPlanStore: MAPVPlanStore
    @Environment(\.openURL) private var openURL
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selectedPlace: PollingPlace?
    @State private var showPlanSheet = false
    @State private var shareImage: UIImage?
    @State private var showingShare = false
    @StateObject private var waterfallController = EmojiWaterfallController()
    @State private var planCardOffset: CGFloat = 0
    @State private var planCardShadowBoost = false
    @State private var lastRenderedPlanID: UUID?
    private let stateResolver = USZipStateResolver()

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
        guard let election = nextUpcomingElection else { return "No upcoming election loaded" }
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

    var body: some View {
        ZStack {
            VoteNowColors.appBackground.ignoresSafeArea()

            NavigationStack {
                ScrollView {
                    VStack(spacing: 20) {
                        VStack(alignment: .leading, spacing: 0) {
                            PageHeader(title: "How to Vote")
                            Text(electionSubtitleText)
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(VoteNowColors.mutedText)
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

                                HStack(spacing: 10) {
                                    if let payload = calendarPayload {
                                        AddToCalendarButtonView(payload: payload)
                                    }

                                    if let directionsURL {
                                        Button {
                                            openURL(directionsURL)
                                        } label: {
                                            Label("Navigation", systemImage: "location.fill")
                                                .font(.subheadline.weight(.semibold))
                                                .lineLimit(1)
                                                .minimumScaleFactor(0.7)
                                                .frame(maxWidth: .infinity)
                                                .padding(.vertical, 11)
                                        }
                                        .buttonStyle(.plain)
                                        .background(VoteNowColors.infoSurfaceBlue)
                                        .foregroundColor(VoteNowColors.primaryText)
                                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    }

                                    Button {
                                        shareMapvCard()
                                    } label: {
                                        Label("Share My Plan", systemImage: "square.and.arrow.up")
                                            .font(.subheadline.weight(.semibold))
                                            .lineLimit(1)
                                            .minimumScaleFactor(0.7)
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 11)
                                    }
                                    .buttonStyle(.plain)
                                    .background(VoteNowColors.infoSurfaceBlue)
                                    .foregroundColor(VoteNowColors.primaryText)
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                }
                                .padding(.horizontal)
                            }
                        } else {
                            Button("Make a Plan to Vote") {
                                showPlanSheet = true
                            }
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(VoteNowColors.richBlue)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                            .padding(.horizontal)
                        }

                        Divider()

                        VStack(spacing: 0) {
                            ForEach(SectionType.allCases, id: \.self) { section in
                                NavigationLink(destination: section.destination(selectedPlace: $selectedPlace)) {
                                    HStack(spacing: 10) {
                                        if section == .supportAmericansVote {
                                            VoteNowLogoIcon(size: 24)
                                                .frame(width: 24, height: 24)
                                                .fixedSize(horizontal: true, vertical: true)
                                        } else if section == .feedback {
                                            Image(systemName: "bubble.left.and.bubble.right.fill")
                                                .foregroundColor(VoteNowColors.primaryCTA)
                                        }
                                        Text(section.title)
                                            .foregroundColor(VoteNowColors.primaryText)
                                        Spacer()
                                    }
                                }
                                .padding()
                                Divider()
                            }
                        }
                        .background(VoteNowColors.background)
                        .cornerRadius(8)
                        .padding(.horizontal)
                    }
                    .padding(.vertical)
                }
                .background(VoteNowColors.appBackground)
                .navigationBarTitleDisplayMode(.inline)
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
            shareImage = nil
        }) {
            if let shareImage {
                ShareSheet(items: [shareImage])
            }
        }
        .onAppear {
            synchronizePlanElectionHeaderIfNeeded()
            deferToNextRunLoop {
                lastRenderedPlanID = mapvPlanStore.plan?.id
            }
        }
        .onChange(of: planVM.zip) { _ in
            synchronizePlanElectionHeaderIfNeeded()
        }
        .onChange(of: planVM.userAddress.state) { _ in
            synchronizePlanElectionHeaderIfNeeded()
        }
        .onChange(of: planVM.userAddress.zip) { _ in
            synchronizePlanElectionHeaderIfNeeded()
        }
        .onChange(of: mapvPlanStore.plan?.id) { newID in
            guard let newID else { return }
            guard newID != lastRenderedPlanID else { return }
            deferToNextRunLoop {
                synchronizePlanElectionHeaderIfNeeded()
                lastRenderedPlanID = newID
                runPlanCardAssemblyAnimation()
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

    private var howToVoteShareText: String {
        if let mapv = mapvPlanStore.plan {
            return [
                "My Plan to Vote",
                "Election: \(mapv.electionTitle)",
                "Date: \(Self.dateFormatter.string(from: mapv.plannedArrival))",
                "Time: \(Self.timeFormatter.string(from: mapv.plannedArrival))",
                "Location: \(mapv.pollingPlaceName)",
                "Address: \(mapv.pollingPlaceAddress)"
            ]
            .joined(separator: "\n")
        }

        var lines: [String] = ["My Plan to Vote"]
        if let method = planVM.plan.method { lines.append("Method: \(method)") }
        if let voteTime = planVM.plan.voteTime {
            lines.append("Date: \(Self.dateFormatter.string(from: voteTime))")
            lines.append("Time: \(Self.timeFormatter.string(from: voteTime))")
        }
        if let place = planVM.plan.placeName { lines.append("Location: \(place)") }
        if let address = planVM.plan.placeAddress { lines.append("Address: \(address)") }
        return lines.joined(separator: "\n")
    }

    private var directionsURL: URL? {
        if let mapvURL = mapvPlanStore.plan?.mapsURL {
            return mapvURL
        }

        if let address = planVM.plan.placeAddress?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !address.isEmpty,
           let encoded = address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            return URL(string: "http://maps.apple.com/?daddr=\(encoded)")
        }

        return nil
    }

    private func shareMapvCard() {
        if let mapv = mapvPlanStore.plan {
            let shareSize = CGSize(width: 631, height: 406)
            let shareCard = VStack(spacing: 0) {
                MAPVCardView(
                    waterfallController: EmojiWaterfallController(),
                    previewPlan: mapv,
                    isVotedActionEnabled: false
                )
                .environmentObject(mapvPlanStore)
                .environment(\.dynamicTypeSize, .accessibility1)
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .overlay(alignment: .bottomTrailing) {
                    VoteNowLogoIcon(size: 53, shadowColor: .clear)
                        .opacity(0.94)
                        .padding(.trailing, 10)
                        .padding(.bottom, 10)
                }
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .padding(0)
            .frame(width: shareSize.width, height: shareSize.height, alignment: .top)
            .background(VoteNowColors.appBackground)
            .clipped()

            if let image = ViewSnapshotter.snapshot(shareCard, size: shareSize) {
                shareImage = image
                showingShare = true
            }
            return
        }

        let fallbackVoteDate = planVM.plan.voteTime ?? Date()
        let fallbackLocation = planVM.plan.placeAddress ?? planVM.plan.placeName ?? "Polling Place"
        let addressParts = fallbackLocation
            .split(separator: ",", maxSplits: 1, omittingEmptySubsequences: true)
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
        let line1 = addressParts.first ?? fallbackLocation
        let line2 = addressParts.count > 1 ? addressParts[1] : nil
        let shareURL = directionsURL?.absoluteString ?? "https://votenow.app"
        let fallbackCard = MapvShareCardView(
            title: "My Plan to Vote",
            electionName: electionSubtitleText,
            voteDateText: Self.dateFormatter.string(from: fallbackVoteDate),
            voteTimeText: Self.timeFormatter.string(from: fallbackVoteDate),
            locationLine1: line1,
            locationLine2: line2,
            shareURLString: shareURL
        )
        .overlay(alignment: .bottomTrailing) {
            VoteNowLogoIcon(size: 77, shadowColor: .clear)
                .opacity(0.94)
                .padding(.trailing, 14)
                .padding(.bottom, 14)
        }

        if let image = ViewSnapshotter.snapshot(fallbackCard, size: CGSize(width: 1080, height: 1350)) {
            shareImage = image
            showingShare = true
        }
    }

    private var calendarPayload: MAPVCalendarPlanPayload? {
        if let mapv = mapvPlanStore.plan {
            let cleanLocation = mapv.pollingPlaceAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? mapv.pollingPlaceName
                : mapv.pollingPlaceAddress
            return MAPVCalendarPlanPayload(
                planID: mapv.id.uuidString,
                electionID: mapv.electionTitle,
                electionTitle: mapv.electionTitle,
                startDate: mapv.plannedArrival,
                endDate: mapv.plannedArrival.addingTimeInterval(60 * 60),
                location: cleanLocation,
                notes: "Plan to vote at \(Self.timeFormatter.string(from: mapv.plannedArrival)).",
                url: URL(string: "votenow://mapv")
            )
        }

        guard let voteTime = planVM.plan.voteTime else { return nil }
        let location = planVM.plan.placeAddress ?? planVM.plan.placeName ?? "Polling Place"
        return MAPVCalendarPlanPayload(
            planID: "legacy-\(voteTime.timeIntervalSince1970)",
            electionID: "upcoming-election",
            electionTitle: "Upcoming Election",
            startDate: voteTime,
            endDate: voteTime.addingTimeInterval(60 * 60),
            location: location,
            notes: "Plan to vote at \(Self.timeFormatter.string(from: voteTime)).",
            url: URL(string: "votenow://mapv")
        )
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
        var components = calendar.dateComponents(in: TimeZone(secondsFromGMT: 0)!, from: sourceDate)
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
        case .raceCandidates:   return "Race Candidates"
        case .pollingLocations: return "Polling Locations"
        case .sampleBallot:     return "Sample Ballot"
        case .mailInBallot:     return "Request Mail-in Ballot"
        case .electionHotlines: return "Election Hotlines"
        case .feedback:         return "Feedback"
        case .supportAmericansVote: return "Support Americans Vote!"
        }
    }

    @ViewBuilder
    func destination(selectedPlace: Binding<PollingPlace?>) -> some View {
        switch self {
        case .raceCandidates:
            RaceCandidatesView()
        case .pollingLocations:
            PollingLocationsView(selectedPlace: selectedPlace)
        case .sampleBallot:
            SampleBallotView()
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

private struct FeedbackView: View {
    private enum FeedbackCategory: String, CaseIterable, Identifiable {
        case idea
        case bug
        case question

        var id: String { rawValue }

        var title: String {
            switch self {
            case .idea: return "Idea"
            case .bug: return "Bug"
            case .question: return "Question"
            }
        }
    }

    @State private var feedbackText: String = ""
    @State private var email: String = ""
    @State private var selectedCategory: FeedbackCategory = .idea
    @State private var isSending = false
    @State private var successMessage: String?
    @State private var errorMessage: String?
    @FocusState private var isFeedbackFocused: Bool

    private var trimmedMessage: String {
        feedbackText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var normalizedEmail: String? {
        let value = email.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }

    private var canSend: Bool {
        !trimmedMessage.isEmpty && !isSending
    }

    private var appVersion: String? {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    }

    private var buildNumber: String? {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PageHeader(title: "Feedback")

                VStack(alignment: .leading, spacing: 10) {
                    Text("College Student Endeavor")
                        .font(.title3.weight(.bold))

                    Text("VoteNow is a college student endeavor built to support all Americans remotely by reducing logistical friction in voting. We would love your feedback to improve the app and overall voter experience.")
                        .font(.body)
                        .foregroundColor(VoteNowColors.mutedText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(VoteNowColors.infoSurfaceBlue)
                )

                VStack(alignment: .leading, spacing: 10) {
                    Text("Share your feedback")
                        .font(.headline)

                    Picker("Category", selection: $selectedCategory) {
                        ForEach(FeedbackCategory.allCases) { item in
                            Text(item.title).tag(item)
                        }
                    }
                    .pickerStyle(.segmented)

                    TextField("Email (optional)", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled(true)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(VoteNowColors.surfaceWhite)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                        )

                    ZStack(alignment: .topLeading) {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(VoteNowColors.surfaceWhite)
                            .frame(minHeight: 170)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                            )

                        if feedbackText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            Text("Tell us what felt confusing, frustrating, or helpful.")
                                .font(.subheadline)
                                .foregroundColor(VoteNowColors.mutedText)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 14)
                                .allowsHitTesting(false)
                        }

                        TextEditor(text: $feedbackText)
                            .font(.body)
                            .scrollContentBackground(.hidden)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
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
                                HStack(spacing: 8) {
                                    ProgressView()
                                        .tint(.white)
                                    Text("Sending...")
                                        .font(.headline)
                                }
                            } else {
                                Text("Send Feedback")
                                    .font(.headline)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(canSend ? VoteNowColors.primaryCTA : VoteNowColors.borderWarm.opacity(0.6))
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(!canSend)

                    if let successMessage {
                        Text(successMessage)
                            .font(.footnote.weight(.semibold))
                            .foregroundColor(VoteNowColors.successGreen)
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote.weight(.semibold))
                            .foregroundColor(.red)
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(VoteNowColors.background)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                )
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationBarTitleDisplayMode(.inline)
        .background(VoteNowColors.background)
        .onChange(of: feedbackText) { _ in
            if successMessage != nil { successMessage = nil }
            if errorMessage != nil { errorMessage = nil }
        }
        .onChange(of: email) { _ in
            if successMessage != nil { successMessage = nil }
            if errorMessage != nil { errorMessage = nil }
        }
    }

    private func sendFeedback() async {
        guard canSend else { return }
        isSending = true
        successMessage = nil
        errorMessage = nil

        let userID = await SupabaseManager.shared.currentUserIDIfAvailable()
        let payload = FeedbackInsert(
            userID: userID,
            email: normalizedEmail,
            message: trimmedMessage,
            category: selectedCategory.rawValue,
            rating: nil,
            appVersion: appVersion,
            buildNumber: buildNumber,
            platform: "iOS",
            deviceModel: UIDevice.current.model,
            osVersion: UIDevice.current.systemVersion,
            locale: Locale.current.identifier
        )

        do {
            try await SupabaseManager.shared.submitFeedback(payload)
            feedbackText = ""
            email = ""
            selectedCategory = .idea
            isFeedbackFocused = false
            successMessage = "Thanks — feedback sent ✅"
        } catch {
            print("[Feedback] submit failed:", String(describing: error))
            errorMessage = "Could not send feedback. Please try again."
        }

        isSending = false
    }
}

struct MobilizationView_Previews: PreviewProvider {
    static var previews: some View {
        MobilizationView()
            .environmentObject(PlanViewModel())
            .environmentObject(MAPVPlanStore.shared)
    }
}
