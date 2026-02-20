import Foundation

struct RepCardContext: Identifiable {
    let repId: String
    let sectionTitle: String
    let level: OfficialLevel
    let official: Official

    var id: String { repId }

    init(sectionTitle: String, level: OfficialLevel, official: Official) {
        self.sectionTitle = sectionTitle
        self.level = level
        self.official = official
        self.repId = RepCardContext.makeRepID(sectionTitle: sectionTitle, official: official)
    }

    private static func makeRepID(sectionTitle: String, official: Official) -> String {
        let section = slug(sectionTitle)
        let name = slug(official.name)
        let division = slug(official.divisionId ?? "none")
        return "\(section)|\(division)|\(name)"
    }

    private static func slug(_ raw: String) -> String {
        raw
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }
}

enum GovHelpChatRole: String, Codable {
    case user
    case assistant
}

struct GovHelpConversationTurn: Codable {
    let role: GovHelpChatRole
    let content: String
}

struct GovHelpRepPayload: Codable {
    let repID: String
    let name: String
    let sectionTitle: String
    let level: String
    let party: String?
    let district: String?
    let officialPhone: String?
    let websiteURL: String?
    let contactFormURL: String?
    let reportingDestinationIDs: [String]

    enum CodingKeys: String, CodingKey {
        case repID = "repId"
        case name
        case sectionTitle = "officeLabel"
        case level
        case party
        case district
        case officialPhone = "phone"
        case websiteURL = "website"
        case contactFormURL
        case reportingDestinationIDs
    }

    private enum LegacyCodingKeys: String, CodingKey {
        case repID = "rep_id"
        case sectionTitle = "section_title"
        case officialPhone = "official_phone"
        case websiteURL = "website_url"
        case contactFormURL = "contact_form_url"
        case reportingDestinationIDs = "reporting_destination_ids"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(repID, forKey: .repID)
        try container.encode(name, forKey: .name)
        try container.encode(sectionTitle, forKey: .sectionTitle)
        try container.encode(level, forKey: .level)
        try container.encodeIfPresent(party, forKey: .party)
        try container.encodeIfPresent(district, forKey: .district)
        try container.encodeIfPresent(officialPhone, forKey: .officialPhone)
        try container.encodeIfPresent(websiteURL, forKey: .websiteURL)
        try container.encodeIfPresent(contactFormURL, forKey: .contactFormURL)
        try container.encode(reportingDestinationIDs, forKey: .reportingDestinationIDs)

        // Backward compatibility for older edge-function payload schemas.
        var legacy = encoder.container(keyedBy: LegacyCodingKeys.self)
        try legacy.encode(repID, forKey: .repID)
        try legacy.encode(sectionTitle, forKey: .sectionTitle)
        try legacy.encodeIfPresent(officialPhone, forKey: .officialPhone)
        try legacy.encodeIfPresent(websiteURL, forKey: .websiteURL)
        try legacy.encodeIfPresent(contactFormURL, forKey: .contactFormURL)
        try legacy.encode(reportingDestinationIDs, forKey: .reportingDestinationIDs)
    }
}

struct GovHelpReportingDestinationPayload: Codable {
    let id: String
    let label: String
    let url: String
}

struct GovHelpRequestPayload: Codable {
    let zip: String
    let userMessage: String
    let messages: [GovHelpConversationTurn]
    let conversation: [GovHelpConversationTurn]
    let reps: [GovHelpRepPayload]
    let reportingDestinations: [GovHelpReportingDestinationPayload]

    enum CodingKeys: String, CodingKey {
        case zip
        case userMessage = "user_message"
        case messages
        case conversation
        case reps
        case reportingDestinations = "reporting_destinations"
    }
}

struct GovHelpResponsePayload: Decodable {
    let assistantMessage: String
    let recommendedRepIDs: [String]
    let reportingDestinationIDs: [String]

    enum CodingKeys: String, CodingKey {
        case assistantMessage = "assistant_message"
        case recommendedRepIDs = "recommended_rep_ids"
        case reportingDestinationIDs = "reporting_destination_ids"
    }
}

struct GovHelpErrorPayload: Decodable {
    let error: String
    let detail: String?
}
