import UserNotifications
import UIKit
import OSLog

private let pushLogger = Logger(subsystem: "Civica", category: "PushManager")

@MainActor
func requestPushPermissionAndRegister() async {
    do {
        let granted = try await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge])

        if granted {
            UIApplication.shared.registerForRemoteNotifications()
            pushLogger.info("Push permission granted; registering for APNs.")
        } else {
            pushLogger.info("Push permission denied.")
        }
    } catch {
        pushLogger.error("Push permission request failed.")
    }
}
