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

    @StateObject private var statusStore = SNAPApplicationStatusStore()

    /// External link target presented via CivicaSafariSheet. Set from
    /// the various "Open DTA Connect" / "Start an appeal" handlers
    /// so all three status surfaces share one sheet presentation.
    @State private var externalLink: URL?

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
                // Single shared status store for everything below the
                // root. SNAPEligibilityIntroView writes the verdict +
                // advances status; CivicaRootView's rootSurface
                // re-routes on the change.
                .environmentObject(statusStore)
                .sheet(item: $externalLink) { url in
                    CivicaSafariSheet(url: url)
                }
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

    /// Status-aware routing (HANDOFF boards 11, 12, 23-denial, 24,
    /// recertification).
    /// First-time + screener-in-progress users land on the entry tile
    /// (which leads into the conversation screener). Denied users
    /// land on the denial surface with appeal + reapply paths.
    /// Recert-due users get the recert intro. Other post-submission
    /// users land on the waiting room. Anything in between is the
    /// returning user home — they have an active application that
    /// needs the next push.
    @ViewBuilder
    private var rootSurface: some View {
        if statusStore.status == .decisionDenied {
            SNAPDecisionDeniedView(
                statusStore: statusStore,
                language: language,
                denialReason: nil,
                onAppeal: {
                    // Lands the user on MA DTA's fair-hearing
                    // request page. Guided appeal-letter generator
                    // is a follow-up; the external link is the
                    // honest path today.
                    externalLink = CivicaExternalLinks.dtaFairHearing
                },
                onStartOver: {
                    statusStore.reset()
                }
            )
        } else if statusStore.status == .recertDue {
            SNAPRecertificationView(
                statusStore: statusStore,
                language: language,
                deadline: statusStore.timestamp(for: .recertDue),
                onStartRecert: {
                    // Recert IS reapplying — the screener flow handles
                    // both paths. When the recert-mode flag lands on
                    // SNAPApplicationViewModel, route through it so
                    // the conversation can shortcut the unchanged
                    // questions ("anything different since last
                    // time?"). For now: reset to .notStarted so the
                    // standard screener kicks off.
                    statusStore.reset()
                },
                onOpenDTAConnect: {
                    externalLink = CivicaExternalLinks.dtaConnect
                }
            )
        } else if statusStore.status.isPostSubmission {
            SNAPWaitingRoomView(
                statusStore: statusStore,
                language: language,
                onAction: {
                    // Document upload / interview prep / recert all
                    // live behind the state portal. Until a dedicated
                    // in-app document-capture flow ships, the action
                    // banner deep-links to DTA Connect where the
                    // upload actually happens.
                    externalLink = CivicaExternalLinks.dtaConnect
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
            // First-time / not-started users land on the Civica
            // entry tile. Replaces the legacy SNAPEntryView, which
            // depended on VoteNow-specific PlanViewModel /
            // MyRepsViewModel address-prefill plumbing.
            CivicaEntryView()
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
