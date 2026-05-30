import Foundation
import SwiftUI
import Testing
import UIKit
@testable import CivicaDesignSystem

// Unit tests for `CivicaTypographyResolver` — ARCH-6 + RA-1 step 1 + T13
// + PF-2 from docs/audits/civica-ios-product-audit-2026-05-29.md.
//
// `.serialized` because the resolver is a process-wide singleton with a
// shared cache; parallelizing the suite would race on `_cacheCount()`
// between tests that poke the same instance.
@MainActor
@Suite("CivicaTypographyResolver", .serialized)
struct CivicaTypographyResolverTests {

    @Test("Every token returns a renderable Font")
    func everyTokenReturnsRenderableFont() {
        let resolver = CivicaTypographyResolver.shared
        for token in CivicaTypographyResolver.Token.allCases {
            // SwiftUI Font is non-optional, but the act of resolving
            // exercises the UIFontMetrics + descriptor path. If the
            // resolver returned a Font that crashes on render, this
            // hosting-controller smoke would catch it.
            let view = Text(String(describing: token)).font(resolver.font(for: token))
            let host = UIHostingController(rootView: view)
            host.view.frame = CGRect(x: 0, y: 0, width: 240, height: 48)
            host.view.layoutIfNeeded()
            #expect(host.view.bounds.width == 240)
        }
    }

    @Test("Repeat lookups hit the cache rather than re-resolving")
    func repeatLookupsHitCache() {
        let resolver = CivicaTypographyResolver.shared
        resolver._simulateSizeCategoryChange(.large) // reset to known state
        #expect(resolver._cacheCount() == 0)

        _ = resolver.font(for: .body)
        let afterFirst = resolver._cacheCount()
        #expect(afterFirst == 1)

        _ = resolver.font(for: .body)
        _ = resolver.font(for: .body)
        let afterRepeat = resolver._cacheCount()
        #expect(afterRepeat == afterFirst, "cache count must not grow on repeat (token, sizeCategory) lookups")

        _ = resolver.font(for: .bodyStrong)
        #expect(resolver._cacheCount() == 2, "a distinct token adds one new entry")
    }

    @Test("Cache invalidates when UIContentSizeCategory changes")
    func cacheInvalidatesOnSizeCategoryChange() {
        let resolver = CivicaTypographyResolver.shared
        resolver._simulateSizeCategoryChange(.large)
        _ = resolver.font(for: .body)
        _ = resolver.font(for: .pageTitle)
        #expect(resolver._cacheCount() >= 2)

        resolver._simulateSizeCategoryChange(.accessibilityExtraExtraLarge)
        #expect(resolver._cacheCount() == 0, "didChangeNotification clears the cache")

        // After invalidation, the next read re-populates.
        _ = resolver.font(for: .body)
        #expect(resolver._cacheCount() == 1)
    }

    @Test("Hanken Grotesk family registers before any token resolves")
    func hankenFamilyRegistersOnInit() {
        // Touch the resolver — its private init() calls CivicaFonts.register()
        // defensively before the system delegate would.
        _ = CivicaTypographyResolver.shared.font(for: .body)

        let names = [
            "HankenGrotesk-Regular",
            "HankenGrotesk-Medium",
            "HankenGrotesk-SemiBold",
        ]
        for name in names {
            #expect(
                UIFont(name: name, size: 17) != nil,
                "\(name) must be live once the resolver has resolved at least one token"
            )
        }
    }

    @Test("Token weight + text-style mapping matches the audit table")
    func tokenMappingMatchesAudit() {
        // Mirror docs/audits/civica-ios-product-audit-2026-05-29.md §ARCH-6.
        // A regression in this map silently shifts the visual register.
        #expect(CivicaTypographyResolver.Token.pageTitle.textStyle      == .title1)
        #expect(CivicaTypographyResolver.Token.display.textStyle        == .title2)
        #expect(CivicaTypographyResolver.Token.cardTitle.textStyle      == .title3)
        #expect(CivicaTypographyResolver.Token.sectionHeader.textStyle  == .headline)
        #expect(CivicaTypographyResolver.Token.body.textStyle           == .body)
        #expect(CivicaTypographyResolver.Token.bodyStrong.textStyle     == .body)
        #expect(CivicaTypographyResolver.Token.subhead.textStyle        == .subheadline)
        #expect(CivicaTypographyResolver.Token.subheadStrong.textStyle  == .subheadline)
        #expect(CivicaTypographyResolver.Token.footnote.textStyle       == .footnote)
        #expect(CivicaTypographyResolver.Token.footnoteStrong.textStyle == .footnote)
        #expect(CivicaTypographyResolver.Token.caption.textStyle        == .caption1)
        #expect(CivicaTypographyResolver.Token.captionStrong.textStyle  == .caption1)

        #expect(CivicaTypographyResolver.Token.body.weight              == .regular)
        #expect(CivicaTypographyResolver.Token.bodyStrong.weight        == .semibold)
        #expect(CivicaTypographyResolver.Token.subhead.weight           == .medium)
        #expect(CivicaTypographyResolver.Token.pageTitle.weight         == .semibold)

        #expect(CivicaTypographyResolver.Token.body.monospacedDigit         == true)
        #expect(CivicaTypographyResolver.Token.bodyStrong.monospacedDigit   == true)
        #expect(CivicaTypographyResolver.Token.footnote.monospacedDigit     == true)
        #expect(CivicaTypographyResolver.Token.caption.monospacedDigit      == true)
        #expect(CivicaTypographyResolver.Token.pageTitle.monospacedDigit    == false)
        #expect(CivicaTypographyResolver.Token.sectionHeader.monospacedDigit == false)
    }
}
