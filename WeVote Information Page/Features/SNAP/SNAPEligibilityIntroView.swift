import SwiftUI

// EXPERIMENTAL SILOED MODULE: eligibility intro screen with mock, non-sensitive inputs.
struct SNAPEligibilityIntroView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: SNAPApplicationViewModel
    @State private var continueToGuidedDraft = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .center, spacing: 10) {
                        Image(systemName: "bag.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(VoteNowColors.primaryCTA)
                            .frame(width: 30, height: 30)
                            .background(
                                Circle()
                                    .fill(VoteNowColors.statusInfoSurface)
                            )

                        Text("What is SNAP?")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(VoteNowColors.textPrimary)
                    }

                    Text("SNAP most commonly stands for the Supplemental Nutrition Assistance Program in the United States.")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)

                    Text("It’s a government program that helps low-income individuals and families buy food.")
                        .font(.body)
                        .foregroundStyle(VoteNowColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    VStack(alignment: .leading, spacing: 10) {
                        SNAPDescriptionRow(
                            iconName: "creditcard",
                            text: "Monthly benefits are loaded onto an EBT (Electronic Benefits Transfer) card."
                        )
                        SNAPDescriptionRow(
                            iconName: "cart",
                            text: "The card works like a debit card at grocery stores and some farmers markets."
                        )
                        SNAPDescriptionRow(
                            iconName: "carrot",
                            text: "SNAP can buy eligible food items (fruits, vegetables, meat, dairy, bread, and more)."
                        )
                        SNAPDescriptionRow(
                            iconName: "xmark.circle",
                            text: "SNAP cannot be used for alcohol, tobacco, or hot prepared meals."
                        )
                    }
                    .padding(.top, 2)
                }
                .padding(.vertical, 8)

                if let submittedAt = viewModel.submittedAt {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("SNAP Application Status")
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(VoteNowColors.textPrimary)

                        HStack(spacing: 8) {
                            Text("Status:")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(VoteNowColors.textSecondary)
                            Text("Draft Completed")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(VoteNowColors.successGreen)
                        }

                        HStack(spacing: 8) {
                            Text("Date:")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(VoteNowColors.textSecondary)
                            Text(statusDateText(from: submittedAt))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(VoteNowColors.textPrimary)
                        }

                        Button("See responses") {
                            viewModel.jumpToDraftStep(.reviewDraft)
                            continueToGuidedDraft = true
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(VoteNowColors.primaryCTA)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(VoteNowColors.surfacePrimary)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
                    )
                }

                Button("Confirm Eligibity and Apply") {
                    continueToGuidedDraft = true
                }
                .buttonStyle(VoteNowPrimaryCTAButtonStyle())
            }
            .padding(16)
        }
        .background(VoteNowColors.brandSoftBlue.ignoresSafeArea())
        .toolbarBackground(VoteNowColors.brandSoftBlue, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .navigationDestination(isPresented: $continueToGuidedDraft) {
            SNAPStepContainerView(viewModel: viewModel) {
                dismiss()
            }
            .navigationTitle("SNAP Eligibility Questionaire")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                viewModel.resetDraftFlow()
            }
        }
    }

    private func statusDateText(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

private struct SNAPDescriptionRow: View {
    let iconName: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: iconName)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(VoteNowColors.primaryCTA)
                .frame(width: 20, height: 20)
                .padding(.top, 1)

            Text(text)
                .font(.subheadline)
                .foregroundStyle(VoteNowColors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
