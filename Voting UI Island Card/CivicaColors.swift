import SwiftUI
import UIKit

// Widget extension keeps its own copy of the design tokens because it cannot
// import the CivicaDesignSystem Swift Package directly. Values mirror the
// main package — keep them in sync when updating either side.

enum CivicaColors {
    private static let statusSurfaceAlpha: Double = 0.13

    // Semantic surfaces and text (mirrored from package)
    static let surfacePrimary = Color.dynamic(light: "#FFFFFF", dark: "#1B1F24")
    static let surfaceSecondary = Color.dynamic(light: "#F7FAFD", dark: "#242A31")
    static let onPrimaryText = Color.dynamic(light: "#FFFFFF", dark: "#F8FBFF")
    static let iconOnPrimarySurface = Color.dynamic(light: "#FFFFFF", dark: "#DCE8F4")
    static let iconOnPrimaryBorder = Color.dynamic(light: "#FFFFFFE0", dark: "#DCE8F4E0")
    static let shadowSoft = Color.dynamic(light: "#00000029", dark: "#00000080")

    // MARK: - Civica v1 brand (HANDOFF.md, locked May 10, 2026)

    /// Primary brand. Brick on Paper 6.42:1, on White 7.06:1 (AAA).
    static let brickPrimary         = Color.dynamic(light: "#9C3A24", dark: "#E8856E")
    static let brickPrimaryPressed  = Color.dynamic(light: "#84311E", dark: "#D26A52")
    static let brickPrimaryDisabled = Color.dynamic(light: "#B07A6E", dark: "#9D5C4D")

    /// Accent teal. Deltas, success, on-target SLA only. Never body. Never paragraphs.
    static let accentTeal           = Color.dynamic(light: "#2A6F66", dark: "#5FA89E")

    /// Warm white background. Pure white reserved for printed output.
    static let paper                = Color.dynamic(light: "#F5F2EC", dark: "#111418")

    /// Primary text.
    static let ink                  = Color.dynamic(light: "#1A1714", dark: "#F2F5F8")

    /// Secondary text.
    static let graphite             = Color.dynamic(light: "#5A544D", dark: "#BCC6D0")

    /// Tertiary text / placeholder copy.
    static let muted                = Color.dynamic(light: "#8A8278", dark: "#9AA0A6")

    /// 7% black/white border. The only divider color.
    static let hairline             = Color.dynamic(light: "#00000012", dark: "#FFFFFF12")

    /// Democrat party color. Mode-invariant.
    static let partyDemocrat        = Color.dynamic(light: "#246AA8", dark: "#246AA8")

    /// Republican party color. Mode-invariant.
    static let partyRepublican      = Color.dynamic(light: "#C84637", dark: "#C84637")

    /// Destructive / error states.
    static let destructive          = Color.dynamic(light: "#C84637", dark: "#E07060")
    static let destructivePressed   = Color.dynamic(light: "#A1372B", dark: "#C45848")
    static let destructiveDisabled  = Color.dynamic(light: "#A35B53", dark: "#9D5952")

    /// Soft warm/cool surface washes (solid pastels — `.opacity(...)` chains compose predictably).
    static let brickSurface         = Color.dynamic(light: "#F1D4C8", dark: "#4A2A22")
    static let tealSurface          = Color.dynamic(light: "#BCE0DA", dark: "#2C4D49")

    // MARK: - Status colors (not addressed by handoff; carried forward)

    static let warningAmber         = Color.dynamic(light: "#9A5A14", dark: "#9A5A14")
    static let neutralStatus        = Color.dynamic(light: "#5A5F66", dark: "#5A5F66")
    static let indigoStatus         = Color.dynamic(light: "#4F46A5", dark: "#4F46A5")

    static let statusSuccessSurface = accentTeal.opacity(statusSurfaceAlpha)
    static let statusWarningSurface = warningAmber.opacity(statusSurfaceAlpha)
    static let statusErrorSurface   = destructive.opacity(statusSurfaceAlpha)
    static let statusInfoSurface    = brickPrimary.opacity(statusSurfaceAlpha)
    static let statusNeutralSurface = neutralStatus.opacity(statusSurfaceAlpha)
}

extension Color {
    static func dynamic(light: String, dark: String) -> Color {
        Color(
            uiColor: UIColor { traits in
                let hex = traits.userInterfaceStyle == .dark ? dark : light
                return UIColor(hex: hex)
            }
        )
    }

    init(hex: String) {
        let cleaned = hex
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")

        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)

        let r, g, b, a: UInt64
        switch cleaned.count {
        case 8:
            r = (value & 0xFF000000) >> 24
            g = (value & 0x00FF0000) >> 16
            b = (value & 0x0000FF00) >> 8
            a = value & 0x000000FF
        default:
            r = (value & 0xFF0000) >> 16
            g = (value & 0x00FF00) >> 8
            b = value & 0x0000FF
            a = 0xFF
        }

        self.init(
            .sRGB,
            red: Double(r) / 255.0,
            green: Double(g) / 255.0,
            blue: Double(b) / 255.0,
            opacity: Double(a) / 255.0
        )
    }
}

extension UIColor {
    convenience init(hex: String) {
        let cleaned = hex
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")

        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)

        let r, g, b, a: UInt64
        switch cleaned.count {
        case 8:
            r = (value & 0xFF000000) >> 24
            g = (value & 0x00FF0000) >> 16
            b = (value & 0x0000FF00) >> 8
            a = value & 0x000000FF
        default:
            r = (value & 0xFF0000) >> 16
            g = (value & 0x00FF00) >> 8
            b = value & 0x0000FF
            a = 0xFF
        }

        self.init(
            red: CGFloat(r) / 255.0,
            green: CGFloat(g) / 255.0,
            blue: CGFloat(b) / 255.0,
            alpha: CGFloat(a) / 255.0
        )
    }
}
