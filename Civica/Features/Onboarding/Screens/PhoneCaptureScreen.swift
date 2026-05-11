import CivicaDesignSystem
import SwiftUI

// Screen 5: phone capture (HANDOFF board 03 + decision #3, Twilio long
// code at v1). Optional but recommended. Skip is a first-class
// affordance — we don't gate access to the app behind handing over a
// phone number.

struct PhoneCaptureScreen: View {
    @ObservedObject var viewModel: OnboardingViewModel
    let onContinue: () -> Void
    let onBack: () -> Void

    @FocusState private var phoneFieldFocused: Bool

    private var lang: CivicaLanguage { viewModel.language }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            OnboardingStepHeader(currentStep: 5, language: lang, onBack: onBack)

            Text(OnboardingStrings.phoneTitle.value(in: lang))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .padding(.top, CivicaSpacing.sm)

            Text(OnboardingStrings.phoneBody.value(in: lang))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            phoneField

            // aria-live equivalent: a validation banner that appears
            // only on .validationError. SwiftUI's accessibilityHidden
            // toggles whether VoiceOver picks it up, mirroring the
            // HANDOFF QA gate ("aria-live banners").
            if viewModel.phoneSubmissionState == .validationError {
                Text(OnboardingStrings.phoneInvalid.value(in: lang))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.destructive)
                    .accessibilityAddTraits(.isStaticText)
            }

            Spacer()

            VStack(spacing: CivicaSpacing.sm) {
                CivicaPrimaryButton(
                    submitButtonTitle,
                    isEnabled: viewModel.isPhoneValid && viewModel.phoneSubmissionState != .sending
                ) {
                    if viewModel.phoneSubmissionState == .sent {
                        onContinue()
                    } else {
                        Task {
                            await viewModel.submitPhone()
                            if viewModel.phoneSubmissionState == .sent {
                                onContinue()
                            }
                        }
                    }
                }
                CivicaSecondaryButton(title: OnboardingStrings.phoneSkip.value(in: lang)) {
                    viewModel.skipPhone()
                    onContinue()
                }
            }
        }
        .padding(CivicaSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(CivicaColors.paper.ignoresSafeArea())
        .onChange(of: viewModel.phoneInput) { _ in
            // Live-format as the user types; viewModel re-computes
            // displayedPhone whenever phoneInput changes.
            viewModel.phoneInput = viewModel.displayedPhone
            if viewModel.phoneSubmissionState == .validationError && viewModel.isPhoneValid {
                viewModel.phoneSubmissionState = .idle
            }
        }
    }

    private var phoneField: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            TextField(
                OnboardingStrings.phoneFieldPlaceholder.value(in: lang),
                text: $viewModel.phoneInput
            )
            .keyboardType(.phonePad)
            .textContentType(.telephoneNumber)
            .focused($phoneFieldFocused)
            .font(CivicaTypography.body.monospacedDigit())
            .foregroundStyle(CivicaColors.ink)
            .padding(.horizontal, CivicaSpacing.md)
            .frame(height: 56)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .fill(CivicaColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(
                        viewModel.phoneSubmissionState == .validationError
                            ? CivicaColors.destructive
                            : CivicaColors.hairline,
                        lineWidth: 1
                    )
            )
            .accessibilityLabel(OnboardingStrings.phoneTitle.value(in: lang))
            .accessibilityValue(viewModel.displayedPhone)
        }
    }

    private var submitButtonTitle: String {
        switch viewModel.phoneSubmissionState {
        case .sending:
            return lang == .english ? "Sending…" : "Enviando…"
        case .sent:
            return lang == .english ? "Continue" : "Continuar"
        default:
            return OnboardingStrings.phoneSubmit.value(in: lang)
        }
    }
}

#if DEBUG
struct PhoneCaptureScreen_Previews: PreviewProvider {
    static var previews: some View {
        PhoneCaptureScreen(viewModel: OnboardingViewModel(), onContinue: {}, onBack: {})
    }
}
#endif
