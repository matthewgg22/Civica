import SwiftUI
import UIKit

enum VoteNowColors {
    // Core Brand Pastels
    static let brandSoftBlue = Color(hex: "#B3DEF2")
    static let brandSoftRed = Color(hex: "#DF5846")

    // Warm Neutrals
    static let appBackground = Color(hex: "#FFF8F3")
    static let surfaceWhite = Color(hex: "#FFFFFF")
    static let borderWarm = Color(hex: "#F1DDD3")
    static let mutedText = Color(hex: "#6B5B54")
    static let primaryText = Color(hex: "#1F1B16")

    // Rich CTA Colors
    static let ctaBlue = Color(hex: "#2B76B9")
    static let ctaRed = Color(hex: "#C84637")
    static let successGreen = Color(hex: "#1F8A5B")
    static let warningAmber = Color(hex: "#D98B2B")

    // Backward-compatible aliases used across existing views
    static let richBlue = ctaBlue
    static let richRed = ctaRed
    static let softBlue = brandSoftBlue
    static let softRed = brandSoftRed
    static let background = appBackground

    static let primaryCTA = ctaBlue
    static let urgentCTA = ctaRed
    static let infoSurfaceBlue = brandSoftBlue.opacity(0.32)
    static let infoSurfaceRed = brandSoftRed.opacity(0.14)
    static let cardCornerRadius: CGFloat = 12
}

// Backward-compatible typealias so existing references continue compiling.
typealias VoteNowColor = VoteNowColors

extension Color {
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
            .foregroundColor(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(VoteNowColors.ctaBlue)
                    .opacity(isEnabled ? (configuration.isPressed ? 0.84 : 1.0) : 0.5)
            )
    }
}

struct VoteNowUrgentCTAButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(VoteNowColors.ctaRed)
                    .opacity(isEnabled ? (configuration.isPressed ? 0.84 : 1.0) : 0.5)
            )
    }
}

// Backward-compatible aliases for existing call sites.
typealias PrimaryButtonStyle = VoteNowPrimaryCTAButtonStyle
typealias UrgentButtonStyle = VoteNowUrgentCTAButtonStyle
