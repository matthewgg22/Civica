import SwiftUI

// EXPERIMENTAL SILOED MODULE:
// Shared SNAP button styles to keep prototype UI aligned with base Civica palette.
struct SNAPSecondaryCTAButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(isEnabled ? CivicaColors.ctaBlue : CivicaColors.ctaBlueDisabled)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .fill(configuration.isPressed ? CivicaColors.secondaryButtonFillPressed : CivicaColors.secondaryButtonFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .stroke(isEnabled ? CivicaColors.secondaryButtonBorder : CivicaColors.secondaryButtonDisabledBorder, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.9 : 1)
    }
}
