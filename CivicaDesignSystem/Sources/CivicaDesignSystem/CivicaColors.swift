import SwiftUI
import UIKit

public enum CivicaColors {
    private static let statusSurfaceAlpha: Double = 0.13

    // MARK: - Civica v1 brand (HANDOFF.md, locked May 10, 2026)

    /// Primary brand. Brick on Paper 6.42:1, on White 7.06:1 (AAA). Brick-light reads on dark surfaces.
    public static let brickPrimary         = Color.dynamic(light: "#9C3A24", dark: "#E8856E")
    public static let brickPrimaryPressed  = Color.dynamic(light: "#84311E", dark: "#D26A52")
    public static let brickPrimaryDisabled = Color.dynamic(light: "#B07A6E", dark: "#9D5C4D")

    /// Accent teal. **Deltas, success, on-target SLA only. Never body. Never paragraphs.**
    public static let accentTeal           = Color.dynamic(light: "#2A6F66", dark: "#5FA89E")

    /// Alias for `accentTeal`. Use when reading at the call site as a plain color
    /// name (e.g. low-risk indicator dots) rather than as an accent semantic.
    public static let teal                 = accentTeal

    /// Warm white background. Pure white reserved for printed output.
    public static let paper                = Color.dynamic(light: "#F5F2EC", dark: "#111418")

    /// Primary text.
    public static let ink                  = Color.dynamic(light: "#1A1714", dark: "#F2F5F8")

    /// Secondary text.
    public static let graphite             = Color.dynamic(light: "#5A544D", dark: "#BCC6D0")

    /// Tertiary text / placeholder copy.
    public static let muted                = Color.dynamic(light: "#6B655C", dark: "#9AA0A6")

    /// 12% black on light / 7% white on dark. The light value bumped from
    /// 7% so answer-row outlines remain visible on the cream paper.
    public static let hairline             = Color.dynamic(light: "#00000020", dark: "#FFFFFF12")

    /// Democrat party color. Mode-invariant — political colors don't shift with light/dark.
    /// Also used for the patriotic red+blue chrome on the Civica logo orbit.
    public static let partyDemocrat        = Color.dynamic(light: "#246AA8", dark: "#246AA8")

    /// Republican party color. Mode-invariant — political colors don't shift with light/dark.
    /// Also used for the patriotic red+blue chrome on the Civica logo orbit.
    public static let partyRepublican      = Color.dynamic(light: "#C84637", dark: "#C84637")

    /// Destructive / error states (form validation, network errors, irreversible actions).
    /// Slightly lifted in dark mode for contrast against `paper` dark surface.
    public static let destructive          = Color.dynamic(light: "#C84637", dark: "#E07060")
    public static let destructivePressed   = Color.dynamic(light: "#A1372B", dark: "#C45848")
    public static let destructiveDisabled  = Color.dynamic(light: "#A35B53", dark: "#9D5952")

    /// Soft brick wash — solid pastel for warm decorative tints, secondary surfaces.
    public static let brickSurface         = Color.dynamic(light: "#F1D4C8", dark: "#4A2A22")

    /// Soft teal wash — solid pastel for cool civic-engagement backgrounds.
    public static let tealSurface          = Color.dynamic(light: "#BCE0DA", dark: "#2C4D49")

    /// Warm card surface — sits one step above `paper` for card/pill backgrounds
    /// that need contrast against the cream base. Dark value is near-black to
    /// match the elevated surface intent in dark mode.
    public static let cardSurface          = Color.dynamic(light: "#EDE8DD", dark: "#1E1B17")

    // MARK: - Carried-forward surfaces (not addressed by handoff)

    public static let surfacePrimary       = Color.dynamic(light: "#FFFFFF", dark: "#1B1F24")
    public static let surfaceSecondary     = Color.dynamic(light: "#F7FAFD", dark: "#242A31")
    public static let onPrimaryText        = Color.dynamic(light: "#FFFFFF", dark: "#F8FBFF")
    public static let iconOnPrimarySurface = Color.dynamic(light: "#FFFFFF", dark: "#DCE8F4")
    public static let iconOnPrimaryBorder  = Color.dynamic(light: "#FFFFFFE0", dark: "#DCE8F4E0")
    public static let shadowSoft           = Color.dynamic(light: "#00000029", dark: "#00000080")

    public static let warningAmber         = Color.dynamic(light: "#9A5A14", dark: "#9A5A14")
    public static let neutralStatus        = Color.dynamic(light: "#5A5F66", dark: "#5A5F66")
    public static let indigoStatus         = Color.dynamic(light: "#4F46A5", dark: "#4F46A5")

    public static let statusSuccessSurface = accentTeal.opacity(statusSurfaceAlpha)
    public static let statusWarningSurface = warningAmber.opacity(statusSurfaceAlpha)
    public static let statusErrorSurface   = destructive.opacity(statusSurfaceAlpha)
    public static let statusInfoSurface    = brickPrimary.opacity(statusSurfaceAlpha)
    public static let statusNeutralSurface = neutralStatus.opacity(statusSurfaceAlpha)

    public static let secondaryButtonFill          = surfaceSecondary
    public static let secondaryButtonFillPressed   = Color.dynamic(light: "#EAF4FB", dark: "#313B47")
    public static let secondaryButtonFillDisabled  = Color.dynamic(light: "#EEF3F7", dark: "#252C33")
    public static let secondaryButtonBorder        = brickPrimary.opacity(0.62)
    public static let secondaryButtonDisabledBorder = Color.dynamic(light: "#A5B4C2", dark: "#4D5A67")

    public static let mapvCardBackground   = Color.dynamic(light: "#F3EBCB", dark: "#2A241B")
    public static let supportPageBackground = Color.dynamic(light: "#ACD5E3", dark: "#1A2833")
    public static let supportWarmSurface   = Color.dynamic(light: "#F3D487", dark: "#3A2D15")
    public static let timelineFocusGold    = Color.dynamic(light: "#D79B1F", dark: "#F3D487")
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

/// Primary CTA button. **56pt min hit target** per HANDOFF.md §1.
/// Caller can chain `.frame(maxWidth: .infinity)` for full-width layouts.
public struct CivicaPrimaryCTAButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(CivicaColors.onPrimaryText)
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.sm)
            .frame(minHeight: 56)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                    .fill(backgroundColor(isPressed: configuration.isPressed))
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                    .stroke(CivicaColors.brickPrimary.opacity(0.24), lineWidth: 1)
            )
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        guard isEnabled else { return CivicaColors.brickPrimaryDisabled }
        return isPressed ? CivicaColors.brickPrimaryPressed : CivicaColors.brickPrimary
    }
}

/// Secondary CTA button. **48pt min hit target** per HANDOFF.md §1.
/// Outlined with brick border; fill comes from `secondaryButtonFill` so the
/// button reads as quiet beside a primary brick CTA.
public struct CivicaSecondaryCTAButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(isEnabled ? CivicaColors.brickPrimary : CivicaColors.brickPrimaryDisabled)
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.sm)
            .frame(minHeight: 48)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                    .fill(configuration.isPressed ? CivicaColors.secondaryButtonFillPressed : CivicaColors.secondaryButtonFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                    .stroke(isEnabled ? CivicaColors.secondaryButtonBorder : CivicaColors.secondaryButtonDisabledBorder, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.9 : 1)
    }
}

/// Teal outline button. **48pt min hit target.**
/// Use for secondary actions in contexts where brick would compete with a
/// primary brick CTA on the same surface (e.g. marketplace action rows).
public struct CivicaTealOutlineButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(isEnabled ? CivicaColors.accentTeal : CivicaColors.muted)
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.sm)
            .frame(minHeight: 48)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                    .fill(configuration.isPressed ? CivicaColors.tealSurface.opacity(0.4) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                    .stroke(isEnabled ? CivicaColors.accentTeal.opacity(0.7) : CivicaColors.muted.opacity(0.4),
                            lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.88 : 1)
    }
}

/// Brick transparent button — brick-colored text, no border, no fill.
/// **44pt min hit target.** Use for tertiary text-link-style CTAs where a
/// full outline would add visual weight.
public struct CivicaBrickTransparentButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(isEnabled ? CivicaColors.brickPrimary : CivicaColors.brickPrimaryDisabled)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.xs)
            .frame(minHeight: 44)
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

/// Compact primary button. **40pt min hit target.**
/// Use for inline or list-row CTAs where 56pt would be too tall.
/// Same brick fill as `CivicaPrimaryCTAButtonStyle`.
public struct CivicaCompactButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(CivicaColors.onPrimaryText)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.xs)
            .frame(minHeight: 40)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                    .fill(compactFill(isPressed: configuration.isPressed))
            )
    }

    private func compactFill(isPressed: Bool) -> Color {
        guard isEnabled else { return CivicaColors.brickPrimaryDisabled }
        return isPressed ? CivicaColors.brickPrimaryPressed : CivicaColors.brickPrimary
    }
}
