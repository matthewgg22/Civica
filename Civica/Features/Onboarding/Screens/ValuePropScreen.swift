import CivicaDesignSystem
import SwiftUI

// Screen 2: value prop (HANDOFF board 03). One sentence on what Civica
// does, one sentence on what it isn't. Per HANDOFF brand voice rules
// (board 16): concrete, no government-speak, no marketing fluff.

struct ValuePropScreen: View {
    @ObservedObject var viewModel: OnboardingViewModel
    let onContinue: () -> Void
    let onBack: () -> Void

    private var lang: CivicaLanguage { viewModel.language }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            OnboardingStepHeader(currentStep: 2, language: lang, onBack: onBack)

            Spacer()

            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 56, weight: .light))
                .foregroundStyle(CivicaColors.brickPrimary)
                .accessibilityHidden(true)

            Text(OnboardingStrings.valuePropTitle.value(in: lang))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)

            Text(OnboardingStrings.valuePropBody.value(in: lang))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            Spacer()

            CivicaPrimaryButton(
                OnboardingStrings.valuePropContinue.value(in: lang),
                action: onContinue
            )
        }
        .padding(CivicaSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(CivicaColors.paper.ignoresSafeArea())
    }
}

// Shared header rendered above each onboarding screen 2-5 with a step
// indicator + back affordance. Screen 1 has no header (it's first).
struct OnboardingStepHeader: View {
    let currentStep: Int
    let language: CivicaLanguage
    let onBack: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: CivicaSpacing.md) {
            Button(action: onBack) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(CivicaColors.ink)
                    .frame(width: 44, height: 44, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("Back")

            Spacer()

            Text(OnboardingStrings.stepIndicatorString(currentStep: currentStep, language: language))
                .font(CivicaTypography.caption)
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityLabel("Step \(currentStep) of 5")
        }
    }
}

#if DEBUG
struct ValuePropScreen_Previews: PreviewProvider {
    static var previews: some View {
        ValuePropScreen(viewModel: OnboardingViewModel(), onContinue: {}, onBack: {})
    }
}
#endif
