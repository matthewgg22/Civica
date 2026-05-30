import CivicaDesignSystem
import SwiftUI

// View modifier that draws an amber border around any input whose
// voice-extracted confidence is below SNAPVoiceConfidence.needsReviewThreshold.
// Manually-typed fields never carry a confidence entry, so they never light up.
struct SNAPVoiceFieldHighlight: ViewModifier {
    let confidence: Double?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .topTrailing) {
                if needsReview {
                    Image(systemName: "exclamationmark.bubble.fill")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(CivicaColors.warningAmber)
                        .padding(2)
                        .background(
                            Circle().fill(CivicaColors.surfacePrimary)
                        )
                        .offset(x: 6, y: -6)
                        .accessibilityLabel("Voice-filled, please review")
                }
            }
            .overlay {
                if needsReview {
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .stroke(CivicaColors.warningAmber, lineWidth: 1.5)
                        .allowsHitTesting(false)
                }
            }
            .civicaAnimation(CivicaAnimation.standard, value: needsReview)
    }

    private var needsReview: Bool {
        guard let confidence else { return false }
        return confidence < SNAPVoiceConfidence.needsReviewThreshold
    }
}

extension View {
    func snapVoiceFieldHighlight(_ confidence: Double?) -> some View {
        modifier(SNAPVoiceFieldHighlight(confidence: confidence))
    }
}
