//
//  VoterRegistrationView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/28/25.
//

import SwiftUI
import UIKit

private struct VoterRegistrationCard: Identifiable {
    enum Action {
        case openURL(URL)
        case goToHowToVoteTab
    }

    enum Kind {
        case whyRegister
        case deadline
        case check
        case thenVote
    }

    let id: String
    let kind: Kind
    let stepLabel: String
    let title: String
    let summary: String
    let bullets: [String]
    let primaryActionTitle: String
    let primaryAction: Action
    let secondaryActionTitle: String?
    let secondaryAction: Action?
}

// MARK: - VoterRegistrationView
struct VoterRegistrationView: View {
    @Environment(\.openURL) private var openURL
    @EnvironmentObject private var planVM: PlanViewModel

    private let contextResolver = ElectionGuideContextResolver()
    private let contentProvider = RegistrationGuideContentProvider()
    private let stickyHeaderHeight: CGFloat = 126
    private let voteGovURL = URL(string: "https://www.vote.gov/")!
    private let howToVoteDeepLink = URL(string: "votenow://mapv")!

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

    private var registrationPortalURL: URL {
        guideContent?.checkStatusURL ?? voteGovURL
    }

    private var registrationDeadlineLabel: String {
        guideContent?.deadlineLabel ?? "Registration Deadline"
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

        return "Set your address in My Reps"
    }

    private var cards: [VoterRegistrationCard] {
        [
            VoterRegistrationCard(
                id: "step-1",
                kind: .whyRegister,
                stepLabel: "",
                title: "What is Voter Registration?",
                summary: "Voter registration is the process that puts you on your state’s voter rolls so you are eligible to vote.",
                bullets: [
                    "Most states require registration before you can vote.",
                    "Checking early helps prevent Election Day surprises."
                ],
                primaryActionTitle: "Start registration",
                primaryAction: .openURL(registrationPortalURL),
                secondaryActionTitle: nil,
                secondaryAction: nil
            ),
            VoterRegistrationCard(
                id: "step-2",
                kind: .deadline,
                stepLabel: "STEP 2",
                title: "Register before the deadline",
                summary: "Deadlines vary by state and method. Register early so you have time to fix any issues before polls open.",
                bullets: [
                    "Your state can set different cutoffs for online, mail, and in-person methods."
                ],
                primaryActionTitle: "Start registration",
                primaryAction: .openURL(registrationPortalURL),
                secondaryActionTitle: "See my deadline details",
                secondaryAction: .openURL(registrationPortalURL)
            ),
            VoterRegistrationCard(
                id: "step-3",
                kind: .check,
                stepLabel: "STEP 3",
                title: "How to check registration",
                summary: "Use your state’s official voter lookup to verify your registration details are active and accurate.",
                bullets: [
                    "Use your state’s official voter lookup tool.",
                    "Confirm your status and polling address.",
                    "Update your record if anything looks wrong."
                ],
                primaryActionTitle: "Check my registration",
                primaryAction: .openURL(registrationPortalURL),
                secondaryActionTitle: registrationPortalURL != voteGovURL ? "Find lookup on vote.gov" : nil,
                secondaryAction: registrationPortalURL != voteGovURL ? .openURL(voteGovURL) : nil
            ),
            VoterRegistrationCard(
                id: "step-4",
                kind: .thenVote,
                stepLabel: "STEP 4",
                title: "Then vote",
                summary: "Once your registration is set, move straight into your voting plan.",
                bullets: [
                    "Make a plan for when and where you will vote.",
                    "Review what is on your ballot ahead of time.",
                    "Confirm polling location and hours before you go."
                ],
                primaryActionTitle: "Go to How to Vote",
                primaryAction: .goToHowToVoteTab,
                secondaryActionTitle: nil,
                secondaryAction: nil
            )
        ]
    }

    var body: some View {
        NavigationStack {
            GeometryReader { geo in
                ZStack(alignment: .top) {
                    ScrollView(.vertical) {
                        LazyVStack(spacing: 10) {
                            ForEach(Array(cards.enumerated()), id: \.element.id) { idx, card in
                                registrationCard(card, index: idx, viewportHeight: geo.size.height)
                            }
                        }
                        .scrollTargetLayout()
                        .padding(.horizontal, 16)
                        .padding(.top, stickyHeaderHeight + 6)
                        .padding(.bottom, 18)
                    }
                    .scrollIndicators(.hidden)
                    .scrollTargetBehavior(.viewAligned)

                    VStack(alignment: .leading, spacing: 0) {
                        PageHeader(title: "Voter Registration")
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
                    .zIndex(5)
                }
                .background(VoteNowColors.appBackground.ignoresSafeArea())
            }
            .navigationBarHidden(true)
        }
    }

    @ViewBuilder
    private func registrationCard(_ card: VoterRegistrationCard, index: Int, viewportHeight: CGFloat) -> some View {
        let isLeadCard = index == 0
        let targetHeight = isLeadCard
            ? min(max(viewportHeight * 0.50, 300), 420)
            : min(max(viewportHeight * 0.40, 240), 330)

        VStack(alignment: .leading, spacing: 12) {
            if card.kind == .whyRegister {
                Text(card.title)
                    .font(.title3.weight(.bold))
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                (
                    Text("\(card.stepLabel) ")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(VoteNowColors.primaryCTA)
                    +
                    Text(card.title)
                        .font(.title3.weight(.bold))
                        .foregroundColor(VoteNowColors.primaryText)
                )
                .fixedSize(horizontal: false, vertical: true)
            }

            Text(card.summary)
                .font(.body)
                .foregroundColor(VoteNowColors.mutedText)
                .fixedSize(horizontal: false, vertical: true)

            if card.kind == .whyRegister {
                primaryBallotGuidancePanel
            }

            if card.kind == .deadline {
                deadlinePanel
            }

            VStack(alignment: .leading, spacing: 6) {
                ForEach(card.bullets, id: \.self) { bullet in
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

            Spacer(minLength: 4)

            if card.kind != .whyRegister {
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

            if let secondaryTitle = card.secondaryActionTitle,
               let secondaryAction = card.secondaryAction {
                Button(secondaryTitle) {
                    handleCardAction(secondaryAction)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryCTA)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(minHeight: targetHeight, alignment: .topLeading)
        .background(card.kind == .whyRegister ? VoteNowColors.infoSurfaceBlue : VoteNowColors.surfaceWhite)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.12), lineWidth: 1)
        )
        .shadow(color: VoteNowColors.primaryText.opacity(0.05), radius: 5, x: 0, y: 2)
        .scrollTransition(.animated(.easeInOut(duration: 0.2)), axis: .vertical) { content, phase in
            content
                .scaleEffect(phase.isIdentity ? 1.0 : 0.94)
                .opacity(phase.isIdentity ? 1.0 : 0.90)
                .offset(x: phase.isIdentity ? 0 : 8)
        }
    }

    private var deadlinePanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                registrationStateFlag

                VStack(alignment: .leading, spacing: 3) {
                    Text("Upcoming Election Day")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(VoteNowColors.mutedText)
                    HStack(alignment: .center, spacing: 8) {
                        Text(formattedElectionDay(nextUpcomingElectionDay))
                            .font(.subheadline.weight(.bold))
                            .foregroundColor(VoteNowColors.primaryText)
                            .lineLimit(1)
                            .minimumScaleFactor(0.9)

                        Spacer(minLength: 8)

                        Text(countdownText(to: nextUpcomingElectionDay))
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(VoteNowColors.primaryCTA)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(VoteNowColors.primaryCTA.opacity(0.10))
                            .clipShape(Capsule())
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            Text("\(registrationDeadlineLabel): \(formattedElectionDay(guideContent?.registrationDeadline))")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryText)

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

    private var primaryBallotGuidancePanel: some View {
        VStack(alignment: .leading, spacing: 6) {
            (
                Text("In a primary election, ")
                + Text("Democrat").foregroundColor(VoteNowColors.richBlue).fontWeight(.semibold)
                + Text(" and ")
                + Text("Republican").foregroundColor(VoteNowColors.richRed).fontWeight(.semibold)
                + Text(" registrations can determine which party ballot you receive.")
            )
            .font(.callout)
            .foregroundColor(VoteNowColors.primaryText)

            (
                Text("Your current setting: ")
                + Text(currentPartyLabel).foregroundColor(currentPartyColor).fontWeight(.semibold)
            )
            .font(.callout)
            .foregroundColor(VoteNowColors.primaryText)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VoteNowColors.appBackground.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var currentPartyLabel: String {
        switch planVM.selectedParty {
        case .democrat:
            return "Democrat"
        case .republican:
            return "Republican"
        case .independent:
            return "Independent"
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

    private func handleCardAction(_ action: VoterRegistrationCard.Action) {
        switch action {
        case .openURL(let url):
            openURL(url)
        case .goToHowToVoteTab:
            openURL(howToVoteDeepLink)
        }
    }

    private func formattedElectionDay(_ date: Date?) -> String {
        guard let date else { return "Date TBD" }
        return Self.displayDateFormatter.string(from: date)
    }

    private func countdownText(to date: Date?) -> String {
        guard let date else { return "Countdown TBD" }
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let electionDay = calendar.startOfDay(for: date)
        let delta = calendar.dateComponents([.day], from: today, to: electionDay).day ?? 0

        if delta == 0 { return "Election day is today" }
        if delta > 0 { return "\(delta) day\(delta == 1 ? "" : "s") left" }
        let ago = abs(delta)
        return "\(ago) day\(ago == 1 ? "" : "s") ago"
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
                label = "Online deadline"
            case "mail", "by mail":
                label = "Mail deadline"
            case "in-person", "in person":
                label = "In-person deadline"
            default:
                label = "Deadline"
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

    private static let displayDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()
}

struct VoterRegistrationView_Previews: PreviewProvider {
    static var previews: some View {
        VoterRegistrationView()
            .environmentObject(PlanViewModel())
    }
}
