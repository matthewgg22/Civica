import SwiftUI

// EXPERIMENTAL SILOED MODULE: privacy notice gate shown before prototype intake.
struct SNAPPrivacyNoticeView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: SNAPApplicationViewModel
    @State private var continueToEligibility = false
    @State private var hasTrackedPrivacyView = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Before You Start")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(VoteNowColors.textPrimary)

                privacySection(
                    title: "Assistant status",
                    body: "This is a guided draft tool to help you organize a SNAP application. It is not the official government SNAP application."
                )

                privacySection(
                    title: "What not to enter",
                    body: "Do not enter immigration documents, bank account numbers, or private medical details in this draft."
                )

                privacySection(
                    title: "How your answers are handled",
                    body: "During this draft, answers stay in this app session and are not submitted to the government."
                )

                privacySection(
                    title: "Official submission",
                    body: "This prototype does not submit a SNAP application."
                )

                Text("This screen does not determine eligibility or approval.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)

                VStack(spacing: 10) {
                    Button("I understand — continue") {
                        viewModel.acceptedPrivacyNotice = true
                        continueToEligibility = true
                    }
                    .buttonStyle(VoteNowPrimaryCTAButtonStyle())

                    Button("Go back") {
                        dismiss()
                    }
                    .buttonStyle(SNAPSecondaryCTAButtonStyle())
                }
                .padding(.top, 4)
            }
            .padding(16)
        }
        .background(VoteNowColors.brandSoftBlue.ignoresSafeArea())
        .navigationDestination(isPresented: $continueToEligibility) {
            SNAPEligibilityIntroView(viewModel: viewModel)
                .navigationTitle("Check what you may need")
                .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear {
            guard !hasTrackedPrivacyView else { return }
            hasTrackedPrivacyView = true
            SNAPAnalytics.trackPrivacyNoticeViewed()
        }
    }

    @ViewBuilder
    private func privacySection(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.headline)
                .foregroundStyle(VoteNowColors.textPrimary)
            Text(body)
                .font(.body)
                .foregroundStyle(VoteNowColors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(VoteNowColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
        )
    }
}
