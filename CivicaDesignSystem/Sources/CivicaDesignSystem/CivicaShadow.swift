import SwiftUI

/// Semantic elevation tiers. Each token represents a visual role; the actual
/// radius/x/y values are kept inside the View extension below so call sites
/// stay readable. Color and opacity are overridable for special cases.
public enum CivicaShadow {
    /// Whisper-thin hairline lift (radius 3, y 1, default opacity 0.08).
    /// Used for low-elevation borders, focused inputs, subtle separators.
    case hairline
    /// Standard card / surface elevation (radius 6, y 2, default opacity 0.06).
    /// Used for resting cards, list rows, primary surfaces.
    case card
    /// Floating / modal lift (radius 14, y 4, default opacity 0.20).
    /// Used for sheets, prominent floating elements, hover states.
    case floating
}

public extension View {
    /// Apply a Civica semantic shadow. `color` defaults to `CivicaColors.textPrimary`
    /// and `opacity` defaults to the per-tier value defined in `CivicaShadow`.
    func civicaShadow(
        _ shadow: CivicaShadow,
        color: Color = CivicaColors.textPrimary,
        opacity: Double? = nil
    ) -> some View {
        let radius: CGFloat
        let yOffset: CGFloat
        let defaultOpacity: Double
        switch shadow {
        case .hairline:
            radius = 3; yOffset = 1; defaultOpacity = 0.08
        case .card:
            radius = 6; yOffset = 2; defaultOpacity = 0.06
        case .floating:
            radius = 14; yOffset = 4; defaultOpacity = 0.20
        }
        return self.shadow(
            color: color.opacity(opacity ?? defaultOpacity),
            radius: radius,
            x: 0,
            y: yOffset
        )
    }
}
