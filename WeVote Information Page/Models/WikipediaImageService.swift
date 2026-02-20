//
//  WikipediaImageService.swift
//  WeVote Information Page
//
//  Fetches representative thumbnail photos from Wikipedia/Wikimedia PageImages API.
//

import Foundation

actor WikipediaImageService {
    static let shared = WikipediaImageService()

    // Cache of query title -> resolved thumbnail URL (or nil for known miss).
    private var cache: [String: URL?] = [:]
    private let session: URLSession
    private let preferredThumbnailURLOverrides: [String: String] = [
        "aaron frey": "https://dems.ag/wp-content/uploads/2024/02/Website-Headshots-Frey.jpg",
        "bernard sanders": "https://upload.wikimedia.org/wikipedia/commons/7/7d/Bernie_Sanders%2C_official_portrait%2C_115th_Congress.jpg",
        "bernie sanders": "https://upload.wikimedia.org/wikipedia/commons/7/7d/Bernie_Sanders%2C_official_portrait%2C_115th_Congress.jpg",
        "sanders bernard": "https://upload.wikimedia.org/wikipedia/commons/7/7d/Bernie_Sanders%2C_official_portrait%2C_115th_Congress.jpg"
    ]
    private let preferredTitleOverrides: [String: String] = [
        "aaron frey": "Aaron Frey",
        "alan wilson": "Alan Wilson (South Carolina politician)",
        "andrew ginther": "Andrew Ginther",
        "austin davis": "Austin Davis (politician)",
        "bernard sanders": "Bernie Sanders",
        "bernie sanders": "Bernie Sanders",
        "bill lee": "Bill Lee (Tennessee politician)",
        "bob ferguson": "Bob Ferguson (politician)",
        "brett smiley": "Brett Smiley (politician)",
        "carey mike": "Mike Carey (politician)",
        "carol miller": "Carol Miller (politician)",
        "carter troy": "Troy Carter",
        "charity clark": "Charity Clark",
        "christopher murphy": "Chris Murphy",
        "collins susan m": "Susan Collins",
        "connie boesen": "Connie Boesen",
        "craig greenberg": "Craig Greenberg",
        "dan sullivan": "Dan Sullivan (U.S. senator)",
        "dan patrick": "Dan Patrick (politician)",
        "dan rayfield": "Dan Rayfield",
        "dan reyfield": "Dan Rayfield",
        "danny davis": "Danny K. Davis",
        "dave sunday": "Dave Sunday (politician)",
        "david holt": "David Holt (politician)",
        "davis danny": "Danny K. Davis",
        "dereck brown": "Derek Brown (Utah politician)",
        "derek brown": "Derek Brown (Utah politician)",
        "dunn zachary": "Zach Nunn",
        "flood mike": "Mike Flood",
        "freddie o connell": "Freddie O'Connell",
        "freddie oconnell": "Freddie O'Connell",
        "jack reed": "Jack Reed (Rhode Island politician)",
        "joe kelly": "Joe Kelly (attorney)",
        "joe hogsett": "Joe Hogsett",
        "john kennedy": "John Neely Kennedy",
        "john neely kennedy": "John Neely Kennedy",
        "senator john kennedy": "John Neely Kennedy",
        "kennedy john": "John Neely Kennedy",
        "john formella": "John Formella",
        "john hames": "John James (Michigan politician)",
        "john b mccuskey": "John B. McCuskey",
        "john mccuskey": "John B. McCuskey",
        "john joyce": "John Joyce (American politician)",
        "john royce": "John Joyce (American politician)",
        "james john": "John James (Michigan politician)",
        "josh green": "Josh Green (politician)",
        "josh tenorio": "Joshua Tenorio",
        "keith kautz": "Keith Kautz",
        "keith wilson": "Keith Wilson (Portland mayor)",
        "kirk watson": "Kirk Watson",
        "levar stoney": "Levar Stoney",
        "lynch stephen": "Stephen F. Lynch",
        "melvin carter": "Melvin Carter",
        "michael simpson": "Mike Simpson",
        "mike carey": "Mike Carey (politician)",
        "mike dunleavy": "Mike Dunleavy (politician)",
        "mike flood": "Mike Flood",
        "miller carol": "Carol Miller (politician)",
        "nunn zachary": "Zach Nunn",
        "scott peters": "Scott Peters (politician)",
        "sanders bernard": "Bernie Sanders",
        "satya rhodes conway": "Satya Rhodes-Conway",
        "stephen lynch": "Stephen F. Lynch",
        "susan m collins": "Susan Collins",
        "troy carter": "Troy Carter",
        "randy mcnally": "Randy McNally",
        "randy smith": "Randy Smith (West Virginia politician)",
        "toney venhuizen": "Tony Venhuizen",
        "tony venhuizen": "Tony Venhuizen",
        "tyrone garner": "Tyrone Garner",
        "yyrone garner": "Tyrone Garner",
        "raul tore": "Raúl Torrez",
        "raul torrez": "Raúl Torrez",
        "raul torres": "Raúl Torrez",
        "zachary dunn": "Zach Nunn",
        "zachary nunn": "Zach Nunn",
        "pablo hernandez": "Pablo Hernández Rivera",
        "pablo hernandez rivera": "Pablo Hernández Rivera",
        "sarah huckabee sanders": "Sarah Huckabee Sanders",
        "susan collins": "Susan Collins"
    ]

    init(session: URLSession = .shared) {
        self.session = session
    }

    func thumbnailURL(for displayName: String) async throws -> URL? {
        let normalized = normalizeDisplayName(displayName)
        if let directOverride = preferredThumbnailURLOverrides[normalizedLookupKey(normalized)],
           let directURL = URL(string: directOverride) {
            setCachedValue(directURL, for: normalized)
            return directURL
        }

        let normalizedCache = cachedEntry(for: normalized)
        if normalizedCache.isCached {
            return normalizedCache.url
        }

        let candidates = titleCandidates(from: normalized)
        var resolved: URL?

        for candidate in candidates {
            let candidateCache = cachedEntry(for: candidate)
            if candidateCache.isCached {
                if let candidateURL = candidateCache.url {
                    resolved = candidateURL
                    break
                }
                continue
            }

            let fetched = try await fetchThumbnailURL(forTitle: candidate)
            setCachedValue(fetched, for: candidate)

            if let fetched {
                resolved = fetched
                break
            }
        }

        if resolved == nil {
            let searchCandidates = try await fetchSearchCandidateTitles(for: normalized)
            for candidate in searchCandidates {
                let candidateCache = cachedEntry(for: candidate)
                if candidateCache.isCached {
                    if let candidateURL = candidateCache.url {
                        resolved = candidateURL
                        break
                    }
                    continue
                }

                let fetched = try await fetchThumbnailURL(forTitle: candidate)
                setCachedValue(fetched, for: candidate)

                if let fetched {
                    resolved = fetched
                    break
                }
            }
        }

        setCachedValue(resolved, for: normalized)
        return resolved
    }

    private func cachedEntry(for key: String) -> (isCached: Bool, url: URL?) {
        guard cache.keys.contains(key) else { return (false, nil) }
        return (true, cache[key] ?? nil)
    }

    private func setCachedValue(_ value: URL?, for key: String) {
        cache[key] = .some(value)
    }

    private func normalizeDisplayName(_ raw: String) -> String {
        var name = raw.trimmingCharacters(in: .whitespacesAndNewlines)

        // Strip simple role prefixes like "Attorney General: John Doe".
        if let colon = name.firstIndex(of: ":") {
            let suffix = name[name.index(after: colon)...].trimmingCharacters(in: .whitespacesAndNewlines)
            if !suffix.isEmpty {
                name = suffix
            }
        }

        // Strip trailing role suffixes like "(San Diego Mayor)".
        name = name.replacingOccurrences(
            of: #"\s*\([^)]*\)\s*$"#,
            with: "",
            options: .regularExpression
        )

        // Collapse doubled whitespace after cleanup.
        name = name.replacingOccurrences(
            of: #"\s{2,}"#,
            with: " ",
            options: .regularExpression
        )
        name = name.trimmingCharacters(in: .whitespacesAndNewlines)

        return name
    }

    private func titleCandidates(from name: String) -> [String] {
        var candidates: [String] = [name]
        if let preferredTitle = preferredTitleOverrides[normalizedLookupKey(name)] {
            candidates.insert(preferredTitle, at: 0)
        }

        // Handle common punctuation variants in names.
        if name.contains("’") {
            candidates.append(name.replacingOccurrences(of: "’", with: "'"))
        }
        if name.contains(".") {
            candidates.append(name.replacingOccurrences(of: ".", with: ""))
        }

        // If formatted "Last, First", also try "First Last".
        if name.contains(",") {
            let parts = name.split(separator: ",", maxSplits: 1).map {
                $0.trimmingCharacters(in: .whitespacesAndNewlines)
            }
            if parts.count == 2, !parts[0].isEmpty, !parts[1].isEmpty {
                let reordered = "\(parts[1]) \(parts[0])"
                candidates.append(reordered)
            }
        }

        // Deduplicate while preserving order.
        var seen = Set<String>()
        return candidates.filter { candidate in
            guard !candidate.isEmpty, !seen.contains(candidate) else { return false }
            seen.insert(candidate)
            return true
        }
    }

    private func fetchSearchCandidateTitles(for name: String) async throws -> [String] {
        var components = URLComponents(string: "https://en.wikipedia.org/w/api.php")
        components?.queryItems = [
            URLQueryItem(name: "action", value: "query"),
            URLQueryItem(name: "format", value: "json"),
            URLQueryItem(name: "list", value: "search"),
            URLQueryItem(name: "srlimit", value: "8"),
            URLQueryItem(name: "srsearch", value: name),
            URLQueryItem(name: "origin", value: "*")
        ]

        guard let url = components?.url else { return [] }

        let (data, response) = try await session.data(from: url)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw URLError(.badServerResponse)
        }

        let decoded = try JSONDecoder().decode(WikipediaSearchResponse.self, from: data)
        let titles = decoded.query?.search.map(\.title) ?? []
        guard !titles.isEmpty else { return [] }

        let normalizedName = normalizedLookupKey(name)
        return titles
            .sorted { lhs, rhs in
                scoreSearchTitle(lhs, normalizedName: normalizedName) > scoreSearchTitle(rhs, normalizedName: normalizedName)
            }
    }

    private func scoreSearchTitle(_ title: String, normalizedName: String) -> Int {
        let normalizedTitle = normalizedLookupKey(title)
        let nameTokens = normalizedName.split(separator: " ").map(String.init)
        let allNameTokensPresent = !nameTokens.isEmpty && nameTokens.allSatisfy { token in
            normalizedTitle.contains(token)
        }

        let lowered = title.lowercased()
        var score = 0
        if allNameTokensPresent { score += 120 }
        if lowered.contains("(politician)") { score += 50 }
        if lowered.contains("u.s. senator") || lowered.contains("(senator)") { score += 40 }
        if lowered.contains("governor") { score += 30 }
        if lowered.contains("representative") || lowered.contains("resident commissioner") { score += 20 }
        if lowered.contains("(") { score += 5 }
        return score
    }

    private func normalizedLookupKey(_ raw: String) -> String {
        let folded = raw.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        return folded
            .lowercased()
            .replacingOccurrences(of: #"[^\p{L}\p{N}]+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s{2,}"#, with: " ", options: .regularExpression)
    }

    private func fetchThumbnailURL(forTitle title: String) async throws -> URL? {
        var components = URLComponents(string: "https://en.wikipedia.org/w/api.php")
        components?.queryItems = [
            URLQueryItem(name: "action", value: "query"),
            URLQueryItem(name: "format", value: "json"),
            URLQueryItem(name: "prop", value: "pageimages"),
            URLQueryItem(name: "piprop", value: "thumbnail"),
            URLQueryItem(name: "pithumbsize", value: "160"),
            URLQueryItem(name: "redirects", value: "1"),
            URLQueryItem(name: "titles", value: title),
            URLQueryItem(name: "origin", value: "*")
        ]

        guard let url = components?.url else {
            return nil
        }

        let (data, response) = try await session.data(from: url)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw URLError(.badServerResponse)
        }

        let decoded = try JSONDecoder().decode(WikipediaPageImagesResponse.self, from: data)
        guard
            let pages = decoded.query?.pages,
            !pages.isEmpty
        else {
            return try await fetchSummaryThumbnailURL(forTitle: title)
        }

        let firstThumbnailSource = pages.values
            .compactMap { $0.thumbnail?.source }
            .first

        if let firstThumbnailSource {
            return URL(string: firstThumbnailSource)
        }

        return try await fetchSummaryThumbnailURL(forTitle: title)
    }

    private func fetchSummaryThumbnailURL(forTitle title: String) async throws -> URL? {
        guard !title.isEmpty else { return nil }
        let safePath = title
            .replacingOccurrences(of: " ", with: "_")
            .addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)?
            .replacingOccurrences(of: "/", with: "%2F")

        guard let safePath,
              let url = URL(string: "https://en.wikipedia.org/api/rest_v1/page/summary/\(safePath)") else {
            return nil
        }

        let (data, response) = try await session.data(from: url)
        if let http = response as? HTTPURLResponse {
            if http.statusCode == 404 { return nil }
            if !(200..<300).contains(http.statusCode) {
                throw URLError(.badServerResponse)
            }
        }

        let decoded = try JSONDecoder().decode(WikipediaSummaryResponse.self, from: data)
        guard let source = decoded.thumbnail?.source else { return nil }
        return URL(string: source)
    }
}

private struct WikipediaPageImagesResponse: Decodable {
    let query: QueryContainer?

    struct QueryContainer: Decodable {
        let pages: [String: Page]
    }

    struct Page: Decodable {
        let thumbnail: Thumbnail?
    }

    struct Thumbnail: Decodable {
        let source: String?
    }
}

private struct WikipediaSearchResponse: Decodable {
    let query: QueryContainer?

    struct QueryContainer: Decodable {
        let search: [ResultItem]
    }

    struct ResultItem: Decodable {
        let title: String
    }
}

private struct WikipediaSummaryResponse: Decodable {
    let thumbnail: Thumbnail?

    struct Thumbnail: Decodable {
        let source: String?
    }
}
