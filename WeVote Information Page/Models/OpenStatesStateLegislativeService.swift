import Foundation

actor OpenStatesStateLegislativeService {
    private struct PeopleGeoResponse: Decodable {
        let results: [PersonRecord]
    }

    private struct PersonRecord: Decodable {
        let name: String
        let party: String?
        let currentRole: CurrentRole?
        let image: String?
        let links: [PersonLink]?
        let openstatesURL: String?

        enum CodingKeys: String, CodingKey {
            case name
            case party
            case currentRole = "current_role"
            case image
            case links
            case openstatesURL = "openstates_url"
        }
    }

    private struct CurrentRole: Decodable {
        let orgClassification: String?
        let divisionID: String?

        enum CodingKeys: String, CodingKey {
            case orgClassification = "org_classification"
            case divisionID = "division_id"
        }
    }

    private struct PersonLink: Decodable {
        let url: String
        let note: String?
    }

    private let session: URLSession
    private let apiKey: String?
    private var cache: [String: [Official]] = [:]

    init(session: URLSession = .shared, bundle: Bundle = .main) {
        self.session = session
        self.apiKey = Self.readAPIKey(from: bundle)
    }

    func lookupStateLegislators(
        zip: String,
        coordinate: RepsGeoCoordinate,
        expectedStateCode: String?
    ) async -> [Official] {
        guard let apiKey, !apiKey.isEmpty else { return [] }

        let normalizedZIP = String(zip.filter(\.isNumber).prefix(5))
        let normalizedState = expectedStateCode?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let cacheKey = "\(normalizedZIP)|\(normalizedState ?? "")"

        if let cached = cache[cacheKey] {
            return cached
        }

        guard var components = URLComponents(string: "https://v3.openstates.org/people.geo") else {
            return []
        }

        components.queryItems = [
            URLQueryItem(name: "lat", value: String(format: "%.6f", coordinate.latitude)),
            URLQueryItem(name: "lng", value: String(format: "%.6f", coordinate.longitude)),
            URLQueryItem(name: "include", value: "links")
        ]

        guard let url = components.url else { return [] }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(apiKey, forHTTPHeaderField: "X-API-KEY")

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                return []
            }

            let decoded = try JSONDecoder().decode(PeopleGeoResponse.self, from: data)
            let officials = deduped(
                decoded.results.compactMap {
                    official(from: $0, expectedStateCode: normalizedState)
                }
            )
            cache[cacheKey] = officials
            return officials
        } catch {
            return []
        }
    }

    private func official(from person: PersonRecord, expectedStateCode: String?) -> Official? {
        guard let role = person.currentRole,
              let divisionID = role.divisionID?.trimmingCharacters(in: .whitespacesAndNewlines),
              !divisionID.isEmpty,
              isStateLegislativeDivision(divisionID) else {
            return nil
        }

        if let expectedStateCode,
           !divisionID.lowercased().contains("/state:\(expectedStateCode.lowercased())") {
            return nil
        }

        let name = person.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return nil }

        return Official(
            name: name,
            divisionId: divisionID,
            party: normalizedParty(person.party),
            photoURL: normalizedURLString(person.image),
            url: preferredWebsite(links: person.links, fallback: person.openstatesURL)
        )
    }

    private func isStateLegislativeDivision(_ divisionID: String) -> Bool {
        let value = divisionID.lowercased()
        guard value.contains("/state:") else { return false }
        return value.contains("/sldu:") || value.contains("/sldl:")
    }

    private func normalizedParty(_ value: String?) -> String? {
        guard let party = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !party.isEmpty else {
            return nil
        }
        return party
    }

    private func preferredWebsite(links: [PersonLink]?, fallback: String?) -> String? {
        let validLinks = (links ?? []).compactMap { link -> String? in
            normalizedURLString(link.url)
        }

        if let preferred = (links ?? []).first(where: { link in
            let note = (link.note ?? "").lowercased()
            return note.contains("official") || note.contains("homepage") || note.contains("website")
        }),
        let preferredURL = normalizedURLString(preferred.url) {
            return preferredURL
        }

        if let first = validLinks.first {
            return first
        }

        return normalizedURLString(fallback)
    }

    private func normalizedURLString(_ rawValue: String?) -> String? {
        guard var value = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty else {
            return nil
        }

        if !value.lowercased().hasPrefix("http://") && !value.lowercased().hasPrefix("https://") {
            value = "https://\(value)"
        }

        guard let url = URL(string: value),
              let scheme = url.scheme?.lowercased(),
              scheme == "http" || scheme == "https" else {
            return nil
        }

        return value
    }

    private func deduped(_ officials: [Official]) -> [Official] {
        var seen = Set<String>()
        var unique: [Official] = []

        for official in officials {
            let key: String
            if let url = official.url?.lowercased(), !url.isEmpty {
                key = "url:\(url)"
            } else {
                key = "\(official.name.lowercased())|\(official.divisionId?.lowercased() ?? "")"
            }

            guard !seen.contains(key) else { continue }
            seen.insert(key)
            unique.append(official)
        }

        return unique
    }

    private static func readAPIKey(from bundle: Bundle) -> String? {
        let key = (bundle.object(forInfoDictionaryKey: "OPENSTATES_API_KEY") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let key,
              !key.isEmpty,
              key != "YOUR_OPENSTATES_API_KEY" else {
            return nil
        }

        return key
    }
}
