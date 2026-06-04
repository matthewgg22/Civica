import SwiftUI

// MARK: - v2 brand tokens (pine + wheat)
// Canonical values locked from Civica v2 design handoff (2026-05-20).
// Dark-mode values from the v2 dark-mode enrolled screen test.

extension CivicaColors {

    // MARK: Pine — primary CTA, success surfaces, navigation chips (AAA 9.01:1 on white)
    public static let pinePrimary         = Color.dynamic(light: "#2D5A45", dark: "#6FA98F")
    public static let pinePrimaryPressed  = Color.dynamic(light: "#224636", dark: "#5A9279")
    public static let pinePrimaryDisabled = Color.dynamic(light: "#7A998C", dark: "#4E7565")
    public static let pineSurface         = Color.dynamic(light: "#D8E6DE", dark: "#2C3F37")

    // MARK: Wheat — benefit-positive fill ONLY (deposits, balance updates, streaks)
    // NEVER use as text on paper — fails AA at all body sizes (2.1:1).
    // Text on wheatSurface: ink only.
    //
    // MARK: - DANGER ZONE
    //
    // wheatPrimary fails WCAG AA on every Civica light surface
    // (2.1:1 contrast on #F7F5EF paper, 2.0:1 on #FFFFFF).
    // It is a FILL-ONLY token. Never set as text foreground on any
    // light surface — eyebrows, captions, body copy, button labels.
    //
    // Sanctioned use sites (audit confirmed): EBT balance hero
    // (dark pine background → 6.9:1, AA OK), wheatSurface fills,
    // wheatBright tally accents on dark pine.
    //
    // The compiler cannot enforce this — Color is the same type
    // whether used as fill or foreground. Code review must catch
    // foreground misuse. See DESIGN.md §9.1 contract 1 + §2.2
    // "Wheat = benefit fills, never text."
    //
    // Audit DS-6 (2026-05-29) — comment added in lieu of SwiftLint
    // rule pending lint config landing.
    public static let wheatPrimary        = Color.dynamic(light: "#E8C547", dark: "#F4D670")
    public static let wheatPrimaryPressed = Color.dynamic(light: "#C9A046", dark: "#DEB94F")
    public static let wheatSurface        = Color.dynamic(light: "#F7E89C", dark: "#4A3D1F")
    public static let wheatBright         = Color.dynamic(light: "#FAE96E", dark: "#FFE564")
    // wheatPop: confident focused/hover accent. Replaces timelineFocusGold. Max 1 per screen.
    public static let wheatPop            = Color.dynamic(light: "#F0CB5A", dark: "#E8C84A")

    // MARK: Amber — positive-outcome text/icons on light surfaces
    // Replaces accentTeal as the "good news / benefit amount" foreground.
    // Contrast on paper (#F7F5EF): 4.9:1 — AA ✅ at all body sizes.
    // On dark pine hero cards, use wheatPrimary instead — higher luminance.
    public static let amberPrimary  = Color.dynamic(light: "#C9922A", dark: "#E8B84B")
    public static let amberSurface  = Color.dynamic(light: "#F5E2C0", dark: "#3D2E12")


    // MARK: Brick (accent) — recovery / human moments ONLY
    // Navigator calls, denials, account help, distress flows.
    // Never primary CTAs. See brickPrimary shim in CivicaColors.swift.
    public static let brickAccent         = Color.dynamic(light: "#9C3A24", dark: "#E8856E")
    public static let brickAccentPressed  = Color.dynamic(light: "#84311E", dark: "#D26A52")
    // brickSurface and brickPrimaryDisabled carry forward from v1 unchanged.
}

// MARK: - Updated neutral tokens

extension CivicaColors {
    // paperBright: new in v2 — slightly lifted hero surface inside cards.
    public static let paperBright = Color.dynamic(light: "#FCFAF6", dark: "#161A1F")
}

// MARK: - Semantic icon tokens (T11 — issue #424 color-discipline sweep)
//
// Two tokens for decorative icons that were previously borrowing
// `pinePrimary`, diluting the "pine = CTA only" signal (DESIGN.md §2.2).
//
// `cardLeadingIcon` — default for decorative leading icons inside
//   cards and banners (checkmarks, calendar glyphs, bolt icons, etc.).
//   Aliased to `graphite` so icons stay visually quiet alongside ink text.
//
// `cardInfoIcon` — for help/info glyphs ONLY (questionmark.circle
//   pattern already moved to accentTeal in pre-demo fixes; this token
//   makes that choice discoverable and enforceable).
//   Aliased to `accentTeal`.
//
// Neither token introduces new color values — they are semantic aliases
// over existing palette tokens, which keeps the palette stable while
// making intent explicit in call sites and the SwiftLint rule below.
extension CivicaColors {
    /// Decorative leading icons in cards/banners. Default: graphite.
    /// Use `cardInfoIcon` instead for help / questionmark.circle glyphs.
    public static let cardLeadingIcon = graphite

    /// Help / info glyphs (questionmark.circle, info.circle pattern).
    /// Aliased to accentTeal per DESIGN.md §2.2 discipline.
    public static let cardInfoIcon    = accentTeal
}

// MARK: - Color forwarding aliases
// Enables .foregroundStyle(.civicaPinePrimary) without importing CivicaColors directly.

public extension Color {
    static let civicaPinePrimary         = CivicaColors.pinePrimary
    static let civicaPinePrimaryPressed  = CivicaColors.pinePrimaryPressed
    static let civicaPinePrimaryDisabled = CivicaColors.pinePrimaryDisabled
    static let civicaPineSurface         = CivicaColors.pineSurface

    static let civicaWheatPrimary        = CivicaColors.wheatPrimary
    static let civicaWheatPrimaryPressed = CivicaColors.wheatPrimaryPressed
    static let civicaWheatSurface        = CivicaColors.wheatSurface
    static let civicaWheatBright         = CivicaColors.wheatBright
    static let civicaWheatPop            = CivicaColors.wheatPop

    static let civicaBrickAccent         = CivicaColors.brickAccent
    static let civicaBrickAccentPressed  = CivicaColors.brickAccentPressed

    static let civicaPaperBright         = CivicaColors.paperBright
}

// MARK: - ShapeStyle sugar

public extension ShapeStyle where Self == Color {
    static var civicaPinePrimary: Color  { CivicaColors.pinePrimary }
    static var civicaWheatPrimary: Color { CivicaColors.wheatPrimary }
    static var civicaBrickAccent: Color  { CivicaColors.brickAccent }
    static var civicaPaper: Color        { CivicaColors.paper }
    static var civicaInk: Color          { CivicaColors.ink }
}

// MARK: - CTA foreground rule (dark-mode inversion)
// white-on-pine in dark mode ≈ 2.8:1 — fails WCAG AA.
// Apply to every primary CTA label instead of hardcoding .white.
public extension View {
    func civicaPrimaryCTAForeground() -> some View {
        self.foregroundStyle(Color.dynamic(light: "#FFFFFF", dark: "#1A1714"))
    }
}
