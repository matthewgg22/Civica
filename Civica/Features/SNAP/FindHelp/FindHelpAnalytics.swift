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

    static func trackLayerChanged(_ layer: String) {
        logger.info("find_help.layer_changed layer=\(layer, privacy: .public)")
    }

    static func trackOnboardingDismissed() {
        logger.info("find_help.onboarding_dismissed")
    }

    /// Records which location-precision mode left the device on the
    /// most recent search. Coordinates themselves are never logged —
    /// only the bucket. Used to verify the coarse default and to
    /// measure adoption when the precise opt-in path lands.
    static func trackSearchPrecisionUsed(_ precision: FindHelpLocationPrecision) {
        let bucket: String
        switch precision {
        case .coarse: bucket = "coarse"
        case .precise: bucket = "precise"
        }
        logger.info("find_help.search_precision precision=\(bucket, privacy: .public)")
    }
}
