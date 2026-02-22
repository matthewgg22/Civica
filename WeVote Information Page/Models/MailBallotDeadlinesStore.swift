import Foundation

enum MailBallotDeadlinesStore {
    private static let records: [MailBallotRequestDeadlines] = {
        guard let url = Bundle.main.url(forResource: "mail_ballot_request_deadlines", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([MailBallotRequestDeadlines].self, from: data) else {
            return []
        }
        return decoded
    }()

    private static let lookup: [String: MailBallotRequestDeadlines] = {
        var table: [String: MailBallotRequestDeadlines] = [:]

        for record in records {
            table[normalize(record.jurisdiction)] = record

            if let code = jurisdictionCode(for: record.jurisdiction) {
                table[normalize(code)] = record
            }

            for alias in aliases(for: record.jurisdiction) {
                table[normalize(alias)] = record
            }
        }

        return table
    }()

    static func deadlines(for jurisdiction: String) -> MailBallotRequestDeadlines? {
        let key = normalize(jurisdiction)
        guard !key.isEmpty else { return nil }
        return lookup[key]
    }

    private static func normalize(_ raw: String) -> String {
        let trimmed = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        let folded = trimmed
            .replacingOccurrences(of: ".", with: "")
            .replacingOccurrences(of: ",", with: "")
            .replacingOccurrences(of: "-", with: " ")

        return folded
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
    }

    private static func aliases(for jurisdiction: String) -> [String] {
        let canonical = normalize(jurisdiction)
        switch canonical {
        case "district of columbia":
            return ["dc", "d c", "washington dc", "washington district of columbia"]
        case "puerto rico":
            return ["pr"]
        case "guam":
            return ["gu"]
        case "american samoa":
            return ["as"]
        case "northern mariana islands":
            return [
                "cnmi",
                "commonwealth of the northern mariana islands",
                "mp"
            ]
        case "virgin islands", "u s virgin islands":
            return ["us virgin islands", "united states virgin islands", "u.s. virgin islands", "vi"]
        default:
            return []
        }
    }

    private static func jurisdictionCode(for jurisdiction: String) -> String? {
        Self.codeByJurisdiction[normalize(jurisdiction)]
    }

    private static let codeByJurisdiction: [String: String] = [
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
        "wyoming": "WY", "puerto rico": "PR", "guam": "GU", "american samoa": "AS",
        "northern mariana islands": "MP", "u s virgin islands": "VI", "virgin islands": "VI"
    ]
}
