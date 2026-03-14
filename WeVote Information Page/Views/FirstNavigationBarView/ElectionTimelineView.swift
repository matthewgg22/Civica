import SwiftUI
import UIKit

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
}

private struct ElectionEligibilityDataset: Decodable {
    let state_summary: [ElectionEligibilityStateSummary]
    let timeline_dataset: [ElectionEligibilityTimelineRow]
}

struct ElectionTimelineView: View {
    @EnvironmentObject private var planVM: PlanViewModel
    @Environment(\.locale) private var locale

    @State private var planElection: Election?
    @State private var allElections: [Election] = []
    @State private var visibleElections: [Election] = []
    @State private var errorMessage: String?
    @State private var pendingFlagElection: Election?
    @State private var shareImage: UIImage?
    @State private var showingShareSheet = false
    @State private var showingFeedbackComposer = false
    @State private var feedbackPrefillMessage = ""
    @State private var expandedCardIDs: Set<String> = []
    @State private var showingMapvNotificationPrompt = false

    private let stateResolver = USZipStateResolver()
    private static let eligibilityDataset: ElectionEligibilityDataset? = {
        guard let url = Bundle.main.url(forResource: "ElectionEligibilityDataset", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(ElectionEligibilityDataset.self, from: data) else {
            return nil
        }
        return decoded
    }()
    private static let independentPrimaryTerritoryNotesByCode: [String: String] = [
        "AS": "Primary type: Nonpartisan / No standard party-primary system verified. Independent voter rule: This is not a normal state-style Dem/GOP primary system in the official materials reviewed. Can choose Democratic or Republican primary ballot: N/A. Note: American Samoa's Election Office describes itself as nonpartisan; a standard territorywide partisan primary access rule for independents was not verified.",
        "GU": "Primary type: Party-column primary. Independent voter rule: Independent voter chooses one party column or the non-affiliated column; not multiple parties. Can choose Democratic or Republican primary ballot: Usually one choice only. Note: Guam law provides separate party columns and a non-affiliated column if needed.",
        "MP": "Primary type: Party-rule-driven / Varies. Independent voter rule: No single simple open/closed rule verified for independents; party nomination rules and independent petition access both exist. Can choose Democratic or Republican primary ballot: Varies. Note: Official CNMI election law shows primaries exist and independent candidates can access the general ballot by petition.",
        "PR": "Primary type: Open or affiliated primary, depending on party format. Independent voter rule: In an open primary, any active voter may vote; in an affiliated primary, voter must affiliate with the party, including immediate affiliation before voting. Can choose Democratic or Republican primary ballot: Sometimes / Depends on party format. Note: Puerto Rico law explicitly distinguishes open and affiliated primaries.",
        "VI": "Primary type: Closed. Independent voter rule: Non-party affiliates cannot vote in the primary. Can choose Democratic or Republican primary ballot: No. Note: VI VOTE FAQ indicates primary elections are for party members only."
    ]

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

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                PageHeader(title: Text("app.page.election_timeline", tableName: "AppShell"))
                Text(timelineAddressSubtitle)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.mutedText)
                    .padding(.leading, 72)
                    .padding(.top, -6)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 8)
            .background(VoteNowColors.appBackground)

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
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

                    ForEach(Array(visibleElections.enumerated()), id: \.element.id) { index, election in
                        electionCard(election, index: index)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
        }
        .background(VoteNowColors.appBackground.ignoresSafeArea())
        .navigationTitle(Text("app.page.election_timeline", tableName: "AppShell"))
        .sheet(item: $planElection) { _ in
            MultiStepFormView()
                .environmentObject(planVM)
        }
        .sheet(isPresented: $showingShareSheet) {
            shareImage = nil
        } content: {
            if let shareImage {
                ShareSheet(items: [shareImage])
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
            Button(l("app.timeline.action.dialog.share", "Share with friend")) {
                if let election = pendingFlagElection {
                    shareElectionCard(for: election)
                }
                pendingFlagElection = nil
            }
            Button(l("app.timeline.action.dialog.report", "Report problem")) {
                if let election = pendingFlagElection {
                    openFeedbackComposer(for: election)
                }
                pendingFlagElection = nil
            }
        }
        .alert(
            l("app.timeline.mapv.notifications.title", "Turn On Notifications"),
            isPresented: $showingMapvNotificationPrompt
        ) {
            Button(l("app.timeline.mapv.notifications.ok", "OK"), role: .cancel) {}
        } message: {
            Text(
                l(
                    "app.timeline.mapv.notifications.message",
                    "Turn on notifications to ensure you don't miss your next chance to vote."
                )
            )
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
    }

    private var timelineAddressSubtitle: String {
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

        return l("app.timeline.location.set_address", "Set your address in My Reps")
    }

    @ViewBuilder
    private func electionCard(_ election: Election, index: Int) -> some View {
        let mapvStatus = mapvAvailability(for: election)

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

                        if let partyBadge = primaryPartyBadge(for: election) {
                            Text(partyBadge.title)
                                .font(.caption.weight(.semibold))
                                .foregroundColor(partyBadge.foreground)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(partyBadge.background)
                                .clipShape(Capsule())
                                .lineLimit(1)
                        }
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
                .accessibilityLabel(l("app.timeline.action.accessibility", "Election actions"))
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
                Spacer(minLength: 8)
            }

            if index == 0 {
                Button {
                    if mapvStatus.isEnabled {
                        planElection = election
                    } else {
                        showingMapvNotificationPrompt = true
                    }
                } label: {
                    Text(mapvButtonTitle(for: mapvStatus))
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.plain)
                .foregroundColor(mapvStatus.isEnabled ? .white : VoteNowColors.primaryText.opacity(0.75))
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(mapvStatus.isEnabled ? VoteNowColors.primaryCTA : VoteNowColors.infoSurfaceBlue)
                )

                if case .pending(let activationDate) = mapvStatus {
                    Text(
                        lf(
                            "app.timeline.mapv.pending_message",
                            "MAPV becomes active on %@.",
                            formattedDateText(activationDate)
                        )
                    )
                        .font(.caption)
                        .foregroundColor(VoteNowColors.mutedText)
                }
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
                            Text(intro)
                                .font(.caption)
                                .foregroundColor(VoteNowColors.mutedText)
                        }

                        ForEach(ballotContent.items) { item in
                            VStack(alignment: .leading, spacing: 4) {
                                Text("• \(item.title)")
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(VoteNowColors.primaryText)
                                if !item.detail.isEmpty {
                                    Text(item.detail)
                                        .font(.caption)
                                        .foregroundColor(VoteNowColors.mutedText)
                                }
                            }
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
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(VoteNowColors.surfaceWhite)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(index == 0 ? VoteNowColors.warningAmber.opacity(0.08) : .clear)
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(index == 0 ? VoteNowColors.warningAmber.opacity(0.34) : VoteNowColors.borderWarm, lineWidth: 1)
        )
        .shadow(color: VoteNowColors.primaryText.opacity(0.06), radius: 3, x: 0, y: 1)
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
        } else {
            stateFlagFallback(for: code)
                .frame(width: flagSize.width, height: flagSize.height)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                )
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

    private struct BallotDisclosureItem: Identifiable {
        let id: String
        let title: String
        let detail: String
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
        if let datasetContent = datasetBackedBallotDisclosureContent(for: election) {
            return datasetContent
        }
        return supplementalBallotDisclosureContent(for: election)
    }

    private func datasetBackedBallotDisclosureContent(for election: Election) -> BallotDisclosureContent? {
        guard let dataset = Self.eligibilityDataset,
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

        let items = sortedRows.map { row in
            BallotDisclosureItem(
                id: row.dataset_key,
                title: ballotTitle(for: row),
                detail: row.eligibility_summary.trimmingCharacters(in: .whitespacesAndNewlines)
            )
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
           let dataset = Self.eligibilityDataset,
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

    private func supplementalItem(
        stateCode: String,
        slug: String,
        title: String,
        detail: String
    ) -> BallotDisclosureItem {
        BallotDisclosureItem(
            id: "supplemental-\(stateCode.lowercased())-\(slug)",
            title: title,
            detail: detail
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
                    notes.append(customNote)
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
                }
                if customNote.isEmpty {
                    notes.append(
                        l(
                            "app.timeline.ballot.independent.note.generic_verify",
                            "Always verify current ballot access rules with your state election office before the primary."
                        )
                    )
                }
            } else if let territoryNote = Self.independentPrimaryTerritoryNotesByCode[stateCode] {
                notes.append(territoryNote)
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

    private func ballotTitle(for row: ElectionEligibilityTimelineRow) -> String {
        let label = row.dropdown_label.trimmingCharacters(in: .whitespacesAndNewlines)
        if !label.isEmpty {
            return label
        }

        switch row.office_family.lowercased() {
        case "president":
            return "Presidential election"
        case "governor":
            return "Governor election"
        case "us_senate":
            return "U.S. Senate election"
        case "us_house":
            return "U.S. House election"
        default:
            return "Election item"
        }
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
        let shareSize = CGSize(width: 1080, height: 900)
        let shareCard = ElectionTimelineShareCard(
            electionTitle: headerTitle(for: election),
            stateName: stateName(for: election),
            electionDayText: formattedDateText(election.electionDay),
            earlyVotingText: earlyVotingText(for: election),
            registrationText: registrationDeadlineText(for: election)
        )

        if let image = ViewSnapshotter.snapshot(shareCard, size: shareSize) {
            shareImage = image
            showingShareSheet = true
        } else {
            print("[ElectionTimeline] Failed to generate election share image.")
        }
    }

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
        let subtitle = election.subtitle.trimmingCharacters(in: .whitespacesAndNewlines)

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

    private func loadElectionsIfNeeded() {
        guard allElections.isEmpty else { return }
        allElections = Self.loadMidtermElectionsFromBundle()
    }

    private func applyFilter() {
        guard !allElections.isEmpty else {
            visibleElections = []
            planVM.upcomingElections = []
            return
        }

        errorMessage = nil

        let targetStateCodes = resolveStateCodes(from: "")

        guard !targetStateCodes.isEmpty else {
            visibleElections = []
            planVM.upcomingElections = []
            errorMessage = l("app.timeline.error.set_valid_address", "Set a valid U.S. address or ZIP in My Reps to load your timeline.")
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

        visibleElections = filtered
        planVM.upcomingElections = filtered
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

    private static func loadMidtermElectionsFromBundle() -> [Election] {
        guard let url = Bundle.main.url(forResource: "USMidterm2026ElectionDates", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let records = try? JSONDecoder().decode([MidtermStateElectionRecord].self, from: data) else {
            return []
        }

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

    private func registrationDeadlineText(for election: Election) -> String {
        election.flags
            .first(where: { $0.hasPrefix("REGISTRATION_DEADLINE_TEXT:") })?
            .replacingOccurrences(of: "REGISTRATION_DEADLINE_TEXT:", with: "")
            ?? Self.formatCardDate(election.registrationDeadline)
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

    private func isPrimaryElection(_ election: Election) -> Bool {
        if let type = election.flags
            .first(where: { $0.hasPrefix("ELECTION_TYPE:") })?
            .replacingOccurrences(of: "ELECTION_TYPE:", with: "") {
            return type == "PRIMARY" || type == "PRIMARY_RUNOFF" || type == "PRESIDENTIAL_PRIMARY"
        }
        return election.subtitle.lowercased().contains("primary")
    }

    private enum MAPVAvailability {
        case active
        case pending(startDate: Date)
        case closed

        var isEnabled: Bool {
            if case .active = self {
                return true
            }
            return false
        }
    }

    private func mapvAvailability(for election: Election) -> MAPVAvailability {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let electionDay = calendar.startOfDay(for: election.electionDay)
        let activationDate = calendar.date(byAdding: .day, value: -14, to: electionDay) ?? electionDay

        if today > electionDay {
            return .closed
        }
        if today >= activationDate {
            return .active
        }
        return .pending(startDate: activationDate)
    }

    private func mapvButtonTitle(for availability: MAPVAvailability) -> String {
        switch availability {
        case .active, .pending:
            return l("app.timeline.mapv.button.make_plan", "Make a Plan to Vote")
        case .closed:
            return l("app.timeline.mapv.button.passed", "Election Day Passed")
        }
    }
}

private struct ElectionTimelineShareCard: View {
    let electionTitle: String
    let stateName: String
    let electionDayText: String
    let earlyVotingText: String
    let registrationText: String

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack(spacing: 14) {
                VoteNowLogoIcon(size: 88)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Election Timeline")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundColor(VoteNowColors.primaryText)
                    Text(stateName)
                        .font(.system(size: 26, weight: .semibold))
                        .foregroundColor(VoteNowColors.mutedText)
                }
            }

            VStack(alignment: .leading, spacing: 18) {
                Text(electionTitle)
                    .font(.system(size: 54, weight: .bold))
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)

                shareRow(title: "Election Day", value: electionDayText)
                shareRow(title: "Early Voting", value: earlyVotingText)
                shareRow(title: "Registration Deadline", value: registrationText)
            }
            .padding(30)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .fill(VoteNowColors.surfaceWhite)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .stroke(VoteNowColors.borderWarm, lineWidth: 2)
            )

            Text("Shared from VoteNow")
                .font(.system(size: 30, weight: .semibold))
                .foregroundColor(VoteNowColors.primaryCTA)
        }
        .padding(48)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(VoteNowColors.appBackground)
    }

    private func shareRow(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 28, weight: .semibold))
                .foregroundColor(VoteNowColors.mutedText)

            Text(value)
                .font(.system(size: 38, weight: .bold))
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

struct ElectionTimelineView_Previews: PreviewProvider {
    static var previews: some View {
        ElectionTimelineView()
            .environmentObject(PlanViewModel())
    }
}
