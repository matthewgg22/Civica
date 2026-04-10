import Foundation

struct FeedbackInsert: Encodable, Sendable {
    let userID: UUID?
    let email: String?
    let message: String
    let category: String?
    let rating: Int?
    let appVersion: String?
    let buildNumber: String?
    let platform: String?
    let deviceModel: String?
    let osVersion: String?
    let locale: String?

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case email
        case message
        case category
        case rating
        case appVersion = "app_version"
        case buildNumber = "build_number"
        case platform
        case deviceModel = "device_model"
        case osVersion = "os_version"
        case locale
    }
}
