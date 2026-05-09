import CivicaDesignSystem
import SwiftUI
import UIKit

@MainActor
final class HapticsManager {
    static let shared = HapticsManager()

    private let impact = UIImpactFeedbackGenerator(style: .light)
    private let notification = UINotificationFeedbackGenerator()

    private init() {}

    func holdStarted() {
        impact.prepare()
        impact.impactOccurred(intensity: 0.8)
    }

    func success() {
        notification.notificationOccurred(.success)
    }

    func canceled() {
        notification.notificationOccurred(.warning)
    }
}

struct HoldToConfirmButton: View {
    let title: String
    let confirmedTitle: String
    let isConfirmed: Bool
    var holdDuration: TimeInterval = 5.0
    let onConfirm: () -> Void
    var onReset: (() -> Void)? = nil

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isPressing = false
    @State private var progress: CGFloat = 0
    @State private var holdTask: Task<Void, Never>?
    @State private var didConfirmDuringCurrentPress = false
    @State private var ignoreNextTapAfterConfirm = false

    var body: some View {
        Button {
            if ignoreNextTapAfterConfirm {
                ignoreNextTapAfterConfirm = false
                return
            }
            if isConfirmed, onReset != nil {
                onReset?()
            }
        } label: {
            GeometryReader { geo in
                let width = max(0, geo.size.width)
                let fillWidth = width * progress

                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .fill(baseBackgroundColor)

                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .fill(fillGradient)
                        .frame(width: fillWidth)

                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .stroke(borderColor, lineWidth: 1)

                    HStack(spacing: CivicaSpacing.xs) {
                        Image(systemName: leadingIcon)
                            .font(CivicaTypography.captionBold)
                        Text(buttonText)
                            .font(CivicaTypography.subheadStrong)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(textColor)
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.15), value: isPressing)
                }
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
            }
            .frame(height: 36)
            .contentShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isConfirmed && onReset == nil)
        .simultaneousGesture(holdGesture)
        .onDisappear {
            cancelHold(resetProgress: true, triggerCancelHaptic: false)
        }
        .accessibilityLabel(isConfirmed ? "Voted" : "Voted?")
        .accessibilityHint(isConfirmed
            ? "Double tap to reset voted status."
            : "Press and hold for five seconds to mark as voted.")
    }

    private var holdGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { _ in
                guard !isConfirmed else { return }
                startHoldIfNeeded()
            }
            .onEnded { _ in
                guard !isConfirmed else { return }
                if !didConfirmDuringCurrentPress {
                    cancelHold(resetProgress: true, triggerCancelHaptic: true)
                }
            }
    }

    private var baseBackgroundColor: Color {
        if isConfirmed {
            return CivicaColors.statusSuccessSurface
        }
        return CivicaColors.secondaryButtonFill
    }

    private var fillGradient: LinearGradient {
        LinearGradient(
            colors: [
                CivicaColors.ctaBluePressed.opacity(0.82),
                CivicaColors.successGreen.opacity(0.9)
            ],
            startPoint: .leading,
            endPoint: .trailing
        )
    }

    private var borderColor: Color {
        if isConfirmed {
            return CivicaColors.successGreen.opacity(0.82)
        }
        return CivicaColors.ctaBlue.opacity(0.34 + (Double(progress) * 0.42))
    }

    private var textColor: Color {
        if isConfirmed {
            return CivicaColors.surfacePrimary
        }
        return progress > 0.52 ? CivicaColors.surfacePrimary : CivicaColors.textPrimary
    }

    private var buttonText: String {
        if isConfirmed {
            return confirmedTitle
        }
        if isPressing {
            return "Hold to confirm..."
        }
        return title
    }

    private var leadingIcon: String {
        if isConfirmed {
            return "checkmark.circle.fill"
        }
        if isPressing {
            return "hourglass"
        }
        return "hand.tap.fill"
    }

    private func startHoldIfNeeded() {
        guard holdTask == nil else { return }

        isPressing = true
        didConfirmDuringCurrentPress = false
        HapticsManager.shared.holdStarted()

        let start = Date()
        holdTask = Task {
            while !Task.isCancelled {
                let elapsed = Date().timeIntervalSince(start)
                let nextProgress = CGFloat(min(max(elapsed / max(0.1, holdDuration), 0), 1))

                await MainActor.run {
                    if reduceMotion {
                        progress = nextProgress
                    } else {
                        withAnimation(.linear(duration: 0.05)) {
                            progress = nextProgress
                        }
                    }
                }

                if nextProgress >= 1 {
                    await MainActor.run {
                        didConfirmDuringCurrentPress = true
                        ignoreNextTapAfterConfirm = true
                        isPressing = false
                        holdTask?.cancel()
                        holdTask = nil
                        onConfirm()
                        HapticsManager.shared.success()
                    }
                    return
                }

                try? await Task.sleep(nanoseconds: 16_000_000)
            }
        }
    }

    private func cancelHold(resetProgress: Bool, triggerCancelHaptic: Bool) {
        holdTask?.cancel()
        holdTask = nil

        if isPressing && triggerCancelHaptic {
            HapticsManager.shared.canceled()
        }

        isPressing = false
        didConfirmDuringCurrentPress = false
        ignoreNextTapAfterConfirm = false

        guard resetProgress else { return }

        if reduceMotion {
            progress = 0
        } else {
            withAnimation(CivicaAnimation.snap) {
                progress = 0
            }
        }
    }
}
