import SwiftUI

// EXPERIMENTAL SILOED MODULE:
// Shared SNAP button styles to keep prototype UI aligned with base VoteNow palette.
struct SNAPSecondaryCTAButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(isEnabled ? VoteNowColors.ctaBlue : VoteNowColors.ctaBlueDisabled)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(configuration.isPressed ? VoteNowColors.secondaryButtonFillPressed : VoteNowColors.secondaryButtonFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(isEnabled ? VoteNowColors.secondaryButtonBorder : VoteNowColors.secondaryButtonDisabledBorder, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.9 : 1)
    }
}
