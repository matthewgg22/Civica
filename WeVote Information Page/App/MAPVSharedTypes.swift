import Foundation

enum MAPVDisplayStatus: String, Codable, Hashable, CaseIterable {
    case scheduled
    case open
    case enRoute
    case closingSoon
    case closed
    case completed
    case missed
}

enum MAPVStatusColorToken: String, Codable, Hashable {
    case blue
    case green
    case orange
    case red
    case gray
    case indigo
}
