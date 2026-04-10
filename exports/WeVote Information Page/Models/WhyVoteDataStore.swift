import Foundation
import Combine

func inferStateCode(from address: String) -> String? {
    WhyVoteDataStore.inferStateCode(from: address)
}

final class WhyVoteDataStore: ObservableObject {
    @Published private(set) var stateData: [StateVoteInfo] = []
    @Published private(set) var nationalFacts: [String] = []

    private var stateDataByCode: [String: StateVoteInfo] = [:]
    private let bundle: Bundle

    init(bundle: Bundle = .main) {
        self.bundle = bundle
        load()
    }

    func stateInfo(for stateCode: String?) -> StateVoteInfo? {
        guard let stateCode = stateCode?.uppercased() else { return nil }
        return stateDataByCode[stateCode]
    }

    func primaryTurnoutPercent(for stateCode: String?) -> Double? {
        guard let stateCode = stateCode?.uppercased() else { return nil }
        return Self.primaryTurnoutByStateCode[stateCode]
    }

    func inferStateCode(from address: String) -> String? {
        Self.inferStateCode(from: address)
    }

    static func inferStateCode(from address: String) -> String? {
        let raw = address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return nil }

        let uppercase = raw.uppercased()
        let commaSegments = uppercase
            .split(separator: ",", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        for segment in commaSegments.reversed() {
            if let code = stateCodeFromSegment(segment) {
                return code
            }
        }

        let tokens = tokenize(uppercase)

        if let zipIndex = tokens.firstIndex(where: isLikelyZipToken), zipIndex > 0 {
            if let code = normalizedStateCode(tokens[zipIndex - 1]) {
                return code
            }

            if zipIndex > 1 {
                let possibleName = tokens[(zipIndex - 2)...(zipIndex - 1)].joined(separator: " ")
                if let code = stateNameToCode[possibleName] {
                    return code
                }
            }
        }

        if let lastToken = tokens.last, let code = normalizedStateCode(lastToken) {
            return code
        }

        let alphaTokens = tokens.filter { token in
            token.range(of: #"^\d+$"#, options: .regularExpression) == nil
        }

        if alphaTokens.count >= 2 {
            for index in stride(from: alphaTokens.count - 1, through: 1, by: -1) {
                let joined = alphaTokens[index - 1] + " " + alphaTokens[index]
                if let code = stateNameToCode[joined] {
                    return code
                }
            }
        }

        for token in alphaTokens.reversed() {
            if let code = stateNameToCode[token] {
                return code
            }
        }

        return nil
    }

    private func load() {
        loadStateData()
        loadNationalFacts()
    }

    private func loadStateData() {
        guard let url = bundle.url(forResource: "WhyVoteStateData", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([StateVoteInfo].self, from: data) else {
            stateData = []
            stateDataByCode = [:]
            return
        }

        stateData = decoded
        stateDataByCode = Dictionary(uniqueKeysWithValues: decoded.map { ($0.stateCode.uppercased(), $0) })
    }

    private func loadNationalFacts() {
        guard let url = bundle.url(forResource: "WhyVoteNationalFacts", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([String].self, from: data) else {
            nationalFacts = []
            return
        }

        nationalFacts = decoded
    }

    private static func tokenize(_ value: String) -> [String] {
        value
            .replacingOccurrences(of: #"[^A-Z0-9 ]"#, with: " ", options: .regularExpression)
            .split(whereSeparator: { $0.isWhitespace })
            .map(String.init)
    }

    private static func isLikelyZipToken(_ token: String) -> Bool {
        token.range(of: #"^\d{5}(-\d{4})?$"#, options: .regularExpression) != nil
    }

    private static func stateCodeFromSegment(_ segment: String) -> String? {
        let tokens = tokenize(segment)
        guard !tokens.isEmpty else { return nil }

        if let last = tokens.last, let code = normalizedStateCode(last) {
            return code
        }

        if tokens.count >= 2,
           isLikelyZipToken(tokens[tokens.count - 1]),
           let code = normalizedStateCode(tokens[tokens.count - 2]) {
            return code
        }

        if tokens.count >= 2 {
            let twoWord = tokens[tokens.count - 2] + " " + tokens[tokens.count - 1]
            if let code = stateNameToCode[twoWord] {
                return code
            }
        }

        if let first = tokens.first, let code = stateNameToCode[first] {
            return code
        }

        if tokens.count >= 2 {
            let joined = tokens[0] + " " + tokens[1]
            if let code = stateNameToCode[joined] {
                return code
            }
        }

        return nil
    }

    private static func normalizedStateCode(_ token: String) -> String? {
        let value = token.uppercased()
        guard value.count == 2 else { return nil }
        return allStateCodes.contains(value) ? value : nil
    }

    private static let allStateCodes: Set<String> = [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
        "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
        "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
        "DC", "PR", "GU", "VI", "AS", "MP"
    ]

    private static let stateNameToCode: [String: String] = [
        "ALABAMA": "AL", "ALASKA": "AK", "ARIZONA": "AZ", "ARKANSAS": "AR", "CALIFORNIA": "CA",
        "COLORADO": "CO", "CONNECTICUT": "CT", "DELAWARE": "DE", "FLORIDA": "FL", "GEORGIA": "GA",
        "HAWAII": "HI", "IDAHO": "ID", "ILLINOIS": "IL", "INDIANA": "IN", "IOWA": "IA",
        "KANSAS": "KS", "KENTUCKY": "KY", "LOUISIANA": "LA", "MAINE": "ME", "MARYLAND": "MD",
        "MASSACHUSETTS": "MA", "MICHIGAN": "MI", "MINNESOTA": "MN", "MISSISSIPPI": "MS", "MISSOURI": "MO",
        "MONTANA": "MT", "NEBRASKA": "NE", "NEVADA": "NV", "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ",
        "NEW MEXICO": "NM", "NEW YORK": "NY", "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", "OHIO": "OH",
        "OKLAHOMA": "OK", "OREGON": "OR", "PENNSYLVANIA": "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
        "SOUTH DAKOTA": "SD", "TENNESSEE": "TN", "TEXAS": "TX", "UTAH": "UT", "VERMONT": "VT",
        "VIRGINIA": "VA", "WASHINGTON": "WA", "WEST VIRGINIA": "WV", "WISCONSIN": "WI", "WYOMING": "WY",
        "DISTRICT OF COLUMBIA": "DC", "PUERTO RICO": "PR", "GUAM": "GU", "U S VIRGIN ISLANDS": "VI",
        "US VIRGIN ISLANDS": "VI", "AMERICAN SAMOA": "AS", "NORTHERN MARIANA ISLANDS": "MP"
    ]

    // 2022 statewide primary turnout percentages (Total_Primary_Turnout_Pct)
    // sourced from 2022_state_primary_turnout_dem_gop.csv.
    // Values are percentages in the 0...100 range.
    // Louisiana is intentionally omitted because the CSV total is blank.
    private static let primaryTurnoutByStateCode: [String: Double] = [
        "AL": 24.3, "AK": 36.6, "AZ": 28.6, "AR": 21.1, "CA": 28.6,
        "CO": 28.1, "CT": 7.9, "DE": 9.9, "FL": 25.1, "GA": 27.2,
        "HI": 33.5, "ID": 23.6, "IL": 19.4, "IN": 13.3, "IA": 15.2,
        "KS": 47.7, "KY": 22.4, "ME": 12.6, "MD": 23.8, "MA": 21.1,
        "MI": 28.5, "MN": 19.1, "MS": 11.9, "MO": 23.9, "MT": 33.7,
        "NE": 29.8, "NV": 21.1, "NH": 21.9, "NJ": 12.3, "NM": 17.2,
        "NY": 3.2, "NC": 18.3, "ND": 18.6, "OH": 18.8, "OK": 18.5,
        "OR": 34.6, "PA": 28.9, "RI": 16.8, "SC": 14.3, "SD": 28.5,
        "TN": 18.6, "TX": 16.2, "UT": 20.0, "VT": 25.5, "VA": 2.8,
        "WA": 35.4, "WV": 18.8, "WI": 27.9, "WY": 42.3
    ]
}
