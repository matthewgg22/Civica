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

struct ElectionTimelineView: View {
    @EnvironmentObject private var planVM: PlanViewModel
    @Environment(\.locale) private var locale

    @State private var planElection: Election?
    @State private var allElections: [Election] = []
    @State private var visibleElections: [Election] = []
    @State private var errorMessage: String?
    @State private var pendingFlagElection: Election?
    @State private var showFlagSubmittedAlert = false
    @State private var expandedCardIDs: Set<String> = []

    private let stateResolver = USZipStateResolver()

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
        .confirmationDialog(
            l("app.timeline.flag.dialog.title", "Flag Election Listing"),
            isPresented: Binding(
                get: { pendingFlagElection != nil },
                set: { isPresented in
                    if !isPresented {
                        pendingFlagElection = nil
                    }
                }
            ),
            titleVisibility: .visible
        ) {
            Button(l("app.timeline.flag.dialog.report", "Report Issue"), role: .destructive) {
                submitElectionFlag()
            }
            Button(l("app.timeline.flag.dialog.cancel", "Cancel"), role: .cancel) {
                pendingFlagElection = nil
            }
        } message: {
            Text(l("app.timeline.flag.dialog.message", "Report an issue with this election listing?"))
        }
        .alert(l("app.timeline.flag.alert.title", "Thanks for flagging"), isPresented: $showFlagSubmittedAlert) {
            Button(l("app.timeline.flag.alert.ok", "OK"), role: .cancel) {}
        } message: {
            Text(l("app.timeline.flag.alert.message", "We will review this election entry."))
        }
        .onAppear {
            loadElectionsIfNeeded()
            applyFilter()
        }
        .onChange(of: planVM.zip) { _ in
            applyFilter()
        }
        .onChange(of: planVM.userAddress.street) { _ in
            applyFilter()
        }
        .onChange(of: planVM.userAddress.city) { _ in
            applyFilter()
        }
        .onChange(of: planVM.userAddress.state) { _ in
            applyFilter()
        }
        .onChange(of: planVM.userAddress.zip) { _ in
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
                .accessibilityLabel(l("app.timeline.flag.accessibility", "Flag election"))
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
                Button(action: { planElection = election }) {
                    Text(mapvButtonTitle(for: mapvStatus))
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.plain)
                .disabled(!mapvStatus.isEnabled)
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
                VStack(alignment: .leading, spacing: 8) {
                    detailRow(
                        label: l("app.timeline.detail.registration_deadline", "Voter registration deadline"),
                        value: registrationDeadlineText(for: election)
                    )

                    if let notes = election.registrationNotes?.trimmingCharacters(in: .whitespacesAndNewlines),
                       !notes.isEmpty {
                        Text(notes)
                            .font(.caption)
                            .foregroundColor(VoteNowColors.mutedText)
                    }
                }
                .padding(.top, 6)
            } label: {
                Text(l("app.timeline.disclosure.preliminary", "Preliminary Things to Vote On"))
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)
            }
            .tint(VoteNowColors.primaryCTA)
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

    private func submitElectionFlag() {
        guard pendingFlagElection != nil else { return }
        pendingFlagElection = nil
        // TODO: Route this action to the persisted election reporting flow when available.
        showFlagSubmittedAlert = true
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

        let territoryTargets = targetStateCodes.intersection(Self.territoryCodes)
        if !territoryTargets.isEmpty {
            visibleElections = []
            planVM.upcomingElections = []
            errorMessage = l("app.timeline.error.territory_unavailable", "Territory elections are not in this state dataset yet.")
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

        return elections
    }

    private static let presidentialProjectionNote =
        "2028 presidential dates are projected for planning and will be updated when states certify final calendars."

    private static let presidentialCycleTBDText = "TBD for 2028 cycle"
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

struct ElectionTimelineView_Previews: PreviewProvider {
    static var previews: some View {
        ElectionTimelineView()
            .environmentObject(PlanViewModel())
    }
}
