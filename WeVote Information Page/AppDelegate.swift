//
//
//  AppDelegate.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/29/25.
//  Updated to support APNs and Supabase logging with response body debug + API key fix

import UIKit
import UserNotifications
import OSLog

// MARK: - AppDelegate with APNs + Supabase support
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    private let logger = Logger(subsystem: "Civica", category: "AppDelegate")

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Keep notification center delegate set, but do not prompt on launch.
        // Permission is requested just-in-time from the Add to Calendar flow.
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    // Called when device token is received
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        Task {
            await saveDeviceToken(token)
        }
    }

    // Called if registration fails
    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError _: Error
    ) {
        #if DEBUG
        logger.error("Failed to register for remote notifications.")
        #endif
    }

    // Handle notification while app is in foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .badge, .sound])  // show push while app is open
    }
}
