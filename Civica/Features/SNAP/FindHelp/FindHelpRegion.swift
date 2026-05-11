import Foundation

/// Geographic scope for FindHelp data ingestion and filtering.
///
/// The Civica demo ships MA-curated seed data and (will, once the
/// backend ingest lands) query the live Supabase RPC with a tight
/// Massachusetts bounding box on the USDA SNAP Retailer Locator
/// ArcGIS feature service. Flipping `FindHelpRegion.current` to
/// `.nationwide` lets the fixture loader stop pre-filtering and
/// instructs the future backend fetcher to drop its bbox clause.
///
/// **How to flip to nationwide for a demo or A/B:**
///
/// 1. Edit `Civica/Info.plist` and change the `FindHelpDemoRegion`
///    string from `"massachusetts"` to `"nationwide"`.
/// 2. Rebuild the Civica scheme. No Swift edits required — the
///    enum reads the plist key on first access and the fixture
///    loader / future backend fetcher both consume `current`.
/// 3. For a one-off custom bbox (e.g. a Brooklyn pop-up), override
///    the static value in code with `.bbox(...)` rather than
///    threading a new plist string.
///
/// The MA bounding box is intentionally a slightly-padded rectangle
/// rather than a precise state polygon — pre-filtering fixtures is
/// the only consumer today, and a few cross-border false positives
/// (e.g. a market in southern NH) are harmless. Tighten if the
/// backend fetcher needs cleaner ArcGIS query bounds.
enum FindHelpRegion: Equatable {
    case massachusetts
    case nationwide
    case bbox(minLat: Double, minLng: Double, maxLat: Double, maxLng: Double)

    /// App-wide active region. Resolved once from Info.plist on
    /// first access and cached; the hot search path reads this
    /// many times per query.
    static let current: FindHelpRegion = resolveFromInfoPlist()

    private static func resolveFromInfoPlist() -> FindHelpRegion {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "FindHelpDemoRegion") as? String else {
            return .massachusetts
        }
        switch raw.lowercased() {
        case "massachusetts", "ma":
            return .massachusetts
        case "nationwide", "us":
            return .nationwide
        default:
            return .massachusetts
        }
    }

    /// Bounding box this region covers, or nil for `.nationwide`
    /// (no geographic filter). The MA box covers from the southern
    /// Cape up to the NH border, west across the Berkshires.
    var boundingBox: (minLat: Double, minLng: Double, maxLat: Double, maxLng: Double)? {
        switch self {
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
        case .massachusetts: return "Massachusetts"
        case .nationwide:    return "Nationwide"
        case .bbox:          return "Custom region"
        }
    }
}
