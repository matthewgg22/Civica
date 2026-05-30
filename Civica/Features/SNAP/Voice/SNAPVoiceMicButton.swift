import CivicaDesignSystem
import SwiftUI

// Mic button mounted in the consumer view's step header. Tap toggles
// listening. State drives appearance and VoiceOver labels. The button
// never blocks the typed flow — if voice is unavailable the button
// renders disabled with a quiet hint.
//
// Two modes:
//   • `step != nil` — SNAP intake. Final transcript runs through the
//     step-specific LLM extraction pipeline. Disabled when LLM is
//     unavailable (.unavailable state).
//   • `step == nil` — transcript-only. Used by InterviewCoach where the
//     transcript flows into a free-form input. Stays enabled even when
//     the LLM is unavailable (transcription doesn't need it).
@available(iOS 26.0, *)
struct SNAPVoiceMicButton: View {
    @ObservedObject var service: SNAPVoiceIntakeService
    let step: SNAPDraftStep?

    init(service: SNAPVoiceIntakeService, step: SNAPDraftStep? = nil) {
        self.service = service
        self.step = step
    }

    @State private var isPulsing: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button(action: handleTap) {
            ZStack {
                Circle()
                    .fill(fillColor)
                    .frame(width: 36, height: 36)
                    .overlay(
                        Circle()
                            .stroke(borderColor, lineWidth: 1.5)
                    )
                    .scaleEffect(isPulsing && isListening && !reduceMotion ? 1.12 : 1.0)
                    .animation(
                        reduceMotion
                            ? nil
                            : (isListening
                                ? .easeInOut(duration: 0.9).repeatForever(autoreverses: true)
                                : CivicaAnimation.standard),
                        value: isPulsing
                    )

                iconView
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(iconColor)
            }
            .frame(minWidth: 44, minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint(accessibilityHint)
        .onAppear { isPulsing = isListening }
        .onChange(of: isListening) { _, newValue in isPulsing = newValue }
    }

    // MARK: - State derivations

    private var isListening: Bool {
        if case .listening = service.state { return true }
        return false
    }

    private var isProcessing: Bool {
        if case .processing = service.state { return true }
        return false
    }

    private var hasError: Bool {
        if case .error = service.state { return true }
        return false
    }

    private var isUnavailable: Bool {
        if case .unavailable = service.state { return true }
        return false
    }

    private var isDisabled: Bool {
        // Transcript-only callers (step == nil) don't need the on-device LLM,
        // so .unavailable doesn't block them. Step-bound callers do.
        if isProcessing { return true }
        if isUnavailable && step != nil { return true }
        return false
    }

    private var fillColor: Color {
        switch service.state {
        case .listening: return CivicaColors.destructive
        case .processing: return CivicaColors.surfaceSecondary
        case .error: return CivicaColors.statusWarningSurface
        case .unavailable: return CivicaColors.secondaryButtonFillDisabled
        case .idle: return CivicaColors.surfacePrimary
        }
    }

    private var borderColor: Color {
        switch service.state {
        case .listening: return CivicaColors.destructivePressed
        case .processing: return CivicaColors.pinePrimary.opacity(0.4)
        case .error: return CivicaColors.warningAmber
        case .unavailable: return CivicaColors.secondaryButtonDisabledBorder
        case .idle: return CivicaColors.pinePrimary.opacity(0.5)
        }
    }

    private var iconColor: Color {
        switch service.state {
        case .listening: return .white
        case .processing: return CivicaColors.pinePrimary
        case .error: return CivicaColors.warningAmber
        case .unavailable: return CivicaColors.muted
        case .idle: return CivicaColors.pinePrimary
        }
    }

    @ViewBuilder
    private var iconView: some View {
        switch service.state {
        case .processing:
            ProgressView()
                .controlSize(.small)
                .tint(CivicaColors.pinePrimary)
        case .error:
            Image(systemName: "exclamationmark.circle.fill")
        case .unavailable:
            Image(systemName: "mic.slash.fill")
        case .listening:
            Image(systemName: "mic.fill")
        case .idle:
            Image(systemName: "mic")
        }
    }

    // MARK: - Accessibility

    private var accessibilityLabel: String {
        let isTranscriptOnly = (step == nil)
        switch service.state {
        case .idle:
            return isTranscriptOnly ? "Speak your answer" : "Fill this step by voice"
        case .listening:
            return isTranscriptOnly ? "Stop recording" : "Stop voice fill"
        case .processing:
            return "Processing voice input"
        case .error:
            return isTranscriptOnly ? "Voice error" : "Voice fill error"
        case .unavailable(let reason):
            return isTranscriptOnly ? "Voice unavailable: \(reason)" : "Voice fill unavailable: \(reason)"
        }
    }

    private var accessibilityHint: String {
        let isTranscriptOnly = (step == nil)
        switch service.state {
        case .idle:
            return isTranscriptOnly
                ? "Double tap to speak. Your audio is processed on device."
                : "Double tap to speak. Your audio is processed on device and not stored."
        case .listening:
            return isTranscriptOnly
                ? "Double tap to stop recording. Your words will appear in the input field."
                : "Double tap to stop recording and fill the fields."
        default:
            return ""
        }
    }

    // MARK: - Actions

    private func handleTap() {
        Task {
            switch service.state {
            case .idle, .error, .unavailable:
                if let step {
                    await service.startListening(forStep: step)
                } else {
                    await service.startListeningTranscriptOnly()
                }
            case .listening:
                await service.stopListening()
            default:
                break
            }
        }
    }
}
