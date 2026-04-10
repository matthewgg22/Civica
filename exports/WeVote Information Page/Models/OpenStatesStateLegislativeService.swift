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

    private struct StateLegislatorRow: Decodable {
        let state: String
        let chamber: String
        let district: String
        let name: String
        let title: String?
        let party: String?
        let website: String?
        let phone: String?
    }

    private struct StateLegislativeDistricts {
        let upper: String?
        let lower: String?
    }

    private let session: URLSession
    private let baseURL: URL
    private var cache: [String: [Official]] = [:]

    init(session: URLSession = .shared, bundle: Bundle = .main) {
        self.session = session
        self.baseURL = Self.resolveBaseURL(bundle: bundle)
    }

    func lookupStateLegislators(
        zip: String,
        coordinate: RepsGeoCoordinate,
        expectedStateCode: String?
    ) async -> [Official] {
        let normalizedZIP = String(zip.filter(\.isNumber).prefix(5))
        let normalizedState = normalizedStateCode(expectedStateCode)
        let cacheKey = "\(normalizedZIP)|\(normalizedState ?? "")"

        if let cached = cache[cacheKey] {
            return cached
        }

        guard var components = URLComponents(
            url: endpoint("api/v1/openstates/people.geo"),
            resolvingAgainstBaseURL: false
        ) else {
            let fallback = await fallbackLegislatorsFromSupabase(
                coordinate: coordinate,
                expectedStateCode: normalizedState
            )
            if !fallback.isEmpty {
                cache[cacheKey] = fallback
            }
            return fallback
        }

        components.queryItems = [
            URLQueryItem(name: "lat", value: String(format: "%.6f", coordinate.latitude)),
            URLQueryItem(name: "lng", value: String(format: "%.6f", coordinate.longitude)),
            URLQueryItem(name: "include", value: "links")
        ]

        guard let url = components.url else {
            let fallback = await fallbackLegislatorsFromSupabase(
                coordinate: coordinate,
                expectedStateCode: normalizedState
            )
            if !fallback.isEmpty {
                cache[cacheKey] = fallback
            }
            return fallback
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 5
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = try? await currentAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await session.data(for: request)
            if let httpResponse = response as? HTTPURLResponse,
               (200...299).contains(httpResponse.statusCode),
               let decoded = try? JSONDecoder().decode(PeopleGeoResponse.self, from: data) {
                let officials = deduped(
                    decoded.results.compactMap {
                        official(from: $0, expectedStateCode: normalizedState)
                    }
                )

                if !officials.isEmpty {
                    cache[cacheKey] = officials
                    return officials
                }
            }
        } catch {
            if let urlError = error as? URLError, urlError.code == .timedOut {
                // Keep UI responsive: if this optional enrichment endpoint times out,
                // skip the slower fallback chain and return immediately.
                return []
            }
            // Fall through to Supabase fallback.
        }

        let fallback = await fallbackLegislatorsFromSupabase(
            coordinate: coordinate,
            expectedStateCode: normalizedState
        )
        if !fallback.isEmpty {
            cache[cacheKey] = fallback
        }
        return fallback
    }

    private func currentAccessToken() async throws -> String {
        // Ensure we always have at least an anonymous Supabase session before
        // requesting a bearer token for protected civic API endpoints.
        try? await SupabaseManager.shared.signInAnonymouslyIfNeeded()

        do {
            return try await SupabaseClientProvider.shared.client.auth.session.accessToken
        } catch {
            let refreshed = try await SupabaseClientProvider.shared.client.auth.refreshSession()
            return refreshed.accessToken
        }
    }

    private func fallbackLegislatorsFromSupabase(
        coordinate: RepsGeoCoordinate,
        expectedStateCode: String?
    ) async -> [Official] {
        guard let stateCode = normalizedStateCode(expectedStateCode) else {
            return []
        }

        guard let districts = await stateLegislativeDistrictsFromCensus(
            coordinate: coordinate,
            stateCode: stateCode
        ) else {
            return []
        }

        var rows: [StateLegislatorRow] = []
        if let upperDistrict = districts.upper {
            rows += await fetchStateLegislatorRows(stateCode: stateCode, chamber: "upper", district: upperDistrict)
        }
        if let lowerDistrict = districts.lower {
            rows += await fetchStateLegislatorRows(stateCode: stateCode, chamber: "lower", district: lowerDistrict)
        }

        if rows.isEmpty, let sharedDistrict = districts.upper ?? districts.lower {
            rows += await fetchStateLegislatorRows(
                stateCode: stateCode,
                chamber: "legislature",
                district: sharedDistrict
            )
        }

        let officials = rows.compactMap { row -> Official? in
            let chamberSegment = chamberDivisionSegment(chamber: row.chamber, title: row.title)
            let normalizedDistrict = normalizedDivisionDistrict(row.district)
            let trimmedName = row.name.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalizedDistrict.isEmpty, !trimmedName.isEmpty else { return nil }

            return Official(
                name: trimmedName,
                divisionId: "ocd-division/country:us/state:\(stateCode.lowercased())/\(chamberSegment):\(normalizedDistrict)",
                party: normalizedParty(row.party),
                officeTitle: row.title?.trimmingCharacters(in: .whitespacesAndNewlines),
                photoURL: nil,
                url: normalizedURLString(row.website),
                officialPhone: row.phone?.trimmingCharacters(in: .whitespacesAndNewlines),
                websiteURL: normalizedURLString(row.website)
            )
        }

        return deduped(officials)
    }

    private func fetchStateLegislatorRows(
        stateCode: String,
        chamber: String,
        district: String
    ) async -> [StateLegislatorRow] {
        let normalizedDistrict = district.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedDistrict.isEmpty else { return [] }

        let exactRows: [StateLegislatorRow]
        do {
            exactRows = try await SupabaseClientProvider.shared.client
                .from("state_legislators_current")
                .select("state,chamber,district,name,title,party,website,phone")
                .eq("state", value: stateCode)
                .eq("chamber", value: chamber)
                .eq("district", value: normalizedDistrict)
                .execute()
                .value
        } catch {
            exactRows = await fetchStateLegislatorRowsViaREST(
                stateCode: stateCode,
                chamber: chamber,
                district: normalizedDistrict
            )
        }

        if !exactRows.isEmpty {
            return exactRows
        }

        // Census district labels can differ in formatting from OpenStates rows (e.g. zero padding,
        // district prefixes, mixed alphanumeric labels). Fall back to a normalized in-memory match.
        let chamberRows = await fetchStateLegislatorRowsForChamber(
            stateCode: stateCode,
            chamber: chamber
        )
        return chamberRows.filter {
            districtLabelsLikelyMatch(queryDistrict: normalizedDistrict, rowDistrict: $0.district)
        }
    }

    private func fetchStateLegislatorRowsViaREST(
        stateCode: String,
        chamber: String,
        district: String
    ) async -> [StateLegislatorRow] {
        var components = URLComponents(
            url: SupabaseConfig.current.url.appendingPathComponent("rest/v1/state_legislators_current"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "select", value: "state,chamber,district,name,title,party,website,phone"),
            URLQueryItem(name: "state", value: "eq.\(stateCode)"),
            URLQueryItem(name: "chamber", value: "eq.\(chamber)"),
            URLQueryItem(name: "district", value: "eq.\(district)")
        ]

        guard let url = components?.url else { return [] }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 8
        request.setValue(SupabaseConfig.current.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(SupabaseConfig.current.anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                return []
            }
            return (try? JSONDecoder().decode([StateLegislatorRow].self, from: data)) ?? []
        } catch {
            return []
        }
    }

    private func fetchStateLegislatorRowsForChamber(
        stateCode: String,
        chamber: String
    ) async -> [StateLegislatorRow] {
        do {
            return try await SupabaseClientProvider.shared.client
                .from("state_legislators_current")
                .select("state,chamber,district,name,title,party,website,phone")
                .eq("state", value: stateCode)
                .eq("chamber", value: chamber)
                .execute()
                .value
        } catch {
            return await fetchStateLegislatorRowsForChamberViaREST(
                stateCode: stateCode,
                chamber: chamber
            )
        }
    }

    private func fetchStateLegislatorRowsForChamberViaREST(
        stateCode: String,
        chamber: String
    ) async -> [StateLegislatorRow] {
        var components = URLComponents(
            url: SupabaseConfig.current.url.appendingPathComponent("rest/v1/state_legislators_current"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "select", value: "state,chamber,district,name,title,party,website,phone"),
            URLQueryItem(name: "state", value: "eq.\(stateCode)"),
            URLQueryItem(name: "chamber", value: "eq.\(chamber)")
        ]

        guard let url = components?.url else { return [] }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 8
        request.setValue(SupabaseConfig.current.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(SupabaseConfig.current.anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                return []
            }
            return (try? JSONDecoder().decode([StateLegislatorRow].self, from: data)) ?? []
        } catch {
            return []
        }
    }

    private func districtLabelsLikelyMatch(queryDistrict: String, rowDistrict: String) -> Bool {
        let queryCanonical = canonicalDistrictLabel(queryDistrict)
        let rowCanonical = canonicalDistrictLabel(rowDistrict)
        if !queryCanonical.isEmpty, queryCanonical == rowCanonical {
            return true
        }

        let queryNumber = normalizedNumericDistrictComponent(queryDistrict)
        let rowNumber = normalizedNumericDistrictComponent(rowDistrict)
        guard let queryNumber, let rowNumber, queryNumber == rowNumber else {
            return false
        }

        let queryHasLetters = queryCanonical.rangeOfCharacter(from: .letters) != nil
        let rowHasLetters = rowCanonical.rangeOfCharacter(from: .letters) != nil

        if !queryHasLetters && !rowHasLetters {
            return true
        }

        if !queryCanonical.isEmpty, !rowCanonical.isEmpty {
            if rowCanonical.contains(queryCanonical) || queryCanonical.contains(rowCanonical) {
                return true
            }
        }

        let queryTokens = Set(queryCanonical.split(separator: " ").map(String.init))
        let rowTokens = Set(rowCanonical.split(separator: " ").map(String.init))
        return queryTokens.contains(queryNumber) || rowTokens.contains(rowNumber)
    }

    private func canonicalDistrictLabel(_ value: String) -> String {
        value
            .lowercased()
            .replacingOccurrences(of: "district", with: "")
            .replacingOccurrences(of: #"[^\p{L}\p{N}]+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func normalizedNumericDistrictComponent(_ value: String) -> String? {
        let digits = value.filter(\.isNumber)
        guard !digits.isEmpty, let number = Int(digits) else { return nil }
        return String(number)
    }

    private func stateLegislativeDistrictsFromCensus(
        coordinate: RepsGeoCoordinate,
        stateCode: String
    ) async -> StateLegislativeDistricts? {
        guard let url = censusGeographyURL(for: coordinate) else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode),
                  let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let result = payload["result"] as? [String: Any],
                  let geographies = result["geographies"] as? [String: Any] else {
                return nil
            }

            let upper = censusDistrictValue(
                in: geographies,
                keyToken: "state legislative districts - upper",
                valueKeys: ["BASENAME", "NAME", "SLDU", "GEOID"],
                stateCode: stateCode
            )
            let lower = censusDistrictValue(
                in: geographies,
                keyToken: "state legislative districts - lower",
                valueKeys: ["BASENAME", "NAME", "SLDL", "GEOID"],
                stateCode: stateCode
            )

            guard upper != nil || lower != nil else {
                return nil
            }

            return StateLegislativeDistricts(upper: upper, lower: lower)
        } catch {
            return nil
        }
    }

    private func censusGeographyURL(for coordinate: RepsGeoCoordinate) -> URL? {
        var components = URLComponents(
            string: "https://geocoding.geo.census.gov/geocoder/geographies/coordinates"
        )
        components?.queryItems = [
            URLQueryItem(name: "x", value: String(format: "%.6f", coordinate.longitude)),
            URLQueryItem(name: "y", value: String(format: "%.6f", coordinate.latitude)),
            URLQueryItem(name: "benchmark", value: "Public_AR_Current"),
            URLQueryItem(name: "vintage", value: "Current_Current"),
            URLQueryItem(name: "format", value: "json")
        ]
        return components?.url
    }

    private func censusDistrictValue(
        in geographies: [String: Any],
        keyToken: String,
        valueKeys: [String],
        stateCode: String
    ) -> String? {
        for (key, value) in geographies {
            guard key.lowercased().contains(keyToken),
                  let rows = value as? [[String: Any]],
                  let first = rows.first else {
                continue
            }

            if let rowStateCode = (first["STUSAB"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .uppercased(),
               rowStateCode.count == 2,
               rowStateCode != stateCode {
                continue
            }

            for valueKey in valueKeys {
                guard let raw = first[valueKey] as? String else { continue }
                if let normalized = normalizedDistrictLabel(raw) {
                    return normalized
                }
            }
        }

        return nil
    }

    private func normalizedDistrictLabel(_ rawValue: String?) -> String? {
        guard
            let raw = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines),
            !raw.isEmpty
        else {
            return nil
        }

        // Preserve mixed alphanumeric district labels (for example,
        // "25th Middlesex" or "Middlesex and Suffolk") so states that do not
        // use purely numeric district names can still match Supabase rows.
        let isStrictlyNumeric = raw.range(of: #"^\d+$"#, options: .regularExpression) != nil
        if isStrictlyNumeric, let number = Int(raw) {
            return String(number)
        }

        let cleaned = raw
            .replacingOccurrences(of: #"\bdistrict\b"#, with: "", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? nil : cleaned
    }

    private func chamberDivisionSegment(chamber: String, title: String?) -> String {
        switch chamber.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "upper":
            return "sldu"
        case "lower":
            return "sldl"
        default:
            let normalizedTitle = (title ?? "").lowercased()
            return normalizedTitle.contains("senat") ? "sldu" : "sldl"
        }
    }

    private func normalizedDivisionDistrict(_ rawValue: String) -> String {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let digits = trimmed.filter(\.isNumber)
        if !digits.isEmpty, let number = Int(digits) {
            return String(number)
        }
        return trimmed
            .lowercased()
            .replacingOccurrences(of: #"[^\p{L}\p{N}]+"#, with: "_", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
    }

    private func normalizedStateCode(_ rawValue: String?) -> String? {
        guard
            let code = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
            code.count == 2
        else {
            return nil
        }

        return code
    }

    private func endpoint(_ path: String) -> URL {
        baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
    }

    private static func resolveBaseURL(bundle: Bundle = .main) -> URL {
        if let configured = (bundle.object(forInfoDictionaryKey: "CIVIC_API_BASE_URL") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !configured.isEmpty,
           let url = URL(string: configured) {
            return url
        }
        return URL(string: "https://votenow-botr.onrender.com")!
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
}
