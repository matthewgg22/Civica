import SwiftUI
import UIKit

enum VoteNowColors {
    // Semantic surfaces and text
    static let canvasBackground = Color.dynamic(light: "#FFF8F3", dark: "#111418")
    static let surfacePrimary = Color.dynamic(light: "#FFFFFF", dark: "#1B1F24")
    static let surfaceSecondary = Color.dynamic(light: "#F7FAFD", dark: "#242A31")
    static let borderSubtle = Color.dynamic(light: "#F1DDD3", dark: "#3A434D")
    static let textPrimary = Color.dynamic(light: "#1F1B16", dark: "#F2F5F8")
    static let textSecondary = Color.dynamic(light: "#6B5B54", dark: "#BCC6D0")
    static let onPrimaryText = Color.dynamic(light: "#FFFFFF", dark: "#F8FBFF")
    static let iconOnPrimarySurface = Color.dynamic(light: "#FFFFFF", dark: "#DCE8F4")
    static let iconOnPrimaryBorder = Color.dynamic(light: "#FFFFFFE0", dark: "#DCE8F4E0")
    static let shadowSoft = Color.dynamic(light: "#00000029", dark: "#00000080")

    // Core Brand tones
    static let brandSoftBlue = Color.dynamic(light: "#B3DEF2", dark: "#3A596F")
    static let brandSoftRed = Color.dynamic(light: "#DF5846", dark: "#8E3F36")

    // Accent and state colors
    static let ctaBlue = Color.dynamic(light: "#246AA8", dark: "#246AA8")
    static let ctaBluePressed = Color.dynamic(light: "#1E5E95", dark: "#1E5E95")
    static let ctaBlueDisabled = Color.dynamic(light: "#56738E", dark: "#506984")
    static let ctaRed = Color.dynamic(light: "#C84637", dark: "#C84637")
    static let ctaRedPressed = Color.dynamic(light: "#A1372B", dark: "#A1372B")
    static let ctaRedDisabled = Color.dynamic(light: "#A35B53", dark: "#9D5952")
    static let successGreen = Color.dynamic(light: "#176E49", dark: "#176E49")
    static let warningAmber = Color.dynamic(light: "#9A5A14", dark: "#9A5A14")
    static let neutralStatus = Color.dynamic(light: "#5A5F66", dark: "#5A5F66")
    static let indigoStatus = Color.dynamic(light: "#4F46A5", dark: "#4F46A5")

    // Backward-compatible aliases used across existing views
    static let richBlue = ctaBlue
    static let richRed = ctaRed
    static let softBlue = brandSoftBlue
    static let softRed = brandSoftRed
    static let background = canvasBackground
    static let appBackground = canvasBackground
    static let surfaceWhite = surfacePrimary
    static let borderWarm = borderSubtle
    static let mutedText = textSecondary
    static let primaryText = textPrimary

    static let primaryCTA = ctaBlue
    static let urgentCTA = ctaRed
    static let infoSurfaceBlue = Color.dynamic(light: "#B3DEF252", dark: "#3A596F5F")
    static let infoSurfaceRed = Color.dynamic(light: "#DF584624", dark: "#8E3F3638")
    static let statusSuccessSurface = successGreen.opacity(0.14)
    static let statusWarningSurface = warningAmber.opacity(0.15)
    static let statusErrorSurface = urgentCTA.opacity(0.13)
    static let statusInfoSurface = primaryCTA.opacity(0.12)
    static let statusNeutralSurface = neutralStatus.opacity(0.13)
    static let secondaryButtonFill = surfaceSecondary
    static let secondaryButtonFillPressed = Color.dynamic(light: "#EAF4FB", dark: "#313B47")
    static let secondaryButtonFillDisabled = Color.dynamic(light: "#EEF3F7", dark: "#252C33")
    static let secondaryButtonBorder = ctaBlue.opacity(0.62)
    static let secondaryButtonDisabledBorder = Color.dynamic(light: "#A5B4C2", dark: "#4D5A67")
    static let mapvCardBackground = Color.dynamic(light: "#F3EBCB", dark: "#2A241B")
    static let supportPageBackground = Color.dynamic(light: "#ACD5E3", dark: "#1A2833")
    static let supportWarmSurface = Color.dynamic(light: "#F3D487", dark: "#3A2D15")
    static let timelineFocusGold = Color.dynamic(light: "#D79B1F", dark: "#F3D487")
    static let cardCornerRadius: CGFloat = 12
}

// Backward-compatible typealias so existing references continue compiling.
typealias VoteNowColor = VoteNowColors

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

struct VoteNowPrimaryCTAButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(VoteNowColors.onPrimaryText)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(backgroundColor(isPressed: configuration.isPressed))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(VoteNowColors.primaryCTA.opacity(0.24), lineWidth: 1)
            )
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        guard isEnabled else { return VoteNowColors.ctaBlueDisabled }
        return isPressed ? VoteNowColors.ctaBluePressed : VoteNowColors.ctaBlue
    }
}

struct VoteNowUrgentCTAButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(VoteNowColors.onPrimaryText)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(backgroundColor(isPressed: configuration.isPressed))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(VoteNowColors.urgentCTA.opacity(0.24), lineWidth: 1)
            )
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        guard isEnabled else { return VoteNowColors.ctaRedDisabled }
        return isPressed ? VoteNowColors.ctaRedPressed : VoteNowColors.ctaRed
    }
}

// Backward-compatible aliases for existing call sites.
typealias PrimaryButtonStyle = VoteNowPrimaryCTAButtonStyle
typealias UrgentButtonStyle = VoteNowUrgentCTAButtonStyle
