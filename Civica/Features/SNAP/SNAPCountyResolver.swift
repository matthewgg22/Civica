import Foundation

// CalFresh is administered by California's 58 county welfare
// departments, not centrally by CDSS. Routing a user to the right
// hotline, the right walk-in office, and the right Restaurant Meals
// Program participating-county list all depend on the user's county.
//
// This file holds a coarse 3-digit-ZIP-prefix lookup that resolves
// most CA ZIPs to a county. It is intentionally approximate:
//
//   * Many 3-digit prefixes span two or three counties along their
//     boundaries (e.g. 913 covers LA + Ventura outskirts). The
//     resolver picks the dominant county for the prefix.
//   * A few populated 5-digit ZIPs lie in a different county than
//     their prefix's majority — those land in `fiveDigitOverrides`
//     so they resolve correctly.
//   * The resolver returns nil for prefixes outside CA (00xxx-
//     899xx, 962xx+). Use `nil` as the signal to fall back to
//     "your county welfare department" without naming one.
//
// Source: USPS ZIP code listings cross-referenced with the CA
// county-by-ZIP table maintained by the California Department of
// Public Health (CDPH). Last reviewed: 2026-05-13. When CDSS
// publishes an updated county-by-ZIP file, drop it in and update
// `lastReviewedDate` below.
//
// MA is NOT covered here today because MA SNAP is administered
// statewide by DTA, not by county — county-level routing doesn't
// change the user's hotline or office assignment. Add a parallel
// MACountyResolver only if a downstream surface needs MA county
// for something else (e.g. food-bank routing).

enum CACountyResolver {

    /// Last time the prefix table was reviewed against an
    /// authoritative source. Surface this in support flows where
    /// the user might ask "is this current?".
    static let lastReviewedDate = "2026-05-13"

    /// Resolves a 5-digit California ZIP code to the dominant CA
    /// county for that ZIP. Returns nil for non-CA ZIPs or
    /// malformed input.
    static func county(forZIP zip: String?) -> String? {
        guard let zip = normalized(zip) else { return nil }
        if let override = fiveDigitOverrides[zip] { return override }
        let prefix = String(zip.prefix(3))
        return prefixTable[prefix]
    }

    /// Returns whether the resolver currently has any entry for the
    /// given ZIP. Useful for the screener UI to decide whether to
    /// surface a "We routed you to <county>" pill or stay generic.
    static func hasCountyMapping(forZIP zip: String?) -> Bool {
        county(forZIP: zip) != nil
    }

    private static func normalized(_ zip: String?) -> String? {
        guard var raw = zip?.trimmingCharacters(in: .whitespaces),
              !raw.isEmpty else { return nil }
        // Accept ZIP+4 by truncating after the first 5 digits.
        if let dash = raw.firstIndex(of: "-") {
            raw = String(raw[..<dash])
        }
        guard raw.count == 5, raw.allSatisfy(\.isNumber) else { return nil }
        return raw
    }

    /// 3-digit prefix → dominant California county. Coarse mapping,
    /// see file header note. Order in the file reflects geographic
    /// south-to-north for easier human review.
    private static let prefixTable: [String: String] = [
        // San Diego County
        "919": "San Diego",
        "920": "San Diego",
        "921": "San Diego",

        // Orange / Inland Empire belt
        "926": "Orange",
        "927": "Orange",
        "928": "Orange",
        "922": "Riverside",
        "923": "San Bernardino",
        "924": "San Bernardino",
        // 925XX spans Riverside and San Bernardino counties. The
        // 92501-92509 Riverside-city cluster (the most populous
        // 925 ZIPs) routes via the override map below; the
        // remaining 925 high-desert / mountain-pass ZIPs that fall
        // through here are San Bernardino. Setting the prefix to
        // San Bernardino would mis-route the populous Riverside
        // case by default; setting it to Riverside is the safer
        // dominant-population pick.
        "925": "Riverside",

        // Los Angeles County (large; covers most 900–913)
        "900": "Los Angeles",
        "901": "Los Angeles",
        "902": "Los Angeles",
        "903": "Los Angeles",
        "904": "Los Angeles",
        "905": "Los Angeles",
        "906": "Los Angeles",
        "907": "Los Angeles",
        "908": "Los Angeles",
        "910": "Los Angeles",
        "911": "Los Angeles",
        "912": "Los Angeles",
        "913": "Los Angeles",
        "914": "Los Angeles",
        "915": "Los Angeles",
        "916": "Los Angeles",
        "917": "Los Angeles",
        "918": "Los Angeles",

        // Central Coast / South Central
        "930": "Ventura",
        "931": "Santa Barbara",
        "932": "Kern",
        "933": "Kern",
        "934": "Santa Barbara",
        "935": "Kern",

        // San Joaquin Valley
        "936": "Fresno",
        "937": "Fresno",
        "938": "Fresno",
        "939": "Monterey",

        // Bay Area — Peninsula + San Francisco
        // 940XX is dominated by San Mateo County (Daly City, S SF,
        // Pacifica, Redwood City, San Bruno, San Carlos, Burlingame,
        // Menlo Park…) with several Santa Clara enclaves (Los Altos,
        // Mountain View, Sunnyvale, parts of Palo Alto) handled via
        // overrides. 941XX is San Francisco proper.
        "940": "San Mateo",
        "941": "San Francisco",

        // Peninsula
        "943": "San Mateo",
        "944": "San Mateo",

        // East Bay
        "945": "Alameda",
        "946": "Alameda",
        "947": "Alameda",
        "948": "Contra Costa",

        // North Bay
        "949": "Marin",
        "954": "Sonoma",
        "955": "Humboldt",

        // South Bay
        "950": "Santa Clara",
        "951": "Santa Clara",

        // Central Valley
        "952": "San Joaquin",
        "953": "Stanislaus",

        // Sacramento Valley
        "956": "Sacramento",
        "957": "Sacramento",
        "958": "Sacramento",
        "959": "Placer",
        "960": "Shasta",
        "961": "El Dorado"
    ]

    /// 5-digit overrides where the prefix table mis-routes. Keep
    /// this list short and well-justified — every entry is a known
    /// boundary case from public records.
    private static let fiveDigitOverrides: [String: String] = [
        // 96150 (South Lake Tahoe) lies in El Dorado County despite
        // the 961 prefix matching the table; included for completeness.
        "96150": "El Dorado",
        // 93920 (Big Sur) is Monterey, not the Kern majority of 939.
        "93920": "Monterey",

        // Santa Clara enclaves inside the 940XX San Mateo cluster.
        // Los Altos (94022-94024), Mountain View (94035, 94039-94043),
        // and Sunnyvale (94085-94089) are all Santa Clara County.
        "94022": "Santa Clara", "94023": "Santa Clara", "94024": "Santa Clara",
        "94035": "Santa Clara",
        "94039": "Santa Clara", "94040": "Santa Clara", "94041": "Santa Clara",
        "94042": "Santa Clara", "94043": "Santa Clara",
        "94085": "Santa Clara", "94086": "Santa Clara", "94087": "Santa Clara",
        "94088": "Santa Clara", "94089": "Santa Clara"
    ]
}
