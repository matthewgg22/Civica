import Foundation

enum ElectionGuideType: String, Codable {
    case midterm
    case presidential
    case local
    case unknown

    var displayName: String {
        switch self {
        case .midterm:
            return "Midterm"
        case .presidential:
            return "Presidential"
        case .local:
            return "Local"
        case .unknown:
            return "Election"
        }
    }
}

enum ElectionGuidePhase: String, Codable {
    case primary
    case runoff
    case general
    case special
    case unknown

    var displayName: String {
        switch self {
        case .primary:
            return "Primary"
        case .runoff:
            return "Runoff"
        case .general:
            return "General"
        case .special:
            return "Special"
        case .unknown:
            return "Election"
        }
    }
}

struct ElectionGuideContext {
    let stateCode: String
    let stateName: String
    let electionType: ElectionGuideType
    let phase: ElectionGuidePhase
    let electionDate: Date
    let party: PoliticalParty
    let zip: String?
}

struct ElectionGuideTopic: Identifiable, Hashable {
    let id: String
    let title: String
    let body: String
}

struct ElectionGuideContent {
    let title: String
    let summary: String
    let topics: [ElectionGuideTopic]
    let sourceLabel: String
}

protocol ElectionGuideContentProviding {
    func content(for context: ElectionGuideContext) -> ElectionGuideContent
}

struct ElectionGuideContextResolver {
    private struct StateMidtermElectionRecord: Codable {
        let state_name: String
        let state_code: String
        let primary_date: String?
        let primary_runoff_date: String?
        let general_election_date: String?
    }

    private struct EventCandidate {
        let type: ElectionGuideType
        let phase: ElectionGuidePhase
        let date: Date
    }

    private let bundle: Bundle
    private let zipResolver = USZipStateResolver()

    private static let stateNameToCode: [String: String] = [
        "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
        "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
        "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
        "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
        "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
        "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
        "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
        "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
        "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
        "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY"
    ]

    init(bundle: Bundle = .main) {
        self.bundle = bundle
    }

    func resolve(for plan: PlanViewModel, now: Date = Date()) -> ElectionGuideContext? {
        let recordsByState = loadMidtermRecordsByState()
        guard let stateCode = resolveStateCode(from: plan) else {
            return nil
        }

        let stateName = recordsByState[stateCode]?.state_name ?? stateCode
        let candidates = buildCandidates(for: stateCode, recordsByState: recordsByState)
        guard let next = selectNextCandidate(from: candidates, now: now) else {
            return nil
        }

        return ElectionGuideContext(
            stateCode: stateCode,
            stateName: stateName,
            electionType: next.type,
            phase: next.phase,
            electionDate: next.date,
            party: plan.selectedParty,
            zip: normalizedZip(plan.zip) ?? normalizedZip(plan.userAddress.zip)
        )
    }

    private func resolveStateCode(from plan: PlanViewModel) -> String? {
        if let zip = normalizedZip(plan.zip),
           let state = zipResolver.stateCode(for: zip) {
            return state
        }

        if let zip = normalizedZip(plan.userAddress.zip),
           let state = zipResolver.stateCode(for: zip) {
            return state
        }

        let stateField = plan.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines)
        if stateField.count == 2 {
            return stateField.uppercased()
        }
        return Self.stateNameToCode[stateField.lowercased()]
    }

    private func loadMidtermRecordsByState() -> [String: StateMidtermElectionRecord] {
        guard let url = bundle.url(forResource: "USMidterm2026ElectionDates", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([StateMidtermElectionRecord].self, from: data) else {
            return [:]
        }
        return Dictionary(uniqueKeysWithValues: decoded.map { ($0.state_code, $0) })
    }

    private func buildCandidates(
        for stateCode: String,
        recordsByState: [String: StateMidtermElectionRecord]
    ) -> [EventCandidate] {
        var candidates: [EventCandidate] = []

        if let record = recordsByState[stateCode] {
            if let primaryDate = dateFromISO(record.primary_date) {
                candidates.append(EventCandidate(type: .midterm, phase: .primary, date: primaryDate))
            }
            if let runoffDate = dateFromISO(record.primary_runoff_date) {
                candidates.append(EventCandidate(type: .midterm, phase: .runoff, date: runoffDate))
            }
            if let generalDate = dateFromISO(record.general_election_date) {
                candidates.append(EventCandidate(type: .midterm, phase: .general, date: generalDate))
            }
        }

        // Placeholder presidential timing for pre-integration testing.
        candidates.append(EventCandidate(type: .presidential, phase: .primary, date: Date.from("2028-03-15")))
        candidates.append(EventCandidate(type: .presidential, phase: .general, date: Date.from("2028-11-07")))

        return candidates
    }

    private func selectNextCandidate(from candidates: [EventCandidate], now: Date) -> EventCandidate? {
        let ordered = candidates.sorted { $0.date < $1.date }
        let startOfToday = Calendar.current.startOfDay(for: now)
        if let upcoming = ordered.first(where: { $0.date >= startOfToday }) {
            return upcoming
        }
        return ordered.last
    }

    private func normalizedZip(_ raw: String) -> String? {
        let zip = String(raw.filter(\.isNumber).prefix(5))
        return zip.count == 5 ? zip : nil
    }

    private func dateFromISO(_ iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        return Self.isoDateFormatter.date(from: iso)
    }

    private static let isoDateFormatter: DateFormatter = {
        let df = DateFormatter()
        df.calendar = Calendar(identifier: .gregorian)
        df.locale = Locale(identifier: "en_US_POSIX")
        df.timeZone = TimeZone(secondsFromGMT: 0)
        df.dateFormat = "yyyy-MM-dd"
        return df
    }()
}

struct ElectionGuideContentProvider: ElectionGuideContentProviding {
    private let bundleProvider: BundleElectionGuideContentProvider
    private let starterProvider = StarterElectionGuideContentProvider()

    init(bundle: Bundle = .main) {
        self.bundleProvider = BundleElectionGuideContentProvider(bundle: bundle)
    }

    func content(for context: ElectionGuideContext) -> ElectionGuideContent {
        bundleProvider.content(for: context) ?? starterProvider.content(for: context)
    }
}

private struct BundleElectionGuideContentProvider {
    private struct DatasetTopic: Codable {
        let id: String?
        let state_code: String?
        let election_type: String?
        let phase: String?
        let title: String
        let body: String
    }

    private let bundle: Bundle

    init(bundle: Bundle) {
        self.bundle = bundle
    }

    func content(for context: ElectionGuideContext) -> ElectionGuideContent? {
        guard let topics = loadTopics() else {
            return nil
        }

        let matchingTopics = topics.filter { topic in
            matchesState(topic.state_code, stateCode: context.stateCode) &&
            matchesDimension(topic.election_type, value: context.electionType.rawValue) &&
            matchesDimension(topic.phase, value: context.phase.rawValue)
        }

        guard !matchingTopics.isEmpty else {
            return nil
        }

        return ElectionGuideContent(
            title: title(for: context),
            summary: summary(for: context),
            topics: matchingTopics.enumerated().map { idx, topic in
                ElectionGuideTopic(
                    id: topic.id ?? "dataset-\(idx)-\(topic.title)",
                    title: topic.title,
                    body: topic.body
                )
            },
            sourceLabel: "ElectionGuideTopics.json"
        )
    }

    private func loadTopics() -> [DatasetTopic]? {
        guard let url = bundle.url(forResource: "ElectionGuideTopics", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([DatasetTopic].self, from: data) else {
            return nil
        }
        return decoded
    }

    private func matchesState(_ value: String?, stateCode: String) -> Bool {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return true
        }
        return value.uppercased() == "ALL" || value.uppercased() == stateCode
    }

    private func matchesDimension(_ value: String?, value target: String) -> Bool {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return true
        }
        return value.lowercased() == "all" || value.lowercased() == target.lowercased()
    }

    private func title(for context: ElectionGuideContext) -> String {
        let year = Calendar.current.component(.year, from: context.electionDate)
        return "\(year) \(context.electionType.displayName) - \(context.phase.displayName)"
    }

    private func summary(for context: ElectionGuideContext) -> String {
        "Based on your address, this guide is tailored for \(context.stateName)'s next \(context.phase.displayName.lowercased()) election."
    }
}

private struct StarterElectionGuideContentProvider {
    func content(for context: ElectionGuideContext) -> ElectionGuideContent {
        var topics: [ElectionGuideTopic] = []

        switch context.phase {
        case .primary:
            topics.append(ElectionGuideTopic(
                id: "what-is-primary",
                title: "What Is a Primary?",
                body: "A primary election decides which candidates move forward to the general election. Rules vary by state and party."
            ))
        case .runoff:
            topics.append(ElectionGuideTopic(
                id: "what-is-runoff",
                title: "What Is a Runoff?",
                body: "A runoff is a follow-up election when no candidate meets the required threshold in the first round."
            ))
        case .general:
            topics.append(ElectionGuideTopic(
                id: "what-is-general",
                title: "What Is a General Election?",
                body: "The general election is the final election where voters choose between candidates selected through primaries or other qualifying processes."
            ))
        default:
            topics.append(ElectionGuideTopic(
                id: "what-is-election",
                title: "What Election Is This?",
                body: "This guide is keyed to your next upcoming election based on your current address and ZIP."
            ))
        }

        if context.stateCode == "CA" && context.phase == .primary {
            topics.append(ElectionGuideTopic(
                id: "ca-jungle-primary",
                title: "What Is a Jungle Primary?",
                body: "California uses a top-two primary for many offices: all candidates appear on one ballot, and the top two finishers advance to the general election regardless of party."
            ))
        }

        if context.stateCode == "WA" && context.phase == .primary {
            topics.append(ElectionGuideTopic(
                id: "wa-top-two",
                title: "What Is a Top-Two Primary?",
                body: "Washington also uses a top-two style primary for many races, where all voters choose from all candidates and the top two advance."
            ))
        }

        if context.phase == .primary && context.party == .independent {
            topics.append(ElectionGuideTopic(
                id: "party-affiliation-impact",
                title: "How Party Affiliation Affects Primary Voting",
                body: "The Democrat and Republican parties are the two largest in the United States. In many states, primary ballot eligibility depends on your current party registration. Example: in a closed primary, a voter registered as Independent may not be able to vote in either the Democrat or Republican primary unless they change party registration before the state deadline."
            ))
        }

        return ElectionGuideContent(
            title: title(for: context),
            summary: summary(for: context),
            topics: topics,
            sourceLabel: "Starter content (pre-dataset)"
        )
    }

    private func title(for context: ElectionGuideContext) -> String {
        let year = Calendar.current.component(.year, from: context.electionDate)
        return "\(year) \(context.electionType.displayName) - \(context.phase.displayName)"
    }

    private func summary(for context: ElectionGuideContext) -> String {
        let partyLabel: String
        switch context.party {
        case .democrat:
            partyLabel = "Democrat"
        case .republican:
            partyLabel = "Republican"
        case .independent:
            partyLabel = "Independent/Unaffiliated"
        }

        return "Based on your ZIP/address, your next upcoming election is in \(context.stateName). Current party setting: \(partyLabel)."
    }
}
