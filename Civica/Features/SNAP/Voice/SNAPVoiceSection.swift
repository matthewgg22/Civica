import CivicaDesignSystem
import SwiftUI

// Drop-in wrapper that adds the SNAP voice-intake affordance (mic
// button + live transcript chip) around any per-step view. When the
// LLM finishes extracting from an utterance, the patch is applied
// directly into the bound SNAPApplicationDraft and per-field
// confidences land in the bound confidence map (consumed by the
// .snapVoiceFieldHighlight modifier on individual inputs).
//
// Known limitation worth documenting: in the current orchestrator,
// each per-section flow VM snapshots its answers slice at the moment
// the section is mounted (e.g. SNAPWhereApplyingFlowViewModel takes
// `answers: SNAPWhereApplyingAnswers` by value). Voice patches land
// in the orchestrator's draft, so they persist correctly, but the
// active flow VM doesn't observe the change until the user navigates
// away from and back to the section. Refactoring the flow VMs to take
// `Binding<...Answers>` instead of a snapshot is the follow-up that
// closes this gap.
@available(iOS 26.0, *)
struct SNAPVoiceSection<Content: View>: View {
    let step: SNAPDraftStep
    @Binding var draft: SNAPApplicationDraft
    @Binding var confidence: [SNAPFieldKey: Double]
    let content: () -> Content

    @StateObject private var service = SNAPVoiceIntakeService()

    init(
        step: SNAPDraftStep,
        draft: Binding<SNAPApplicationDraft>,
        confidence: Binding<[SNAPFieldKey: Double]>,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.step = step
        self._draft = draft
        self._confidence = confidence
        self.content = content
    }

    var body: some View {
        content()
            .overlay(alignment: .topTrailing) {
                SNAPVoiceMicButton(service: service, step: step)
                    .padding(.top, CivicaSpacing.lg)
                    .padding(.trailing, CivicaSpacing.lg)
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                SNAPVoiceTranscriptOverlay(service: service)
                    .padding(.horizontal, CivicaSpacing.xl)
                    .padding(.bottom, CivicaSpacing.sm)
            }
            .task(id: step) {
                for await update in service.updates {
                    if case .extracted(let patch, _) = update {
                        patch.apply(to: &draft, confidence: &confidence)
                    }
                }
            }
    }
}
