import Foundation

enum StateFlagCatalog {
    private static let supportedStateCodes: Set<String> = [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
        "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
        "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
        "AS", "GU", "MP", "PR", "VI"
    ]

    static func assetName(for stateCode: String?) -> String? {
        guard let normalized = stateCode?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
              supportedStateCodes.contains(normalized) else {
            return nil
        }
        return "StateFlag_\(normalized)"
    }
}
