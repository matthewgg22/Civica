import Foundation
import SwiftUI
import Testing
import UIKit
@testable import Civica
import CivicaDesignSystem

// Regression guard for the RA-1 step 1 + T13 migration (audit 2026-05-29).
//
// CivicaTypography.{pageTitle, display, cardTitle, sectionHeader, body,
// bodyStrong, subhead, subheadStrong, footnote, footnoteStrong, caption,
// captionStrong} is moving from `Font.custom(name, size, relativeTo:)`
// to a UIFontMetrics-backed resolver. The public surface (`static var
// body: Font`) must stay synchronous and Hanken-Grotesk-shaped so the
// ~300 existing callsites keep working.
//
// This suite locks in the public contract BEFORE the resolver lands:
//   1. Every migrated token resolves to a Font that a SwiftUI view can
//      render through a UIHostingController without crashing.
//   2. The Hanken Grotesk font family is registered in the process,
//      so the new descriptor path will not silently fall back to system.
//
// Visual regression (does the rendered glyph still look the same after
// the metric swap?) is gated by the three existing Phase-1/2/3 snapshot
// suites in this folder, which already exercise every migrated token
// against committed PNG baselines. Those tests do not change shape; they
// just have to keep passing after PR-6 lands.
@MainActor
@Suite("CivicaTypography migration guard (RA-1 step 1)", .serialized)
struct CivicaTypographyMigrationGuardTests {

    @Test("Every migrated token renders inside a UIHostingController")
    func everyMigratedTokenRenders() {
        for token in MigratedToken.allCases {
            let host = UIHostingController(rootView: TokenSample(token: token))
            host.view.frame = CGRect(x: 0, y: 0, width: 320, height: 64)
            // Force layout — this exercises the Font through SwiftUI's
            // text engine. If the resolver returns a malformed Font (e.g.
            // a nil UIFont wrapped), the layout pass crashes here.
            host.view.layoutIfNeeded()
            #expect(host.view.bounds.width == 320, "token \(token.rawValue) hosting view sized")
        }
    }

    @Test("Hanken Grotesk family is registered for the descriptor path")
    func hankenFamilyRegistered() {
        CivicaFonts.register()
        let names = [
            "HankenGrotesk-Regular",
            "HankenGrotesk-Medium",
            "HankenGrotesk-SemiBold",
        ]
        for name in names {
            #expect(
                UIFont(name: name, size: 17) != nil,
                "\(name) must resolve via UIFont(name:size:) so UIFontMetrics has a real descriptor to scale"
            )
        }
    }
}

private enum MigratedToken: String, CaseIterable {
    case pageTitle, display, cardTitle, sectionHeader
    case body, bodyStrong
    case subhead, subheadStrong
    case footnote, footnoteStrong
    case caption, captionStrong

    var font: Font {
        switch self {
        case .pageTitle:      return CivicaTypography.pageTitle
        case .display:        return CivicaTypography.display
        case .cardTitle:      return CivicaTypography.cardTitle
        case .sectionHeader:  return CivicaTypography.sectionHeader
        case .body:           return CivicaTypography.body
        case .bodyStrong:     return CivicaTypography.bodyStrong
        case .subhead:        return CivicaTypography.subhead
        case .subheadStrong:  return CivicaTypography.subheadStrong
        case .footnote:       return CivicaTypography.footnote
        case .footnoteStrong: return CivicaTypography.footnoteStrong
        case .caption:        return CivicaTypography.caption
        case .captionStrong:  return CivicaTypography.captionStrong
        }
    }
}

private struct TokenSample: View {
    let token: MigratedToken

    var body: some View {
        Text(token.rawValue)
            .font(token.font)
    }
}
