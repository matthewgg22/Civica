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

    @EnvironmentObject private var statusStore: SNAPApplicationStatusStore

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
                    let result = SNAPLocalEligibilityEvaluator.evaluate(draft)
                    statusStore.recordEligibilityResult(result)
                    // Recert completion: clear the in-progress flag so
                    // the root re-routes through normal status handling
                    // (the verdict + packet chain advances status to
                    // .packetGenerated).
                    if recertMode {
                        isRecertInProgress = false
                    }
                    generatedDraft = draft
                    verdict = result
                    presentingVerdict = true
                },
                onDismiss: { dismiss() }
            )
        }
        .navigationTitle("SNAP")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: $presentingVerdict) {
            if let verdict {
                SNAPDecisionMathView(
                    result: verdict,
                    language: language,
                    onContinue: { presentingPacket = true }
                )
                .navigationDestination(isPresented: $presentingPacket) {
                    if let draft = generatedDraft {
                        SNAPApplicationPacketView(
                            draft: draft,
                            language: language,
                            onClose: { dismiss() }
                        )
                    }
                }
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
