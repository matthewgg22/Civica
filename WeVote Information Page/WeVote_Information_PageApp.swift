//
//
//
//  WeVote_Information_PageApp.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 3/30/25.
//  Updated by ChatGPT on 05/27/25 (force light mode)
//

import SwiftUI

@main
struct WeVote_Information_PageApp: App {
    // hook up our AppDelegate so FirebaseApp.configure() runs
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    // shared view models
    @StateObject private var planVM = PlanViewModel()
    @StateObject private var repsVM = MyRepsViewModel()
    @StateObject private var authStore = AuthStore(client: SupabaseClientProvider.shared.client)

    var body: some Scene {
        WindowGroup {
            ContentView()              // ← your single root view
                .supabaseClient(SupabaseClientProvider.shared.client)
                .environmentObject(authStore)
                .environmentObject(planVM)
                .environmentObject(repsVM)
                .task {
                    do {
                        try await SupabaseManager.shared.signInAnonymouslyIfNeeded()
                    } catch {
                        print("[SupabaseManager] Anonymous sign-in on launch failed:", error.localizedDescription)
                    }
                    await requestPushPermissionAndRegister()
                }
                .preferredColorScheme(.light)   // forces light mode across the app
        }
    }
}
