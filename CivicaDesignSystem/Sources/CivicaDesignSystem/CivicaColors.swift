import SwiftUI
import UIKit

public enum CivicaColors {
    private static let statusSurfaceAlpha: Double = 0.13

    // Semantic surfaces and text
    public static let canvasBackground = Color.dynamic(light: "#FFF8F3", dark: "#111418")
    public static let surfacePrimary = Color.dynamic(light: "#FFFFFF", dark: "#1B1F24")
    public static let surfaceSecondary = Color.dynamic(light: "#F7FAFD", dark: "#242A31")
    public static let borderSubtle = Color.dynamic(light: "#F1DDD3", dark: "#3A434D")
    public static let textPrimary = Color.dynamic(light: "#1F1B16", dark: "#F2F5F8")
    public static let textSecondary = Color.dynamic(light: "#6B5B54", dark: "#BCC6D0")
    public static let onPrimaryText = Color.dynamic(light: "#FFFFFF", dark: "#F8FBFF")
    public static let iconOnPrimarySurface = Color.dynamic(light: "#FFFFFF", dark: "#DCE8F4")
    public static let iconOnPrimaryBorder = Color.dynamic(light: "#FFFFFFE0", dark: "#DCE8F4E0")
    public static let shadowSoft = Color.dynamic(light: "#00000029", dark: "#00000080")

    // Core Brand tones
    public static let brandSoftBlue = Color.dynamic(light: "#B3DEF2", dark: "#3A596F")
    public static let brandSoftRed = Color.dynamic(light: "#E88578", dark: "#8E3F36")

    // Accent and state colors
    public static let ctaBlue = Color.dynamic(light: "#246AA8", dark: "#246AA8")
    public static let ctaBluePressed = Color.dynamic(light: "#1E5E95", dark: "#1E5E95")
    public static let ctaBlueDisabled = Color.dynamic(light: "#56738E", dark: "#506984")
    public static let ctaRed = Color.dynamic(light: "#C84637", dark: "#C84637")
    public static let ctaRedPressed = Color.dynamic(light: "#A1372B", dark: "#A1372B")
    public static let ctaRedDisabled = Color.dynamic(light: "#A35B53", dark: "#9D5952")
    public static let successGreen = Color.dynamic(light: "#176E49", dark: "#176E49")
    public static let warningAmber = Color.dynamic(light: "#9A5A14", dark: "#9A5A14")
    public static let neutralStatus = Color.dynamic(light: "#5A5F66", dark: "#5A5F66")
    public static let indigoStatus = Color.dynamic(light: "#4F46A5", dark: "#4F46A5")

    public static let infoSurfaceBlue = Color.dynamic(light: "#B3DEF252", dark: "#3A596F5F")
    public static let infoSurfaceRed = Color.dynamic(light: "#DF584624", dark: "#8E3F3638")
    public static let statusSuccessSurface = successGreen.opacity(statusSurfaceAlpha)
    public static let statusWarningSurface = warningAmber.opacity(statusSurfaceAlpha)
    public static let statusErrorSurface = ctaRed.opacity(statusSurfaceAlpha)
    public static let statusInfoSurface = ctaBlue.opacity(statusSurfaceAlpha)
    public static let statusNeutralSurface = neutralStatus.opacity(statusSurfaceAlpha)
    public static let secondaryButtonFill = surfaceSecondary
    public static let secondaryButtonFillPressed = Color.dynamic(light: "#EAF4FB", dark: "#313B47")
    public static let secondaryButtonFillDisabled = Color.dynamic(light: "#EEF3F7", dark: "#252C33")
    public static let secondaryButtonBorder = ctaBlue.opacity(0.62)
    public static let secondaryButtonDisabledBorder = Color.dynamic(light: "#A5B4C2", dark: "#4D5A67")
    public static let mapvCardBackground = Color.dynamic(light: "#F3EBCB", dark: "#2A241B")
    public static let supportPageBackground = Color.dynamic(light: "#ACD5E3", dark: "#1A2833")
    public static let supportWarmSurface = Color.dynamic(light: "#F3D487", dark: "#3A2D15")
    public static let timelineFocusGold = Color.dynamic(light: "#D79B1F", dark: "#F3D487")
    public static let cardCornerRadius: CGFloat = 12

    // MARK: - Civica v1 brand (HANDOFF.md, locked May 10, 2026)
    // These supersede the legacy ctaBlue/ctaRed/canvasBackground/textPrimary set.
    // Migration in progress — both old and new live here until consumers are swept.

    /// Primary brand. Brick on Paper 6.42:1, on White 7.06:1 (AAA). Brick-light reads on dark surfaces.
    public static let brickPrimary         = Color.dynamic(light: "#9C3A24", dark: "#E8856E")
    public static let brickPrimaryPressed  = Color.dynamic(light: "#84311E", dark: "#D26A52")
    public static let brickPrimaryDisabled = Color.dynamic(light: "#B07A6E", dark: "#9D5C4D")

    /// Accent teal. **Deltas, success, on-target SLA only. Never body. Never paragraphs.**
    public static let accentTeal           = Color.dynamic(light: "#2A6F66", dark: "#5FA89E")

    /// Warm white background. Pure white reserved for printed output.
    public static let paper                = Color.dynamic(light: "#F5F2EC", dark: "#111418")

    /// Primary text.
    public static let ink                  = Color.dynamic(light: "#1A1714", dark: "#F2F5F8")

    /// Secondary text.
    public static let graphite             = Color.dynamic(light: "#5A544D", dark: "#BCC6D0")

    /// Tertiary text / placeholder copy.
    public static let muted                = Color.dynamic(light: "#8A8278", dark: "#9AA0A6")

    /// 7% black/white border. No new grays — this is the only divider color.
    public static let hairline             = Color.dynamic(light: "#00000012", dark: "#FFFFFF12")

    /// Democrat party color. Mode-invariant — political colors don't shift with light/dark.
    /// Same value as legacy `ctaBlue`; the rename clarifies the semantic role.
    /// Also used for the patriotic red+blue chrome on the Civica logo orbit.
    public static let partyDemocrat        = Color.dynamic(light: "#246AA8", dark: "#246AA8")

    /// Republican party color. Mode-invariant — political colors don't shift with light/dark.
    /// Same value as legacy `ctaRed`; the rename clarifies the semantic role.
    /// Also used for the patriotic red+blue chrome on the Civica logo orbit.
    public static let partyRepublican      = Color.dynamic(light: "#C84637", dark: "#C84637")

    /// Destructive / error states (form validation, network errors, irreversible actions).
    /// Slightly lifted in dark mode for contrast against `paper` dark surface.
    public static let destructive          = Color.dynamic(light: "#C84637", dark: "#E07060")
    public static let destructivePressed   = Color.dynamic(light: "#A1372B", dark: "#C45848")
    public static let destructiveDisabled  = Color.dynamic(light: "#A35B53", dark: "#9D5952")

    /// Soft brick wash — for warm decorative tints, secondary surfaces.
    /// Replaces legacy `brandSoftRed` semantic.
    public static let brickSurface         = brickPrimary.opacity(0.10)

    /// Soft teal wash — for cool civic-engagement backgrounds.
    /// Replaces legacy `brandSoftBlue` semantic. Civic-calm tone.
    public static let tealSurface          = accentTeal.opacity(0.10)
}

public extension Color {
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

public extension UIColor {
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

public struct CivicaPrimaryCTAButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(CivicaColors.onPrimaryText)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.sm)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .fill(backgroundColor(isPressed: configuration.isPressed))
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .stroke(CivicaColors.ctaBlue.opacity(0.24), lineWidth: 1)
            )
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        guard isEnabled else { return CivicaColors.ctaBlueDisabled }
        return isPressed ? CivicaColors.ctaBluePressed : CivicaColors.ctaBlue
    }
}

public struct CivicaUrgentCTAButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(CivicaColors.onPrimaryText)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.sm)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .fill(backgroundColor(isPressed: configuration.isPressed))
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .stroke(CivicaColors.ctaRed.opacity(0.24), lineWidth: 1)
            )
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        guard isEnabled else { return CivicaColors.ctaRedDisabled }
        return isPressed ? CivicaColors.ctaRedPressed : CivicaColors.ctaRed
    }
}
