import Foundation

struct PoliticalGeography: Equatable {
    let stateCode: String
    let countyName: String?
    let congressionalDistrict: String?

    var pinSubtitle: String {
        let parts: [String] = [countyName, congressionalDistrict].compactMap { value -> String? in
            guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
                return nil
            }
            return value
        }
        return parts.joined(separator: " · ")
    }
}
