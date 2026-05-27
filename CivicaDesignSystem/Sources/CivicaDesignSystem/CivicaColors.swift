import SwiftUI
import UIKit

public enum CivicaColors {
    private static let statusSurfaceAlpha: Double = 0.13

    // MARK: - v1 tokens carried forward
    // brickPrimary + brickPrimaryPressed: deprecated shims at bottom of file → brickAccent/brickAccentPressed.
    // brickPrimaryDisabled: kept until button component swap fully ships in Phase 2.
    public static let brickPrimaryDisabled = Color.dynamic(light: "#B07A6E", dark: "#9D5C4D")

    /// Accent teal. **Deltas, charts, on-target SLA only. Never body text. Banished from chrome.**
    /// Text use requires ≥16pt. For buttons/links/nav use pinePrimary.
    public static let accentTeal           = Color.dynamic(light: "#2A6F66", dark: "#5FA89E")

    /// Alias for `accentTeal`.
    public static let teal                 = accentTeal

    /// Warm white background. v2: lifted 2 pts cooler (#F5F2EC → #F7F5EF) — less papery-wood under pine.
    public static let paper                = Color.dynamic(light: "#F7F5EF", dark: "#111418")

    /// Primary text.
    public static let ink                  = Color.dynamic(light: "#1A1714", dark: "#F2F5F8")

    /// Secondary text.
    public static let graphite             = Color.dynamic(light: "#5A544D", dark: "#BCC6D0")

    /// Tertiary text / placeholder copy.
    public static let muted                = Color.dynamic(light: "#6B655C", dark: "#9AA0A6")

    /// 12% black on light / 7% white on dark.
    public static let hairline             = Color.dynamic(light: "#00000020", dark: "#FFFFFF12")

    /// Democrat party color. Mode-invariant.
    public static let partyDemocrat        = Color.dynamic(light: "#246AA8", dark: "#246AA8")

    /// Republican party color. Mode-invariant.
    public static let partyRepublican      = Color.dynamic(light: "#C84637", dark: "#C84637")

    public static let destructive          = Color.dynamic(light: "#C84637", dark: "#E07060")
    public static let destructivePressed   = Color.dynamic(light: "#A1372B", dark: "#C45848")
    public static let destructiveDisabled  = Color.dynamic(light: "#A35B53", dark: "#9D5952")

    /// Soft brick wash — recovery surface tint.
    public static let brickSurface         = Color.dynamic(light: "#F1D4C8", dark: "#4A2A22")

    /// Soft teal wash — cool civic-engagement backgrounds.
    public static let tealSurface          = Color.dynamic(light: "#BCE0DA", dark: "#2C4D49")

    // MARK: - Terracotta — "urgent neutral · act on this" surface
    //
    // Codified during the May 2026 plan-design-review C1 follow-up to
    // close the wheat-creep gap: cold-start home "Need food today" card,
    // FindHelp nearest-help pill, waiting-room emergency-CalFresh CTA,
    // and expiring-benefits reminders previously borrowed wheatPrimary
    // (positive outcome) for what is really an urgent-action prompt.
    // Terracotta sits in its own semantic slot:
    //
    //   • pinePrimary       — primary CTA / brand anchor
    //   • amberPrimary      — positive outcome (deposit landed, approval)
    //   • warningAmber      — process caution (low balance, county may flag)
    //   • brickAccent       — recovery / denial / human-catch
    //   • terracottaAccent  — urgent neutral · act on this (NEW)
    //
    // Reads warmer than brick (less pink-red, away from denial semantics),
    // cooler than wheat (no celebration), louder than warning surface.
    //
    // ⚠ ADJACENCY CONSTRAINT — DO NOT PLACE TERRACOTTA AND BRICK
    // SURFACES VISIBLE IN THE SAME COMPOSITION WITHOUT A SEPARATOR.
    //
    // scripts/check_terracotta_brick_contrast.py confirmed at
    // codification: terracottaSurface (#F0DCD0) and brickSurface
    // (#F1D4C8) have a 1.06:1 luminance contrast — well below the
    // 1.3:1 adjacency-differentiation target (Apple HIG, BBC GEL).
    // Deuteranopia and protanopia simulations yield the same ratio.
    // The two surfaces visually collapse when placed next to each
    // other.
    //
    // If a future design needs both visible at once, choose ONE of:
    //   (a) insert a hairline / paper gap between them so the
    //       boundary itself carries the differentiation, or
    //   (b) propose a terracotta hue shift toward salmon / amber-
    //       orange (further from brick's pink-red), re-run the
    //       script, and update the hex here.
    //
    // The accent value passes body-text contrast on its own surface
    // (terracottaAccent on terracottaSurface = 6.04:1, WCAG AA OK),
    // so single-surface use is safe.
    public static let terracottaSurface        = Color.dynamic(light: "#F0DCD0", dark: "#3D2620")
    public static let terracottaSurfacePressed = Color.dynamic(light: "#E5CFBF", dark: "#34211C")
    public static let terracottaAccent         = Color.dynamic(light: "#7E3F26", dark: "#C77C5A")

    // MARK: - Carried-forward surfaces

    public static let surfacePrimary       = Color.dynamic(light: "#FFFFFF", dark: "#1B1F24")
    /// v2: rebased from cool blue-white → warm-neutral (old value read off-family with pine).
    public static let surfaceSecondary     = Color.dynamic(light: "#F0EEE6", dark: "#2A2620")
    public static let onPrimaryText        = Color.dynamic(light: "#FFFFFF", dark: "#F8FBFF")
    public static let iconOnPrimarySurface = Color.dynamic(light: "#FFFFFF", dark: "#DCE8F4")
    public static let iconOnPrimaryBorder  = Color.dynamic(light: "#FFFFFFE0", dark: "#DCE8F4E0")
    public static let shadowSoft           = Color.dynamic(light: "#00000029", dark: "#00000080")

    /// v2: shifted to burnt orange — separates from wheatPressed (#9A5A14 → #B5511E).
    public static let warningAmber         = Color.dynamic(light: "#B5511E", dark: "#B5511E")
    public static let neutralStatus        = Color.dynamic(light: "#5A5F66", dark: "#5A5F66")
    public static let indigoStatus         = Color.dynamic(light: "#4F46A5", dark: "#4F46A5")

    // v2: success → pine (in family). Info → indigo soft tint at 8% (avoids pine collision).
    public static let statusSuccessSurface = pinePrimary.opacity(statusSurfaceAlpha)
    public static let statusWarningSurface = warningAmber.opacity(statusSurfaceAlpha)
    public static let statusErrorSurface   = destructive.opacity(statusSurfaceAlpha)
    public static let statusInfoSurface    = indigoStatus.opacity(0.08)
    public static let statusNeutralSurface = neutralStatus.opacity(statusSurfaceAlpha)

    // v2: secondary button fill updated to warm values; border tracks pinePrimary.
    public static let secondaryButtonFill          = surfaceSecondary
    public static let secondaryButtonFillPressed   = Color.dynamic(light: "#EDE8DD", dark: "#2C2820")
    public static let secondaryButtonFillDisabled  = Color.dynamic(light: "#E8E4DA", dark: "#252320")
    public static let secondaryButtonBorder        = pinePrimary.opacity(0.24)
    public static let secondaryButtonDisabledBorder = Color.dynamic(light: "#A5B4C2", dark: "#4D5A67")

    public static let mapvCardBackground   = Color.dynamic(light: "#F3EBCB", dark: "#2A241B")
    public static let supportPageBackground = Color.dynamic(light: "#ACD5E3", dark: "#1A2833")
    public static let supportWarmSurface   = Color.dynamic(light: "#F3D487", dark: "#3A2D15")
    // timelineFocusGold → deprecated shim at bottom (v2: wheatPop).
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

/// Primary CTA button. **56pt min hit target.**
/// v2: pine fill. Use `.civicaPrimaryCTAForeground()` on label for correct dark-mode inversion.
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
                    .stroke(CivicaColors.pinePrimary.opacity(0.24), lineWidth: 1)
            )
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        guard isEnabled else { return CivicaColors.pinePrimaryDisabled }
        return isPressed ? CivicaColors.pinePrimaryPressed : CivicaColors.pinePrimary
    }
}

/// Secondary CTA button. **48pt min hit target.**
/// v2: pine foreground + border. Fill from `secondaryButtonFill` (warm neutral).
public struct CivicaSecondaryCTAButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(isEnabled ? CivicaColors.pinePrimary : CivicaColors.pinePrimaryDisabled)
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.sm)
            .frame(minHeight: 48)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                    .fill(configuration.isPressed ? CivicaColors.secondaryButtonFillPressed : CivicaColors.secondaryButtonFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                    .stroke(isEnabled ? CivicaColors.pinePrimary.opacity(0.62) : CivicaColors.secondaryButtonDisabledBorder, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.9 : 1)
    }
}

// MARK: - v2 deprecation shims
// Remove after Phase 3 (one deprecation cycle post Phase 2 ship).

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
