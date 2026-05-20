import SwiftUI
import UIKit

public enum CivicaColors {
    private static let statusSurfaceAlpha: Double = 0.13

    // MARK: - Civica v1 brand (HANDOFF.md, locked May 10, 2026)
    // brickPrimary + brickPrimaryPressed moved to deprecation shims below (v2: → brickAccent).
    // brickPrimaryDisabled kept as-is; deprecated in Phase 3 once button component swap ships.
    public static let brickPrimaryDisabled = Color.dynamic(light: "#B07A6E", dark: "#9D5C4D")

    /// Accent teal. **Deltas, success, on-target SLA only. Never body. Never paragraphs.**
    public static let accentTeal           = Color.dynamic(light: "#2A6F66", dark: "#5FA89E")

    /// Alias for `accentTeal`. Use when reading at the call site as a plain color
    /// name (e.g. low-risk indicator dots) rather than as an accent semantic.
    public static let teal                 = accentTeal

    /// Warm white background. Pure white reserved for printed output.
    /// v2: lifted 2 pts cooler (#F5F2EC → #F7F5EF) — less papery-wood under pine.
    public static let paper                = Color.dynamic(light: "#F7F5EF", dark: "#111418")

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

    // MARK: - Carried-forward surfaces (not addressed by handoff)

    public static let surfacePrimary       = Color.dynamic(light: "#FFFFFF", dark: "#1B1F24")
    /// v2: rebased from cool blue-white → warm-neutral (old value read off-family with pine).
    public static let surfaceSecondary     = Color.dynamic(light: "#F0EEE6", dark: "#2A2620")
    public static let onPrimaryText        = Color.dynamic(light: "#FFFFFF", dark: "#F8FBFF")
    public static let iconOnPrimarySurface = Color.dynamic(light: "#FFFFFF", dark: "#DCE8F4")
    public static let iconOnPrimaryBorder  = Color.dynamic(light: "#FFFFFFE0", dark: "#DCE8F4E0")
    public static let shadowSoft           = Color.dynamic(light: "#00000029", dark: "#00000080")

    /// v2: shifted to burnt orange — separates clearly from wheatPressed (#9A5A14 → #B5511E).
    public static let warningAmber         = Color.dynamic(light: "#B5511E", dark: "#B5511E")
    public static let neutralStatus        = Color.dynamic(light: "#5A5F66", dark: "#5A5F66")
    public static let indigoStatus         = Color.dynamic(light: "#4F46A5", dark: "#4F46A5")

    // v2: success routes to pine (in family); info re-routes to indigo soft tint at 8%
    // (was brickPrimary @13% — collided with success when both were pine).
    public static let statusSuccessSurface = pinePrimary.opacity(statusSurfaceAlpha)
    public static let statusWarningSurface = warningAmber.opacity(statusSurfaceAlpha)
    public static let statusErrorSurface   = destructive.opacity(statusSurfaceAlpha)
    public static let statusInfoSurface    = indigoStatus.opacity(0.08)
    public static let statusNeutralSurface = neutralStatus.opacity(statusSurfaceAlpha)

    public static let secondaryButtonFill          = surfaceSecondary
    public static let secondaryButtonFillPressed   = Color.dynamic(light: "#EAF4FB", dark: "#313B47")
    public static let secondaryButtonFillDisabled  = Color.dynamic(light: "#EEF3F7", dark: "#252C33")
    public static let secondaryButtonBorder        = brickPrimary.opacity(0.62)
    public static let secondaryButtonDisabledBorder = Color.dynamic(light: "#A5B4C2", dark: "#4D5A67")

    public static let mapvCardBackground   = Color.dynamic(light: "#F3EBCB", dark: "#2A241B")
    public static let supportPageBackground = Color.dynamic(light: "#ACD5E3", dark: "#1A2833")
    public static let supportWarmSurface   = Color.dynamic(light: "#F3D487", dark: "#3A2D15")
    // timelineFocusGold moved to deprecation shim below (v2: → wheatPop).
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

// MARK: - v2 deprecation shims
// v1 token names continue to compile with warnings, pointing to their v2 replacements.
// Remove these after Phase 3 (one deprecation cycle post Phase 2 ship).

extension CivicaColors {
    @available(*, deprecated, renamed: "brickAccent",
               message: "brickPrimary demoted to recovery only. Use pinePrimary for CTAs; brickAccent for recovery flows.")
    public static var brickPrimary: Color { brickAccent }

    @available(*, deprecated, renamed: "brickAccentPressed",
               message: "Use pinePrimaryPressed for CTA press states; brickAccentPressed for recovery.")
    public static var brickPrimaryPressed: Color { brickAccentPressed }

    @available(*, deprecated, renamed: "wheatPop",
               message: "timelineFocusGold superseded by wheatPop in the same focused/hover role.")
    public static var timelineFocusGold: Color { wheatPop }
}
