import CivicaDesignSystem
import SwiftUI

// Screen 4: consent (HANDOFF board 03). Four bullets covering the
// privacy posture the user is opting into. Tap order:
//   • Read bullets
//   • Tap checkbox (or anywhere on the card) to consent
//   • Continue activates

struct ConsentScreen: View {
    @ObservedObject var viewModel: OnboardingViewModel
    let onContinue: () -> Void
    let onBack: () -> Void

    private var lang: CivicaLanguage { viewModel.language }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            OnboardingStepHeader(currentStep: 4, language: lang, onBack: onBack)

            Text(OnboardingStrings.consentTitle.value(in: lang))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .padding(.top, CivicaSpacing.sm)

            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                bullet(OnboardingStrings.consentBullet1.value(in: lang))
                bullet(OnboardingStrings.consentBullet2.value(in: lang))
                bullet(OnboardingStrings.consentBullet3.value(in: lang))
                bullet(OnboardingStrings.consentBullet4.value(in: lang))
            }

            Spacer()

            consentToggle

            CivicaPrimaryButton(
                OnboardingStrings.consentAgree.value(in: lang),
                isEnabled: viewModel.canAdvanceFromConsent,
                action: onContinue
            )
        }
        .padding(CivicaSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(CivicaColors.paper.ignoresSafeArea())
    }

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(CivicaColors.accentTeal)
                .accessibilityHidden(true)
            Text(text)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(text)
    }

    /// Tap-anywhere consent affordance. The visible checkmark + the
    /// "I agree" copy together are the gesture target — 44pt minimum
    /// hit area per HANDOFF.
    private var consentToggle: some View {
        Button {
            viewModel.hasConsented.toggle()
        } label: {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: viewModel.hasConsented
                      ? "checkmark.square.fill"
                      : "square")
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(viewModel.hasConsented
                                     ? CivicaColors.brickPrimary
                                     : CivicaColors.graphite)
                Text(consentToggleText)
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.ink)
            }
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .contentShape(Rectangle())
        }
        .accessibilityLabel(consentToggleText)
        .accessibilityValue(viewModel.hasConsented ? "Selected" : "Not selected")
        .accessibilityAddTraits(.isButton)
    }

    private var consentToggleText: String {
        switch lang {
        case .english: return "I agree to the terms above."
        case .spanish: return "Acepto los términos anteriores."
        }
    }
}

#if DEBUG
struct ConsentScreen_Previews: PreviewProvider {
    static var previews: some View {
        ConsentScreen(viewModel: OnboardingViewModel(), onContinue: {}, onBack: {})
    }
}
#endif
