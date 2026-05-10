import Foundation

// EXPERIMENTAL SILOED MODULE:
// Routing for the SNAP prototype remains isolated in this module while the feature is in build/testing mode.
enum SNAPRoute: Int, CaseIterable, Identifiable {
    case entry
    case privacyNotice
    case eligibilityIntro
    case application
    case conversation
    case review
    case confirmation

    var id: Int { rawValue }
}

enum SNAPRouter {
    static func nextRoute(after route: SNAPRoute) -> SNAPRoute? {
        guard let index = orderedRoutes.firstIndex(of: route), index < orderedRoutes.count - 1 else {
            return nil
        }
        return orderedRoutes[index + 1]
    }

    static func previousRoute(before route: SNAPRoute) -> SNAPRoute? {
        guard let index = orderedRoutes.firstIndex(of: route), index > 0 else {
            return nil
        }
        return orderedRoutes[index - 1]
    }

    /// The screener body route — `.conversation` when the conversation flag
    /// is on, `.application` otherwise. Used by the entry view to pick which
    /// view to mount after the privacy notice.
    static var screenerRoute: SNAPRoute {
        SNAPFeatureFlag.isConversationEnabled ? .conversation : .application
    }

    static var orderedRoutes: [SNAPRoute] {
        let screener = screenerRoute
        return [
            .entry,
            .privacyNotice,
            .eligibilityIntro,
            screener,
            .review,
            .confirmation
        ]
    }
}
