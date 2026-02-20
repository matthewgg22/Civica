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
}
