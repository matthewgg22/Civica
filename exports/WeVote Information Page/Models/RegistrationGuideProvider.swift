import Foundation

private let voterRegistrationPortalURLByStateCode: [String: String] = [
    "AL": "https://voterinfo.sos.alabama.gov/",
    "AK": "https://myvoterinformation.alaska.gov/",
    "AZ": "https://my.arizona.vote/",
    "AR": "https://www.voterview.ar-nova.org/VoterView/",
    "CA": "https://voterstatus.sos.ca.gov/",
    "CO": "https://www.sos.state.co.us/voter/pages/pub/olvr/verifyNewVoter.xhtml",
    "CT": "https://voterregistration.ct.gov/OLVR/",
    "DE": "https://ivote.de.gov/VoterView/registrant/search",
    "FL": "https://registration.elections.myflorida.com/CheckVoterStatus",
    "GA": "https://mvp.sos.ga.gov/s/",
    "HI": "https://olvr.hawaii.gov/register.aspx",
    "ID": "https://elections.sos.idaho.gov/ElectionLink/ElectionLink/VoterSearch.aspx",
    "IL": "https://ova.elections.il.gov",
    "IN": "https://indianavoters.in.gov/",
    "IA": "https://sos.iowa.gov/elections/voterinformation/voterregistration.html",
    "KS": "https://myvoteinfo.voteks.org/VoterView",
    "KY": "https://vrsws.sos.ky.gov/ovrweb/",
    "LA": "https://voterportal.sos.la.gov/Home/VoterLogin",
    "ME": "https://www.maine.gov/portal/government/edemocracy/voter_lookup.php",
    "MD": "https://voterservices.elections.maryland.gov/votersearch",
    "MA": "https://www.sec.state.ma.us/OVR/Pages/CheckEligibility.aspx",
    "MI": "https://mvic.sos.state.mi.us/RegisterVoter",
    "MN": "https://mnvotes.sos.mn.us/VoterRegistration/index",
    "MS": "https://www.sos.ms.gov/Elections-Voting/Pages/Register.aspx",
    "MO": "https://s1.sos.mo.gov/elections/goVoteMissouri/start",
    "MT": "https://votemt.gov/",
    "NE": "https://www.votercheck.necvr.ne.gov/voterview",
    "NV": "https://www.nvsos.gov/sosvoterservices/registration/Step0.aspx",
    "NH": "https://app.sos.nh.gov/Public/RegistryOfDeeds?p=Elections",
    "NJ": "https://voter.svrs.nj.gov/registration-check",
    "NM": "https://voterportal.servis.sos.state.nm.us/WhereToVote.aspx",
    "NY": "https://voterlookup.elections.ny.gov/",
    "NC": "https://vt.ncsbe.gov/reglkup/",
    "ND": "https://vip.sos.nd.gov/",
    "OH": "https://olvr.ohiosos.gov/",
    "OK": "https://okvoterportal.okelections.us/",
    "OR": "https://secure.sos.state.or.us/orestar/vr/showVoterSearch.do",
    "PA": "https://www.pavoterservices.pa.gov/pages/voterregistrationstatus.aspx",
    "RI": "https://vote.sos.ri.gov/Home/UpdateVoterRecord",
    "SC": "https://info.scvotes.sc.gov/eng/voterinquiry/VoterInformationRequest.aspx",
    "SD": "https://vip.sdsos.gov/",
    "TN": "https://tnmap.tn.gov/voterlookup/",
    "TX": "https://teamrv-mvp.sos.texas.gov/MVP/mvp.do",
    "UT": "https://votesearch.utah.gov/",
    "VT": "https://mvp.vermont.gov/",
    "VA": "https://www.elections.virginia.gov/citizen-portal/",
    "WA": "https://voter.votewa.gov/",
    "WV": "https://services.sos.wv.gov/Elections/Voter/",
    "WI": "https://myvote.wi.gov/",
    "WY": "https://sos.wyo.gov/Elections/Docs/WYCountyClerks_AbsRequest_VRChange.pdf",
    "GU": "https://gec.guam.gov/registering-to-vote/",
    "PR": "https://www.ceepur.org/ere/"
]

private func stateRegistrationURL(for stateCode: String) -> URL {
    if let portalURL = voterRegistrationPortalURLByStateCode[stateCode],
       let url = URL(string: portalURL) {
        return url
    }
    return URL(string: "https://www.vote.gov/")!
}

private func stateRegistrationLabel(for stateCode: String) -> String {
    voterRegistrationPortalURLByStateCode[stateCode] == nil
        ? "Open Registration Website"
        : "Check My Voter Registration"
}

struct RegistrationGuideTopic: Identifiable, Hashable {
    let id: String
    let title: String
    let body: String
}

struct RegistrationGuideContent {
    let title: String
    let summary: String
    let deadlineLabel: String
    let registrationDeadline: Date?
    let registrationNotes: String?
    let checkStatusURL: URL
    let checkStatusLabel: String
    let topics: [RegistrationGuideTopic]
    let sourceLabel: String
}

protocol RegistrationGuideContentProviding {
    func content(for context: ElectionGuideContext) -> RegistrationGuideContent
}

struct RegistrationGuideContentProvider: RegistrationGuideContentProviding {
    private let bundleProvider: BundleRegistrationGuideContentProvider
    private let starterProvider = StarterRegistrationGuideContentProvider()

    init(bundle: Bundle = .main) {
        self.bundleProvider = BundleRegistrationGuideContentProvider(bundle: bundle)
    }

    func content(for context: ElectionGuideContext) -> RegistrationGuideContent {
        if let bundled = bundleProvider.content(for: context) {
            return bundled
        }
        return starterProvider.content(for: context)
    }
}

private struct BundleRegistrationGuideContentProvider {
    private struct MidtermRecord: Codable {
        let state_name: String
        let state_code: String
        let registration_deadline_primary: String?
        let registration_deadline_general: String?
        let registration_notes: String?
        let registration_source: String?
    }

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

    func content(for context: ElectionGuideContext) -> RegistrationGuideContent? {
        let recordsByState = loadMidtermRecordsByState()
        guard let record = recordsByState[context.stateCode] else {
            return nil
        }

        let topics = loadTopics() ?? []
        let matchingTopics = topics.filter { topic in
            matchesState(topic.state_code, stateCode: context.stateCode) &&
            matchesDimension(topic.election_type, value: context.electionType.rawValue) &&
            matchesDimension(topic.phase, value: context.phase.rawValue)
        }

        let fallbackTopics = starterTopics(for: context)
        let resolvedTopics: [RegistrationGuideTopic]
        if matchingTopics.isEmpty {
            resolvedTopics = fallbackTopics
        } else {
            resolvedTopics = matchingTopics.enumerated().map { idx, topic in
                RegistrationGuideTopic(
                    id: topic.id ?? "dataset-registration-\(idx)-\(topic.title)",
                    title: topic.title,
                    body: topic.body
                )
            }
        }

        let (label, deadline) = resolveDeadline(for: context, record: record)
        let sourceLabel = record.registration_source ?? "USMidterm2026ElectionDates.json"
        return RegistrationGuideContent(
            title: title(for: context),
            summary: "Registration guidance for your upcoming \(context.phase.displayName.lowercased()) election in \(context.stateName).",
            deadlineLabel: label,
            registrationDeadline: deadline,
            registrationNotes: record.registration_notes,
            checkStatusURL: stateRegistrationURL(for: context.stateCode),
            checkStatusLabel: stateRegistrationLabel(for: context.stateCode),
            topics: resolvedTopics,
            sourceLabel: sourceLabel
        )
    }

    private func loadMidtermRecordsByState() -> [String: MidtermRecord] {
        guard let url = bundle.url(forResource: "USMidterm2026ElectionDates", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([MidtermRecord].self, from: data) else {
            return [:]
        }
        return Dictionary(uniqueKeysWithValues: decoded.map { ($0.state_code, $0) })
    }

    private func loadTopics() -> [DatasetTopic]? {
        guard let url = bundle.url(forResource: "RegistrationGuideTopics", withExtension: "json"),
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

    private func resolveDeadline(
        for context: ElectionGuideContext,
        record: MidtermRecord
    ) -> (String, Date?) {
        let primary = parseISODate(record.registration_deadline_primary)
        let general = parseISODate(record.registration_deadline_general)

        if context.electionType == .midterm {
            switch context.phase {
            case .primary, .runoff:
                return ("Registration Deadline (Primary)", primary)
            case .general:
                return ("Registration Deadline (General)", general)
            default:
                return ("Registration Deadline", primary ?? general)
            }
        }

        // Placeholder presidential logic prior to dedicated dataset integration.
        let fallback = Calendar.current.date(byAdding: .day, value: -30, to: context.electionDate)
        return ("Registration Deadline", fallback)
    }

    private func parseISODate(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        return Self.isoDateFormatter.date(from: value)
    }

    private func title(for context: ElectionGuideContext) -> String {
        let year = Calendar.current.component(.year, from: context.electionDate)
        return "Registration: \(year) \(context.electionType.displayName) - \(context.phase.displayName)"
    }

    private func starterTopics(for context: ElectionGuideContext) -> [RegistrationGuideTopic] {
        var topics: [RegistrationGuideTopic] = [
            RegistrationGuideTopic(
                id: "register-address",
                title: "Register At Your Current Address",
                body: "Use the address where you currently live. If you moved, submit an update before your next election."
            ),
            RegistrationGuideTopic(
                id: "registration-id",
                title: "Prepare Identification Details",
                body: "State registration systems typically ask for identifying details such as date of birth and a state ID or partial SSN."
            )
        ]

        if context.phase == .primary && context.party == .independent {
            topics.append(
                RegistrationGuideTopic(
                    id: "primary-party-check",
                    title: "Primary Ballot Eligibility",
                    body: "Primary participation can depend on party registration status. Verify your party setting before your state's change deadline."
                )
            )
        }

        topics.append(
            RegistrationGuideTopic(
                id: "check-status",
                title: "Confirm Before Election Day",
                body: "Re-check your registration status and polling assignment after any updates to make sure they are reflected."
            )
        )

        return topics
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

private struct StarterRegistrationGuideContentProvider {
    func content(for context: ElectionGuideContext) -> RegistrationGuideContent {
        let fallbackDeadline = Calendar.current.date(byAdding: .day, value: -30, to: context.electionDate)
        let topics: [RegistrationGuideTopic] = [
            RegistrationGuideTopic(
                id: "registration-basics",
                title: "What is Vote Registration?",
                body: "Voter registration confirms your eligibility and determines which ballot and districts apply to your address."
            ),
            RegistrationGuideTopic(
                id: "state-rules",
                title: "State Rules Vary",
                body: "Every state sets its own registration deadlines, ID rules, and update process. Always confirm your state's official requirements."
            ),
            RegistrationGuideTopic(
                id: "updates",
                title: "Update After Moving",
                body: "If your address or name changed, submit an update before the registration deadline to avoid issues at check-in."
            )
        ]

        return RegistrationGuideContent(
            title: "Registration: \(Calendar.current.component(.year, from: context.electionDate)) \(context.electionType.displayName) - \(context.phase.displayName)",
            summary: "Starter registration guidance is shown now. This screen is already wired for dataset-based state content.",
            deadlineLabel: "Registration Deadline",
            registrationDeadline: fallbackDeadline,
            registrationNotes: "Deadlines shown here are provisional until your registration dataset is connected.",
            checkStatusURL: stateRegistrationURL(for: context.stateCode),
            checkStatusLabel: stateRegistrationLabel(for: context.stateCode),
            topics: topics,
            sourceLabel: "Starter content (pre-dataset)"
        )
    }
}
