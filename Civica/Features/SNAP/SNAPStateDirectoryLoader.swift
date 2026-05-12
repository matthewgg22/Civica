import Foundation
import OSLog

// Lazy loader for the bundled USDA SNAP State Directory snapshot.
// Source of truth for state SNAP agency name, hotline number, and
// official application URL surfaced on the eligibility result and
// privacy-notice screens. The JSON ships in the Civica bundle and
// is a static reference — no runtime fetch, no scraping.
//
// Snapshot metadata (source URL, snapshot date) is also exposed so
// the UI can render a "Last verified MMM YYYY" line when needed.
// When the directory expands beyond the seven states USDA currently
// publishes in the JSON, drop additional entries into the fixture
// and the lookup picks them up — no Swift change required.

enum SNAPStateDirectoryLoader {

    private static let logger = Logger(subsystem: "Civica", category: "SNAPStateDirectory")
    private static let resource = "usda_snap_state_directory"

    /// Lookup keyed by 2-letter state code (uppercased). Returns nil
    /// for states not present in the snapshot. Loaded once per
    /// process; subsequent calls return the cached map.
    static func entry(forStateCode stateCode: String?) -> SNAPStateDirectoryEntry? {
        guard let normalized = normalize(stateCode) else { return nil }
        return cache[normalized]
    }

    /// Snapshot date in YYYY-MM-DD form, e.g. "2026-05-10". Nil if
    /// the bundle is missing the fixture or decoding failed.
    static var snapshotDate: String? { snapshot?.snapshotDate }

    /// Source URL the snapshot was captured from. Nil under the same
    /// failure conditions as `snapshotDate`.
    static var sourceURL: String? { snapshot?.sourceURL }

    // MARK: - Private

    private static func normalize(_ code: String?) -> String? {
        let trimmed = (code ?? "").trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        return trimmed.isEmpty ? nil : trimmed
    }

    private static let cache: [String: SNAPStateDirectoryEntry] = {
        guard let snapshot else { return [:] }
        var map: [String: SNAPStateDirectoryEntry] = [:]
        for entry in snapshot.entries {
            map[entry.state.uppercased()] = entry
        }
        return map
    }()

    private static let snapshot: Snapshot? = {
        guard let url = Bundle.main.url(forResource: resource, withExtension: "json") else {
            logger.error("SNAP state directory missing from bundle")
            return nil
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(Snapshot.self, from: data)
        } catch {
            logger.error("SNAP state directory decode failed: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }()

    private struct Snapshot: Decodable {
        let source: String
        let sourceURL: String
        let snapshotDate: String
        let entries: [SNAPStateDirectoryEntry]

        enum CodingKeys: String, CodingKey {
            case source
            case sourceURL = "source_url"
            case snapshotDate = "snapshot_date"
            case entries
        }
    }
}

struct SNAPStateDirectoryEntry: Decodable, Equatable {
    let state: String
    let agencyName: String
    let hotline: String
    let website: String
    let capitalLat: Double
    let capitalLng: Double
    let capitalCity: String

    enum CodingKeys: String, CodingKey {
        case state
        case agencyName = "agency_name"
        case hotline
        case website
        case capitalLat = "capital_lat"
        case capitalLng = "capital_lng"
        case capitalCity = "capital_city"
    }

    /// Hotline reformatted for display. Falls back to the raw value
    /// if the digits don't match the expected 10-digit US format.
    /// Example: "+1-877-382-2363" -> "(877) 382-2363".
    var displayHotline: String {
        let digits = hotline.filter { $0.isNumber }
        let core: String
        if digits.count == 11, digits.hasPrefix("1") {
            core = String(digits.dropFirst())
        } else if digits.count == 10 {
            core = digits
        } else {
            return hotline
        }
        let area = core.prefix(3)
        let mid = core.dropFirst(3).prefix(3)
        let last = core.suffix(4)
        return "(\(area)) \(mid)-\(last)"
    }
}
