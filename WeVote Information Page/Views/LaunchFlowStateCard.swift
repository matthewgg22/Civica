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
            return VoteNowColors.primaryCTA
        case .empty:
            return VoteNowColors.mutedText
        case .error:
            return VoteNowColors.urgentCTA
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
                    .foregroundColor(VoteNowColors.primaryText)
            }

            Text(message)
                .font(.subheadline)
                .foregroundColor(VoteNowColors.mutedText)
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
        .background(VoteNowColors.surfaceWhite)
        .clipShape(RoundedRectangle(cornerRadius: VoteNowColors.cardCornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: VoteNowColors.cardCornerRadius, style: .continuous)
                .stroke(VoteNowColors.borderWarm.opacity(0.72), lineWidth: 1)
        )
    }
}

private struct LaunchFlowPrimaryCTAButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundColor(.white)
            .frame(maxWidth: .infinity, minHeight: 40, alignment: .center)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(VoteNowColors.ctaBlue)
                    .opacity(isEnabled ? (configuration.isPressed ? 0.84 : 1.0) : 0.5)
            )
            .scaleEffect(configuration.isPressed ? 0.99 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

private struct LaunchFlowSecondaryCTAButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundColor(VoteNowColors.primaryCTA)
            .frame(maxWidth: .infinity, minHeight: 40, alignment: .center)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(VoteNowColors.infoSurfaceBlue.opacity(configuration.isPressed ? 0.55 : 0.8))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(VoteNowColors.primaryCTA.opacity(0.55), lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.99 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
