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

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Hero numeral reduces from 48pt to 34pt at xLarge+ to prevent overflow (D10).
    private var heroNumeralFont: Font {
        dynamicTypeSize >= .xLarge ? MFont.semibold(34) : MFont.heroNumeral
    }

    private var heroNumeralShimmerSize: CGSize {
        dynamicTypeSize >= .xLarge ? CGSize(width: 72, height: 42) : CGSize(width: 100, height: 58)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                heroBlock
                if let _ = vm.benefitLoadError {
                    benefitErrorBlock
                        .padding(.top, 16)
                }
                MHairline()
                    .padding(.top, vm.benefitLoadError != nil ? 16 : 0)
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

            // $292 — shimmer while loading, populated once API responds.
            // Font reduces from 48pt to 34pt at xLarge+ DynamicTypeSize (D10).
            Group {
                if let amountText = vm.benefitAmountFormatted {
                    Text(amountText)
                        .font(heroNumeralFont)
                        .foregroundStyle(Color.civicaInk)
                        .monospacedDigit()
                        .accessibilityLabel("Monthly benefit: \(amountText)")
                } else if vm.benefitLoadError == nil {
                    MShimmer(
                        width: heroNumeralShimmerSize.width,
                        height: heroNumeralShimmerSize.height
                    )
                    .accessibilityLabel("Loading monthly benefit amount")
                }
            }

            // Deposit date pill — shimmer capsule while loading.
            Group {
                if let depositText = vm.depositDateFormatted {
                    Text(depositText)
                        .font(MFont.metaMedium)
                        .foregroundStyle(Color.civicaTeal)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.civicaPaper2)
                        .clipShape(Capsule())
                } else if vm.benefitLoadError == nil {
                    MShimmer(width: 148, height: 28, cornerRadius: 999)
                        .accessibilityLabel("Loading first deposit date")
                }
            }
            .padding(.top, 16)
        }
        .padding(.top, 12)
        .padding(.horizontal, 24)
        .padding(.bottom, 24)
    }

    // MARK: Benefit error inline (D3)

    private var benefitErrorBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(SNAPMarketplaceStrings.benefitLoadErrorHeadline.value(in: language))
                .font(MFont.bodySmallMedium)
                .foregroundStyle(Color.civicaAmber)

            Text(SNAPMarketplaceStrings.benefitLoadErrorBody.value(in: language))
                .font(MFont.bodySmall)
                .foregroundStyle(Color.civicaGraphite)
                .fixedSize(horizontal: false, vertical: true)

            Button(SNAPMarketplaceStrings.retry.value(in: language)) {
                vm.retryBenefitLoad()
            }
            .font(MFont.bodySmallMedium)
            .foregroundStyle(Color.civicaAmber)
            .frame(minWidth: 44, minHeight: 44)
            .padding(.leading, -8)
        }
        .padding(.horizontal, 24)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            SNAPMarketplaceStrings.benefitLoadErrorHeadline.value(in: language)
            + ". "
            + SNAPMarketplaceStrings.benefitLoadErrorBody.value(in: language)
        )
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
#Preview("Loading (shimmers)") {
    NavigationStack {
        SNAPEnrolledView(
            vm: SNAPMarketplaceViewModel(),
            onSeeJobs: {},
            onLater: {}
        )
    }
}

#Preview("Loaded") {
    let vm = SNAPMarketplaceViewModel()
    var comps = DateComponents()
    comps.year = 2026; comps.month = 5; comps.day = 25
    vm.benefit.amount = 292
    vm.benefit.effectiveDate = Calendar.current.date(from: comps)
    return NavigationStack {
        SNAPEnrolledView(vm: vm, onSeeJobs: {}, onLater: {})
    }
}

#Preview("Error inline") {
    let vm = SNAPMarketplaceViewModel()
    vm.benefitLoadError = "Network unavailable"
    return NavigationStack {
        SNAPEnrolledView(vm: vm, onSeeJobs: {}, onLater: {})
    }
}
#endif
