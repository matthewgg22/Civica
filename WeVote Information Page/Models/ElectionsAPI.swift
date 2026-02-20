import Foundation

protocol ElectionsAPIProtocol {
    func fetchElections(lat: Double, lon: Double, start: Date, end: Date) async throws -> [Election]
}

enum ElectionsAPIEndpoint {
    case rest(path: String)
    case supabaseRPC(name: String)

    static let `default`: ElectionsAPIEndpoint = .rest(path: "elections")
}

enum ElectionsAPIError: LocalizedError {
    case invalidURL
    case badStatus(code: Int, message: String?)
    case decodingFailed
    case missingElectionDate

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "The election lookup endpoint URL is invalid."
        case .badStatus(let code, let message):
            if let message, !message.isEmpty {
                return "Election lookup failed (\(code)): \(message)"
            }
            return "Election lookup failed with status code \(code)."
        case .decodingFailed:
            return "Election lookup returned data in an unexpected format."
        case .missingElectionDate:
            return "Election lookup returned an entry without a valid election date."
        }
    }
}

struct ElectionsAPI: ElectionsAPIProtocol {
    private let baseURL: URL
    private let anonKey: String
    private let endpoint: ElectionsAPIEndpoint
    private let session: URLSession

    init(
        baseURL: URL = SupabaseConfig.current.url,
        anonKey: String = SupabaseConfig.current.anonKey,
        endpoint: ElectionsAPIEndpoint = .default,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.anonKey = anonKey
        self.endpoint = endpoint
        self.session = session
    }

    func fetchElections(lat: Double, lon: Double, start: Date, end: Date) async throws -> [Election] {
        let request = try makeRequest(lat: lat, lon: lon, start: start, end: end)
        let (data, response) = try await session.data(for: request)
        let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1

        guard (200...299).contains(statusCode) else {
            let message = String(data: data, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            throw ElectionsAPIError.badStatus(code: statusCode, message: message)
        }

        return try decodeElections(from: data)
    }

    private func makeRequest(lat: Double, lon: Double, start: Date, end: Date) throws -> URLRequest {
        let startISO = Self.dayFormatter.string(from: start)
        let endISO = Self.dayFormatter.string(from: end)

        var request: URLRequest
        switch endpoint {
        case .rest(let path):
            let pathComponent = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let endpointURL = baseURL.appendingPathComponent(pathComponent)
            guard var components = URLComponents(url: endpointURL, resolvingAgainstBaseURL: false) else {
                throw ElectionsAPIError.invalidURL
            }
            components.queryItems = [
                URLQueryItem(name: "lat", value: String(lat)),
                URLQueryItem(name: "lon", value: String(lon)),
                URLQueryItem(name: "start", value: startISO),
                URLQueryItem(name: "end", value: endISO)
            ]
            guard let url = components.url else {
                throw ElectionsAPIError.invalidURL
            }
            request = URLRequest(url: url)
            request.httpMethod = "GET"

        case .supabaseRPC(let name):
            let rpcName = name.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let url = baseURL.appendingPathComponent("rest/v1/rpc/\(rpcName)")
            request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(
                RPCRequestBody(lat: lat, lon: lon, start: startISO, end: endISO)
            )
        }

        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if !anonKey.isEmpty {
            request.setValue(anonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func decodeElections(from data: Data) throws -> [Election] {
        let decoder = JSONDecoder()
        if let direct = try? decoder.decode([ElectionPayload].self, from: data) {
            return try direct.map { try $0.toElection() }
        }
        if let wrapped = try? decoder.decode(ElectionEnvelope.self, from: data) {
            return try wrapped.data.map { try $0.toElection() }
        }
        throw ElectionsAPIError.decodingFailed
    }

    private struct RPCRequestBody: Encodable {
        let lat: Double
        let lon: Double
        let start: String
        let end: String
    }

    private struct ElectionEnvelope: Decodable {
        let data: [ElectionPayload]
    }

    private struct ElectionPayload: Decodable {
        let name: String?
        let title: String?
        let subtitle: String?
        let eventDescription: String?
        let registrationDeadline: String?
        let startDate: String?
        let electionDay: String?
        let earlyVotingText: String?
        let registrationNotes: String?
        let jurisdictionLevel: String?
        let jurisdictionName: String?
        let visibility: String?
        let flags: [String]
        let matchConfidence: Int?
        let sourceUrl: String?

        enum CodingKeys: String, CodingKey {
            case name
            case title
            case subtitle
            case eventDescription = "description"
            case registrationDeadline = "registration_deadline"
            case startDate = "start_date"
            case electionDay = "election_day"
            case earlyVotingText = "early_voting_text"
            case registrationNotes = "registration_notes"
            case jurisdictionLevel = "jurisdiction_level"
            case jurisdictionName = "jurisdiction_name"
            case visibility
            case flags
            case matchConfidence = "match_confidence"
            case sourceUrl = "source_url"
            case source
            case electionDate = "election_date"
            case date
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            name = try c.decodeIfPresent(String.self, forKey: .name)
            title = try c.decodeIfPresent(String.self, forKey: .title)
            subtitle = try c.decodeIfPresent(String.self, forKey: .subtitle)
            eventDescription = try c.decodeIfPresent(String.self, forKey: .eventDescription)
            registrationDeadline = try c.decodeIfPresent(String.self, forKey: .registrationDeadline)
            startDate = try c.decodeIfPresent(String.self, forKey: .startDate)
            earlyVotingText = try c.decodeIfPresent(String.self, forKey: .earlyVotingText)
            registrationNotes = try c.decodeIfPresent(String.self, forKey: .registrationNotes)
            jurisdictionLevel = try c.decodeIfPresent(String.self, forKey: .jurisdictionLevel)
            jurisdictionName = try c.decodeIfPresent(String.self, forKey: .jurisdictionName)
            visibility = try c.decodeIfPresent(String.self, forKey: .visibility)

            if let decodedFlags = try c.decodeIfPresent([String].self, forKey: .flags) {
                flags = decodedFlags
            } else if let flagsCSV = try c.decodeIfPresent(String.self, forKey: .flags) {
                flags = flagsCSV.split(separator: ",").map {
                    $0.trimmingCharacters(in: .whitespacesAndNewlines)
                }.filter { !$0.isEmpty }
            } else {
                flags = []
            }

            if let intConfidence = try c.decodeIfPresent(Int.self, forKey: .matchConfidence) {
                matchConfidence = intConfidence
            } else if let strConfidence = try c.decodeIfPresent(String.self, forKey: .matchConfidence),
                      let intConfidence = Int(strConfidence) {
                matchConfidence = intConfidence
            } else {
                matchConfidence = nil
            }

            sourceUrl = try c.decodeIfPresent(String.self, forKey: .sourceUrl)
                ?? (try c.decodeIfPresent(String.self, forKey: .source))

            electionDay = try c.decodeIfPresent(String.self, forKey: .electionDay)
                ?? c.decodeIfPresent(String.self, forKey: .electionDate)
                ?? c.decodeIfPresent(String.self, forKey: .date)
        }

        func toElection() throws -> Election {
            guard let electionDay = Self.parseDate(electionDay) ?? Self.parseDate(startDate) else {
                throw ElectionsAPIError.missingElectionDate
            }

            return Election(
                name: nonEmpty(title) ?? nonEmpty(name) ?? "Election",
                subtitle: nonEmpty(subtitle) ?? nonEmpty(eventDescription) ?? "Election Event",
                registrationDeadline: Self.parseDate(registrationDeadline) ?? electionDay,
                startDate: Self.parseDate(startDate) ?? electionDay,
                electionDay: electionDay,
                earlyVotingText: nonEmpty(earlyVotingText),
                registrationNotes: nonEmpty(registrationNotes) ?? nonEmpty(eventDescription),
                jurisdictionLevel: nonEmpty(jurisdictionLevel) ?? "statewide",
                jurisdictionName: nonEmpty(jurisdictionName) ?? "",
                visibility: nonEmpty(visibility) ?? "public",
                flags: flags,
                matchConfidence: matchConfidence,
                sourceUrl: nonEmpty(sourceUrl)
            )
        }

        private func nonEmpty(_ value: String?) -> String? {
            guard let value else { return nil }
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        }

        private static func parseDate(_ raw: String?) -> Date? {
            guard let raw else { return nil }
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return nil }
            return ElectionsAPI.dayFormatter.date(from: trimmed)
                ?? ElectionsAPI.isoFormatterWithFractionalSeconds.date(from: trimmed)
                ?? ElectionsAPI.isoFormatter.date(from: trimmed)
        }
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let isoFormatterWithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}
