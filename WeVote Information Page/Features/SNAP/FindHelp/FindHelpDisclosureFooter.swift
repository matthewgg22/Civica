import CivicaDesignSystem
import SwiftUI

// Compliance disclosure for Find Help. Always visible at the bottom of the
// directory screen; tap to expand. The plain-English text is required by the
// build spec and must not be hidden behind multiple taps.

struct FindHelpDisclosureFooter: View {
    @State private var isExpanded: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { isExpanded.toggle() }
            } label: {
                HStack(alignment: .center, spacing: CivicaSpacing.sm) {
                    Image(systemName: "info.circle.fill")
                        .foregroundStyle(CivicaColors.ctaBlue)
                    Text(isExpanded ? Self.shortLabel : Self.shortPrompt)
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .multilineTextAlignment(.leading)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(CivicaColors.textSecondary)
                }
                .padding(.horizontal, CivicaSpacing.md)
                .padding(.vertical, CivicaSpacing.sm)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                Text(Self.fullText)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .multilineTextAlignment(.leading)
                    .padding(.horizontal, CivicaSpacing.md)
                    .padding(.bottom, CivicaSpacing.sm)
            }
        }
        .background(
            CivicaColors.surfacePrimary
                .overlay(
                    Rectangle()
                        .fill(CivicaColors.borderSubtle)
                        .frame(height: 1),
                    alignment: .top
                )
        )
    }

    static let shortPrompt = "Civica is not affiliated with USDA or any state SNAP agency. Tap for sources."
    static let shortLabel = "About this directory"
    static let fullText = """
    Civica is not affiliated with the U.S. Department of Agriculture or any state SNAP agency. Locations are sourced from authoritative public directories and may be out of date. Call ahead before visiting to confirm hours and services. To apply for SNAP through official channels, contact your state SNAP agency or call 1-800-221-5689.
    """
}
