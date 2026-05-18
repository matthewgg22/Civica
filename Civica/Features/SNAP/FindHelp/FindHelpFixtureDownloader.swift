import Foundation
import OSLog

/// Downloads large FindHelp fixture files from Supabase Storage and caches
/// them to the app's caches directory. The bundle ships only tiny stub
/// fixtures (~6 entries each) as a last-resort fallback; the full datasets
/// are fetched in the background on first launch and reused thereafter.
///
/// - `ca_retailers.json` — 14 MB USDA SNAP retailer snapshot for California
///
/// Call `prefetchIfNeeded()` at app launch. It returns immediately if all
/// files are already cached and is a no-op on repeated calls.
actor FindHelpFixtureDownloader {
    static let shared = FindHelpFixtureDownloader()

    private static let logger = Logger(subsystem: "Civica", category: "FindHelpFixtureDownloader")

    /// Root URL for the Supabase Storage public bucket. Derived from the
    /// configured Supabase project URL so it follows the same env as the
    /// rest of the app (staging vs. production).
    private static var bucketBaseURL: URL {
        SupabaseConfig.current.url
            .appendingPathComponent("storage/v1/object/public/snap-fixtures")
    }

    /// Caches directory shared with `FindHelpFixtureLoader`.
    static let cacheDirectory: URL = {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("FindHelpFixtures", isDirectory: true)
    }()

    /// Files too large to bundle — downloaded once and cached.
    private static let remoteFixtures = ["ca_retailers"]

    /// Dedicated session with explicit timeouts. URLSession.shared has
    /// no per-resource ceiling, which means a stalled cellular fetch
    /// could leave the background prefetch task hanging until the OS
    /// kills it. 30s per request and 120s for the whole transfer is
    /// generous for the 14 MB fixture without being unbounded.
    private static let downloadSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 120
        config.waitsForConnectivity = true
        return URLSession(configuration: config)
    }()

    /// Downloads any missing remote fixtures in the background.
    /// Safe to call at every launch; skips files that are already cached.
    func prefetchIfNeeded() async {
        for fixture in Self.remoteFixtures {
            let dest = Self.cacheDirectory.appendingPathComponent("\(fixture).json")
            guard !FileManager.default.fileExists(atPath: dest.path) else {
                Self.logger.debug("FindHelp fixture already cached: \(fixture, privacy: .public)")
                continue
            }
            await download(fixture: fixture, to: dest)
        }
    }

    /// Evicts all cached fixtures. Call when the user clears app data or
    /// when you need to force a re-download (e.g. after a data refresh).
    func clearCache() throws {
        if FileManager.default.fileExists(atPath: Self.cacheDirectory.path) {
            try FileManager.default.removeItem(at: Self.cacheDirectory)
            Self.logger.info("FindHelp fixture cache cleared")
        }
    }

    private func download(fixture: String, to dest: URL) async {
        let url = Self.bucketBaseURL.appendingPathComponent("\(fixture).json")
        Self.logger.info("Downloading FindHelp fixture: \(fixture, privacy: .public) from \(url.absoluteString, privacy: .public)")
        do {
            try FileManager.default.createDirectory(
                at: Self.cacheDirectory,
                withIntermediateDirectories: true
            )
            let (data, response) = try await Self.downloadSession.data(from: url)
            guard let http = response as? HTTPURLResponse else {
                Self.logger.error("FindHelp fixture download: unexpected response type for \(fixture, privacy: .public)")
                return
            }
            guard http.statusCode == 200 else {
                Self.logger.error("FindHelp fixture download HTTP \(http.statusCode, privacy: .public) for \(fixture, privacy: .public)")
                return
            }
            try data.write(to: dest, options: .atomic)
            Self.logger.info("FindHelp fixture cached: \(fixture, privacy: .public) (\(data.count / 1024, privacy: .public) KB)")
        } catch {
            Self.logger.error("FindHelp fixture download failed for \(fixture, privacy: .public): \(error.localizedDescription, privacy: .public)")
        }
    }
}
