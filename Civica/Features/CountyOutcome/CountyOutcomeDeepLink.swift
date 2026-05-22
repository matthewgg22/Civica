import Foundation
import SwiftUI
import UserNotifications

// Deep-link plumbing for the County Outcome notification.
//
// The recert companion does not currently install a
// UNUserNotificationCenterDelegate — its reminders rely on the
// system's default tap behavior (open the app). To route the user
// into CountyOutcomePromptView when they tap the +14d push, this
// module installs its own delegate, scoped via the `module` userInfo
// key so we ignore notifications owned by other features.
//
// Activation: call CountyOutcomeDeepLink.install() once from
// CivicaApp.init when the feature flag is on. The delegate is
// retained as the center's delegate for the lifetime of the app.
//
// Presentation: ObservableObject publishes the packetId of the most
// recently tapped notification. CivicaRootView (or any host that
// wants to surface the prompt) observes and presents a sheet.

@MainActor
final class CountyOutcomeDeepLink: NSObject, ObservableObject {
    static let shared = CountyOutcomeDeepLink()

    /// Most recently tapped county-outcome push's packetId. Set to nil
    /// by the host after presenting the prompt so subsequent taps
    /// re-trigger.
    @Published var pendingPacketId: String?

    private var installed = false

    private override init() { super.init() }

    /// Install this object as the system notification delegate. Safe
    /// to call multiple times — only takes effect the first time, and
    /// only when the feature flag is on so we don't compete for the
    /// delegate slot with future modules.
    static func installIfEnabled() {
        guard CountyOutcomeFeatureFlag.isEnabled else { return }
        shared.installOnce()
    }

    private func installOnce() {
        guard !installed else { return }
        UNUserNotificationCenter.current().delegate = self
        installed = true
    }

    /// Mark the pending deep link as consumed.
    func clear() {
        pendingPacketId = nil
    }
}

extension CountyOutcomeDeepLink: UNUserNotificationCenterDelegate {
    // Foreground presentation: still show the banner so the user has
    // a chance to tap. Without this, foreground notifications are
    // silently dropped on iOS.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let isOurs = (userInfo["module"] as? String) == "county_outcome"
        let packetId = userInfo["packetId"] as? String
        if isOurs, let packetId {
            Task { @MainActor in
                CountyOutcomeDeepLink.shared.pendingPacketId = packetId
            }
        }
        completionHandler()
    }
}

/// View modifier hosts can attach to surface the prompt sheet when a
/// notification tap arrives. Keeps wiring in CivicaApp / CivicaRootView
/// to a single line.
struct CountyOutcomeDeepLinkPresenter: ViewModifier {
    @StateObject private var link = CountyOutcomeDeepLink.shared

    func body(content: Content) -> some View {
        content
            .sheet(
                isPresented: Binding(
                    get: { link.pendingPacketId != nil },
                    set: { presented in
                        if !presented { link.clear() }
                    }
                )
            ) {
                if let packetId = link.pendingPacketId {
                    CountyOutcomePromptView(packetId: packetId) {
                        link.clear()
                    }
                }
            }
    }
}

extension View {
    /// Attach this once at the app root to present the County Outcome
    /// prompt whenever the user taps the +14d push.
    func countyOutcomeDeepLinkPresenter() -> some View {
        modifier(CountyOutcomeDeepLinkPresenter())
    }
}
