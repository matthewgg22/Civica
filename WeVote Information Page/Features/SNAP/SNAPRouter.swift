import Foundation

// EXPERIMENTAL SILOED MODULE:
// Routing for the SNAP prototype remains isolated in this module while the feature is in build/testing mode.
enum SNAPRoute: Int, CaseIterable, Identifiable {
    case entry
    case privacyNotice
    case eligibilityIntro
    case application
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

    static var orderedRoutes: [SNAPRoute] {
        [.entry, .privacyNotice, .eligibilityIntro, .application, .review, .confirmation]
    }
}
