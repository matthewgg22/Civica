import CivicaDesignSystem
import SwiftUI

// Floating chip that shows the live partial transcript while listening.
// Visible only when the service is actively transcribing. Auto-clears
// when the utterance ends. Helps users confirm ASR is working without
// persisting anything — the chip mirrors in-memory state only.
@available(iOS 26.0, *)
struct SNAPVoiceTranscriptOverlay: View {
    @ObservedObject var service: SNAPVoiceIntakeService

    var body: some View {
        if shouldShow {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                HStack(spacing: CivicaSpacing.xs) {
                    Circle()
                        .fill(CivicaColors.destructive)
                        .frame(width: 8, height: 8)
                    Text(headerText)
                        .font(CivicaTypography.captionStrong)
                        .foregroundStyle(CivicaColors.muted)
                }
                Text(displayText)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.ink)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.sm)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                    .fill(CivicaColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                    .stroke(CivicaColors.hairline, lineWidth: 1)
            )
            .shadow(color: CivicaColors.shadowSoft, radius: 6, x: 0, y: 2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .animation(CivicaAnimation.standard, value: service.partialTranscript)
        }
    }

    private var shouldShow: Bool {
        switch service.state {
        case .listening, .processing: return true
        default: return false
        }
    }

    private var headerText: String {
        switch service.state {
        case .listening: return "Listening — audio stays on device"
        case .processing: return "Filling your draft…"
        default: return ""
        }
    }

    private var displayText: String {
        let text = service.partialTranscript
        return text.isEmpty ? "Speak when ready." : text
    }
}
