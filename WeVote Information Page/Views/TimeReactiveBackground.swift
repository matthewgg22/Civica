import SwiftUI
import UIKit

struct TimeReactiveBackground: View {
    @Binding var sliderValue: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var animationDuration: Double {
        reduceMotion ? 0.12 : 0.25
    }

    private var theme: TimeOfDayTheme {
        TimeOfDayTheme.theme(for: sliderValue)
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [theme.baseColor, theme.secondaryColor],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            LinearGradient(
                colors: [
                    Color.white.opacity(theme.ambientOverlayOpacity * 0.52),
                    Color.black.opacity(theme.ambientOverlayOpacity * 0.34)
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            if theme.sunGlowIntensity > 0.001 {
                RadialGradient(
                    colors: [
                        CivicaColors.brandSoftRed.opacity(theme.sunGlowIntensity * 0.24),
                        CivicaColors.warningAmber.opacity(theme.sunGlowIntensity * 0.34),
                        .clear
                    ],
                    center: .top,
                    startRadius: 10,
                    endRadius: 360
                )
                .offset(y: -38)
                .blendMode(.plusLighter)
            }

            if theme.vignetteIntensity > 0.001 {
                Rectangle()
                    .fill(
                        RadialGradient(
                            colors: [
                                .clear,
                                .clear,
                                Color.black.opacity(theme.vignetteIntensity)
                            ],
                            center: .center,
                            startRadius: 130,
                            endRadius: 780
                        )
                    )
                    .blendMode(.multiply)
            }
        }
        .ignoresSafeArea()
        .animation(.easeInOut(duration: animationDuration), value: sliderValue)
    }
}

struct TimeOfDayTheme {
    let baseColor: Color
    let secondaryColor: Color
    let ambientOverlayOpacity: Double
    let cardScrimOpacity: Double
    let sunGlowIntensity: Double
    let vignetteIntensity: Double

    var cardScrimColor: Color {
        // Brighter themes need a dark scrim for card contrast; darker themes need a light haze.
        let useDarkScrim = (ambientOverlayOpacity + sunGlowIntensity) > 0.42
        return useDarkScrim ? Color.black : Color.white
    }

    private struct Keyframe {
        let position: Double
        let theme: TimeOfDayTheme
    }

    private static let keyframes: [Keyframe] = [
        Keyframe(
            position: 0.0,
            theme: TimeOfDayTheme(
                baseColor: Color(hex: "#B3DEF2"),
                secondaryColor: Color(hex: "#D6E8F8"),
                ambientOverlayOpacity: 0.16,
                cardScrimOpacity: 0.05,
                sunGlowIntensity: 0.08,
                vignetteIntensity: 0.08
            )
        ),
        Keyframe(
            position: 0.25,
            theme: TimeOfDayTheme(
                baseColor: Color(hex: "#BFE5F6"),
                secondaryColor: Color(hex: "#E8F4FD"),
                ambientOverlayOpacity: 0.12,
                cardScrimOpacity: 0.04,
                sunGlowIntensity: 0.20,
                vignetteIntensity: 0.05
            )
        ),
        Keyframe(
            position: 0.5,
            theme: TimeOfDayTheme(
                baseColor: Color(hex: "#D6ECF7"),
                secondaryColor: Color(hex: "#FFDFAF"),
                ambientOverlayOpacity: 0.10,
                cardScrimOpacity: 0.07,
                sunGlowIntensity: 0.36,
                vignetteIntensity: 0.03
            )
        ),
        Keyframe(
            position: 0.75,
            theme: TimeOfDayTheme(
                baseColor: Color(hex: "#F2D5C7"),
                secondaryColor: Color(hex: "#DF5846"),
                ambientOverlayOpacity: 0.20,
                cardScrimOpacity: 0.12,
                sunGlowIntensity: 0.22,
                vignetteIntensity: 0.12
            )
        ),
        Keyframe(
            position: 1.0,
            theme: TimeOfDayTheme(
                baseColor: Color(hex: "#1E2E49"),
                secondaryColor: Color(hex: "#2F476B"),
                ambientOverlayOpacity: 0.26,
                cardScrimOpacity: 0.14,
                sunGlowIntensity: 0.04,
                vignetteIntensity: 0.22
            )
        )
    ]

    static func theme(for sliderValue: Double) -> TimeOfDayTheme {
        let p = min(max(sliderValue, 0), 1)

        if p <= keyframes[0].position {
            return keyframes[0].theme
        }
        if p >= keyframes[keyframes.count - 1].position {
            return keyframes[keyframes.count - 1].theme
        }

        for idx in 0..<(keyframes.count - 1) {
            let left = keyframes[idx]
            let right = keyframes[idx + 1]
            guard p >= left.position && p <= right.position else { continue }
            let localT = (p - left.position) / max(0.0001, right.position - left.position)
            return left.theme.interpolated(to: right.theme, t: localT)
        }

        return keyframes[keyframes.count - 1].theme
    }

    private func interpolated(to other: TimeOfDayTheme, t: Double) -> TimeOfDayTheme {
        let clampedT = min(max(t, 0), 1)
        return TimeOfDayTheme(
            baseColor: ColorLerp.lerp(self.baseColor, other.baseColor, t: clampedT),
            secondaryColor: ColorLerp.lerp(self.secondaryColor, other.secondaryColor, t: clampedT),
            ambientOverlayOpacity: ColorLerp.lerp(self.ambientOverlayOpacity, other.ambientOverlayOpacity, t: clampedT),
            cardScrimOpacity: ColorLerp.lerp(self.cardScrimOpacity, other.cardScrimOpacity, t: clampedT),
            sunGlowIntensity: ColorLerp.lerp(self.sunGlowIntensity, other.sunGlowIntensity, t: clampedT),
            vignetteIntensity: ColorLerp.lerp(self.vignetteIntensity, other.vignetteIntensity, t: clampedT)
        )
    }
}

private enum ColorLerp {
    static func lerp(_ start: Double, _ end: Double, t: Double) -> Double {
        start + ((end - start) * t)
    }

    static func lerp(_ start: Color, _ end: Color, t: Double) -> Color {
        let clampedT = min(max(t, 0), 1)

        let c1 = rgbaComponents(for: start)
        let c2 = rgbaComponents(for: end)

        return Color(
            .sRGB,
            red: lerp(Double(c1.r), Double(c2.r), t: clampedT),
            green: lerp(Double(c1.g), Double(c2.g), t: clampedT),
            blue: lerp(Double(c1.b), Double(c2.b), t: clampedT),
            opacity: lerp(Double(c1.a), Double(c2.a), t: clampedT)
        )
    }

    private static func rgbaComponents(for color: Color) -> (r: CGFloat, g: CGFloat, b: CGFloat, a: CGFloat) {
        let uiColor = UIColor(color)
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0

        if uiColor.getRed(&r, green: &g, blue: &b, alpha: &a) {
            return (r, g, b, a)
        }

        var white: CGFloat = 0
        if uiColor.getWhite(&white, alpha: &a) {
            return (white, white, white, a)
        }

        return (0, 0, 0, 1)
    }
}
