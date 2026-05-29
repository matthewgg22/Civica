import CivicaDesignSystem
import SwiftUI

// Screen 3: "How it works" — 3 numbered steps. Sets correct
// expectations: questions, then docs, then the official site. The
// third bullet is the most important — Civica is not the submitter.

struct HowItWorksScreen: View {
    @ObservedObject var viewModel: OnboardingViewModel
    let onContinue: () -> Void
    let onBack: () -> Void

    private var lang: CivicaLanguage { viewModel.language }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            OnboardingStepHeader(currentStep: 3, language: lang, onBack: onBack)

            Text(OnboardingStrings.howItWorksTitle.value(in: lang))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .padding(.top, CivicaSpacing.sm)

            VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                step(
                    number: 1,
                    heading: OnboardingStrings.howItWorksStep1Heading.value(in: lang),
                    body: OnboardingStrings.howItWorksStep1Body.value(in: lang)
                )
                step(
                    number: 2,
                    heading: OnboardingStrings.howItWorksStep2Heading.value(in: lang),
                    body: OnboardingStrings.howItWorksStep2Body.value(in: lang)
                )
                step(
                    number: 3,
                    heading: OnboardingStrings.howItWorksStep3Heading.value(in: lang),
                    body: OnboardingStrings.howItWorksStep3Body.value(in: lang)
                )
            }

            Spacer()

            CivicaPrimaryButton(
                OnboardingStrings.howItWorksContinue.value(in: lang),
                action: onContinue
            )
        }
        .padding(CivicaSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(CivicaColors.paper.ignoresSafeArea())
    }

    private func step(number: Int, heading: String, body: String) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            // Numeric pill — uses tabular-nums via Hanken Grotesk per
            // HANDOFF money rule ("everywhere money or counts appear").
            Text("\(number)")
                .font(CivicaTypography.subheadStrong.monospacedDigit())
                .foregroundStyle(CivicaColors.onPrimaryText)
                .frame(width: 32, height: 32)
                .background(
                    Circle().fill(CivicaColors.pinePrimary)
                )
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(heading)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(body)
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(number). \(heading). \(body)")
    }
}

#if DEBUG
struct HowItWorksScreen_Previews: PreviewProvider {
    static var previews: some View {
        HowItWorksScreen(viewModel: OnboardingViewModel(), onContinue: {}, onBack: {})
    }
}
#endif
