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
    let slug: String?
    let title: String
    let category: String?
    let targetChambers: [String]
    let primaryAsk: String?
    let summary: String
    let vehicleLabel: String?
    let actionSentence: String?
    let relatedBills: [String]
    let repRelevance: [String]
    let templateAsks: [CivicAsk]
    let liveScript: String
    let voicemailScript: String
    let supporterVariant: String?
    let undecidedVariant: String?
    let stafferVariant: String?
    let voicemailFooter: String?
    let placeholders: [String]
    let tags: [String]
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id = "issue_id"
        case slug
        case title
        case category
        case targetChambers = "target_chambers"
        case primaryAsk = "primary_ask"
        case summary
        case vehicleLabel = "vehicle_label"
        case actionSentence = "action_sentence"
        case relatedBills = "related_bills"
        case repRelevance = "rep_relevance"
        case templateAsks = "template_asks"
        case liveScript = "live_script"
        case voicemailScript = "voicemail_script"
        case supporterVariant = "supporter_variant"
        case undecidedVariant = "undecided_variant"
        case stafferVariant = "staffer_variant"
        case voicemailFooter = "voicemail_footer"
        case placeholders
        case tags
        case updatedAt = "updated_at"
    }

    private enum LegacyDateCodingKeys: String, CodingKey {
        case createdAt = "created_at"
    }

    init(
        id: String,
        slug: String? = nil,
        title: String,
        category: String? = nil,
        targetChambers: [String] = [],
        primaryAsk: String? = nil,
        summary: String,
        vehicleLabel: String? = nil,
        actionSentence: String? = nil,
        relatedBills: [String],
        repRelevance: [String],
        templateAsks: [CivicAsk],
        liveScript: String,
        voicemailScript: String,
        supporterVariant: String? = nil,
        undecidedVariant: String? = nil,
        stafferVariant: String? = nil,
        voicemailFooter: String? = nil,
        placeholders: [String] = [],
        tags: [String] = [],
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.slug = slug
        self.title = title
        self.category = category
        self.targetChambers = targetChambers
        self.primaryAsk = primaryAsk
        self.summary = summary
        self.vehicleLabel = vehicleLabel
        self.actionSentence = actionSentence
        self.relatedBills = relatedBills
        self.repRelevance = repRelevance
        self.templateAsks = templateAsks
        self.liveScript = liveScript
        self.voicemailScript = voicemailScript
        self.supporterVariant = supporterVariant
        self.undecidedVariant = undecidedVariant
        self.stafferVariant = stafferVariant
        self.voicemailFooter = voicemailFooter
        self.placeholders = placeholders
        self.tags = tags
        self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        slug = try container.decodeIfPresent(String.self, forKey: .slug)
        title = try container.decode(String.self, forKey: .title)
        category = try container.decodeIfPresent(String.self, forKey: .category)
        targetChambers = try container.decodeIfPresent([String].self, forKey: .targetChambers) ?? []
        primaryAsk = try container.decodeIfPresent(String.self, forKey: .primaryAsk)
        summary = try container.decode(String.self, forKey: .summary)
        vehicleLabel = try container.decodeIfPresent(String.self, forKey: .vehicleLabel)
        actionSentence = try container.decodeIfPresent(String.self, forKey: .actionSentence)
        relatedBills = try container.decodeIfPresent([String].self, forKey: .relatedBills) ?? []
        repRelevance = try container.decodeIfPresent([String].self, forKey: .repRelevance) ?? []
        templateAsks = try container.decodeIfPresent([CivicAsk].self, forKey: .templateAsks) ?? []
        liveScript = try container.decode(String.self, forKey: .liveScript)
        voicemailScript = try container.decode(String.self, forKey: .voicemailScript)
        supporterVariant = try container.decodeIfPresent(String.self, forKey: .supporterVariant)
        undecidedVariant = try container.decodeIfPresent(String.self, forKey: .undecidedVariant)
        stafferVariant = try container.decodeIfPresent(String.self, forKey: .stafferVariant)
        voicemailFooter = try container.decodeIfPresent(String.self, forKey: .voicemailFooter)
        placeholders = try container.decodeIfPresent([String].self, forKey: .placeholders) ?? []
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
        updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAt)
            ?? {
                let legacy = try decoder.container(keyedBy: LegacyDateCodingKeys.self)
                return try legacy.decodeIfPresent(Date.self, forKey: .createdAt)
            }()
    }

    var preferredAsk: CivicAsk? {
        if let primaryAsk, let mapped = CivicAsk(rawValue: primaryAsk) {
            return mapped
        }
        return templateAsks.first
    }
}

struct RemotePremadeScript: Identifiable, Decodable {
    let slug: String
    let title: String?
    let category: String?
    let issueArea: String?
    let summary: String?
    let backgroundSummary: String?
    let actionSentence: String?
    let liveScript: String?
    let voicemailScript: String?
    let vehicleLabel: String?
    let status: String?
    let displayOrder: Int?
    let targetChambers: [String]?
    let primaryAsk: String?
    let templateAsks: [RemotePremadeAsk]?
    let relatedBills: [RemotePremadeRelatedBill]?
    let tags: [String]?
    let updatedAt: String?

    var id: String { slug }

    enum CodingKeys: String, CodingKey {
        case slug, title, category, summary, status, tags
        case issueArea = "issue_area"
        case backgroundSummary = "background_summary"
        case actionSentence = "action_sentence"
        case liveScript = "live_script"
        case voicemailScript = "voicemail_script"
        case vehicleLabel = "vehicle_label"
        case displayOrder = "display_order"
        case targetChambers = "target_chambers"
        case primaryAsk = "primary_ask"
        case templateAsks = "template_asks"
        case relatedBills = "related_bills"
        case updatedAt = "updated_at"
    }
}

struct RemotePremadeAsk: Decodable {
    let ask: String
    let label: String?

    enum CodingKeys: String, CodingKey {
        case ask
        case askType = "ask_type"
        case actionType = "action_type"
        case primaryAsk = "primary_ask"
        case value
        case label
        case actionTargetDisplay = "action_target_display"
    }

    init(ask: String, label: String? = nil) {
        self.ask = ask
        self.label = label
    }

    init(from decoder: Decoder) throws {
        if let singleValue = try? decoder.singleValueContainer(),
           let askString = try? singleValue.decode(String.self) {
            ask = askString
            label = nil
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        var decodedAsk: String? = nil
        for key in [CodingKeys.ask, .askType, .actionType, .primaryAsk, .value] {
            if let value = try container.decodeIfPresent(String.self, forKey: key) {
                decodedAsk = value
                break
            }
        }
        ask = decodedAsk ?? ""

        var decodedLabel = try container.decodeIfPresent(String.self, forKey: .label)
        if decodedLabel == nil {
            decodedLabel = try container.decodeIfPresent(String.self, forKey: .actionTargetDisplay)
        }
        label = decodedLabel
    }
}

struct RemotePremadeRelatedBill: Decodable {
    let displayText: String

    enum CodingKeys: String, CodingKey {
        case title
        case vehicleID = "vehicle_id"
        case vehicleLabel = "vehicle_label"
        case billNumber = "bill_number"
        case actionTargetDisplay = "action_target_display"
    }

    init(displayText: String) {
        self.displayText = displayText
    }

    init(from decoder: Decoder) throws {
        if let singleValue = try? decoder.singleValueContainer(),
           let billString = try? singleValue.decode(String.self) {
            displayText = billString
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        let candidate = [
            try container.decodeIfPresent(String.self, forKey: .vehicleLabel),
            try container.decodeIfPresent(String.self, forKey: .title),
            try container.decodeIfPresent(String.self, forKey: .vehicleID),
            try container.decodeIfPresent(String.self, forKey: .billNumber),
            try container.decodeIfPresent(String.self, forKey: .actionTargetDisplay)
        ]
        .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
        .first(where: { !$0.isEmpty })

        displayText = candidate ?? ""
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

struct CivicCallScoreSnapshot: Codable, Sendable {
    let callScore: Int
    let activationPoints: Int
    let recencyPoints: Int
    let consistencyPoints: Int
    let breadthPoints: Int
    let momentumPoints: Int
    let tierName: String
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case callScore = "call_score"
        case activationPoints = "activation_points"
        case recencyPoints = "recency_points"
        case consistencyPoints = "consistency_points"
        case breadthPoints = "breadth_points"
        case momentumPoints = "momentum_points"
        case tierName = "tier_name"
        case updatedAt = "updated_at"
    }
}

struct CivicCallScoreSummary: Codable, Sendable {
    let callScore: Int
    let tierName: String
    let explanation: String
    let updatedAt: Date
    let enabled: Bool?

    enum CodingKeys: String, CodingKey {
        case callScore = "call_score"
        case tierName = "tier_name"
        case explanation
        case updatedAt = "updated_at"
        case enabled
    }
}

struct CivicCallScoreComponents: Codable, Sendable {
    let activationPoints: Int
    let recencyPoints: Int
    let consistencyPoints: Int
    let breadthPoints: Int
    let momentumPoints: Int

    enum CodingKeys: String, CodingKey {
        case activationPoints = "activation_points"
        case recencyPoints = "recency_points"
        case consistencyPoints = "consistency_points"
        case breadthPoints = "breadth_points"
        case momentumPoints = "momentum_points"
    }
}

struct CivicCallScoreBreakdown: Codable, Sendable {
    let callScore: Int
    let tierName: String
    let components: CivicCallScoreComponents
    let maxima: CivicCallScoreComponents
    let updatedAt: Date
    let enabled: Bool?

    enum CodingKeys: String, CodingKey {
        case callScore = "call_score"
        case tierName = "tier_name"
        case components
        case maxima
        case updatedAt = "updated_at"
        case enabled
    }
}

struct CivicCallScoreHistoryItem: Identifiable, Codable, Sendable {
    let id: String
    let officeID: String
    let issueID: String?
    let completedConfirmedAt: Date
    let scoringEligible: Bool
    let scoringIneligibilityReason: String?

    enum CodingKeys: String, CodingKey {
        case id = "call_event_id"
        case officeID = "office_id"
        case issueID = "issue_id"
        case completedConfirmedAt = "completed_confirmed_at"
        case scoringEligible = "scoring_eligible_boolean"
        case scoringIneligibilityReason = "scoring_ineligibility_reason"
    }
}

struct CivicCallScoreHistoryResponse: Codable, Sendable {
    let history: [CivicCallScoreHistoryItem]
}

struct CivicCallLaunchResponse: Codable, Sendable {
    let ok: Bool
    let launchEventID: String
    let launchedAt: Date
    let callScoreEnabled: Bool?

    enum CodingKeys: String, CodingKey {
        case ok
        case launchEventID = "launch_event_id"
        case launchedAt = "launched_at"
        case callScoreEnabled = "call_score_enabled"
    }
}

struct CivicCallCompletionResponse: Codable, Sendable {
    let ok: Bool
    let launchEventID: String
    let callLogged: Bool
    let callEventID: String?
    let scoringEligible: Bool?
    let scoringIneligibilityReason: String?
    let callScoreSnapshot: CivicCallScoreSnapshot?
    let changedComponents: [String]
    let baselineCrossed: Bool
    let tierChanged: Bool

    enum CodingKeys: String, CodingKey {
        case ok
        case launchEventID = "launch_event_id"
        case callLogged = "call_logged"
        case callEventID = "call_event_id"
        case scoringEligible = "scoring_eligible_boolean"
        case scoringIneligibilityReason = "scoring_ineligibility_reason"
        case callScoreSnapshot = "call_score_snapshot"
        case changedComponents = "changed_components"
        case baselineCrossed = "baseline_crossed"
        case tierChanged = "tier_changed"
    }
}

struct CivicLeaderboardEntry: Identifiable, Codable, Sendable {
    var id: String { userAlias + "-\(rank)" }
    let userAlias: String
    let eligibleVerifiedCallCount: Int
    let uniqueOfficeCount: Int
    let rank: Int

    enum CodingKeys: String, CodingKey {
        case userAlias = "user_alias"
        case legacyUserID = "user_id"
        case eligibleVerifiedCallCount = "eligible_verified_call_count"
        case uniqueOfficeCount = "unique_office_count"
        case rank
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let alias = try container.decodeIfPresent(String.self, forKey: .userAlias),
           !alias.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            userAlias = alias
        } else {
            userAlias = try container.decode(String.self, forKey: .legacyUserID)
        }
        eligibleVerifiedCallCount = try container.decode(Int.self, forKey: .eligibleVerifiedCallCount)
        uniqueOfficeCount = try container.decode(Int.self, forKey: .uniqueOfficeCount)
        rank = try container.decode(Int.self, forKey: .rank)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(userAlias, forKey: .userAlias)
        try container.encode(eligibleVerifiedCallCount, forKey: .eligibleVerifiedCallCount)
        try container.encode(uniqueOfficeCount, forKey: .uniqueOfficeCount)
        try container.encode(rank, forKey: .rank)
    }
}

struct CivicLeaderboardResponse: Codable, Sendable {
    let periodType: String
    let periodStart: Date
    let entries: [CivicLeaderboardEntry]

    enum CodingKeys: String, CodingKey {
        case periodType = "period_type"
        case periodStart = "period_start"
        case entries
    }
}

struct CivicLeaderboardUserSummary: Codable, Sendable {
    let periodType: String
    let periodStart: Date
    let userID: String
    let eligibleVerifiedCallCount: Int
    let uniqueOfficeCount: Int
    let rank: Int?

    enum CodingKeys: String, CodingKey {
        case periodType = "period_type"
        case periodStart = "period_start"
        case userID = "user_id"
        case eligibleVerifiedCallCount = "eligible_verified_call_count"
        case uniqueOfficeCount = "unique_office_count"
        case rank
    }
}

struct CivicRepTarget: Identifiable {
    let slot: CivicRepSlot
    let official: Official

    var id: String { slot.rawValue }

    var displayTitle: String { slot.title }

    var officeType: String {
        let title = (official.officeTitle ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let resolved = title.isEmpty ? inferredOfficeType : title
        return normalizedOfficeType(resolved)
    }

    private var inferredOfficeType: String {
        let name = official.name
        let normalizedTitle = (official.officeTitle ?? "").lowercased()
        if normalizedTitle.contains("senator") { return "U.S. Senator" }
        if normalizedTitle.contains("representative") || normalizedTitle.contains("congress") {
            return "Representative"
        }
        if slot == .house { return "Representative" }
        if slot == .senate1 || slot == .senate2 { return "U.S. Senator" }
        return name
    }

    private func normalizedOfficeType(_ value: String) -> String {
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalized.contains("representative") || normalized.contains("congressman") || normalized.contains("congresswoman") {
            return "Representative"
        }
        return value
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
        case .assistant: return "Write a Call"
        case .examples: return "Browse Issues"
        case .civicScore: return "History"
        case .history: return "How calling works"
        }
    }
}
