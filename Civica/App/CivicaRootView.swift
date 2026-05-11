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
    @StateObject private var statusStore = SNAPApplicationStatusStore()

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        Group {
            if hasCompletedOnboarding {
                NavigationStack {
                    rootSurface
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

    /// Status-aware routing (HANDOFF boards 11, 12, 24).
    /// First-time + screener-in-progress users land on the entry tile
    /// (which leads into the conversation screener). Post-submission
    /// users land on the waiting room. Anything in between is the
    /// returning user home — they have an active application that
    /// needs the next push.
    @ViewBuilder
    private var rootSurface: some View {
        if statusStore.status.isPostSubmission {
            SNAPWaitingRoomView(
                statusStore: statusStore,
                language: language,
                onAction: {
                    // Hook the action banner taps into the appropriate
                    // sub-flow in a later commit (document upload,
                    // interview prep, etc.). For now it's a no-op.
                }
            )
        } else if statusStore.status.isActiveCase {
            SNAPReturningUserHomeView(
                statusStore: statusStore,
                language: language,
                onResume: {
                    // Resume hands off to SNAPEntryView; subsequent
                    // navigation lands the user back in the conversation
                    // flow or the application-packet generator depending
                    // on where they stopped.
                },
                onStartOver: {
                    statusStore.reset()
                }
            )
        } else {
            SNAPEntryView(viewModel: snapViewModel)
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
