import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE: magic-link session recovery for the SNAP
// conversational screener.
//
// Why it exists: per the locked persistence decision, sessions live in
// Supabase. If a user uninstalls the app or wipes their phone mid-
// application, "anonymous session, no account" is a real recovery cliff.
// This view + its viewmodel are the way back: enter the phone or email
// they used to sign up for delivery, get a one-time link, redeem it on
// reinstall to load the in-progress session.
//
// Phase D scope: UI only, with a stubbed network call. The real backend
// endpoint (POST /snap/sessions/recover) ships alongside the FastAPI
// HTTP layer in the next backend turn.

@MainActor
final class SNAPRecoveryViewModel: ObservableObject {
    enum Channel: String, CaseIterable, Identifiable {
        case phone, email
        var id: String { rawValue }
        var label: String { self == .phone ? "Phone number" : "Email address" }
    }

    enum Phase: Equatable {
        case input
        case sending
        case sent
        case redeeming
        case error(String)
    }

    @Published var channel: Channel = .phone
    @Published var contactValue: String = ""
    @Published var redemptionToken: String = ""
    @Published private(set) var phase: Phase = .input

    private let client: SNAPNetworkClient
    private let onRecovered: @MainActor (SNAPStartSessionResponse) -> Void

    init(
        client: SNAPNetworkClient,
        onRecovered: @escaping @MainActor (SNAPStartSessionResponse) -> Void
    ) {
        self.client = client
        self.onRecovered = onRecovered
    }

    var canRequestLink: Bool {
        let trimmed = contactValue.trimmingCharacters(in: .whitespaces)
        switch channel {
        case .phone:
            return trimmed.filter(\.isNumber).count >= 10
        case .email:
            return trimmed.contains("@") && trimmed.contains(".")
        }
    }

    var canRedeem: Bool {
        !redemptionToken.trimmingCharacters(in: .whitespaces).isEmpty
    }

    func requestLink() async {
        guard canRequestLink else { return }
        phase = .sending
        // TODO Phase D wrap-up: call POST /snap/sessions/recover/request
        // once the backend endpoint exists. Stubbed for now so the UI
        // can be exercised in previews.
        try? await Task.sleep(nanoseconds: 500_000_000)
        phase = .sent
    }

    func redeem() async {
        guard canRedeem else { return }
        phase = .redeeming
        do {
            let response = try await client.recoverSession(token: redemptionToken)
            onRecovered(response)
        } catch {
            phase = .error("That link doesn't look right. Try requesting a new one.")
        }
    }
}

struct SNAPRecoveryView: View {
    @StateObject var viewModel: SNAPRecoveryViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            header
            Picker("How should we send the link?", selection: $viewModel.channel) {
                ForEach(SNAPRecoveryViewModel.Channel.allCases) { channel in
                    Text(channel.label).tag(channel)
                }
            }
            .pickerStyle(.segmented)

            TextField(viewModel.channel.label, text: $viewModel.contactValue)
                .keyboardType(viewModel.channel == .phone ? .phonePad : .emailAddress)
                .textContentType(viewModel.channel == .phone ? .telephoneNumber : .emailAddress)
                .textFieldStyle(.roundedBorder)

            actionRow
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.xl))
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text("Continue an earlier application")
                .font(CivicaTypography.cardTitle)
                .foregroundColor(CivicaColors.textPrimary)
            Text("We'll send you a one-time link to pick up where you left off.")
                .font(CivicaTypography.subhead)
                .foregroundColor(CivicaColors.textSecondary)
        }
    }

    @ViewBuilder
    private var actionRow: some View {
        switch viewModel.phase {
        case .input:
            Button("Send link") { Task { await viewModel.requestLink() } }
                .disabled(!viewModel.canRequestLink)
                .buttonStyle(.borderedProminent)
        case .sending:
            ProgressView()
        case .sent:
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Text("Check \(viewModel.contactValue) for a one-time link.")
                    .font(CivicaTypography.subhead)
                    .foregroundColor(CivicaColors.textPrimary)
                TextField("Paste the code from the link", text: $viewModel.redemptionToken)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.oneTimeCode)
                Button("Continue") { Task { await viewModel.redeem() } }
                    .disabled(!viewModel.canRedeem)
                    .buttonStyle(.borderedProminent)
            }
        case .redeeming:
            ProgressView("Loading your application…")
        case .error(let message):
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Text(message)
                    .font(CivicaTypography.subhead)
                    .foregroundColor(CivicaColors.ctaRed)
                Button("Try again") { viewModel.objectWillChange.send() }
            }
        }
    }
}

#if DEBUG
struct SNAPRecoveryView_Previews: PreviewProvider {
    static var previews: some View {
        SNAPRecoveryView(
            viewModel: SNAPRecoveryViewModel(
                client: MockSNAPNetworkClient(),
                onRecovered: { _ in }
            )
        )
        .padding()
        .background(CivicaColors.canvasBackground)
    }
}
#endif
