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

    let language: CivicaLanguage

    var body: some View {
        SNAPApplicationFlowOrchestratorView(
            viewModel: SNAPApplicationFlowOrchestratorViewModel(),
            language: language,
            onGeneratePacket: { draft in
                let result = SNAPLocalEligibilityEvaluator.evaluate(draft)
                statusStore.recordEligibilityResult(result)
                generatedDraft = draft
                verdict = result
                presentingVerdict = true
            },
            onDismiss: { dismiss() }
        )
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
