import SwiftUI

// EXPERIMENTAL SILOED MODULE: next-steps screen for official handoff guidance.
struct SNAPConfirmationView: View {
    @Environment(\.openURL) private var openURL
    @ObservedObject var viewModel: SNAPApplicationViewModel
    let onClose: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Your SNAP draft is ready")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(VoteNowColors.textPrimary)

                Text("You can use this information to complete your official application through your state’s benefits website.")
                    .font(.body)
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(alignment: .leading, spacing: 6) {
                    Text("State selected")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textPrimary)
                    Text(selectedStateLabel)
                        .font(.body)
                        .foregroundStyle(VoteNowColors.textSecondary)
                }
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(VoteNowColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
                )

                Button("Open official state SNAP website") {
                    guard let officialURL else { return }
                    openURL(officialURL)
                }
                .buttonStyle(VoteNowPrimaryCTAButtonStyle())
                .disabled(officialURL == nil)

                if officialURL == nil {
                    Text("Official state link coming soon.")
                        .font(.footnote)
                        .foregroundStyle(VoteNowColors.textSecondary)
                }

                Button("Review my draft again") {
                    viewModel.currentStep = .review
                }
                .buttonStyle(SNAPSecondaryCTAButtonStyle())

                Text("This assistant does not submit your application.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.warningAmber)
            }
            .padding(16)
        }
        .background(VoteNowColors.brandSoftBlue.ignoresSafeArea())
        .onAppear {
            viewModel.markNextStepsViewed()
        }
    }

    private var officialURL: URL? {
        guard let resource = SNAPStateResources.resource(for: viewModel.application.state) else { return nil }
        return URL(string: resource.officialApplicationURL)
    }

    private var selectedStateLabel: String {
        let code = (viewModel.application.state ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
        guard !code.isEmpty else { return "Not provided" }
        if let resource = SNAPStateResources.resource(for: code) {
            return "\(resource.displayName) (\(resource.stateCode))"
        }
        return code
    }
}
