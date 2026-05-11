import CivicaDesignSystem
import SwiftUI

// HANDOFF-spec primary CTA: 56pt tall (44pt floor for dense rows, but
// onboarding primaries are full 56pt), 3pt control radius (sharp on
// purpose per HANDOFF), Brick #9C3A24 fill with Paper text. Lives in
// the Civica target — when this stabilizes, promote to
// CivicaDesignSystem so VoteNow can use it too.

struct CivicaPrimaryButton: View {
    let title: String
    let isEnabled: Bool
    let action: () -> Void

    init(_ title: String, isEnabled: Bool = true, action: @escaping () -> Void) {
        self.title = title
        self.isEnabled = isEnabled
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.onPrimaryText)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .fill(isEnabled ? CivicaColors.brickPrimary : CivicaColors.brickPrimaryDisabled)
                )
        }
        .disabled(!isEnabled)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
    }
}

// Secondary / skip variant — same hit target, paper background, ink text,
// uses the destructive token sparingly (for "delete" style actions
// elsewhere; here it's the muted graphite for a plain "skip" link).
struct CivicaSecondaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.graphite)
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
    }
}
