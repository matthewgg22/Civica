import SwiftUI

struct SupabaseStatusView: View {
    @EnvironmentObject private var authStore: AuthStore

    let shouldAutoRefresh: Bool

    @State private var healthStatus: SupabaseHealthStatus?
    @State private var isCheckingHealth = false
    @State private var otpEmail = ""

    init(shouldAutoRefresh: Bool = true) {
        self.shouldAutoRefresh = shouldAutoRefresh
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Supabase Status")
                .font(.headline)

            Group {
                statusRow(
                    label: "Auth",
                    value: authStore.isSignedIn ? "Signed In" : "Signed Out",
                    indicator: authIndicator
                )
                statusRow(label: "User ID", value: authStore.userIDDisplay, indicator: nil)
                statusRow(label: "Health", value: healthDisplayText, indicator: healthIndicator)
            }

            if let error = authStore.lastError, !error.isEmpty {
                Text(error)
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(VoteNowColors.richRed)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(VoteNowColors.statusErrorSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }

            HStack(spacing: 8) {
                TextField("Email for OTP sign-in", text: $otpEmail)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .textFieldStyle(.roundedBorder)

                Button("Send OTP") {
                    Task {
                        await authStore.signInWithOTP(email: otpEmail)
                    }
                }
                .buttonStyle(.borderedProminent)
            }

            HStack(spacing: 10) {
                Button {
                    Task {
                        isCheckingHealth = true
                        healthStatus = await SupabaseHealthCheck.run()
                        isCheckingHealth = false
                    }
                } label: {
                    if isCheckingHealth {
                        ProgressView()
                    } else {
                        Text("Run Health Check")
                    }
                }
                .buttonStyle(.bordered)
                .disabled(isCheckingHealth)

                Button("Sign Out") {
                    Task {
                        await authStore.signOut()
                    }
                }
                .buttonStyle(.bordered)
                .disabled(!authStore.isSignedIn)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(VoteNowColors.secondaryButtonFill)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.18), lineWidth: 1)
        )
        .task {
            guard shouldAutoRefresh else { return }
            await authStore.refreshIfNeeded()
        }
    }

    private var healthDisplayText: String {
        guard let healthStatus else { return "Not checked" }
        if healthStatus.isHealthy {
            if let statusCode = healthStatus.statusCode {
                return "Healthy (\(statusCode))"
            }
            return "Healthy"
        }
        if let error = healthStatus.error {
            return "Failed: \(error.localizedDescription)"
        }
        if let statusCode = healthStatus.statusCode {
            return "Failed (\(statusCode))"
        }
        return "Failed"
    }

    private var authIndicator: StatusIndicator {
        if authStore.isSignedIn {
            return StatusIndicator(
                iconName: "checkmark.circle.fill",
                tint: VoteNowColors.successGreen,
                surface: VoteNowColors.statusSuccessSurface
            )
        }
        return StatusIndicator(
            iconName: "person.crop.circle.badge.xmark",
            tint: VoteNowColors.neutralStatus,
            surface: VoteNowColors.statusNeutralSurface
        )
    }

    private var healthIndicator: StatusIndicator {
        guard let healthStatus else {
            return StatusIndicator(
                iconName: "questionmark.circle",
                tint: VoteNowColors.neutralStatus,
                surface: VoteNowColors.statusNeutralSurface
            )
        }
        if healthStatus.isHealthy {
            return StatusIndicator(
                iconName: "checkmark.seal.fill",
                tint: VoteNowColors.successGreen,
                surface: VoteNowColors.statusSuccessSurface
            )
        }
        return StatusIndicator(
            iconName: "exclamationmark.triangle.fill",
            tint: VoteNowColors.richRed,
            surface: VoteNowColors.statusErrorSurface
        )
    }

    @ViewBuilder
    private func statusRow(label: String, value: String, indicator: StatusIndicator?) -> some View {
        HStack {
            Text(label)
                .font(.subheadline.weight(.semibold))
            Spacer()
            HStack(spacing: 6) {
                if let indicator {
                    Image(systemName: indicator.iconName)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(indicator.tint)
                        .padding(4)
                        .background(indicator.surface)
                        .clipShape(Circle())
                        .accessibilityHidden(true)
                }
                Text(value)
                    .font(.subheadline)
                    .foregroundStyle(VoteNowColors.mutedText)
                    .multilineTextAlignment(.trailing)
                    .lineLimit(2)
            }
        }
    }
}

private struct StatusIndicator {
    let iconName: String
    let tint: Color
    let surface: Color
}

private extension AuthStore {
    var userIDDisplay: String {
        guard let user else { return "—" }
        return user.id.uuidString
    }
}

#Preview {
    SupabaseStatusView(shouldAutoRefresh: false)
        .environmentObject(AuthStore(startListening: false))
}
