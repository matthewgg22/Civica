import Foundation
import ActivityKit

struct MAPVLiveActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var status: MAPVDisplayStatus
        var statusPillText: String
        var statusColorToken: MAPVStatusColorToken
        var primaryCountdownText: String
        var secondaryMetaText: String
        var now: Date
        var pollingOpen: Date
        var pollingClose: Date
        var plannedArrival: Date
        var nowProgress: Double
        var plannedProgress: Double
        var distanceMiles: Double?
        var etaMinutes: Int?
        var pollingPlaceShortName: String
        var deepLinkURL: String
        var directionsURL: String?
    }

    var planID: String
    var electionTitle: String
    var pollingPlaceName: String
    var pollingPlaceAddress: String
}
