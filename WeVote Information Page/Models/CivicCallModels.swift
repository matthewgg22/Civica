import Foundation

enum CivicAsk: String, CaseIterable, Codable, Identifiable, Sendable {
    case support
    case oppose
    case cosponsor
    case voteYes = "vote_yes"
    case voteNo = "vote_no"
    case seekOversight = "seek_oversight"
    case askPublicStatement = "ask_public_statement"
    case askAmendment = "ask_amendment"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .support: return "Support"
        case .oppose: return "Oppose"
        case .cosponsor: return "Cosponsor"
        case .voteYes: return "Vote yes"
        case .voteNo: return "Vote no"
        case .seekOversight: return "Seek oversight"
        case .askPublicStatement: return "Ask for public statement"
        case .askAmendment: return "Ask for amendment"
        }
    }

    var scriptPhrase: String {
        switch self {
        case .support: return "support"
        case .oppose: return "oppose"
        case .cosponsor: return "cosponsor"
        case .voteYes: return "vote yes on"
        case .voteNo: return "vote no on"
        case .seekOversight: return "seek oversight on"
        case .askPublicStatement: return "issue a public statement on"
        case .askAmendment: return "support an amendment on"
        }
    }
}

enum CivicRepSlot: String, CaseIterable, Codable, Identifiable, Sendable {
    case house
    case senate1 = "senate_1"
    case senate2 = "senate_2"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .house: return "House"
        case .senate1: return "Senator 1"
        case .senate2: return "Senator 2"
        }
    }
}

enum CivicRepFilter: String, CaseIterable, Identifiable, Codable {
    case all
    case house
    case senate1
    case senate2

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: return "All"
        case .house: return "House"
        case .senate1: return "Senator 1"
        case .senate2: return "Senator 2"
        }
    }

    var slot: CivicRepSlot? {
        switch self {
        case .all: return nil
        case .house: return .house
        case .senate1: return .senate1
        case .senate2: return .senate2
        }
    }
}

enum CivicCallOutcome: String, CaseIterable, Codable, Identifiable, Sendable {
    case unavailable
    case voicemail
    case stafferReached = "staffer_reached"
    case supportive
    case opposed
    case undecided
    case followUpRequested = "follow_up_requested"
    case other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .unavailable: return "Unavailable"
        case .voicemail: return "Voicemail"
        case .stafferReached: return "Staffer reached"
        case .supportive: return "Supportive"
        case .opposed: return "Opposed"
        case .undecided: return "Undecided"
        case .followUpRequested: return "Follow-up requested"
        case .other: return "Other"
        }
    }

    var inferredStafferPosition: String? {
        switch self {
        case .supportive: return "supportive"
        case .opposed: return "opposed"
        case .undecided: return "undecided"
        default: return nil
        }
    }
}

struct CivicResolvedEntities: Codable, Sendable {
    var bills: [String]
    var committees: [String]
    var agencies: [String]

    static let empty = CivicResolvedEntities(bills: [], committees: [], agencies: [])
}

struct CivicCallBrief: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let repID: String
    let repName: String
    let officeType: String
    let primaryPhoneNumber: String
    let localOfficePhoneNumber: String?
    let relevanceBadges: [String]
    let relatedBills: [String]
    let relatedCommittees: [String]
    let liveScript: String
    let voicemailScript: String
    let talkingPoints: [String]
    let issueID: String
    let repSlot: CivicRepSlot?

    enum CodingKeys: String, CodingKey {
        case id = "brief_id"
        case repID = "rep_id"
        case repName = "rep_name"
        case officeType = "office_type"
        case primaryPhoneNumber = "primary_phone_number"
        case localOfficePhoneNumber = "local_office_phone_number"
        case relevanceBadges = "relevance_badges"
        case relatedBills = "related_bills"
        case relatedCommittees = "related_committees"
        case liveScript = "live_script"
        case voicemailScript = "voicemail_script"
        case talkingPoints = "talking_points"
        case issueID = "issue_id"
        case repSlot = "rep_slot"
    }
}

struct CivicIssueResolutionResponse: Codable, Sendable {
    let issueID: String
    let issueTitle: String
    let issueSummary: String
    let resolvedEntities: CivicResolvedEntities
    let callBriefs: [CivicCallBrief]

    enum CodingKeys: String, CodingKey {
        case issueID = "issue_id"
        case issueTitle = "issue_title"
        case issueSummary = "issue_summary"
        case resolvedEntities = "resolved_entities"
        case callBriefs = "call_briefs"
    }
}

struct CivicExampleIssueCard: Identifiable, Codable, Sendable {
    let id: String
    let title: String
    let summary: String
    let relatedBills: [String]
    let repRelevance: [String]
    let templateAsks: [CivicAsk]
    let liveScript: String
    let voicemailScript: String

    enum CodingKeys: String, CodingKey {
        case id = "issue_id"
        case title
        case summary
        case relatedBills = "related_bills"
        case repRelevance = "rep_relevance"
        case templateAsks = "template_asks"
        case liveScript = "live_script"
        case voicemailScript = "voicemail_script"
    }
}

struct CivicCallLogRecord: Identifiable, Codable, Sendable {
    let id: String
    let createdAt: Date
    let repID: String
    let repName: String
    let issueID: String
    let issueTitle: String
    let briefID: String
    let outcome: CivicCallOutcome
    let stafferPosition: String?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case id = "log_id"
        case createdAt = "created_at"
        case repID = "rep_id"
        case repName = "rep_name"
        case issueID = "issue_id"
        case issueTitle = "issue_title"
        case briefID = "brief_id"
        case outcome
        case stafferPosition = "staffer_position"
        case notes
    }
}

struct CivicHistoryGroup: Identifiable, Codable, Sendable {
    let id: String
    let issueID: String
    let issueTitle: String
    let issueSummary: String
    let date: Date
    let briefs: [CivicCallBrief]
    let logs: [CivicCallLogRecord]

    enum CodingKeys: String, CodingKey {
        case id
        case issueID = "issue_id"
        case issueTitle = "issue_title"
        case issueSummary = "issue_summary"
        case date
        case briefs
        case logs
    }
}

struct CivicRepTarget: Identifiable {
    let slot: CivicRepSlot
    let official: Official

    var id: String { slot.rawValue }

    var displayTitle: String { slot.title }

    var officeType: String {
        let title = (official.officeTitle ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return title.isEmpty ? inferredOfficeType : title
    }

    private var inferredOfficeType: String {
        let name = official.name
        let normalizedTitle = (official.officeTitle ?? "").lowercased()
        if normalizedTitle.contains("senator") { return "U.S. Senator" }
        if normalizedTitle.contains("representative") || normalizedTitle.contains("congress") {
            return "U.S. Representative"
        }
        if slot == .house { return "U.S. Representative" }
        if slot == .senate1 || slot == .senate2 { return "U.S. Senator" }
        return name
    }
}

struct CivicLocalSnapshot: Codable, Sendable {
    var latestResolution: CivicIssueResolutionResponse?
    var history: [CivicHistoryGroup]
    var assistantDraft: CivicAssistantDraft?
    var updatedAt: Date
}

struct CivicAssistantDraft: Codable, Sendable {
    var selectedTab: CivicIssueCallTab
    var selectedRepFilter: CivicRepFilter
    var concernText: String
    var selectedAsk: CivicAsk?
    var optionalBillRef: String
    var activeBriefID: String?
}

enum CivicIssueCallTab: String, CaseIterable, Identifiable, Codable {
    case assistant
    case examples
    case civicScore
    case history

    var id: String { rawValue }

    var title: String {
        switch self {
        case .assistant: return "Assistant"
        case .examples: return "Examples"
        case .civicScore: return "Civic Score"
        case .history: return "History"
        }
    }
}
