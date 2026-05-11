import CivicaDesignSystem
import SwiftUI

// Wrapper for the 5-screen onboarding (HANDOFF board 03). Owns the
// OnboardingViewModel; uses SwiftUI's matched-geometry slide animation
// between screens; calls `onCompleted(language:)` once when the user
// finishes the 5th screen.
//
// The completion callback's responsibility is to:
//   • persist hasCompletedOnboarding to @AppStorage
//   • persist the chosen language to @AppStorage
//   • dismiss the onboarding stack and present CivicaRootView's main flow

struct OnboardingFlowView: View {
    @StateObject private var viewModel = OnboardingViewModel()
    let onCompleted: (CivicaLanguage) -> Void

    var body: some View {
        ZStack {
            CivicaColors.paper.ignoresSafeArea()

            switch viewModel.currentStep {
            case .language:
                LanguagePickerScreen(viewModel: viewModel) {
                    viewModel.advance()
                }
                .transition(.opacity)
            case .valueProp:
                ValuePropScreen(
                    viewModel: viewModel,
                    onContinue: { viewModel.advance() },
                    onBack: { viewModel.goBack() }
                )
                .transition(.move(edge: .trailing).combined(with: .opacity))
            case .howItWorks:
                HowItWorksScreen(
                    viewModel: viewModel,
                    onContinue: { viewModel.advance() },
                    onBack: { viewModel.goBack() }
                )
                .transition(.move(edge: .trailing).combined(with: .opacity))
            case .consent:
                ConsentScreen(
                    viewModel: viewModel,
                    onContinue: { viewModel.advance() },
                    onBack: { viewModel.goBack() }
                )
                .transition(.move(edge: .trailing).combined(with: .opacity))
            case .phone:
                PhoneCaptureScreen(
                    viewModel: viewModel,
                    onContinue: { onCompleted(viewModel.language) },
                    onBack: { viewModel.goBack() }
                )
                .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.28), value: viewModel.currentStep)
    }
}

#if DEBUG
struct OnboardingFlowView_Previews: PreviewProvider {
    static var previews: some View {
        OnboardingFlowView(onCompleted: { _ in })
    }
}
#endif
