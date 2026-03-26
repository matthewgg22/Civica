import Foundation
import OSLog

struct SupabaseConfig: Sendable {
    let url: URL
    let anonKey: String

    static let plistURLKey = "SUPABASE_URL"
    static let plistAnonKey = "SUPABASE_ANON_KEY"

    private static let fallbackURLString = "https://YOUR-PROJECT-REF.supabase.co"
    private static let fallbackAnonKey = "YOUR_SUPABASE_ANON_KEY"

    private static let logger = Logger(subsystem: "VoteNow", category: "SupabaseConfig")

    static let current = load()

    static func load(bundle: Bundle = .main) -> SupabaseConfig {
        let rawURL = (bundle.object(forInfoDictionaryKey: plistURLKey) as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let rawAnon = (bundle.object(forInfoDictionaryKey: plistAnonKey) as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let urlString = (rawURL?.isEmpty == false ? rawURL : fallbackURLString) ?? fallbackURLString
        let anonKey = (rawAnon?.isEmpty == false ? rawAnon : fallbackAnonKey) ?? fallbackAnonKey
        let fallbackURL = URL(string: fallbackURLString) ?? URL(fileURLWithPath: "/")

        guard let url = URL(string: urlString), url.scheme?.hasPrefix("http") == true else {
            logger.error("Invalid Supabase URL in Info.plist (\(urlString, privacy: .public)). Using fallback URL.")
            return SupabaseConfig(
                url: fallbackURL,
                anonKey: anonKey
            )
        }

        if urlString == fallbackURLString || anonKey == fallbackAnonKey {
            logger.warning("Supabase config is using fallback placeholder values. Set SUPABASE_URL and SUPABASE_ANON_KEY in Info.plist.")
            #if DEBUG
            assertionFailure("Supabase placeholders detected. Configure SUPABASE_URL and SUPABASE_ANON_KEY in Info.plist.")
            #endif
        }

        return SupabaseConfig(url: url, anonKey: anonKey)
    }
}
