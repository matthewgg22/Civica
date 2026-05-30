import CivicaDesignSystem
import SwiftUI

// Compliance disclosure for Find Help. Always visible at the bottom of the
// directory screen; tap to expand. The plain-English text is required by the
// build spec and must not be hidden behind multiple taps.

struct FindHelpDisclosureFooter: View {
    @State private var isExpanded: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Button {
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { isExpanded.toggle() }
            } label: {
                HStack(alignment: .center, spacing: CivicaSpacing.sm) {
                    Image(systemName: "info.circle.fill")
                        .foregroundStyle(CivicaColors.pinePrimary)
                        .accessibilityHidden(true)
                    Text("find_help.disclosure.short")
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .multilineTextAlignment(.leading)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .imageScale(.large)
                        .font(.body)
                        .foregroundStyle(CivicaColors.graphite)
                        .accessibilityHidden(true)
                }
                .padding(.horizontal, CivicaSpacing.md)
                .padding(.vertical, CivicaSpacing.sm)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                Text("find_help.disclosure.full")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .multilineTextAlignment(.leading)
                    .padding(.horizontal, CivicaSpacing.md)
                    .padding(.bottom, CivicaSpacing.sm)
            }
        }
        .background(
            CivicaColors.surfacePrimary
                .overlay(
                    Rectangle()
                        .fill(CivicaColors.hairline)
                        .frame(height: 1),
                    alignment: .top
                )
        )
    }
}
