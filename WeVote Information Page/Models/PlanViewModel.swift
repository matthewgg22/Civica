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
        didSet { persistUserAddress() }
    }
    @Published var selectedParty: PoliticalParty = .independent

    /// The user’s ZIP code for “My Reps” lookups
    @Published var zip: String = "" {
        didSet {
            UserDefaults.standard.set(zip, forKey: StorageKeys.zip)
            syncAddressFieldsFromZIPIfNeeded()
        }
    }

    /// A legacy full-address string if you ever need it
    @Published var homeAddress: String = ""

    /// Upcoming elections to display
    @Published var upcomingElections: [Election] = []

    /// **Your Plan to Vote** container (method, place, time, ETA, etc.)
    @Published var plan = VotePlan()

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

        // Fallback seed entries shown when no richer timeline source is available.
        upcomingElections = [
            Election(
                name: "NYC Primary Election",
                subtitle: "All registered NYC voters",
                registrationDeadline: Date.from("2025-05-29"),
                startDate:            Date.from("2025-06-14"),
                electionDay:          Date.from("2025-06-24")
            ),
            Election(
                name: "General Election",
                subtitle: "All registered NYC voters",
                registrationDeadline: Date.from("2025-10-10"),
                startDate:            Date.from("2025-10-25"),
                electionDay:          Date.from("2025-11-04")
            )
        ]
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

        // Election Day (June 24) hours
        if calendar.isDate(voteTime, inSameDayAs: Date.from("2025-06-24")) {
            let start = calendar.date(bySettingHour: 6,  minute: 0,  second: 0, of: voteTime)!
            let end   = calendar.date(bySettingHour: 21, minute: 0,  second: 0, of: voteTime)!
            return !(start...end).contains(voteTime)
        }

        // Early/mail voting window (June 14–22)
        let earlyStart = Date.from("2025-06-14")
        let earlyEnd   = calendar.date(bySettingHour: 23, minute: 59, second: 59, of: Date.from("2025-06-22"))!
        return !(earlyStart...earlyEnd).contains(voteTime)
    }
}
