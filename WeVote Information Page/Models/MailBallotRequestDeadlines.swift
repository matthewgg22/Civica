import Foundation

struct MailBallotRequestDeadlines: Codable, Identifiable {
    var id: String { jurisdiction }

    let jurisdiction: String
    let methods: Methods
    let conventions: [String]?
    let sourceURL: String

    struct Methods: Codable {
        let inPerson: String?
        let byMail: String?
        let onlineEmail: String?

        enum CodingKeys: String, CodingKey {
            case inPerson = "in_person"
            case byMail = "by_mail"
            case onlineEmail = "online_email"
        }
    }

    enum CodingKeys: String, CodingKey {
        case jurisdiction
        case methods
        case conventions
        case sourceURL = "source_url"
    }
}
