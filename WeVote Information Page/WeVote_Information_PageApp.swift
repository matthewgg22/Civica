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
import StripePaymentSheet

@main
struct WeVote_Information_PageApp: App {
    private enum AppLanguage: String {
        case english = "en"
        case spanish = "es"
        case chinese = "zh-Hans"
        case filipino = "fil"
        case vietnamese = "vi"

        var localeIdentifier: String { rawValue }

        static func fromStoredCode(_ code: String) -> AppLanguage? {
            let normalized = normalizeStoredCode(code)
            return AppLanguage(rawValue: normalized)
        }

        static func normalizeStoredCode(_ code: String) -> String {
            let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return AppLanguage.english.rawValue }

            let lower = trimmed.lowercased()
            switch lower {
            case "tl", "tagalog", "fil-ph":
                return AppLanguage.filipino.rawValue
            case "zh", "zh-cn", "zh-hans", "zh-hans-cn":
                return AppLanguage.chinese.rawValue
            case "vi-vn":
                return AppLanguage.vietnamese.rawValue
            case "es-es", "es-mx":
                return AppLanguage.spanish.rawValue
            case "en-us", "en-gb":
                return AppLanguage.english.rawValue
            default:
                return trimmed
            }
        }
    }

    // hook up our AppDelegate so FirebaseApp.configure() runs
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() {
        STPAPIClient.shared.publishableKey = "pk_test_51T8Yi1Ek0rWAoZA5BLUzJkeEY1mFQfQ2VOWvuk7QzDasZjeQFWn8G6FHnk8AZwih92UDtqShZig7tjWgPw1tORgt00wTE0GedO"
    }

    // shared view models
    @StateObject private var planVM = PlanViewModel()
    @StateObject private var repsVM = MyRepsViewModel()
    @StateObject private var authStore = AuthStore(client: SupabaseClientProvider.shared.client)
    @AppStorage("my_info.preferred_language_code")
    private var preferredLanguageCode: String = AppLanguage.english.rawValue

    private var selectedLanguage: AppLanguage {
        AppLanguage.fromStoredCode(preferredLanguageCode) ?? .english
    }

    private var appLocale: Locale {
        Locale(identifier: selectedLanguage.localeIdentifier)
    }

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
                .environment(\.locale, appLocale)
                .preferredColorScheme(.light)   // forces light mode across the app
        }
    }
}
