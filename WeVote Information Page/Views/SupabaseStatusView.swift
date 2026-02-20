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
                statusRow(label: "Auth", value: authStore.isSignedIn ? "Signed In" : "Signed Out")
                statusRow(label: "User ID", value: authStore.userIDDisplay)
                statusRow(label: "Health", value: healthDisplayText)
            }

            if let error = authStore.lastError, !error.isEmpty {
                Text(error)
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(VoteNowColors.richRed)
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
                .fill(VoteNowColors.infoSurfaceBlue)
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

    @ViewBuilder
    private func statusRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.subheadline.weight(.semibold))
            Spacer()
            Text(value)
                .font(.subheadline)
                .foregroundStyle(VoteNowColors.mutedText)
                .multilineTextAlignment(.trailing)
                .lineLimit(2)
        }
    }
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
