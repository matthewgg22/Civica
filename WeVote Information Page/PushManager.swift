import UserNotifications
import UIKit

@MainActor
func requestPushPermissionAndRegister() async {
    do {
        let granted = try await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge])

        if granted {
            UIApplication.shared.registerForRemoteNotifications()
            print("✅ Push permission granted, registering with APNs…")
        } else {
            print("⚠️ Push permission denied")
        }
    } catch {
        print("❌ Push permission request failed:", error)
    }
}
