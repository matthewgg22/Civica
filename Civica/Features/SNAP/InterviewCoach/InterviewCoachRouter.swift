import Foundation

// EXPERIMENTAL SILOED MODULE:
// Routing for the SNAP Interview Coach prototype. Shape mirrors SNAPRouter so
// the two siloed modules stay legible side-by-side. The actual flow has a
// branch at statePicker (browse vs. practice), so orderedRoutes is a coarse
// linear sketch — call sites pick the exact next route explicitly.
enum InterviewCoachRoute: Int, CaseIterable, Identifiable {
    case entry
    case statePicker
    case questionBrowser
    case practiceSession
    case reviewSummary

    var id: Int { rawValue }
}

enum InterviewCoachRouter {
    static func nextRoute(after route: InterviewCoachRoute) -> InterviewCoachRoute? {
        guard let index = orderedRoutes.firstIndex(of: route), index < orderedRoutes.count - 1 else {
            return nil
        }
        return orderedRoutes[index + 1]
    }

    static func previousRoute(before route: InterviewCoachRoute) -> InterviewCoachRoute? {
        guard let index = orderedRoutes.firstIndex(of: route), index > 0 else {
            return nil
        }
        return orderedRoutes[index - 1]
    }

    static var orderedRoutes: [InterviewCoachRoute] {
        [.entry, .statePicker, .questionBrowser, .practiceSession, .reviewSummary]
    }
}
