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
    @StateObject private var enrollmentAuth = CivicaEnrollmentAuth()
    @StateObject private var recertContextStore = RecertContextStore()

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

    /// IA-4 (audit 2026-05-29): presents SNAPSettingsSheet from a gear
    /// in the nav bar shown on every status surface, so language /
    /// AI-transparency / sign-out are reachable without first drilling
    /// into the EBT dashboard.
    @State private var presentingSettings = false

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ZStack {
            Group {
                if hasCompletedOnboarding {
                    NavigationStack {
                        rootSurface
                            .toolbar {
                                ToolbarItem(placement: .topBarTrailing) {
                                    Button {
                                        presentingSettings = true
                                    } label: {
                                        Image(systemName: "gearshape")
                                            .foregroundStyle(CivicaColors.pinePrimary)
                                    }
                                    .accessibilityLabel(
                                        SNAPSettingsStrings.title.value(in: language)
                                    )
                                }
                            }
                    }
                    .tint(CivicaColors.pinePrimary)
                    // Single shared status store for everything below the
                    // root. SNAPEligibilityIntroView writes the verdict +
                    // advances status; CivicaRootView's rootSurface
                    // re-routes on the change.
                    .environmentObject(statusStore)
                    .environmentObject(enrollmentAuth)
                    .environmentObject(recertContextStore)
                    .sheet(item: $externalLink) { url in
                        CivicaSafariSheet(url: url)
                    }
                    .sheet(isPresented: $presentingSettings) {
                        SNAPSettingsSheet(
                            languageRaw: $languageRaw,
                            auth: enrollmentAuth
                        )
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
        // Government benefits enrollment carries a stronger trust signal
        // in light mode — pure-white/cream backgrounds with high-contrast
        // ink match the visual language of mass.gov, DTA Connect, and
        // other official benefits portals. Dark mode reads more like
        // consumer fintech, which SNAP applicants are conditioned to be
        // wary of after years of scammy "free SNAP" sites. VoteNow lives
        // in its own target and follows system appearance independently.
        .preferredColorScheme(.light)
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
            // Phase 3 (Enrolled) of the three-phase main screen.
            // Replaces SNAPDecisionApprovedView as the post-approval
            // home: EBT balance hero + recert banner + activity +
            // find-help. The legacy view still compiles (unreferenced
            // here) so it can be quickly re-instated if rollback is
            // needed. DTA Connect and WIC affordances are no longer
            // on the home — those entry points move to dedicated
            // surfaces (EBT root + a future "Other benefits" sheet).
            CivicaHomePhase3View(
                statusStore: statusStore,
                language: language,
                onOpenExternalPortal: {
                    externalLink = CivicaExternalLinks.applyPortal(
                        for: SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode
                    )
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
                        externalLink = CivicaExternalLinks.applyPortal(for: SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode)
                    }
                )
            }
        } else if statusStore.status.isPostSubmission {
            // Phase 2 (Pending) of the three-phase main screen.
            // Replaces SNAPWaitingRoomView for the standard
            // post-submission path (.submittedToState through
            // .interviewCompleted). The legacy view still compiles
            // and is rendered by Phase 2's "How to prepare for
            // what's next" sheet as a deeper detail surface — when
            // SNAPWhatHappensNextSheet ships, that bridge goes away.
            CivicaHomePhase2View(
                statusStore: statusStore,
                language: language,
                onOpenExternalPortal: {
                    externalLink = CivicaExternalLinks.applyPortal(
                        for: SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode
                    )
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
