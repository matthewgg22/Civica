import Foundation

struct AbsenteeDeadlineRow: Equatable {
    let label: String
    let value: String
}

struct AbsenteeBallotJurisdiction: Identifiable, Codable, Equatable {
    let displayName: String
    let slug: String
    let code: String?
    let officialVoterInfoUrl: String
    let requestApplyUrl: String
    let requestDeadlineInPerson: String?
    let requestDeadlineOnlineEmail: String?
    let requestDeadlineByMail: String?
    let deadlineSourceUrl: String?
    let notes: String?

    var id: String { slug }

    var officialVoterInfoURL: URL? {
        URL(string: officialVoterInfoUrl)
    }

    var requestApplyURL: URL? {
        URL(string: requestApplyUrl)
    }

    var deadlineSourceURL: URL? {
        guard let deadlineSourceUrl else { return nil }
        return URL(string: deadlineSourceUrl)
    }

    func matches(search query: String) -> Bool {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return true }
        if displayName.lowercased().contains(needle) {
            return true
        }
        if let code, code.lowercased().contains(needle) {
            return true
        }
        return false
    }

    func deadlineRows() -> [AbsenteeDeadlineRow] {
        [
            AbsenteeDeadlineRow(
                label: "In person",
                value: AbsenteeBallotRequestProvider.displayDeadlineValue(requestDeadlineInPerson)
            ),
            AbsenteeDeadlineRow(
                label: "Online / Email",
                value: AbsenteeBallotRequestProvider.displayDeadlineValue(requestDeadlineOnlineEmail)
            ),
            AbsenteeDeadlineRow(
                label: "By mail",
                value: AbsenteeBallotRequestProvider.displayDeadlineValue(requestDeadlineByMail)
            ),
        ]
    }
}

struct AbsenteeBallotDataset: Decodable {
    struct Metadata: Decodable {
        let generatedAt: String
        let sourceFile: String
        let rowCount: Int
        let sheet: String
    }

    let metadata: Metadata
    let rows: [AbsenteeBallotJurisdiction]
}

enum AbsenteeBallotRequestProvider {
    static let dataFileName = "absentee_ballot_request_links_deadlines"
    static let fallbackDeadlineText = "Not provided here — see official voter info link."

    static func loadJurisdictions(bundle: Bundle = .main) -> [AbsenteeBallotJurisdiction] {
        guard let url = bundle.url(forResource: dataFileName, withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let dataset = try? JSONDecoder().decode(AbsenteeBallotDataset.self, from: data) else {
            return []
        }

        return dataset.rows.sorted {
            $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending
        }
    }

    static func resolveDefaultJurisdictionCode(
        userState: String,
        primaryZip: String,
        fallbackZip: String,
        stateResolver: USZipStateResolver = USZipStateResolver()
    ) -> String? {
        let trimmedState = userState.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedState.count == 2 {
            return trimmedState.uppercased()
        }

        if let mapped = Self.stateCodeByName[trimmedState.lowercased()] {
            return mapped
        }

        let primary = String(primaryZip.filter(\.isNumber).prefix(5))
        if primary.count == 5, let code = stateResolver.stateCode(for: primary) {
            return code
        }

        let fallback = String(fallbackZip.filter(\.isNumber).prefix(5))
        if fallback.count == 5, let code = stateResolver.stateCode(for: fallback) {
            return code
        }

        return nil
    }

    static func displayDeadlineValue(_ value: String?) -> String {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return fallbackDeadlineText
        }
        return value
    }

    private static let stateCodeByName: [String: String] = [
        "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
        "colorado": "CO", "connecticut": "CT", "delaware": "DE", "district of columbia": "DC", "florida": "FL",
        "georgia": "GA", "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN",
        "iowa": "IA", "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME",
        "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
        "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH",
        "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
        "ohio": "OH", "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI",
        "south carolina": "SC", "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
        "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI",
        "wyoming": "WY", "american samoa": "AS", "guam": "GU", "northern mariana islands": "MP",
        "puerto rico": "PR", "u.s. virgin islands": "VI", "us virgin islands": "VI"
    ]
}
