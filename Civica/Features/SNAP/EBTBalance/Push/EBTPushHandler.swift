import Foundation
import OSLog
import UIKit
import UserNotifications

// Just-in-time APNs permission flow + push deep-link router for the
// EBT Balance feature. Per plan §4.4 + D7, we do NOT request push
// permission at app install. Instead:
//
//   1. User links their EBT card (Lane C)
//   2. App renders the first real balance
//   3. App calls `EBTPushHandler.shared.requestPermissionIfNeeded(from:)`
//   4. If authStatus == .notDetermined → show our SOFT pre-prompt sheet
//      ("Get a notification the moment your $232 deposit lands?")
//   5. On YES → fire system `UNUserNotificationCenter.requestAuthorization`
//      → register for remote notifications (returns APNs token via
//      `application(_:didRegisterForRemoteNotificationsWithDeviceToken:)`)
//   6. On LATER → persist deferredUntil = now + 30 days; re-prompt after
//   7. If user hard-denies the system prompt → persist systemDenied;
//      subsequent calls deep-link to Settings instead of re-prompting.
//
// Apple HIG cites ~70-80% accept rate with the pre-prompt vs ~30%
// when you call the system API cold at install.
//
// Deep-link routing per plan §16.5 — each push category opens a
// targeted view:
//   - deposit-landed → EBTBalanceRootView with banner=deposit
//   - low-balance    → EBTBalanceRootView with banner=lowBalance
//   - re-link        → EBTLinkWebView (Lane C creates)
//   - anomaly        → EBTBalanceRootView with banner=anomaly
//
// The deep-link routing here just publishes the chosen route via
// `pendingDeepLink`; the SwiftUI root observes and navigates. This
// keeps the handler UIKit-only + testable without spinning up
// SwiftUI in unit tests.

/// Push notification deep-link target — what view to open when the
/// user taps a push. Consumed by the SwiftUI root.
enum EBTPushDeepLink: Equatable {
    case depositLanded
    case lowBalance
    case reLink
    case anomaly
}

/// EBTBalanceAPIClient is owned by Lane C. We forward-declare a tiny
/// protocol here so the handler compiles and can be wired once Lane C
/// merges. Lane C's full client will conform to this trivially.
///
/// AnyObject bound so we can store a `weak` reference and avoid a
/// retain cycle with the singleton handler.
protocol EBTBalancePushAPIClient: AnyObject, Sendable {
    func registerPushToken(_ hexToken: String) async throws
}

@MainActor
final class EBTPushHandler: NSObject {

    // MARK: - Singleton

    static let shared = EBTPushHandler()

    // MARK: - UserDefaults keys

    /// Date until which we suppress re-asking after a "Not now" tap.
    static let deferredUntilKey = "co.civica.ebt.push.preprompt.deferredUntil"
    /// Set to true after the user hard-denies the system prompt. Once
    /// true, subsequent requestPermissionIfNeeded calls show the
    /// settings-deep-link alert instead of the pre-prompt.
    static let systemDeniedKey = "co.civica.ebt.push.systemDenied"
    /// Set to true once the user has tapped Yes on the pre-prompt
    /// (regardless of system-prompt outcome). Prevents the pre-prompt
    /// from re-showing after a soft-deny + system grant cycle.
    static let prePromptAcceptedKey = "co.civica.ebt.push.preprompt.accepted"

    // MARK: - Dependencies (injectable for tests)

    /// Notification-center API surface — only the calls we use. Tests
    /// substitute a fake so we don't need real UNUserNotificationCenter.
    @MainActor
    protocol NotificationCenter {
        func authorizationStatus() async -> UNAuthorizationStatus
        func requestAuthorization(options: UNAuthorizationOptions) async throws -> Bool
        func registerForRemoteNotifications()
    }

    var notificationCenter: NotificationCenter
    var defaults: UserDefaults
    /// Clock for deferral comparisons — injectable for tests.
    var now: @Sendable () -> Date
    /// Lane C wires the real API client; nil = stub (no-op).
    weak var apiClient: AnyObject?
    /// Stored apiClient cast helper — see registerToken.
    private var apiClientCaller: (@Sendable (String) async throws -> Void)?

    /// Latest deep-link the user tapped — SwiftUI root observes via
    /// `consumePendingDeepLink()`. Stored here instead of a Combine
    /// publisher to keep this file UIKit-only.
    private(set) var pendingDeepLink: EBTPushDeepLink?

    // MARK: - Init

    override convenience init() {
        self.init(
            notificationCenter: RealUNCenter(),
            defaults: .standard,
            now: { Date() }
        )
    }

    init(
        notificationCenter: NotificationCenter,
        defaults: UserDefaults,
        now: @escaping @Sendable () -> Date
    ) {
        self.notificationCenter = notificationCenter
        self.defaults = defaults
        self.now = now
        super.init()
    }

    // MARK: - Wiring (Lane C will set this)

    /// Lane C calls this after constructing the real EBTBalanceAPIClient.
    /// Until then `apiClient` is nil and `handleDeviceToken` is a no-op
    /// (the token is still hex-encoded + persisted to UserDefaults so
    /// the next registerToken call has something to upload).
    func setAPIClient(_ client: EBTBalancePushAPIClient) {
        self.apiClient = client as AnyObject
        self.apiClientCaller = { [weak client] token in
            try await client?.registerPushToken(token)
        }
    }

    // MARK: - Permission flow

    /// Entry point per D7. Shows the pre-prompt sheet IFF:
    ///   - system authStatus is .notDetermined, AND
    ///   - the user hasn't already deferred within the last 30 days
    ///
    /// If the user previously hard-denied, shows the settings-deep-link
    /// alert instead. If already authorized or provisional, this is a
    /// no-op (caller should just register for remote notifications via
    /// `registerForRemoteNotifications()` separately on app launch).
    ///
    /// `from` is optional so callers from non-UIKit contexts (e.g. a
    /// SwiftUI host) can pass nil — in that case we look up the
    /// foremost UIWindowScene's rootViewController.
    func requestPermissionIfNeeded(from view: UIViewController?) async {
        if defaults.bool(forKey: Self.systemDeniedKey) {
            // User has hard-denied. Show settings deep-link alert.
            presentSettingsAlert(from: view)
            return
        }

        let status = await notificationCenter.authorizationStatus()
        switch status {
        case .authorized, .provisional, .ephemeral:
            // Already granted — just (re-)register for remote APNs.
            notificationCenter.registerForRemoteNotifications()
            return
        case .denied:
            // Settings-level deny (e.g. user toggled off later). Persist
            // and show settings alert.
            defaults.set(true, forKey: Self.systemDeniedKey)
            presentSettingsAlert(from: view)
            return
        case .notDetermined:
            break
        @unknown default:
            return
        }

        // Honor "Not now" deferral.
        if let deferredUntil = defaults.object(forKey: Self.deferredUntilKey) as? Date,
           deferredUntil > now() {
            return
        }

        // Show the pre-prompt sheet.
        presentPrePrompt(from: view)
    }

    /// User tapped YES on the pre-prompt. Fires the system permission
    /// prompt. On grant → registers for remote notifications. On deny
    /// → persists `systemDenied`.
    func userAcceptedPrePrompt() async {
        defaults.set(true, forKey: Self.prePromptAcceptedKey)
        defaults.removeObject(forKey: Self.deferredUntilKey)

        do {
            let granted = try await notificationCenter.requestAuthorization(
                options: [.alert, .badge, .sound]
            )
            if granted {
                notificationCenter.registerForRemoteNotifications()
            } else {
                defaults.set(true, forKey: Self.systemDeniedKey)
            }
        } catch {
            Self.logger.error("System requestAuthorization failed: \(String(describing: error), privacy: .public)")
            defaults.set(true, forKey: Self.systemDeniedKey)
        }
    }

    /// User tapped "Not now" on the pre-prompt. Defer for 30 days.
    func userDeferredPrePrompt() {
        defaults.set(now().addingTimeInterval(30 * 24 * 60 * 60),
                     forKey: Self.deferredUntilKey)
    }

    // MARK: - Device token registration

    /// Called from `application(_:didRegisterForRemoteNotificationsWithDeviceToken:)`.
    /// Converts the binary token → hex, ships to gateway. If Lane C
    /// hasn't wired the API client yet, persists the hex for later.
    func handleDeviceToken(_ token: Data) {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        Self.logger.debug("APNs device token registered (len=\(hex.count, privacy: .public)).")

        guard let caller = apiClientCaller else {
            // TODO: Lane C wires apiClient. Persist token so we can
            // upload on next launch after wiring.
            defaults.set(hex, forKey: "co.civica.ebt.push.pendingToken")
            return
        }

        Task { @MainActor in
            do {
                try await caller(hex)
                self.defaults.removeObject(forKey: "co.civica.ebt.push.pendingToken")
            } catch {
                Self.logger.error("Push token upload failed: \(String(describing: error), privacy: .public)")
                self.defaults.set(hex, forKey: "co.civica.ebt.push.pendingToken")
            }
        }
    }

    // MARK: - Notification tap routing

    /// Called from `userNotificationCenter(_:didReceive:withCompletionHandler:)`.
    /// Inspects the userInfo `category` field and publishes the
    /// corresponding deep-link. The SwiftUI root observes via
    /// `consumePendingDeepLink()` on appear.
    func handleNotificationTap(_ response: UNNotificationResponse) {
        let userInfo = response.notification.request.content.userInfo
        guard let category = userInfo["category"] as? String else { return }
        pendingDeepLink = Self.deepLink(forCategory: category)
    }

    /// Direct URL-string entry point — used by URL-scheme launches and
    /// tests. Public to make the routing rule testable in isolation.
    static func deepLink(forCategory category: String) -> EBTPushDeepLink? {
        switch category {
        case "deposit_landed":  return .depositLanded
        case "low_balance":     return .lowBalance
        case "re_link":         return .reLink
        case "anomaly":         return .anomaly
        default:                return nil
        }
    }

    /// SwiftUI root calls this on appear to drain the pending deep
    /// link. Returns nil if nothing is pending.
    func consumePendingDeepLink() -> EBTPushDeepLink? {
        let link = pendingDeepLink
        pendingDeepLink = nil
        return link
    }

    // MARK: - UI helpers

    private static let logger = Logger(subsystem: "Civica", category: "EBTPushHandler")

    /// Localized language for prompt strings — looked up from the
    /// app's stored language preference (matches CivicaLanguage).
    private var currentLanguage: CivicaLanguage {
        let raw = defaults.string(forKey: CivicaLanguage.defaultStorageKey)
            ?? CivicaLanguage.english.rawValue
        return CivicaLanguage(rawValue: raw) ?? .english
    }

    private func presentPrePrompt(from view: UIViewController?) {
        let host = view ?? Self.foremostViewController()
        guard let host else { return }

        let lang = currentLanguage
        let alert = UIAlertController(
            title: EBTPushStrings.prePromptTitle.value(in: lang),
            message: EBTPushStrings.prePromptMessage.value(in: lang),
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(
            title: EBTPushStrings.prePromptYes.value(in: lang),
            style: .default,
            handler: { [weak self] _ in
                Task { await self?.userAcceptedPrePrompt() }
            }
        ))
        alert.addAction(UIAlertAction(
            title: EBTPushStrings.prePromptLater.value(in: lang),
            style: .cancel,
            handler: { [weak self] _ in
                self?.userDeferredPrePrompt()
            }
        ))
        host.present(alert, animated: true)
    }

    private func presentSettingsAlert(from view: UIViewController?) {
        let host = view ?? Self.foremostViewController()
        guard let host else { return }

        let lang = currentLanguage
        let alert = UIAlertController(
            title: EBTPushStrings.settingsAlertTitle.value(in: lang),
            message: EBTPushStrings.settingsAlertMessage.value(in: lang),
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(
            title: EBTPushStrings.settingsAlertGoToSettings.value(in: lang),
            style: .default,
            handler: { _ in
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
        ))
        alert.addAction(UIAlertAction(
            title: EBTPushStrings.settingsAlertCancel.value(in: lang),
            style: .cancel
        ))
        host.present(alert, animated: true)
    }

    private static func foremostViewController() -> UIViewController? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first?.windows
            .first(where: { $0.isKeyWindow })?
            .rootViewController
    }
}

// MARK: - Default UNUserNotificationCenter adapter

@MainActor
private struct RealUNCenter: EBTPushHandler.NotificationCenter {
    func authorizationStatus() async -> UNAuthorizationStatus {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }
    func requestAuthorization(options: UNAuthorizationOptions) async throws -> Bool {
        try await UNUserNotificationCenter.current().requestAuthorization(options: options)
    }
    func registerForRemoteNotifications() {
        UIApplication.shared.registerForRemoteNotifications()
    }
}
