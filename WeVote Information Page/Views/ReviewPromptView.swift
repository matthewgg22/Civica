import SwiftUI

struct ReviewPromptView: View {
    let onRateApp: () -> Void
    let onNotNow: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            Text("Did Civica help you make your plan?")
                .font(.title3.weight(.semibold))
                .foregroundColor(VoteNowColors.textPrimary)

            Text("If so, would you mind giving us a quick App Store rating? It helps more voters discover the app.")
                .font(.body)
                .foregroundColor(VoteNowColors.textSecondary)

            HStack(spacing: 10) {
                Button("Not now", action: onNotNow)
                    .font(.headline.weight(.semibold))
                    .foregroundColor(VoteNowColors.textPrimary)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(VoteNowColors.surfacePrimary)
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                            .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous))

                Button("Rate the App", action: onRateApp)
                    .font(.headline.weight(.semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(VoteNowColors.ctaBlue)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous))
            }
        }
        .padding(20)
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
