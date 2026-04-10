import Foundation
import OSLog

struct SupabaseConfig: Sendable {
    let url: URL
    let anonKey: String
    let govHelpFunctionSlug: String

    static let plistURLKey = "SUPABASE_URL"
    static let plistAnonKey = "SUPABASE_ANON_KEY"
    static let plistGovHelpFunctionSlugKey = "GOVHELP_FUNCTION_SLUG"

    private static let fallbackURLString = "https://YOUR-PROJECT-REF.supabase.co"
    private static let fallbackAnonKey = "YOUR_SUPABASE_ANON_KEY"
    private static let fallbackGovHelpFunctionSlug = "govhelp"

    private static let logger = Logger(subsystem: "VoteNow", category: "SupabaseConfig")

    static let current = load()

    static func load(bundle: Bundle = .main) -> SupabaseConfig {
        let rawURL = (bundle.object(forInfoDictionaryKey: plistURLKey) as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let rawAnon = (bundle.object(forInfoDictionaryKey: plistAnonKey) as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let rawGovHelpFunctionSlug = (bundle.object(forInfoDictionaryKey: plistGovHelpFunctionSlugKey) as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let urlString = (rawURL?.isEmpty == false ? rawURL : fallbackURLString) ?? fallbackURLString
        let anonKey = (rawAnon?.isEmpty == false ? rawAnon : fallbackAnonKey) ?? fallbackAnonKey
        let govHelpFunctionSlug = normalizedGovHelpFunctionSlug(rawGovHelpFunctionSlug)
        let fallbackURL = URL(string: fallbackURLString) ?? URL(fileURLWithPath: "/")

        guard let url = URL(string: urlString), url.scheme?.hasPrefix("https") == true else {
            logger.error("Invalid Supabase URL in Info.plist (\(urlString, privacy: .public)). Using fallback URL.")
            failLaunchConfiguration(
                "SUPABASE_URL must be a valid HTTPS URL in Info.plist for launch builds."
            )
            return SupabaseConfig(
                url: fallbackURL,
                anonKey: anonKey,
                govHelpFunctionSlug: govHelpFunctionSlug
            )
        }

        if urlString == fallbackURLString || anonKey == fallbackAnonKey {
            logger.warning("Supabase config is using fallback placeholder values. Set SUPABASE_URL and SUPABASE_ANON_KEY in Info.plist.")
            failLaunchConfiguration(
                "Supabase placeholders detected. Configure SUPABASE_URL and SUPABASE_ANON_KEY in Info.plist."
            )
        }

        if anonKey.count < 20 {
            failLaunchConfiguration(
                "SUPABASE_ANON_KEY appears invalid or too short. Configure a valid key before launch."
            )
        }

        if isValidGovHelpFunctionSlug(govHelpFunctionSlug) == false {
            failLaunchConfiguration(
                "GOVHELP_FUNCTION_SLUG is invalid. Use a lowercase slug like 'govhelp'."
            )
        }

        if govHelpFunctionSlug == "super-function" {
            failLaunchConfiguration(
                "GOVHELP_FUNCTION_SLUG still points to deprecated 'super-function'. Use 'govhelp'."
            )
        }

        return SupabaseConfig(
            url: url,
            anonKey: anonKey,
            govHelpFunctionSlug: govHelpFunctionSlug
        )
    }

    static func validateLaunchConfiguration(bundle: Bundle = .main) {
        _ = load(bundle: bundle)
    }

    private static func normalizedGovHelpFunctionSlug(_ raw: String?) -> String {
        let candidate = (raw?.isEmpty == false ? raw : fallbackGovHelpFunctionSlug) ?? fallbackGovHelpFunctionSlug
        return candidate.lowercased()
    }

    private static func isValidGovHelpFunctionSlug(_ slug: String) -> Bool {
        slug.range(of: #"^[a-z0-9-]+$"#, options: .regularExpression) != nil
    }

    private static func failLaunchConfiguration(_ message: String) {
        #if DEBUG
        assertionFailure(message)
        #else
        fatalError(message)
        #endif
    }
}
