import SwiftUI

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

    @State private var planElection: Election?
    @State private var searchQuery: String = ""
    @State private var allElections: [Election] = []
    @State private var visibleElections: [Election] = []
    @State private var errorMessage: String?
    @State private var pendingFlagElection: Election?
    @State private var showFlagSubmittedAlert = false

    private let stateResolver = USZipStateResolver()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                PageHeader(title: "Election Timeline")

                searchCard

                if let errorMessage {
                    Text(errorMessage)
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.urgentCTA)
                }

                if visibleElections.isEmpty, errorMessage == nil {
                    Text("No upcoming elections found for that state yet.")
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.mutedText)
                }

                ForEach(Array(visibleElections.enumerated()), id: \.element.id) { index, election in
                    ElectionTimelineCardView(
                        stateLabel: stateName(for: election),
                        titleText: cardTitle(for: election),
                        subtitleText: cardSecondaryText(for: election),
                        electionDateText: Self.cardDateFormatter.string(from: election.electionDay),
                        badgeText: badgeText(for: election),
                        showPlanButton: index == 0,
                        canMakePlan: election.electionDay >= Calendar.current.startOfDay(for: Date()),
                        onPlan: { planElection = election },
                        onFlag: { handleFlagTap(for: election) }
                    )
                }
            }
            .padding(16)
        }
        .background(VoteNowColors.appBackground.ignoresSafeArea())
        .navigationTitle("Election Timeline")
        .sheet(item: $planElection) { _ in
            MultiStepFormView()
                .environmentObject(planVM)
        }
        .confirmationDialog(
            "Flag Election Listing",
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
            Button("Report Issue", role: .destructive) {
                submitElectionFlag()
            }
            Button("Cancel", role: .cancel) {
                pendingFlagElection = nil
            }
        } message: {
            Text("Report an issue with this election listing?")
        }
        .alert("Thanks for flagging", isPresented: $showFlagSubmittedAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("We will review this election entry.")
        }
        .onAppear {
            loadElectionsIfNeeded()
            seedSearchIfNeeded()
            applyFilter()
        }
        .onChange(of: searchQuery) { _ in
            applyFilter()
        }
        .onChange(of: planVM.zip) { _ in
            if searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                seedSearchIfNeeded()
                applyFilter()
            }
        }
    }

    private var searchCard: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(VoteNowColors.mutedText)

            TextField("Enter state, state code, or ZIP", text: $searchQuery)
                .font(.system(size: 17))
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .submitLabel(.search)

            if !searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Button {
                    searchQuery = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundColor(VoteNowColors.mutedText.opacity(0.70))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(VoteNowColors.surfaceWhite)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
        )
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

        return "Statewide"
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

    private func seedSearchIfNeeded() {
        guard searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        let stateText = planVM.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines)
        if !stateText.isEmpty {
            searchQuery = stateText
            return
        }

        let zip = String(planVM.zip.filter(\.isNumber).prefix(5))
        if zip.count == 5 {
            searchQuery = zip
        }
    }

    private func applyFilter() {
        guard !allElections.isEmpty else {
            visibleElections = []
            planVM.upcomingElections = []
            return
        }

        errorMessage = nil

        let trimmed = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        let targetStateCodes = resolveStateCodes(from: trimmed)

        guard !targetStateCodes.isEmpty else {
            visibleElections = []
            planVM.upcomingElections = []
            if !trimmed.isEmpty {
                errorMessage = "No matching U.S. state found for \"\(trimmed)\"."
            }
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
            return resolveStateCodes(from: entered)
        }

        if let zipState = stateResolver.stateCode(for: trimmed) {
            return [zipState]
        }

        if trimmed.count == 2 {
            return [trimmed.uppercased()]
        }

        let lower = trimmed.lowercased()
        if let exact = Self.stateCodeByName[lower] {
            return [exact]
        }

        let partialMatches = Self.stateCodeByName
            .filter { $0.key.contains(lower) }
            .map { $0.value }

        return Set(partialMatches)
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
            let name = "\(stateName) 2026 Midterm"

            func appendElection(
                subtitle: String,
                electionDateISO: String?,
                registrationISO: String?,
                earlyVotingISO: String?,
                sourceURL: String?
            ) {
                guard let electionDate = isoDate(from: electionDateISO) else { return }
                let registrationDate = isoDate(from: registrationISO)
                    ?? Calendar.current.date(byAdding: .day, value: -30, to: electionDate)
                    ?? electionDate
                let earlyVotingDate = isoDate(from: earlyVotingISO)
                    ?? Calendar.current.date(byAdding: .day, value: -14, to: electionDate)
                    ?? electionDate

                elections.append(
                    Election(
                        name: name,
                        subtitle: subtitle,
                        registrationDeadline: registrationDate,
                        startDate: earlyVotingDate,
                        electionDay: electionDate,
                        earlyVotingText: nil,
                        registrationNotes: record.registration_notes,
                        jurisdictionLevel: "statewide",
                        jurisdictionName: stateName,
                        visibility: "public",
                        flags: ["STATE_CODE:\(stateCode)"],
                        matchConfidence: nil,
                        sourceUrl: sourceURL
                    )
                )
            }

            appendElection(
                subtitle: "Primary Election",
                electionDateISO: record.primary_date,
                registrationISO: record.registration_deadline_primary,
                earlyVotingISO: record.early_voting_primary,
                sourceURL: record.primary_source
            )

            appendElection(
                subtitle: "Primary Runoff Election",
                electionDateISO: record.primary_runoff_date,
                registrationISO: record.registration_deadline_primary,
                earlyVotingISO: record.early_voting_primary_runoff ?? record.early_voting_primary,
                sourceURL: record.primary_source
            )

            appendElection(
                subtitle: "General Election",
                electionDateISO: record.general_election_date,
                registrationISO: record.registration_deadline_general,
                earlyVotingISO: record.early_voting_general,
                sourceURL: record.registration_source
            )
        }

        return elections
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
        formatter.setLocalizedDateFormatFromTemplate("EEE, MMM d, yyyy")
        formatter.timeStyle = .none
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
}

struct ElectionTimelineView_Previews: PreviewProvider {
    static var previews: some View {
        ElectionTimelineView()
            .environmentObject(PlanViewModel())
    }
}
