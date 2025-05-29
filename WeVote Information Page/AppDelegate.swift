//
//
//  AppDelegate.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/29/25.
//  Updated to support APNs and Supabase logging with response body debug + API key fix

import UIKit
import UserNotifications

// MARK: - AppDelegate with APNs + Supabase support
class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        
        // Request permission for notifications
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            } else {
                print("🔕 Notification permission not granted: \(error?.localizedDescription ?? "No error")")
            }
        }
        return true
    }

    // Called when device token is received
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("✅ APNs Device Token: \(token)")
        sendTokenToSupabase(token)
    }

    // Called if registration fails
    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("❌ Failed to register for remote notifications: \(error.localizedDescription)")
    }

    // Handle notification while app is in foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.alert, .badge, .sound])  // show push while app is open
    }

    // MARK: - Supabase token upload
    private func sendTokenToSupabase(_ token: String) {
        guard let url = URL(string: "https://wkvfkjkfnxcdjikpqaqo.supabase.co/rest/v1/device_tokens") else { return }

        let supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrdmZramtmbnhjZGppa3BxYXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxOTg0MjAsImV4cCI6MjA2Mzc3NDQyMH0.OfDK06n9n4uDSRlwKmXwKOagJcu7Gixs8aT__5a-dyY"

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey") // ✅ required!
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let payload: [String: Any] = [
            "token": token,
            "bundle_id": Bundle.main.bundleIdentifier ?? "unknown"
        ]

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        } catch {
            print("❌ Failed to encode token JSON: \(error)")
            return
        }

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("❌ Supabase upload error: \(error.localizedDescription)")
            } else if let data = data, let responseBody = String(data: data, encoding: .utf8) {
                print("📦 Supabase response: \(responseBody)")
            } else {
                print("✅ Token successfully sent to Supabase (no body)")
            }
        }.resume()
    }
}
