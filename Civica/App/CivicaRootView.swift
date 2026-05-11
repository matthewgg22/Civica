import CivicaDesignSystem
import SwiftUI

// Root view for the Civica enrollment app.
//
// On first launch, mounts the 5-screen onboarding (HANDOFF board 03).
// After onboarding completes, the language choice + completion flag
// are persisted to @AppStorage; subsequent launches go straight to the
// SNAP entry surface. Future verticals (CalFresh, WIC, etc.) plug in
// behind the same root.

struct CivicaRootView: View {
    @AppStorage("co.civica.hasCompletedOnboarding")
    private var hasCompletedOnboarding: Bool = false

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    @StateObject private var snapViewModel = SNAPApplicationViewModel()

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        Group {
            if hasCompletedOnboarding {
                NavigationStack {
                    SNAPEntryView(viewModel: snapViewModel)
                }
                .tint(CivicaColors.brickPrimary)
            } else {
                OnboardingFlowView { chosenLanguage in
                    languageRaw = chosenLanguage.rawValue
                    withAnimation(.easeInOut(duration: 0.32)) {
                        hasCompletedOnboarding = true
                    }
                }
            }
        }
    }
}

#if DEBUG
struct CivicaRootView_Previews: PreviewProvider {
    static var previews: some View {
        CivicaRootView()
    }
}
#endif
