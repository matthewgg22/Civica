import SwiftUI

struct ReviewPromptView: View {
    let onRateApp: () -> Void
    let onNotNow: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            Text("Did Civica help you make your plan?")
                .font(.title3.weight(.semibold))
                .foregroundColor(CivicaColors.textPrimary)

            Text("If so, would you mind giving us a quick App Store rating? It helps more voters discover the app.")
                .font(.body)
                .foregroundColor(CivicaColors.textSecondary)

            HStack(spacing: CivicaSpacing.sm) {
                Button("Not now", action: onNotNow)
                    .font(CivicaTypography.sectionHeader)
                    .foregroundColor(CivicaColors.textPrimary)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(CivicaColors.surfacePrimary)
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                            .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous))

                Button("Rate the App", action: onRateApp)
                    .font(CivicaTypography.sectionHeader)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(CivicaColors.ctaBlue)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous))
            }
        }
        .padding(CivicaSpacing.lg)
        .presentationDetents([.height(250)])
        .presentationDragIndicator(.visible)
    }
}

#Preview {
    ReviewPromptView(
        onRateApp: {},
        onNotNow: {}
    )
}
