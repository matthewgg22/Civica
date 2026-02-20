import Foundation
import CoreLocation

enum MAPVTravelMode: String, Codable, CaseIterable {
    case driving
    case transit
    case walking

    var mapsFlag: String {
        switch self {
        case .driving: return "d"
        case .transit: return "r"
        case .walking: return "w"
        }
    }
}

struct MAPVPlan: Codable, Identifiable, Equatable {
    var id: UUID = UUID()
    var electionTitle: String
    var electionDate: Date
    var pollingPlaceName: String
    var pollingPlaceAddress: String
    var pollingOpen: Date
    var pollingClose: Date
    var plannedArrival: Date
    var lat: Double?
    var lon: Double?
    var travelMode: MAPVTravelMode?
    var distanceMiles: Double?
    var etaMinutes: Int?
    var lastETAUpdatedAt: Date?
    var isEnRoute: Bool = false
    var isCompleted: Bool = false
    var completedAt: Date?
    var liveActivityEnabled: Bool = false
    var createdAt: Date = Date()
    var updatedAt: Date = Date()
    var missedArrivalGraceMinutes: Int = 30
    var votingMethodRawValue: String? = nil

    var coordinate: CLLocationCoordinate2D? {
        guard let lat, let lon else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    var mapsURL: URL? {
        if let lat, let lon {
            return URL(string: "http://maps.apple.com/?daddr=\(lat),\(lon)&dirflg=\((travelMode ?? .driving).mapsFlag)")
        }

        let trimmed = pollingPlaceAddress.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let encoded = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? trimmed
        return URL(string: "http://maps.apple.com/?daddr=\(encoded)&dirflg=\((travelMode ?? .driving).mapsFlag)")
    }

    var appDeepLinkURL: URL? {
        URL(string: "votenow://mapv")
    }

    static func fromWizard(
        electionTitle: String,
        electionDate: Date,
        selectedMethod: VotingMethod?,
        selectedPollingPlace: PollingPlace?,
        plannedArrival: Date,
        distanceETAString: String?,
        liveActivityEnabled: Bool,
        travelMode: MAPVTravelMode? = .driving
    ) -> MAPVPlan {
        let window = resolvePollingWindow(
            selectedMethod: selectedMethod,
            hoursText: selectedPollingPlace?.hours,
            on: plannedArrival
        )
        let metrics = parseDistanceAndETA(from: distanceETAString)

        return MAPVPlan(
            electionTitle: electionTitle,
            electionDate: electionDate,
            pollingPlaceName: selectedPollingPlace?.name ?? "Polling Place",
            pollingPlaceAddress: selectedPollingPlace?.address ?? "",
            pollingOpen: window.open,
            pollingClose: window.close,
            plannedArrival: clamp(plannedArrival, min: window.open, max: window.close),
            lat: selectedPollingPlace?.coordinate.latitude == 0 ? nil : selectedPollingPlace?.coordinate.latitude,
            lon: selectedPollingPlace?.coordinate.longitude == 0 ? nil : selectedPollingPlace?.coordinate.longitude,
            travelMode: travelMode,
            distanceMiles: metrics.distanceMiles,
            etaMinutes: metrics.etaMinutes,
            lastETAUpdatedAt: Date(),
            isEnRoute: false,
            isCompleted: false,
            completedAt: nil,
            liveActivityEnabled: liveActivityEnabled,
            createdAt: Date(),
            updatedAt: Date(),
            missedArrivalGraceMinutes: 30,
            votingMethodRawValue: backendVotingMethodRawValue(from: selectedMethod)
        )
    }

    static func backendVotingMethodRawValue(from selectedMethod: VotingMethod?) -> String {
        switch selectedMethod {
        case .early:
            return "early_vote"
        case .mail:
            return "vote_by_mail"
        case .election, nil:
            return "election_day"
        }
    }

    static func parseDistanceAndETA(from value: String?) -> (distanceMiles: Double?, etaMinutes: Int?) {
        guard let value, !value.isEmpty else { return (nil, nil) }

        let pattern = #"([0-9]+(?:\.[0-9]+)?)\s*mi|ETA\s*([0-9]+)\s*min"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return (nil, nil)
        }

        let range = NSRange(value.startIndex..<value.endIndex, in: value)
        let matches = regex.matches(in: value, options: [], range: range)

        var miles: Double?
        var eta: Int?

        for match in matches {
            if let milesRange = Range(match.range(at: 1), in: value) {
                miles = Double(value[milesRange])
            }
            if let etaRange = Range(match.range(at: 2), in: value) {
                eta = Int(value[etaRange])
            }
        }

        return (miles, eta)
    }

    static func resolvePollingWindow(
        selectedMethod: VotingMethod?,
        hoursText: String?,
        on day: Date,
        calendar: Calendar = .current
    ) -> (open: Date, close: Date) {
        let minuteWindow: (open: Int, close: Int) = {
            if let parsed = parseHourWindow(from: hoursText) {
                return parsed
            }
            switch selectedMethod {
            case .election: return (6 * 60, 21 * 60)
            case .early: return (8 * 60, 20 * 60)
            case .mail: return (0, 23 * 60 + 59)
            case nil: return (6 * 60, 21 * 60)
            }
        }()

        let startOfDay = calendar.startOfDay(for: day)
        let open = calendar.date(byAdding: .minute, value: minuteWindow.open, to: startOfDay) ?? day
        let closeCandidate = calendar.date(byAdding: .minute, value: minuteWindow.close, to: startOfDay) ?? day
        let close = closeCandidate > open
            ? closeCandidate
            : calendar.date(byAdding: .day, value: 1, to: closeCandidate) ?? closeCandidate

        return (open, close)
    }

    private static func parseHourWindow(from hoursText: String?) -> (open: Int, close: Int)? {
        guard let hoursText, !hoursText.isEmpty, hoursText != "--" else { return nil }

        let pattern = #"(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(hoursText.startIndex..<hoursText.endIndex, in: hoursText)
        let matches = regex.matches(in: hoursText, options: [], range: range)
        guard matches.count >= 2 else { return nil }

        func toMinute(_ match: NSTextCheckingResult) -> Int? {
            guard
                let hourRange = Range(match.range(at: 1), in: hoursText),
                let meridiemRange = Range(match.range(at: 3), in: hoursText)
            else { return nil }

            let hour = Int(hoursText[hourRange]) ?? 0
            let minute: Int = {
                guard let minuteRange = Range(match.range(at: 2), in: hoursText) else { return 0 }
                return Int(hoursText[minuteRange]) ?? 0
            }()
            let meridiem = hoursText[meridiemRange].lowercased()

            var hour24 = hour % 12
            if meridiem == "pm" {
                hour24 += 12
            }
            return max(0, min(23, hour24)) * 60 + max(0, min(59, minute))
        }

        guard let open = toMinute(matches[0]), let close = toMinute(matches[1]) else {
            return nil
        }
        return (open, close)
    }
}

struct MAPVStatusPresentation: Hashable {
    let status: MAPVDisplayStatus
    let statusPillText: String
    let statusColorToken: MAPVStatusColorToken
    let primaryCountdownText: String
    let secondaryMetaText: String
    let progressNow: Double
    let progressPlan: Double
    let staleDate: Date?
    let relevanceScore: Double
}

enum MAPVStatusResolver {
    static let closingSoonMinutes = 60

    static func resolve(plan: MAPVPlan, now: Date = Date()) -> MAPVStatusPresentation {
        let status = deriveStatus(plan: plan, now: now)
        let colorToken = token(for: status)
        let progressNow = progress(at: now, open: plan.pollingOpen, close: plan.pollingClose)
        let progressPlan = progress(at: plan.plannedArrival, open: plan.pollingOpen, close: plan.pollingClose)

        let primaryText: String = {
            switch status {
            case .scheduled:
                return "Opens in \(durationText(plan.pollingOpen.timeIntervalSince(now)))"
            case .open, .enRoute, .closingSoon:
                return "Polls close in \(durationText(plan.pollingClose.timeIntervalSince(now)))"
            case .closed:
                return "Polls closed at \(timeText(plan.pollingClose))"
            case .completed:
                return "Marked as voted"
            case .missed:
                if now < plan.pollingClose {
                    return "Planned arrival passed"
                }
                return "Polls closed - plan missed"
            }
        }()

        let secondaryText: String = {
            switch (plan.distanceMiles, plan.etaMinutes) {
            case let (miles?, eta?):
                return String(format: "%.1f mi • ETA %d min", miles, eta)
            case let (miles?, nil):
                return String(format: "%.1f mi • Tap for ETA", miles)
            case let (nil, eta?):
                return "ETA \(eta) min"
            default:
                return plan.mapsURL == nil ? "View plan details" : ""
            }
        }()

        return MAPVStatusPresentation(
            status: status,
            statusPillText: pillText(for: status),
            statusColorToken: colorToken,
            primaryCountdownText: primaryText,
            secondaryMetaText: secondaryText,
            progressNow: progressNow,
            progressPlan: progressPlan,
            staleDate: nextBoundaryDate(for: plan, now: now),
            relevanceScore: relevance(for: status, plan: plan, now: now)
        )
    }

    static func deriveStatus(plan: MAPVPlan, now: Date) -> MAPVDisplayStatus {
        if plan.isCompleted {
            return .completed
        }

        if now >= plan.pollingClose {
            let minutesSinceClose = now.timeIntervalSince(plan.pollingClose) / 60
            if minutesSinceClose <= 15 {
                return .closed
            }
            return .missed
        }

        if now < plan.pollingOpen {
            return .scheduled
        }

        let missedBy = now.timeIntervalSince(plan.plannedArrival) / 60
        if missedBy > Double(max(plan.missedArrivalGraceMinutes, 1)) {
            return .missed
        }

        let closeMinutes = plan.pollingClose.timeIntervalSince(now) / 60
        if closeMinutes <= Double(closingSoonMinutes) {
            return .closingSoon
        }

        if plan.isEnRoute {
            return .enRoute
        }

        return .open
    }

    static func progress(at date: Date, open: Date, close: Date) -> Double {
        guard close > open else { return 0 }
        let total = close.timeIntervalSince(open)
        let elapsed = min(max(date.timeIntervalSince(open), 0), total)
        return elapsed / total
    }

    static func durationText(_ interval: TimeInterval) -> String {
        let clamped = max(0, Int(interval.rounded()))
        let hours = clamped / 3600
        let minutes = (clamped % 3600) / 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        return "\(minutes)m"
    }

    static func timeText(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private static func pillText(for status: MAPVDisplayStatus) -> String {
        switch status {
        case .scheduled: return "Plan Set"
        case .open: return "Polls Open"
        case .enRoute: return "Go Time"
        case .closingSoon: return "Closing Soon"
        case .closed: return "Polls Closed"
        case .completed: return "Voted"
        case .missed: return "Plan Missed"
        }
    }

    private static func token(for status: MAPVDisplayStatus) -> MAPVStatusColorToken {
        switch status {
        case .scheduled: return .blue
        case .open: return .green
        case .enRoute: return .indigo
        case .closingSoon: return .orange
        case .closed: return .gray
        case .completed: return .green
        case .missed: return .red
        }
    }

    private static func nextBoundaryDate(for plan: MAPVPlan, now: Date) -> Date? {
        let closingSoonBoundary = plan.pollingClose.addingTimeInterval(-Double(closingSoonMinutes) * 60)
        let missedBoundary = plan.plannedArrival.addingTimeInterval(Double(plan.missedArrivalGraceMinutes) * 60)
        let candidates = [
            plan.pollingOpen,
            closingSoonBoundary,
            missedBoundary,
            plan.plannedArrival,
            plan.pollingClose
        ]
            .filter { $0 > now }
            .sorted()

        return candidates.first
    }

    private static func relevance(for status: MAPVDisplayStatus, plan: MAPVPlan, now: Date) -> Double {
        switch status {
        case .completed:
            return 0.15
        case .missed:
            return 0.25
        case .closed:
            return 0.35
        case .scheduled:
            let untilOpen = plan.pollingOpen.timeIntervalSince(now)
            if untilOpen <= 60 * 60 { return 0.70 }
            if untilOpen <= 4 * 60 * 60 { return 0.60 }
            return 0.40
        case .open:
            return 0.78
        case .enRoute:
            return 0.95
        case .closingSoon:
            return 1.00
        }
    }
}

private func clamp(_ date: Date, min: Date, max: Date) -> Date {
    guard max > min else { return min }
    if date < min { return min }
    if date > max { return max }
    return date
}
