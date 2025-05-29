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

/// A simple election model — adjust fields as needed.
struct Election: Identifiable {
    let id = UUID()
    let name: String
    let subtitle: String
    let registrationDeadline: Date
    let startDate: Date
    let electionDay: Date
}

// MARK: – ViewModel

final class PlanViewModel: ObservableObject {
    // MARK: – User Info
    @Published var userAddress: Address = Address()
    @Published var selectedParty: PoliticalParty = .independent

    /// The user’s ZIP code for “My Reps” lookups
    @Published var zip: String = ""

    /// A legacy full-address string if you ever need it
    @Published var homeAddress: String = ""

    /// Upcoming elections to display
    @Published var upcomingElections: [Election] = []

    /// **Your Plan to Vote** container (method, place, time, ETA, etc.)
    @Published var plan = VotePlan()

    init() {
        // TODO: Replace these sample entries with real data from your API or JSON bundle.
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
