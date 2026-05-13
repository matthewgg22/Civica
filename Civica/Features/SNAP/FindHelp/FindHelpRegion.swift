import Foundation

/// Geographic scope for FindHelp data ingestion and filtering.
///
/// The Civica demo ships CA-curated seed data (with MA seed retained
/// as the secondary region) and queries the live Supabase RPC with a
/// state bounding box on the USDA SNAP Retailer Locator ArcGIS
/// feature service. Flipping `FindHelpRegion.current` to `.nationwide`
/// lets the fixture loader stop pre-filtering and instructs the
/// future backend fetcher to drop its bbox clause.
///
/// **How to flip the active demo region:**
///
/// 1. Edit `Civica/Info.plist` and change the `FindHelpDemoRegion`
///    string — `"california"`, `"massachusetts"`, or `"nationwide"`.
/// 2. Rebuild the Civica scheme. No Swift edits required — the
///    enum reads the plist key on first access and the fixture
///    loader / future backend fetcher both consume `current`.
/// 3. For a one-off custom bbox (e.g. a Brooklyn pop-up), override
///    the static value in code with `.bbox(...)` rather than
///    threading a new plist string.
///
/// State bounding boxes are intentionally slightly-padded rectangles
/// rather than precise state polygons — pre-filtering fixtures is
/// the only consumer today, and a few cross-border false positives
/// are harmless. Tighten if the backend fetcher needs cleaner
/// ArcGIS query bounds.
enum FindHelpRegion: Equatable {
    case california
    case massachusetts
    case nationwide
    case bbox(minLat: Double, minLng: Double, maxLat: Double, maxLng: Double)

    /// App-wide active region. Resolved once from Info.plist on
    /// first access and cached; the hot search path reads this
    /// many times per query.
    static let current: FindHelpRegion = resolveFromInfoPlist()

    private static func resolveFromInfoPlist() -> FindHelpRegion {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "FindHelpDemoRegion") as? String else {
            return .california
        }
        switch raw.lowercased() {
        case "california", "ca":
            return .california
        case "massachusetts", "ma":
            return .massachusetts
        case "nationwide", "us":
            return .nationwide
        default:
            return .california
        }
    }

    /// Bounding box this region covers, or nil for `.nationwide`
    /// (no geographic filter). CA covers from the Mexico border at
    /// San Diego up to the Oregon line. MA covers the southern Cape
    /// up to the NH border, west across the Berkshires.
    var boundingBox: (minLat: Double, minLng: Double, maxLat: Double, maxLng: Double)? {
        switch self {
        case .california:
            return (minLat: 32.50, minLng: -124.45, maxLat: 42.05, maxLng: -114.10)
        case .massachusetts:
            return (minLat: 41.20, minLng: -73.60, maxLat: 42.95, maxLng: -69.85)
        case .nationwide:
            return nil
        case let .bbox(minLat, minLng, maxLat, maxLng):
            return (minLat, minLng, maxLat, maxLng)
        }
    }

    /// Whether a given coordinate falls within this region's
    /// bounding box. Returns true for `.nationwide` (no filter).
    func contains(lat: Double, lng: Double) -> Bool {
        guard let box = boundingBox else { return true }
        return lat >= box.minLat && lat <= box.maxLat
            && lng >= box.minLng && lng <= box.maxLng
    }

    /// Human-readable display name. Used in any "Showing demo data
    /// for: X" surfaces; today the FindHelp UI doesn't render this
    /// directly but it'll be needed once Step 5's layer toggle
    /// gains a region indicator.
    var displayName: String {
        switch self {
        case .california:    return "California"
        case .massachusetts: return "Massachusetts"
        case .nationwide:    return "Nationwide"
        case .bbox:          return "Custom region"
        }
    }
}
