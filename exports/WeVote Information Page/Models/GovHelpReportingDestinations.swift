import Foundation

struct GovHelpReportingDestination: Identifiable {
    let id: String
    let label: String
    let url: URL
}

enum GovHelpReportingDestinations {
    static let all: [GovHelpReportingDestination] = [
        GovHelpReportingDestination(
            id: "us-house-clerk",
            label: "U.S. House Clerk",
            url: URL(string: "https://clerk.house.gov")!
        ),
        GovHelpReportingDestination(
            id: "us-senate",
            label: "U.S. Senate",
            url: URL(string: "https://www.senate.gov")!
        ),
        GovHelpReportingDestination(
            id: "usa-gov-complaint",
            label: "USA.gov Complaint Directory",
            url: URL(string: "https://www.usa.gov/complaints")!
        ),
        GovHelpReportingDestination(
            id: "eac",
            label: "Election Assistance Commission",
            url: URL(string: "https://www.eac.gov")!
        ),
        GovHelpReportingDestination(
            id: "federal-trade-commission",
            label: "Report Fraud (FTC)",
            url: URL(string: "https://reportfraud.ftc.gov")!
        )
    ]

    static let byID: [String: GovHelpReportingDestination] = {
        Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })
    }()

    static func payloads() -> [GovHelpReportingDestinationPayload] {
        all.map {
            GovHelpReportingDestinationPayload(
                id: $0.id,
                label: $0.label,
                url: $0.url.absoluteString
            )
        }
    }

    static func resolve(ids: [String]) -> [GovHelpReportingDestination] {
        ids.compactMap { byID[$0] }
    }
}
