import CivicaDesignSystem
import SwiftUI

// Soft pre-prompt for notification permission.
//
// We surface this BEFORE iOS's system prompt so a "no" here doesn't
// burn the one-shot system prompt. iOS only lets you ask once — if
// the user declines the system prompt, the app can't ask again
// without sending the user to Settings. The soft pre-prompt lets us
// gather a yes/no signal at far lower stakes.
//
// Flow:
//   - If status is .notDetermined, show this card with "Allow / Not now"
//   - On Allow → trigger the system prompt
//   - On Not now → save a "user dismissed" flag and don't re-ask
//     (until the next major surface event, e.g. recert flow completion)

struct RecertNotificationPermissionView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    /// One-time dismissal flag. Re-shown only when the user enters a
    /// new phase of the recert flow (e.g. completes Phantom Recert).
    @AppStorage(CivicaAppStorageKeys.recertCompanionPermissionDismissed)
    private var hasDismissed: Bool = false

    @State private var systemStatus: UNAuthorizationStatus = .notDetermined

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        Group {
            if shouldShowPrompt {
                card
            } else {
                EmptyView()
            }
        }
        .task {
            systemStatus = await RecertNotificationService.shared.authorizationStatus()
        }
    }

    private var shouldShowPrompt: Bool {
        systemStatus == .notDetermined && !hasDismissed
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "bell.badge")
                    .font(.system(size: 22))
                    .foregroundStyle(CivicaColors.pinePrimary)
                Text(RecertCompanionStrings.reminderPermissionTitle.value(in: language))
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
            }
            Text(RecertCompanionStrings.reminderPermissionSubtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: CivicaSpacing.sm) {
                Button(action: accept) {
                    Text(RecertCompanionStrings.reminderPermissionAccept.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(.white)
                        .padding(.horizontal, CivicaSpacing.md)
                        .padding(.vertical, CivicaSpacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: 3, style: .continuous)
                                .fill(CivicaColors.pinePrimary)
                        )
                }
                .buttonStyle(.plain)

                Button(action: dismiss) {
                    Text(RecertCompanionStrings.reminderPermissionSkip.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .padding(.horizontal, CivicaSpacing.md)
                        .padding(.vertical, CivicaSpacing.sm)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private func accept() {
        Task {
            _ = await RecertNotificationService.shared.requestAuthorization()
            systemStatus = await RecertNotificationService.shared.authorizationStatus()
        }
    }

    private func dismiss() {
        hasDismissed = true
    }
}

#if DEBUG
struct RecertNotificationPermissionView_Previews: PreviewProvider {
    static var previews: some View {
        RecertNotificationPermissionView()
            .padding()
            .background(CivicaColors.paper)
    }
}
#endif
