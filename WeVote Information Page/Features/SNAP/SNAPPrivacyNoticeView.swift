import SwiftUI

// EXPERIMENTAL SILOED MODULE: privacy notice gate shown before prototype intake.
struct SNAPPrivacyNoticeView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @ObservedObject var viewModel: SNAPApplicationViewModel
    @State private var continueToEligibility = false
    @State private var hasTrackedPrivacyView = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Before You Start")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(CivicaColors.textPrimary)

                privacySection(
                    title: "What this tool does",
                    body: "This tool helps you prepare for SNAP. It does not submit an official application and does not decide eligibility."
                )

                privacySection(
                    title: "What not to enter",
                    body: "Do not enter Social Security numbers, bank account numbers, immigration document numbers, or upload documents here."
                )

                privacySection(
                    title: "How your answers are handled",
                    body: "During this draft, answers stay in this app session and are not submitted to the government."
                )

                privacySection(
                    title: "Official submission",
                    body: "To get benefits, you must submit through your official state SNAP process."
                )

                Text("This screen does not determine eligibility or approval.")
                    .font(.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)

                VStack(spacing: 10) {
                    Button("Continue to SNAP prep") {
                        viewModel.acceptedPrivacyNotice = true
                        continueToEligibility = true
                    }
                    .buttonStyle(CivicaPrimaryCTAButtonStyle())

                    if let officialURL {
                        Button("Go to official application") {
                            openURL(officialURL)
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(CivicaColors.primaryCTA)
                        .buttonStyle(.plain)
                    }

                    Button("Go back") {
                        dismiss()
                    }
                    .buttonStyle(SNAPSecondaryCTAButtonStyle())
                }
                .padding(.top, 4)
            }
            .padding(16)
        }
        .background(CivicaColors.brandSoftBlue.ignoresSafeArea())
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

    private var officialURL: URL? {
        guard let resource = SNAPStateResources.resource(for: viewModel.application.state) else {
            return nil
        }
        return URL(string: resource.officialApplicationURL)
    }

    @ViewBuilder
    private func privacySection(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.headline)
                .foregroundStyle(CivicaColors.textPrimary)
            Text(body)
                .font(.body)
                .foregroundStyle(CivicaColors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(CivicaColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
        )
    }
}
