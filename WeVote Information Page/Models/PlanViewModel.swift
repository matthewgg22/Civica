//
//
//
//  PlanViewModel.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/15/25.
//  Updated by ChatGPT on 05/28/25 (added distanceETA & computeETA via MapKit)
//

import Foundation
import MapKit  // for MKDirections

// MARK: – Models

enum PoliticalParty: String, Codable, CaseIterable {
    case democrat    = "Democrat"
    case independent = "Independent"
    case republican  = "Republican"
}

struct Address: Codable {
    var street: String = ""
    var city:   String = ""
    var state:  String = ""
    var zip:    String = ""
}

/// Holds whatever pieces make up “My Plan to Vote”
struct VotePlan {
    var method        : String? = nil
    var placeName     : String? = nil
    var placeAddress  : String? = nil
    var placeHours    : String? = nil
    var voteTime      : Date?   = nil
    var distanceETA   : String? = nil  // e.g. "2.3 mi • ETA 12 min"
}

enum SearchPrecision: String, CaseIterable, Identifiable {
    case address
    case zipOrCity

    var id: String { rawValue }

    var inputTitle: String {
        switch self {
        case .address:
            return "Address (recommended)"
        case .zipOrCity:
            return "ZIP/City (approximate)"
        }
    }
}

struct Election: Identifiable {
    var id: String {
        let reg = Int(registrationDeadline.timeIntervalSinceReferenceDate)
        let start = Int(startDate.timeIntervalSinceReferenceDate)
        let day = Int(electionDay.timeIntervalSinceReferenceDate)
        return "\(name)|\(subtitle)|\(reg)|\(start)|\(day)"
    }
    let name: String
    let subtitle: String
    let registrationDeadline: Date
    let startDate: Date
    let electionDay: Date
    let earlyVotingText: String?
    let registrationNotes: String?
    let jurisdictionLevel: String
    let jurisdictionName: String
    let visibility: String
    let flags: [String]
    let matchConfidence: Int?
    let sourceUrl: String?

    init(
        name: String,
        subtitle: String,
        registrationDeadline: Date,
        startDate: Date,
        electionDay: Date,
        earlyVotingText: String? = nil,
        registrationNotes: String? = nil,
        jurisdictionLevel: String = "statewide",
        jurisdictionName: String = "",
        visibility: String = "public",
        flags: [String] = [],
        matchConfidence: Int? = nil,
        sourceUrl: String? = nil
    ) {
        self.name = name
        self.subtitle = subtitle
        self.registrationDeadline = registrationDeadline
        self.startDate = startDate
        self.electionDay = electionDay
        self.earlyVotingText = earlyVotingText
        self.registrationNotes = registrationNotes
        self.jurisdictionLevel = jurisdictionLevel
        self.jurisdictionName = jurisdictionName
        self.visibility = visibility
        self.flags = flags
        self.matchConfidence = matchConfidence
        self.sourceUrl = sourceUrl
    }

    private var normalizedFlags: Set<String> {
        Set(flags.map { $0.uppercased() })
    }

    var isBucketRow: Bool {
        if normalizedFlags.contains("BUCKET_LOCAL_ELECTIONS_STATEWIDE") {
            return true
        }

        let searchableText = [
            name,
            subtitle,
            registrationNotes ?? ""
        ]
            .joined(separator: " ")
            .lowercased()

        let level = jurisdictionLevel.lowercased()
        let isStatewideBucketLevel = level == "statewide" || level == "statewide_bucket"
        return isStatewideBucketLevel && searchableText.contains("local elections")
    }

    var requiresFullAddress: Bool {
        let lowerLevel = jurisdictionLevel.lowercased()
        if ["city", "school_district", "special_district", "recall"].contains(lowerLevel) {
            return true
        }
        return normalizedFlags.contains("ZIP_FALSE_POSITIVE_RISK")
    }

    func isPublicResultEligible(for searchPrecision: SearchPrecision) -> Bool {
        guard visibility.lowercased() == "public", !isBucketRow else { return false }

        switch searchPrecision {
        case .address:
            return true
        case .zipOrCity:
            let lowerLevel = jurisdictionLevel.lowercased()
            if lowerLevel == "statewide" {
                return true
            }
            if lowerLevel == "county", let matchConfidence, matchConfidence >= 80 {
                return true
            }
            return false
        }
    }
}

private struct TimelineStateElectionRecord: Decodable {
    let state_name: String
    let state_code: String
    let primary_date: String?
    let primary_runoff_date: String?
    let general_election_date: String?
    let registration_deadline_primary: String?
    let registration_deadline_general: String?
    let early_voting_primary: String?
    let early_voting_primary_runoff: String?
    let early_voting_general: String?
}

// MARK: – ViewModel

final class PlanViewModel: ObservableObject {
    private enum StorageKeys {
        static let zip = "planvm.zip"
        static let userState = "planvm.userAddress.state"
        static let userZip = "planvm.userAddress.zip"
    }
    private let zipStateResolver = USZipStateResolver()

    // MARK: – User Info
    @Published var userAddress: Address = Address() {
        didSet {
            persistUserAddress()
            refreshUpcomingElectionsFromTimeline()
        }
    }
    @Published var selectedParty: PoliticalParty = .independent

    /// The user’s ZIP code for “My Reps” lookups
    @Published var zip: String = "" {
        didSet {
            UserDefaults.standard.set(zip, forKey: StorageKeys.zip)
            syncAddressFieldsFromZIPIfNeeded()
            refreshUpcomingElectionsFromTimeline()
        }
    }

    /// A legacy full-address string if you ever need it
    @Published var homeAddress: String = ""

    /// Upcoming elections to display
    @Published var upcomingElections: [Election] = []

    /// **Your Plan to Vote** container (method, place, time, ETA, etc.)
    @Published var plan = VotePlan()

    private static let timelineRecordsByState: [String: TimelineStateElectionRecord] = {
        guard
            let url = Bundle.main.url(forResource: "USMidterm2026ElectionDates", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let records = try? JSONDecoder().decode([TimelineStateElectionRecord].self, from: data)
        else {
            return [:]
        }

        return Dictionary(uniqueKeysWithValues: records.map { ($0.state_code.uppercased(), $0) })
    }()

    private static let timelineISODateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let stateCodeByName: [String: String] = [
        "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
        "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
        "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
        "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
        "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
        "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
        "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
        "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
        "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
        "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
        "district of columbia": "DC"
    ]

    init() {
        let savedZip = UserDefaults.standard.string(forKey: StorageKeys.zip) ?? ""
        let savedState = UserDefaults.standard.string(forKey: StorageKeys.userState) ?? ""
        let savedAddressZip = UserDefaults.standard.string(forKey: StorageKeys.userZip) ?? ""

        zip = savedZip
        userAddress = Address(
            street: "",
            city: "",
            state: savedState,
            zip: savedAddressZip.isEmpty ? savedZip : savedAddressZip
        )
        refreshUpcomingElectionsFromTimeline()
    }

    private func persistUserAddress() {
        UserDefaults.standard.set(userAddress.state, forKey: StorageKeys.userState)
        UserDefaults.standard.set(userAddress.zip, forKey: StorageKeys.userZip)
    }

    private func syncAddressFieldsFromZIPIfNeeded() {
        let normalizedZip = String(zip.filter(\.isNumber).prefix(5))
        guard normalizedZip.count == 5 else { return }

        var updatedAddress = userAddress
        var hasChanges = false

        if updatedAddress.zip != normalizedZip {
            updatedAddress.zip = normalizedZip
            hasChanges = true
        }

        if let inferredStateCode = zipStateResolver.stateCode(for: normalizedZip),
           updatedAddress.state != inferredStateCode {
            updatedAddress.state = inferredStateCode
            hasChanges = true
        }

        if hasChanges {
            userAddress = updatedAddress
        }
    }

    private func refreshUpcomingElectionsFromTimeline(referenceDate: Date = Date()) {
        guard
            let stateCode = resolvedTimelineStateCode(),
            let record = Self.timelineRecordsByState[stateCode]
        else {
            upcomingElections = []
            return
        }

        let calendar = Calendar.current
        let today = calendar.startOfDay(for: referenceDate)
        let all = buildTimelineElections(for: record)
        let upcoming = all
            .filter { calendar.startOfDay(for: $0.electionDay) >= today }
            .sorted {
                if $0.electionDay != $1.electionDay { return $0.electionDay < $1.electionDay }
                return $0.name < $1.name
            }

        upcomingElections = upcoming
    }

    private func resolvedTimelineStateCode() -> String? {
        let normalizedZIP = String(zip.filter(\.isNumber).prefix(5))
        if normalizedZIP.count == 5, let code = zipStateResolver.stateCode(for: normalizedZIP) {
            return code
        }

        let addressZIP = String(userAddress.zip.filter(\.isNumber).prefix(5))
        if addressZIP.count == 5, let code = zipStateResolver.stateCode(for: addressZIP) {
            return code
        }

        let rawState = userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !rawState.isEmpty else { return nil }
        if rawState.count == 2 {
            return rawState.uppercased()
        }
        return Self.stateCodeByName[rawState.lowercased()]
    }

    private func buildTimelineElections(for record: TimelineStateElectionRecord) -> [Election] {
        let stateName = record.state_name
        let midtermName = "\(stateName) 2026 Midterm"
        let presidentialName = "\(stateName) 2028 Presidential"
        var elections: [Election] = []

        appendTimelineElection(
            to: &elections,
            record: record,
            electionName: midtermName,
            subtitle: "Primary Election",
            electionISO: record.primary_date,
            registrationISO: record.registration_deadline_primary,
            earlyVotingISO: record.early_voting_primary
        )
        appendTimelineElection(
            to: &elections,
            record: record,
            electionName: midtermName,
            subtitle: "Primary Runoff Election",
            electionISO: record.primary_runoff_date,
            registrationISO: record.registration_deadline_primary,
            earlyVotingISO: record.early_voting_primary_runoff ?? record.early_voting_primary
        )
        appendTimelineElection(
            to: &elections,
            record: record,
            electionName: midtermName,
            subtitle: "General Election",
            electionISO: record.general_election_date,
            registrationISO: record.registration_deadline_general,
            earlyVotingISO: record.early_voting_general
        )
        appendTimelineElection(
            to: &elections,
            record: record,
            electionName: presidentialName,
            subtitle: "Presidential Primary Election",
            electionISO: shiftedISOYear(from: record.primary_date, toYear: 2028) ?? "2028-03-07",
            registrationISO: shiftedISOYear(from: record.registration_deadline_primary, toYear: 2028),
            earlyVotingISO: shiftedISOYear(from: record.early_voting_primary, toYear: 2028)
        )
        appendTimelineElection(
            to: &elections,
            record: record,
            electionName: presidentialName,
            subtitle: "Presidential General Election",
            electionISO: "2028-11-07",
            registrationISO: "2028-11-07",
            earlyVotingISO: nil
        )

        return elections
    }

    private func appendTimelineElection(
        to elections: inout [Election],
        record: TimelineStateElectionRecord,
        electionName: String,
        subtitle: String,
        electionISO: String?,
        registrationISO: String?,
        earlyVotingISO: String?
    ) {
        guard
            let electionISO,
            let electionDay = Self.timelineISODateFormatter.date(from: electionISO)
        else {
            return
        }

        let registration = (registrationISO.flatMap { Self.timelineISODateFormatter.date(from: $0) }) ?? electionDay
        let start = (earlyVotingISO.flatMap { Self.timelineISODateFormatter.date(from: $0) }) ?? electionDay
        let earlyVotingText: String? = {
            guard start < electionDay else { return nil }
            return "Starts " + Self.timelineISODateFormatter.string(from: start)
        }()

        elections.append(
            Election(
                name: electionName,
                subtitle: subtitle,
                registrationDeadline: registration,
                startDate: start,
                electionDay: electionDay,
                earlyVotingText: earlyVotingText,
                registrationNotes: nil,
                jurisdictionLevel: "statewide",
                jurisdictionName: record.state_name,
                visibility: "public",
                flags: [],
                matchConfidence: nil,
                sourceUrl: nil
            )
        )
    }

    private func shiftedISOYear(from sourceISO: String?, toYear: Int) -> String? {
        guard
            let sourceISO,
            let date = Self.timelineISODateFormatter.date(from: sourceISO)
        else {
            return nil
        }

        let calendar = Calendar(identifier: .gregorian)
        var components = calendar.dateComponents(in: TimeZone(secondsFromGMT: 0) ?? .current, from: date)
        components.year = toYear
        guard let shifted = calendar.date(from: components) else { return nil }
        return Self.timelineISODateFormatter.string(from: shifted)
    }

    // MARK: – Plan Helpers

    /// Save the pieces of a plan into the `plan` property
    func savePlan(
        method: VotingMethod?,
        place:  PollingPlace?,
        time:   Date,
        distanceETA: String? = nil
    ) {
        plan.method       = method?.rawValue
        plan.placeName    = place?.name
        plan.placeAddress = place?.address
        plan.placeHours   = place?.hours
        plan.voteTime     = time
        plan.distanceETA  = distanceETA
    }

    /// Computes “X.X mi • ETA Y min” and calls back on the main thread
    func computeETA(
        to destination: CLLocationCoordinate2D,
        completion: @escaping (String) -> Void
    ) {
        let request = MKDirections.Request()
        request.source = MKMapItem.forCurrentLocation()
        request.destination = MKMapItem(
            placemark: MKPlacemark(coordinate: destination)
        )
        request.transportType = .automobile
        request.requestsAlternateRoutes = false

        MKDirections(request: request).calculate { response, error in
            guard
                let route = response?.routes.first,
                error == nil
            else {
                DispatchQueue.main.async { completion("–") }
                return
            }

            // 1) Distance in miles
            let miles   = route.distance / 1609.34
            let mileStr = String(format: "%.1f mi", miles)

            // 2) ETA in minutes
            let minutes = Int(route.expectedTravelTime / 60)
            let etaStr  = "\(minutes) min"

            DispatchQueue.main.async {
                completion("\(mileStr) • ETA \(etaStr)")
            }
        }
    }

    /// Whether the chosen voting time is outside valid voting hours
    var isOutsideVotingHours: Bool {
        guard let voteTime = plan.voteTime else { return false }

        let calendar = Calendar.current
        if upcomingElections.contains(where: { calendar.isDate(voteTime, inSameDayAs: $0.electionDay) }) {
            let start = calendar.date(bySettingHour: 6,  minute: 0,  second: 0, of: voteTime)!
            let end   = calendar.date(bySettingHour: 21, minute: 0,  second: 0, of: voteTime)!
            return !(start...end).contains(voteTime)
        }

        guard let election = upcomingElections
            .sorted(by: { $0.electionDay < $1.electionDay })
            .first(where: {
                let windowEnd = calendar.date(bySettingHour: 23, minute: 59, second: 59, of: $0.electionDay) ?? $0.electionDay
                return voteTime >= $0.startDate && voteTime <= windowEnd
            }) else {
            return false
        }

        let earlyEnd = calendar.date(byAdding: .day, value: -1, to: election.electionDay) ?? election.electionDay
        if election.startDate >= earlyEnd {
            return false
        }

        let earlyEndDay = calendar.date(bySettingHour: 23, minute: 59, second: 59, of: earlyEnd) ?? earlyEnd
        return !(election.startDate...earlyEndDay).contains(voteTime)
    }
}
