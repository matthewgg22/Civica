import Foundation

// Civica supports two languages at v1 with FULL parity per HANDOFF.md
// decision #4. Every user-visible string is keyed; no raw strings in
// SwiftUI views. The string tables live next to the feature they
// belong to (e.g. OnboardingStrings.swift); this file is just the
// enum + accessor pattern used across all of them.

enum CivicaLanguage: String, CaseIterable, Codable, Sendable {
    case english = "en"
    case spanish = "es"
    // Added 2026-05-31: selectable now, with English fallback until
    // professional, counsel-reviewed translations land per string.
    // See `isFullyTranslated` and CivicaText.value(in:).
    case mandarin = "zh"
    case vietnamese = "vi"
    case tagalog = "tl"

    /// Native display name, shown in the language picker.
    var displayName: String {
        switch self {
        case .english: return "English"
        case .spanish: return "Español"
        case .mandarin: return "中文"
        case .vietnamese: return "Tiếng Việt"
        case .tagalog: return "Tagalog"
        }
    }

    /// True when this language has complete string coverage today.
    /// English + Spanish ship at full parity; the newer languages are
    /// selectable but currently fall back to English where a string
    /// hasn't been translated yet. Drives the picker's "translation in
    /// progress" note — never hides the option.
    var isFullyTranslated: Bool {
        switch self {
        case .english, .spanish: return true
        case .mandarin, .vietnamese, .tagalog: return false
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
    // Optional translations for the newer languages. Nil means "not
    // translated yet" → value(in:) falls back to English. Every existing
    // CivicaText("en", es:) call site keeps compiling unchanged.
    let zh: String?
    let vi: String?
    let tl: String?

    init(
        _ en: String,
        es: String,
        zh: String? = nil,
        vi: String? = nil,
        tl: String? = nil
    ) {
        self.en = en
        self.es = es
        self.zh = zh
        self.vi = vi
        self.tl = tl
    }

    func value(in language: CivicaLanguage) -> String {
        switch language {
        case .english: return en
        case .spanish: return es
        // English fallback until a translation is supplied for the key.
        case .mandarin: return zh ?? en
        case .vietnamese: return vi ?? en
        case .tagalog: return tl ?? en
        }
    }
}
