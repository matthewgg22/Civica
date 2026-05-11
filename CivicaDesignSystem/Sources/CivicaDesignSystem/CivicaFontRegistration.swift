import CoreText
import Foundation

/// Registers the Civica-bundled fonts with the system font manager.
///
/// SwiftUI's `Font.custom("HankenGrotesk-Regular", size:)` returns the system
/// fallback unless the font is registered first. SPM resources are not picked
/// up automatically by Core Text — we register them once on first access and
/// reuse the cached registration for the lifetime of the process.
public enum CivicaFonts {
    /// Register the Civica bundled fonts. Idempotent — safe to call repeatedly.
    /// Call from app launch (e.g. `init()` of your `@main` App) before any
    /// `Font.custom(...)` lookup or you'll see system fallbacks on first paint.
    public static func register() {
        _ = registrationToken
    }

    private static let registrationToken: Bool = {
        let names = [
            "HankenGrotesk-Regular",
            "HankenGrotesk-Medium",
            "HankenGrotesk-SemiBold",
            "AtkinsonHyperlegible-Regular",
        ]
        for name in names {
            guard let url = Bundle.module.url(forResource: name, withExtension: "ttf") else { continue }
            var error: Unmanaged<CFError>?
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error)
        }
        return true
    }()
}
