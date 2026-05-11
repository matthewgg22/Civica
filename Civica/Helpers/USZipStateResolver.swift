import Foundation

// ZIP-prefix → US state code lookup. Copied from the VoteNow target
// (WeVote Information Page/Models/RepsProviders.swift) so the Civica
// target can resolve states without depending on VoteNow types.
// When CivicaDesignSystem gains a shared "Location" namespace, promote
// this into the package and have both apps consume it from there.

struct USZipStateResolver {
    private let ranges: [(ClosedRange<Int>, String)] = [
        (5...5, "NY"),
        (6...9, "PR"),
        (10...27, "MA"),
        (28...29, "RI"),
        (30...38, "NH"),
        (39...49, "ME"),
        (50...59, "VT"),
        (60...69, "CT"),
        (70...89, "NJ"),
        (100...149, "NY"),
        (150...196, "PA"),
        (197...199, "DE"),
        (200...205, "DC"),
        (206...219, "MD"),
        (220...246, "VA"),
        (247...268, "WV"),
        (270...289, "NC"),
        (290...299, "SC"),
        (300...319, "GA"),
        (320...349, "FL"),
        (350...369, "AL"),
        (370...385, "TN"),
        (386...397, "MS"),
        (398...399, "GA"),
        (400...427, "KY"),
        (430...459, "OH"),
        (460...479, "IN"),
        (480...499, "MI"),
        (500...528, "IA"),
        (530...549, "WI"),
        (550...567, "MN"),
        (570...577, "SD"),
        (580...588, "ND"),
        (590...599, "MT"),
        (600...629, "IL"),
        (630...658, "MO"),
        (660...679, "KS"),
        (680...693, "NE"),
        (700...714, "LA"),
        (716...729, "AR"),
        (730...749, "OK"),
        (750...799, "TX"),
        (800...816, "CO"),
        (820...831, "WY"),
        (832...838, "ID"),
        (840...847, "UT"),
        (850...865, "AZ"),
        (870...884, "NM"),
        (885...885, "TX"),
        (889...898, "NV"),
        (900...961, "CA"),
        (967...968, "HI"),
        (969...969, "GU"),
        (970...979, "OR"),
        (980...994, "WA"),
        (995...999, "AK"),
    ]

    func stateCode(for zip: String) -> String? {
        let normalized = String(zip.filter(\.isNumber).prefix(5))
        guard normalized.count == 5 else { return nil }

        if normalized.hasPrefix("008") { return "VI" }
        if normalized == "96799" { return "AS" }
        if normalized == "96950" || normalized == "96951" || normalized == "96952" { return "MP" }

        guard let prefix = Int(normalized.prefix(3)) else { return nil }
        for (range, stateCode) in ranges where range.contains(prefix) {
            return stateCode
        }
        return nil
    }
}

extension Notification.Name {
    // Posted from SNAPEntryView / SNAPEligibilityIntroView when the user
    // taps "Edit location." The VoteNow target listens for this and opens
    // its MyInfo panel; in the Civica app no listener exists yet, so the
    // post is a no-op until a Civica-side address editor is wired in.
    static let openMyInfoPanel = Notification.Name("openMyInfoPanel")
}
