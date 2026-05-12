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

    /// True while the user is actively walking the recertification
    /// flow. Routes them through CivicaSNAPFlowView with the recert
    /// banner instead of the standard recertification intro. Cleared
    /// when packet generation moves status forward to .packetGenerated.
    @AppStorage("co.civica.recertInProgress")
    private var isRecertInProgress: Bool = false

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
        if isRecertInProgress {
            // Mission 12: recertification routes through the same
            // orchestrator as a first-time application, but with a
            // banner that explains "this is your recert" and prior
            // answers already pre-populated (persisted in the
            // SNAPApplicationDraftStore from the previous cycle).
            CivicaSNAPFlowView(language: language, recertMode: true)
        } else if statusStore.status == .decisionDenied {
            if RecertCompanionFeatureFlag.isEnabled {
                // Companion path: dashboard with the AI-drafted
                // procedural appeal flow as the primary action.
                // Falls back to the legacy denial view when the
                // flag is off so we can compare behavior in pilot.
                RecertCompanionRoot()
            } else {
                SNAPDecisionDeniedView(
                    statusStore: statusStore,
                    language: language,
                    denialReason: nil,
                    onAppeal: {
                        // Mission 13: navigation to SNAPAppealLetterView
                        // is handled by the NavigationLink inside the
                        // denied view itself. The letter view exposes
                        // the MA DTA fair-hearing online portal as a
                        // secondary action so we don't double-present.
                        // Hook left as a passthrough for telemetry.
                    },
                    onStartOver: {
                        statusStore.reset()
                    }
                )
            }
        } else if statusStore.status == .decisionApproved {
            // MobilePendingBoard panel 3: a calm approved landing,
            // not a celebration. Recert reminder gets set forward
            // 12 months the same day -- approval doesn't end the
            // relationship per the board's brief.
            SNAPDecisionApprovedView(
                statusStore: statusStore,
                language: language,
                draft: SNAPApplicationDraftStore().load()?.draft,
                onOpenDTAConnect: {
                    externalLink = CivicaExternalLinks.dtaConnect
                },
                onOpenWICTeaser: {
                    externalLink = CivicaExternalLinks.maWICInfo
                },
                onStartOver: {
                    statusStore.reset()
                }
            )
        } else if statusStore.status == .recertDue {
            if RecertCompanionFeatureFlag.isEnabled {
                // Companion path: full dashboard with Phantom Recert,
                // Expiration Calendar, and Just-in-Time Reminders.
                // The "Start the real recert" CTA inside the phantom
                // flow still flips isRecertInProgress on the way out
                // — same hand-off back to CivicaSNAPFlowView as the
                // legacy path used.
                RecertCompanionRoot()
            } else {
                SNAPRecertificationView(
                    statusStore: statusStore,
                    language: language,
                    deadline: statusStore.timestamp(for: .recertDue),
                    onStartRecert: {
                        // Mission 12: flip into recert mode. Status stays
                        // at .recertDue; the isRecertInProgress flag at
                        // the root sends rootSurface to the orchestrator
                        // with the recert banner. Critically: the draft
                        // is NOT cleared, so prior answers come back
                        // pre-populated and the user only changes what
                        // changed.
                        isRecertInProgress = true
                    },
                    onOpenDTAConnect: {
                        externalLink = CivicaExternalLinks.dtaConnect
                    }
                )
            }
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
