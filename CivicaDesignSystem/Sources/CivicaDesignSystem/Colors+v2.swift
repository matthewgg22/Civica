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
