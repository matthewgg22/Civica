import Foundation

// Civica supports two languages at v1 with FULL parity per HANDOFF.md
// decision #4. Every user-visible string is keyed; no raw strings in
// SwiftUI views. The string tables live next to the feature they
// belong to (e.g. OnboardingStrings.swift); this file is just the
// enum + accessor pattern used across all of them.

enum CivicaLanguage: String, CaseIterable, Codable, Sendable {
    case english = "en"
    case spanish = "es"

    var displayName: String {
        switch self {
        case .english: return "English"
        case .spanish: return "Español"
        }
    }

    /// Stored language preference. Defaults to English on first launch
    /// but the onboarding language picker is the FIRST screen so users
    /// pick before any other content renders.
    static let defaultStorageKey = "co.civica.language"
}

/// Two-language string container. Use one instance per logical string
/// and call `.value(in:)` to extract the active language's text.
///
/// Why not Apple's String Catalog (.xcstrings)? We're using a Swift
/// dictionary instead because the conversation LLM also needs the
/// language code passed through, and keeping our two-language strings
/// in Swift puts them close to the SwiftUI views that consume them.
/// We can migrate to .xcstrings later without changing call sites if
/// we wrap this struct around `LocalizedStringKey` lookups.
struct CivicaText: Sendable, Equatable {
    let en: String
    let es: String

    init(_ en: String, es: String) {
        self.en = en
        self.es = es
    }

    func value(in language: CivicaLanguage) -> String {
        switch language {
        case .english: return en
        case .spanish: return es
        }
    }
}
