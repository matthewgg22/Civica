import CivicaDesignSystem
import SwiftUI

// Mic button mounted in the consumer view's step header. Tap toggles
// listening for the currently-active step. State drives appearance and
// VoiceOver labels. The button never blocks the typed flow — if voice
// is unavailable the button renders disabled with a quiet hint.
@available(iOS 26.0, *)
struct SNAPVoiceMicButton: View {
    @ObservedObject var service: SNAPVoiceIntakeService
    let step: SNAPDraftStep

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
                    .font(.system(size: 16, weight: .semibold))
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
        isUnavailable || isProcessing
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
        case .processing: return CivicaColors.brickPrimary.opacity(0.4)
        case .error: return CivicaColors.warningAmber
        case .unavailable: return CivicaColors.secondaryButtonDisabledBorder
        case .idle: return CivicaColors.brickPrimary.opacity(0.5)
        }
    }

    private var iconColor: Color {
        switch service.state {
        case .listening: return .white
        case .processing: return CivicaColors.brickPrimary
        case .error: return CivicaColors.warningAmber
        case .unavailable: return CivicaColors.muted
        case .idle: return CivicaColors.brickPrimary
        }
    }

    @ViewBuilder
    private var iconView: some View {
        switch service.state {
        case .processing:
            ProgressView()
                .controlSize(.small)
                .tint(CivicaColors.brickPrimary)
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
        switch service.state {
        case .idle: return "Fill this step by voice"
        case .listening: return "Stop voice fill"
        case .processing: return "Processing voice input"
        case .error: return "Voice fill error"
        case .unavailable(let reason): return "Voice fill unavailable: \(reason)"
        }
    }

    private var accessibilityHint: String {
        switch service.state {
        case .idle: return "Double tap to speak. Your audio is processed on device and not stored."
        case .listening: return "Double tap to stop recording and fill the fields."
        default: return ""
        }
    }

    // MARK: - Actions

    private func handleTap() {
        Task {
            switch service.state {
            case .idle, .error:
                await service.startListening(forStep: step)
            case .listening:
                await service.stopListening()
            default:
                break
            }
        }
    }
}
