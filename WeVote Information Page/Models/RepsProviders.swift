import Foundation
import OSLog

private let allUSStateCodes: Set<String> = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
]

private let allUSStateAndTerritoryCodes: Set<String> =
    allUSStateCodes.union(["AS", "DC", "GU", "MP", "PR", "VI"])
private let repsProviderLogger = Logger(subsystem: "Civica", category: "RepsProviders")

private func normalizedOfficialWebsiteURL(_ value: String?) -> String? {
    guard var raw = value?.trimmingCharacters(in: .whitespacesAndNewlines),
          !raw.isEmpty else {
        return nil
    }

    if !raw.lowercased().hasPrefix("http://") && !raw.lowercased().hasPrefix("https://") {
        raw = "https://\(raw)"
    }

    guard var components = URLComponents(string: raw),
          let host = components.host?.lowercased() else {
        return nil
    }

    let normalizedHost = host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    guard !normalizedHost.contains("wikipedia.org") else {
        return nil
    }

    components.host = normalizedHost
    components.scheme = "https"
    return components.url?.absoluteString
}

private func normalizedOfficialPhone(_ raw: String?) -> String? {
    guard let value = raw?.trimmingCharacters(in: .whitespacesAndNewlines),
          !value.isEmpty else {
        return nil
    }
    let digits = value.filter(\.isNumber)
    guard digits.count >= 7 else { return nil }
    return value
}

private func parsedCommitteeAssignments(_ raw: String?) -> [String] {
    guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines),
          !raw.isEmpty else {
        return []
    }

    var seen = Set<String>()
    var ordered: [String] = []
    for value in raw.split(separator: "|") {
        let committee = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !committee.isEmpty else { continue }
        if seen.insert(committee).inserted {
            ordered.append(committee)
        }
    }
    return ordered
}

private func normalizedSenateClass(_ raw: String?) -> String? {
    guard let raw else { return nil }
    let sanitized = raw
        .uppercased()
        .replacingOccurrences(of: "CLASS", with: "")
        .components(separatedBy: CharacterSet.alphanumerics.inverted)
        .joined()
    switch sanitized {
    case "I", "1":
        return "I"
    case "II", "2":
        return "II"
    case "III", "3":
        return "III"
    default:
        return nil
    }
}

private func senateClassSortRank(_ raw: String?) -> Int {
    switch normalizedSenateClass(raw) {
    case "I":
        return 1
    case "II":
        return 2
    case "III":
        return 3
    default:
        return 99
    }
}

private let senateCommitteeNameCatalog: [String] = [
    "Agriculture, Nutrition, and Forestry",
    "Appropriations",
    "Armed Services",
    "Banking, Housing, and Urban Affairs",
    "Budget",
    "Commerce, Science, and Transportation",
    "Energy and Natural Resources",
    "Environment and Public Works",
    "Finance",
    "Foreign Relations",
    "Health, Education, Labor, and Pensions",
    "Homeland Security and Governmental Affairs",
    "Indian Affairs",
    "Judiciary",
    "Rules and Administration",
    "Small Business and Entrepreneurship",
    "Veterans' Affairs",
    "Select Committee on Ethics",
    "Select Committee on Intelligence",
    "Special Committee on Aging",
    "Joint Economic Committee",
    "Joint Committee on Taxation",
    "Joint Committee of Congress on the Library",
    "Joint Committee on Printing",
]

private func normalizedPersonNameKey(_ raw: String) -> String {
    let lowered = raw
        .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        .lowercased()

    let allowed = CharacterSet.alphanumerics.union(.whitespaces)
    let sanitized = String(lowered.unicodeScalars.map { allowed.contains($0) ? Character($0) : " " })
    return sanitized
        .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

private func normalizedCommitteeNameKey(_ raw: String) -> String {
    var normalized = raw
        .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        .lowercased()
        .trimmingCharacters(in: .whitespacesAndNewlines)

    normalized = normalized.replacingOccurrences(of: "&", with: " and ")
    normalized = normalized.replacingOccurrences(of: "committee on ", with: "")
    normalized = normalized.replacingOccurrences(of: "committee of ", with: "")
    normalized = normalized.replacingOccurrences(of: "committee for ", with: "")
    normalized = normalized.replacingOccurrences(of: "u.s. ", with: "")
    normalized = normalized.replacingOccurrences(of: "us ", with: "")

    let allowed = CharacterSet.alphanumerics.union(.whitespaces)
    normalized = String(normalized.unicodeScalars.map { allowed.contains($0) ? Character($0) : " " })
    return normalized
        .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

private func extractedCanonicalSenateCommittees(from rawAssignments: [String]) -> [String] {
    var seen = Set<String>()
    var ordered: [String] = []

    for rawAssignment in rawAssignments {
        let normalizedAssignment = normalizedCommitteeNameKey(rawAssignment)
        guard !normalizedAssignment.isEmpty else { continue }

        for canonicalCommittee in senateCommitteeNameCatalog {
            let normalizedCanonical = normalizedCommitteeNameKey(canonicalCommittee)
            guard !normalizedCanonical.isEmpty else { continue }

            if normalizedAssignment.contains(normalizedCanonical)
                || normalizedCanonical.contains(normalizedAssignment) {
                if seen.insert(canonicalCommittee).inserted {
                    ordered.append(canonicalCommittee)
                }
            }
        }
    }

    return ordered
}

private func reorderedName(from rawName: String?) -> String? {
    guard let rawName else { return nil }
    let trimmed = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }

    let pieces = trimmed.split(separator: ",").map {
        $0.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    guard pieces.count == 2 else { return trimmed }

    return "\(pieces[1]) \(pieces[0])"
}

struct RepsLookupResult {
    let executive: [Official]
    let federal: [Official]
    let state: [Official]
    let city: [Official]

    static let empty = RepsLookupResult(executive: [], federal: [], state: [], city: [])

    func merging(_ other: RepsLookupResult) -> RepsLookupResult {
        RepsLookupResult(
            executive: dedupe(executive + other.executive),
            federal: dedupe(federal + other.federal),
            state: dedupe(state + other.state),
            city: dedupe(city + other.city)
        )
    }

    private func dedupe(_ officials: [Official]) -> [Official] {
        var indicesByKey: [String: Int] = [:]
        var unique: [Official] = []

        for official in officials {
            let key = mergeKey(for: official)

            if let existingIndex = indicesByKey[key] {
                unique[existingIndex] = mergedOfficial(preferred: unique[existingIndex], fallback: official)
            } else {
                indicesByKey[key] = unique.count
                unique.append(official)
            }
        }

        return unique
    }

    private func mergedOfficial(preferred: Official, fallback: Official) -> Official {
        Official(
            name: preferred.name,
            divisionId: preferred.divisionId ?? fallback.divisionId,
            party: preferred.party ?? fallback.party,
            officeTitle: preferred.officeTitle ?? fallback.officeTitle,
            photoURL: preferred.photoURL ?? fallback.photoURL,
            url: preferred.url ?? fallback.url,
            officialPhone: normalizedOfficialPhone(preferred.officialPhone) ?? normalizedOfficialPhone(fallback.officialPhone),
            websiteURL: preferred.websiteURL ?? fallback.websiteURL,
            contactFormURL: preferred.contactFormURL ?? fallback.contactFormURL,
            committeeAssignments: preferred.committeeAssignments.isEmpty
                ? fallback.committeeAssignments
                : preferred.committeeAssignments,
            level: preferred.level ?? fallback.level
        )
    }

    private func mergeKey(for official: Official) -> String {
        let normalizedDivision = normalizedDivisionKey(official.divisionId)
        let normalizedName = normalizedNameKey(official.name)

        if let normalizedURL = normalizedURLKey(official.url) {
            if !normalizedDivision.isEmpty {
                return "url+division|\(normalizedURL)|\(normalizedDivision)"
            }
            if !normalizedName.isEmpty {
                return "url+name|\(normalizedURL)|\(normalizedName)"
            }
            return "url|\(normalizedURL)"
        }

        return "name+division|\(normalizedName)|\(normalizedDivision)"
    }

    private func normalizedURLKey(_ raw: String?) -> String? {
        guard var normalized = raw?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              !normalized.isEmpty else {
            return nil
        }
        while normalized.hasSuffix("/") {
            normalized.removeLast()
        }
        return normalized
    }

    private func normalizedDivisionKey(_ raw: String?) -> String {
        (raw ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }

    private func normalizedNameKey(_ raw: String) -> String {
        raw
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
    }
}

struct RepsGeoCoordinate {
    let latitude: Double
    let longitude: Double
}

enum RepsProviderError: LocalizedError {
    case invalidZip
    case unsupportedState(stateCode: String?)
    case unsupportedZip(zip: String, stateCode: String?)
    case dataLoad(message: String)
    case dataUnavailable

    var errorDescription: String? {
        switch self {
        case .invalidZip:
            return "Please enter a valid 5-digit ZIP code."
        case .unsupportedState(let stateCode):
            if let stateCode = stateCode {
                return "Representative data for \(stateCode) is not configured yet."
            }
            return "Could not determine state for that ZIP code."
        case .unsupportedZip(let zip, let stateCode):
            if let stateCode = stateCode {
                return "No representative mapping is currently configured for ZIP \(zip) in \(stateCode)."
            }
            return "No representative mapping is currently configured for ZIP \(zip)."
        case .dataLoad(let message):
            return message
        case .dataUnavailable:
            return "Representatives data is temporarily unavailable."
        }
    }
}

protocol RepsProvider: AnyObject {
    var id: String { get }
    var supportedStateCodes: Set<String> { get }
    func load() throws
    func lookup(zip: String, coordinate: RepsGeoCoordinate?, locality: String?) -> RepsLookupResult?
}

struct USZipStateResolver {
    private let ranges: [(ClosedRange<Int>, String)] = [
        (5...5, "NY"),
        (6...9, "PR"),
        (10...27, "MA"),
        (28...29, "RI"),
        (30...38, "NH"),
        (39...49, "ME"),
        (50...59, "VT"),
        (60...69, "CT"),
        (70...89, "NJ"),
        (100...149, "NY"),
        (150...196, "PA"),
        (197...199, "DE"),
        (200...205, "DC"),
        (206...219, "MD"),
        (220...246, "VA"),
        (247...268, "WV"),
        (270...289, "NC"),
        (290...299, "SC"),
        (300...319, "GA"),
        (320...349, "FL"),
        (350...369, "AL"),
        (370...385, "TN"),
        (386...397, "MS"),
        (398...399, "GA"),
        (400...427, "KY"),
        (430...459, "OH"),
        (460...479, "IN"),
        (480...499, "MI"),
        (500...528, "IA"),
        (530...549, "WI"),
        (550...567, "MN"),
        (570...577, "SD"),
        (580...588, "ND"),
        (590...599, "MT"),
        (600...629, "IL"),
        (630...658, "MO"),
        (660...679, "KS"),
        (680...693, "NE"),
        (700...714, "LA"),
        (716...729, "AR"),
        (730...749, "OK"),
        (750...799, "TX"),
        (800...816, "CO"),
        (820...831, "WY"),
        (832...838, "ID"),
        (840...847, "UT"),
        (850...865, "AZ"),
        (870...884, "NM"),
        (885...885, "TX"),
        (889...898, "NV"),
        (900...961, "CA"),
        (967...968, "HI"),
        (969...969, "GU"),
        (970...979, "OR"),
        (980...994, "WA"),
        (995...999, "AK")
    ]

    func stateCode(for zip: String) -> String? {
        let normalized = normalizeZIP(zip)
        guard normalized.count == 5 else {
            return nil
        }

        // Handle ZIP overlaps for US territories before 3-digit range matching.
        if normalized.hasPrefix("008") { return "VI" }
        if normalized == "96799" { return "AS" }
        if normalized == "96950" || normalized == "96951" || normalized == "96952" { return "MP" }

        guard let prefix = Int(normalized.prefix(3)) else { return nil }

        for (range, stateCode) in ranges where range.contains(prefix) {
            return stateCode
        }
        return nil
    }

    func representativeZIP(for stateCode: String) -> String? {
        let normalizedStateCode = stateCode
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()

        switch normalizedStateCode {
        case "AS":
            return "96799"
        case "MP":
            return "96950"
        case "VI":
            return "00802"
        default:
            break
        }

        guard let prefix = ranges.first(where: { $0.1 == normalizedStateCode })?.0.lowerBound else {
            return nil
        }
        return String(format: "%03d01", prefix)
    }

    private func normalizeZIP(_ zip: String) -> String {
        String(zip.filter(\.isNumber).prefix(5))
    }
}

final class NewYorkRepsProvider: RepsProvider {
    let id = "ny-static"
    let supportedStateCodes: Set<String> = ["NY"]

    private let bundle: Bundle
    private var zipMap: ZipToDistrict = [:]
    private var cityCouncilDistrictByZIP: [String: String] = [:]
    private var allReps: RepresentativesJSON?
    private var isLoaded = false

    init(bundle: Bundle = .main) {
        self.bundle = bundle
    }

    func load() throws {
        guard !isLoaded else { return }

        var map: ZipToDistrict = [:]
        var cityCouncilByZIP: [String: String] = [:]
        for (zip, raw) in zipToDistrictMap {
            guard let congressional = raw["congressional"],
                  let stateSenate = raw["state_senate"],
                  let stateAssembly = raw["state_assembly"] else {
                continue
            }
            map[zip] = DistrictMapping(
                congressional: congressional,
                state_senate: stateSenate,
                state_assembly: stateAssembly
            )

            if let cityCouncilRaw = raw["city_council"]
                ?? raw["city_council_district"]
                ?? raw["nyc_city_council_district"],
               let normalizedCityCouncilDistrict = normalizedDistrictIdentifier(from: cityCouncilRaw) {
                cityCouncilByZIP[zip] = normalizedCityCouncilDistrict
            }
        }

        guard !map.isEmpty else {
            throw RepsProviderError.dataLoad(message: "ZIP mapping data is missing.")
        }
        zipMap = map
        cityCouncilDistrictByZIP = cityCouncilByZIP

        guard let repsURL = bundle.url(forResource: "NYCRepresentativesRoster", withExtension: "json"),
              let repsData = try? Data(contentsOf: repsURL) else {
            throw RepsProviderError.dataLoad(message: "Representatives roster file is missing.")
        }

        do {
            allReps = try JSONDecoder().decode(RepresentativesJSON.self, from: repsData)
        } catch {
            throw RepsProviderError.dataLoad(message: "Could not parse representatives roster.")
        }

        isLoaded = true
    }

    func lookup(zip: String, coordinate: RepsGeoCoordinate?, locality: String?) -> RepsLookupResult? {
        guard let map = zipMap[zip],
              let reps = allReps else {
            return nil
        }
        // Federal reps for NY are sourced from canonical US datasets (USSenatorsProvider / USHouseMembersProvider)
        // to avoid duplicate federal officials and phone gaps in the NYC static roster.
        let federal: [Official] = []

        var state = reps.state.state_senators.values.filter {
            $0.divisionId?.contains(map.state_senate) == true
        }
        state.append(contentsOf: reps.state.state_assembly_members.values.filter {
            $0.divisionId?.contains(map.state_assembly) == true
        })

        // City mayor is provided by USMayorsProvider to keep city mayor data current.
        let city: [Official]
        if let cityCouncilDistrict = cityCouncilDistrictByZIP[zip] {
            city = filteredNYCCityCouncilMembers(
                members: reps.city.city_council_members,
                district: cityCouncilDistrict
            )
        } else {
            city = []
        }

        return RepsLookupResult(executive: [], federal: federal, state: state, city: city)
    }

    private func filteredNYCCityCouncilMembers(
        members: [String: Official],
        district: String
    ) -> [Official] {
        let normalizedDistrict = normalizedDistrictIdentifier(from: district)
        guard let normalizedDistrict else { return [] }

        let keyedMatches = members.compactMap { key, official -> Official? in
            guard normalizedDistrictIdentifier(from: key) == normalizedDistrict else { return nil }
            return official
        }
        if !keyedMatches.isEmpty {
            return keyedMatches
        }

        let valueMatches = members.values.filter { official in
            let divisionIDMatches = normalizedDistrictIdentifier(from: official.divisionId) == normalizedDistrict
            let officeTitleMatches = normalizedDistrictIdentifier(from: official.officeTitle) == normalizedDistrict
            return divisionIDMatches || officeTitleMatches
        }
        if !valueMatches.isEmpty {
            return valueMatches
        }

        return []
    }

    private func normalizedDistrictIdentifier(from raw: String?) -> String? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty else {
            return nil
        }

        let digits = raw.filter(\.isNumber)
        guard !digits.isEmpty, let districtNumber = Int(digits) else {
            return nil
        }
        return String(districtNumber)
    }
}

final class USExecutiveProvider: RepsProvider {
    let id = "us-executive"
    let supportedStateCodes: Set<String> = allUSStateAndTerritoryCodes

    private let officials: [Official] = [
        Official(
            name: "Donald Trump",
            divisionId: "ocd-division/country:us",
            party: "Republican",
            photoURL: nil,
            url: "https://www.whitehouse.gov/",
            officialPhone: "(202) 456-1414",
            websiteURL: "https://www.whitehouse.gov/",
            contactFormURL: "https://www.whitehouse.gov/contact/"
        ),
        Official(
            name: "JD Vance",
            divisionId: "ocd-division/country:us",
            party: "Republican",
            photoURL: nil,
            url: "https://www.whitehouse.gov/",
            officialPhone: "(202) 456-7549",
            websiteURL: "https://www.whitehouse.gov/",
            contactFormURL: "https://www.whitehouse.gov/contact/"
        )
    ]

    func load() throws {}

    func lookup(zip: String, coordinate: RepsGeoCoordinate?, locality: String?) -> RepsLookupResult? {
        RepsLookupResult(executive: officials, federal: [], state: [], city: [])
    }
}

final class USGovernorsProvider: RepsProvider {
    private struct GovernorRecord: Codable {
        let state_code: String
        let state_name: String
        let name: String
        let party: String
        let url: String
        let phone: String?
        let attorney_general: String?
        let attorney_general_url: String?
        let lieutenant_governor: String?
        let lieutenant_governor_party: String?
        let lieutenant_governor_url: String?
    }

    let id = "us-governors"
    let supportedStateCodes: Set<String> = allUSStateAndTerritoryCodes

    private let bundle: Bundle
    private let stateResolver = USZipStateResolver()
    private var governorsByState: [String: GovernorRecord] = [:]
    private var isLoaded = false

    init(bundle: Bundle = .main) {
        self.bundle = bundle
    }

    func load() throws {
        guard !isLoaded else { return }

        guard let url = bundle.url(forResource: "USGovernors", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            throw RepsProviderError.dataLoad(message: "US governors data file is missing.")
        }

        do {
            let entries = try JSONDecoder().decode([GovernorRecord].self, from: data)
            governorsByState = Dictionary(uniqueKeysWithValues: entries.map { ($0.state_code, $0) })
        } catch {
            throw RepsProviderError.dataLoad(message: "Could not parse US governors data.")
        }

        isLoaded = true
    }

    func lookup(zip: String, coordinate: RepsGeoCoordinate?, locality: String?) -> RepsLookupResult? {
        guard let stateCode = stateResolver.stateCode(for: zip),
              let governor = governorsByState[stateCode] else {
            return nil
        }

        let governorOfficial = Official(
            name: governor.name,
            divisionId: "ocd-division/country:us/state:\(stateCode.lowercased())",
            party: governor.party,
            officeTitle: "Governor",
            photoURL: nil,
            url: governor.url,
            officialPhone: normalizedOfficialPhone(governor.phone)
        )

        var stateOfficials: [Official] = [governorOfficial]
        if let lieutenantGovernor = governor.lieutenant_governor?.trimmingCharacters(in: .whitespacesAndNewlines),
           !lieutenantGovernor.isEmpty {
            stateOfficials.append(
                Official(
                    name: lieutenantGovernor,
                    divisionId: "ocd-division/country:us/state:\(stateCode.lowercased())",
                    party: governor.lieutenant_governor_party,
                    officeTitle: "Lieutenant Governor",
                    photoURL: nil,
                    url: governor.lieutenant_governor_url
                )
            )
        }
        if let attorneyGeneral = governor.attorney_general?.trimmingCharacters(in: .whitespacesAndNewlines),
           !attorneyGeneral.isEmpty {
            stateOfficials.append(
                Official(
                    name: attorneyGeneral,
                    divisionId: "ocd-division/country:us/state:\(stateCode.lowercased())",
                    party: nil,
                    officeTitle: "Attorney General",
                    photoURL: nil,
                    url: governor.attorney_general_url
                )
            )
        }

        return RepsLookupResult(executive: [], federal: [], state: stateOfficials, city: [])
    }
}

final class USSenatorsProvider: RepsProvider {
    private struct SenatorRecord: Codable {
        let state_code: String
        let state_name: String
        let name: String
        let raw_name: String
        let party: String
        let url: String
        let contact_form_url: String?
        let committee_assignments: String?
        let senate_class: String
        let office: String
        let phone: String
    }

    let id = "us-senators"
    let supportedStateCodes: Set<String> = allUSStateCodes

    private let bundle: Bundle
    private let stateResolver = USZipStateResolver()
    private var senatorsByState: [String: [SenatorRecord]] = [:]
    private var committeesByNormalizedName: [String: [String]] = [:]
    private var isLoaded = false

    init(bundle: Bundle = .main) {
        self.bundle = bundle
    }

    func load() throws {
        guard !isLoaded else { return }

        guard let url = bundle.url(forResource: "USSenators", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            throw RepsProviderError.dataLoad(message: "US senators data file is missing.")
        }

        do {
            let entries = try JSONDecoder().decode([SenatorRecord].self, from: data)
            senatorsByState = Dictionary(grouping: entries, by: { $0.state_code })
        } catch {
            throw RepsProviderError.dataLoad(message: "Could not parse US senators data.")
        }

        do {
            committeesByNormalizedName = try loadCommitteeAssignmentsByName()
        } catch {
            committeesByNormalizedName = [:]
            repsProviderLogger.error("Failed to parse USSenateCommitteeAssignments.json.")
        }

        isLoaded = true
    }

    func lookup(zip: String, coordinate: RepsGeoCoordinate?, locality: String?) -> RepsLookupResult? {
        guard let stateCode = stateResolver.stateCode(for: zip),
              let senators = senatorsByState[stateCode],
              !senators.isEmpty else {
            return nil
        }

        let orderedSenators = senators.sorted { lhs, rhs in
            let lhsRank = senateClassSortRank(lhs.senate_class)
            let rhsRank = senateClassSortRank(rhs.senate_class)
            if lhsRank != rhsRank {
                return lhsRank < rhsRank
            }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }

        let officials = orderedSenators.map { senator in
            let websiteURL = normalizedWebsiteURL(senator.url)
            let directAssignments = parsedCommitteeAssignments(senator.committee_assignments)
            let fallbackAssignments = committeeAssignmentsFromDataset(for: senator)
            let committeeAssignments = mergedCommitteeAssignments(
                primary: directAssignments,
                fallback: fallbackAssignments
            )
            return Official(
                name: senator.name,
                divisionId: "ocd-division/country:us/state:\(stateCode.lowercased())",
                party: senator.party,
                officeTitle: "U.S. Senator",
                photoURL: nil,
                url: websiteURL,
                officialPhone: normalizedOfficialPhone(senator.phone),
                websiteURL: websiteURL,
                contactFormURL: resolvedLegislativeContactURL(
                    explicitContactURL: senator.contact_form_url,
                    websiteURL: websiteURL,
                    hostSuffix: ".senate.gov",
                    fallbackOverride: contactFormURLOverride(for: senator)
                ),
                committeeAssignments: committeeAssignments
            )
        }

        return RepsLookupResult(executive: [], federal: officials, state: [], city: [])
    }

    private func contactFormURLOverride(for senator: SenatorRecord) -> String? {
        let key = senator.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch key {
        case "dan sullivan":
            return "https://www.sullivan.senate.gov/contact/email/"
        default:
            return nil
        }
    }

    private func loadCommitteeAssignmentsByName() throws -> [String: [String]] {
        guard let url = bundle.url(forResource: "USSenateCommitteeAssignments", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            return [:]
        }

        let decoded = try JSONDecoder().decode([String: [String]].self, from: data)
        var normalizedLookup: [String: [String]] = [:]

        for (senatorName, assignments) in decoded {
            let canonicalAssignments = extractedCanonicalSenateCommittees(from: assignments)
            guard !canonicalAssignments.isEmpty else { continue }
            normalizedLookup[normalizedPersonNameKey(senatorName)] = canonicalAssignments
        }

        return normalizedLookup
    }

    private func committeeAssignmentsFromDataset(for senator: SenatorRecord) -> [String] {
        let candidateNames = [
            senator.name,
            senator.raw_name,
            reorderedName(from: senator.raw_name)
        ]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        for candidateName in candidateNames {
            let key = normalizedPersonNameKey(candidateName)
            if let assignments = committeesByNormalizedName[key], !assignments.isEmpty {
                return assignments
            }
        }

        return []
    }

    private func mergedCommitteeAssignments(primary: [String], fallback: [String]) -> [String] {
        var seen = Set<String>()
        var ordered: [String] = []

        for assignment in primary + fallback {
            let cleaned = assignment.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !cleaned.isEmpty else { continue }
            if seen.insert(cleaned).inserted {
                ordered.append(cleaned)
            }
        }

        return ordered
    }

    private func resolvedLegislativeContactURL(
        explicitContactURL: String?,
        websiteURL: String?,
        hostSuffix: String,
        fallbackOverride: String?
    ) -> String? {
        if let explicitContactURL = normalizedWebsiteURL(explicitContactURL) {
            return explicitContactURL
        }
        if let fallbackOverride = normalizedWebsiteURL(fallbackOverride) {
            return fallbackOverride
        }
        return defaultLegislativeContactURL(from: websiteURL, hostSuffix: hostSuffix)
    }

    private func defaultLegislativeContactURL(from websiteURL: String?, hostSuffix: String) -> String? {
        guard let normalizedWebsite = normalizedWebsiteURL(websiteURL),
              let website = URL(string: normalizedWebsite),
              let host = website.host?.lowercased(),
              host.hasSuffix(hostSuffix) else {
            return nil
        }

        var components = URLComponents()
        components.scheme = website.scheme ?? "https"
        components.host = host
        components.path = "/contact"
        return components.url?.absoluteString
    }

    private func normalizedWebsiteURL(_ value: String?) -> String? {
        normalizedOfficialWebsiteURL(value)
    }
}

final class StateCongressionalBoundaryResolver: @unchecked Sendable {
    private struct BoundaryPayload: Codable {
        let districts: [DistrictBoundary]
    }

    private struct DistrictBoundary: Codable {
        let district: String
        let bbox: [Double]
        let rings: [[[Double]]]
    }

    private let bundle: Bundle
    private let resourceName: String
    private let lock = NSLock()
    private var boundaries: [DistrictBoundary] = []
    private var attemptedLocalLoad = false
    private var remoteFetchTask: Task<Void, Never>?

    init(resourceName: String, bundle: Bundle = .main) {
        self.resourceName = resourceName
        self.bundle = bundle
    }

    func district(for coordinate: RepsGeoCoordinate) -> String? {
        guard loadIfNeeded() else { return nil }

        let pointLon = coordinate.longitude
        let pointLat = coordinate.latitude

        for boundary in boundaries {
            guard boundary.bbox.count == 4 else { continue }
            let minLon = boundary.bbox[0]
            let minLat = boundary.bbox[1]
            let maxLon = boundary.bbox[2]
            let maxLat = boundary.bbox[3]

            guard pointLon >= minLon,
                  pointLon <= maxLon,
                  pointLat >= minLat,
                  pointLat <= maxLat else {
                continue
            }

            var inside = false
            for ring in boundary.rings where contains(pointLon: pointLon, pointLat: pointLat, in: ring) {
                inside.toggle()
            }

            if inside {
                return normalizeDistrict(boundary.district)
            }
        }

        return nil
    }

    /// Warm in-memory and on-disk cache without blocking the caller.
    /// Call once the user's state is known so async remote fetch has time to
    /// complete before they need a district lookup.
    func prefetch() {
        _ = loadIfNeeded()
    }

    private func loadIfNeeded() -> Bool {
        lock.lock()
        defer { lock.unlock() }

        if !boundaries.isEmpty { return true }
        if attemptedLocalLoad { return false }

        attemptedLocalLoad = true

        if let cached = readCache() {
            boundaries = cached
            return true
        }

        if let bundled = readBundle() {
            boundaries = bundled
            return true
        }

        triggerRemoteFetchLocked()
        return false
    }

    private func readCache() -> [DistrictBoundary]? {
        guard let url = Self.cacheURL(for: resourceName),
              FileManager.default.fileExists(atPath: url.path),
              let data = try? Data(contentsOf: url),
              let payload = try? JSONDecoder().decode(BoundaryPayload.self, from: data) else {
            return nil
        }
        return payload.districts
    }

    private func readBundle() -> [DistrictBoundary]? {
        guard let url = bundle.url(forResource: resourceName, withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let payload = try? JSONDecoder().decode(BoundaryPayload.self, from: data) else {
            return nil
        }
        return payload.districts
    }

    private func triggerRemoteFetchLocked() {
        guard remoteFetchTask == nil, let remoteURL = Self.remoteURL(for: resourceName) else {
            return
        }
        remoteFetchTask = Task.detached { [weak self] in
            await self?.performRemoteFetch(from: remoteURL)
        }
    }

    private func performRemoteFetch(from url: URL) async {
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return
            }
            let payload = try JSONDecoder().decode(BoundaryPayload.self, from: data)
            if let cacheURL = Self.cacheURL(for: resourceName) {
                try? data.write(to: cacheURL, options: .atomic)
            }
            lock.lock()
            boundaries = payload.districts
            lock.unlock()
        } catch {
            // Leave fetch task slot occupied; resolver instance stays cold for
            // this app launch. Next launch retries via the same lazy path.
        }
    }

    private static var supabaseStorageBase: URL? {
        guard let urlString = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
              let baseURL = URL(string: urlString) else {
            return nil
        }
        return baseURL.appendingPathComponent("storage/v1/object/public/districts", isDirectory: true)
    }

    private static func remoteURL(for resourceName: String) -> URL? {
        supabaseStorageBase?.appendingPathComponent("\(resourceName).json")
    }

    private static func cacheURL(for resourceName: String) -> URL? {
        guard let cachesDir = try? FileManager.default.url(
            for: .cachesDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: false
        ) else {
            return nil
        }
        let dir = cachesDir.appendingPathComponent("districts", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir.appendingPathComponent("\(resourceName).json")
    }

    private func contains(pointLon: Double, pointLat: Double, in ring: [[Double]]) -> Bool {
        guard ring.count >= 3 else { return false }

        var inside = false
        var j = ring.count - 1

        for i in 0..<ring.count {
            guard ring[i].count >= 2, ring[j].count >= 2 else {
                j = i
                continue
            }

            let xi = ring[i][0]
            let yi = ring[i][1]
            let xj = ring[j][0]
            let yj = ring[j][1]

            let intersects = ((yi > pointLat) != (yj > pointLat)) &&
                (pointLon < (xj - xi) * (pointLat - yi) / ((yj - yi) + 0.0000000001) + xi)
            if intersects {
                inside.toggle()
            }

            j = i
        }

        return inside
    }

    private func normalizeDistrict(_ district: String) -> String {
        let trimmed = district.trimmingCharacters(in: .whitespacesAndNewlines)
        if let number = Int(trimmed) {
            return String(number)
        }
        let stripped = trimmed.trimmingCharacters(in: CharacterSet(charactersIn: "0"))
        return stripped.isEmpty ? trimmed : stripped
    }

    private func nearestDistrict(pointLon: Double, pointLat: Double) -> String? {
        var minBBoxDistanceSq = Double.greatestFiniteMagnitude
        var bboxCandidates: [DistrictBoundary] = []

        for boundary in boundaries {
            guard boundary.bbox.count == 4 else { continue }

            let minLon = boundary.bbox[0]
            let minLat = boundary.bbox[1]
            let maxLon = boundary.bbox[2]
            let maxLat = boundary.bbox[3]

            let distanceSq = distanceSquaredToBBox(
                pointLon: pointLon,
                pointLat: pointLat,
                minLon: minLon,
                minLat: minLat,
                maxLon: maxLon,
                maxLat: maxLat
            )

            if distanceSq < minBBoxDistanceSq - 1e-12 {
                minBBoxDistanceSq = distanceSq
                bboxCandidates = [boundary]
            } else if abs(distanceSq - minBBoxDistanceSq) <= 1e-12 {
                bboxCandidates.append(boundary)
            }
        }

        guard !bboxCandidates.isEmpty else { return nil }
        if bboxCandidates.count == 1 {
            return normalizeDistrict(bboxCandidates[0].district)
        }

        var bestDistrict: String?
        var minVertexDistanceSq = Double.greatestFiniteMagnitude

        for boundary in bboxCandidates {
            let vertexDistanceSq = minDistanceSquaredToRingVertices(
                pointLon: pointLon,
                pointLat: pointLat,
                rings: boundary.rings
            )

            if vertexDistanceSq < minVertexDistanceSq {
                minVertexDistanceSq = vertexDistanceSq
                bestDistrict = normalizeDistrict(boundary.district)
            }
        }

        return bestDistrict ?? normalizeDistrict(bboxCandidates[0].district)
    }

    private func distanceSquaredToBBox(
        pointLon: Double,
        pointLat: Double,
        minLon: Double,
        minLat: Double,
        maxLon: Double,
        maxLat: Double
    ) -> Double {
        let dx: Double
        if pointLon < minLon {
            dx = minLon - pointLon
        } else if pointLon > maxLon {
            dx = pointLon - maxLon
        } else {
            dx = 0
        }

        let dy: Double
        if pointLat < minLat {
            dy = minLat - pointLat
        } else if pointLat > maxLat {
            dy = pointLat - maxLat
        } else {
            dy = 0
        }

        return (dx * dx) + (dy * dy)
    }

    private func minDistanceSquaredToRingVertices(
        pointLon: Double,
        pointLat: Double,
        rings: [[[Double]]]
    ) -> Double {
        var minDistanceSq = Double.greatestFiniteMagnitude

        for ring in rings {
            for coordinate in ring where coordinate.count >= 2 {
                let dx = coordinate[0] - pointLon
                let dy = coordinate[1] - pointLat
                let distanceSq = (dx * dx) + (dy * dy)
                if distanceSq < minDistanceSq {
                    minDistanceSq = distanceSq
                }
            }
        }

        return minDistanceSq
    }
}

final class USHouseMembersProvider: RepsProvider {
    private struct HouseRecord: Codable {
        let state_code: String
        let state_name: String
        let district: String
        let district_key: String
        let name: String
        let party: String
        let party_code: String
        let office_room: String
        let phone: String
        let committee_assignment: String
        let vacancy_flagged: Bool
        let url: String?
        let contact_form_url: String?
    }

    let id = "us-house-members"

    let supportedStateCodes: Set<String> = allUSStateAndTerritoryCodes

    private let bundle: Bundle
    private let stateResolver = USZipStateResolver()
    private let districtResolversByState: [String: StateCongressionalBoundaryResolver]
    private var membersByState: [String: [HouseRecord]] = [:]
    private var isLoaded = false

    init(bundle: Bundle = .main) {
        self.bundle = bundle
        self.districtResolversByState = [
            "MA": StateCongressionalBoundaryResolver(resourceName: "MassachusettsCongressionalDistricts118", bundle: bundle),
            "AL": StateCongressionalBoundaryResolver(resourceName: "AlabamaCongressionalDistricts118", bundle: bundle),
            "AK": StateCongressionalBoundaryResolver(resourceName: "AlaskaCongressionalDistricts118", bundle: bundle),
            "AZ": StateCongressionalBoundaryResolver(resourceName: "ArizonaCongressionalDistricts118", bundle: bundle),
            "AR": StateCongressionalBoundaryResolver(resourceName: "ArkansasCongressionalDistricts118", bundle: bundle),
            "CA": StateCongressionalBoundaryResolver(resourceName: "CaliforniaCongressionalDistricts118", bundle: bundle),
            "CO": StateCongressionalBoundaryResolver(resourceName: "ColoradoCongressionalDistricts118", bundle: bundle),
            "CT": StateCongressionalBoundaryResolver(resourceName: "ConnecticutCongressionalDistricts118", bundle: bundle),
            "DE": StateCongressionalBoundaryResolver(resourceName: "DelawareCongressionalDistricts118", bundle: bundle),
            "DC": StateCongressionalBoundaryResolver(resourceName: "DistrictOfColumbiaCongressionalDistricts118", bundle: bundle),
            "FL": StateCongressionalBoundaryResolver(resourceName: "FloridaCongressionalDistricts118", bundle: bundle),
            "GA": StateCongressionalBoundaryResolver(resourceName: "GeorgiaCongressionalDistricts118", bundle: bundle),
            "HI": StateCongressionalBoundaryResolver(resourceName: "HawaiiCongressionalDistricts118", bundle: bundle),
            "ID": StateCongressionalBoundaryResolver(resourceName: "IdahoCongressionalDistricts118", bundle: bundle),
            "IL": StateCongressionalBoundaryResolver(resourceName: "IllinoisCongressionalDistricts118", bundle: bundle),
            "IN": StateCongressionalBoundaryResolver(resourceName: "IndianaCongressionalDistricts118", bundle: bundle),
            "IA": StateCongressionalBoundaryResolver(resourceName: "IowaCongressionalDistricts118", bundle: bundle),
            "KS": StateCongressionalBoundaryResolver(resourceName: "KansasCongressionalDistricts118", bundle: bundle),
            "KY": StateCongressionalBoundaryResolver(resourceName: "KentuckyCongressionalDistricts118", bundle: bundle),
            "LA": StateCongressionalBoundaryResolver(resourceName: "LouisianaCongressionalDistricts118", bundle: bundle),
            "ME": StateCongressionalBoundaryResolver(resourceName: "MaineCongressionalDistricts118", bundle: bundle),
            "MD": StateCongressionalBoundaryResolver(resourceName: "MarylandCongressionalDistricts118", bundle: bundle),
            "MI": StateCongressionalBoundaryResolver(resourceName: "MichiganCongressionalDistricts118", bundle: bundle),
            "MN": StateCongressionalBoundaryResolver(resourceName: "MinnesotaCongressionalDistricts118", bundle: bundle),
            "MS": StateCongressionalBoundaryResolver(resourceName: "MississippiCongressionalDistricts118", bundle: bundle),
            "MO": StateCongressionalBoundaryResolver(resourceName: "MissouriCongressionalDistricts118", bundle: bundle),
            "MT": StateCongressionalBoundaryResolver(resourceName: "MontanaCongressionalDistricts118", bundle: bundle),
            "NE": StateCongressionalBoundaryResolver(resourceName: "NebraskaCongressionalDistricts118", bundle: bundle),
            "NV": StateCongressionalBoundaryResolver(resourceName: "NevadaCongressionalDistricts118", bundle: bundle),
            "NH": StateCongressionalBoundaryResolver(resourceName: "NewHampshireCongressionalDistricts118", bundle: bundle),
            "NJ": StateCongressionalBoundaryResolver(resourceName: "NewJerseyCongressionalDistricts118", bundle: bundle),
            "NM": StateCongressionalBoundaryResolver(resourceName: "NewMexicoCongressionalDistricts118", bundle: bundle),
            "NY": StateCongressionalBoundaryResolver(resourceName: "NewYorkCongressionalDistricts118", bundle: bundle),
            "NC": StateCongressionalBoundaryResolver(resourceName: "NorthCarolinaCongressionalDistricts118", bundle: bundle),
            "ND": StateCongressionalBoundaryResolver(resourceName: "NorthDakotaCongressionalDistricts118", bundle: bundle),
            "OH": StateCongressionalBoundaryResolver(resourceName: "OhioCongressionalDistricts118", bundle: bundle),
            "OK": StateCongressionalBoundaryResolver(resourceName: "OklahomaCongressionalDistricts118", bundle: bundle),
            "OR": StateCongressionalBoundaryResolver(resourceName: "OregonCongressionalDistricts118", bundle: bundle),
            "PA": StateCongressionalBoundaryResolver(resourceName: "PennsylvaniaCongressionalDistricts118", bundle: bundle),
            "RI": StateCongressionalBoundaryResolver(resourceName: "RhodeIslandCongressionalDistricts118", bundle: bundle),
            "SC": StateCongressionalBoundaryResolver(resourceName: "SouthCarolinaCongressionalDistricts118", bundle: bundle),
            "SD": StateCongressionalBoundaryResolver(resourceName: "SouthDakotaCongressionalDistricts118", bundle: bundle),
            "TN": StateCongressionalBoundaryResolver(resourceName: "TennesseeCongressionalDistricts118", bundle: bundle),
            "TX": StateCongressionalBoundaryResolver(resourceName: "TexasCongressionalDistricts118", bundle: bundle),
            "UT": StateCongressionalBoundaryResolver(resourceName: "UtahCongressionalDistricts118", bundle: bundle),
            "VT": StateCongressionalBoundaryResolver(resourceName: "VermontCongressionalDistricts118", bundle: bundle),
            "VA": StateCongressionalBoundaryResolver(resourceName: "VirginiaCongressionalDistricts118", bundle: bundle),
            "WA": StateCongressionalBoundaryResolver(resourceName: "WashingtonCongressionalDistricts118", bundle: bundle),
            "WV": StateCongressionalBoundaryResolver(resourceName: "WestVirginiaCongressionalDistricts118", bundle: bundle),
            "WI": StateCongressionalBoundaryResolver(resourceName: "WisconsinCongressionalDistricts118", bundle: bundle),
            "WY": StateCongressionalBoundaryResolver(resourceName: "WyomingCongressionalDistricts118", bundle: bundle),
            "AS": StateCongressionalBoundaryResolver(resourceName: "AmericanSamoaCongressionalDistricts118", bundle: bundle),
            "GU": StateCongressionalBoundaryResolver(resourceName: "GuamCongressionalDistricts118", bundle: bundle),
            "MP": StateCongressionalBoundaryResolver(resourceName: "NorthernMarianaIslandsCongressionalDistricts118", bundle: bundle),
            "PR": StateCongressionalBoundaryResolver(resourceName: "PuertoRicoCongressionalDistricts118", bundle: bundle),
            "VI": StateCongressionalBoundaryResolver(resourceName: "VirginIslandsCongressionalDistricts118", bundle: bundle)
        ]
    }

    func load() throws {
        guard !isLoaded else { return }

        guard let url = bundle.url(forResource: "USHouseMembers", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            throw RepsProviderError.dataLoad(message: "US House members data file is missing.")
        }

        do {
            let entries = try JSONDecoder().decode([HouseRecord].self, from: data)
            membersByState = Dictionary(grouping: entries, by: { $0.state_code })
        } catch {
            throw RepsProviderError.dataLoad(message: "Could not parse US House members data.")
        }

        isLoaded = true
    }

    func lookup(zip: String, coordinate: RepsGeoCoordinate?, locality: String?) -> RepsLookupResult? {
        guard let stateCode = stateResolver.stateCode(for: zip),
              let members = membersByState[stateCode],
              !members.isEmpty else {
            return nil
        }

        // NYC ZIPs have an explicit ZIP->district mapping in app data.
        // Use that mapping so we can still return a single House member from the canonical dataset.
        if stateCode == "NY",
           let mappedDistrict = zipToDistrictMap[zip]?["congressional"] {
            let normalizedMappedDistrict = normalizeDistrict(mappedDistrict)
            if let match = members.first(where: {
                normalizeDistrict($0.district) == normalizedMappedDistrict
                    || normalizeDistrict($0.district_key) == normalizedMappedDistrict
            }) {
                return RepsLookupResult(
                    executive: [],
                    federal: [official(from: match)],
                    state: [],
                    city: []
                )
            }
        }

        if let coordinate = coordinate,
           let resolver = districtResolversByState[stateCode],
           let district = resolver.district(for: coordinate),
           let match = members.first(where: { normalizeDistrict($0.district) == district }) {
            return RepsLookupResult(
                executive: [],
                federal: [official(from: match)],
                state: [],
                city: []
            )
        }

        // If there's a single at-large/delegate seat, return only that member.
        if members.count == 1 {
            return RepsLookupResult(
                executive: [],
                federal: [official(from: members[0])],
                state: [],
                city: []
            )
        }

        // District could not be resolved for a multi-member state.
        // Return unresolved instead of returning an incorrect full delegation.
        return nil
    }

    private func official(from member: HouseRecord) -> Official {
        let stateCodeLower = member.state_code.lowercased()
        let divisionId: String

        switch member.district_key {
        case "at_large", "delegate", "resident_commissioner":
            divisionId = "ocd-division/country:us/state:\(stateCodeLower)/cd:at_large"
        default:
            if let districtNumber = Int(member.district) {
                divisionId = "ocd-division/country:us/state:\(stateCodeLower)/cd:\(districtNumber)"
            } else {
                divisionId = "ocd-division/country:us/state:\(stateCodeLower)/cd:\(member.district_key)"
            }
        }

        let websiteURL = normalizedWebsiteURL(member.url)
        return Official(
            name: displayNameOverride(for: member) ?? formattedDisplayName(from: member.name),
            divisionId: divisionId,
            party: member.party,
            photoURL: photoURLOverride(for: member),
            url: websiteURL,
            officialPhone: normalizedOfficialPhone(member.phone),
            websiteURL: websiteURL,
            contactFormURL: resolvedLegislativeContactURL(
                explicitContactURL: member.contact_form_url,
                websiteURL: websiteURL,
                hostSuffix: ".house.gov",
                fallbackOverride: contactFormURLOverride(for: member)
            ),
            committeeAssignments: parsedCommitteeAssignments(member.committee_assignment)
        )
    }

    private func displayNameOverride(for member: HouseRecord) -> String? {
        if member.state_code == "FL", member.district == "17" {
            return "Greg Steube"
        }
        return nil
    }

    private func formattedDisplayName(from rawName: String) -> String {
        let parts = rawName
            .split(separator: ",", maxSplits: 1, omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }

        guard parts.count == 2 else { return rawName }
        let last = parts[0]
        let first = parts[1]
        guard !first.isEmpty, !last.isEmpty else { return rawName }
        return "\(first) \(last)"
    }

    private func normalizedWebsiteURL(_ value: String?) -> String? {
        normalizedOfficialWebsiteURL(value)
    }

    private func contactFormURLOverride(for member: HouseRecord) -> String? {
        if member.state_code == "AL", member.district == "1" {
            return "https://barrymoore.house.gov/contact/"
        }
        if member.state_code == "FL", member.district == "17" {
            return "https://steube.house.gov/contact/"
        }
        return nil
    }

    private func photoURLOverride(for member: HouseRecord) -> String? {
        if member.state_code == "FL", member.district == "17" {
            return "https://steube.house.gov/wp-content/uploads/2023/05/steube-tbg.png"
        }
        return nil
    }

    private func resolvedLegislativeContactURL(
        explicitContactURL: String?,
        websiteURL: String?,
        hostSuffix: String,
        fallbackOverride: String?
    ) -> String? {
        if let explicitContactURL = normalizedWebsiteURL(explicitContactURL) {
            return explicitContactURL
        }
        if let fallbackOverride = normalizedWebsiteURL(fallbackOverride) {
            return fallbackOverride
        }
        return defaultLegislativeContactURL(from: websiteURL, hostSuffix: hostSuffix)
    }

    private func defaultLegislativeContactURL(from websiteURL: String?, hostSuffix: String) -> String? {
        guard let normalizedWebsite = normalizedWebsiteURL(websiteURL),
              let website = URL(string: normalizedWebsite),
              let host = website.host?.lowercased(),
              host.hasSuffix(hostSuffix) else {
            return nil
        }

        var components = URLComponents()
        components.scheme = website.scheme ?? "https"
        components.host = host
        components.path = "/contact"
        return components.url?.absoluteString
    }

    private func sortKey(for districtKey: String) -> (Int, String) {
        if let numeric = Int(districtKey) {
            return (numeric, "")
        }
        if districtKey == "at_large" || districtKey == "delegate" || districtKey == "resident_commissioner" {
            return (0, districtKey)
        }
        return (9999, districtKey)
    }

    private func normalizeDistrict(_ district: String) -> String {
        let trimmed = district.trimmingCharacters(in: .whitespacesAndNewlines)
        if let number = Int(trimmed) {
            return String(number)
        }
        let stripped = trimmed.trimmingCharacters(in: CharacterSet(charactersIn: "0"))
        return stripped.isEmpty ? trimmed : stripped
    }
}

final class USMayorsProvider: RepsProvider {
    private struct MayorRecord: Codable {
        let rank: Int
        let city: String
        let state_name: String
        let state_code: String
        let population_2024: Int
        let name: String?
        let party: String?
        let url: String?
    }

    let id = "us-mayors-top50"
    let supportedStateCodes: Set<String>
    private let preferredMayorWebsiteByName: [String: String] = [
        "joe hogsett": "https://www.indy.gov/agency/office-of-the-mayor",
        "craig greenberg": "https://louisvilleky.gov/government/mayor-craig-greenberg",
        "freddie o connell": "https://www.nashville.gov/departments/mayor",
        "freddie oconnell": "https://www.nashville.gov/departments/mayor",
        "kirk watson": "https://www.austintexas.gov/department/mayor-kirk-watson",
        "levar stoney": "https://www.rva.gov/mayors-office",
        "satya rhodes conway": "https://www.cityofmadison.com/mayor",
        "andrew ginther": "https://www.columbus.gov/Government/Mayors-Office/"
    ]

    private let bundle: Bundle
    private let stateResolver = USZipStateResolver()
    private var mayorsByState: [String: [MayorRecord]] = [:]
    private var isLoaded = false

    init(bundle: Bundle = .main) {
        self.bundle = bundle
        self.supportedStateCodes = Self.deriveSupportedStateCodes(bundle: bundle)
    }

    func load() throws {
        guard !isLoaded else { return }

        guard let url = bundle.url(forResource: "USMayorsTop50", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            throw RepsProviderError.dataLoad(message: "US mayors data file is missing.")
        }

        do {
            let entries = try JSONDecoder().decode([MayorRecord].self, from: data)
            mayorsByState = Dictionary(grouping: entries, by: { $0.state_code })
        } catch {
            throw RepsProviderError.dataLoad(message: "Could not parse US mayors data.")
        }

        isLoaded = true
    }

    func lookup(zip: String, coordinate: RepsGeoCoordinate?, locality: String?) -> RepsLookupResult? {
        guard let stateCode = stateResolver.stateCode(for: zip),
              var mayors = mayorsByState[stateCode],
              !mayors.isEmpty else {
            return nil
        }

        guard let locality = locality, !locality.isEmpty else {
            return nil
        }

        mayors.sort { $0.rank < $1.rank }
        guard let matchingMayor = mayors.first(where: { cityMatches(mayorCity: $0.city, locality: locality) }),
              let official = official(from: matchingMayor) else {
            return nil
        }

        return RepsLookupResult(executive: [], federal: [], state: [], city: [official])
    }

    private func official(from mayor: MayorRecord) -> Official? {
        guard let name = mayor.name, !name.isEmpty else {
            return nil
        }

        let cleanedCity = cleanedMayorCityName(mayor.city)
        let stateCodeLower = mayor.state_code.lowercased()
        let place = normalizedPlace(from: cleanedCity)
        let divisionId = "ocd-division/country:us/state:\(stateCodeLower)/place:\(place)"

        return Official(
            name: name,
            divisionId: divisionId,
            party: mayor.party,
            officeTitle: "Mayor",
            photoURL: nil,
            url: normalizedMayorWebsiteURL(name: name, fallbackURL: mayor.url)
        )
    }

    private func cleanedMayorCityName(_ rawCity: String) -> String {
        var cleaned = rawCity
            .replacingOccurrences(of: #"\s*\(balance\)\s*"#, with: "", options: [.regularExpression, .caseInsensitive])
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if let firstPart = cleaned.split(separator: "/", maxSplits: 1, omittingEmptySubsequences: true).first {
            cleaned = firstPart.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        if let firstPart = cleaned.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: true).first,
           cleaned.lowercased().contains("county") || cleaned.lowercased().contains("davidson") {
            cleaned = firstPart.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        return cleaned
    }

    private func normalizedMayorWebsiteURL(name: String, fallbackURL: String?) -> String? {
        let lookupKey = normalizedLookupKey(name)
        if let preferred = preferredMayorWebsiteByName[lookupKey] {
            return preferred
        }
        return normalizedOfficialWebsiteURL(fallbackURL)
    }

    private func normalizedLookupKey(_ raw: String) -> String {
        let folded = raw.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        return folded
            .lowercased()
            .replacingOccurrences(of: #"[^\p{L}\p{N}]+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s{2,}"#, with: " ", options: .regularExpression)
    }

    private func normalizedPlace(from city: String) -> String {
        let lower = city.lowercased()
        let allowed = Set("abcdefghijklmnopqrstuvwxyz0123456789")
        var cleaned = ""
        var lastWasDash = false

        for scalar in lower.unicodeScalars {
            let ch = Character(scalar)
            if allowed.contains(ch) {
                cleaned.append(ch)
                lastWasDash = false
            } else if !lastWasDash {
                cleaned.append("-")
                lastWasDash = true
            }
        }

        return cleaned.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }

    private func cityMatches(mayorCity: String, locality: String) -> Bool {
        let normalizedMayor = normalizedCityName(mayorCity)
        let normalizedLocality = normalizedCityName(locality)

        guard !normalizedMayor.isEmpty, !normalizedLocality.isEmpty else {
            return false
        }

        if normalizedMayor == normalizedLocality {
            return true
        }

        let canonicalMayor = canonicalCityName(normalizedMayor)
        let canonicalLocality = canonicalCityName(normalizedLocality)
        if canonicalMayor == canonicalLocality {
            return true
        }

        if explicitCityAliases[canonicalMayor]?.contains(canonicalLocality) == true {
            return true
        }
        if explicitCityAliases[canonicalLocality]?.contains(canonicalMayor) == true {
            return true
        }

        return false
    }

    private static func deriveSupportedStateCodes(bundle: Bundle) -> Set<String> {
        guard let url = bundle.url(forResource: "USMayorsTop50", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let entries = try? JSONDecoder().decode([MayorRecord].self, from: data) else {
            return []
        }

        return Set(
            entries
                .map { $0.state_code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() }
                .filter { allUSStateAndTerritoryCodes.contains($0) }
        )
    }

    private let explicitCityAliases: [String: Set<String>] = [
        "nashville": ["nashville davidson"],
        "nashville davidson": ["nashville"],
        "louisville": ["louisville jefferson county"],
        "louisville jefferson county": ["louisville"],
        "indianapolis": ["indianapolis marion county"],
        "indianapolis marion county": ["indianapolis"],
        "new york": ["new york city", "nyc"],
        "new york city": ["new york", "nyc"],
        "nyc": ["new york", "new york city"]
    ]

    private func normalizedCityName(_ value: String) -> String {
        let folded = value.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        let lower = folded.lowercased()
        let allowed = Set("abcdefghijklmnopqrstuvwxyz0123456789")
        var normalized = ""
        var lastWasSpace = true

        for scalar in lower.unicodeScalars {
            let ch = Character(scalar)
            if allowed.contains(ch) {
                normalized.append(ch)
                lastWasSpace = false
            } else if !lastWasSpace {
                normalized.append(" ")
                lastWasSpace = true
            }
        }

        return normalized.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func canonicalCityName(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return trimmed }

        let mappedTokens = trimmed.split(separator: " ").map { token -> String in
            let value = String(token)
            switch value {
            case "st":
                return "saint"
            case "mt":
                return "mount"
            default:
                return value
            }
        }

        var canonical = mappedTokens
            .filter { $0 != "balance" }
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if canonical.hasSuffix(" city") {
            canonical = String(canonical.dropLast(5))
        }

        return canonical
    }
}

final class RepsProviderRegistry {
    private let providers: [RepsProvider]
    private let stateResolver = USZipStateResolver()
    private let criticalProviderIDs: Set<String> = [
        "us-governors",
        "us-senators",
        "us-house-members"
    ]

    init(providers: [RepsProvider]) {
        self.providers = providers
    }

    static func defaultRegistry() -> RepsProviderRegistry {
        RepsProviderRegistry(providers: [
            NewYorkRepsProvider(),
            USExecutiveProvider(),
            USGovernorsProvider(),
            USSenatorsProvider(),
            USHouseMembersProvider(),
            USMayorsProvider()
        ])
    }

    func normalizedZIP(_ zip: String) -> String {
        String(zip.filter(\.isNumber).prefix(5))
    }

    func resolvedStateCode(for zip: String) -> String? {
        stateResolver.stateCode(for: zip)
    }

    func representativeZIP(for stateCode: String) -> String? {
        stateResolver.representativeZIP(for: stateCode)
    }

    func lookup(zip: String) throws -> RepsLookupResult {
        try lookup(zip: zip, coordinate: nil, locality: nil)
    }

    func lookup(zip: String, coordinate: RepsGeoCoordinate?) throws -> RepsLookupResult {
        try lookup(zip: zip, coordinate: coordinate, locality: nil)
    }

    func lookup(zip: String, coordinate: RepsGeoCoordinate?, locality: String?) throws -> RepsLookupResult {
        let normalized = normalizedZIP(zip)
        guard normalized.count == 5 else {
            throw RepsProviderError.invalidZip
        }

        let stateCode = resolvedStateCode(for: normalized)
        guard let stateCode = stateCode else {
            throw RepsProviderError.unsupportedState(stateCode: nil)
        }

        let candidates = providers.filter { $0.supportedStateCodes.contains(stateCode) }
        guard !candidates.isEmpty else {
            throw RepsProviderError.unsupportedState(stateCode: stateCode)
        }

        var combined = RepsLookupResult.empty
        var foundAny = false
        var lastLoadError: RepsProviderError?

        for provider in candidates {
            do {
                try provider.load()
            } catch let providerError as RepsProviderError {
                if criticalProviderIDs.contains(provider.id) {
                    throw providerError
                }
                lastLoadError = providerError
                continue
            } catch {
                if criticalProviderIDs.contains(provider.id) {
                    throw RepsProviderError.dataLoad(message: "Critical representative data is temporarily unavailable.")
                }
                continue
            }

            if let result = provider.lookup(zip: normalized, coordinate: coordinate, locality: locality) {
                combined = combined.merging(result)
                foundAny = true
            }
        }

        if foundAny {
            return combined
        }

        if let lastLoadError = lastLoadError {
            throw lastLoadError
        }

        throw RepsProviderError.unsupportedZip(zip: normalized, stateCode: stateCode)
    }
}
