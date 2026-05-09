import SwiftUI

enum LaunchFlowVisualState {
    case loading
    case empty
    case error
}

struct LaunchFlowStateCard: View {
    let state: LaunchFlowVisualState
    let title: String
    let message: String
    let primaryActionTitle: String?
    let primaryAction: (() -> Void)?
    let secondaryActionTitle: String?
    let secondaryAction: (() -> Void)?

    init(
        state: LaunchFlowVisualState,
        title: String,
        message: String,
        primaryActionTitle: String? = nil,
        primaryAction: (() -> Void)? = nil,
        secondaryActionTitle: String? = nil,
        secondaryAction: (() -> Void)? = nil
    ) {
        self.state = state
        self.title = title
        self.message = message
        self.primaryActionTitle = primaryActionTitle
        self.primaryAction = primaryAction
        self.secondaryActionTitle = secondaryActionTitle
        self.secondaryAction = secondaryAction
    }

    private var iconName: String {
        switch state {
        case .loading:
            return "hourglass"
        case .empty:
            return "tray"
        case .error:
            return "exclamationmark.triangle"
        }
    }

    private var iconColor: Color {
        switch state {
        case .loading:
            return CivicaColors.primaryCTA
        case .empty:
            return CivicaColors.mutedText
        case .error:
            return CivicaColors.urgentCTA
        }
    }

    private var stateLabel: String {
        switch state {
        case .loading:
            return "Loading"
        case .empty:
            return "Action Needed"
        case .error:
            return "Error"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 10) {
                if state == .loading {
                    ProgressView()
                        .progressViewStyle(.circular)
                } else {
                    Image(systemName: iconName)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(iconColor)
                        .frame(width: 18, height: 18)
                }

                Text(title)
                    .font(.headline.weight(.semibold))
                    .foregroundColor(CivicaColors.primaryText)
            }

            Text(stateLabel)
                .font(.caption2.weight(.bold))
                .foregroundColor(iconColor)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(iconColor.opacity(0.14))
                .clipShape(Capsule())

            Text(message)
                .font(.subheadline)
                .foregroundColor(CivicaColors.mutedText)
                .fixedSize(horizontal: false, vertical: true)

            if let primaryActionTitle, let primaryAction {
                Button(primaryActionTitle, action: primaryAction)
                    .buttonStyle(LaunchFlowPrimaryCTAButtonStyle())
            }

            if let secondaryActionTitle, let secondaryAction {
                Button(secondaryActionTitle, action: secondaryAction)
                    .buttonStyle(LaunchFlowSecondaryCTAButtonStyle())
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfaceWhite)
        .clipShape(RoundedRectangle(cornerRadius: CivicaColors.cardCornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaColors.cardCornerRadius, style: .continuous)
                .stroke(CivicaColors.borderWarm.opacity(0.72), lineWidth: 1)
        )
    }
}

private struct LaunchFlowPrimaryCTAButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundColor(CivicaColors.onPrimaryText)
            .frame(maxWidth: .infinity, minHeight: 40, alignment: .center)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(backgroundColor(isPressed: configuration.isPressed))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(CivicaColors.primaryCTA.opacity(0.24), lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.99 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        guard isEnabled else { return CivicaColors.ctaBlueDisabled }
        return isPressed ? CivicaColors.ctaBluePressed : CivicaColors.ctaBlue
    }
}

private struct LaunchFlowSecondaryCTAButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundColor(isEnabled ? CivicaColors.primaryCTA : CivicaColors.mutedText)
            .frame(maxWidth: .infinity, minHeight: 40, alignment: .center)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(backgroundColor(isPressed: configuration.isPressed))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.99 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        guard isEnabled else { return CivicaColors.secondaryButtonFillDisabled }
        return isPressed ? CivicaColors.secondaryButtonFillPressed : CivicaColors.secondaryButtonFill
    }

    private var borderColor: Color {
        isEnabled ? CivicaColors.secondaryButtonBorder : CivicaColors.secondaryButtonDisabledBorder
    }
}
