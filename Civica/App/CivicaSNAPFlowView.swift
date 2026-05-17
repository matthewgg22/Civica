import CivicaDesignSystem
import SwiftUI

// Mounts the SNAP enrollment orchestrator and chains the verdict +
// packet-PDF views together. Replaces the legacy
// SNAPEligibilityIntroView wrapper for the Civica target — the
// legacy view depends on SNAPApplicationViewModel which carries
// VoteNow-specific address / prefill plumbing the new flow doesn't
// need.
//
// Flow:
//   1. Mount SNAPApplicationFlowOrchestratorView
//   2. On "Generate my application packet" → evaluate locally,
//      record into the status store (which routes the user to the
//      returning-user-home on subsequent launches), push the
//      decision-math view
//   3. From the math view's "Continue" CTA → push the packet view
//   4. The packet view's "Done for now" dismisses the whole chain

struct CivicaSNAPFlowView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var generatedDraft: SNAPApplicationDraft?
    @State private var verdict: SNAPEligibilityResult?
    @State private var presentingVerdict: Bool = false
    @State private var presentingPacket: Bool = false
    /// Draft held while the user completes phone sign-in before packet generation.
    @State private var pendingDraft: SNAPApplicationDraft?
    @State private var showingSignIn: Bool = false

    @EnvironmentObject private var statusStore: SNAPApplicationStatusStore
    @EnvironmentObject private var enrollmentAuth: CivicaEnrollmentAuth

    /// True when the user is here as part of a recertification rather
    /// than a first-time application. Drives the inline banner that
    /// explains "this is your recert" and primes any future per-step
    /// copy adjustments. Status-store advancement on completion also
    /// clears the recert-in-progress flag at the root.
    @AppStorage("co.civica.recertInProgress")
    private var isRecertInProgress: Bool = false

    let language: CivicaLanguage
    let recertMode: Bool

    init(language: CivicaLanguage, recertMode: Bool = false) {
        self.language = language
        self.recertMode = recertMode
    }

    var body: some View {
        VStack(spacing: 0) {
            if recertMode {
                recertBanner
            }
            SNAPApplicationFlowOrchestratorView(
                viewModel: SNAPApplicationFlowOrchestratorViewModel(),
                language: language,
                onGeneratePacket: { draft in
                    if enrollmentAuth.state.isAuthenticated {
                        runGeneratePacket(draft)
                    } else {
                        pendingDraft = draft
                        showingSignIn = true
                    }
                },
                onDismiss: { dismiss() }
            )
        }
        .navigationTitle("SNAP")
        .navigationBarTitleDisplayMode(.inline)
        // When auth succeeds (e.g. inside the sign-in sheet), handle the pending draft.
        .onChange(of: enrollmentAuth.state) { _, newState in
            if newState.isAuthenticated, let draft = pendingDraft {
                pendingDraft = nil
                showingSignIn = false
                runGeneratePacket(draft)
            }
        }
        .sheet(isPresented: $showingSignIn, onDismiss: {
            // User cancelled sign-in — discard the pending draft.
            pendingDraft = nil
        }) {
            SNAPPhoneSignInView(auth: enrollmentAuth, language: language)
        }
        .navigationDestination(isPresented: $presentingVerdict) {
            if let verdict {
                SNAPDecisionMathView(
                    result: verdict,
                    language: language,
                    onContinue: { presentingPacket = true },
                    draft: generatedDraft
                )
                .navigationDestination(isPresented: $presentingPacket) {
                    if let draft = generatedDraft {
                        SNAPApplicationPacketView(
                            draft: draft,
                            language: language,
                            onClose: {
                                // Explicitly unwind each navigationDestination
                                // before popping the flow itself. A single
                                // dismiss() from this deep in the stack
                                // doesn't reliably propagate up two
                                // navigationDestination layers in iOS 17+,
                                // so we collapse them in order.
                                presentingPacket = false
                                presentingVerdict = false
                                dismiss()
                            }
                        )
                    }
                }
            }
        }
    }

    // MARK: - Packet generation

    private func runGeneratePacket(_ draft: SNAPApplicationDraft) {
        let result = SNAPLocalEligibilityEvaluator.evaluate(draft)
        statusStore.recordEligibilityResult(result)
        if recertMode { isRecertInProgress = false }
        generatedDraft = draft
        verdict = result
        presentingVerdict = true

        // Submit to the enrollment API in the background.
        // This is best-effort — a failure must never block the local UX.
        let client = enrollmentAuth.makeEnrollmentAPIClient()
        let stateCode = draft.whereApplying.stateCode?.uppercased() ?? "CA"
        Task {
            do {
                let packet = try await client.createPacket(stateCode: stateCode)
                _ = try await client.submitPacket(packetId: packet.id)
                SNAPAnalytics.trackSubmitted()
            } catch {
                // Intentional no-op: enrollment API is additive persistence.
                // The applicant's local flow continues unaffected.
            }
        }
    }

    /// Inline banner above the orchestrator when the user is here
    /// for a recertification. Tells them prior answers are pre-
    /// populated and that they only need to change what changed.
    private var recertBanner: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .foregroundStyle(CivicaColors.brickPrimary)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(CivicaSNAPFlowStrings.recertBannerTitle.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(CivicaSNAPFlowStrings.recertBannerBody.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(CivicaSpacing.md)
        .background(CivicaColors.brickSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(CivicaColors.hairline).frame(height: 1)
        }
    }
}

enum CivicaSNAPFlowStrings {
    static let recertBannerTitle = CivicaText(
        "You're recertifying",
        es: "Estás recertificando"
    )
    static let recertBannerBody = CivicaText(
        "Your previous answers are pre-filled — change only what's different since last time.",
        es: "Tus respuestas anteriores están pre-llenadas — cambia solo lo que sea diferente desde la última vez."
    )
}

#if DEBUG
struct CivicaSNAPFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            CivicaSNAPFlowView(language: .english)
                .environmentObject(SNAPApplicationStatusStore())
        }
    }
}
#endif
