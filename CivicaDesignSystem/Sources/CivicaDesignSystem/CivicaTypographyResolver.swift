import SwiftUI
import UIKit

/// Resolves Hanken Grotesk SwiftUI `Font` values through `UIFontMetrics`,
/// so every `CivicaTypography.<token>` use scales with the system's
/// `UIContentSizeCategory` automatically. Implements ARCH-6 + RA-1 step 1
/// + T13 + PF-2 from `docs/audits/civica-ios-product-audit-2026-05-29.md`.
///
/// The class is intentionally NOT an `actor`: every `static var` token in
/// `CivicaTypography` reads through `shared.font(for:)` from a synchronous
/// SwiftUI view body (which runs on the main actor). An actor would force
/// each callsite to become `async`, which is incompatible with the public
/// `Font.body` shape thousands of callsites depend on. A small NSLock
/// around an in-memory dictionary is cheap (~24 cached entries in practice;
/// 12 tokens × ~2 active size categories per session) and lets the getter
/// stay synchronous.
///
/// The cache is invalidated when `UIContentSizeCategory.didChangeNotification`
/// fires, so accessibility scaling drops the stale Font instances on the
/// next read.
public final class CivicaTypographyResolver: @unchecked Sendable {

    /// Process-wide singleton. Construction registers the Hanken fonts
    /// (idempotent through `CivicaFonts.register()`) and subscribes to
    /// the size-category change notification.
    public static let shared = CivicaTypographyResolver()

    /// The 12 tokens migrated in RA-1 step 1. Other CivicaTypography
    /// entries (currencyHero, cardHero, support*, codeChip) keep their
    /// existing `Font.custom(..., relativeTo:)` shape and will be looked
    /// at in step 2 of the migration if they prove insufficient.
    public enum Token: Hashable, CaseIterable {
        case pageTitle
        case display
        case cardTitle
        case sectionHeader
        case body
        case bodyStrong
        case subhead
        case subheadStrong
        case footnote
        case footnoteStrong
        case caption
        case captionStrong

        /// Drives UIFontMetrics scaling. Mirrors the audit's Token → UIKit
        /// text style mapping verbatim.
        var textStyle: UIFont.TextStyle {
            switch self {
            case .pageTitle:                  return .title1
            case .display:                    return .title2
            case .cardTitle:                  return .title3
            case .sectionHeader:              return .headline
            case .body, .bodyStrong:          return .body
            case .subhead, .subheadStrong:    return .subheadline
            case .footnote, .footnoteStrong:  return .footnote
            case .caption, .captionStrong:    return .caption1
            }
        }

        /// Carries through to the Hanken descriptor. The audit caps UI
        /// type at SemiBold, so `*Strong` tokens differ from their non-
        /// strong twins only by weight.
        var weight: UIFont.Weight {
            switch self {
            case .pageTitle, .display, .cardTitle, .sectionHeader,
                 .bodyStrong, .subheadStrong, .footnoteStrong, .captionStrong:
                return .semibold
            case .subhead:
                return .medium
            case .body, .footnote, .caption:
                return .regular
            }
        }

        /// Pre-scale base size. UIFontMetrics multiplies this against
        /// the current size category.
        var baseSize: CGFloat {
            switch self {
            case .pageTitle:                                       return 28
            case .display:                                         return 24
            case .cardTitle:                                       return 20
            case .sectionHeader, .body, .bodyStrong:               return 17
            case .subhead, .subheadStrong:                         return 15
            case .footnote, .footnoteStrong:                       return 13
            case .caption, .captionStrong:                         return 12
            }
        }

        /// Preserves the tabular-nums rule from the existing typography
        /// ladder. Body / footnote / caption tiers carried
        /// `.monospacedDigit()` before the migration; the resolver re-
        /// applies it after wrapping the UIFont.
        var monospacedDigit: Bool {
            switch self {
            case .body, .bodyStrong,
                 .footnote, .footnoteStrong,
                 .caption, .captionStrong:
                return true
            case .pageTitle, .display, .cardTitle, .sectionHeader,
                 .subhead, .subheadStrong:
                return false
            }
        }

        /// PostScript name resolved via `CivicaFonts.register()`. Falls
        /// back to `HankenGrotesk-Regular` if a weight ever lands outside
        /// the registered set — the registration table is fixed at three
        /// weights so this default is unreachable in practice.
        var hankenName: String {
            switch weight {
            case .regular:  return "HankenGrotesk-Regular"
            case .medium:   return "HankenGrotesk-Medium"
            case .semibold: return "HankenGrotesk-SemiBold"
            default:        return "HankenGrotesk-Regular"
            }
        }
    }

    private struct CacheKey: Hashable {
        let token: Token
        let sizeCategory: UIContentSizeCategory
    }

    private let lock = NSLock()
    private var cache: [CacheKey: Font] = [:]
    private var currentSizeCategory: UIContentSizeCategory

    private init() {
        // Defensive — the app delegate already calls register() at launch.
        // CivicaFonts.register() is idempotent, so a second call here just
        // touches the same lazy token. Without it, the FIRST static token
        // access (which can occur during static initializer chains before
        // the app delegate fires) would fall back to system fonts.
        CivicaFonts.register()

        // Seed the size category. Reading UIApplication.shared off the
        // main thread is undefined; in practice this initializer runs
        // lazily from a SwiftUI body call which is main-actor isolated,
        // but we guard explicitly. If we somehow init off-main, fall back
        // to .large and let the first didChangeNotification overwrite it.
        if Thread.isMainThread {
            currentSizeCategory = UIApplication.shared.preferredContentSizeCategory
        } else {
            currentSizeCategory = .large
        }

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleSizeCategoryDidChange(_:)),
            name: UIContentSizeCategory.didChangeNotification,
            object: nil
        )
    }

    /// Returns a `Font` for `token` at the current `UIContentSizeCategory`.
    /// Synchronous, thread-safe, cache-backed.
    public func font(for token: Token) -> Font {
        lock.lock()
        let sizeCategory = currentSizeCategory
        let key = CacheKey(token: token, sizeCategory: sizeCategory)
        if let cached = cache[key] {
            lock.unlock()
            return cached
        }
        lock.unlock()

        // Resolve outside the lock — UIFontMetrics + descriptor work is
        // pure and reentrant; no need to serialize it.
        let font = resolve(token: token, sizeCategory: sizeCategory)

        lock.lock()
        cache[key] = font
        lock.unlock()
        return font
    }

    @objc private func handleSizeCategoryDidChange(_ note: Notification) {
        let new = (note.userInfo?[UIContentSizeCategory.newValueUserInfoKey] as? UIContentSizeCategory)
            ?? (Thread.isMainThread ? UIApplication.shared.preferredContentSizeCategory : .large)
        lock.lock()
        currentSizeCategory = new
        cache.removeAll(keepingCapacity: true)
        lock.unlock()
    }

    private func resolve(token: Token, sizeCategory: UIContentSizeCategory) -> Font {
        let traits = UITraitCollection(preferredContentSizeCategory: sizeCategory)
        let metrics = UIFontMetrics(forTextStyle: token.textStyle)
        let descriptor = hankenDescriptor(name: token.hankenName)
        let base = UIFont(descriptor: descriptor, size: token.baseSize)
        let scaled = metrics.scaledFont(for: base, compatibleWith: traits)
        var font = Font(scaled)
        if token.monospacedDigit {
            font = font.monospacedDigit()
        }
        return font
    }

    /// Builds a Hanken Grotesk descriptor. Prefers a real `UIFont(name:size:)`
    /// (which carries through the registered font's full descriptor table)
    /// and falls back to a name-only descriptor if the font is somehow
    /// unregistered at the moment of resolution.
    private func hankenDescriptor(name: String) -> UIFontDescriptor {
        if let uiFont = UIFont(name: name, size: UIFont.systemFontSize) {
            return uiFont.fontDescriptor
        }
        return UIFontDescriptor(name: name, size: UIFont.systemFontSize)
    }

    // MARK: - Test hooks (internal, accessed via @testable import)

    /// Number of cached entries. Used by `CivicaTypographyResolverTests`.
    func _cacheCount() -> Int {
        lock.lock()
        defer { lock.unlock() }
        return cache.count
    }

    /// Synchronously simulate a size-category change. Bypasses the
    /// NotificationCenter dispatch so tests can assert cache invalidation
    /// without waiting for a runloop tick.
    func _simulateSizeCategoryChange(_ new: UIContentSizeCategory) {
        let userInfo: [AnyHashable: Any] = [
            UIContentSizeCategory.newValueUserInfoKey: new
        ]
        let note = Notification(
            name: UIContentSizeCategory.didChangeNotification,
            object: nil,
            userInfo: userInfo
        )
        handleSizeCategoryDidChange(note)
    }
}
