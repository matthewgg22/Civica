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
    /// When true, the button renders a trailing `arrow.up.right.square`
    /// glyph + an "Opens an external website" accessibility hint to signal
    /// that the action navigates out of the Civica app. Defaults to false.
    /// Used by SNAP estimator's "Apply on BenefitsCal" CTA (compliance
    /// row 5) and similar state-portal links per counsel-prep Decision 4.
    let isExternalLink: Bool
    let action: () -> Void

    init(
        _ title: String,
        isEnabled: Bool = true,
        isExternalLink: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.isEnabled = isEnabled
        self.isExternalLink = isExternalLink
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: CivicaSpacing.xs) {
                Text(title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.onPrimaryText)
                if isExternalLink {
                    Image(systemName: "arrow.up.right.square")
                        .imageScale(.medium)
                        .foregroundStyle(CivicaColors.onPrimaryText)
                        .accessibilityHidden(true)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .fill(isEnabled ? CivicaColors.pinePrimary : CivicaColors.pinePrimaryDisabled)
            )
        }
        .disabled(!isEnabled)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
        .accessibilityHint(isExternalLink ? "Opens an external website" : "")
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
