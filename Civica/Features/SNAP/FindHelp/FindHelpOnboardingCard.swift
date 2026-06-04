import CivicaDesignSystem
import SwiftUI

/// First-launch educational card overlaid above the map. The
/// "SNAP works at more places than you think" line is the demo's
/// thesis in one sentence; the card surfaces it before the user
/// has to discover it through pin-tapping.
///
/// Persistence: keyed off `@AppStorage("find_help.has_seen_
/// onboarding")` so it shows exactly once per install. Reset that
/// key in iOS settings during demo prep to see it again.
struct FindHelpOnboardingCard: View {
    let language: CivicaLanguage
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(FindHelpOnboardingStrings.eyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)

            Text(FindHelpOnboardingStrings.title.value(in: language))
                .font(CivicaTypography.cardTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)

            Text(FindHelpOnboardingStrings.body.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            Button(action: onDismiss) {
                Text(FindHelpOnboardingStrings.dismissCTA.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.onPrimaryText)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.control)
                            .fill(CivicaColors.pinePrimary)
                    )
            }
            .padding(.top, CivicaSpacing.xs)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
        .padding(CivicaSpacing.lg)
        .accessibilityElement(children: .combine)
    }
}

enum FindHelpOnboardingStrings {
    static let eyebrow = CivicaText(
        "Welcome",
        es: "Bienvenido",
        zh: "欢迎",
        vi: "Chào mừng bạn"
    )
    static let title = CivicaText(
        "SNAP works at more places than you think.",
        es: "SNAP funciona en más lugares de los que imaginas.",
        zh: "SNAP 可以用的地方比你想的多。",
        vi: "SNAP dùng được ở nhiều nơi hơn bạn nghĩ."
    )
    static let body = CivicaText(
        "Tap a pin to see what you can buy with EBT, WIC, or HIP — and how to get there.",
        es: "Toca un punto para ver qué puedes comprar con EBT, WIC o HIP, y cómo llegar.",
        zh: "点一下地图上的标记,看看你可以用 EBT、WIC 或 HIP 买什么 —— 以及怎么过去。",
        vi: "Chạm vào một điểm để xem bạn mua được gì bằng EBT, WIC hoặc HIP — và cách đến đó."
    )
    static let dismissCTA = CivicaText(
        "Got it",
        es: "Entendido",
        zh: "知道了",
        vi: "Đã hiểu"
    )
}
