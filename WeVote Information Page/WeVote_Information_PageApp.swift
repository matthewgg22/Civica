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
import OSLog

enum PreferredLanguageCode {
    static let fallback = "en"

    static func normalizeStoredCode(_ code: String) -> String {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return fallback }

        let lower = trimmed.lowercased()
        switch lower {
        case "tl", "tagalog", "fil-ph":
            return "fil"
        case "zh", "zh-cn", "zh-hans", "zh-hans-cn":
            return "zh-Hans"
        case "zh-tw", "zh-hk", "zh-mo", "zh-hant", "zh-hant-tw", "zh-hant-hk":
            return "zh-Hant"
        case "vi-vn":
            return "vi"
        case "es-es", "es-mx":
            return "es"
        case "fr-fr", "fr-ca", "fr-be", "fr-ch":
            return "fr"
        case "de-de", "de-at", "de-ch":
            return "de"
        case "en-us", "en-gb":
            return "en"
        default:
            return trimmed
        }
    }
}

@main
struct WeVote_Information_PageApp: App {
    private let logger = Logger(subsystem: "VoteNow", category: "App")
    private static let bootstrapLogger = Logger(subsystem: "VoteNow", category: "AppBootstrap")

    private enum AppLanguage: String {
        case english = "en"
        case spanish = "es"
        case mandarinSimplified = "zh-Hans"
        case mandarinTraditional = "zh-Hant"
        case filipino = "fil"
        case vietnamese = "vi"
        case french = "fr"
        case german = "de"

        var localeIdentifier: String { rawValue }

        static func fromStoredCode(_ code: String) -> AppLanguage? {
            AppLanguage(rawValue: PreferredLanguageCode.normalizeStoredCode(code))
        }
    }

    // hook up our AppDelegate so FirebaseApp.configure() runs
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() {
        guard let publishableKey = Self.stripePublishableKey() else {
            Self.bootstrapLogger.error("Missing STRIPE_PUBLISHABLE_KEY in Info.plist. Stripe features are disabled.")
            STPAPIClient.shared.publishableKey = ""
            return
        }
        STPAPIClient.shared.publishableKey = publishableKey
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

    private static func stripePublishableKey(bundle: Bundle = .main) -> String? {
        guard let raw = bundle.object(forInfoDictionaryKey: "STRIPE_PUBLISHABLE_KEY") as? String else {
            return nil
        }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
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
                        logger.error("Anonymous Supabase sign-in failed on app launch.")
                    }
                }
                .environment(\.locale, appLocale)
                .preferredColorScheme(.light)   // forces light mode across the app
        }
    }
}
