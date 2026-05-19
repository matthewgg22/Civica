import SwiftUI

/// Screen 01 — Approval confirmation.
///
/// Shown after SNAP approval is confirmed. Displays the monthly benefit
/// amount, first-deposit date, a "what's next" card, and a primary CTA
/// that leads to the matched-jobs list.
struct SNAPEnrolledView: View {
    @ObservedObject var vm: SNAPMarketplaceViewModel
    var onSeeJobs: () -> Void
    var onLater: () -> Void

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue
    private var language: CivicaLanguage { CivicaLanguage(rawValue: languageRaw) ?? .english }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                heroBlock
                MHairline()
                whatsNextSection
                    .padding(.top, 24)
                actionsSection
                    .padding(.top, 24)
                Spacer(minLength: 32)
            }
        }
        .background(Color.civicaPaper.ignoresSafeArea())
        .navigationTitle(SNAPMarketplaceStrings.enrolledNavTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: Hero block

    private var heroBlock: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Brick check + headline
            HStack(alignment: .center, spacing: 10) {
                MCheckGlyph(size: 26, color: .civicaBrick)
                Text(SNAPMarketplaceStrings.enrolledHeadline.value(in: language))
                    .font(MFont.heroEnrolled)
                    .foregroundStyle(Color.civicaInk)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.bottom, 28)

            // "MONTHLY BENEFIT" caps label
            Text(SNAPMarketplaceStrings.monthlyBenefit.value(in: language))
                .font(MFont.capsLabel)
                .foregroundStyle(Color.civicaGraphite)
                .kerning(1.5)
                .padding(.bottom, 8)

            // $292
            Text(vm.benefitAmountFormatted)
                .font(MFont.heroNumeral)
                .foregroundStyle(Color.civicaInk)
                .monospacedDigit()
                .accessibilityLabel("Monthly benefit: \(vm.benefitAmountFormatted)")

            // Teal pill
            Text(vm.depositDateFormatted)
                .font(MFont.metaMedium)
                .foregroundStyle(Color.civicaTeal)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.civicaPaper2)
                .clipShape(Capsule())
                .padding(.top, 16)
        }
        .padding(.top, 12)
        .padding(.horizontal, 24)
        .padding(.bottom, 24)
    }

    // MARK: What's next

    private var whatsNextSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            MCapsLabel(text: "What's next")

            VStack(alignment: .leading, spacing: 8) {
                Text(SNAPMarketplaceStrings.earnUpTo.value(in: language))
                    .font(MFont.bodySmallMedium)
                    .foregroundStyle(Color.civicaInk)
                    .lineSpacing(17 * 0.3)  // line-height 1.3
                    .fixedSize(horizontal: false, vertical: true)

                Text(SNAPMarketplaceStrings.whatsNextBody.value(in: language))
                    .font(MFont.bodySmall)
                    .foregroundStyle(Color.civicaGraphite)
                    .lineSpacing(15 * 0.45)  // line-height 1.45
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(16)
            .background(Color.civicaPaper2)
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .padding(.horizontal, 24)
        }
    }

    // MARK: Actions

    private var actionsSection: some View {
        VStack(spacing: 0) {
            MBrickButton(label: "See jobs that fit your schedule") {
                onSeeJobs()
            }
            .accessibilityLabel("See jobs that fit your schedule")

            MTealTextLink(label: "I'll come back later") {
                onLater()
            }
            .padding(.top, 16)
        }
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        SNAPEnrolledView(
            vm: SNAPMarketplaceViewModel(),
            onSeeJobs: {},
            onLater: {}
        )
    }
}
#endif
