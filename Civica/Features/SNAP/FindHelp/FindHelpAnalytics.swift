import Foundation
import OSLog

// Aggregate-only analytics for Find Help. Per-location taps are deliberately
// NOT tracked — V1 privacy decision documented in the build plan.
enum FindHelpAnalytics {
    private static let logger = Logger(subsystem: "Civica", category: "FindHelpAnalytics")

    static func trackEntryViewed() {
        logger.info("find_help.entry_viewed")
    }

    static func trackPermissionResult(_ status: String) {
        logger.info("find_help.permission_result status=\(status, privacy: .public)")
    }

    static func trackFilterChanged(serviceType: String?, languageCode: String?) {
        logger.info(
            "find_help.filter_changed service=\(serviceType ?? "all", privacy: .public) lang=\(languageCode ?? "any", privacy: .public)"
        )
    }

    static func trackViewModeChanged(_ mode: String) {
        logger.info("find_help.view_mode mode=\(mode, privacy: .public)")
    }

    static func trackZipFallbackUsed() {
        logger.info("find_help.zip_fallback_used")
    }
}
