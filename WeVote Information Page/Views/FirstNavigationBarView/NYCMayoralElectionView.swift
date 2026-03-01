import SwiftUI

struct NYCMayoralElectionView: View {
    @EnvironmentObject private var planVM: PlanViewModel
    @Environment(\.locale) private var locale

    @State private var upcomingElection: Election?
    @State private var stateCode: String?
    @State private var stateName: String = ""
    @State private var guideCards: [ElectionGuideInfoCard] = []
    @State private var errorMessage: String?

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
        NavigationStack {
            VStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 0) {
                    PageHeader(title: Text("app.page.election_guide", tableName: "AppShell"))
                    Text(electionSubtitleText)
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
                    VStack(alignment: .leading, spacing: 16) {
                        if let errorMessage {
                            Text(errorMessage)
                                .font(.body)
                                .foregroundColor(VoteNowColors.mutedText)
                        } else {
                            introLineView

                            VoterIDGuideCard(
                                stateCode: stateCode,
                                stateName: stateName
                            )

                            ForEach(guideCards) { card in
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(card.title)
                                        .font(.headline.weight(.bold))
                                        .italic()
                                        .foregroundColor(VoteNowColors.primaryText)

                                    Text(card.body)
                                        .font(.subheadline)
                                        .foregroundColor(VoteNowColors.mutedText)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .fill(VoteNowColors.surfaceWhite)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                                )
                                .shadow(color: VoteNowColors.primaryText.opacity(0.05), radius: 2, x: 0, y: 1)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 24)
                }
            }
            .background(VoteNowColors.appBackground.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear(perform: refreshGuide)
        .onChange(of: planVM.zip) { _, _ in refreshGuide() }
        .onChange(of: planVM.userAddress.state) { _, _ in refreshGuide() }
        .onChange(of: planVM.userAddress.zip) { _, _ in refreshGuide() }
        .onChange(of: planVM.selectedParty) { _, _ in refreshGuide() }
        .onChange(of: locale.identifier) { _, _ in refreshGuide() }
    }

    private var electionSubtitleText: String {
        guard let upcomingElection else {
            return l("app.guide.subtitle.none", "No upcoming election loaded")
        }
        return displayElectionTitle(for: upcomingElection)
    }

    private var introLineView: some View {
        Group {
            if let upcomingElection {
                let electionLabel = displayElectionTitle(for: upcomingElection).lowercased()
                let voterLabel = stateName.isEmpty ? l("app.guide.voters.label", "voters") : "\(stateName) \(l("app.guide.voters.label", "voters"))"

                if Calendar.current.isDate(upcomingElection.startDate, inSameDayAs: upcomingElection.electionDay) {
                    Text(
                        lf(
                            "app.guide.intro.same_day",
                            "On %@, %@ are eligible to vote in the %@.",
                            formatLongDate(upcomingElection.electionDay),
                            voterLabel,
                            electionLabel
                        )
                    )
                } else {
                    Text(
                        lf(
                            "app.guide.intro.range",
                            "Starting %@ through %@, %@ are eligible to vote in the %@.",
                            formatLongDate(upcomingElection.startDate),
                            formatLongDate(upcomingElection.electionDay),
                            voterLabel,
                            electionLabel
                        )
                    )
                }
            } else {
                Text(l("app.guide.error.enter_valid", "Enter a valid state or ZIP to load your upcoming election guide."))
            }
        }
        .font(.body)
        .foregroundColor(VoteNowColors.primaryText)
    }

    private func refreshGuide() {
        guard let resolvedStateCode = resolveStateCode() else {
            clearGuide(message: l("app.guide.error.enter_valid_next", "Enter a valid state or ZIP to see your next election guide."))
            return
        }

        let candidates = loadUpcomingElections(for: resolvedStateCode)
        guard let nextElection = selectUpcomingElection(from: candidates) else {
            clearGuide(message: l("app.guide.error.no_upcoming", "No upcoming elections found for your state."))
            return
        }

        stateCode = resolvedStateCode
        stateName = nextElection.jurisdictionName
        upcomingElection = nextElection
        guideCards = buildGuideCards(for: nextElection, stateCode: resolvedStateCode)
        errorMessage = nil
    }

    private func clearGuide(message: String) {
        upcomingElection = nil
        stateCode = nil
        stateName = ""
        guideCards = []
        errorMessage = message
    }

    private func resolveStateCode() -> String? {
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

        if rawState.count == 2 {
            return rawState.uppercased()
        }

        return Self.stateCodeByName[rawState.lowercased()]
    }

    private func loadUpcomingElections(for stateCode: String) -> [Election] {
        let today = Calendar.current.startOfDay(for: Date())

        let cached = planVM.upcomingElections
            .filter { stateCodeForElection($0) == stateCode }
            .filter { Calendar.current.startOfDay(for: $0.electionDay) >= today }
            .sorted { $0.electionDay < $1.electionDay }
        if !cached.isEmpty {
            return cached
        }

        return loadElectionsFromBundle(for: stateCode)
            .filter { Calendar.current.startOfDay(for: $0.electionDay) >= today }
            .sorted { $0.electionDay < $1.electionDay }
    }

    private func selectUpcomingElection(from elections: [Election]) -> Election? {
        elections.sorted {
            if $0.electionDay != $1.electionDay {
                return $0.electionDay < $1.electionDay
            }
            return displayElectionTitle(for: $0) < displayElectionTitle(for: $1)
        }
        .first
    }

    private func loadElectionsFromBundle(for stateCode: String) -> [Election] {
        guard let url = Bundle.main.url(forResource: "USMidterm2026ElectionDates", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let records = try? JSONDecoder().decode([MidtermStateElectionRecord].self, from: data),
              let record = records.first(where: { $0.state_code == stateCode }) else {
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
            guard let electionDate = Self.isoDate(from: electionDateISO) else { return }
            let registrationDate = Self.isoDate(from: registrationISO) ?? electionDate
            let earlyVotingDate = Self.isoDate(from: earlyVotingISO)
            let earlyVotingText = displayText(from: earlyVotingISO, fallbackDate: earlyVotingDate)
            let registrationText = displayText(from: registrationISO, fallbackDate: registrationDate)

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
                        "STATE_CODE:\(stateCode)",
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
            electionDateISO: Self.projectedPresidentialPrimaryISO(from: record.primary_date),
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

    private func buildGuideCards(for election: Election, stateCode: String) -> [ElectionGuideInfoCard] {
        let phase = phaseForElection(election)
        var cards: [ElectionGuideInfoCard] = []

        switch phase {
        case .primary:
            cards.append(
                ElectionGuideInfoCard(
                    title: l("app.guide.card.primary.title", "A Primary Election"),
                    body: l("app.guide.card.primary.body", "A primary election decides which candidates advance to the general election. Rules can vary by party and office.")
                )
            )

            if stateCode == "CA" {
                cards.append(
                    ElectionGuideInfoCard(
                        title: l("app.guide.card.jungle.title", "Jungle Primary"),
                        body: l("app.guide.card.jungle.body", "California uses a top-two primary for many offices: all candidates appear on one ballot, and the top two finishers advance to the general election regardless of party.")
                    )
                )
            } else if stateCode == "WA" {
                cards.append(
                    ElectionGuideInfoCard(
                        title: l("app.guide.card.top_two.title", "Top-Two Primary"),
                        body: l("app.guide.card.top_two.body", "Washington uses a top-two style primary for many races, where all voters can choose from all candidates and the top two advance.")
                    )
                )
            }

            if planVM.selectedParty == .independent {
                cards.append(
                    ElectionGuideInfoCard(
                        title: l("app.guide.card.party_affiliation.title", "Party Affiliation"),
                        body: l("app.guide.card.party_affiliation.body", "Primary ballot eligibility can depend on your current party registration. Confirm your state rules before election day.")
                    )
                )
            }

        case .runoff:
            cards.append(
                ElectionGuideInfoCard(
                    title: l("app.guide.card.runoff.title", "Primary Runoff"),
                    body: l("app.guide.card.runoff.body", "A runoff election happens when no candidate reaches the required threshold in the first primary round.")
                )
            )

        case .general:
            cards.append(
                ElectionGuideInfoCard(
                    title: l("app.guide.card.general.title", "General Election"),
                    body: l("app.guide.card.general.body", "The general election determines who takes office from the candidates who qualified in earlier rounds.")
                )
            )

            if stateCode == "AK" || stateCode == "ME" {
                cards.append(
                    ElectionGuideInfoCard(
                        title: l("app.guide.card.ranked_choice.title", "Ranked Choice"),
                        body: l("app.guide.card.ranked_choice.body", "Ranked-choice voting can apply in covered contests. You can rank candidates in order of preference where allowed.")
                    )
                )
            }

        case .special:
            cards.append(
                ElectionGuideInfoCard(
                    title: l("app.guide.card.special.title", "Special Election"),
                    body: l("app.guide.card.special.body", "Special elections fill vacancies or decide urgent ballot questions outside the normal election calendar.")
                )
            )

        case .unknown:
            cards.append(
                ElectionGuideInfoCard(
                    title: l("app.guide.card.overview.title", "Election Overview"),
                    body: l("app.guide.card.overview.body", "This guide is personalized to your next upcoming election based on your current ZIP and state.")
                )
            )
        }

        cards.append(contentsOf: electionTypeOverviewCards(for: election))
        return cards
    }

    private func electionTypeOverviewCards(for election: Election) -> [ElectionGuideInfoCard] {
        let subtitle = election.subtitle.lowercased()
        let title = displayElectionTitle(for: election).lowercased()
        let joined = "\(subtitle) \(title)"

        if joined.contains("presidential") {
            return [
                ElectionGuideInfoCard(
                    title: l("app.guide.card.presidential.title", "Presidential Elections"),
                    body: l("app.guide.card.presidential.body", "What is on the ballot: president/vice president, all U.S. House seats, some U.S. Senate seats, and state and local offices or ballot measures where scheduled.")
                )
            ]
        }

        if joined.contains("midterm") {
            return [
                ElectionGuideInfoCard(
                    title: l("app.guide.card.midterm.title", "Midterm Elections"),
                    body: l("app.guide.card.midterm.body", "What is on the ballot: all U.S. House seats, some U.S. Senate seats, many governor and state legislature races, and statewide/local ballot measures.")
                )
            ]
        }

        if joined.contains("mayor") || joined.contains("mayoral") {
            return [
                ElectionGuideInfoCard(
                    title: l("app.guide.card.mayoral.title", "Mayoral Elections"),
                    body: l("app.guide.card.mayoral.body", "What is on the ballot: mayor, and often city council or other city offices, plus local ballot questions depending on your city.")
                )
            ]
        }

        return []
    }

    private func phaseForElection(_ election: Election) -> ElectionGuidePhase {
        if let type = election.flags.first(where: { $0.hasPrefix("ELECTION_TYPE:") })?
            .replacingOccurrences(of: "ELECTION_TYPE:", with: "") {
            switch type {
            case "PRIMARY", "PRESIDENTIAL_PRIMARY":
                return .primary
            case "PRIMARY_RUNOFF":
                return .runoff
            case "GENERAL", "PRESIDENTIAL_GENERAL":
                return .general
            default:
                break
            }
        }

        let lower = election.subtitle.lowercased()
        if lower.contains("runoff") { return .runoff }
        if lower.contains("special") { return .special }
        if lower.contains("primary") { return .primary }
        if lower.contains("general") { return .general }
        return .unknown
    }

    private func stateCodeForElection(_ election: Election) -> String? {
        election.flags.first(where: { $0.hasPrefix("STATE_CODE:") })?
            .replacingOccurrences(of: "STATE_CODE:", with: "")
    }

    private func formatLongDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = locale
        formatter.timeZone = TimeZone.current
        formatter.setLocalizedDateFormatFromTemplate("MMMM d")
        return formatter.string(from: date)
    }

    private static let isoFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let fallbackPresidentialPrimaryISO = "2028-03-07"

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

    private static func isoDate(from iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        return isoFormatter.date(from: iso)
    }

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

    private func displayText(from rawValue: String?, fallbackDate: Date?) -> String {
        let trimmed = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if let parsedDate = Self.isoDate(from: trimmed) {
            return formatLongDate(parsedDate)
        }
        if !trimmed.isEmpty {
            return trimmed
        }
        if let fallbackDate {
            return formatLongDate(fallbackDate)
        }
        return l("app.guide.not_listed_dataset", "Not listed in dataset")
    }
}

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
}

private struct ElectionGuideInfoCard: Identifiable {
    let id = UUID()
    let title: String
    let body: String
}

struct NYCMayoralElectionView_Previews: PreviewProvider {
    static var previews: some View {
        NYCMayoralElectionView()
    }
}
